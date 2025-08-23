// Tests for CalendarCache

import { CalendarCache } from '../../src/background/api/calendar-cache';
import { CalendarListItem } from '../../src/shared/types';

describe('CalendarCache', () => {
  let cache: CalendarCache;
  let mockCalendars: CalendarListItem[];

  beforeEach(() => {
    cache = new CalendarCache();
    mockCalendars = [
      {
        id: 'primary',
        summary: 'Primary Calendar',
        accessRole: 'owner',
        primary: true
      },
      {
        id: 'user@example.com',
        summary: 'Work Calendar',
        summaryOverride: 'My Work',
        accessRole: 'writer'
      },
      {
        id: 'readonly@example.com',
        summary: 'Read Only Calendar',
        accessRole: 'reader'
      }
    ];
  });

  describe('cache validity', () => {
    it('should be invalid when empty', () => {
      expect(cache.isValid()).toBe(false);
    });

    it('should be valid after setting cache', () => {
      cache.setCache(mockCalendars);
      expect(cache.isValid()).toBe(true);
    });

    it('should become invalid after TTL expires', async () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      cache.setCache(mockCalendars);
      expect(cache.isValid()).toBe(true);

      // Advance time beyond TTL (5 minutes = 300000ms)
      mockTime += 400000;
      expect(cache.isValid()).toBe(false);

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('cache operations', () => {
    beforeEach(() => {
      cache.setCache(mockCalendars);
    });

    it('should return all calendars', () => {
      const calendars = cache.getAllCalendars();
      expect(calendars).toEqual(mockCalendars);
    });

    it('should return only writable calendars', () => {
      const writableCalendars = cache.getWritableCalendars();
      expect(writableCalendars).toHaveLength(2);
      expect(writableCalendars?.every(cal => 
        cal.accessRole === 'owner' || cal.accessRole === 'writer'
      )).toBe(true);
    });

    it('should find calendar by ID', () => {
      const calendar = cache.findById('user@example.com');
      expect(calendar?.id).toBe('user@example.com');
      expect(calendar?.summary).toBe('Work Calendar');
    });

    it('should find calendar by name (case insensitive)', () => {
      const calendar1 = cache.findByName('My Work'); // summaryOverride
      expect(calendar1?.id).toBe('user@example.com');

      const calendar2 = cache.findByName('work calendar'); // summary, case insensitive
      expect(calendar2?.id).toBe('user@example.com');

      const calendar3 = cache.findByName('PRIMARY CALENDAR');
      expect(calendar3?.id).toBe('primary');
    });

    it('should return null for missing calendars', () => {
      expect(cache.findById('missing@example.com')).toBe(null);
      expect(cache.findByName('Missing Calendar')).toBe(null);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache', () => {
      cache.setCache(mockCalendars);
      expect(cache.isValid()).toBe(true);

      cache.invalidate();
      expect(cache.isValid()).toBe(false);
      expect(cache.getAllCalendars()).toBe(null);
    });

    it('should force refresh by invalidating', () => {
      cache.setCache(mockCalendars);
      const originalVersion = cache.getCacheInfo().version;

      cache.forceRefresh();
      expect(cache.isValid()).toBe(false);

      // Setting cache again should increment version
      cache.setCache(mockCalendars);
      expect(cache.getCacheInfo().version).toBeGreaterThan(originalVersion);
    });
  });

  describe('cache info and stats', () => {
    it('should provide cache info', () => {
      const info = cache.getCacheInfo();
      expect(info.isValid).toBe(false);
      expect(info.version).toBeGreaterThan(0);

      cache.setCache(mockCalendars);
      const updatedInfo = cache.getCacheInfo();
      expect(updatedInfo.isValid).toBe(true);
      expect(updatedInfo.timestamp).toBeDefined();
      expect(updatedInfo.age).toBeDefined();
    });

    it('should provide cache stats', () => {
      let stats = cache.getStats();
      expect(stats.isValid).toBe(false);
      expect(stats.totalCalendars).toBe(0);

      cache.setCache(mockCalendars);
      stats = cache.getStats();
      expect(stats.isValid).toBe(true);
      expect(stats.totalCalendars).toBe(3);
      expect(stats.writableCalendars).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty calendar arrays', () => {
      cache.setCache([]);
      expect(cache.getAllCalendars()).toEqual([]);
      expect(cache.getWritableCalendars()).toEqual([]);
    });

    it('should handle calendars without names', () => {
      const calendarsWithoutNames: CalendarListItem[] = [
        {
          id: 'test@example.com',
          summary: '',
          accessRole: 'owner'
        }
      ];

      cache.setCache(calendarsWithoutNames);
      expect(cache.findByName('')).toBeDefined();
    });

    it('should return null when cache is invalid', () => {
      expect(cache.findById('any-id')).toBe(null);
      expect(cache.findByName('any-name')).toBe(null);
      expect(cache.getAllCalendars()).toBe(null);
      expect(cache.getWritableCalendars()).toBe(null);
    });
  });
});