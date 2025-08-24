// Tests for utility functions

import {
  delay,
  retryWithBackoff,
  debounce,
  throttle,
  timeout,
  safeJsonParse,
  deepClone,
  hasProperty,
  formatDate,
  isFebruary29,
  extractErrorMessage,
  containsAny,
  capitalize,
  truncate,
  createId
} from '../../src/shared/utils';

describe('delay', () => {
  it('should delay execution', async () => {
    const start = Date.now();
    await delay(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
  });
});

describe('retryWithBackoff', () => {
  it('should retry failed operations', async () => {
    let attempts = 0;
    const operation = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Failed');
      }
      return 'success';
    });

    const result = await retryWithBackoff(operation, 3, 10);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

    await expect(retryWithBackoff(operation, 2, 10)).rejects.toThrow('Always fails');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe('debounce', () => {
  it('should debounce function calls', () => {
    jest.useFakeTimers();

    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 50);

    debouncedFn('arg1');
    debouncedFn('arg2');
    debouncedFn('arg3');

    // Should not be called yet
    expect(mockFn).not.toHaveBeenCalled();

    jest.runAllTimers();

    // Should be called once with the last arguments
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('arg3');

    jest.useRealTimers();
  });
});

describe('throttle', () => {
  it('should throttle function calls', () => {
    jest.useFakeTimers();

    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 50);

    throttledFn('arg1');
    throttledFn('arg2');
    throttledFn('arg3');

    // Should be called once immediately
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('arg1');

    jest.runAllTimers();

    throttledFn('arg4');

    // Should be called again after the throttle period
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenCalledWith('arg4');

    jest.runAllTimers();
    jest.useRealTimers();
  });
});

describe('timeout', () => {
  it('should resolve when promise resolves quickly', async () => {
    const fastPromise = Promise.resolve('success');
    const result = await timeout(fastPromise, 100);
    expect(result).toBe('success');
  });

  it('should timeout when promise takes too long', async () => {
    const slowPromise = new Promise(resolve => setTimeout(() => resolve('slow'), 200));
    
    await expect(timeout(slowPromise, 50)).rejects.toThrow('Operation timed out after 50ms');
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"key": "value"}')).toEqual({ key: 'value' });
    expect(safeJsonParse('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('should return null for invalid JSON', () => {
    expect(safeJsonParse('invalid json')).toBe(null);
    expect(safeJsonParse('')).toBe(null);
    expect(safeJsonParse('{')).toBe(null);
  });
});

describe('deepClone', () => {
  it('should clone objects deeply', () => {
    const original = {
      a: 1,
      b: { c: 2, d: [3, 4] },
      e: new Date('2023-01-01')
    };

    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
    expect(cloned.b.d).not.toBe(original.b.d);
    expect(cloned.e).not.toBe(original.e);
  });

  it('should handle primitives and null', () => {
    expect(deepClone(null)).toBe(null);
    expect(deepClone(42)).toBe(42);
    expect(deepClone('string')).toBe('string');
  });
});

describe('hasProperty', () => {
  it('should check if object has property', () => {
    const obj = { foo: 'bar', baz: 123 };
    
    expect(hasProperty(obj, 'foo')).toBe(true);
    expect(hasProperty(obj, 'missing')).toBe(false);
  });
});

describe('formatDate', () => {
  it('should format dates as YYYY-MM-DD', () => {
    const date = new Date('2023-12-25T10:30:00Z');
    expect(formatDate(date)).toBe('2023-12-25');
    
    const date2 = new Date('2023-01-01T00:00:00Z');
    expect(formatDate(date2)).toBe('2023-01-01');
  });
});

describe('isFebruary29', () => {
  it('should detect February 29 dates', () => {
    expect(isFebruary29('2023-02-29')).toBe(true);
    expect(isFebruary29('2020-02-29T10:00:00Z')).toBe(true);
    expect(isFebruary29('2023-02-28')).toBe(false);
    expect(isFebruary29('2023-03-01')).toBe(false);
  });
});

describe('extractErrorMessage', () => {
  it('should extract messages from different error types', () => {
    expect(extractErrorMessage(new Error('Test error'))).toBe('Test error');
    expect(extractErrorMessage('String error')).toBe('String error');
    expect(extractErrorMessage({ message: 'Object error' })).toBe('Object error');
    expect(extractErrorMessage(null)).toBe('Unknown error');
    expect(extractErrorMessage(123)).toBe('123');
  });
});

describe('containsAny', () => {
  it('should check if text contains any of the substrings', () => {
    expect(containsAny('Hello World', ['hello', 'foo'])).toBe(true);
    expect(containsAny('Hello World', ['foo', 'bar'])).toBe(false);
    expect(containsAny('Hello World', [])).toBe(false);
  });
});

describe('capitalize', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('WORLD')).toBe('World');
    expect(capitalize('')).toBe('');
  });
});

describe('truncate', () => {
  it('should truncate long text', () => {
    expect(truncate('Hello World', 5)).toBe('He...');
    expect(truncate('Short', 10)).toBe('Short');
    expect(truncate('', 5)).toBe('');
  });
});

describe('createId', () => {
  it('should create unique IDs', () => {
    const id1 = createId();
    const id2 = createId();
    
    expect(typeof id1).toBe('string');
    expect(typeof id2).toBe('string');
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(10);
  });
});