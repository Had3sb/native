import { CAPABILITIES } from '../api/types';
import { useAuthStore } from '../stores/auth-store';

// When the session is null (cold start, offline restore) we assume features
// are available so they don't flicker off mid-restore. Once the live session
// arrives, the real capability set takes over.
function sessionHasCapability(capability: string): boolean {
  const session = useAuthStore.getState().session;
  if (!session) return true;
  return capability in session.capabilities;
}

export function hasCalendarCapability(): boolean {
  return sessionHasCapability(CAPABILITIES.CALENDARS);
}

export function hasContactsCapability(): boolean {
  return sessionHasCapability(CAPABILITIES.CONTACTS);
}

export function hasFilesCapability(): boolean {
  return sessionHasCapability(CAPABILITIES.FILES);
}

export function useHasCalendar(): boolean {
  return useAuthStore((s) => (s.session ? CAPABILITIES.CALENDARS in s.session.capabilities : true));
}

export function useHasContacts(): boolean {
  return useAuthStore((s) => (s.session ? CAPABILITIES.CONTACTS in s.session.capabilities : true));
}

export function useHasFiles(): boolean {
  return useAuthStore((s) => (s.session ? CAPABILITIES.FILES in s.session.capabilities : true));
}

// Settings tabs for Sieve filters and the vacation responder are gated on the
// same session capabilities api/sieve.ts and api/vacation.ts check, so the
// tab is disabled up front instead of opening onto a "not supported" screen.
export function useHasSieve(): boolean {
  return useAuthStore((s) => (s.session ? CAPABILITIES.SIEVE in s.session.capabilities : true));
}

export function useHasVacation(): boolean {
  return useAuthStore((s) => (s.session ? CAPABILITIES.VACATION in s.session.capabilities : true));
}

