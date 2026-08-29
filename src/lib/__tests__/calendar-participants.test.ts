import { describe, it, expect } from 'vitest';
import type { CalendarEvent } from '../../api/types';
import {
  buildParticipantMap,
  collectUserCalendarAddresses,
  getParticipantList,
  getStatusCounts,
  getUserParticipantId,
  isOrganizer,
  seedAttendees,
} from '../calendar-participants';

const event: Partial<CalendarEvent> = {
  organizerCalendarAddress: 'mailto:Alice@example.com',
  participants: {
    // Stalwart rebuilds ORGANIZER into a roles-less participant (#731).
    org: { calendarAddress: 'mailto:alice@example.com', name: 'Alice' },
    bob: { email: 'bob@example.com', roles: { attendee: true }, participationStatus: 'accepted' },
    carol: { calendarAddress: 'mailto:carol@example.com', roles: { attendee: true } },
  },
};

describe('buildParticipantMap', () => {
  it('emits an owner-only organizer plus server-scheduled attendees, deduped (#731)', () => {
    const map = buildParticipantMap({ name: 'Alice', email: 'alice@example.com' }, [
      { name: 'Bob', email: 'bob@example.com' },
      { name: 'Alice again', email: 'ALICE@example.com' },
      { name: 'Bob dup', email: 'Bob@example.com' },
    ]);
    const list = Object.values(map);
    expect(list).toHaveLength(2);
    const organizer = list.find((p) => p.roles?.owner)!;
    expect(organizer.roles).toEqual({ owner: true });
    expect(organizer.calendarAddress).toBe('mailto:alice@example.com');
    expect(organizer.scheduleAgent).toBe('server');
    expect(organizer.sendTo).toBeUndefined();
    const bob = list.find((p) => p.email === 'bob@example.com')!;
    expect(bob.roles).toEqual({ attendee: true });
    expect(bob.calendarAddress).toBe('mailto:bob@example.com');
    expect(bob.scheduleAgent).toBe('server');
    expect(bob.expectReply).toBe(true);
    expect(bob.participationStatus).toBe('needs-action');
  });
});

describe('collectUserCalendarAddresses', () => {
  it('merges groups, dedupes case-insensitively and drops blanks', () => {
    expect(
      collectUserCalendarAddresses(['Me@example.com'], ['me@example.com', ' ', null, 'alias@example.com']),
    ).toEqual(['Me@example.com', 'alias@example.com']);
  });
});

describe('organizer / participant detection', () => {
  it('recognises the organizer via organizerCalendarAddress and an alias', () => {
    expect(isOrganizer(event, ['alice@example.com'])).toBe(true);
    expect(isOrganizer(event, ['bob@example.com'])).toBe(false);
    expect(isOrganizer(event, [])).toBe(false);
  });

  it('finds the user participant by calendarAddress', () => {
    expect(getUserParticipantId(event, ['CAROL@example.com'])).toBe('carol');
    expect(getUserParticipantId(event, ['nobody@example.com'])).toBeNull();
  });

  it('marks the roles-less organizer participant as organizer', () => {
    const list = getParticipantList(event);
    expect(list.find((p) => p.id === 'org')?.isOrganizer).toBe(true);
    expect(list.find((p) => p.id === 'bob')?.isOrganizer).toBe(false);
    expect(list.find((p) => p.id === 'carol')?.email).toBe('carol@example.com');
  });

  it('does not count the organizer in status totals', () => {
    expect(getStatusCounts(event)).toEqual({ accepted: 1, declined: 0, tentative: 0, 'needs-action': 1 });
  });
});

describe('seedAttendees', () => {
  it('never seeds the organizer or a repeated address (#731)', () => {
    const attendees = seedAttendees(event, ['alice@example.com']);
    expect(attendees.map((a) => a.email)).toEqual(['bob@example.com', 'carol@example.com']);
  });

  it('round-trips through buildParticipantMap without duplicating the organizer', () => {
    const attendees = seedAttendees(event, ['alice@example.com']);
    const map = buildParticipantMap({ name: 'Alice', email: 'alice@example.com' }, attendees);
    const emails = Object.values(map).map((p) => p.email?.toLowerCase());
    expect(emails.filter((e) => e === 'alice@example.com')).toHaveLength(1);
    expect(emails).toHaveLength(3);
  });
});
