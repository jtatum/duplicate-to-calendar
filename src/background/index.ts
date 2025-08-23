// Background service worker for Google Calendar Event Duplicator

import { log } from '../shared/utils.js';
import { Authenticator } from './auth/authenticator.js';
import { TokenManager } from './auth/token-manager.js';
import { CalendarCache } from './api/calendar-cache.js';
import { CalendarApiClient } from './api/calendar-api.js';
import { EventDuplicator } from './services/event-duplicator.js';
import { BirthdayEventHandler } from './services/birthday-handler.js';
import { MessageHandler } from './messaging/message-handler.js';

log('info', 'Google Calendar Event Duplicator background script loaded');

// Initialize services
const tokenManager = new TokenManager();
const authenticator = new Authenticator(tokenManager);
const cache = new CalendarCache();
const apiClient = new CalendarApiClient(authenticator, cache);
const birthdayHandler = new BirthdayEventHandler(apiClient);
const eventDuplicator = new EventDuplicator(apiClient, birthdayHandler);
const messageHandler = new MessageHandler(authenticator, apiClient, eventDuplicator, cache);

// Set up message handling
messageHandler.setupMessageListener();

// Open options page when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  log('info', 'Extension icon clicked, opening options page');
  chrome.runtime.openOptionsPage();
});

// Auto-test authentication when extension loads
chrome.runtime.onStartup.addListener(async () => {
  log('info', 'Extension startup - testing authentication');
  try {
    await authenticator.testAuthentication();
  } catch (error) {
    log('warn', 'Authentication test failed on startup', { error });
  }
});

// Test authentication and open options page when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  log('info', 'Extension installed/updated');
  
  try {
    await authenticator.testAuthentication();
  } catch (error) {
    log('warn', 'Authentication test failed on install', { error });
  }
  
  // Open the options page to help user configure destination calendar
  chrome.runtime.openOptionsPage();
});

// Handle extension suspension/cleanup
if ('onSuspend' in chrome.runtime) {
  chrome.runtime.onSuspend.addListener(() => {
    log('info', 'Extension suspending, performing cleanup');
    // Any cleanup logic if needed
  });
}

// Error handling for unhandled promise rejections
addEventListener('unhandledrejection', (event) => {
  log('error', 'Unhandled promise rejection in background script', { 
    error: event.reason 
  });
  // Don't prevent default - let Chrome handle it
});

log('info', 'Background script initialization complete');