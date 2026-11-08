import { BirthdayEventHandler } from '../../src/background/services/birthday-handler';
import { CalendarApiClient } from '../../src/background/api/calendar-api';
import { CalendarEvent, EventInfo } from '../../src/shared/types';

function handlerWith(birthdays: CalendarEvent[]): BirthdayEventHandler {
  const apiClient = {
    getCalendarList: jest.fn().mockResolvedValue([
      { id: 'me@example.com', summary: 'Me', primary: true },
    ]),
    searchEvents: jest.fn().mockResolvedValue(birthdays),
  } as unknown as CalendarApiClient;
  return new BirthdayEventHandler(apiClient);
}

const allDay = { start: { date: '2024-06-01' }, end: { date: '2024-06-02' } };
const alice: CalendarEvent = { id: 'alice_BIRTHDAY_2024', summary: "Alice's birthday", ...allDay };
const bob: CalendarEvent = { id: 'bob_BIRTHDAY_2024', summary: "Bob's birthday", ...allDay };

describe('BirthdayEventHandler.findBirthdayEvent', () => {
  it('prefers an exact ID match over an earlier event that only shares the birthday pattern', async () => {
    const eventInfo: EventInfo = { eventId: 'bob_BIRTHDAY_2024', isBirthdayEvent: true };

    await expect(handlerWith([alice, bob]).findBirthdayEvent(eventInfo)).resolves.toBe(bob);
  });

  it('prefers a title match over an earlier event that only shares the birthday pattern', async () => {
    const eventInfo: EventInfo = { eventId: 'dom_BIRTHDAY_bob', title: 'Bob', isBirthdayEvent: true };

    await expect(handlerWith([alice, bob]).findBirthdayEvent(eventInfo)).resolves.toBe(bob);
  });

  it('still falls back to the birthday ID pattern when nothing matches more specifically', async () => {
    const eventInfo: EventInfo = { eventId: 'dom_BIRTHDAY_unknown', isBirthdayEvent: true };

    await expect(handlerWith([alice, bob]).findBirthdayEvent(eventInfo)).resolves.toBe(alice);
  });

  it('returns null when no event matches', async () => {
    const eventInfo: EventInfo = { eventId: 'regular_event', title: 'Carol', isBirthdayEvent: true };

    await expect(handlerWith([alice, bob]).findBirthdayEvent(eventInfo)).resolves.toBeNull();
  });
});
