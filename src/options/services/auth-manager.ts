// Authentication management for options page

import { CalendarListItem, MessageResponse } from '../../shared/types.js';
import { MESSAGE_ACTIONS } from '../../shared/constants.js';
import { extractErrorMessage, log } from '../../shared/utils.js';

export class AuthManager {
  
  /**
   * Gets calendar list from background script
   */
  async getCalendars(): Promise<CalendarListItem[]> {
    try {
      log('info', 'Requesting calendar list from background script');
      
      const response = await chrome.runtime.sendMessage({
        action: MESSAGE_ACTIONS.GET_CALENDARS
      }) as MessageResponse<CalendarListItem[]>;
      
      log('info', 'Raw response received', { response });
      
      if (response && response.success && response.data) {
        log('info', `Retrieved ${response.data.length} calendars`);
        return response.data;
      } else {
        const errorMessage = response?.error || 'Failed to get calendars - no valid response';
        log('error', 'Calendar list request failed', { 
          error: errorMessage, 
          responseExists: !!response,
          responseSuccess: response?.success,
          hasData: !!response?.data 
        });
        throw new Error(errorMessage);
      }
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Error getting calendars', { error: message });
      throw new Error(`Failed to get calendars: ${message}`);
    }
  }

  /**
   * Initiates login process
   */
  async login(): Promise<CalendarListItem[]> {
    try {
      log('info', 'Initiating login process');
      
      const response = await chrome.runtime.sendMessage({
        action: MESSAGE_ACTIONS.LOGIN
      }) as MessageResponse<CalendarListItem[]>;
      
      if (response.success && response.data) {
        log('info', 'Login successful');
        return response.data;
      } else {
        const errorMessage = response.error || 'Login failed';
        log('error', 'Login failed', { error: errorMessage });
        throw new Error(errorMessage);
      }
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Error during login', { error: message });
      throw new Error(`Login failed: ${message}`);
    }
  }

  /**
   * Initiates logout process
   */
  async logout(): Promise<void> {
    try {
      log('info', 'Initiating logout process');
      
      const response = await chrome.runtime.sendMessage({
        action: MESSAGE_ACTIONS.LOGOUT
      }) as MessageResponse;
      
      if (response.success) {
        log('info', 'Logout successful');
      } else {
        const errorMessage = response.error || 'Logout failed';
        log('error', 'Logout failed', { error: errorMessage });
        throw new Error(errorMessage);
      }
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Error during logout', { error: message });
      throw new Error(`Logout failed: ${message}`);
    }
  }

  /**
   * Tests authentication status by attempting to get calendars
   */
  async testAuthentication(): Promise<boolean> {
    try {
      log('info', 'Testing authentication status');
      
      const calendars = await this.getCalendars();
      const isAuthenticated = calendars.length > 0;
      
      log('info', `Authentication test result: ${isAuthenticated}`);
      return isAuthenticated;
      
    } catch (error) {
      log('info', 'Authentication test failed - user likely not authenticated');
      return false;
    }
  }

  /**
   * Checks if user is logged out based on error message
   */
  isLoggedOutError(error: string): boolean {
    const loggedOutIndicators = [
      'logged out',
      'not signed in',
      'authentication required',
      'login required'
    ];
    
    const lowerError = error.toLowerCase();
    return loggedOutIndicators.some(indicator => lowerError.includes(indicator));
  }
}