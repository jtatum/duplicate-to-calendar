// Chrome runtime message handler

import { 
  ExtensionMessage, 
  MessageResponse, 
  CalendarListItem,
  CalendarEvent 
} from '../../shared/types.js';
import { MESSAGE_ACTIONS } from '../../shared/constants.js';
import { extractErrorMessage, log } from '../../shared/utils.js';
import { Authenticator } from '../auth/authenticator.js';
import { CalendarApiClient } from '../api/calendar-api.js';
import { EventDuplicator } from '../services/event-duplicator.js';
import { CalendarCache } from '../api/calendar-cache.js';

export class MessageHandler {
  private authenticator: Authenticator;
  private apiClient: CalendarApiClient;
  private eventDuplicator: EventDuplicator;
  private cache: CalendarCache;

  constructor(
    authenticator: Authenticator, 
    apiClient: CalendarApiClient, 
    eventDuplicator: EventDuplicator,
    cache: CalendarCache
  ) {
    this.authenticator = authenticator;
    this.apiClient = apiClient;
    this.eventDuplicator = eventDuplicator;
    this.cache = cache;
  }

  /**
   * Handles incoming Chrome runtime messages
   */
  async handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    try {
      log('info', 'Received message', { action: message.action, message, sender: sender.tab?.url || 'extension' });

      switch (message.action) {
        case MESSAGE_ACTIONS.GET_CALENDARS:
          return await this.handleGetCalendars();
          
        case MESSAGE_ACTIONS.DUPLICATE_EVENT:
          if ('eventInfo' in message) {
            return await this.handleDuplicateEvent(message.eventInfo);
          } else {
            return { success: false, error: 'Missing event info' };
          }
          
        case MESSAGE_ACTIONS.LOGIN:
          return await this.handleLogin();
          
        case MESSAGE_ACTIONS.LOGOUT:
          return await this.handleLogout();
          
        default:
          return { 
            success: false, 
            error: `Unknown action: ${(message as any).action || 'undefined'}` 
          };
      }

    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      log('error', 'Error handling message', { 
        action: message.action, 
        error: errorMessage 
      });
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Handles get calendars request
   */
  private async handleGetCalendars(): Promise<MessageResponse<CalendarListItem[]>> {
    try {
      const calendars = await this.apiClient.getWritableCalendars();
      
      return { 
        success: true, 
        data: calendars 
      };
      
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      
      // Check if error is due to logout state
      if (errorMessage.includes('logged out')) {
        return { 
          success: false, 
          error: 'User has logged out. Please log in to access calendars.' 
        };
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Handles duplicate event request
   */
  private async handleDuplicateEvent(eventInfo: unknown): Promise<MessageResponse<CalendarEvent>> {
    try {
      // Type guard - eventInfo should be EventInfo but we validate it in the duplicator
      const result = await this.eventDuplicator.duplicateEvent(eventInfo as any);
      
      return { 
        success: true, 
        data: result 
      };
      
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Handles login request
   */
  private async handleLogin(): Promise<MessageResponse<CalendarListItem[]>> {
    try {
      // Reset logout state and get fresh token
      await this.authenticator.login();
      
      // Invalidate cache to ensure fresh data after login
      this.cache.invalidate();
      
      // Get calendars to verify login worked
      const calendars = await this.apiClient.getWritableCalendars();
      
      return { 
        success: true, 
        data: calendars 
      };
      
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Handles logout request
   */
  private async handleLogout(): Promise<MessageResponse> {
    try {
      await this.authenticator.logout();
      
      // Invalidate cache on logout
      this.cache.invalidate();
      
      return { success: true };
      
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Sets up the Chrome runtime message listener
   */
  setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle the message asynchronously
      this.handleMessage(message, sender)
        .then(response => sendResponse(response))
        .catch(error => {
          const errorMessage = extractErrorMessage(error);
          log('error', 'Unhandled error in message listener', { error: errorMessage });
          sendResponse({ 
            success: false, 
            error: errorMessage 
          });
        });
      
      // Return true to indicate we will respond asynchronously
      return true;
    });

    log('info', 'Chrome runtime message listener set up');
  }
}