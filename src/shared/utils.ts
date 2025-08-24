// Shared utility functions for the Google Calendar Event Duplicator

import { RETRY_CONFIG } from './constants.js';

/**
 * Delays execution for the specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = RETRY_CONFIG.MAX_ATTEMPTS,
  initialDelay: number = RETRY_CONFIG.INITIAL_DELAY,
  backoffMultiplier: number = RETRY_CONFIG.BACKOFF_MULTIPLIER
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delayMs = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
      await delay(delayMs);
    }
  }
  
  throw lastError!;
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  waitMs: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  
  return ((...args: Parameters<T>) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      func(...args);
    }, waitMs);
  }) as T;
}

/**
 * Throttles a function call
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limitMs: number
): T {
  let inThrottle: boolean;
  
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limitMs);
    }
  }) as T;
}

/**
 * Creates a promise that resolves after the specified timeout
 */
export function timeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

/**
 * Safely parses JSON with error handling
 */
export function safeJsonParse<T = unknown>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Creates a deep clone of an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Checks if an object has a specific property
 */
export function hasProperty<T extends object, K extends string>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Type-safe way to get a property from an object
 */
export function getProperty<T extends object, K extends keyof T>(
  obj: T,
  prop: K
): T[K] | undefined {
  return hasProperty(obj, prop as string) ? obj[prop] : undefined;
}

/**
 * Formats a date as YYYY-MM-DD in UTC
 */
export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a date is February 29th
 */
export function isFebruary29(dateString: string): boolean {
  return dateString.includes('-02-29');
}

/**
 * Creates a URL with encoded parameters
 */
export function createUrlWithParams(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return url.toString();
}

/**
 * Extracts error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) {
    return 'Unknown error';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (typeof error === 'object' && error !== null) {
    // Try common error message properties
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.message === 'string') {
      return errorObj.message;
    }
    if (typeof errorObj.error === 'string') {
      return errorObj.error;
    }
    if (typeof errorObj.description === 'string') {
      return errorObj.description;
    }
  }
  
  return String(error);
}

/**
 * Checks if a string contains any of the given substrings (case-insensitive)
 */
export function containsAny(text: string, substrings: string[]): boolean {
  const lowerText = text.toLowerCase();
  return substrings.some(substring => lowerText.includes(substring.toLowerCase()));
}

/**
 * Capitalizes the first letter of a string
 */
export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Truncates text to a specified length and adds ellipsis if needed.
 * For very small limits (≤3), returns the substring without an ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  if (maxLength <= 3) {
    return text.substring(0, maxLength);
  }

  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Creates a unique identifier (simple timestamp-based)
 */
export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Checks if we're running in a Chrome extension context
 */
export function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
}

/**
 * Logs a message with timestamp and context
 * In production, only shows warnings and errors (info logs are suppressed)
 */
export function log(level: 'info' | 'warn' | 'error', message: string, context?: object): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  // In production, suppress info logs but keep warnings and errors for debugging
  const isProduction = process.env.NODE_ENV === 'production';
  
  switch (level) {
    case 'info':
      if (!isProduction) {
        console.log(logMessage, context || '');
      }
      break;
    case 'warn':
      console.warn(logMessage, context || '');
      break;
    case 'error':
      console.error(logMessage, context || '');
      break;
  }
}

/**
 * Creates a promise-based wrapper for Chrome extension APIs that use callbacks
 */
export function promisify<T>(
  fn: (callback: (result: T) => void) => void
): Promise<T> {
  return new Promise<T>((resolve) => {
    fn(resolve);
  });
}

/**
 * Creates a promise-based wrapper for Chrome extension APIs that use callbacks with potential errors
 */
export function promisifyWithError<T>(
  fn: (callback: (result?: T) => void) => void
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    fn((result?: T) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result!);
      }
    });
  });
}