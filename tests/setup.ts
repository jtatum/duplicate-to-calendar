// Jest test setup

import { TextEncoder, TextDecoder } from 'util';

// Polyfills for Node.js environment
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn()
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  identity: {
    getAuthToken: jest.fn(),
    clearAllCachedAuthTokens: jest.fn()
  },
  action: {
    onClicked: {
      addListener: jest.fn()
    },
    openOptionsPage: jest.fn()
  }
};

// Make chrome global available
Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true
});

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock DOM methods that might be used
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    display: 'block',
    visibility: 'visible',
    opacity: '1'
  })
});

// Mock console methods to avoid noise in tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset Chrome API mocks
  Object.values(mockChrome.runtime).forEach(mock => {
    if (mock && typeof mock === 'object' && 'addListener' in mock) {
      (mock as any).addListener.mockClear();
    }
  });
  
  (global.fetch as jest.Mock).mockClear();
});

// Export mock helpers for tests
export { mockChrome };