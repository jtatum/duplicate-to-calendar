// Tests for sanitization functions

import {
  sanitizeText,
  sanitizeForDOM,
  sanitizeEventSummary,
  sanitizeEventDescription,
  sanitizeEventLocation,
  sanitizeCalendarId,
  sanitizeEventId,
  sanitizeEventData,
  sanitizeErrorMessage,
  sanitizeHttpStatus,
  cleanDescriptionPrefix,
  cleanOrganizerPrefix,
  parseCalendarDataText
} from '../../src/shared/sanitizers';

describe('sanitizeText', () => {
  it('should sanitize HTML characters', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(sanitizeText('Hello & goodbye')).toBe('Hello &amp; goodbye');
    expect(sanitizeText('Say "hello"')).toBe('Say &quot;hello&quot;');
    expect(sanitizeText("It's working")).toBe('It&#x27;s working');
  });

  it('should handle non-string inputs', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(123)).toBe('');
  });

  it('should truncate long text', () => {
    const longText = 'a'.repeat(1000);
    const result = sanitizeText(longText);
    expect(result.length).toBeLessThanOrEqual(500);
  });
});

describe('sanitizeForDOM', () => {
  it('should remove HTML tags but preserve safe characters', () => {
    expect(sanitizeForDOM('<p>Hello world</p>')).toBe('Hello world');
    expect(sanitizeForDOM('<script>alert("xss")</script>Safe text')).toBe('Safe text');
    expect(sanitizeForDOM('Hello & goodbye')).toBe('Hello & goodbye');
  });

  it('should handle empty and null inputs', () => {
    expect(sanitizeForDOM('')).toBe('');
    expect(sanitizeForDOM(null)).toBe('');
    expect(sanitizeForDOM(undefined)).toBe('');
  });
});

describe('sanitizeEventSummary', () => {
  it('should keep event summaries verbatim and reject empty values', () => {
    expect(sanitizeEventSummary('Meeting with <John>')).toBe('Meeting with <John>');
    expect(sanitizeEventSummary('')).toBe(undefined);
    expect(sanitizeEventSummary(null)).toBe(undefined);
  });
});

describe('sanitizeCalendarId', () => {
  it('should clean calendar IDs', () => {
    expect(sanitizeCalendarId('user@example.com')).toBe('user@example.com');
    expect(sanitizeCalendarId('user<script>@example.com')).toBe('user@example.com');
    expect(sanitizeCalendarId('')).toBe(undefined);
    expect(sanitizeCalendarId('a'.repeat(400))).toBe(undefined); // Too long
  });
});

describe('sanitizeEventId', () => {
  it('should clean event IDs', () => {
    expect(sanitizeEventId('event_123')).toBe('event_123');
    expect(sanitizeEventId('event<script>_123')).toBe('event_123');
    expect(sanitizeEventId('')).toBe(undefined);
  });
});

describe('sanitizeEventData', () => {
  it('should not HTML-encode text sent to the Calendar API', () => {
    const result = sanitizeEventData({
      summary: "Q&A: Tom's \"5 < 10\" talk",
      description: '<a href="https://example.com/?a=1&b=2">Agenda</a>',
      location: 'Barnes & Noble',
    });

    expect(result.summary).toBe("Q&A: Tom's \"5 < 10\" talk");
    expect(result.description).toBe('<a href="https://example.com/?a=1&b=2">Agenda</a>');
    expect(result.location).toBe('Barnes & Noble');
  });

  it('should keep descriptions up to the description limit instead of the 500-character display limit', () => {
    const description = 'd'.repeat(2000);
    const summary = 's'.repeat(800);

    const result = sanitizeEventData({ summary, description, location: 'l'.repeat(1200) });

    expect(result.description).toBe(description);
    expect(result.summary).toBe(summary);
    expect(result.location).toHaveLength(1000);
  });

  it('should sanitize complete event objects', () => {
    const eventData = {
      summary: 'Test <Event>',
      description: 'Event "description"',
      location: 'Location & Place',
      start: { dateTime: '2023-12-25T10:00:00Z' },
      end: { dateTime: '2023-12-25T11:00:00Z' },
      recurrence: ['RRULE:FREQ=DAILY', 'INVALID<RULE>']
    };

    const result = sanitizeEventData(eventData);
    
    expect(result.summary).toBe('Test <Event>');
    expect(result.description).toBe('Event "description"');
    expect(result.location).toBe('Location & Place');
    expect(result.start).toEqual({ dateTime: '2023-12-25T10:00:00Z' });
    expect(result.end).toEqual({ dateTime: '2023-12-25T11:00:00Z' });
    expect(result.recurrence).toHaveLength(2); // Both rules should be present but second one sanitized
  });

  it('should handle empty event data', () => {
    const result = sanitizeEventData({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('sanitizeErrorMessage', () => {
  it('should sanitize error messages', () => {
    const error = new Error('Something went <wrong>');
    expect(sanitizeErrorMessage(error)).toBe('Something went &lt;wrong&gt;');
    
    expect(sanitizeErrorMessage('String error')).toBe('String error');
    expect(sanitizeErrorMessage(null)).toBe('Unknown error occurred');
  });

  it('should remove sensitive information', () => {
    const errorWithToken = 'Error: Invalid token ya29.abcdefghijklmnopqrstuvwxyz';
    const sanitized = sanitizeErrorMessage(errorWithToken);
    expect(sanitized).toBe('Error: Invalid token [TOKEN]');

    const errorWithEmail = 'User user@example.com not found';
    const sanitizedEmail = sanitizeErrorMessage(errorWithEmail);
    expect(sanitizedEmail).toBe('User [EMAIL] not found');
  });
});

describe('sanitizeHttpStatus', () => {
  it('should sanitize HTTP status codes and text', () => {
    expect(sanitizeHttpStatus(200, 'OK')).toBe('200 OK');
    expect(sanitizeHttpStatus('400<script>', 'Bad Request')).toBe('400 Bad Request');
    expect(sanitizeHttpStatus(null)).toBe('Unknown');
  });
});

describe('cleanDescriptionPrefix', () => {
  it('should remove description prefixes', () => {
    expect(cleanDescriptionPrefix('Description: This is the description')).toBe('This is the description');
    expect(cleanDescriptionPrefix('Desc: Short description')).toBe('Short description');
    expect(cleanDescriptionPrefix('Details: More details')).toBe('More details');
    expect(cleanDescriptionPrefix('Just text')).toBe('Just text');
  });
});

describe('cleanOrganizerPrefix', () => {
  it('should remove organizer prefix', () => {
    expect(cleanOrganizerPrefix('Organizer: John Doe')).toBe('John Doe');
    expect(cleanOrganizerPrefix('Just a name')).toBe('Just a name');
  });
});

describe('parseCalendarDataText', () => {
  it('should parse calendar data text format', () => {
    const result = parseCalendarDataText('My Calendar – user@example.com');
    expect(result).toEqual({
      name: 'My Calendar',
      id: 'user@example.com'
    });
  });

  it('should handle malformed data text', () => {
    expect(parseCalendarDataText('Invalid format')).toEqual({});
    expect(parseCalendarDataText('')).toEqual({});
    expect(parseCalendarDataText(null as any)).toEqual({});
  });
});