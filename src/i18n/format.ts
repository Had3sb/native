// Minimal ICU MessageFormat subset, enough for the webmail catalogs:
//
//   "Hello {name}"                                        → argument
//   "{count, plural, one {# email} other {# emails}}"     → plural
//   "{count, plural, =0 {none} one {one} other {# more}}" → exact matches
//
// next-intl (the webmail) uses the full ICU grammar, but a scan of every
// catalog shows only these two forms in use (no select/number/date), so a
// hand-rolled parser keeps a heavy dependency out of the Hermes bundle.
// Unknown placeholders are left untouched so callers that still do
// `.replace('{x}', …)` on the result keep working.

export type MessageParams = Record<string, string | number | null | undefined>;

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

const pluralRulesCache = new Map<string, Intl.PluralRules | null>();

function pluralRulesFor(locale: string): Intl.PluralRules | null {
  if (pluralRulesCache.has(locale)) return pluralRulesCache.get(locale) ?? null;
  let rules: Intl.PluralRules | null = null;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function') {
      rules = new Intl.PluralRules(locale);
    }
  } catch {
    rules = null;
  }
  pluralRulesCache.set(locale, rules);
  return rules;
}

/**
 * CLDR plural category for `n` in `locale`. Falls back to the English rule
 * (1 → one, everything else → other) when Intl.PluralRules is unavailable
 * (older Hermes builds) or rejects the locale.
 */
export function pluralCategory(n: number, locale: string): PluralCategory {
  const rules = pluralRulesFor(locale);
  if (rules) {
    try {
      return rules.select(n) as PluralCategory;
    } catch {
      // fall through
    }
  }
  return n === 1 ? 'one' : 'other';
}

// Find the index of the `}` that closes the `{` at `open`, honouring nesting.
function findClosingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Parse the `one {…} other {…}` branch list of a plural argument.
function parsePluralBranches(body: string): Map<string, string> {
  const branches = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    if (i >= body.length) break;
    let selector = '';
    while (i < body.length && body[i] !== '{' && !/\s/.test(body[i])) {
      selector += body[i];
      i++;
    }
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] !== '{') break;
    const close = findClosingBrace(body, i);
    if (close === -1) break;
    branches.set(selector, body.slice(i + 1, close));
    i = close + 1;
  }
  return branches;
}

function formatNumber(n: number, locale: string): string {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function') {
      return new Intl.NumberFormat(locale).format(n);
    }
  } catch {
    // fall through
  }
  return String(n);
}

function selectPluralBranch(
  branches: Map<string, string>,
  n: number,
  locale: string,
): string | undefined {
  const exact = branches.get(`=${n}`);
  if (exact !== undefined) return exact;
  const category = pluralCategory(n, locale);
  return branches.get(category) ?? branches.get('other');
}

/**
 * Substitute `{name}` and `{count, plural, …}` arguments in `message`.
 * Placeholders whose argument is not in `params` are returned verbatim.
 */
export function formatMessage(
  message: string,
  params: MessageParams | undefined,
  locale: string,
): string {
  if (!params || message.indexOf('{') === -1) return message;

  let out = '';
  let i = 0;
  while (i < message.length) {
    const open = message.indexOf('{', i);
    if (open === -1) {
      out += message.slice(i);
      break;
    }
    const close = findClosingBrace(message, open);
    if (close === -1) {
      out += message.slice(i);
      break;
    }
    out += message.slice(i, open);
    const inner = message.slice(open + 1, close);
    const raw = message.slice(open, close + 1);
    const comma = inner.indexOf(',');

    if (comma === -1) {
      const name = inner.trim();
      const value = params[name];
      out += value === undefined || value === null ? raw : String(value);
    } else {
      const name = inner.slice(0, comma).trim();
      const rest = inner.slice(comma + 1);
      const comma2 = rest.indexOf(',');
      const type = (comma2 === -1 ? rest : rest.slice(0, comma2)).trim();
      const value = params[name];
      if (type === 'plural' && comma2 !== -1 && value !== undefined && value !== null) {
        const n = typeof value === 'number' ? value : Number(value);
        const branches = parsePluralBranches(rest.slice(comma2 + 1));
        const branch = selectPluralBranch(branches, n, locale);
        if (branch === undefined) {
          out += raw;
        } else {
          // `#` inside a branch is the formatted number; branches may nest
          // further arguments, so format them recursively.
          out += formatMessage(branch.replace(/#/g, formatNumber(n, locale)), params, locale);
        }
      } else if (value !== undefined && value !== null) {
        // `{name, number}` / unknown types: plain substitution.
        out += String(value);
      } else {
        out += raw;
      }
    }
    i = close + 1;
  }
  return out;
}
