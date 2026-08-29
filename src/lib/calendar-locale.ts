import type { Locale } from 'date-fns';
import {
  ar, ca, cs, da, de, enUS, es, faIR, fr, he, hu, it, ja, ko, lv, mn, nb, nl, pl, pt, ro, ru, sk, tr, uk, zhCN, zhTW,
} from 'date-fns/locale';
import { useLocaleStore } from '../stores/locale-store';
import type { LocaleCode } from '../i18n';

// date-fns locale for each UI language so month/day names, "EEE, MMM d"
// headers and the like render in the user's language (the webmail localizes
// them through next-intl / useFormatEventDate).
const DATE_FNS_LOCALES: Record<LocaleCode, Locale> = {
  en: enUS, ar, ca, cs, da, de, es, fa: faIR, fr, he, hu, it, nl, nb, pl, pt, ro, ru, sk, tr, uk, ja, ko, mn, zh: zhCN, 'zh-TW': zhTW, lv,
};

export function getDateFnsLocale(code: LocaleCode | string | null | undefined): Locale {
  return (code && DATE_FNS_LOCALES[code as LocaleCode]) || enUS;
}

/** `{ locale }` options for date-fns `format()` plus the translate function. */
export function useCalendarLocale(): { locale: Locale; t: (key: string, fallback?: string) => string } {
  const code = useLocaleStore((s) => s.locale);
  const t = useLocaleStore((s) => s.t);
  return { locale: getDateFnsLocale(code), t };
}
