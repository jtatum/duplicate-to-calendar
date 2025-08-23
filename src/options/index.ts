// Options page JavaScript for Google Calendar Event Duplicator

import { ExtensionSettings } from '../shared/types.js';
import { sanitizeErrorMessage } from '../shared/sanitizers.js';
import { extractErrorMessage, debounce, log } from '../shared/utils.js';
import { AuthManager } from './services/auth-manager.js';
import { SettingsManager } from './services/settings-manager.js';
import { CalendarSelector } from './components/calendar-selector.js';
import { StatusCard } from './components/status-card.js';

log('info', 'Google Calendar Event Duplicator options page loaded');

class OptionsPage {
  private authManager = new AuthManager();
  private settingsManager = new SettingsManager();
  private calendarSelector: CalendarSelector;
  private statusCard: StatusCard;
  private saveButton: HTMLButtonElement;
  private logoutButton: HTMLButtonElement;
  private loginButton: HTMLButtonElement | null = null;
  private statusMessage: HTMLElement;

  constructor() {
    // Get DOM elements
    const calendarSelect = document.getElementById('destination-calendar') as HTMLSelectElement;
    const statusCardElement = document.getElementById('status-card') as HTMLElement;
    this.saveButton = document.getElementById('save-settings') as HTMLButtonElement;
    this.logoutButton = document.getElementById('logout-btn') as HTMLButtonElement;
    this.statusMessage = document.getElementById('status-message') as HTMLElement;

    if (!calendarSelect || !statusCardElement || !this.saveButton || 
        !this.logoutButton || !this.statusMessage) {
      throw new Error('Required DOM elements not found');
    }

    // Initialize components
    this.calendarSelector = new CalendarSelector(calendarSelect, this.authManager);
    this.statusCard = new StatusCard(statusCardElement);

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Initializes the options page
   */
  async init(): Promise<void> {
    try {
      log('info', 'Initializing options page');

      // Load calendars and settings
      await Promise.all([
        this.loadCalendars(),
        this.loadSavedSettings()
      ]);

      // Update status card after initial load
      await this.updateStatusCard();

      log('info', 'Options page initialization complete');

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to initialize options page', { error: message });
      this.showStatusMessage(`Initialization error: ${sanitizeErrorMessage(error)}`, 'error');
    }
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    // Save settings when button is clicked
    this.saveButton.addEventListener('click', () => {
      this.saveSettings();
    });

    // Logout when button is clicked
    this.logoutButton.addEventListener('click', () => {
      this.logout();
    });

    // Update status card when calendar selection changes
    this.calendarSelector.onSelectionChange(debounce(() => {
      this.updateStatusCard();
    }, 300));

    // Listen for storage changes
    this.settingsManager.setupStorageListener(() => {
      this.updateStatusCard();
    });
  }

  /**
   * Loads calendars into the selector
   */
  private async loadCalendars(): Promise<void> {
    try {
      this.showStatusMessage('Loading calendars...');
      this.calendarSelector.showLoading();

      await this.calendarSelector.loadCalendars();

      this.showStatusMessage(`Calendars loaded successfully`, 'success');
      this.hideLoginButton();

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to load calendars', { error: message });

      // Check if error is due to logout state
      if (this.authManager.isLoggedOutError(message)) {
        this.showStatusMessage('You are logged out. Please log in to access calendars.');
        this.calendarSelector.showNotAuthenticated();
        this.showLoginButton();
      } else {
        this.showStatusMessage(`Error loading calendars: ${sanitizeErrorMessage(error)}`, 'error');
        this.calendarSelector.showError(sanitizeErrorMessage(error));
      }
    }
  }

  /**
   * Loads saved settings
   */
  private async loadSavedSettings(): Promise<void> {
    try {
      const settings = await this.settingsManager.loadSettings();
      
      if (settings.selectedCalendarId) {
        this.calendarSelector.setSelectedCalendar(settings.selectedCalendarId);
      }

      log('info', 'Saved settings loaded successfully');

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to load saved settings', { error: message });
      // Don't show error message for this as it's not critical
    }
  }

  /**
   * Saves current settings
   */
  private async saveSettings(): Promise<void> {
    try {
      const selectedCalendar = this.calendarSelector.getSelectedCalendar();
      
      if (!selectedCalendar) {
        this.showStatusMessage('Please select a calendar first.', 'error');
        return;
      }

      this.showStatusMessage('Saving settings...');
      this.saveButton.disabled = true;

      const settings: ExtensionSettings = {
        selectedCalendarId: selectedCalendar.id,
        selectedCalendarName: selectedCalendar.name
      };

      await this.settingsManager.saveSettings(settings);

      this.showStatusMessage('Settings saved successfully!', 'success');
      await this.updateStatusCard();

      // Clear success message after delay
      setTimeout(() => {
        this.clearStatusMessage();
      }, 3000);

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to save settings', { error: message });
      this.showStatusMessage(`Failed to save settings: ${sanitizeErrorMessage(error)}`, 'error');
    } finally {
      this.saveButton.disabled = false;
    }
  }

  /**
   * Handles logout
   */
  private async logout(): Promise<void> {
    try {
      this.showStatusMessage('Logging out...');
      this.logoutButton.disabled = true;

      await this.authManager.logout();

      // Clear the calendar dropdown and settings
      this.calendarSelector.reset();
      await this.settingsManager.clearSettings();

      this.showStatusMessage('Logged out successfully. Click "Log In" to re-authenticate.', 'success');
      this.showLoginButton();
      await this.updateStatusCard();

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Logout failed', { error: message });
      this.showStatusMessage(`Logout failed: ${sanitizeErrorMessage(error)}`, 'error');
    } finally {
      this.logoutButton.disabled = false;
    }
  }

  /**
   * Handles login
   */
  private async login(): Promise<void> {
    try {
      this.showStatusMessage('Logging in...');
      if (this.loginButton) {
        this.loginButton.disabled = true;
      }

      await this.authManager.login();

      // Reload calendars and settings after successful login
      await Promise.all([
        this.loadCalendars(),
        this.loadSavedSettings()
      ]);

      await this.updateStatusCard();
      this.showStatusMessage('Login successful!', 'success');

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Login failed', { error: message });
      this.showStatusMessage(`Login failed: ${sanitizeErrorMessage(error)}`, 'error');
    } finally {
      if (this.loginButton) {
        this.loginButton.disabled = false;
      }
    }
  }

  /**
   * Updates the status card based on current state
   */
  private async updateStatusCard(): Promise<void> {
    try {
      // Test authentication and get settings
      const [isAuthenticated, settings] = await Promise.all([
        this.authManager.testAuthentication(),
        this.settingsManager.loadSettings().catch(() => ({} as ExtensionSettings))
      ]);

      const selectedCalendar = this.calendarSelector.getSelectedCalendar();
      const hasValidSelection = !!(settings.selectedCalendarId || selectedCalendar?.id);

      if (!isAuthenticated) {
        // Not authenticated
        this.statusCard.showNotConfigured();
      } else if (!hasValidSelection) {
        // Authenticated but no calendar selected
        this.statusCard.showPartialSetup();
      } else {
        // Fully configured
        const calendarName = settings.selectedCalendarName || selectedCalendar?.name || 'Selected calendar';
        this.statusCard.showReady(calendarName);
      }

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Error updating status card', { error: message });
      this.statusCard.showError('Please try refreshing the page');
    }
  }

  /**
   * Shows login button
   */
  private showLoginButton(): void {
    if (!this.loginButton) {
      const buttonGroup = document.querySelector('.button-group');
      if (buttonGroup) {
        this.loginButton = document.createElement('button');
        this.loginButton.id = 'login-btn';
        this.loginButton.className = 'login-btn';
        this.loginButton.textContent = 'Log In';
        this.loginButton.addEventListener('click', () => {
          this.login();
        });
        buttonGroup.insertBefore(this.loginButton, buttonGroup.firstChild);
      }
    }

    if (this.loginButton) {
      this.loginButton.style.display = 'block';
    }
  }

  /**
   * Hides login button
   */
  private hideLoginButton(): void {
    if (this.loginButton) {
      this.loginButton.style.display = 'none';
    }
  }

  /**
   * Shows a status message
   */
  private showStatusMessage(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status-message ${type}`;
    this.statusMessage.style.display = 'block';
  }

  /**
   * Clears the status message
   */
  private clearStatusMessage(): void {
    this.statusMessage.textContent = '';
    this.statusMessage.className = 'status-message';
    this.statusMessage.style.display = 'none';
  }
}

// Initialize the options page when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const optionsPage = new OptionsPage();
    await optionsPage.init();
  } catch (error) {
    const message = extractErrorMessage(error);
    log('error', 'Failed to initialize options page', { error: message });
    
    // Show basic error message if possible
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
      statusMessage.textContent = `Initialization failed: ${message}`;
      statusMessage.className = 'status-message error';
      statusMessage.style.display = 'block';
    }
  }
});