// Sign-in failures reach the UI as raw strings from the JMAP client — "Session
// discovery failed: 404 Not Found", "Network request failed". Those describe
// what the code was doing, not what the person should do next. This maps the
// ones we can recognise onto copy that names a likely cause and an action.
//
// Errors are matched by `name` and message text rather than `instanceof` so
// this module stays free of the api/ and expo dependency graph.

export interface LoginErrorCopy {
  title: string;
  detail?: string;
}

export interface LoginErrorContext {
  /** Host shown in "can't reach X" copy. */
  serverUrl?: string | null;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : typeof err === 'string' ? err : '';
}

function nameOf(err: unknown): string {
  return err instanceof Error ? err.name : '';
}

function hostLabel(serverUrl: string | null | undefined): string {
  if (!serverUrl) return 'the server';
  const host = serverUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0];
  return host || 'the server';
}

export function describeLoginError(err: unknown, context: LoginErrorContext = {}): LoginErrorCopy {
  const name = nameOf(err);
  const message = messageOf(err);
  const lower = message.toLowerCase();
  const host = hostLabel(context.serverUrl);

  if (name === 'TotpRequiredError' || message === 'TOTP_REQUIRED' || lower.includes('two-factor code required')) {
    return {
      title: 'Enter your two-factor code',
      detail: 'This account is protected with two-factor sign-in. Type the 6-digit code from your authenticator app.',
    };
  }

  if (name === 'TotpLoginError' && lower.includes('invalid')) {
    return {
      title: "That didn't work",
      detail: 'Check your password and the current code from your authenticator app, then try again.',
    };
  }

  if (name === 'RateLimitError' || /\b429\b/.test(message) || lower.includes('rate limited')) {
    const retryMs = (err as { retryAfterMs?: number } | null)?.retryAfterMs;
    const seconds = typeof retryMs === 'number' && Number.isFinite(retryMs) ? Math.max(1, Math.round(retryMs / 1000)) : null;
    return {
      title: 'Too many attempts',
      detail: seconds
        ? `The server asked us to wait. Try again in about ${seconds} seconds.`
        : 'The server asked us to wait a moment. Try again shortly.',
    };
  }

  if (lower.includes('session discovery failed') && /\b402\b/.test(message)) {
    return {
      title: 'Enter your two-factor code',
      detail: 'This account is protected with two-factor sign-in. Type the 6-digit code from your authenticator app.',
    };
  }

  if (name === 'AuthenticationError' || lower.includes('invalid username or password')) {
    return {
      title: "That didn't work",
      detail:
        'Check your email and password. If your account uses two-factor sign-in, create an app password in the webmail and use that here.',
    };
  }

  if (lower.includes('certificate') || lower.includes('ssl') || lower.includes('tls')) {
    return {
      title: `Couldn't verify ${host}`,
      detail:
        "The server's security certificate was rejected. If this is your own server, check the certificate is valid and not expired.",
    };
  }

  // The endpoint answered, but it isn't a JMAP server — almost always a
  // mistyped host or a webmail that lives on a subpath.
  if (lower.includes('session discovery failed') && /\b40[34]\b/.test(message)) {
    return {
      title: `No mail server at ${host}`,
      detail: 'Double-check the address, or scan a sign-in code from the webmail instead.',
    };
  }

  if (
    name === 'NetworkError' ||
    name === 'TypeError' ||
    name === 'AbortError' ||
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout') ||
    lower.includes('timed out')
  ) {
    return {
      title: `Can't reach ${host}`,
      detail: 'Check your connection and the server address, then try again.',
    };
  }

  if (lower.includes('session discovery failed') && /\b5\d\d\b/.test(message)) {
    return {
      title: `${host} is having trouble`,
      detail: 'The server answered with an error. Try again in a few minutes.',
    };
  }

  if (lower.includes('pairing code')) {
    return {
      title: 'That code has expired',
      detail: 'Sign-in codes are good for a few minutes. Generate a fresh one in the webmail and scan again.',
    };
  }

  if (lower.includes('state mismatch')) {
    return {
      title: 'Sign-in was interrupted',
      detail: "The response didn't match the request we started. Try signing in again.",
    };
  }

  if (lower.includes('maximum of') && lower.includes('accounts')) {
    return { title: message };
  }

  // Unrecognised: show what we were told rather than inventing a cause.
  return {
    title: 'Sign-in failed',
    detail: message || 'Something went wrong. Try again.',
  };
}
