// Minimal i18n: lookup keys like `settings.tabs.account` against a nested
// dictionary loaded from ../../locales/<lang>/common.json (vendored from the
// webmail via scripts/sync-locales.mjs), overlaid with RN-only keys from
// ../../locales/rn/<lang>.json. Picks language from the user override
// (locale-store) → device locale → English fallback. Messages support the
// ICU subset in ./format (arguments + plural).
import { I18nManager } from 'react-native';
import { getLocales } from 'expo-localization';
import { formatMessage, type MessageParams } from './format';

import ar from '../../locales/ar/common.json';
import ca from '../../locales/ca/common.json';
import cs from '../../locales/cs/common.json';
import da from '../../locales/da/common.json';
import de from '../../locales/de/common.json';
import en from '../../locales/en/common.json';
import es from '../../locales/es/common.json';
import fa from '../../locales/fa/common.json';
import fr from '../../locales/fr/common.json';
import he from '../../locales/he/common.json';
import hu from '../../locales/hu/common.json';
import it from '../../locales/it/common.json';
import ja from '../../locales/ja/common.json';
import ko from '../../locales/ko/common.json';
import lv from '../../locales/lv/common.json';
import mn from '../../locales/mn/common.json';
import nb from '../../locales/nb/common.json';
import nl from '../../locales/nl/common.json';
import pl from '../../locales/pl/common.json';
import pt from '../../locales/pt/common.json';
import ro from '../../locales/ro/common.json';
import ru from '../../locales/ru/common.json';
import sk from '../../locales/sk/common.json';
import tr from '../../locales/tr/common.json';
import uk from '../../locales/uk/common.json';
import zh from '../../locales/zh/common.json';
import zhTW from '../../locales/zh-TW/common.json';

// Keys the native app needs that the webmail catalog does not carry. Only an
// English overlay exists today; other languages fall through to it via the
// en fallback below.
import rnEn from '../../locales/rn/en.json';

export type { MessageParams } from './format';

// Same order and labels as the webmail language switcher
// (components/ui/language-switcher.tsx).
export const SUPPORTED_LOCALES = [
  { code: 'ar', label: 'العربية' },
  { code: 'ca', label: 'Català' },
  { code: 'cs', label: 'Česky' },
  { code: 'sk', label: 'Slovenčina' },
  { code: 'da', label: 'Dansk' },
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'fa', label: 'فارسی' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'he', label: 'עברית' },
  { code: 'it', label: 'Italiano' },
  { code: 'hu', label: 'Magyar' },
  { code: 'lv', label: 'Latviešu' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'nb', label: 'Norsk bokmål' },
  { code: 'pl', label: 'Polski' },
  { code: 'pt', label: 'Português' },
  { code: 'ro', label: 'Română' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
  { code: 'uk', label: 'Українська' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'mn', label: 'Монгол' },
  { code: 'zh', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文（台灣）' },
] as const;

export type LocaleCode = typeof SUPPORTED_LOCALES[number]['code'];

type Dictionary = Record<string, unknown>;

function deepMerge(base: Dictionary, overlay: Dictionary): Dictionary {
  const out: Dictionary = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    const existing = out[k];
    if (
      v && typeof v === 'object' && !Array.isArray(v)
      && existing && typeof existing === 'object' && !Array.isArray(existing)
    ) {
      out[k] = deepMerge(existing as Dictionary, v as Dictionary);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const RN_OVERLAYS: Partial<Record<LocaleCode, Dictionary>> = {
  en: rnEn as Dictionary,
};

const BASE_DICTIONARIES: Record<LocaleCode, Dictionary> = {
  ar, ca, cs, da, de, en, es, fa, fr, he, hu, it, ja, ko, lv, mn, nb, nl, pl,
  pt, ro, ru, sk, tr, uk, zh, 'zh-TW': zhTW,
};

const dictionaries: Record<LocaleCode, Dictionary> = Object.fromEntries(
  (Object.keys(BASE_DICTIONARIES) as LocaleCode[]).map((code) => {
    const overlay = RN_OVERLAYS[code];
    return [code, overlay ? deepMerge(BASE_DICTIONARIES[code], overlay) : BASE_DICTIONARIES[code]];
  }),
) as Record<LocaleCode, Dictionary>;

// Test/tooling hook: the fully merged catalog for a locale.
export function getDictionary(locale: LocaleCode): Dictionary {
  return dictionaries[locale];
}

export function isSupportedLocale(code: string): code is LocaleCode {
  return (SUPPORTED_LOCALES as readonly { code: string }[]).some((l) => l.code === code);
}

// RTL locales: Arabic, Hebrew and Persian. Mirrors the webmail i18n/direction.ts.
const RTL_LOCALES: ReadonlySet<string> = new Set(['ar', 'he', 'fa']);

export function getLocaleDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

/**
 * Whether the running app is laid out right-to-left. Gesture code that maps
 * "swipe left/right" to actions should swap sides when this is true - RN
 * mirrors flexbox but not the physical direction of a pan.
 */
export function isLayoutRTL(): boolean {
  const manager = I18nManager as typeof I18nManager | undefined;
  return Boolean(manager?.isRTL);
}

/**
 * Map a device locale to a catalog. Traditional Chinese (any `zh-Hant-*`
 * tag, or Taiwan/Hong Kong/Macau regions) resolves to `zh-TW`; every other
 * language matches on the bare language code.
 */
export function resolveLocaleTag(input: {
  languageTag?: string | null;
  languageCode?: string | null;
  languageScriptCode?: string | null;
  regionCode?: string | null;
}): LocaleCode | null {
  const lang = input.languageCode?.toLowerCase() ?? input.languageTag?.split('-')[0]?.toLowerCase();
  if (!lang) return null;
  if (lang === 'zh') {
    const tag = (input.languageTag ?? '').toLowerCase();
    const script = input.languageScriptCode?.toLowerCase();
    const region = input.regionCode?.toUpperCase();
    const traditional =
      script === 'hant'
      || tag.includes('hant')
      || tag.endsWith('-tw') || tag.endsWith('-hk') || tag.endsWith('-mo')
      || region === 'TW' || region === 'HK' || region === 'MO';
    return traditional ? 'zh-TW' : 'zh';
  }
  // Norwegian devices report `no`/`nn` as often as `nb`.
  if (lang === 'no' || lang === 'nn') return 'nb';
  return isSupportedLocale(lang) ? lang : null;
}

export function detectDeviceLocale(): LocaleCode {
  for (const l of getLocales()) {
    const resolved = resolveLocaleTag(l);
    if (resolved) return resolved;
  }
  return 'en';
}

function lookup(dict: Dictionary, key: string): string | undefined {
  let current: unknown = dict;
  for (const part of key.split('.')) {
    if (current && typeof current === 'object' && part in (current as Dictionary)) {
      current = (current as Dictionary)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function translate(
  locale: LocaleCode,
  key: string,
  fallback?: string,
  params?: MessageParams,
): string {
  const message = lookup(dictionaries[locale], key)
    ?? lookup(dictionaries.en, key)
    ?? fallback
    ?? key;
  return formatMessage(message, params, locale);
}
