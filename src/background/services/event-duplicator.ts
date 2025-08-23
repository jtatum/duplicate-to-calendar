// Event duplication service

import { 
  EventInfo, 
  CalendarEvent, 
  CalendarListItem,
  ExtensionError,
  ValidationError 
} from '../../shared/types.js';
import { STORAGE_KEYS, BIRTHDAY_CONFIG } from '../../shared/constants.js';
import { 
  validateCalendarId, 
  validateEventId, 
  validateEventInfo,
  throwIfInvalid 
} from '../../shared/validators.js';
import { 
  sanitizeEventData 
} from '../../shared/sanitizers.js';
import { 
  extractErrorMessage, 
  isFebruary29, 
  log 
} from '../../shared/utils.js';
import { CalendarApiClient } from '../api/calendar-api.js';
import { BirthdayEventHandler } from './birthday-handler.js';

export class EventDuplicator {
  private apiClient: CalendarApiClient;
  private birthdayHandler: BirthdayEventHandler;

  constructor(apiClient: CalendarApiClient, birthdayHandler?: BirthdayEventHandler) {
    this.apiClient = apiClient;
    this.birthdayHandler = birthdayHandler || new BirthdayEventHandler(apiClient);
  }

  /**
   * Duplicates an event to the selected destination calendar
   */
  async duplicateEvent(eventInfo: EventInfo): Promise<CalendarEvent> {
    try {
      log('info', 'Starting event duplication', { eventId: eventInfo.eventId });
      
      // Validate event info
      const validationResult = validateEventInfo(eventInfo);
      throwIfInvalid(validationResult, 'eventInfo');

      // Get the selected destination calendar
      const settings = await chrome.storage.sync.get([STORAGE_KEYS.SELECTED_CALENDAR_ID]);
      if (!settings[STORAGE_KEYS.SELECTED_CALENDAR_ID]) {
        throw new ExtensionError(
          'No destination calendar selected. Please configure in extension options.',
          'NO_DESTINATION_CALENDAR'
        );
      }

      const destinationCalendarId = settings[STORAGE_KEYS.SELECTED_CALENDAR_ID];
      
      // Validate destination calendar ID
      if (!validateCalendarId(destinationCalendarId)) {
        throw new ValidationError(
          'Invalid destination calendar configuration. Please reconfigure in extension options.',
          'destinationCalendarId'
        );
      }

      // Check if the event is already in the destination calendar
      if (eventInfo.calendarId && eventInfo.calendarId === destinationCalendarId) {
        throw new ExtensionError(
          'Event is already in the destination calendar',
          'ALREADY_IN_DESTINATION'
        );
      }

      // Find the original event
      const originalEvent = await this.findOriginalEvent(eventInfo);
      if (!originalEvent) {
        throw new ExtensionError(
          'Could not find the original event in any accessible calendar',
          'EVENT_NOT_FOUND'
        );
      }

      log('info', 'Original event found, creating duplicate');

      // Create the duplicate event data
      const duplicateEventData = this.createDuplicateEventData(originalEvent, eventInfo);

      // Sanitize event data before sending to API
      const sanitizedEventData = sanitizeEventData(duplicateEventData);

      // Create the duplicate event
      const result = await this.apiClient.createEvent(destinationCalendarId, sanitizedEventData);

      log('info', 'Event duplicated successfully');
      return result;

    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Error duplicating event', { error: message, eventInfo });
      
      // Log security events
      if (error instanceof ValidationError) {
        log('warn', 'Security validation triggered', { error: message });
      }
      
      throw error;
    }
  }

  /**
   * Finds the original event by searching in various ways
   */
  private async findOriginalEvent(eventInfo: EventInfo): Promise<CalendarEvent | null> {
    // Special handling for birthday events
    if (eventInfo.isBirthdayEvent) {
      log('info', 'Searching for birthday event');
      const birthdayEvent = await this.birthdayHandler.findBirthdayEvent(eventInfo);
      if (birthdayEvent) {
        return birthdayEvent;
      }
    }

    // Try using extracted calendar ID directly
    if (eventInfo.calendarId && validateCalendarId(eventInfo.calendarId)) {
      log('info', 'Searching using extracted calendar ID', { calendarId: eventInfo.calendarId });
      
      const event = await this.tryGetEventFromCalendar(eventInfo.calendarId, eventInfo.eventId);
      if (event) {
        return event;
      }
    }

    // Try finding by calendar name
    if (eventInfo.calendarName) {
      log('info', 'Searching by calendar name', { calendarName: eventInfo.calendarName });
      
      const calendars = await this.apiClient.getCalendarList();
      const targetCalendar = calendars.find(cal => {
        const displayName = cal.summaryOverride || cal.summary;
        return displayName?.toLowerCase() === eventInfo.calendarName!.toLowerCase();
      });

      if (targetCalendar && validateCalendarId(targetCalendar.id)) {
        const event = await this.tryGetEventFromCalendar(targetCalendar.id, eventInfo.eventId);
        if (event) {
          return event;
        }
      }
    }

    // Last resort: search all calendars
    log('info', 'Last resort: searching all accessible calendars');
    return this.searchAllCalendars(eventInfo.eventId);
  }

  /**
   * Tries to get an event from a specific calendar with ID variations
   */
  private async tryGetEventFromCalendar(calendarId: string, eventId: string): Promise<CalendarEvent | null> {
    try {
      // Try using the full event ID as-is first (skip retries on 404 since we're searching)
      const event = await this.apiClient.getEvent(calendarId, eventId, true);
      return event;
      
    } catch (error) {
      // If that fails and the event ID contains spaces, try parsing it
      if (eventId.includes(' ')) {
        try {
          const eventPart = eventId.split(' ')[0];
          if (validateEventId(eventPart)) {
            const event = await this.apiClient.getEvent(calendarId, eventPart, true);
            return event;
          }
        } catch {
          // Ignore parsing errors
        }
      }
      
      log('info', 'Event not found in calendar', { calendarId, eventId });
      return null;
    }
  }

  /**
   * Searches all accessible calendars for the event
   */
  private async searchAllCalendars(eventId: string): Promise<CalendarEvent | null> {
    const calendars = await this.apiClient.getCalendarList();
    
    for (const calendar of calendars) {
      if (!validateCalendarId(calendar.id)) {
        continue;
      }
      
      try {
        const event = await this.tryGetEventFromCalendar(calendar.id, eventId);
        if (event) {
          log('info', 'Found event in calendar', { calendarId: calendar.id });
          return event;
        }
      } catch {
        // Continue searching other calendars
        continue;
      }
    }
    
    return null;
  }

  /**
   * Creates the duplicate event data from the original event
   */
  private createDuplicateEventData(originalEvent: CalendarEvent, eventInfo: EventInfo): Partial<CalendarEvent> {
    if (eventInfo.isBirthdayEvent) {
      return this.birthdayHandler.createBirthdayDuplicate(originalEvent, eventInfo);
    }

    // Regular event duplication
    return {
      summary: originalEvent.summary || 'Copied Event',
      description: originalEvent.description || '',
      location: originalEvent.location || '',
      start: originalEvent.start,
      end: originalEvent.end
    };
  }
}