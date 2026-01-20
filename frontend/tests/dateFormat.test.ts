/**
 * Tests for dateFormat utility functions.
 */
import { describe, it, expect } from 'vitest';
import { formatDate, formatEventDateTime } from '../src/utils/dateFormat';

describe('formatDate', () => {
  describe('without time', () => {
    it('formats ISO date string correctly', () => {
      const result = formatDate('2024-08-15T14:30:00Z');
      // Note: This will depend on timezone, testing format pattern
      expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    it('formats Date object correctly', () => {
      const date = new Date(2024, 7, 15); // August 15, 2024 (months are 0-indexed)
      const result = formatDate(date);
      expect(result).toBe('15/08/2024');
    });

    it('pads single digit day and month', () => {
      const date = new Date(2024, 0, 5); // January 5, 2024
      const result = formatDate(date);
      expect(result).toBe('05/01/2024');
    });

    it('handles end of year correctly', () => {
      const date = new Date(2024, 11, 31); // December 31, 2024
      const result = formatDate(date);
      expect(result).toBe('31/12/2024');
    });
  });

  describe('with time', () => {
    it('includes time when requested', () => {
      const date = new Date(2024, 7, 15, 14, 30); // 14:30
      const result = formatDate(date, true);
      expect(result).toBe('15/08/2024, 14:30');
    });

    it('pads single digit hours and minutes', () => {
      const date = new Date(2024, 7, 15, 9, 5); // 09:05
      const result = formatDate(date, true);
      expect(result).toBe('15/08/2024, 09:05');
    });

    it('handles midnight correctly', () => {
      const date = new Date(2024, 7, 15, 0, 0);
      const result = formatDate(date, true);
      expect(result).toBe('15/08/2024, 00:00');
    });

    it('handles noon correctly', () => {
      const date = new Date(2024, 7, 15, 12, 0);
      const result = formatDate(date, true);
      expect(result).toBe('15/08/2024, 12:00');
    });

    it('handles 23:59 correctly', () => {
      const date = new Date(2024, 7, 15, 23, 59);
      const result = formatDate(date, true);
      expect(result).toBe('15/08/2024, 23:59');
    });
  });
});

describe('formatEventDateTime', () => {
  it('includes weekday in output', () => {
    // August 15, 2024 is a Thursday
    const date = new Date(2024, 7, 15, 14, 30);
    const result = formatEventDateTime(date.toISOString());
    expect(result).toContain('Thu');
  });

  it('formats Sunday correctly', () => {
    // August 18, 2024 is a Sunday
    const date = new Date(2024, 7, 18, 14, 0);
    const result = formatEventDateTime(date.toISOString());
    expect(result).toContain('Sun');
  });

  it('formats Monday correctly', () => {
    // August 19, 2024 is a Monday
    const date = new Date(2024, 7, 19, 10, 0);
    const result = formatEventDateTime(date.toISOString());
    expect(result).toContain('Mon');
  });

  it('includes date in DD/MM/YYYY format', () => {
    const date = new Date(2024, 7, 15, 14, 30);
    const result = formatEventDateTime(date.toISOString());
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('includes time in HH:MM format', () => {
    const date = new Date(2024, 7, 15, 14, 30);
    const result = formatEventDateTime(date.toISOString());
    expect(result).toMatch(/\d{2}:\d{2}$/);
  });

  it('returns correctly formatted complete string', () => {
    const date = new Date(2024, 7, 15, 14, 30); // Thursday, August 15, 2024
    const result = formatEventDateTime(date.toISOString());
    // Format: "Weekday DD/MM/YYYY, HH:MM"
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/);
  });

  it('handles Friday (Jumuah) correctly', () => {
    // August 16, 2024 is a Friday
    const date = new Date(2024, 7, 16, 12, 30);
    const result = formatEventDateTime(date.toISOString());
    expect(result).toContain('Fri');
  });

  it('all weekdays map correctly', () => {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Start from Sunday, August 18, 2024
    for (let i = 0; i < 7; i++) {
      const date = new Date(2024, 7, 18 + i, 12, 0);
      const result = formatEventDateTime(date.toISOString());
      expect(result).toContain(weekdays[i]);
    }
  });
});
