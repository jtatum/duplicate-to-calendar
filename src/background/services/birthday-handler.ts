// Birthday event handling service

import { 
  EventInfo, 
  CalendarEvent, 
  CalendarListItem 
} from '../../shared/types.js';
import { BIRTHDAY_CONFIG } from '../../shared/constants.js';
import { 
  validateEventId, 
  validateCalendarId 
} from '../../shared/validators.js';
import { 
  extractErrorMessage, 
  isFebruary29, 
  log 
} from '../../shared/utils.js';
import { CalendarApiClient } from '../api/calendar-api.js';

export class BirthdayEventHandler {
  private apiClient: CalendarApiClient;

  constructor(apiClient: CalendarApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Searches for a birthday event in the primary calendar
   */
  async findBirthdayEvent(eventInfo: EventInfo): Promise<CalendarEvent | null> {
    try {
      const calendars = await this.apiClient.getCalendarList();
      
      // Find the primary calendar
      const primaryCalendar = calendars.find(cal => cal.primary === true);
      if (!primaryCalendar) {
        log('info', 'No primary calendar found for birthday search');
        return null;
      }

      if (!validateCalendarId(primaryCalendar.id)) {
        log('error', 'Invalid primary calendar ID');
        return null;
      }

      log('info', 'Searching for birthday events in primary calendar');

      // Search for birthday events in the primary calendar
      const birthdayEvents = await this.apiClient.searchEvents(primaryCalendar.id, {
        eventTypes: 'birthday',
        maxResults: 50
      });

      log('info', `Found ${birthdayEvents.length} birthday events`);

      if (birthdayEvents.length === 0) {
        return null;
      }

      // Try to match the birthday event
      return this.matchBirthdayEvent(birthdayEvents, eventInfo);

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Error searching for birthday events', { error: message });
      return null;
    }
  }

  /**
   * Matches a birthday event from the search results
   */
  private matchBirthdayEvent(birthdayEvents: CalendarEvent[], eventInfo: EventInfo): CalendarEvent | null {
    for (const event of birthdayEvents) {
      log('info', 'Checking birthday event for match');

      // Try matching by event ID patterns
      if (eventInfo.eventId && event.id) {
        // Direct match
        if (validateEventId(event.id) && event.id === eventInfo.eventId) {
          log('info', 'Found birthday event by direct ID match');
          return event;
        }

        // Check if the event ID contains birthday patterns that match
        if (validateEventId(event.id) && 
            this.hasBirthdayPattern(eventInfo.eventId) && 
            this.hasBirthdayPattern(event.id)) {
          log('info', 'Found birthday event by ID pattern match');
          return event;
        }
      }

      // Try matching by title if available
      if (this.matchByTitle(event, eventInfo)) {
        log('info', 'Found birthday event by title match');
        return event;
      }
    }

    log('info', 'No matching birthday event found');
    return null;
  }

  /**
   * Checks if an event ID has birthday patterns
   */
  private hasBirthdayPattern(eventId: string): boolean {
    return eventId.includes('BIRTHDAY') || eventId.includes('_BIRTHDAY_');
  }

  /**
   * Matches birthday events by title
   */
  private matchByTitle(event: CalendarEvent, eventInfo: EventInfo): boolean {
    if (!eventInfo.title || !event.summary) {
      return false;
    }

    if (typeof eventInfo.title !== 'string' || 
        typeof event.summary !== 'string' ||
        eventInfo.title.length === 0 || 
        event.summary.length === 0) {
      return false;
    }

    const titleLower = eventInfo.title.toLowerCase();
    const summaryLower = event.summary.toLowerCase();
    
    return summaryLower.includes(titleLower) || titleLower.includes(summaryLower);
  }

  /**
   * Creates a duplicate birthday event with special handling
   */
  createBirthdayDuplicate(originalEvent: CalendarEvent, eventInfo: EventInfo): Partial<CalendarEvent> {
    log('info', 'Creating duplicate of birthday event with special properties');
    
    // Determine the appropriate recurrence rule
    let recurrence = originalEvent.recurrence || [BIRTHDAY_CONFIG.RECURRENCE_RULES.YEARLY];
    
    // Special handling for February 29 birthdays (leap year birthdays)
    if (originalEvent.start?.date && isFebruary29(originalEvent.start.date)) {
      log('info', 'Detected February 29 birthday, using special leap year recurrence rule');
      recurrence = [BIRTHDAY_CONFIG.RECURRENCE_RULES.LEAP_YEAR_FEB29];
    }

    // Build description with birthday indicator
    let description = originalEvent.description || '';
    if (description && !description.includes(BIRTHDAY_CONFIG.DESCRIPTION_SUFFIX)) {
      description += '\n\n' + BIRTHDAY_CONFIG.DESCRIPTION_SUFFIX;
    } else if (!description) {
      description = BIRTHDAY_CONFIG.DESCRIPTION_SUFFIX;
    }

    const duplicateEvent: Partial<CalendarEvent> = {
      summary: originalEvent.summary || eventInfo.title || 'Birthday Event',
      description,
      start: originalEvent.start,
      end: originalEvent.end,
      recurrence
    };

    log('info', 'Added yearly recurrence to birthday event');
    
    // Don't copy location from birthday events as it's usually not relevant
    // Birthday events typically don't have meaningful locations
    
    return duplicateEvent;
  }

  /**
   * Detects if event info indicates a birthday event
   */
  static detectBirthdayEvent(eventInfo: EventInfo, domContent?: string): boolean {
    // Check event ID patterns
    if (eventInfo.eventId && (eventInfo.eventId.includes('BIRTHDAY') || eventInfo.eventId.includes('_BIRTHDAY_'))) {
      return true;
    }

    // Check calendar name patterns
    if (eventInfo.calendarName && 
        BIRTHDAY_CONFIG.CALENDAR_PATTERNS.some(pattern => 
          eventInfo.calendarName!.toLowerCase().includes(pattern.toLowerCase())
        )) {
      return true;
    }

    // Check DOM content if provided
    if (domContent) {
      const lowerContent = domContent.toLowerCase();
      if (lowerContent.includes('birthday')) {
        return true;
      }
    }

    // Check if title suggests birthday
    if (eventInfo.title && eventInfo.title.toLowerCase().includes('birthday')) {
      return true;
    }

    return false;
  }

  /**
   * Validates if a birthday event is suitable for duplication
   */
  validateBirthdayEvent(event: CalendarEvent): boolean {
    // Must have start and end times
    if (!event.start || !event.end) {
      return false;
    }

    // Must have a summary/title
    if (!event.summary || event.summary.trim().length === 0) {
      return false;
    }

    return true;
  }
}