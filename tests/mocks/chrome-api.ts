// Chrome API mocks for testing

import { CalendarListItem } from '../../src/shared/types';
import { mockCalendarListResponse } from '../fixtures/api-responses';

export class MockChromeRuntime {
  private messageListeners: ((message: any, sender: any, sendResponse: (response: any) => void) => boolean | void)[] = [];
  
  sendMessage = jest.fn().mockImplementation(async (message: any) => {
    // Default mock responses based on message action
    switch (message.action) {
      case 'getCalendars':
        return { success: true, data: mockCalendarListResponse.items };
      case 'duplicateEvent':
        return { success: true, data: { id: 'new_event_123' } };
      case 'login':
        return { success: true, data: mockCalendarListResponse.items };
      case 'logout':
        return { success: true };
      default:
        return { success: false, error: 'Unknown action' };
    }
  });

  onMessage = {
    addListener: jest.fn((callback) => {
      this.messageListeners.push(callback);
    })
  };

  onStartup = {
    addListener: jest.fn()
  };

  onInstalled = {
    addListener: jest.fn()
  };

  lastError: chrome.runtime.LastError | null = null;

  // Helper method to simulate incoming messages
  simulateMessage(message: any, sender: any = {}) {
    return new Promise((resolve) => {
      this.messageListeners.forEach(listener => {
        listener(message, sender, resolve);
      });
    });
  }
}

export class MockChromeStorage {
  private data: Record<string, any> = {};
  private changeListeners: ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void)[] = [];

  sync = {
    get: jest.fn().mockImplementation(async (keys: string[] | string) => {
      if (typeof keys === 'string') {
        return { [keys]: this.data[keys] };
      }
      if (Array.isArray(keys)) {
        const result: Record<string, any> = {};
        keys.forEach(key => {
          if (key in this.data) {
            result[key] = this.data[key];
          }
        });
        return result;
      }
      return { ...this.data };
    }),

    set: jest.fn().mockImplementation(async (items: Record<string, any>) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      
      Object.entries(items).forEach(([key, newValue]) => {
        const oldValue = this.data[key];
        this.data[key] = newValue;
        changes[key] = { oldValue, newValue };
      });

      // Notify listeners
      this.changeListeners.forEach(listener => {
        listener(changes, 'sync');
      });
    }),

    clear: jest.fn().mockImplementation(async () => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      
      Object.keys(this.data).forEach(key => {
        changes[key] = { oldValue: this.data[key], newValue: undefined };
      });
      
      this.data = {};
      
      // Notify listeners
      this.changeListeners.forEach(listener => {
        listener(changes, 'sync');
      });
    })
  };

  onChanged = {
    addListener: jest.fn((callback) => {
      this.changeListeners.push(callback);
    })
  };

  // Helper methods for testing
  setData(key: string, value: any) {
    this.data[key] = value;
  }

  getData(key: string) {
    return this.data[key];
  }

  clearData() {
    this.data = {};
  }
}

export class MockChromeIdentity {
  private mockToken = 'ya29.mock_access_token_for_testing';
  private mockTokenObject = { token: this.mockToken };
  private returnTokenAsObject = false;
  private shouldThrowError = false;
  private loggedOut = false;

  getAuthToken = jest.fn().mockImplementation(async (options: { interactive?: boolean } = {}) => {
    if (this.shouldThrowError) {
      throw new Error('Authentication failed');
    }
    
    if (this.loggedOut && !options.interactive) {
      throw new Error('User has logged out');
    }

    return this.returnTokenAsObject ? this.mockTokenObject : this.mockToken;
  });

  clearAllCachedAuthTokens = jest.fn().mockResolvedValue(undefined);

  // Helper methods for testing
  setMockToken(token: string) {
    this.mockToken = token;
    this.mockTokenObject = { token };
  }

  setReturnTokenAsObject(returnAsObject: boolean) {
    this.returnTokenAsObject = returnAsObject;
  }

  setShouldThrowError(shouldThrow: boolean) {
    this.shouldThrowError = shouldThrow;
  }

  setLoggedOut(loggedOut: boolean) {
    this.loggedOut = loggedOut;
  }
}

export class MockChromeAction {
  onClicked = {
    addListener: jest.fn()
  };

  openOptionsPage = jest.fn();
}

export class MockChrome {
  runtime = new MockChromeRuntime();
  storage = new MockChromeStorage();
  identity = new MockChromeIdentity();
  action = new MockChromeAction();

  // Helper method to reset all mocks
  resetMocks() {
    jest.clearAllMocks();
    this.storage.clearData();
    this.identity.setLoggedOut(false);
    this.identity.setShouldThrowError(false);
  }
}

export const mockChrome = new MockChrome();

// Helper function to create a mock fetch response
export function createMockFetchResponse(data: any, status = 200, ok = true) {
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  } as Response);
}

// Helper to mock successful calendar API responses
export function mockSuccessfulCalendarApi() {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce(createMockFetchResponse(mockCalendarListResponse)) // Calendar list
    .mockResolvedValueOnce(createMockFetchResponse({ id: 'new_event_123' })); // Create event
}

// Helper to mock API errors
export function mockApiError(status = 400, message = 'API Error') {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce(createMockFetchResponse(
      { error: { message } }, 
      status, 
      false
    ));
}

// Helper to mock network errors
export function mockNetworkError() {
  (global.fetch as jest.Mock)
    .mockRejectedValueOnce(new Error('Network error'));
}