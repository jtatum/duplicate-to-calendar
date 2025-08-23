// Status card component for showing authentication and configuration status

import { sanitizeText } from '../../shared/sanitizers.js';
import { log } from '../../shared/utils.js';

export type StatusType = 'ready' | 'partial' | 'error' | 'loading';

export interface StatusInfo {
  type: StatusType;
  title: string;
  accountInfo: string;
  calendarInfo: string;
}

export class StatusCard {
  private cardElement: HTMLElement;
  private iconElement: HTMLElement;
  private titleElement: HTMLElement;
  private accountElement: HTMLElement;
  private calendarElement: HTMLElement;

  constructor(cardElement: HTMLElement) {
    this.cardElement = cardElement;
    
    // Find child elements
    this.iconElement = this.cardElement.querySelector('.status-icon') as HTMLElement;
    this.titleElement = this.cardElement.querySelector('.status-title') as HTMLElement;
    this.accountElement = this.cardElement.querySelector('#account-info') as HTMLElement;
    this.calendarElement = this.cardElement.querySelector('#calendar-info') as HTMLElement;
    
    if (!this.iconElement || !this.titleElement || !this.accountElement || !this.calendarElement) {
      throw new Error('Status card missing required child elements');
    }
  }

  /**
   * Updates the status card display
   */
  updateStatus(status: StatusInfo): void {
    log('info', 'Updating status card', { type: status.type, title: status.title });
    
    // Update CSS class
    this.cardElement.className = `status-card status-${status.type}`;
    
    // Update icon based on status type
    this.iconElement.textContent = this.getStatusIcon(status.type);
    
    // Update text content (sanitized)
    this.titleElement.textContent = sanitizeText(status.title);
    this.accountElement.textContent = sanitizeText(status.accountInfo);
    this.calendarElement.textContent = sanitizeText(status.calendarInfo);
  }

  /**
   * Shows ready state - extension is configured and ready to use
   */
  showReady(calendarName?: string): void {
    this.updateStatus({
      type: 'ready',
      title: 'Ready to Duplicate Events',
      accountInfo: 'Signed in to Google Calendar',
      calendarInfo: calendarName ? 
        `Destination: ${calendarName}` : 
        'Destination calendar configured'
    });
  }

  /**
   * Shows partial state - authenticated but not configured
   */
  showPartialSetup(): void {
    this.updateStatus({
      type: 'partial',
      title: 'Setup Required',
      accountInfo: 'Signed in to Google Calendar',
      calendarInfo: 'Please select a destination calendar'
    });
  }

  /**
   * Shows error state - not authenticated
   */
  showNotConfigured(): void {
    this.updateStatus({
      type: 'error',
      title: 'Not Configured',
      accountInfo: 'Not signed in to Google Calendar',
      calendarInfo: 'Please log in to continue'
    });
  }

  /**
   * Shows loading state
   */
  showLoading(message = 'Loading...'): void {
    this.updateStatus({
      type: 'loading',
      title: 'Loading',
      accountInfo: sanitizeText(message),
      calendarInfo: 'Please wait...'
    });
  }

  /**
   * Shows error state with custom message
   */
  showError(message: string): void {
    this.updateStatus({
      type: 'error',
      title: 'Configuration Error',
      accountInfo: 'Unable to verify authentication',
      calendarInfo: sanitizeText(message)
    });
  }

  /**
   * Gets the appropriate icon for a status type
   */
  private getStatusIcon(type: StatusType): string {
    switch (type) {
      case 'ready':
        return '✅';
      case 'partial':
        return '⚠️';
      case 'error':
        return '❌';
      case 'loading':
        return '⏳';
      default:
        return '❓';
    }
  }

  /**
   * Adds a CSS class to the card
   */
  addClass(className: string): void {
    this.cardElement.classList.add(className);
  }

  /**
   * Removes a CSS class from the card
   */
  removeClass(className: string): void {
    this.cardElement.classList.remove(className);
  }

  /**
   * Gets the current status type based on CSS class
   */
  getCurrentType(): StatusType | null {
    const classes = this.cardElement.className.split(' ');
    for (const className of classes) {
      if (className.startsWith('status-')) {
        const type = className.replace('status-', '');
        if (['ready', 'partial', 'error', 'loading'].includes(type)) {
          return type as StatusType;
        }
      }
    }
    return null;
  }

  /**
   * Shows a temporary status message
   */
  showTemporary(status: StatusInfo, duration: number): void {
    const originalStatus = this.getCurrentStatus();
    this.updateStatus(status);
    
    setTimeout(() => {
      if (originalStatus) {
        this.updateStatus(originalStatus);
      } else {
        this.showNotConfigured(); // Fallback to default state
      }
    }, duration);
  }

  /**
   * Gets the current status info
   */
  private getCurrentStatus(): StatusInfo | null {
    const type = this.getCurrentType();
    if (!type) return null;
    
    return {
      type,
      title: this.titleElement.textContent || '',
      accountInfo: this.accountElement.textContent || '',
      calendarInfo: this.calendarElement.textContent || ''
    };
  }

  /**
   * Gets the DOM element
   */
  getElement(): HTMLElement {
    return this.cardElement;
  }
}