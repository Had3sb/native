import type { DateFormat, TimeFormat } from '../stores/settings-store';

/**
 * Formats a received-at date for the email list. Mirrors the webmail
 * `formatDate` helper (lib/utils.ts) so both clients render list dates the
 * same way. The style is controlled by the `dateFormat` user setting:
 *
 *   - `smart` (default) — locale-aware, age-bucketed:
 *       today        → time only          ("15:31" or "3:31 PM")
 *       last 7 days  → short weekday+time ("Fr 15:31", "Fri 3:31 PM")
 *       older        → full locale date   ("28.04.2026", "04/28/2026")
 *   - `relative` — relative format ("1h ago", "2d ago").
 *   - `full` — always the full locale date+time.
 *
 * `locale` is the language subtag from the locale store (e.g. "en", "de").
 */
type Translate = (key: string, fallback?: string, params?: Record<string, string | number>) => string;

// Relative strings ("Just now", "5m ago") through the locale catalog when a
// translate function is supplied; the compact English form otherwise.
function relativeLabel(
  t: Translate | undefined,
  unit: 'minute' | 'hour' | 'day',
  count: number,
): string {
  if (!t) return `${count}${unit[0]} ago`;
  const key = `date.${unit}s_ago${count === 1 ? '' : '_plural'}`;
  return t(key, `${count}${unit[0]} ago`, { count });
}

export function formatListDate(
  date: Date | string,
  opts: { dateFormat: DateFormat; timeFormat: TimeFormat; locale: string; t?: Translate },
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const now = new Date();

  const { dateFormat, timeFormat } = opts;
  const localeRaw = opts.locale;
  const locale = localeRaw && localeRaw.length > 0 ? localeRaw : 'en';
  // `en` alone resolves to en-US in Intl; everything else uses the language
  // subtag as-is and lets the runtime pick a sensible default region.
  const intlLocale = locale === 'en' ? 'en-US' : locale;
  const hour12 = timeFormat === '12h';

  if (dateFormat === 'relative') {
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return opts.t ? opts.t('date.just_now', 'Just now') : 'Just now';
    if (minutes < 60) return relativeLabel(opts.t, 'minute', minutes);
    if (hours < 24) return relativeLabel(opts.t, 'hour', hours);
    if (days < 7) return relativeLabel(opts.t, 'day', days);
    return d.toLocaleDateString(intlLocale, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  if (dateFormat === 'full') {
    return d.toLocaleString(intlLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    });
  }

  // 'smart' (default)
  const timeStr = d.toLocaleTimeString(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });

  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isSameDay) return timeStr;

  const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (daysAgo < 7) {
    // German Intl outputs "Fr." with a trailing dot for `weekday: 'short'`;
    // strip it so the result reads cleanly next to the time.
    const weekday = d
      .toLocaleDateString(intlLocale, { weekday: 'short' })
      .replace(/\.$/, '');
    return `${weekday} ${timeStr}`;
  }

  return d.toLocaleDateString(intlLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
