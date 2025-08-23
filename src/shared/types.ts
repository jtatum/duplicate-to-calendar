// Shared type definitions for the Google Calendar Event Duplicator

// Google Calendar API types
export interface CalendarListItem {
  id: string;
  summary: string;
  summaryOverride?: string;
  description?: string;
  location?: string;
  timeZone?: string;
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  hidden?: boolean;
  selected?: boolean;
  accessRole: 'none' | 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  defaultReminders?: Array<{
    method: string;
    minutes: number;
  }>;
  notificationSettings?: {
    notifications: Array<{
      type: string;
      method: string;
    }>;
  };
  primary?: boolean;
  deleted?: boolean;
}

export interface CalendarListResponse {
  kind: 'calendar#calendarList';
  etag: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: CalendarListItem[];
}

export interface EventDateTime {
  date?: string; // For all-day events (YYYY-MM-DD)
  dateTime?: string; // For timed events (RFC3339 timestamp)
  timeZone?: string;
}

export interface CalendarEvent {
  kind?: 'calendar#event';
  etag?: string;
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  created?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  creator?: {
    id?: string;
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  organizer?: {
    id?: string;
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  start: EventDateTime;
  end: EventDateTime;
  endTimeUnspecified?: boolean;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: EventDateTime;
  transparency?: 'opaque' | 'transparent';
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  iCalUID?: string;
  sequence?: number;
  attendees?: Array<{
    id?: string;
    email?: string;
    displayName?: string;
    organizer?: boolean;
    self?: boolean;
    resource?: boolean;
    optional?: boolean;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    comment?: string;
    additionalGuests?: number;
  }>;
  attendeesOmitted?: boolean;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
  hangoutLink?: string;
  conferenceData?: {
    createRequest?: {
      requestId?: string;
      conferenceSolutionKey?: {
        type?: string;
      };
      status?: {
        statusCode?: string;
      };
    };
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
      label?: string;
      pin?: string;
      accessCode?: string;
      meetingCode?: string;
      passcode?: string;
      password?: string;
    }>;
    conferenceSolution?: {
      key?: {
        type?: string;
      };
      name?: string;
      iconUri?: string;
    };
    conferenceId?: string;
    signature?: string;
    notes?: string;
  };
  gadget?: {
    type?: string;
    title?: string;
    link?: string;
    iconLink?: string;
    width?: number;
    height?: number;
    display?: string;
    preferences?: Record<string, string>;
  };
  anyoneCanAddSelf?: boolean;
  guestsCanInviteOthers?: boolean;
  guestsCanModify?: boolean;
  guestsCanSeeOtherGuests?: boolean;
  privateCopy?: boolean;
  locked?: boolean;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method?: string;
      minutes?: number;
    }>;
  };
  source?: {
    url?: string;
    title?: string;
  };
  attachments?: Array<{
    fileUrl?: string;
    title?: string;
    mimeType?: string;
    iconLink?: string;
    fileId?: string;
  }>;
  eventType?: 'default' | 'outOfOffice' | 'focusTime' | 'workingLocation' | 'birthday';
}

export interface EventsListResponse {
  kind: 'calendar#events';
  etag: string;
  summary: string;
  description?: string;
  updated: string;
  timeZone: string;
  accessRole: string;
  defaultReminders: Array<{
    method: string;
    minutes: number;
  }>;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: CalendarEvent[];
}

// Extension-specific types
export interface EventInfo {
  eventId: string;
  title?: string;
  time?: string;
  location?: string;
  description?: string;
  calendarId?: string;
  calendarName?: string;
  isBirthdayEvent?: boolean;
}

export interface ExtensionSettings {
  selectedCalendarId?: string;
  selectedCalendarName?: string;
}

export interface AuthToken {
  token: string;
  expiresAt?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Chrome Runtime Message types
export interface ChromeMessage {
  action: string;
  [key: string]: unknown;
}

export interface GetCalendarsMessage extends ChromeMessage {
  action: 'getCalendars';
}

export interface DuplicateEventMessage extends ChromeMessage {
  action: 'duplicateEvent';
  eventInfo: EventInfo;
}

export interface LoginMessage extends ChromeMessage {
  action: 'login';
}

export interface LogoutMessage extends ChromeMessage {
  action: 'logout';
}

export type ExtensionMessage = 
  | GetCalendarsMessage 
  | DuplicateEventMessage 
  | LoginMessage 
  | LogoutMessage;

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Calendar cache types
export interface CachedCalendarData {
  calendars: CalendarListItem[];
  writableCalendars: CalendarListItem[];
  calendarNameMap: Map<string, CalendarListItem>;
  calendarIdMap: Map<string, CalendarListItem>;
  timestamp: number;
  version: number;
}

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// DOM element types
export interface EventDialogElement extends Element {
  _duplicateButtonCleanup?: () => void;
}

// Button state types
export type ButtonState = 'default' | 'loading' | 'success' | 'error';

export interface ButtonStateConfig {
  icon: string;
  text: string;
  className?: string;
  disabled?: boolean;
  timeout?: number;
}

// Error types
export class ExtensionError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}

export class AuthError extends ExtensionError {
  constructor(message: string, cause?: unknown) {
    super(message, 'AUTH_ERROR', cause);
    this.name = 'AuthError';
  }
}

export class ApiError extends ExtensionError {
  constructor(
    message: string,
    public statusCode: number,
    cause?: unknown
  ) {
    super(message, 'API_ERROR', cause);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ExtensionError {
  constructor(message: string, public field: string, cause?: unknown) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
  }
}