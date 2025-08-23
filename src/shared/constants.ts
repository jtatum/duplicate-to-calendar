// Shared constants for the Google Calendar Event Duplicator

// Google Calendar API endpoints
export const API_ENDPOINTS = {
  CALENDAR_LIST: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
  EVENTS: (calendarId: string) => 
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  EVENT: (calendarId: string, eventId: string) => 
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
  OAUTH_REVOKE: (token: string) => 
    `https://oauth2.googleapis.com/revoke?token=${token}`,
} as const;

// OAuth scopes
export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
] as const;

// DOM selectors for Google Calendar
export const DOM_SELECTORS = {
  // Event dialog selectors
  EVENT_DIALOGS: [
    '[role="dialog"][data-eventid]',
    '[jsname="ssXDle"][data-eventid]',
    '[role="dialog"][jsname="ssXDle"]',
  ],
  
  // Event info selectors
  EVENT_ID_ELEMENTS: [
    '#xDetDlg',
    '.xDetDlg',
    '[id="xDetDlg"]',
    '[data-eventid]',
  ],
  
  TITLE_ELEMENTS: [
    '#rAECCd',
    '[role="heading"]',
    '.rjjUXe h2',
    'h1',
    '[data-event-title]',
  ],
  
  TIME_ELEMENTS: [
    '.AzuXid',
    '.JEx5le',
    '[data-start-time]',
    '.DN8Jnd',
    '[jsname="M5N8Ue"]',
  ],
  
  LOCATION_ELEMENTS: [
    '[id*="Loc"]',
    '[data-location]',
    '.DN8Jnd + .DN8Jnd',
    '[jsname="YKoHj"]',
  ],
  
  DESCRIPTION_ELEMENTS: [
    '[id*="Desc"]',
    '[data-description]',
    '.rjjUXe div:last-child',
    '[jsname="f9896d"]',
  ],
  
  CALENDAR_ELEMENTS: [
    '#xDetDlgCal',
    '[data-text*="@"]',
  ],
  
  // Button container selector
  BUTTON_CONTAINER: '.pPTZAe',
  
  // Organizer elements (fallback)
  ORGANIZER_ELEMENTS: '.XuJrye',
} as const;

// Button configuration
export const BUTTON_CONFIG = {
  CLASS_NAME: 'duplicate-calendar-button VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-k8QpJ VfPpkd-LgbsSe-OWXEXe-dgl2Hf nCP5yc AjY5Oe DuMIQc LQeN7 BqKGqe Jskylb TrZEUc lw1w4b',
  SPAN_CLASS_NAME: 'VfPpkd-vQzf8d',
  TEXT_CLASS_NAME: 'duplicate-text',
  TITLE: 'Duplicate this event to another calendar',
  
  STATES: {
    default: {
      icon: '📋',
      text: 'Duplicate',
      disabled: false,
      className: undefined,
      timeout: undefined,
    },
    loading: {
      icon: '⏳',
      text: 'Duplicating...',
      className: 'duplicate-loading',
      disabled: true,
      timeout: undefined,
    },
    success: {
      icon: '✅',
      text: 'Duplicated!',
      className: 'duplicate-success',
      disabled: true,
      timeout: 3000,
    },
    error: {
      icon: '❌',
      text: 'Error occurred',
      className: 'duplicate-error',
      disabled: true,
      timeout: 3000,
    },
  },
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  CALENDAR_CACHE_TTL: 5 * 60 * 1000, // 5 minutes in milliseconds
  AUTO_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
  BUTTON_WATCHER_TIMEOUT: 30000, // 30 seconds
} as const;

// Validation limits
export const VALIDATION_LIMITS = {
  CALENDAR_ID_MAX_LENGTH: 320, // RFC 5321 email limit
  EVENT_ID_MAX_LENGTH: 500,
  SUMMARY_MAX_LENGTH: 1000,
  DESCRIPTION_MAX_LENGTH: 8192, // 8KB
  LOCATION_MAX_LENGTH: 1000,
  SANITIZED_TEXT_MAX_LENGTH: 500,
} as const;

// Regular expressions
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  DANGEROUS_CHARS: /[<>"'&\\]/,
  GOOGLE_ACCESS_TOKEN: /^ya29\.[a-zA-Z0-9\-._~]+$/,
  BIRTHDAY_EVENT_ID: /(BIRTHDAY|_BIRTHDAY_)/,
} as const;

// Birthday event configuration
export const BIRTHDAY_CONFIG = {
  CALENDAR_PATTERNS: [
    'birthday',
    'Birthday',
    'addressbook#contacts@group.v.calendar.google.com',
    '#contacts@group.v.calendar.google.com',
  ],
  
  RECURRENCE_RULES: {
    YEARLY: 'RRULE:FREQ=YEARLY',
    LEAP_YEAR_FEB29: 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1',
  },
  
  DESCRIPTION_SUFFIX: '📅 Copied from birthday calendar',
} as const;

// Chrome storage keys
export const STORAGE_KEYS = {
  SELECTED_CALENDAR_ID: 'selectedCalendarId',
  SELECTED_CALENDAR_NAME: 'selectedCalendarName',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
} as const;

// Extension message actions
export const MESSAGE_ACTIONS = {
  GET_CALENDARS: 'getCalendars',
  DUPLICATE_EVENT: 'duplicateEvent',
  LOGIN: 'login',
  LOGOUT: 'logout',
} as const;

// MutationObserver configuration
export const MUTATION_OBSERVER_CONFIG = {
  childList: true,
  subtree: true,
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY: 1000, // 1 second
  BACKOFF_MULTIPLIER: 2,
} as const;