// Button injection and management

import { EventInfo, EventDialogElement } from '../../shared/types.js';
import { DOM_SELECTORS, STORAGE_KEYS } from '../../shared/constants.js';
import { validateEventInfo } from '../../shared/validators.js';
import { sanitizeErrorMessage } from '../../shared/sanitizers.js';
import { extractErrorMessage, debounce, log } from '../../shared/utils.js';
import { ButtonStateManager } from './button-state.js';
import { EventExtractor } from '../extractors/event-extractor.js';
import { MutationManager, CleanupFunction } from '../observers/mutation-manager.js';

export type DuplicateEventHandler = (eventInfo: EventInfo) => Promise<void>;

export class ButtonInjector {
  private stateManager = new ButtonStateManager();
  private eventExtractor = new EventExtractor();
  private mutationManager: MutationManager;
  private activeButtons = new WeakMap<Element, HTMLButtonElement>();
  private activeCleanups = new WeakMap<Element, CleanupFunction[]>();

  constructor(mutationManager: MutationManager) {
    this.mutationManager = mutationManager;
  }

  /**
   * Processes an event popup by potentially adding a duplicate button
   */
  async processEventPopup(popup: EventDialogElement, onDuplicate: DuplicateEventHandler): Promise<void> {
    log('info', 'Processing event popup for button injection');

    // Check if we've already processed this popup
    if (popup.hasAttribute('data-duplicate-button-processed')) {
      log('info', 'Popup already processed');
      return;
    }

    // Mark as processed to prevent duplicate processing
    popup.setAttribute('data-duplicate-button-processed', 'true');

    try {
      // Extract event info
      const eventInfo = this.eventExtractor.extractEventInfo(popup);

      // Get destination calendar settings
      const settings = await chrome.storage.sync.get([
        STORAGE_KEYS.SELECTED_CALENDAR_ID, 
        STORAGE_KEYS.SELECTED_CALENDAR_NAME
      ]);

      log('info', 'Checking destination calendar configuration');

      // Don't show button if no destination calendar is configured
      if (!settings[STORAGE_KEYS.SELECTED_CALENDAR_ID]) {
        log('info', 'No destination calendar configured, skipping button injection');
        return;
      }

      // Check if event is already in destination calendar
      const isInDestinationCalendar = this.checkIfInDestinationCalendar(
        eventInfo,
        settings[STORAGE_KEYS.SELECTED_CALENDAR_ID],
        settings[STORAGE_KEYS.SELECTED_CALENDAR_NAME]
      );

      if (isInDestinationCalendar) {
        log('info', 'Event is already in destination calendar, skipping button injection');
        return;
      }

      log('info', 'Event is in different calendar, proceeding with button injection');
      this.injectDuplicateButton(popup, eventInfo, onDuplicate);

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Error processing event popup', { error: message });
      // Don't throw - continue with other popups
    }
  }

  /**
   * Checks if event is already in the destination calendar
   */
  private checkIfInDestinationCalendar(
    eventInfo: EventInfo,
    destinationCalendarId: string,
    destinationCalendarName?: string
  ): boolean {
    // First try calendar ID comparison (most reliable)
    if (eventInfo.calendarId && eventInfo.calendarId === destinationCalendarId) {
      log('info', 'Calendar ID match detected');
      return true;
    }

    // Fall back to calendar name comparison
    if (eventInfo.calendarName && destinationCalendarName &&
        eventInfo.calendarName.toLowerCase() === destinationCalendarName.toLowerCase()) {
      log('info', 'Calendar name match detected');
      return true;
    }

    log('info', 'Event is in different calendar from destination');
    return false;
  }

  /**
   * Injects the duplicate button into the popup
   */
  private injectDuplicateButton(
    popup: EventDialogElement,
    eventInfo: EventInfo,
    onDuplicate: DuplicateEventHandler
  ): void {
    // Use persistent injection with retries
    const tryInject = () => {
      const buttonContainer = popup.querySelector(DOM_SELECTORS.BUTTON_CONTAINER);
      
      if (!buttonContainer) {
        log('info', 'Button container not found');
        return false;
      }

      // Check if button already exists
      const existingButton = this.activeButtons.get(popup);
      if (existingButton && document.contains(existingButton)) {
        log('info', 'Button already exists and is in DOM');
        return true;
      }

      log('info', 'Injecting duplicate button');
      const button = this.createDuplicateButton(eventInfo, onDuplicate);
      
      try {
        buttonContainer.appendChild(button);
        this.activeButtons.set(popup, button);
        log('info', 'Duplicate button injected successfully');
        
        // Set up button monitoring
        this.setupButtonMonitoring(popup, button, eventInfo, onDuplicate);
        
        return true;
        
      } catch (error) {
        log('error', 'Failed to inject button', { error });
        
        // Try inserting as first child instead
        try {
          buttonContainer.insertBefore(button, buttonContainer.firstChild);
          this.activeButtons.set(popup, button);
          log('info', 'Button injected as first child successfully');
          this.setupButtonMonitoring(popup, button, eventInfo, onDuplicate);
          return true;
        } catch (error2) {
          log('error', 'Failed to inject as first child', { error2 });
          return false;
        }
      }
    };

    // Try injection immediately
    if (!tryInject()) {
      // Retry after a short delay if initial injection fails
      setTimeout(() => {
        tryInject();
      }, 100);
    }
  }

  /**
   * Creates a duplicate button element
   */
  private createDuplicateButton(eventInfo: EventInfo, onDuplicate: DuplicateEventHandler): HTMLButtonElement {
    const button = this.stateManager.createButton();
    
    // Add click handler
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      await this.handleDuplicateClick(button, eventInfo, onDuplicate);
    });

    return button;
  }

  /**
   * Handles duplicate button click
   */
  private async handleDuplicateClick(
    button: HTMLButtonElement,
    eventInfo: EventInfo,
    onDuplicate: DuplicateEventHandler
  ): Promise<void> {
    log('info', 'Duplicate button clicked');

    try {
      // Validate event info
      const validationResult = validateEventInfo(eventInfo);
      if (!validationResult.isValid) {
        this.stateManager.showError(button, 'Invalid event data');
        return;
      }

      // Show loading state
      this.stateManager.showLoading(button);

      // Call the duplicate handler
      await onDuplicate(eventInfo);

      // Show success state
      this.stateManager.showSuccess(button);

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Error duplicating event', { error: message });
      
      // Show sanitized error message
      const sanitizedMessage = sanitizeErrorMessage(error);
      this.stateManager.showError(button, sanitizedMessage);
    }
  }

  /**
   * Sets up monitoring for the injected button
   */
  private setupButtonMonitoring(
    popup: EventDialogElement,
    button: HTMLButtonElement,
    eventInfo: EventInfo,
    onDuplicate: DuplicateEventHandler
  ): void {
    const cleanups: CleanupFunction[] = [];

    // Watch for content changes that might remove the button
    const contentWatcher = this.mutationManager.createTargetedObserver(
      popup,
      debounce(() => {
        this.handleContentChange(popup, button, eventInfo, onDuplicate);
      }, 100)
    );
    cleanups.push(contentWatcher);

    // Watch for popup removal
    const removalWatcher = this.mutationManager.createRemovalObserver(
      popup,
      () => {
        log('info', 'Popup removed, cleaning up button monitoring');
        this.cleanupPopup(popup);
      }
    );
    cleanups.push(removalWatcher);

    // Watch for visibility changes
    const visibilityWatcher = this.mutationManager.createIntersectionObserver(
      popup,
      (isVisible) => {
        if (!isVisible && !document.contains(popup)) {
          log('info', 'Popup no longer visible and not in DOM, cleaning up');
          this.cleanupPopup(popup);
        }
      }
    );
    cleanups.push(visibilityWatcher);

    // Store cleanup functions
    this.activeCleanups.set(popup, cleanups);

    // Set cleanup function on popup for external access
    popup._duplicateButtonCleanup = () => {
      this.cleanupPopup(popup);
    };
  }

  /**
   * Handles content changes in the popup
   */
  private handleContentChange(
    popup: EventDialogElement,
    button: HTMLButtonElement,
    eventInfo: EventInfo,
    onDuplicate: DuplicateEventHandler
  ): void {
    // Check if popup is still in DOM
    if (!document.contains(popup)) {
      this.cleanupPopup(popup);
      return;
    }

    // Check if button was removed
    if (!document.contains(button)) {
      log('info', 'Button was removed, attempting to re-inject');
      
      // Remove processed flag and try re-processing
      popup.removeAttribute('data-duplicate-button-processed');
      
      // Re-process the popup
      this.processEventPopup(popup, onDuplicate);
    }
  }

  /**
   * Cleans up resources for a popup
   */
  private cleanupPopup(popup: EventDialogElement): void {
    log('info', 'Cleaning up popup resources');
    
    // Run cleanup functions
    const cleanups = this.activeCleanups.get(popup);
    if (cleanups) {
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          log('warn', 'Error during cleanup', { error });
        }
      });
      this.activeCleanups.delete(popup);
    }

    // Clean up button state
    const button = this.activeButtons.get(popup);
    if (button) {
      this.stateManager.cleanup();
      this.activeButtons.delete(popup);
    }

    // Remove cleanup function from popup
    delete popup._duplicateButtonCleanup;
  }

  /**
   * Global cleanup for all managed buttons
   */
  cleanup(): void {
    log('info', 'Cleaning up all managed buttons');
    
    // Clean up all active buttons
    this.activeButtons = new WeakMap();
    
    // Clean up all active cleanups
    this.activeCleanups = new WeakMap();
    
    // Clean up state manager
    this.stateManager.cleanup();
  }
}