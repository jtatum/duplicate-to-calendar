// Settings persistence and management

import { ExtensionSettings } from '../../shared/types.js';
import { STORAGE_KEYS } from '../../shared/constants.js';
import { validateCalendarId } from '../../shared/validators.js';
import { sanitizeText } from '../../shared/sanitizers.js';
import { extractErrorMessage, log } from '../../shared/utils.js';

export class SettingsManager {
  
  /**
   * Loads saved settings from Chrome storage
   */
  async loadSettings(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.sync.get([
        STORAGE_KEYS.SELECTED_CALENDAR_ID,
        STORAGE_KEYS.SELECTED_CALENDAR_NAME
      ]);
      
      const settings: ExtensionSettings = {
        selectedCalendarId: result[STORAGE_KEYS.SELECTED_CALENDAR_ID],
        selectedCalendarName: result[STORAGE_KEYS.SELECTED_CALENDAR_NAME]
      };
      
      log('info', 'Settings loaded successfully', { 
        hasCalendarId: !!settings.selectedCalendarId,
        hasCalendarName: !!settings.selectedCalendarName 
      });
      
      return settings;
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to load settings', { error: message });
      throw new Error(`Failed to load settings: ${message}`);
    }
  }

  /**
   * Saves settings to Chrome storage
   */
  async saveSettings(settings: ExtensionSettings): Promise<void> {
    try {
      // Validate settings before saving
      this.validateSettings(settings);
      
      const storageData: Record<string, string> = {};
      
      if (settings.selectedCalendarId) {
        storageData[STORAGE_KEYS.SELECTED_CALENDAR_ID] = settings.selectedCalendarId;
      }
      
      if (settings.selectedCalendarName) {
        storageData[STORAGE_KEYS.SELECTED_CALENDAR_NAME] = settings.selectedCalendarName;
      }
      
      await chrome.storage.sync.set(storageData);
      
      log('info', 'Settings saved successfully', { 
        calendarId: settings.selectedCalendarId,
        calendarName: settings.selectedCalendarName 
      });
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to save settings', { error: message });
      throw new Error(`Failed to save settings: ${message}`);
    }
  }

  /**
   * Validates settings before saving
   */
  private validateSettings(settings: ExtensionSettings): void {
    if (settings.selectedCalendarId && !validateCalendarId(settings.selectedCalendarId)) {
      throw new Error('Invalid calendar ID format');
    }
    
    if (settings.selectedCalendarName && typeof settings.selectedCalendarName !== 'string') {
      throw new Error('Calendar name must be a string');
    }
  }

  /**
   * Clears all saved settings
   */
  async clearSettings(): Promise<void> {
    try {
      await chrome.storage.sync.clear();
      log('info', 'All settings cleared successfully');
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to clear settings', { error: message });
      throw new Error(`Failed to clear settings: ${message}`);
    }
  }

  /**
   * Updates a specific setting
   */
  async updateSetting(key: keyof ExtensionSettings, value: string): Promise<void> {
    try {
      let storageKey: string;
      
      switch (key) {
        case 'selectedCalendarId':
          storageKey = STORAGE_KEYS.SELECTED_CALENDAR_ID;
          if (!validateCalendarId(value)) {
            throw new Error('Invalid calendar ID format');
          }
          break;
          
        case 'selectedCalendarName':
          storageKey = STORAGE_KEYS.SELECTED_CALENDAR_NAME;
          value = sanitizeText(value);
          break;
          
        default:
          throw new Error(`Unknown setting key: ${key}`);
      }
      
      await chrome.storage.sync.set({ [storageKey]: value });
      
      log('info', `Setting updated: ${key}`, { value });
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', `Failed to update setting: ${key}`, { error: message });
      throw new Error(`Failed to update setting: ${message}`);
    }
  }

  /**
   * Gets a specific setting value
   */
  async getSetting(key: keyof ExtensionSettings): Promise<string | undefined> {
    try {
      let storageKey: string;
      
      switch (key) {
        case 'selectedCalendarId':
          storageKey = STORAGE_KEYS.SELECTED_CALENDAR_ID;
          break;
        case 'selectedCalendarName':
          storageKey = STORAGE_KEYS.SELECTED_CALENDAR_NAME;
          break;
        default:
          throw new Error(`Unknown setting key: ${key}`);
      }
      
      const result = await chrome.storage.sync.get([storageKey]);
      return result[storageKey];
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', `Failed to get setting: ${key}`, { error: message });
      throw new Error(`Failed to get setting: ${message}`);
    }
  }

  /**
   * Checks if settings are complete (has required calendar selection)
   */
  async hasValidSettings(): Promise<boolean> {
    try {
      const settings = await this.loadSettings();
      return !!(settings.selectedCalendarId && validateCalendarId(settings.selectedCalendarId));
      
    } catch (error) {
      log('warn', 'Error checking settings validity', { error });
      return false;
    }
  }

  /**
   * Sets up storage change listener
   */
  setupStorageListener(onChange: (changes: Record<string, chrome.storage.StorageChange>) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        log('info', 'Storage changes detected', { changes });
        onChange(changes);
      }
    });
  }
}