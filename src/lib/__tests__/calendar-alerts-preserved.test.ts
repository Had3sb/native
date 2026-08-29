import { describe, it, expect } from 'vitest';
import { formatReminder, preservedAlerts, remindersToAlerts } from '../calendar-alerts';

describe('preservedAlerts / remindersToAlerts', () => {
  const alerts = {
    a: { trigger: { '@type': 'OffsetTrigger', offset: '-PT15M' }, action: 'display' },
    abs: { trigger: { '@type': 'AbsoluteTrigger', when: '2026-03-01T08:00:00Z' }, action: 'display' },
    end: { trigger: { '@type': 'OffsetTrigger', offset: '-PT5M', relativeTo: 'end' }, action: 'display' },
    mail: { trigger: { '@type': 'OffsetTrigger', offset: '-PT1H' }, action: 'email' },
  };

  it('keeps alerts the picker cannot represent', () => {
    expect(Object.keys(preservedAlerts(alerts)).sort()).toEqual(['abs', 'end', 'mail']);
    expect(preservedAlerts(undefined)).toEqual({});
  });

  it('rebuilds the picker alerts on top of the preserved ones without key clashes', () => {
    const rebuilt = remindersToAlerts([{ minutesBefore: 10 }, { minutesBefore: 0 }], preservedAlerts(alerts))!;
    expect(Object.keys(rebuilt).sort()).toEqual(['abs', 'end', 'mail', 'reminder-1', 'reminder-2']);
    expect(rebuilt['reminder-1'].trigger).toEqual({ '@type': 'OffsetTrigger', offset: '-PT10M', relativeTo: 'start' });
    expect(rebuilt['reminder-2'].trigger.offset).toBe('PT0S');
    expect(rebuilt.abs).toBe(alerts.abs);
  });

  it('returns undefined only when nothing is left', () => {
    expect(remindersToAlerts([], {})).toBeUndefined();
    expect(Object.keys(remindersToAlerts([], preservedAlerts(alerts))!)).toHaveLength(3);
  });
});

describe('formatReminder', () => {
  it('falls back to English plurals', () => {
    expect(formatReminder(0)).toBe('At time of event');
    expect(formatReminder(1)).toBe('1 minute before');
    expect(formatReminder(45)).toBe('45 minutes before');
    expect(formatReminder(120)).toBe('2 hours before');
    expect(formatReminder(60 * 24)).toBe('1 day before');
    expect(formatReminder(60 * 24 * 14)).toBe('2 weeks before');
  });

  it('uses a plain translated string and ignores ICU plural templates it cannot expand', () => {
    const t = (key: string, fallback?: string) =>
      key === 'calendar.alerts.hours_before' ? '# Stunden vorher'
        : key === 'calendar.alerts.minutes_before' ? '{count, plural, one {# minute} other {# minutes}}'
          : fallback ?? key;
    expect(formatReminder(120, t)).toBe('2 Stunden vorher');
    expect(formatReminder(5, t)).toBe('5 minutes before');
  });
});
