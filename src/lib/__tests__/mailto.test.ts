import { describe, it, expect } from 'vitest';
import { parseMailtoUrl } from '../mailto';

describe('parseMailtoUrl', () => {
  it('parses recipients, subject and body', () => {
    expect(parseMailtoUrl('mailto:a@b.co?subject=Hi%20there&body=Line%201%0ALine%202')).toEqual({
      to: ['a@b.co'],
      cc: [],
      bcc: [],
      subject: 'Hi there',
      body: 'Line 1\nLine 2',
    });
  });

  it('accepts multiple recipients, to= in the query and cc/bcc', () => {
    const parsed = parseMailtoUrl('mailto:a@b.co,c@d.co?to=e@f.co&cc=g@h.co&bcc=i@j.co');
    expect(parsed?.to).toEqual(['a@b.co', 'c@d.co', 'e@f.co']);
    expect(parsed?.cc).toEqual(['g@h.co']);
    expect(parsed?.bcc).toEqual(['i@j.co']);
  });

  it('drops invalid addresses and returns null when none remain', () => {
    expect(parseMailtoUrl('mailto:not-an-address')).toBeNull();
    expect(parseMailtoUrl('mailto:?subject=x')).toBeNull();
    expect(parseMailtoUrl('https://example.com')).toBeNull();
    expect(parseMailtoUrl('')).toBeNull();
  });

  it('is case-insensitive on the scheme and decodes + as space', () => {
    expect(parseMailtoUrl('MAILTO:a@b.co?subject=a+b')?.subject).toBe('a b');
  });
});
