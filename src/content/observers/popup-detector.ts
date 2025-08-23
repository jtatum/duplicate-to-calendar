// Event popup detection logic

import { DOM_SELECTORS } from '../../shared/constants.js';
import { log } from '../../shared/utils.js';
import { EventDialogElement } from '../../shared/types.js';

export type PopupCallback = (popup: EventDialogElement) => void;

export class PopupDetector {
  private processedPopups = new WeakSet<Element>();

  /**
   * Checks nodes for event popups and calls callback for new ones
   */
  checkForEventPopups(nodes: Node[], onPopupFound: PopupCallback): void {
    nodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        this.checkElement(node as Element, onPopupFound);
      }
    });
  }

  /**
   * Checks a single element and its children for event dialogs
   */
  private checkElement(element: Element, onPopupFound: PopupCallback): void {
    const eventDialogs: Element[] = [];

    // Check multiple selectors for event dialogs
    DOM_SELECTORS.EVENT_DIALOGS.forEach((selector) => {
      // Check if the element itself matches
      if (element.matches?.(selector)) {
        eventDialogs.push(element);
      }

      // Check for child dialogs
      if (element.querySelectorAll) {
        const childDialogs = Array.from(element.querySelectorAll(selector));
        eventDialogs.push(...childDialogs);
      }
    });

    // Process each dialog found
    eventDialogs.forEach((dialog) => {
      if (!this.processedPopups.has(dialog)) {
        if (this.isValidEventDialog(dialog)) {
          log('info', 'Found valid event dialog');
          this.processedPopups.add(dialog);
          onPopupFound(dialog as EventDialogElement);
        }
      }
    });
  }

  /**
   * Validates that an element is actually an event dialog we should process
   */
  private isValidEventDialog(dialog: Element): boolean {
    log('info', 'Validating event dialog');

    // Must be visible (not display: none)
    const style = window.getComputedStyle(dialog);
    if (style.display === 'none') {
      log('info', 'Dialog hidden (display: none)');
      return false;
    }

    // Check for basic dialog indicators
    const hasEventIndicators = this.hasEventIndicators(dialog);
    if (!hasEventIndicators) {
      log('info', 'No event indicators found in dialog');
      return false;
    }

    log('info', 'Event dialog validation passed');
    return true;
  }

  /**
   * Checks if dialog has event-related indicators
   */
  private hasEventIndicators(dialog: Element): boolean {
    // Check for event ID attribute
    if (dialog.getAttribute('data-eventid')) {
      return true;
    }

    // Check for specific event-related elements
    const eventElements = [
      '#rAECCd', // Event title
      '.AzuXid', // Event time
      '.JEx5le', // Alternative time selector
    ];

    if (eventElements.some(selector => dialog.querySelector(selector))) {
      return true;
    }

    // Check for event-related text content
    const textContent = dialog.textContent?.toLowerCase();
    if (textContent && (
      textContent.includes('location:') || 
      textContent.includes('description:') ||
      textContent.includes('organizer:')
    )) {
      return true;
    }

    return false;
  }

  /**
   * Forces recheck of all current dialogs (useful for testing)
   */
  recheckCurrentDialogs(onPopupFound: PopupCallback): void {
    log('info', 'Rechecking current dialogs');
    this.checkElement(document.body, onPopupFound);
  }

  /**
   * Clears the processed popups cache (for testing or reset)
   */
  clearProcessedCache(): void {
    this.processedPopups = new WeakSet<Element>();
    log('info', 'Processed popups cache cleared');
  }

  /**
   * Checks if a popup has been processed
   */
  isProcessed(popup: Element): boolean {
    return this.processedPopups.has(popup);
  }

  /**
   * Manually marks a popup as processed
   */
  markAsProcessed(popup: Element): void {
    this.processedPopups.add(popup);
  }
}