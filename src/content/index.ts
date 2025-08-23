// Content script for Google Calendar Event Duplicator

import { EventInfo, MessageResponse, CalendarEvent } from '../shared/types.js';
import { MESSAGE_ACTIONS } from '../shared/constants.js';
import { extractErrorMessage, log } from '../shared/utils.js';
import { MutationManager } from './observers/mutation-manager.js';
import { PopupDetector } from './observers/popup-detector.js';
import { ButtonInjector } from './ui/button-injector.js';

log('info', 'Google Calendar Event Duplicator content script loaded');

class ContentScript {
  private mutationManager = new MutationManager();
  private popupDetector = new PopupDetector();
  private buttonInjector = new ButtonInjector(this.mutationManager);

  /**
   * Initializes the content script
   */
  init(): void {
    log('info', 'Initializing Google Calendar duplicate button injection');

    try {
      // Clean up any existing setup
      this.cleanup();

      // Set up main mutation observer
      this.mutationManager.setupMainObserver((addedNodes) => {
        this.popupDetector.checkForEventPopups(addedNodes, (popup) => {
          this.buttonInjector.processEventPopup(popup, (eventInfo) => {
            return this.handleDuplicateEvent(eventInfo);
          });
        });
      });

      // Set up periodic cleanup
      this.mutationManager.setupPeriodicCleanup();

      // Set up cleanup listeners
      this.setupCleanupListeners();

      // Check for existing popups on initial load
      setTimeout(() => {
        this.popupDetector.recheckCurrentDialogs((popup) => {
          this.buttonInjector.processEventPopup(popup, (eventInfo) => {
            return this.handleDuplicateEvent(eventInfo);
          });
        });
      }, 1000);

      log('info', 'Content script initialization complete');

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to initialize content script', { error: message });
    }
  }

  /**
   * Handles duplicate event request
   */
  private async handleDuplicateEvent(eventInfo: EventInfo): Promise<void> {
    try {
      log('info', 'Sending duplicate event request to background script');
      
      const response = await chrome.runtime.sendMessage({
        action: MESSAGE_ACTIONS.DUPLICATE_EVENT,
        eventInfo: eventInfo
      }) as MessageResponse<CalendarEvent>;

      if (response && response.success) {
        log('info', 'Event duplicated successfully');
      } else {
        const errorMessage = response?.error || 'Failed to duplicate event';
        log('error', 'Event duplication failed', { error: errorMessage });
        throw new Error(errorMessage);
      }

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Error communicating with background script', { error: message });
      throw error;
    }
  }

  /**
   * Sets up listeners for cleanup events
   */
  private setupCleanupListeners(): void {
    // Clean up when page is about to be unloaded
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        log('info', 'Page hidden - maintaining observers');
      } else if (document.visibilityState === 'visible') {
        log('info', 'Page visible - ensuring observers are active');
        // Could add logic here to restart observers if needed
      }
    });

    // Handle errors
    window.addEventListener('error', (event) => {
      log('error', 'Unhandled error in content script', { 
        error: event.error?.message || event.message 
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      log('error', 'Unhandled promise rejection in content script', { 
        error: event.reason 
      });
    });
  }

  /**
   * Gets diagnostic information about the content script state
   */
  getDiagnostics(): object {
    return {
      mutationManager: this.mutationManager.getStats(),
      timestamp: new Date().toISOString(),
      url: window.location.href,
      readyState: document.readyState,
      visible: document.visibilityState === 'visible'
    };
  }

  /**
   * Global cleanup function
   */
  cleanup(): void {
    log('info', 'Cleaning up content script resources');

    try {
      this.mutationManager.cleanup();
      this.buttonInjector.cleanup();
      this.popupDetector.clearProcessedCache();

      log('info', 'Content script cleanup completed');
    } catch (error) {
      log('error', 'Error during content script cleanup', { error });
    }
  }
}

// Initialize the content script
const contentScript = new ContentScript();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    contentScript.init();
  });
} else {
  contentScript.init();
}

// Make diagnostics available globally for debugging
(window as any).__duplicateCalendarDiagnostics = () => {
  return contentScript.getDiagnostics();
};

// Export for testing
export default contentScript;