// MutationObserver lifecycle management

import { MUTATION_OBSERVER_CONFIG, CACHE_CONFIG } from '../../shared/constants.js';
import { debounce, log } from '../../shared/utils.js';

export type MutationCallback = (addedNodes: Node[]) => void;
export type CleanupFunction = () => void;

export class MutationManager {
  private activeObservers = new Set<MutationObserver>();
  private mainObserver: MutationObserver | null = null;
  private cleanupCallbacks = new Set<CleanupFunction>();

  /**
   * Sets up the main mutation observer for the document
   */
  setupMainObserver(onNodeAdded: MutationCallback): void {
    if (this.mainObserver) {
      log('warn', 'Main observer already exists, cleaning up first');
      this.cleanup();
    }

    log('info', 'Setting up main mutation observer');
    
    this.mainObserver = new MutationObserver((mutations) => {
      const addedNodes: Node[] = [];
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              addedNodes.push(node);
            }
          });
        }
      });

      if (addedNodes.length > 0) {
        onNodeAdded(addedNodes);
      }
    });

    // Start observing the entire document for changes
    this.mainObserver.observe(document.body, MUTATION_OBSERVER_CONFIG);
    this.activeObservers.add(this.mainObserver);
    
    log('info', 'Main mutation observer active');
  }

  /**
   * Creates a targeted observer for a specific element
   */
  createTargetedObserver(
    target: Element, 
    callback: MutationCallback,
    options = MUTATION_OBSERVER_CONFIG
  ): CleanupFunction {
    const observer = new MutationObserver((mutations) => {
      const addedNodes: Node[] = [];
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            addedNodes.push(node);
          });
        }
      });

      if (addedNodes.length > 0) {
        callback(addedNodes);
      }
    });

    observer.observe(target, options);
    this.activeObservers.add(observer);

    const cleanup = () => {
      observer.disconnect();
      this.activeObservers.delete(observer);
      this.cleanupCallbacks.delete(cleanup);
    };

    this.cleanupCallbacks.add(cleanup);
    return cleanup;
  }

  /**
   * Creates an observer that watches for element removal
   */
  createRemovalObserver(
    target: Element,
    onRemoval: (removedElement: Element) => void
  ): CleanupFunction {
    if (!target.parentNode) {
      log('warn', 'Cannot create removal observer: target has no parent');
      return () => {};
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((removedNode) => {
            if (removedNode === target || 
                (removedNode.nodeType === Node.ELEMENT_NODE && 
                 (removedNode as Element).contains(target))) {
              log('info', 'Target element removed from DOM');
              onRemoval(target);
              observer.disconnect();
              this.activeObservers.delete(observer);
            }
          });
        }
      });
    });

    observer.observe(target.parentNode, { childList: true });
    this.activeObservers.add(observer);

    const cleanup = () => {
      observer.disconnect();
      this.activeObservers.delete(observer);
      this.cleanupCallbacks.delete(cleanup);
    };

    this.cleanupCallbacks.add(cleanup);
    return cleanup;
  }

  /**
   * Creates an intersection observer for visibility detection
   */
  createIntersectionObserver(
    target: Element,
    onVisibilityChange: (isVisible: boolean) => void,
    options?: IntersectionObserverInit
  ): CleanupFunction {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === target) {
            const isVisible = entry.isIntersecting && document.contains(target);
            onVisibilityChange(isVisible);
            
            if (!isVisible && !document.contains(target)) {
              log('info', 'Target no longer visible and not in DOM');
              observer.disconnect();
            }
          }
        });
      },
      options
    );

    observer.observe(target);

    const cleanup = () => {
      observer.disconnect();
      this.cleanupCallbacks.delete(cleanup);
    };

    this.cleanupCallbacks.add(cleanup);
    return cleanup;
  }

  /**
   * Sets up automatic cleanup detection for stale observers
   */
  setupPeriodicCleanup(): void {
    const cleanupStaleObservers = debounce(() => {
      log('info', 'Running periodic cleanup of stale observers');
      
      let removedCount = 0;
      const staleFunctions: CleanupFunction[] = [];
      
      this.cleanupCallbacks.forEach((cleanupFn) => {
        // Check if cleanup function is still needed
        // This is a simple heuristic - in a real implementation,
        // you might want more sophisticated detection
        try {
          // If cleanup function throws or seems invalid, mark for removal
          if (typeof cleanupFn !== 'function') {
            staleFunctions.push(cleanupFn);
          }
        } catch {
          staleFunctions.push(cleanupFn);
        }
      });
      
      staleFunctions.forEach((staleFn) => {
        try {
          staleFn();
          removedCount++;
        } catch {
          // Ignore cleanup errors for stale functions
        }
      });
      
      log('info', `Periodic cleanup: removed ${removedCount} stale observers`);
    }, 1000);

    // Run cleanup every 5 minutes
    setInterval(cleanupStaleObservers, CACHE_CONFIG.AUTO_CLEANUP_INTERVAL);
  }

  /**
   * Gets statistics about active observers
   */
  getStats(): { 
    activeObservers: number; 
    cleanupCallbacks: number; 
    hasMainObserver: boolean 
  } {
    return {
      activeObservers: this.activeObservers.size,
      cleanupCallbacks: this.cleanupCallbacks.size,
      hasMainObserver: this.mainObserver !== null
    };
  }

  /**
   * Global cleanup function to disconnect all observers
   */
  cleanup(): void {
    log('info', 'Cleaning up all observers', this.getStats());
    
    // Disconnect main observer
    if (this.mainObserver) {
      this.mainObserver.disconnect();
      this.activeObservers.delete(this.mainObserver);
      this.mainObserver = null;
    }
    
    // Disconnect all active observers
    this.activeObservers.forEach((observer) => {
      observer.disconnect();
    });
    this.activeObservers.clear();
    
    // Run all cleanup callbacks
    this.cleanupCallbacks.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        log('warn', 'Error during cleanup callback', { error });
      }
    });
    this.cleanupCallbacks.clear();
    
    log('info', 'Observer cleanup completed');
  }
}