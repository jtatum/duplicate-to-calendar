// Event information extraction from DOM

import { EventInfo } from '../../shared/types.js';
import { DOM_SELECTORS, BIRTHDAY_CONFIG } from '../../shared/constants.js';
import { sanitizeText, parseCalendarDataText } from '../../shared/sanitizers.js';
import { log } from '../../shared/utils.js';

export class EventExtractor {
  
  /**
   * Extracts event information from a popup DOM element
   */
  extractEventInfo(popup: Element): EventInfo {
    const eventInfo: EventInfo = {
      eventId: '',
    };

    // Extract event ID
    eventInfo.eventId = this.extractEventId(popup);
    
    // Check if this is a birthday event
    eventInfo.isBirthdayEvent = this.detectBirthdayEvent(popup, eventInfo.eventId);
    
    // Extract title
    eventInfo.title = this.extractTitle(popup);
    
    // Extract time information
    eventInfo.time = this.extractTime(popup);
    
    // Extract location
    eventInfo.location = this.extractLocation(popup);
    
    // Extract description
    eventInfo.description = this.extractDescription(popup);
    
    // Extract calendar information
    const calendarInfo = this.extractCalendarInfo(popup);
    if (calendarInfo.name) {
      eventInfo.calendarName = calendarInfo.name;
    }
    if (calendarInfo.id) {
      eventInfo.calendarId = calendarInfo.id;
    }

    log('info', 'Event extraction complete', { 
      hasEventId: !!eventInfo.eventId,
      hasTitle: !!eventInfo.title,
      hasCalendarInfo: !!(eventInfo.calendarName || eventInfo.calendarId),
      isBirthdayEvent: eventInfo.isBirthdayEvent
    });

    return eventInfo;
  }

  /**
   * Extracts event ID from DOM
   */
  private extractEventId(popup: Element): string {
    // Try to extract event ID from various elements
    for (const selector of DOM_SELECTORS.EVENT_ID_ELEMENTS) {
      const element = popup.querySelector(selector);
      const rawEventId = element?.getAttribute('data-eventid');
      
      if (rawEventId) {
        log('info', 'Event ID found in DOM');
        
        // The event ID might be URL-encoded or base64-encoded, try to decode it
        try {
          // First try decoding as base64
          const decoded = atob(rawEventId);
          log('info', 'Event ID decoded (base64)');
          return decoded;
        } catch {
          // If base64 fails, try URL decoding
          try {
            const decoded = decodeURIComponent(rawEventId);
            log('info', 'Event ID decoded (URL)');
            return decoded;
          } catch {
            // If both fail, use raw value
            log('info', 'Using raw event ID');
            return rawEventId;
          }
        }
      }
    }

    // Check the popup element itself
    const popupEventId = popup.getAttribute('data-eventid');
    if (popupEventId) {
      log('info', 'Event ID found on popup element');
      return popupEventId;
    }

    log('warn', 'No event ID found in DOM');
    return '';
  }

  /**
   * Extracts event title from DOM
   */
  private extractTitle(popup: Element): string {
    for (const selector of DOM_SELECTORS.TITLE_ELEMENTS) {
      const element = popup.querySelector(selector);
      const title = element?.textContent?.trim();
      
      if (title) {
        log('info', 'Event title found');
        return sanitizeText(title);
      }
    }

    log('info', 'No event title found');
    return '';
  }

  /**
   * Extracts event time from DOM
   */
  private extractTime(popup: Element): string {
    for (const selector of DOM_SELECTORS.TIME_ELEMENTS) {
      const element = popup.querySelector(selector);
      const time = element?.textContent?.trim();
      
      if (time) {
        log('info', 'Event time found');
        return sanitizeText(time);
      }
    }

    log('info', 'No event time found');
    return '';
  }

  /**
   * Extracts event location from DOM
   */
  private extractLocation(popup: Element): string {
    for (const selector of DOM_SELECTORS.LOCATION_ELEMENTS) {
      const element = popup.querySelector(selector);
      const location = element?.textContent?.trim();
      
      if (location) {
        log('info', 'Event location found');
        return sanitizeText(location);
      }
    }

    log('info', 'No event location found');
    return '';
  }

  /**
   * Extracts event description from DOM
   */
  private extractDescription(popup: Element): string {
    for (const selector of DOM_SELECTORS.DESCRIPTION_ELEMENTS) {
      const element = popup.querySelector(selector);
      let description = element?.textContent?.trim();
      
      if (description) {
        // Remove "Description:" prefix if present
        if (description.startsWith('Description:')) {
          description = description.substring('Description:'.length).trim();
        }
        
        log('info', 'Event description found');
        return sanitizeText(description);
      }
    }

    log('info', 'No event description found');
    return '';
  }

  /**
   * Extracts calendar information from DOM
   */
  private extractCalendarInfo(popup: Element): { name?: string; id?: string } {
    // Try to find calendar element with data-text attribute
    for (const selector of DOM_SELECTORS.CALENDAR_ELEMENTS) {
      const element = popup.querySelector(selector);
      const dataText = element?.getAttribute('data-text');
      
      if (dataText) {
        log('info', 'Calendar data-text found');
        const parsed = parseCalendarDataText(dataText);
        if (parsed.name || parsed.id) {
          log('info', 'Calendar name and ID extracted', { 
            hasName: !!parsed.name, 
            hasId: !!parsed.id 
          });
          return parsed;
        }
      }
    }

    // Fallback: try the old method with organizer elements
    const organizerElements = popup.querySelectorAll(DOM_SELECTORS.ORGANIZER_ELEMENTS);
    for (let i = 0; i < organizerElements.length; i++) {
      const element = organizerElements[i];
      if (!element) continue;
      const text = element.textContent?.trim();
      
      if (text?.startsWith('Organizer:')) {
        const name = text.substring('Organizer:'.length).trim();
        if (name) {
          log('info', 'Calendar name extracted (fallback method)');
          return { name: sanitizeText(name) };
        }
      }
    }

    log('info', 'No calendar information found');
    return {};
  }

  /**
   * Detects if this is a birthday event
   */
  private detectBirthdayEvent(popup: Element, eventId: string): boolean {
    const indicators = [
      // Check event ID patterns
      this.hasBirthdayEventId(eventId),
      
      // Check popup content for birthday text
      this.hasBirthdayInContent(popup),
      
      // Check for birthday calendar indicators
      this.hasBirthdayCalendarIndicators(popup),
      
      // Check if it's an all-day event with birthday indicators
      this.isAllDayBirthdayEvent(popup),
    ];

    const isBirthday = indicators.some(indicator => indicator);
    
    if (isBirthday) {
      log('info', 'Birthday event detected via DOM indicators');
    }
    
    return isBirthday;
  }

  /**
   * Checks if event ID indicates a birthday event
   */
  private hasBirthdayEventId(eventId: string): boolean {
    if (!eventId) return false;
    
    // Birthday event IDs often contain "BIRTHDAY" patterns
    return eventId.includes('BIRTHDAY') || eventId.includes('_BIRTHDAY_');
  }

  /**
   * Checks if popup content contains birthday text
   */
  private hasBirthdayInContent(popup: Element): boolean {
    const textContent = popup.textContent?.toLowerCase();
    return textContent?.includes('birthday') || false;
  }

  /**
   * Checks for birthday calendar indicators in DOM
   */
  private hasBirthdayCalendarIndicators(popup: Element): boolean {
    // Check data-text attributes for birthday calendar patterns
    const elements = popup.querySelectorAll('[data-text]');
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (!element) continue;
      const dataText = element.getAttribute('data-text');
      if (dataText) {
        const lowerDataText = dataText.toLowerCase();
        if (BIRTHDAY_CONFIG.CALENDAR_PATTERNS.some(pattern => 
          lowerDataText.includes(pattern.toLowerCase())
        )) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Checks if this is an all-day event with birthday indicators
   */
  private isAllDayBirthdayEvent(popup: Element): boolean {
    // Find time elements to check for all-day status
    for (const selector of DOM_SELECTORS.TIME_ELEMENTS) {
      const timeElement = popup.querySelector(selector);
      const timeText = timeElement?.textContent?.toLowerCase();
      
      if (timeText?.includes('all day')) {
        // Check if popup content also suggests birthday
        return this.hasBirthdayInContent(popup);
      }
    }
    
    return false;
  }
}