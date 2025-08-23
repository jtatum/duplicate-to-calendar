// Smart calendar caching system

import { CalendarListItem, CachedCalendarData } from '../../shared/types.js';
import { CACHE_CONFIG } from '../../shared/constants.js';
import { log } from '../../shared/utils.js';

export class CalendarCache {
  private cache: CachedCalendarData | null = null;
  private version = 1;
  private cacheTimeoutId: ReturnType<typeof setTimeout> | undefined;

  /**
   * Checks if the cache is valid and not expired
   */
  isValid(): boolean {
    if (!this.cache) {
      return false;
    }
    
    const now = Date.now();
    const cacheAge = now - this.cache.timestamp;
    return cacheAge < CACHE_CONFIG.CALENDAR_CACHE_TTL;
  }

  /**
   * Sets cache data with fresh calendar list
   */
  setCache(calendars: CalendarListItem[]): void {
    log('info', `Updating calendar cache with ${calendars.length} calendars`);
    
    const calendarNameMap = new Map<string, CalendarListItem>();
    const calendarIdMap = new Map<string, CalendarListItem>();

    // Build lookup maps for fast searching
    calendars.forEach(calendar => {
      calendarIdMap.set(calendar.id, calendar);
      
      // Map both summary and summaryOverride to calendar (case-insensitive)
      const displayName = calendar.summaryOverride || calendar.summary;
      if (displayName) {
        calendarNameMap.set(displayName.toLowerCase(), calendar);
        if (calendar.summary) {
          calendarNameMap.set(calendar.summary.toLowerCase(), calendar);
        }
      }
    });

    this.cache = {
      calendars,
      writableCalendars: calendars.filter(cal => 
        cal.accessRole === 'owner' || cal.accessRole === 'writer'
      ),
      calendarNameMap,
      calendarIdMap,
      timestamp: Date.now(),
      version: ++this.version
    };

    // Auto-invalidate cache after TTL
    if (this.cacheTimeoutId !== undefined) {
      clearTimeout(this.cacheTimeoutId);
    }
    
    this.cacheTimeoutId = setTimeout(() => {
      log('info', 'Calendar cache auto-expired');
      this.invalidate();
    }, CACHE_CONFIG.CALENDAR_CACHE_TTL) as any;

    log('info', `Calendar cache updated (version ${this.version})`);
  }

  /**
   * Finds a calendar by name (case insensitive)
   */
  findByName(calendarName: string): CalendarListItem | null {
    if (!this.isValid() || !calendarName) {
      return null;
    }
    
    const calendar = this.cache!.calendarNameMap.get(calendarName.toLowerCase());
    return calendar || null;
  }

  /**
   * Finds a calendar by ID
   */
  findById(calendarId: string): CalendarListItem | null {
    if (!this.isValid() || !calendarId) {
      return null;
    }
    
    const calendar = this.cache!.calendarIdMap.get(calendarId);
    return calendar || null;
  }

  /**
   * Gets all calendars from cache
   */
  getAllCalendars(): CalendarListItem[] | null {
    return this.isValid() ? this.cache!.calendars : null;
  }

  /**
   * Gets writable calendars from cache
   */
  getWritableCalendars(): CalendarListItem[] | null {
    return this.isValid() ? this.cache!.writableCalendars : null;
  }

  /**
   * Gets cache metadata
   */
  getCacheInfo(): { isValid: boolean; version: number; timestamp?: number; age?: number } {
    if (!this.cache) {
      return { isValid: false, version: this.version };
    }
    
    const age = Date.now() - this.cache.timestamp;
    return {
      isValid: this.isValid(),
      version: this.version,
      timestamp: this.cache.timestamp,
      age
    };
  }

  /**
   * Invalidates the cache
   */
  invalidate(): void {
    log('info', `Invalidating calendar cache (version ${this.version})`);
    
    this.cache = null;
    
    if (this.cacheTimeoutId !== undefined) {
      clearTimeout(this.cacheTimeoutId);
      this.cacheTimeoutId = undefined;
    }
  }

  /**
   * Forces a cache refresh by invalidating current cache
   */
  forceRefresh(): void {
    log('info', 'Forcing calendar cache refresh');
    this.invalidate();
  }

  /**
   * Gets statistics about cache usage
   */
  getStats(): {
    totalCalendars: number;
    writableCalendars: number;
    cacheHits: number;
    cacheMisses: number;
    isValid: boolean;
  } {
    if (!this.cache) {
      return {
        totalCalendars: 0,
        writableCalendars: 0,
        cacheHits: 0,
        cacheMisses: 0,
        isValid: false
      };
    }
    
    return {
      totalCalendars: this.cache.calendars.length,
      writableCalendars: this.cache.writableCalendars.length,
      cacheHits: 0, // Could be tracked if needed
      cacheMisses: 0, // Could be tracked if needed
      isValid: this.isValid()
    };
  }
}