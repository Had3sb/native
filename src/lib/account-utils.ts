// Registry cap. Raised from 5: the per-account cost is one stored credential
// set and one cached snapshot; the SSE socket budget is bounded separately
// (MAX_SSE_STREAMS), so nothing scales with this number at runtime.
export const MAX_ACCOUNTS = 10;

export function generateAccountId(username: string, serverUrl: string): string {
  let host = serverUrl;
  try {
    host = new URL(serverUrl).hostname;
  } catch {
    host = serverUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
  return `${username}@${host}`;
}
