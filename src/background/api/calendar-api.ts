// Google Calendar API client

import { 
  CalendarListItem, 
  CalendarListResponse, 
  CalendarEvent, 
  EventsListResponse,
  ApiError 
} from '../../shared/types.js';
import { 
  API_ENDPOINTS, 
  HTTP_STATUS,
  VALIDATION_LIMITS 
} from '../../shared/constants.js';
import { 
  validateCalendarId, 
  validateEventId, 
  isSuccessfulHttpStatus 
} from '../../shared/validators.js';
import { 
  sanitizeHttpStatus, 
  sanitizeErrorMessage 
} from '../../shared/sanitizers.js';
import { 
  extractErrorMessage, 
  retryWithBackoff, 
  timeout,
  log 
} from '../../shared/utils.js';
import { Authenticator } from '../auth/authenticator.js';
import { CalendarCache } from './calendar-cache.js';

export class CalendarApiClient {
  private authenticator: Authenticator;
  private cache: CalendarCache;

  constructor(authenticator: Authenticator, cache: CalendarCache) {
    this.authenticator = authenticator;
    this.cache = cache;
  }

  /**
   * Fetches the user's calendar list with caching
   */
  async getCalendarList(forceRefresh = false): Promise<CalendarListItem[]> {
    try {
      // Check cache first unless forced refresh
      if (!forceRefresh) {
        const cachedCalendars = this.cache.getAllCalendars();
        if (cachedCalendars) {
          log('info', `Returning ${cachedCalendars.length} calendars from cache`);
          return cachedCalendars;
        }
      }

      log('info', 'Fetching calendar list from API');
      
      return await retryWithBackoff(async () => {
        let token = await this.authenticator.getTokenSilently();
        
        let response = await this.makeApiRequest(API_ENDPOINTS.CALENDAR_LIST, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        // If unauthorized, try refreshing token once
        if (response.status === HTTP_STATUS.UNAUTHORIZED) {
          log('info', 'Token expired, refreshing and retrying');
          this.cache.invalidate(); // Invalidate cache when auth tokens are refreshed
          token = await this.authenticator.refreshToken();
          
          response = await this.makeApiRequest(API_ENDPOINTS.CALENDAR_LIST, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
        }
        
        if (!response.ok) {
          await this.handleApiError(response);
        }
        
        const data = await response.json() as CalendarListResponse;
        const calendars = data.items || [];
        
        // Update cache with fresh data
        this.cache.setCache(calendars);
        
        log('info', `Fetched ${calendars.length} calendars from API`);
        return calendars;
      });
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to fetch calendar list', { error: message });
      throw error;
    }
  }

  /**
   * Gets only writable calendars (for options page)
   */
  async getWritableCalendars(forceRefresh = false): Promise<CalendarListItem[]> {
    try {
      // Try cache first
      if (!forceRefresh) {
        const cachedWritableCalendars = this.cache.getWritableCalendars();
        if (cachedWritableCalendars) {
          log('info', `Returning ${cachedWritableCalendars.length} writable calendars from cache`);
          return cachedWritableCalendars;
        }
      }
      
      // If cache miss, fetch all calendars which will update cache
      const allCalendars = await this.getCalendarList(forceRefresh);
      return this.cache.getWritableCalendars() || allCalendars.filter(calendar => 
        calendar.accessRole === 'owner' || calendar.accessRole === 'writer'
      );
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to fetch writable calendar list', { error: message });
      throw error;
    }
  }

  /**
   * Fetches a specific event from a calendar
   */
  async getEvent(calendarId: string, eventId: string, skipRetryOn404 = false): Promise<CalendarEvent> {
    if (!validateCalendarId(calendarId)) {
      throw new ApiError('Invalid calendar ID', 400);
    }
    
    if (!validateEventId(eventId)) {
      throw new ApiError('Invalid event ID', 400);
    }

    try {
      log('info', 'Fetching event from API', { calendarId, eventId });
      
      // Use retry logic only if not skipping 404 retries
      if (skipRetryOn404) {
        // Single attempt without retries for search operations
        const token = await this.authenticator.getTokenSilently();
        
        const response = await this.makeApiRequest(
          API_ENDPOINTS.EVENT(calendarId, eventId),
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          }
        );
        
        if (!response.ok) {
          await this.handleApiError(response);
        }
        
        const event = await response.json() as CalendarEvent;
        log('info', 'Event fetched successfully');
        return event;
      } else {
        // Normal retry logic for non-search operations
        return await retryWithBackoff(async () => {
          const token = await this.authenticator.getTokenSilently();
          
          const response = await this.makeApiRequest(
            API_ENDPOINTS.EVENT(calendarId, eventId),
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            }
          );
          
          if (!response.ok) {
            await this.handleApiError(response);
          }
          
          const event = await response.json() as CalendarEvent;
          log('info', 'Event fetched successfully');
          return event;
        });
      }
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to fetch event', { error: message, calendarId, eventId });
      throw error;
    }
  }

  /**
   * Creates a new event in the specified calendar
   */
  async createEvent(calendarId: string, eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
    if (!validateCalendarId(calendarId)) {
      throw new ApiError('Invalid calendar ID', 400);
    }

    try {
      log('info', 'Creating event via API', { calendarId });
      
      return await retryWithBackoff(async () => {
        const token = await this.authenticator.getTokenSilently();
        
        const response = await this.makeApiRequest(
          API_ENDPOINTS.EVENTS(calendarId),
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
          }
        );
        
        if (!response.ok) {
          await this.handleApiError(response);
        }
        
        const result = await response.json() as CalendarEvent;
        log('info', 'Event created successfully');
        return result;
      });
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to create event', { error: message, calendarId });
      throw error;
    }
  }

  /**
   * Searches for events in a calendar with filters
   */
  async searchEvents(
    calendarId: string, 
    options: {
      eventTypes?: string;
      maxResults?: number;
      timeMin?: string;
      timeMax?: string;
    } = {}
  ): Promise<CalendarEvent[]> {
    if (!validateCalendarId(calendarId)) {
      throw new ApiError('Invalid calendar ID', 400);
    }

    try {
      log('info', 'Searching events via API', { calendarId, options });
      
      return await retryWithBackoff(async () => {
        const token = await this.authenticator.getTokenSilently();
        
        // Build query parameters
        const params = new URLSearchParams();
        if (options.eventTypes) params.append('eventTypes', options.eventTypes);
        if (options.maxResults) params.append('maxResults', String(options.maxResults));
        if (options.timeMin) params.append('timeMin', options.timeMin);
        if (options.timeMax) params.append('timeMax', options.timeMax);
        
        const url = `${API_ENDPOINTS.EVENTS(calendarId)}?${params.toString()}`;
        
        const response = await this.makeApiRequest(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          await this.handleApiError(response);
        }
        
        const data = await response.json() as EventsListResponse;
        const events = data.items || [];
        
        log('info', `Found ${events.length} events`);
        return events;
      });
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to search events', { error: message, calendarId, options });
      throw error;
    }
  }

  /**
   * Makes an API request with timeout and error handling
   */
  private async makeApiRequest(url: string, options: RequestInit): Promise<Response> {
    const timeoutMs = 10000; // 10 seconds
    
    return timeout(fetch(url, options), timeoutMs);
  }

  /**
   * Handles API error responses
   */
  private async handleApiError(response: Response): Promise<never> {
    let errorMessage = '';
    
    try {
      const errorText = await response.text();
      errorMessage = errorText;
    } catch {
      errorMessage = 'Unknown API error';
    }
    
    // Rate limiting check
    if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      throw new ApiError('Too many requests. Please wait and try again.', response.status);
    }
    
    // Sanitize error response
    const sanitizedStatus = sanitizeHttpStatus(response.status, response.statusText);
    const sanitizedMessage = sanitizeErrorMessage(errorMessage);
    
    const fullMessage = `API call failed: ${sanitizedStatus}${sanitizedMessage ? ` - ${sanitizedMessage}` : ''}`;
    
    throw new ApiError(fullMessage, response.status);
  }
}