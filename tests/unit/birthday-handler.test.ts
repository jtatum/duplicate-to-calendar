// Tests for BirthdayEventHandler
//
// Coverage is organized by the seven review categories:
// Security, Performance, Retry, Unit, Integration, Functional, Frame.

import { BirthdayEventHandler } from '../../src/background/services/birthday-handler';
import { CalendarApiClient } from '../../src/background/api/calendar-api';
import { CalendarEvent, CalendarListItem, EventInfo } from '../../src/shared/types';
import { BIRTHDAY_CONFIG } from '../../src/shared/constants';

// A minimal typed mock of the CalendarApiClient surface the handler relies on.
function createMockApiClient(): jest.Mocked<
  Pick<CalendarApiClient, 'getCalendarList' | 'searchEvents'>
> {
  return {
    getCalendarList: jest.fn(),
    searchEvents: jest.fn(),
  };
}

const primaryCalendar: CalendarListItem = {
  id: 'primary',
  summary: 'Primary Calendar',
  accessRole: 'owner',
  primary: true,
};

const workCalendar: CalendarListItem = {
  id: 'work@company.com',
  summary: 'Work Calendar',
  accessRole: 'writer',
};

function birthdayEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '2023_BIRTHDAY_john_doe',
    summary: "John's Birthday",
    start: { date: '2020-03-15' },
    end: { date: '2020-03-16' },
    ...overrides,
  };
}

describe('BirthdayEventHandler', () => {
  let api: ReturnType<typeof createMockApiClient>;
  let handler: BirthdayEventHandler;

  beforeEach(() => {
    api = createMockApiClient();
    handler = new BirthdayEventHandler(api as unknown as CalendarApiClient);
  });

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------
  describe('Security', () => {
    it('rejects an invalid primary calendar id before querying events', async () => {
      const badPrimary: CalendarListItem = {
        id: 'not a valid id <script>',
        summary: 'Evil',
        accessRole: 'owner',
        primary: true,
      };
      api.getCalendarList.mockResolvedValue([badPrimary]);

      const result = await handler.findBirthdayEvent({ eventId: '2023_BIRTHDAY_x' });

      expect(result).toBeNull();
      // Must not attempt an event search against an unvalidated calendar id.
      expect(api.searchEvents).not.toHaveBeenCalled();
    });

    it('validateBirthdayEvent rejects events without a usable summary', () => {
      expect(
        handler.validateBirthdayEvent(birthdayEvent({ summary: '   ' })),
      ).toBe(false);
    });

    it('matchByTitle does not match when the summary is empty (no accidental broad match)', async () => {
      api.getCalendarList.mockResolvedValue([primaryCalendar]);
      // Event with no id match and empty summary should not be returned via title.
      api.searchEvents.mockResolvedValue([
        birthdayEvent({ id: 'unrelated_id', summary: '' }),
      ]);

      const result = await handler.findBirthdayEvent({
        eventId: 'different_id',
        title: 'John',
      });

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Performance
  // ---------------------------------------------------------------------------
  describe('Performance', () => {
    it('bounds the birthday search with a maxResults cap', async () => {
      api.getCalendarList.mockResolvedValue([primaryCalendar]);
      api.searchEvents.mockResolvedValue([]);

      await handler.findBirthdayEvent({ eventId: '2023_BIRTHDAY_x' });

      expect(api.searchEvents).toHaveBeenCalledWith('primary', {
        eventTypes: 'birthday',
        maxResults: 50,
      });
    });

    it('only searches the primary calendar, not every calendar', async () => {
      api.getCalendarList.mockResolvedValue([workCalendar, primaryCalendar]);
      api.searchEvents.mockResolvedValue([birthdayEvent()]);

      await handler.findBirthdayEvent({ eventId: '2023_BIRTHDAY_john_doe' });

      expect(api.searchEvents).toHaveBeenCalledTimes(1);
      expect(api.searchEvents).toHaveBeenCalledWith('primary', expect.anything());
    });
  });

  // ---------------------------------------------------------------------------
  // Retry
  // ---------------------------------------------------------------------------
  describe('Retry', () => {
    // Network-level retry/backoff lives in CalendarApiClient (RETRY_CONFIG) and
    // is out of scope for this handler. The handler's contract is to degrade
    // gracefully rather than throw when the API layer surfaces an error.
    it('returns null (does not throw) when the calendar list lookup fails', async () => {
      api.getCalendarList.mockRejectedValue(new Error('network error'));

      await expect(
        handler.findBirthdayEvent({ eventId: '2023_BIRTHDAY_x' }),
      ).resolves.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Unit
  // ---------------------------------------------------------------------------
  describe('Unit', () => {
    describe('detectBirthdayEvent (static)', () => {
      it('detects birthday by event id pattern', () => {
        expect(
          BirthdayEventHandler.detectBirthdayEvent({ eventId: 'abc_BIRTHDAY_def' }),
        ).toBe(true);
      });

      it('detects birthday by calendar name pattern', () => {
        expect(
          BirthdayEventHandler.detectBirthdayEvent({
            eventId: 'plain',
            calendarName: 'My Birthday Calendar',
          }),
        ).toBe(true);
      });

      it('detects birthday from DOM content', () => {
        expect(
          BirthdayEventHandler.detectBirthdayEvent(
            { eventId: 'plain' },
            'Some Birthday text here',
          ),
        ).toBe(true);
      });

      it('detects birthday from the title', () => {
        expect(
          BirthdayEventHandler.detectBirthdayEvent({
            eventId: 'plain',
            title: "Alice's Birthday",
          }),
        ).toBe(true);
      });

      it('returns false for a non-birthday event', () => {
        expect(
          BirthdayEventHandler.detectBirthdayEvent({
            eventId: 'meeting_123',
            title: 'Team Sync',
            calendarName: 'Work',
          }),
        ).toBe(false);
      });
    });

    describe('validateBirthdayEvent', () => {
      it('accepts a well-formed event', () => {
        expect(handler.validateBirthdayEvent(birthdayEvent())).toBe(true);
      });

      it('rejects an event missing start or end', () => {
        expect(
          handler.validateBirthdayEvent({
            id: 'x',
            summary: 'Birthday',
            start: { date: '2020-01-01' },
          } as CalendarEvent),
        ).toBe(false);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Integration
  // ---------------------------------------------------------------------------
  describe('Integration', () => {
    it('finds a birthday event by direct id match in the primary calendar', async () => {
      const evt = birthdayEvent();
      api.getCalendarList.mockResolvedValue([workCalendar, primaryCalendar]);
      api.searchEvents.mockResolvedValue([evt]);

      const result = await handler.findBirthdayEvent({
        eventId: '2023_BIRTHDAY_john_doe',
      });

      expect(result).toEqual(evt);
    });

    it('falls back to matching a birthday event by title', async () => {
      const evt = birthdayEvent({ id: 'server_side_id', summary: "John's Birthday" });
      api.getCalendarList.mockResolvedValue([primaryCalendar]);
      api.searchEvents.mockResolvedValue([evt]);

      const result = await handler.findBirthdayEvent({
        eventId: 'client_side_id',
        title: "John's Birthday",
      });

      expect(result).toEqual(evt);
    });

    it('returns null when no primary calendar exists', async () => {
      api.getCalendarList.mockResolvedValue([workCalendar]);

      const result = await handler.findBirthdayEvent({ eventId: '2023_BIRTHDAY_x' });

      expect(result).toBeNull();
      expect(api.searchEvents).not.toHaveBeenCalled();
    });

    it('returns null when the search yields no events', async () => {
      api.getCalendarList.mockResolvedValue([primaryCalendar]);
      api.searchEvents.mockResolvedValue([]);

      const result = await handler.findBirthdayEvent({ eventId: '2023_BIRTHDAY_x' });

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Functional
  // ---------------------------------------------------------------------------
  describe('Functional', () => {
    it('creates a duplicate with a default yearly recurrence rule', () => {
      const original = birthdayEvent();
      const duplicate = handler.createBirthdayDuplicate(original, {
        eventId: original.id,
      });

      expect(duplicate.recurrence).toEqual([
        BIRTHDAY_CONFIG.RECURRENCE_RULES.YEARLY,
      ]);
      expect(duplicate.description).toContain(
        BIRTHDAY_CONFIG.DESCRIPTION_SUFFIX,
      );
      expect(duplicate.summary).toBe("John's Birthday");
    });

    it('uses the leap-year rule for a February 29 birthday', () => {
      const original = birthdayEvent({ start: { date: '2020-02-29' } });
      const duplicate = handler.createBirthdayDuplicate(original, {
        eventId: original.id,
      });

      expect(duplicate.recurrence).toEqual([
        BIRTHDAY_CONFIG.RECURRENCE_RULES.LEAP_YEAR_FEB29,
      ]);
    });

    it('preserves an existing recurrence rule for non-leap birthdays', () => {
      const original = birthdayEvent({ recurrence: ['RRULE:FREQ=YEARLY;COUNT=5'] });
      const duplicate = handler.createBirthdayDuplicate(original, {
        eventId: original.id,
      });

      expect(duplicate.recurrence).toEqual(['RRULE:FREQ=YEARLY;COUNT=5']);
    });

    it('appends the birthday suffix only once', () => {
      const original = birthdayEvent({
        description: `Party time\n\n${BIRTHDAY_CONFIG.DESCRIPTION_SUFFIX}`,
      });
      const duplicate = handler.createBirthdayDuplicate(original, {
        eventId: original.id,
      });

      const occurrences = duplicate.description!.split(
        BIRTHDAY_CONFIG.DESCRIPTION_SUFFIX,
      ).length - 1;
      expect(occurrences).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------
  describe('Frame', () => {
    // The handler has no DOM/UI surface of its own; the framework-adjacent
    // entry point is the static detector that also accepts raw DOM text.
    it('detects a birthday from DOM-sourced content passed by the content script', () => {
      const eventInfo: EventInfo = { eventId: 'plain_id' };
      expect(
        BirthdayEventHandler.detectBirthdayEvent(
          eventInfo,
          '<div>Happy BIRTHDAY!</div>',
        ),
      ).toBe(true);
    });
  });
});
