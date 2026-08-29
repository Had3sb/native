import { describe, it, expect } from 'vitest';
import { formatMessage, pluralCategory } from '../format';

describe('formatMessage', () => {
  it('substitutes simple arguments', () => {
    expect(formatMessage('Hello {name}!', { name: 'Ada' }, 'en')).toBe('Hello Ada!');
    expect(formatMessage('{a} and {b}', { a: 1, b: 'two' }, 'en')).toBe('1 and two');
  });

  it('leaves unknown placeholders untouched so legacy .replace() callers still work', () => {
    expect(formatMessage('Failed to upload {filename}', {}, 'en')).toBe('Failed to upload {filename}');
    expect(formatMessage('Failed to upload {filename}', undefined, 'en')).toBe('Failed to upload {filename}');
    expect(formatMessage('{a} {b}', { a: 'x' }, 'en')).toBe('x {b}');
  });

  it('formats ICU plurals with # substitution', () => {
    const msg = '{count, plural, one {1 email} other {# emails}} selected';
    expect(formatMessage(msg, { count: 1 }, 'en')).toBe('1 email selected');
    expect(formatMessage(msg, { count: 5 }, 'en')).toBe('5 emails selected');
    expect(formatMessage(msg, { count: 0 }, 'en')).toBe('0 emails selected');
  });

  it('prefers exact =N branches', () => {
    const msg = '{count, plural, =0 {No attendees} one {# attendee} other {# attendees}}';
    expect(formatMessage(msg, { count: 0 }, 'en')).toBe('No attendees');
    expect(formatMessage(msg, { count: 1 }, 'en')).toBe('1 attendee');
    expect(formatMessage(msg, { count: 2 }, 'en')).toBe('2 attendees');
  });

  it('uses locale plural rules when available', () => {
    // Russian: 1 → one, 2 → few, 5 → many
    const msg = '{count, plural, one {# письмо} few {# письма} many {# писем} other {# письма}}';
    expect(formatMessage(msg, { count: 1 }, 'ru')).toBe('1 письмо');
    expect(formatMessage(msg, { count: 2 }, 'ru')).toBe('2 письма');
    expect(formatMessage(msg, { count: 5 }, 'ru')).toBe('5 писем');
  });

  it('handles nested arguments inside plural branches', () => {
    const msg = '{count, plural, one {{name} has # item} other {{name} has # items}}';
    expect(formatMessage(msg, { count: 3, name: 'Box' }, 'en')).toBe('Box has 3 items');
  });

  it('accepts numeric strings for plural arguments', () => {
    expect(formatMessage('{n, plural, one {one} other {many}}', { n: '1' }, 'en')).toBe('one');
  });

  it('returns the raw placeholder when a plural argument is missing', () => {
    const msg = '{count, plural, one {a} other {b}}';
    expect(formatMessage(msg, {}, 'en')).toBe(msg);
  });

  it('tolerates unbalanced braces', () => {
    expect(formatMessage('oops {name', { name: 'x' }, 'en')).toBe('oops {name');
  });
});

describe('pluralCategory', () => {
  it('follows English rules', () => {
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(0, 'en')).toBe('other');
    expect(pluralCategory(2, 'en')).toBe('other');
  });

  it('falls back to the English rule for unknown locales', () => {
    expect(pluralCategory(1, 'zz-not-a-locale')).toBe('one');
    expect(pluralCategory(7, 'zz-not-a-locale')).toBe('other');
  });
});
