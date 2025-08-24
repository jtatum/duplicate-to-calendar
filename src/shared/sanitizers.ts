// Shared sanitization functions for the Google Calendar Event Duplicator

import { CalendarEvent, EventDateTime } from './types.js';
import { VALIDATION_LIMITS } from './constants.js';

/**
 * Sanitizes text for safe display and API usage
 */
export function sanitizeText(text: unknown): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove HTML tags and encode dangerous characters
  // IMPORTANT: & must be replaced first to avoid double-encoding
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, VALIDATION_LIMITS.SANITIZED_TEXT_MAX_LENGTH);
}

/**
 * Sanitizes text for DOM insertion (removes HTML but allows safe characters)
 */
export function sanitizeForDOM(text: unknown): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove HTML tags but don't encode characters like & since DOM insertion is safe
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove all other HTML tags
    .trim()
    .substring(0, VALIDATION_LIMITS.SANITIZED_TEXT_MAX_LENGTH);
}

/**
 * Sanitizes and truncates event summary
 */
export function sanitizeEventSummary(summary: unknown): string | undefined {
  if (!summary || typeof summary !== 'string') {
    return undefined;
  }
  
  const sanitized = sanitizeText(summary);
  return sanitized.substring(0, VALIDATION_LIMITS.SUMMARY_MAX_LENGTH) || undefined;
}

/**
 * Sanitizes and truncates event description
 */
export function sanitizeEventDescription(description: unknown): string | undefined {
  if (!description || typeof description !== 'string') {
    return undefined;
  }
  
  const sanitized = sanitizeText(description);
  return sanitized.substring(0, VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH) || undefined;
}

/**
 * Sanitizes and truncates event location
 */
export function sanitizeEventLocation(location: unknown): string | undefined {
  if (!location || typeof location !== 'string') {
    return undefined;
  }
  
  const sanitized = sanitizeText(location);
  return sanitized.substring(0, VALIDATION_LIMITS.LOCATION_MAX_LENGTH) || undefined;
}

/**
 * Sanitizes calendar ID (basic validation and encoding)
 */
export function sanitizeCalendarId(calendarId: unknown): string | undefined {
  if (!calendarId || typeof calendarId !== 'string') {
    return undefined;
  }
  
  // Remove HTML tags and potentially dangerous characters
  const cleaned = calendarId
    .replace(/<[^>]*>/g, '') // Remove HTML tags like <script>
    .replace(/[>"'&\\]/g, ''); // Remove remaining dangerous characters
  
  // Validate length
  if (cleaned.length === 0 || cleaned.length > VALIDATION_LIMITS.CALENDAR_ID_MAX_LENGTH) {
    return undefined;
  }
  
  return cleaned;
}

/**
 * Sanitizes event ID
 */
export function sanitizeEventId(eventId: unknown): string | undefined {
  if (!eventId || typeof eventId !== 'string') {
    return undefined;
  }
  
  // Remove HTML tags and potentially dangerous characters
  const cleaned = eventId
    .replace(/<[^>]*>/g, '') // Remove HTML tags like <script>
    .replace(/[>"'&\\]/g, ''); // Remove remaining dangerous characters
  
  // Validate length
  if (cleaned.length === 0 || cleaned.length > VALIDATION_LIMITS.EVENT_ID_MAX_LENGTH) {
    return undefined;
  }
  
  return cleaned;
}

/**
 * Sanitizes an entire event object for API submission
 */
export function sanitizeEventData(eventData: Partial<CalendarEvent>): Partial<CalendarEvent> {
  const sanitized: Partial<CalendarEvent> = {};
  
  // Sanitize summary (title)
  if (eventData.summary !== undefined) {
    const sanitizedSummary = sanitizeEventSummary(eventData.summary);
    if (sanitizedSummary) {
      sanitized.summary = sanitizedSummary;
    }
  }
  
  // Sanitize description
  if (eventData.description !== undefined) {
    const sanitizedDescription = sanitizeEventDescription(eventData.description);
    if (sanitizedDescription) {
      sanitized.description = sanitizedDescription;
    }
  }
  
  // Sanitize location
  if (eventData.location !== undefined) {
    const sanitizedLocation = sanitizeEventLocation(eventData.location);
    if (sanitizedLocation) {
      sanitized.location = sanitizedLocation;
    }
  }
  
  // Sanitize time fields if they exist and are objects using sanitizeEventDateTime
  if (eventData.start && typeof eventData.start === 'object') {
    sanitized.start = sanitizeEventDateTime(eventData.start);
  }

  if (eventData.end && typeof eventData.end === 'object') {
    sanitized.end = sanitizeEventDateTime(eventData.end);
  }
  
  // Copy recurrence if it exists and is an array
  if (eventData.recurrence && Array.isArray(eventData.recurrence)) {
    sanitized.recurrence = eventData.recurrence.map(rule => sanitizeText(rule)).filter(rule => rule);
  }
  
  return sanitized;
}

/**
 * Sanitizes EventDateTime object
 */
export function sanitizeEventDateTime(dateTime: EventDateTime): EventDateTime {
  const sanitized: EventDateTime = {};
  
  if (dateTime.date && typeof dateTime.date === 'string') {
    // Validate and clean date format (YYYY-MM-DD)
    const dateMatch = dateTime.date.match(/^\d{4}-\d{2}-\d{2}$/);
    if (dateMatch) {
      sanitized.date = dateMatch[0];
    }
  }
  
  if (dateTime.dateTime && typeof dateTime.dateTime === 'string') {
    // For dateTime, we trust the API format but clean up any extra whitespace
    sanitized.dateTime = dateTime.dateTime.trim();
  }
  
  if (dateTime.timeZone && typeof dateTime.timeZone === 'string') {
    // Clean up timezone string
    sanitized.timeZone = dateTime.timeZone.trim();
  }
  
  return sanitized;
}

/**
 * Sanitizes error messages for user display
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) {
    return 'Unknown error occurred';
  }
  
  let message: string;
  
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = String(error);
  }
  
  // Remove potentially sensitive information
  message = message
    .replace(/\bya29\.[A-Za-z0-9\-._~]+/g, '[TOKEN]') // Replace Google access tokens
    .replace(/\b[A-Za-z0-9+/]{20,}\b/g, '[TOKEN]') // Replace other potential tokens
    .replace(/\b\w+@\w+\.\w+\b/g, '[EMAIL]') // Replace email addresses
    .replace(/\bhttps?:\/\/[^\s]+/g, '[URL]') // Replace URLs
  
  return sanitizeText(message);
}

/**
 * Sanitizes HTTP status and status text for error reporting
 */
export function sanitizeHttpStatus(status: unknown, statusText?: unknown): string {
  let sanitizedStatus: string;
  
  if (typeof status === 'number') {
    sanitizedStatus = String(status);
  } else if (typeof status === 'string') {
    // Extract numeric status from string like "400<script>"
    const match = status.match(/^\d+/);
    sanitizedStatus = match ? match[0] : 'Unknown';
  } else {
    sanitizedStatus = 'Unknown';
  }
    
  const sanitizedStatusText = typeof statusText === 'string' ? 
    statusText.replace(/[<>"'&]/g, '') : 
    '';
    
  return `${sanitizedStatus} ${sanitizedStatusText}`.trim();
}

/**
 * Removes "Description:" prefix from description text if present
 */
export function cleanDescriptionPrefix(description: string): string {
  if (!description || typeof description !== 'string') {
    return '';
  }
  
  // Remove common prefixes
  const prefixes = ['Description:', 'Desc:', 'Details:'];
  
  for (const prefix of prefixes) {
    if (description.startsWith(prefix)) {
      return description.substring(prefix.length).trim();
    }
  }
  
  return description;
}

/**
 * Removes "Organizer:" prefix from organizer text if present
 */
export function cleanOrganizerPrefix(organizer: string): string {
  if (!organizer || typeof organizer !== 'string') {
    return '';
  }
  
  if (organizer.startsWith('Organizer:')) {
    return organizer.substring('Organizer:'.length).trim();
  }
  
  return organizer;
}

/**
 * Sanitizes a data-text attribute value from DOM (typically calendar info)
 */
export function sanitizeDataText(dataText: unknown): string {
  if (!dataText || typeof dataText !== 'string') {
    return '';
  }
  
  // Remove HTML entities and dangerous characters
  return dataText
    .replace(/&[#\w]+;/g, '') // Remove HTML entities
    .replace(/[<>"'&\\]/g, '') // Remove dangerous chars
    .trim()
    .substring(0, VALIDATION_LIMITS.SANITIZED_TEXT_MAX_LENGTH);
}

/**
 * Parses and sanitizes calendar name and ID from data-text format
 * Expected format: "Calendar Name – calendar.id@domain.com"
 */
export function parseCalendarDataText(dataText: string): { name?: string; id?: string } {
  const sanitized = sanitizeDataText(dataText);
  if (!sanitized) {
    return {};
  }
  
  // Parse "Calendar Name – calendar.id@domain.com" format
  const match = sanitized.match(/^(.+?)\s*–\s*(.+)$/);
  if (match) {
    const sanitizedId = sanitizeCalendarId(match[2]?.trim());
    return {
      name: sanitizeText(match[1]?.trim()),
      ...(sanitizedId && { id: sanitizedId }),
    };
  }
  
  return {};
}