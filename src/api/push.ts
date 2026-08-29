import { jmapClient } from './jmap-client';
import { CAPABILITIES } from './types';
import type { EmailPushConfig, PushSubscription, StateChange } from './types';

export type StateChangeHandler = (change: StateChange) => void;

// ─── PushSubscription (RFC 8620 §7.2) ───────────────────

export async function listPushSubscriptions(): Promise<PushSubscription[]> {
  const res = await jmapClient.request(
    [['PushSubscription/get', { ids: null }, '0']],
    [CAPABILITIES.CORE],
  );
  const [, body] = res.methodResponses[0] ?? [];
  return (body?.list as PushSubscription[]) ?? [];
}

/**
 * Create a PushSubscription pointing the JMAP server at the given relay URL.
 * Returns the server-assigned id (which the client also registers with the
 * relay so the relay can route incoming pushes to an Expo token).
 */
export async function createPushSubscription(params: {
  deviceClientId: string;
  url: string;
  types: string[];
  // ISO date. Servers may clamp to their own ceiling - we send the maximum we
  // want and accept whatever Stalwart returns.
  expires?: string;
  // draft-ietf-jmap-emailpush delivery filter, only when the server advertises
  // urn:ietf:params:jmap:emailpush (see serverSupportsEmailPush).
  emailPush?: Record<string, EmailPushConfig>;
}): Promise<string> {
  const created: Record<string, unknown> = {
    deviceClientId: params.deviceClientId,
    url: params.url,
    types: params.types,
  };
  if (params.expires) created.expires = params.expires;
  if (params.emailPush) created.emailPush = params.emailPush;

  const res = await jmapClient.request(
    [
      [
        'PushSubscription/set',
        { create: { new: created } },
        '0',
      ],
    ],
    [CAPABILITIES.CORE],
  );
  const [, body] = res.methodResponses[0] ?? [];
  const result = body?.created?.new as { id?: string } | undefined;
  if (!result?.id) {
    const notCreated = body?.notCreated?.new;
    throw new Error(
      `PushSubscription/set create failed: ${JSON.stringify(notCreated ?? body)}`,
    );
  }
  return result.id;
}

/**
 * Push the subscription's expiry forward (RFC 8620 §7.2.1). Returns false if
 * the server rejected the update (e.g. the subscription no longer exists),
 * which the caller treats as a signal to recreate.
 */
export async function updatePushSubscription(
  id: string,
  patch: { expires?: string; types?: string[]; emailPush?: Record<string, EmailPushConfig> },
): Promise<boolean> {
  const res = await jmapClient.request(
    [
      [
        'PushSubscription/set',
        { update: { [id]: patch } },
        '0',
      ],
    ],
    [CAPABILITIES.CORE],
  );
  const [, body] = res.methodResponses[0] ?? [];
  if (body?.notUpdated?.[id]) return false;
  return body?.updated?.[id] !== undefined;
}

/**
 * Send the verification code back to the server - the call that flips the
 * subscription from pending to active (RFC 8620 §7.2.2).
 */
export async function verifyPushSubscription(
  id: string,
  verificationCode: string,
): Promise<void> {
  const res = await jmapClient.request(
    [
      [
        'PushSubscription/set',
        { update: { [id]: { verificationCode } } },
        '0',
      ],
    ],
    [CAPABILITIES.CORE],
  );
  const [, body] = res.methodResponses[0] ?? [];
  if (body?.notUpdated?.[id]) {
    throw new Error(
      `PushSubscription verification failed: ${JSON.stringify(body.notUpdated[id])}`,
    );
  }
}

export async function destroyPushSubscription(id: string): Promise<void> {
  await jmapClient.request(
    [['PushSubscription/set', { destroy: [id] }, '0']],
    [CAPABILITIES.CORE],
  );
}

// ─── Live updates ────────────────────────────────────────
// The EventSource lifecycle (reconnect with back-off, fresh bearer on every
// connect, ping watchdog, polling fallback) lives in ./push-stream. These
// re-exports keep the historical entry points.

export {
  startLiveUpdates,
  startPolling,
  type LiveUpdatesHandle,
  type LiveUpdatesOptions,
} from './push-stream';

export interface StartPushOptions {
  onStateChange: StateChangeHandler;
  onError?: (error: Error) => void;
  onFallback?: (reason: string) => void;
  isActive?: () => boolean;
}

/**
 * Start real-time updates, preferring SSE with polling fallback. Resolves to
 * a cleanup function; prefer `startLiveUpdates` when the handle's
 * `reconnect()` is needed (foreground resume).
 */
export async function startPushUpdates(
  _client: unknown,
  opts: StartPushOptions,
): Promise<() => void> {
  const { startLiveUpdates: start } = await import('./push-stream');
  try {
    const handle = await start(opts);
    return () => handle.close();
  } catch (err) {
    opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    return () => undefined;
  }
}
