// Sample API responses for testing

import { CalendarListResponse, CalendarEvent, EventsListResponse } from '../../src/shared/types';

export const mockCalendarListResponse: CalendarListResponse = {
  kind: 'calendar#calendarList',
  etag: 'mock-etag',
  items: [
    {
      id: 'primary',
      summary: 'Primary Calendar',
      description: 'Your primary calendar',
      location: 'New York',
      timeZone: 'America/New_York',
      colorId: '1',
      backgroundColor: '#ac725e',
      foregroundColor: '#1d1d1d',
      accessRole: 'owner',
      defaultReminders: [],
      primary: true,
      selected: true
    },
    {
      id: 'work@company.com',
      summary: 'Work Calendar',
      summaryOverride: 'My Work Schedule',
      description: 'Work-related events',
      timeZone: 'America/New_York',
      colorId: '2',
      backgroundColor: '#d06b64',
      foregroundColor: '#1d1d1d',
      accessRole: 'writer',
      defaultReminders: [
        { method: 'email', minutes: 10 },
        { method: 'popup', minutes: 10 }
      ]
    },
    {
      id: 'readonly@example.com',
      summary: 'Shared Calendar',
      description: 'Read-only shared calendar',
      timeZone: 'America/New_York',
      accessRole: 'reader',
      defaultReminders: []
    },
    {
      id: 'holidays@group.calendar.google.com',
      summary: 'Holidays in United States',
      description: 'US holidays',
      timeZone: 'America/New_York',
      accessRole: 'reader',
      defaultReminders: []
    }
  ]
};

export const mockCalendarEvent: CalendarEvent = {
  kind: 'calendar#event',
  etag: 'mock-event-etag',
  id: 'mock_event_123',
  status: 'confirmed',
  htmlLink: 'https://www.google.com/calendar/event?eid=mock_event_123',
  created: '2023-01-01T10:00:00Z',
  updated: '2023-01-01T10:00:00Z',
  summary: 'Team Meeting',
  description: 'Weekly team sync meeting',
  location: 'Conference Room A',
  colorId: '1',
  creator: {
    email: 'creator@example.com',
    displayName: 'Meeting Creator',
    self: false
  },
  organizer: {
    email: 'organizer@example.com',
    displayName: 'Meeting Organizer',
    self: true
  },
  start: {
    dateTime: '2023-12-25T10:00:00-05:00',
    timeZone: 'America/New_York'
  },
  end: {
    dateTime: '2023-12-25T11:00:00-05:00',
    timeZone: 'America/New_York'
  },
  iCalUID: 'mock_event_123@google.com',
  sequence: 0,
  attendees: [
    {
      email: 'attendee1@example.com',
      displayName: 'Attendee One',
      responseStatus: 'accepted'
    },
    {
      email: 'attendee2@example.com',
      displayName: 'Attendee Two',
      responseStatus: 'needsAction'
    }
  ],
  reminders: {
    useDefault: false,
    overrides: [
      { method: 'email', minutes: 15 },
      { method: 'popup', minutes: 10 }
    ]
  },
  eventType: 'default'
};

export const mockBirthdayEvent: CalendarEvent = {
  kind: 'calendar#event',
  etag: 'mock-birthday-etag',
  id: '2023_BIRTHDAY_contact123',
  status: 'confirmed',
  summary: "John Doe's Birthday",
  description: 'Birthday from Google Contacts',
  start: {
    date: '2023-02-29'
  },
  end: {
    date: '2023-03-01'
  },
  recurrence: ['RRULE:FREQ=YEARLY'],
  eventType: 'birthday',
  created: '2023-01-01T00:00:00Z',
  updated: '2023-01-01T00:00:00Z'
};

export const mockAllDayEvent: CalendarEvent = {
  kind: 'calendar#event',
  etag: 'mock-allday-etag',
  id: 'allday_event_456',
  status: 'confirmed',
  summary: 'Holiday',
  description: 'National holiday',
  start: {
    date: '2023-12-25'
  },
  end: {
    date: '2023-12-26'
  },
  transparency: 'transparent',
  eventType: 'default',
  created: '2023-01-01T00:00:00Z',
  updated: '2023-01-01T00:00:00Z'
};

export const mockEventsListResponse: EventsListResponse = {
  kind: 'calendar#events',
  etag: 'mock-events-etag',
  summary: 'Primary Calendar',
  description: 'Your primary calendar',
  updated: '2023-01-01T12:00:00Z',
  timeZone: 'America/New_York',
  accessRole: 'owner',
  defaultReminders: [],
  items: [mockCalendarEvent, mockBirthdayEvent, mockAllDayEvent]
};

export const mockBirthdayEventsResponse: EventsListResponse = {
  kind: 'calendar#events',
  etag: 'mock-birthday-events-etag',
  summary: 'Primary Calendar',
  description: 'Your primary calendar',
  updated: '2023-01-01T12:00:00Z',
  timeZone: 'America/New_York',
  accessRole: 'owner',
  defaultReminders: [],
  items: [mockBirthdayEvent]
};

// Error responses
export const mockApiErrorResponse = {
  error: {
    code: 400,
    message: 'Invalid request',
    errors: [
      {
        domain: 'calendar',
        reason: 'invalid',
        message: 'Invalid request'
      }
    ]
  }
};

export const mockUnauthorizedResponse = {
  error: {
    code: 401,
    message: 'Unauthorized',
    errors: [
      {
        domain: 'global',
        reason: 'authError',
        message: 'Invalid Credentials'
      }
    ]
  }
};

export const mockRateLimitResponse = {
  error: {
    code: 429,
    message: 'Rate limit exceeded',
    errors: [
      {
        domain: 'usageLimits',
        reason: 'rateLimitExceeded',
        message: 'Rate Limit Exceeded'
      }
    ]
  }
};