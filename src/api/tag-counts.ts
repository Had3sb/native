import { jmapClient } from './jmap-client';
import type { JMAPMethodCall } from './types';

export interface TagCount {
  /** Tag id (the part after `$label:`). */
  id: string;
  total: number;
  unread: number;
}

/**
 * Unread/total counts per tag across every folder of one account — two
 * `Email/query` calls (`calculateTotal`, `limit: 0`) per tag, batched to the
 * server's maxCallsInRequest. Port of the webmail's `fetchTagCounts`
 * (stores/email-store.ts). A tag whose queries fail is reported as 0/0
 * rather than sinking the whole batch.
 */
export async function fetchTagCounts(tagIds: string[], accountIdOverride?: string): Promise<TagCount[]> {
  if (tagIds.length === 0) return [];
  const accountId = accountIdOverride ?? jmapClient.accountId;
  const perRequest = Math.max(2, jmapClient.getMaxCallsInRequest());
  const counts = new Map<string, TagCount>(tagIds.map((id) => [id, { id, total: 0, unread: 0 }]));

  const calls: Array<{ id: string; kind: 'total' | 'unread'; call: JMAPMethodCall }> = [];
  for (const id of tagIds) {
    const keyword = `$label:${id}`;
    calls.push({
      id,
      kind: 'total',
      call: ['Email/query', { accountId, filter: { hasKeyword: keyword }, limit: 0, calculateTotal: true }, `t:${id}`],
    });
    calls.push({
      id,
      kind: 'unread',
      call: ['Email/query', {
        accountId,
        filter: { operator: 'AND', conditions: [{ hasKeyword: keyword }, { notKeyword: '$seen' }] },
        limit: 0,
        calculateTotal: true,
      }, `u:${id}`],
    });
  }

  for (let i = 0; i < calls.length; i += perRequest) {
    const chunk = calls.slice(i, i + perRequest);
    const res = await jmapClient.request(chunk.map((c) => c.call));
    for (const [name, body, callId] of res.methodResponses) {
      if (name !== 'Email/query' || typeof callId !== 'string') continue;
      const [kind, ...rest] = callId.split(':');
      const id = rest.join(':');
      const entry = counts.get(id);
      if (!entry) continue;
      const total = typeof body.total === 'number' ? body.total : 0;
      if (kind === 't') entry.total = total;
      else if (kind === 'u') entry.unread = total;
    }
  }
  return tagIds.map((id) => counts.get(id)!);
}
