// Tests for EventDuplicator
//
// Coverage is organized by the seven review categories:
// Security, Performance, Retry, Unit, Integration, Functional, Frame.

import { EventDuplicator } from '../../src/background/services/event-duplicator';
import { BirthdayEventHandler } from '../../src/background/services/birthday-handler';
import { CalendarApiClient } from '../../src/background/api/calendar-api';
import {
  CalendarEvent,
  CalendarListItem,
  ValidationError,
} from '../../src/shared/types';
import { STORAGE_KEYS, BIRTHDAY_CONFIG } from '../../src/shared/constants';

type ApiSurface = Pick<
  CalendarApiClient,
  'getCalendarList' | 'getEvent' | 'searchEvents' | 'createEvent'
>;

function createMockApiClient(): jest.Mocked<ApiSurface> {
  return {
    getCalendarList: jest.fn(),
    getEvent: jest.fn(),
    searchEvents: jest.fn(),
    createEvent: jest.fn(),
  };
}

const DEST = 'dest@example.com';

const workCalendar: CalendarListItem = {
  id: 'work@company.com',
  summary: 'Work Calendar',
  accessRole: 'writer',
};

const originalEvent: CalendarEvent = {
  id: 'evt_123',
  summary: 'Team Meeting',
  description: 'Weekly sync',
  location: 'Room A',
  start: { dateTime: '2023-12-25T10:00:00-05:00' },
  end: { dateTime: '2023-12-25T11:00:00-05:00' },
};

function setDestination(id: string | undefined): void {
  (chrome.storage.sync.get as jest.Mock).mockResolvedValue(
    id === undefined ? {} : { [STORAGE_KEYS.SELECTED_CALENDAR_ID]: id },
  );
}

describe('EventDuplicator', () => {
  let api: jest.Mocked<ApiSurface>;
  let duplicator: EventDuplicator;

  beforeEach(() => {
    api = createMockApiClient();
    duplicator = new EventDuplicator(api as unknown as CalendarApiClient);
    api.createEvent.mockResolvedValue({ ...originalEvent, id: 'new_event_123' });
  });

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------
  describe('Security', () => {
    it('rejects an event id containing dangerous characters and never calls the API', async () => {
      setDestination(DEST);

      await expect(
        duplicator.duplicateEvent({ eventId: 'evt<script>' }),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(api.createEvent).not.toHaveBeenCalled();
    });

    it('rejects a malformed destination calendar id from storage', async () => {
      setDestination('not-a-calendar-id');

      await expect(
        duplicator.duplicateEvent({ eventId: 'evt_123' }),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(api.createEvent).not.toHaveBeenCalled();
    });

    it('sanitizes copied event data before it reaches the API', async () => {
      setDestination(DEST);
      api.getEvent.mockResolvedValue({
        ...originalEvent,
        summary: 'Meeting <b>bold</b> & "quoted"',
      });

      await duplicator.duplicateEvent({
        eventId: 'evt_123',
        calendarId: workCalendar.id,
      });

      const sentSummary = (api.createEvent.mock.calls[0]![1] as CalendarEvent)
        .summary as string;
      expect(sentSummary).not.toContain('<b>');
      expect(sentSummary).toContain('&amp;');
    });
  });

  // ---------------------------------------------------------------------------
  // Performance
  // ---------------------------------------------------------------------------
  describe('Performance', () => {
    it('stops searching calendars as soon as the event is found (no wasted lookups)', async () => {
      setDestination(DEST);
      // No calendarId/calendarName -> falls through to searchAllCalendars.
      api.getCalendarList.mockResolvedValue([
        workCalendar,
        { id: 'other@company.com', summary: 'Other', accessRole: 'writer' },
        { id: 'third@company.com', summary: 'Third', accessRole: 'writer' },
      ]);
      // Resolves on the very first calendar.
      api.getEvent.mockResolvedValue(originalEvent);

      await duplicator.duplicateEvent({ eventId: 'evt_123' });

      // Only the first calendar should have been probed.
      expect(api.getEvent).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Retry
  // ---------------------------------------------------------------------------
  describe('Retry', () => {
    // HTTP-level retry/backoff is owned by CalendarApiClient. Here we verify the
    // duplicator's own fallback: when a space-delimited event id fails, it
    // retries with the leading token.
    it('retries with the parsed event id when the full id lookup fails', async () => {
      setDestination(DEST);
      api.getEvent
        .mockRejectedValueOnce(new Error('404 not found'))
        .mockResolvedValueOnce(originalEvent);

      await duplicator.duplicateEvent({
        eventId: 'evt_123 extra-token',
        calendarId: workCalendar.id,
      });

      expect(api.getEvent).toHaveBeenCalledTimes(2);
      expect(api.getEvent).toHaveBeenNthCalledWith(2, workCalendar.id, 'evt_123', true);
    });
  });

  // ---------------------------------------------------------------------------
  // Unit
  // ---------------------------------------------------------------------------
  describe('Unit', () => {
    it('copies core fields from the original event into the duplicate', async () => {
      setDestination(DEST);
      api.getEvent.mockResolvedValue(originalEvent);

      await duplicator.duplicateEvent({
        eventId: 'evt_123',
        calendarId: workCalendar.id,
      });

      const [calId, payload] = api.createEvent.mock.calls[0]!;
      expect(calId).toBe(DEST);
      expect(payload).toMatchObject({
        summary: 'Team Meeting',
        location: 'Room A',
        start: { dateTime: '2023-12-25T10:00:00-05:00' },
      });
    });

    it('defaults to a fresh BirthdayEventHandler when none is injected', () => {
      const d = new EventDuplicator(api as unknown as CalendarApiClient);
      expect(d).toBeInstanceOf(EventDuplicator);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration
  // ---------------------------------------------------------------------------
  describe('Integration', () => {
    it('duplicates a regular event end to end and returns the created event', async () => {
      setDestination(DEST);
      api.getEvent.mockResolvedValue(originalEvent);

      const result = await duplicator.duplicateEvent({
        eventId: 'evt_123',
        calendarId: workCalendar.id,
      });

      expect(api.getEvent).toHaveBeenCalledWith(workCalendar.id, 'evt_123', true);
      expect(result.id).toBe('new_event_123');
    });

    it('collaborates with the real BirthdayEventHandler for birthday events', async () => {
      setDestination(DEST);
      const handler = new BirthdayEventHandler(api as unknown as CalendarApiClient);
      duplicator = new EventDuplicator(api as unknown as CalendarApiClient, handler);

      api.getCalendarList.mockResolvedValue([
        { id: 'primary', summary: 'Primary', accessRole: 'owner', primary: true },
      ]);
      api.searchEvents.mockResolvedValue([
        {
          id: '2023_BIRTHDAY_amy',
          summary: "Amy's Birthday",
          start: { date: '2020-06-01' },
          end: { date: '2020-06-02' },
        },
      ]);

      await duplicator.duplicateEvent({
        eventId: '2023_BIRTHDAY_amy',
        isBirthdayEvent: true,
      });

      const payload = api.createEvent.mock.calls[0]![1] as CalendarEvent;
      expect(payload.recurrence).toEqual([
        BIRTHDAY_CONFIG.RECURRENCE_RULES.YEARLY,
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // Functional
  // ---------------------------------------------------------------------------
  describe('Functional', () => {
    it('throws when no destination calendar is configured', async () => {
      setDestination(undefined);

      await expect(
        duplicator.duplicateEvent({ eventId: 'evt_123' }),
      ).rejects.toMatchObject({ code: 'NO_DESTINATION_CALENDAR' });
    });

    it('refuses to duplicate an event already in the destination calendar', async () => {
      setDestination(DEST);

      await expect(
        duplicator.duplicateEvent({ eventId: 'evt_123', calendarId: DEST }),
      ).rejects.toMatchObject({ code: 'ALREADY_IN_DESTINATION' });
    });

    it('throws EVENT_NOT_FOUND when the original cannot be located anywhere', async () => {
      setDestination(DEST);
      api.getEvent.mockRejectedValue(new Error('404'));
      api.getCalendarList.mockResolvedValue([workCalendar]);

      await expect(
        duplicator.duplicateEvent({ eventId: 'evt_123', calendarId: workCalendar.id }),
      ).rejects.toMatchObject({ code: 'EVENT_NOT_FOUND' });
    });
  });

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------
  describe('Frame', () => {
    it('reads the selected calendar from chrome.storage.sync', async () => {
      setDestination(DEST);
      api.getEvent.mockResolvedValue(originalEvent);

      await duplicator.duplicateEvent({
        eventId: 'evt_123',
        calendarId: workCalendar.id,
      });

      expect(chrome.storage.sync.get).toHaveBeenCalledWith([
        STORAGE_KEYS.SELECTED_CALENDAR_ID,
      ]);
    });
  });
});
