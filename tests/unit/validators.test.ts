// Tests for validation functions

import {
  validateCalendarId,
  validateEventId,
  validateAccessToken,
  validateEventInfo,
  validateEventSummary,
  validateEventDescription,
  validateEventLocation,
  validateEventDateTime,
  validateEventForDuplication
} from '../../src/shared/validators';

describe('validateCalendarId', () => {
  it('should return true for valid calendar IDs', () => {
    expect(validateCalendarId('user@example.com')).toBe(true);
    expect(validateCalendarId('primary')).toBe(true);
    expect(validateCalendarId('calendar@group.calendar.google.com')).toBe(true);
  });

  it('should return false for invalid calendar IDs', () => {
    expect(validateCalendarId(null)).toBe(false);
    expect(validateCalendarId(undefined)).toBe(false);
    expect(validateCalendarId('')).toBe(false);
    expect(validateCalendarId(123)).toBe(false);
    expect(validateCalendarId('invalid-email')).toBe(false);
    expect(validateCalendarId('a'.repeat(400))).toBe(false); // Too long
  });
});

describe('validateEventId', () => {
  it('should return true for valid event IDs', () => {
    expect(validateEventId('abc123')).toBe(true);
    expect(validateEventId('event_id_123')).toBe(true);
    expect(validateEventId('a'.repeat(100))).toBe(true);
  });

  it('should return false for invalid event IDs', () => {
    expect(validateEventId(null)).toBe(false);
    expect(validateEventId(undefined)).toBe(false);
    expect(validateEventId('')).toBe(false);
    expect(validateEventId(123)).toBe(false);
    expect(validateEventId('event<script>')).toBe(false); // Dangerous chars
    expect(validateEventId('a'.repeat(600))).toBe(false); // Too long
  });
});

describe('validateAccessToken', () => {
  it('should return true for valid Google access tokens', () => {
    expect(validateAccessToken('ya29.abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
    expect(validateAccessToken('ya29.a-very-long-token-with-valid-chars_123')).toBe(true);
  });

  it('should return false for invalid tokens', () => {
    expect(validateAccessToken(null)).toBe(false);
    expect(validateAccessToken(undefined)).toBe(false);
    expect(validateAccessToken('')).toBe(false);
    expect(validateAccessToken('invalid-token')).toBe(false);
    expect(validateAccessToken('ya29')).toBe(false); // Too short
    expect(validateAccessToken('ya29.token<script>')).toBe(false); // Invalid chars
  });
});

describe('validateEventInfo', () => {
  it('should return valid for well-formed event info', () => {
    const eventInfo = {
      eventId: 'valid_event_123',
      title: 'Test Event',
      calendarId: 'user@example.com'
    };
    
    const result = validateEventInfo(eventInfo);
    expect(result.isValid).toBe(true);
  });

  it('should return invalid for malformed event info', () => {
    expect(validateEventInfo(null).isValid).toBe(false);
    expect(validateEventInfo({}).isValid).toBe(false);
    expect(validateEventInfo({ eventId: '' }).isValid).toBe(false);
    expect(validateEventInfo({ eventId: 'valid', calendarId: 'invalid' }).isValid).toBe(false);
  });
});

describe('validateEventSummary', () => {
  it('should allow valid summaries', () => {
    expect(validateEventSummary('Meeting').isValid).toBe(true);
    expect(validateEventSummary('').isValid).toBe(true); // Empty is valid
    expect(validateEventSummary(null).isValid).toBe(true); // Null is valid (optional)
  });

  it('should reject invalid summaries', () => {
    expect(validateEventSummary(123).isValid).toBe(false);
    expect(validateEventSummary('a'.repeat(2000)).isValid).toBe(false); // Too long
  });
});

describe('validateEventDateTime', () => {
  it('should validate proper EventDateTime objects', () => {
    expect(validateEventDateTime({ date: '2023-12-25' }).isValid).toBe(true);
    expect(validateEventDateTime({ dateTime: '2023-12-25T10:00:00Z' }).isValid).toBe(true);
    expect(validateEventDateTime({ 
      dateTime: '2023-12-25T10:00:00Z',
      timeZone: 'America/New_York'
    }).isValid).toBe(true);
  });

  it('should reject invalid EventDateTime objects', () => {
    expect(validateEventDateTime(null).isValid).toBe(false);
    expect(validateEventDateTime({}).isValid).toBe(false);
    expect(validateEventDateTime({ date: '2023-13-40' }).isValid).toBe(false); // Invalid date
    expect(validateEventDateTime({ 
      date: '2023-12-25', 
      dateTime: '2023-12-25T10:00:00Z' 
    }).isValid).toBe(false); // Can't have both
  });
});

describe('validateEventForDuplication', () => {
  it('should validate complete events', () => {
    const event = {
      summary: 'Test Event',
      start: { dateTime: '2023-12-25T10:00:00Z' },
      end: { dateTime: '2023-12-25T11:00:00Z' },
      description: 'Test description'
    };
    
    expect(validateEventForDuplication(event).isValid).toBe(true);
  });

  it('should reject events missing required fields', () => {
    expect(validateEventForDuplication({}).isValid).toBe(false);
    expect(validateEventForDuplication({ start: { date: '2023-12-25' } }).isValid).toBe(false);
    expect(validateEventForDuplication({ end: { date: '2023-12-25' } }).isValid).toBe(false);
  });
});