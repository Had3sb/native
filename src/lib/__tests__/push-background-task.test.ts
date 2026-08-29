import { describe, it, expect, vi } from 'vitest';

vi.mock('../../api/jmap-client', () => ({
  jmapClient: { accountId: 'jmap-primary', loadAccount: vi.fn(async () => true) },
}));
vi.mock('../../api/email', () => ({
  getEmails: vi.fn(async () => []),
  getMailboxes: vi.fn(async () => []),
  queryEmails: vi.fn(async () => ({ ids: [] })),
}));

import {
  matchAccountsForPush,
  parseRelayPushData,
  selectNotifiableEmails,
} from '../push-background-task';
import type { Email } from '../../api/types';

describe('parseRelayPushData', () => {
  it('decodes the relay FCM data payload (all values are strings)', () => {
    const parsed = parseRelayPushData({
      kind: 'jmap-email-push',
      accountLabel: 'alice',
      accountId: 'a1',
      emailIds: JSON.stringify(['m1', 'm2']),
      changed: JSON.stringify({ a1: { EmailDelivery: 's1' } }),
    });
    expect(parsed).toEqual({
      kind: 'jmap-email-push',
      accountLabel: 'alice',
      jmapAccountId: 'a1',
      emailIds: ['m1', 'm2'],
      changed: { a1: { EmailDelivery: 's1' } },
    });
  });

  it('falls back to the first key of `changed` for the account id', () => {
    const parsed = parseRelayPushData({
      kind: 'jmap-state-change',
      emailIds: '[]',
      changed: JSON.stringify({ a9: { Email: 'x' } }),
    });
    expect(parsed.jmapAccountId).toBe('a9');
    expect(parsed.emailIds).toEqual([]);
  });

  it('tolerates garbage', () => {
    expect(parseRelayPushData(null).emailIds).toEqual([]);
    expect(parseRelayPushData({ emailIds: '{not json' }).emailIds).toEqual([]);
    expect(parseRelayPushData({ kind: 'weird' }).kind).toBeNull();
  });
});

describe('matchAccountsForPush', () => {
  const accounts = ['alice@mail.example.com', 'bob@mail.example.com'];
  const registry = [
    { id: 'alice@mail.example.com', username: 'alice' },
    { id: 'bob@mail.example.com', username: 'bob' },
  ];

  it('matches on the recorded JMAP account id first', () => {
    const payload = parseRelayPushData({ accountId: 'jb', accountLabel: 'alice' });
    expect(matchAccountsForPush(payload, accounts, { 'bob@mail.example.com': 'jb' }, registry))
      .toEqual(['bob@mail.example.com']);
  });

  it('falls back to the relay accountLabel (username)', () => {
    const payload = parseRelayPushData({ accountId: 'unknown', accountLabel: 'alice' });
    expect(matchAccountsForPush(payload, accounts, {}, registry)).toEqual(['alice@mail.example.com']);
  });

  it('checks every account when nothing matches', () => {
    const payload = parseRelayPushData({ accountId: 'unknown', accountLabel: 'carol' });
    expect(matchAccountsForPush(payload, accounts, {}, registry)).toEqual(accounts);
  });
});

describe('selectNotifiableEmails', () => {
  const email = (id: string, keywords: Record<string, boolean> = {}): Email =>
    ({ id, threadId: 't', keywords, mailboxIds: {}, size: 0, receivedAt: '', hasAttachment: false } as Email);

  it('drops read, junk and already-notified messages', () => {
    const out = selectNotifiableEmails(
      [email('a'), email('b', { $seen: true }), email('c', { $junk: true }), email('d')],
      ['d'],
    );
    expect(out.map((e) => e.id)).toEqual(['a']);
  });
});
