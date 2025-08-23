// Calendar selection dropdown component

import { CalendarListItem } from '../../shared/types.js';
import { sanitizeText } from '../../shared/sanitizers.js';
import { validateCalendarId } from '../../shared/validators.js';
import { extractErrorMessage, log } from '../../shared/utils.js';
import { AuthManager } from '../services/auth-manager.js';

export class CalendarSelector {
  private element: HTMLSelectElement;
  private authManager: AuthManager;
  private onChangeCallback?: (calendarId: string, calendarName: string) => void;

  constructor(selectElement: HTMLSelectElement, authManager: AuthManager) {
    this.element = selectElement;
    this.authManager = authManager;
    this.setupEventListeners();
  }

  /**
   * Sets up event listeners for the selector
   */
  private setupEventListeners(): void {
    this.element.addEventListener('change', () => {
      const selectedOption = this.element.options[this.element.selectedIndex];
      if (selectedOption && this.onChangeCallback) {
        const calendarId = selectedOption.value;
        const calendarName = selectedOption.dataset.calendarName || selectedOption.textContent || '';
        this.onChangeCallback(calendarId, calendarName);
      }
    });
  }

  /**
   * Loads calendars into the selector
   */
  async loadCalendars(): Promise<void> {
    try {
      log('info', 'Loading calendars into selector');
      
      // Clear existing options except the first placeholder
      this.clearOptions();
      
      // Get calendars from auth manager
      const calendars = await this.authManager.getCalendars();
      
      // Add calendar options
      this.populateOptions(calendars);
      
      // Re-enable the dropdown after successful loading
      this.setEnabled(true);
      
      log('info', `Loaded ${calendars.length} calendars into selector`);
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to load calendars', { error: message });
      throw error;
    }
  }

  /**
   * Clears all options except the placeholder
   */
  private clearOptions(): void {
    this.element.innerHTML = '<option value="">Select a calendar...</option>';
  }

  /**
   * Populates the selector with calendar options
   */
  private populateOptions(calendars: CalendarListItem[]): void {
    calendars.forEach(calendar => {
      if (validateCalendarId(calendar.id)) {
        const option = document.createElement('option');
        option.value = calendar.id;
        
        const displayName = sanitizeText(calendar.summaryOverride || calendar.summary);
        option.textContent = displayName;
        option.dataset.calendarName = displayName;
        
        this.element.appendChild(option);
      } else {
        log('warn', 'Skipping calendar with invalid ID', { 
          calendarId: calendar.id 
        });
      }
    });
  }

  /**
   * Sets the selected calendar by ID
   */
  setSelectedCalendar(calendarId: string): void {
    if (!validateCalendarId(calendarId)) {
      log('warn', 'Cannot select invalid calendar ID', { calendarId });
      return;
    }
    
    this.element.value = calendarId;
    log('info', 'Calendar selection updated', { calendarId });
  }

  /**
   * Gets the currently selected calendar info
   */
  getSelectedCalendar(): { id: string; name: string } | null {
    const selectedOption = this.element.options[this.element.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
      return null;
    }
    
    return {
      id: selectedOption.value,
      name: selectedOption.dataset.calendarName || selectedOption.textContent || ''
    };
  }

  /**
   * Sets a callback for when the selection changes
   */
  onSelectionChange(callback: (calendarId: string, calendarName: string) => void): void {
    this.onChangeCallback = callback;
  }

  /**
   * Enables or disables the selector
   */
  setEnabled(enabled: boolean): void {
    this.element.disabled = !enabled;
    
    if (enabled) {
      this.element.classList.remove('disabled');
    } else {
      this.element.classList.add('disabled');
    }
  }

  /**
   * Shows loading state
   */
  showLoading(): void {
    this.setEnabled(false);
    this.element.innerHTML = '<option value="">Loading calendars...</option>';
  }

  /**
   * Shows error state
   */
  showError(message: string): void {
    this.setEnabled(false);
    const sanitizedMessage = sanitizeText(message);
    this.element.innerHTML = `<option value="">Error: ${sanitizedMessage}</option>`;
  }

  /**
   * Shows not authenticated state
   */
  showNotAuthenticated(): void {
    this.setEnabled(false);
    this.element.innerHTML = '<option value="">Please log in to view calendars</option>';
  }

  /**
   * Resets to initial state
   */
  reset(): void {
    this.clearOptions();
    this.setEnabled(true);
  }

  /**
   * Gets the HTML element
   */
  getElement(): HTMLSelectElement {
    return this.element;
  }
}