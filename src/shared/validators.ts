// Shared validation functions for the Google Calendar Event Duplicator

import { ValidationResult, ValidationError } from './types.js';
import { VALIDATION_LIMITS, REGEX_PATTERNS } from './constants.js';

/**
 * Validates a calendar ID format and content
 */
export function validateCalendarId(calendarId: unknown): calendarId is string {
  if (!calendarId || typeof calendarId !== 'string') {
    return false;
  }
  
  // Calendar IDs should be reasonable length (RFC 5321 email limit)
  if (calendarId.length > VALIDATION_LIMITS.CALENDAR_ID_MAX_LENGTH || calendarId.length === 0) {
    return false;
  }
  
  // Basic format check - should contain @ unless it's 'primary'
  if (calendarId === 'primary') {
    return true;
  }
  
  // Should be email-like format
  return REGEX_PATTERNS.EMAIL.test(calendarId);
}

/**
 * Validates an event ID format and content
 */
export function validateEventId(eventId: unknown): eventId is string {
  if (!eventId || typeof eventId !== 'string') {
    return false;
  }
  
  // Event IDs should be reasonable length
  if (eventId.length > VALIDATION_LIMITS.EVENT_ID_MAX_LENGTH || eventId.length === 0) {
    return false;
  }
  
  // Should not contain dangerous characters
  if (REGEX_PATTERNS.DANGEROUS_CHARS.test(eventId)) {
    return false;
  }
  
  return true;
}

/**
 * Validates a Google OAuth access token format
 */
export function validateAccessToken(token: unknown): token is string {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Google access tokens should start with 'ya29.' and be reasonable length
  if (!token.startsWith('ya29.') || token.length < 20 || token.length > 2048) {
    return false;
  }
  
  // Should match expected token format
  return REGEX_PATTERNS.GOOGLE_ACCESS_TOKEN.test(token);
}

/**
 * Validates event summary/title
 */
export function validateEventSummary(summary: unknown): ValidationResult {
  if (summary === null || summary === undefined) {
    return { isValid: true }; // Optional field
  }
  
  if (typeof summary !== 'string') {
    return { 
      isValid: false, 
      error: 'Event summary must be a string' 
    };
  }
  
  if (summary.length > VALIDATION_LIMITS.SUMMARY_MAX_LENGTH) {
    return { 
      isValid: false, 
      error: `Event summary exceeds maximum length of ${VALIDATION_LIMITS.SUMMARY_MAX_LENGTH} characters` 
    };
  }
  
  return { isValid: true };
}

/**
 * Validates event description
 */
export function validateEventDescription(description: unknown): ValidationResult {
  if (description === null || description === undefined) {
    return { isValid: true }; // Optional field
  }
  
  if (typeof description !== 'string') {
    return { 
      isValid: false, 
      error: 'Event description must be a string' 
    };
  }
  
  if (description.length > VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH) {
    return { 
      isValid: false, 
      error: `Event description exceeds maximum length of ${VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH} characters` 
    };
  }
  
  return { isValid: true };
}

/**
 * Validates event location
 */
export function validateEventLocation(location: unknown): ValidationResult {
  if (location === null || location === undefined) {
    return { isValid: true }; // Optional field
  }
  
  if (typeof location !== 'string') {
    return { 
      isValid: false, 
      error: 'Event location must be a string' 
    };
  }
  
  if (location.length > VALIDATION_LIMITS.LOCATION_MAX_LENGTH) {
    return { 
      isValid: false, 
      error: `Event location exceeds maximum length of ${VALIDATION_LIMITS.LOCATION_MAX_LENGTH} characters` 
    };
  }
  
  return { isValid: true };
}

/**
 * Validates EventDateTime object structure
 */
export function validateEventDateTime(dateTime: unknown): ValidationResult {
  if (!dateTime || typeof dateTime !== 'object') {
    return { 
      isValid: false, 
      error: 'EventDateTime must be an object' 
    };
  }
  
  const dt = dateTime as Record<string, unknown>;
  
  // Must have either 'date' or 'dateTime' property
  if (!dt.date && !dt.dateTime) {
    return { 
      isValid: false, 
      error: 'EventDateTime must have either date or dateTime property' 
    };
  }
  
  // Should not have both date and dateTime
  if (dt.date && dt.dateTime) {
    return { 
      isValid: false, 
      error: 'EventDateTime cannot have both date and dateTime properties' 
    };
  }
  
  // Validate date format (YYYY-MM-DD) if present
  if (dt.date && typeof dt.date === 'string') {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dt.date)) {
      return { 
        isValid: false, 
        error: 'Date must be in YYYY-MM-DD format' 
      };
    }
    
    // Validate that the date is actually valid (not like 2023-13-40)
    const testDate = new Date(dt.date + 'T00:00:00Z');
    const [year, month, day] = dt.date.split('-').map(Number);
    if (testDate.getUTCFullYear() !== year || 
        testDate.getUTCMonth() + 1 !== month || 
        testDate.getUTCDate() !== day) {
      return { 
        isValid: false, 
        error: 'Date contains invalid values' 
      };
    }
  }
  
  // Validate dateTime format (RFC3339) if present
  if (dt.dateTime && typeof dt.dateTime === 'string') {
    try {
      new Date(dt.dateTime);
    } catch {
      return { 
        isValid: false, 
        error: 'DateTime must be a valid RFC3339 timestamp' 
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Validates a complete event object for duplication
 */
export function validateEventForDuplication(event: unknown): ValidationResult {
  if (!event || typeof event !== 'object') {
    return { 
      isValid: false, 
      error: 'Event must be an object' 
    };
  }
  
  const evt = event as Record<string, unknown>;
  
  // Validate required fields
  if (!evt.start) {
    return { 
      isValid: false, 
      error: 'Event must have a start time' 
    };
  }
  
  if (!evt.end) {
    return { 
      isValid: false, 
      error: 'Event must have an end time' 
    };
  }
  
  // Validate start time
  const startValidation = validateEventDateTime(evt.start);
  if (!startValidation.isValid) {
    return { 
      isValid: false, 
      error: `Invalid start time: ${startValidation.error}` 
    };
  }
  
  // Validate end time
  const endValidation = validateEventDateTime(evt.end);
  if (!endValidation.isValid) {
    return { 
      isValid: false, 
      error: `Invalid end time: ${endValidation.error}` 
    };
  }
  
  // Validate optional fields
  const summaryValidation = validateEventSummary(evt.summary);
  if (!summaryValidation.isValid) {
    return summaryValidation;
  }
  
  const descriptionValidation = validateEventDescription(evt.description);
  if (!descriptionValidation.isValid) {
    return descriptionValidation;
  }
  
  const locationValidation = validateEventLocation(evt.location);
  if (!locationValidation.isValid) {
    return locationValidation;
  }
  
  return { isValid: true };
}

/**
 * Validates event info extracted from DOM
 */
export function validateEventInfo(eventInfo: unknown): ValidationResult {
  if (!eventInfo || typeof eventInfo !== 'object') {
    return { 
      isValid: false, 
      error: 'Event info must be an object' 
    };
  }
  
  const info = eventInfo as Record<string, unknown>;
  
  // Validate required event ID
  if (!info.eventId || typeof info.eventId !== 'string') {
    return { 
      isValid: false, 
      error: 'Event info must have a valid event ID' 
    };
  }
  
  if (!validateEventId(info.eventId)) {
    return { 
      isValid: false, 
      error: 'Event ID format is invalid' 
    };
  }
  
  // Validate optional calendar ID if present
  if (info.calendarId && !validateCalendarId(info.calendarId)) {
    return { 
      isValid: false, 
      error: 'Calendar ID format is invalid' 
    };
  }
  
  return { isValid: true };
}

/**
 * Validates HTTP status code
 */
export function isSuccessfulHttpStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

/**
 * Validates that a string is safe for DOM insertion (doesn't contain HTML/XSS)
 */
export function validateSafeString(text: unknown): ValidationResult {
  if (text === null || text === undefined) {
    return { isValid: true }; // null/undefined is safe
  }
  
  if (typeof text !== 'string') {
    return { 
      isValid: false, 
      error: 'Text must be a string' 
    };
  }
  
  // Check for HTML tags or dangerous characters
  if (/<[^>]*>/g.test(text) || REGEX_PATTERNS.DANGEROUS_CHARS.test(text)) {
    return { 
      isValid: false, 
      error: 'Text contains potentially dangerous characters' 
    };
  }
  
  return { isValid: true };
}

/**
 * Type guard for checking if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Creates a ValidationError with the given details
 */
export function createValidationError(message: string, field: string, cause?: unknown): ValidationError {
  return new ValidationError(message, field, cause);
}

/**
 * Throws a ValidationError if the validation result indicates failure
 */
export function throwIfInvalid(result: ValidationResult, field: string): void {
  if (!result.isValid) {
    throw createValidationError(result.error || 'Validation failed', field);
  }
}