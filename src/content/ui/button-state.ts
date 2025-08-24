// Button state management

import { ButtonState, ButtonStateConfig } from '../../shared/types.js';
import { BUTTON_CONFIG } from '../../shared/constants.js';
import { sanitizeForDOM } from '../../shared/sanitizers.js';
import { log } from '../../shared/utils.js';

export class ButtonStateManager {
  private currentState: ButtonState = 'default';
  private timeoutId: ReturnType<typeof setTimeout> | undefined;

  /**
   * Updates button appearance based on state
   */
  updateButtonState(button: HTMLButtonElement, state: ButtonState, customText?: string): void {
    // Clear any existing timeout
    this.clearStateTimeout();
    
    // Remove existing state classes
    Object.keys(BUTTON_CONFIG.STATES).forEach(stateKey => {
      const stateConfig = BUTTON_CONFIG.STATES[stateKey as ButtonState];
      if (stateConfig.className) {
        button.classList.remove(stateConfig.className);
      }
    });

    const stateConfig = BUTTON_CONFIG.STATES[state];
    const text = customText || stateConfig.text;
    
    // Apply new state
    this.currentState = state;
    
    // Add state-specific class if defined
    if (stateConfig.className) {
      button.classList.add(stateConfig.className);
    }
    
    // Update button content with sanitized (but unencoded) text
    const sanitizedText = sanitizeForDOM(text);
    this.updateButtonContent(button, stateConfig.icon, sanitizedText);
    
    // Set disabled state
    button.disabled = stateConfig.disabled || false;
    
    // Set up auto-reset timeout if configured
    if (stateConfig.timeout && stateConfig.timeout > 0) {
      this.timeoutId = window.setTimeout(() => {
        this.resetToDefault(button);
      }, stateConfig.timeout) as any;
    }

    log('info', `Button state updated to: ${state}`, { text, disabled: button.disabled });
  }

  /**
   * Resets button to default state
   */
  resetToDefault(button: HTMLButtonElement): void {
    this.updateButtonState(button, 'default');
  }

  /**
   * Shows loading state
   */
  showLoading(button: HTMLButtonElement, text?: string): void {
    this.updateButtonState(button, 'loading', text);
  }

  /**
   * Shows success state
   */
  showSuccess(button: HTMLButtonElement, text?: string): void {
    this.updateButtonState(button, 'success', text);
  }

  /**
   * Shows error state
   */
  showError(button: HTMLButtonElement, text?: string): void {
    this.updateButtonState(button, 'error', text);
  }

  /**
   * Gets the current button state
   */
  getCurrentState(): ButtonState {
    return this.currentState;
  }

  /**
   * Checks if button is in a temporary state (will auto-reset)
   */
  isTemporaryState(): boolean {
    const stateConfig = BUTTON_CONFIG.STATES[this.currentState];
    return !!(stateConfig.timeout && stateConfig.timeout > 0);
  }

  /**
   * Clears any active state timeout
   */
  clearStateTimeout(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  /**
   * Updates button content safely using DOM methods
   */
  private updateButtonContent(button: HTMLButtonElement, icon: string, text: string): void {
    // Clear existing content
    button.innerHTML = '';
    
    // Create new content structure
    const buttonSpan = document.createElement('span');
    buttonSpan.className = BUTTON_CONFIG.SPAN_CLASS_NAME;
    
    const iconSpan = document.createElement('span');
    iconSpan.textContent = icon + ' ';
    
    const textSpan = document.createElement('span');
    textSpan.className = BUTTON_CONFIG.TEXT_CLASS_NAME;
    textSpan.textContent = text;
    
    buttonSpan.appendChild(iconSpan);
    buttonSpan.appendChild(textSpan);
    button.appendChild(buttonSpan);
  }

  /**
   * Creates a button element with default styling and state
   */
  createButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = BUTTON_CONFIG.CLASS_NAME;
    button.title = BUTTON_CONFIG.TITLE;
    
    // Set up initial default state
    this.updateButtonState(button, 'default');
    
    return button;
  }

  /**
   * Cleanup function to clear timeouts
   */
  cleanup(): void {
    this.clearStateTimeout();
    this.currentState = 'default';
  }
}