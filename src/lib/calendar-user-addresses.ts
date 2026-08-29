import React from 'react';
import { useAccountStore } from '../stores/account-store';
import { useSettingsStore } from '../stores/settings-store';
import { jmapClient } from '../api/jmap-client';
import { fetchPrincipal } from '../api/account-security';
import { collectUserCalendarAddresses } from './calendar-participants';

// Account aliases come from x:Account/get (Stalwart's principal object) and
// only change when an admin edits the account, so they're fetched once per
// JMAP account and remembered for the session. Failure (older server, no
// permission) simply leaves the list at login address + identities.
const aliasCache = new Map<string, string[]>();
const aliasInFlight = new Map<string, Promise<string[]>>();
const aliasListeners = new Set<() => void>();

function loadAliases(accountId: string): Promise<string[]> {
  const cached = aliasCache.get(accountId);
  if (cached) return Promise.resolve(cached);
  const pending = aliasInFlight.get(accountId);
  if (pending) return pending;
  const p = fetchPrincipal()
    .then((info) => info.emails)
    .catch(() => [] as string[])
    .then((emails) => {
      aliasCache.set(accountId, emails);
      aliasInFlight.delete(accountId);
      for (const l of aliasListeners) l();
      return emails;
    });
  aliasInFlight.set(accountId, p);
  return p;
}

/** Test hook: forget cached aliases (also useful after re-login). */
export function resetUserCalendarAddressCache(): void {
  aliasCache.clear();
  aliasInFlight.clear();
}

/**
 * Every address the signed-in user can be addressed at for scheduling: the
 * login address, the sending identities and the account aliases. Used to
 * find "me" among an event's participants (RSVP), to detect alias-organized
 * events as the user's own, and as the organizer address of new invites.
 */
export function useUserCalendarAddresses(): string[] {
  const activeEmail = useAccountStore((s) => s.getActiveAccount()?.email ?? null);
  const identities = useSettingsStore((s) => s.identities);
  const [, bump] = React.useReducer((n: number) => n + 1, 0);

  const accountId = jmapClient.isConnected ? jmapClient.accountId : null;
  React.useEffect(() => {
    if (!accountId) return;
    if (aliasCache.has(accountId)) return;
    aliasListeners.add(bump);
    void loadAliases(accountId);
    return () => { aliasListeners.delete(bump); };
  }, [accountId]);

  const aliases = accountId ? aliasCache.get(accountId) ?? [] : [];
  return React.useMemo(
    () => collectUserCalendarAddresses(
      [activeEmail],
      identities.map((i) => i.email),
      aliases,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeEmail, identities, aliases.join('|')],
  );
}
