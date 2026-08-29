import { useSettingsStore, type DebugCategory } from '../stores/settings-store';

// Mirrors the webmail's lib/debug.ts: conditional logging gated on the
// persisted `debugMode` setting and its per-category switches (Settings →
// About & Data → Debug mode). `debug.error` always logs.

function isEnabled(category?: DebugCategory): boolean {
  const state = useSettingsStore.getState();
  if (!state.debugMode) return false;
  if (!category) return true;
  return state.debugCategories?.[category] !== false;
}

const CATEGORY_KEYS = new Set<string>([
  'jmap', 'calendar', 'tasks', 'auth', 'filters', 'email', 'push', 'contacts',
]);

function isCategoryKey(value: unknown): value is DebugCategory {
  return typeof value === 'string' && CATEGORY_KEYS.has(value);
}

/**
 * Usage:
 *   debug.log('push', 'relay registered', id);  // only when the push category is on
 *   debug.log('uncategorised message');         // whenever debugMode is on
 */
export const debug = {
  log: (categoryOrMsg: DebugCategory | unknown, ...args: unknown[]): void => {
    if (isCategoryKey(categoryOrMsg)) {
      if (isEnabled(categoryOrMsg)) console.log(`[DEBUG:${categoryOrMsg}]`, ...args);
    } else if (isEnabled()) {
      console.log('[DEBUG]', categoryOrMsg, ...args);
    }
  },

  warn: (categoryOrMsg: DebugCategory | unknown, ...args: unknown[]): void => {
    if (isCategoryKey(categoryOrMsg)) {
      if (isEnabled(categoryOrMsg)) console.warn(`[DEBUG:${categoryOrMsg}]`, ...args);
    } else if (isEnabled()) {
      console.warn('[DEBUG]', categoryOrMsg, ...args);
    }
  },

  error: (...args: unknown[]): void => {
    console.error('[ERROR]', ...args);
  },

  time: (label: string, category?: DebugCategory): void => {
    if (isEnabled(category)) console.time(`[DEBUG${category ? ':' + category : ''}] ${label}`);
  },

  timeEnd: (label: string, category?: DebugCategory): void => {
    if (isEnabled(category)) console.timeEnd(`[DEBUG${category ? ':' + category : ''}] ${label}`);
  },
};
