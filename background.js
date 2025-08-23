// Background service worker for Google Calendar Event Duplicator

console.log('Google Calendar Event Duplicator background script loaded');

// Open options page when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// Track logout state
let isLoggedOut = false;

// Input validation functions
function validateCalendarId(calendarId) {
  if (!calendarId || typeof calendarId !== 'string') {
    return false;
  }
  
  // Calendar IDs should be email-like (user@domain.com) or special format
  // Max length 320 chars (RFC 5321 email limit)
  if (calendarId.length > 320) {
    return false;
  }
  
  // Basic format check - should contain @ unless it's 'primary'
  if (calendarId === 'primary') {
    return true;
  }
  
  // Should be email-like format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(calendarId);
}

function validateEventId(eventId) {
  if (!eventId || typeof eventId !== 'string') {
    return false;
  }
  
  // Event IDs should be reasonable length (Google's are typically 26 chars but can vary)
  // Set generous limit of 500 chars
  if (eventId.length > 500 || eventId.length === 0) {
    return false;
  }
  
  // Should not contain dangerous characters
  const dangerousChars = /[<>"'&\\]/;
  if (dangerousChars.test(eventId)) {
    return false;
  }
  
  return true;
}

function sanitizeEventData(eventData) {
  const sanitized = {};
  
  // Sanitize summary (title)
  if (eventData.summary && typeof eventData.summary === 'string') {
    sanitized.summary = eventData.summary.substring(0, 1000); // Limit to 1000 chars
  }
  
  // Sanitize description
  if (eventData.description && typeof eventData.description === 'string') {
    sanitized.description = eventData.description.substring(0, 8192); // Limit to 8KB
  }
  
  // Sanitize location
  if (eventData.location && typeof eventData.location === 'string') {
    sanitized.location = eventData.location.substring(0, 1000);
  }
  
  // Copy time fields if they exist and are objects
  if (eventData.start && typeof eventData.start === 'object') {
    sanitized.start = eventData.start;
  }
  
  if (eventData.end && typeof eventData.end === 'object') {
    sanitized.end = eventData.end;
  }
  
  // Copy recurrence if it exists and is an array
  if (eventData.recurrence && Array.isArray(eventData.recurrence)) {
    sanitized.recurrence = eventData.recurrence;
  }
  
  return sanitized;
}

// Smart calendar caching system
class CalendarCache {
  constructor() {
    this.cache = null;
    this.version = 0;
    this.cacheTimeoutId = null;
  }

  // Check if cache is valid
  isValid() {
    if (!this.cache) return false;
    const now = Date.now();
    const cacheAge = now - this.cache.timestamp;
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    return cacheAge < fiveMinutes;
  }

  // Set cache data
  setCache(calendars) {
    this.cache = {
      calendars: calendars,
      writableCalendars: calendars.filter(cal => 
        cal.accessRole === 'owner' || cal.accessRole === 'writer'
      ),
      calendarNameMap: new Map(),
      calendarIdMap: new Map(),
      timestamp: Date.now(),
      version: ++this.version
    };

    // Build lookup maps for fast searching
    calendars.forEach(calendar => {
      this.cache.calendarIdMap.set(calendar.id, calendar);
      
      // Map both summary and summaryOverride to calendar
      const displayName = calendar.summaryOverride || calendar.summary;
      if (displayName) {
        this.cache.calendarNameMap.set(displayName.toLowerCase(), calendar);
        this.cache.calendarNameMap.set(calendar.summary?.toLowerCase(), calendar);
      }
    });

    // Auto-invalidate cache after 5 minutes
    if (this.cacheTimeoutId) {
      clearTimeout(this.cacheTimeoutId);
    }
    this.cacheTimeoutId = setTimeout(() => {
      console.log('Calendar cache auto-expired');
      this.invalidate();
    }, 5 * 60 * 1000);

    console.log(`Calendar cache updated with ${calendars.length} calendars`);
  }

  // Find calendar by name (case insensitive)
  findByName(calendarName) {
    if (!this.isValid() || !calendarName) return null;
    return this.cache.calendarNameMap.get(calendarName.toLowerCase()) || null;
  }

  // Find calendar by ID
  findById(calendarId) {
    if (!this.isValid() || !calendarId) return null;
    return this.cache.calendarIdMap.get(calendarId) || null;
  }

  // Get all calendars from cache
  getAllCalendars() {
    return this.isValid() ? this.cache.calendars : null;
  }

  // Get writable calendars from cache
  getWritableCalendars() {
    return this.isValid() ? this.cache.writableCalendars : null;
  }

  // Invalidate cache
  invalidate() {
    this.cache = null;
    if (this.cacheTimeoutId) {
      clearTimeout(this.cacheTimeoutId);
      this.cacheTimeoutId = null;
    }
    console.log('Calendar cache invalidated');
  }
}

// Global calendar cache instance
const calendarCache = new CalendarCache();

// OAuth authentication functions
async function authenticate() {
  try {
    // Check if user has explicitly logged out
    if (isLoggedOut) {
      throw new Error('User has logged out. Please log in again.');
    }
    
    console.log('Starting authentication...');
    const token = await chrome.identity.getAuthToken({ 
      interactive: true 
    });
    
    if (token) {
      console.log('Authentication successful');
      
      // Handle both old format (string) and new format (object with token property)
      let actualToken;
      if (typeof token === 'string') {
        actualToken = token;
      } else if (token && typeof token === 'object' && token.token) {
        actualToken = token.token;
      } else {
        console.error('Unexpected token format received');
        throw new Error('Token is not in expected format');
      }
      
      // Validate token format more thoroughly
      if (!actualToken.startsWith('ya29.') || actualToken.length < 20 || actualToken.length > 2048) {
        console.error('Token format invalid');
        throw new Error('Invalid token format received');
      }
      
      // Additional token validation
      if (!/^ya29\.[a-zA-Z0-9\-._~]+$/.test(actualToken)) {
        console.error('Token contains invalid characters');
        throw new Error('Token contains invalid characters');
      }
      
      // Reset logout state on successful authentication
      isLoggedOut = false;
      
      return actualToken;
    } else {
      throw new Error('No token received');
    }
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

// Test function to verify authentication works
async function testAuthentication() {
  try {
    const token = await authenticate();
    
    // Simple API call to test authentication with minimal data fetch
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('Authentication test successful');
      return true;
    } else {
      console.error('Authentication test failed:', response.status, response.statusText);
      
      // Try to clear the token cache and retry
      if (response.status === 401) {
        console.log('Token invalid, clearing cache and retrying...');
        await chrome.identity.clearAllCachedAuthTokens();
        
        // Retry with fresh token
        const newToken = await authenticate();
        const retryResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Accept': 'application/json'
          }
        });
        
        if (retryResponse.ok) {
          console.log('Authentication retry successful');
          return true;
        } else {
          console.error('Authentication retry also failed:', retryResponse.status);
        }
      }
      return false;
    }
  } catch (error) {
    console.error('Authentication test failed:', error);
    return false;
  }
}

// Auto-test authentication when extension loads
chrome.runtime.onStartup.addListener(() => {
  testAuthentication();
});

// Also test when extension is installed and open options page
chrome.runtime.onInstalled.addListener(() => {
  testAuthentication();
  
  // Open the options page to help user configure destination calendar
  chrome.runtime.openOptionsPage();
});

// Function to get calendars for options page (only writable ones)
async function getWritableCalendarList() {
  try {
    // Try cache first
    const cachedWritableCalendars = calendarCache.getWritableCalendars();
    if (cachedWritableCalendars) {
      console.log(`Returning ${cachedWritableCalendars.length} writable calendars from cache`);
      return cachedWritableCalendars;
    }
    
    // If cache miss, fetch all calendars which will update cache
    const allCalendars = await getAllCalendarList();
    // The getAllCalendarList call will have updated cache, so return from cache
    return calendarCache.getWritableCalendars() || allCalendars.filter(calendar => 
      calendar.accessRole === 'owner' || calendar.accessRole === 'writer'
    );
  } catch (error) {
    console.error('Failed to fetch writable calendar list:', error);
    throw error;
  }
}

// Function to get all accessible calendars (including read-only)
async function getAllCalendarList(forceRefresh = false) {
  try {
    // Check cache first unless forced refresh
    if (!forceRefresh) {
      const cachedCalendars = calendarCache.getAllCalendars();
      if (cachedCalendars) {
        console.log(`Returning ${cachedCalendars.length} calendars from cache`);
        return cachedCalendars;
      }
    }
    
    console.log('Fetching calendar list from API...');
    let token = await authenticate();
    
    let response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    // If unauthorized, try clearing token cache and retry once
    if (response.status === 401) {
      console.log('Token expired, clearing cache and retrying...');
      // Invalidate calendar cache when auth tokens are refreshed
      calendarCache.invalidate();
      await chrome.identity.clearAllCachedAuthTokens();
      token = await authenticate();
      
      response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    }
    
    if (response.ok) {
      const data = await response.json();
      const calendars = data.items;
      
      // Update cache with fresh data
      calendarCache.setCache(calendars);
      
      return calendars;
    } else {
      // Rate limiting check
      if (response.status === 429) {
        throw new Error('Too many requests. Please wait and try again.');
      }
      
      const errorText = await response.text();
      console.error('API response:', errorText);
      
      // Sanitize error response
      const sanitizedStatus = String(response.status).replace(/[<>"'&]/g, '');
      const sanitizedStatusText = String(response.statusText).replace(/[<>"'&]/g, '');
      throw new Error(`API call failed: ${sanitizedStatus} ${sanitizedStatusText}`);
    }
  } catch (error) {
    console.error('Failed to fetch calendar list:', error);
    throw error;
  }
}

// Legacy function name for backward compatibility
async function getCalendarList() {
  return await getWritableCalendarList();
}

// Message handler for options page and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getCalendars') {
    getWritableCalendarList()
      .then(calendars => sendResponse({ success: true, calendars }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
  
  if (message.action === 'duplicateEvent') {
    duplicateEvent(message.eventInfo)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
  
  if (message.action === 'logout') {
    logout()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
  
  if (message.action === 'login') {
    // Reset logout state and allow re-authentication
    isLoggedOut = false;
    // Invalidate cache to ensure fresh data after login
    calendarCache.invalidate();
    getWritableCalendarList()
      .then(calendars => sendResponse({ success: true, calendars }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
});

// Function to search for birthday events in the primary calendar
async function searchForBirthdayEvent(eventInfo, allCalendars, token) {
  // Find the primary calendar
  const primaryCalendar = allCalendars.find(cal => cal.primary === true);
  if (!primaryCalendar) {
    console.log('No primary calendar found');
    return null;
  }

  console.log('Searching for birthday events in primary calendar');

  try {
    // Validate calendar ID before use
    if (!validateCalendarId(primaryCalendar.id)) {
      console.error('Invalid primary calendar ID');
      return null;
    }
    
    // Search for birthday events in the primary calendar
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(primaryCalendar.id)}/events?eventTypes=birthday&maxResults=50`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`Birthday events search failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`Found ${data.items?.length || 0} birthday events`);

    if (!data.items || data.items.length === 0) {
      return null;
    }

    // Try to match the birthday event by title, event ID pattern, or timing
    for (const event of data.items) {
      console.log('Checking birthday event');

      // Try matching by event ID patterns
      if (eventInfo.eventId) {
        // Direct match (with validation)
        if (validateEventId(event.id) && event.id === eventInfo.eventId) {
          console.log('Found birthday event by direct ID match');
          return event;
        }

        // Check if the event ID contains birthday patterns that match
        if (validateEventId(event.id) && 
            eventInfo.eventId.includes('BIRTHDAY') && event.id.includes('BIRTHDAY')) {
          console.log('Found birthday event by ID pattern match');
          return event;
        }
      }

      // Try matching by title if available (with length checks)
      if (eventInfo.title && typeof eventInfo.title === 'string' && eventInfo.title.length > 0 &&
          event.summary && typeof event.summary === 'string' && event.summary.length > 0) {
        const titleLower = eventInfo.title.toLowerCase();
        const summaryLower = event.summary.toLowerCase();
        
        if (summaryLower.includes(titleLower) || titleLower.includes(summaryLower)) {
          console.log('Found birthday event by title match');
          return event;
        }
      }
    }

    console.log('No matching birthday event found');
    return null;

  } catch (error) {
    console.error('Error searching for birthday events:', error);
    return null;
  }
}

// Function to duplicate an event
async function duplicateEvent(eventInfo) {
  try {
    console.log('Duplicating event');
    
    if (!eventInfo.eventId) {
      throw new Error('No event ID provided');
    }
    
    // Validate event ID
    if (!validateEventId(eventInfo.eventId)) {
      throw new Error('Invalid event ID format');
    }
    
    // Get the selected destination calendar
    const settings = await chrome.storage.sync.get(['selectedCalendarId']);
    if (!settings.selectedCalendarId) {
      throw new Error('No destination calendar selected. Please configure in extension options.');
    }
    
    // Validate destination calendar ID
    if (!validateCalendarId(settings.selectedCalendarId)) {
      throw new Error('Invalid destination calendar configuration. Please reconfigure in extension options.');
    }
    
    // Check if the event is already in the destination calendar (with validation)
    if (eventInfo.calendarId && validateCalendarId(eventInfo.calendarId) && 
        eventInfo.calendarId === settings.selectedCalendarId) {
      throw new Error('Event is already in the destination calendar');
    }
    
    // Get authentication token
    const token = await authenticate();
    
    let originalEvent = null;
    let foundInCalendar = null;
    let allCalendars = null;
    
    // Special handling for birthday events (with additional validation)
    if (eventInfo.isBirthdayEvent === true) {
      console.log('Detected birthday event, searching primary calendar with birthday filter...');
      // Get cached calendars first, or fetch if needed
      allCalendars = calendarCache.getAllCalendars();
      if (!allCalendars) {
        console.log('Cache miss - fetching calendars for birthday event search');
        allCalendars = await getAllCalendarList();
      }
      originalEvent = await searchForBirthdayEvent(eventInfo, allCalendars, token);
      if (originalEvent) {
        foundInCalendar = 'primary_birthday';
        console.log('Found birthday event in primary calendar');
      }
    }
    
    // If we have calendar ID from the dialog, use it directly (skip for birthday events unless not found above)
    if (!eventInfo.isBirthdayEvent || !originalEvent) {
      if (eventInfo.calendarId && validateCalendarId(eventInfo.calendarId)) {
        console.log('Using extracted calendar ID');
        
        try {
          // Try using the full event ID as-is first
          const response1 = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(eventInfo.calendarId)}/events/${encodeURIComponent(eventInfo.eventId)}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (response1.ok) {
            originalEvent = await response1.json();
            foundInCalendar = eventInfo.calendarId;
            console.log('Found event using extracted calendar ID');
          } else if (eventInfo.eventId.includes(' ')) {
            // Try parsing the event ID
            const eventPart = eventInfo.eventId.split(' ')[0];
            const response2 = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(eventInfo.calendarId)}/events/${encodeURIComponent(eventPart)}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });
            
            if (response2.ok) {
              originalEvent = await response2.json();
              foundInCalendar = eventInfo.calendarId;
              console.log('Found event with parsed ID using extracted calendar ID');
            }
          }
        } catch (error) {
          console.log('Error searching extracted calendar:', error.message);
        }
      }
      // If we have calendar name but no ID, try to find it in cache first
      else if (eventInfo.calendarName) {
        console.log('Looking for calendar by name');
        
        // Try cache first for smart lookup
        let targetCalendar = calendarCache.findByName(eventInfo.calendarName);
        
        if (!targetCalendar) {
          console.log('Calendar name not found in cache, refreshing cache...');
          // Cache miss - refresh calendar list and try again
          allCalendars = await getAllCalendarList(true); // Force refresh
          targetCalendar = calendarCache.findByName(eventInfo.calendarName);
        }
        
        if (targetCalendar && validateCalendarId(targetCalendar.id)) {
          console.log('Found target calendar by name');
          
          try {
            // Try using the full event ID as-is first
            const response1 = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar.id)}/events/${encodeURIComponent(eventInfo.eventId)}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });
            
            if (response1.ok) {
              originalEvent = await response1.json();
              foundInCalendar = targetCalendar.id;
              console.log('Found event in target calendar');
            } else if (eventInfo.eventId.includes(' ')) {
              // Try parsing the event ID
              const eventPart = eventInfo.eventId.split(' ')[0];
              const response2 = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar.id)}/events/${encodeURIComponent(eventPart)}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json'
                }
              });
              
              if (response2.ok) {
                originalEvent = await response2.json();
                foundInCalendar = targetCalendar.id;
                console.log('Found event with parsed ID in target calendar');
              }
            }
          } catch (error) {
            console.log('Error searching target calendar:', error.message);
          }
        } else {
          console.log('Could not find calendar with specified name even after cache refresh');
        }
      }
      
      // If we still didn't find it, search all calendars as last resort
      if (!originalEvent) {
        console.log('Last resort: searching all calendars...');
        
        // Ensure we have all calendars loaded
        if (!allCalendars) {
          allCalendars = calendarCache.getAllCalendars();
          if (!allCalendars) {
            console.log('Cache miss - fetching all calendars for fallback search');
            allCalendars = await getAllCalendarList();
          }
        }
        
        for (const calendar of allCalendars) {
          console.log('Searching in calendar...');
          
          // Skip invalid calendar IDs
          if (!validateCalendarId(calendar.id)) {
            console.log('Skipping invalid calendar ID');
            continue;
          }
          
          try {
            // Try using the full event ID as-is first
            const response1 = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events/${encodeURIComponent(eventInfo.eventId)}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });
            
            if (response1.ok) {
              originalEvent = await response1.json();
              foundInCalendar = calendar.id;
              console.log('Found event in calendar');
              break;
            }
            
            // If that fails, try parsing the event ID
            if (eventInfo.eventId.includes(' ')) {
              const eventPart = eventInfo.eventId.split(' ')[0];
              const response2 = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events/${encodeURIComponent(eventPart)}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json'
                }
              });
              
              if (response2.ok) {
                originalEvent = await response2.json();
                foundInCalendar = calendar.id;
                console.log('Found event with parsed ID in calendar');
                break;
              }
            }
          } catch (error) {
            console.log('Error searching calendar:', error.message);
            continue;
          }
        }
      }
    } // End of non-birthday event search conditional
    
    if (!originalEvent) {
      throw new Error('Could not find the original event in any accessible calendar');
    }
    
    console.log('Original event found');
    console.log('Event located successfully');
    
    // Create the duplicate event data, copying key fields
    let eventData;
    
    if (eventInfo.isBirthdayEvent) {
      // Special handling for birthday events - they have limited properties
      console.log('Creating duplicate of birthday event with limited properties');
      
      eventData = {
        summary: originalEvent.summary || eventInfo.title || 'Birthday Event',
        description: (originalEvent.description || '') + 
                    (originalEvent.description ? '\n\n' : '') + 
                    '📅 Copied from birthday calendar',
        start: originalEvent.start,
        end: originalEvent.end,
        recurrence: originalEvent.recurrence || ["RRULE:FREQ=YEARLY"]
      };
      
      // Special handling for February 29 birthdays (leap year birthdays)
      if (originalEvent.start?.date?.includes('-02-29')) {
        console.log('Detected February 29 birthday, using special leap year recurrence rule');
        eventData.recurrence = ["RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1"];
      }
      
      console.log('Added yearly recurrence to birthday event');
      
      // Don't copy location from birthday events as it's usually not relevant
      // Birthday events typically don't have meaningful locations
      
    } else {
      // Regular event duplication
      eventData = {
        summary: originalEvent.summary || 'Copied Event',
        description: originalEvent.description || '',
        location: originalEvent.location || '',
        start: originalEvent.start,
        end: originalEvent.end
      };
    }
    
    console.log('Creating duplicate event');
    
    // Validate destination calendar ID
    if (!validateCalendarId(settings.selectedCalendarId)) {
      throw new Error('Invalid destination calendar ID');
    }
    
    // Sanitize event data before sending to API
    const sanitizedEventData = sanitizeEventData(eventData);
    
    // Make API call to create the duplicate event
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(settings.selectedCalendarId)}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sanitizedEventData)
    });
    
    if (!response.ok) {
      // Rate limiting check
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      
      const errorText = await response.text();
      console.error('API error response:', errorText);
      
      // Sanitize error message for user display
      const sanitizedStatus = String(response.status).replace(/[<>"'&]/g, '');
      const sanitizedStatusText = String(response.statusText).replace(/[<>"'&]/g, '');
      throw new Error(`Failed to create event: ${sanitizedStatus} ${sanitizedStatusText}`);
    }
    
    const result = await response.json();
    console.log('Event duplicated successfully');
    
    return result;
    
  } catch (error) {
    console.error('Error duplicating event:', error);
    
    // Log security events
    if (error.message && (error.message.includes('Invalid') || 
                         error.message.includes('validation') ||
                         error.message.includes('format'))) {
      console.warn('Security validation triggered:', error.message);
    }
    
    throw error;
  }
}

// Function to handle logout
async function logout() {
  try {
    console.log('Starting logout process...');
    
    // Get current token before revoking it
    let currentToken = null;
    try {
      // Get token without interactive prompt to avoid new auth
      currentToken = await chrome.identity.getAuthToken({ interactive: false });
      
      // Handle both string and object token formats
      if (typeof currentToken === 'object' && currentToken.token) {
        currentToken = currentToken.token;
      }
    } catch (error) {
      console.log('No current token to revoke:', error.message);
    }
    
    // If we have a token, revoke it with Google
    if (currentToken) {
      console.log('Revoking token with Google...');
      try {
        const revokeResponse = await fetch(`https://oauth2.googleapis.com/revoke?token=${currentToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        
        if (revokeResponse.ok) {
          console.log('Token revoked successfully with Google');
        } else {
          console.warn('Token revocation response:', revokeResponse.status, await revokeResponse.text());
        }
      } catch (error) {
        console.warn('Error revoking token with Google:', error);
      }
    }
    
    // Set logout state to prevent re-authentication
    isLoggedOut = true;
    
    // Invalidate calendar cache on logout
    calendarCache.invalidate();
    
    // Clear all cached auth tokens from Chrome
    await chrome.identity.clearAllCachedAuthTokens();
    console.log('Cleared all cached auth tokens, invalidated calendar cache, and set logout state');
    
    return true;
  } catch (error) {
    console.error('Error during logout:', error);
    throw error;
  }
}