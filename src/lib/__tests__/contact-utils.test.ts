import { describe, it, expect } from 'vitest';
import {
  getContactDisplayName,
  getContactPhotoUri,
  normalizeContactPhotoUri,
  partialDateToString,
  stringToPartialDate,
} from '../contact-utils';
import type { ContactCard } from '../../api/types';

describe('getContactDisplayName', () => {
  it('joins given + surname only, like the webmail', () => {
    const c: ContactCard = {
      id: 'c',
      addressBookIds: {},
      name: { components: [{ kind: 'given', value: 'Jane' }, { kind: 'middle', value: 'Q' }, { kind: 'surname', value: 'Doe' }] },
    };
    expect(getContactDisplayName(c)).toBe('Jane Doe');
  });
});

describe('normalizeContactPhotoUri (#307)', () => {
  it('adds a media type to data URIs that lack one', () => {
    expect(normalizeContactPhotoUri('data:base64,AAAA')).toBe('data:image/jpeg;base64,AAAA');
    expect(normalizeContactPhotoUri('data:;base64,AAAA', 'image/png')).toBe('data:image/png;base64,AAAA');
  });

  it('leaves well-formed URIs alone', () => {
    expect(normalizeContactPhotoUri('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(normalizeContactPhotoUri('https://x/y.jpg')).toBe('https://x/y.jpg');
  });

  it('is applied by getContactPhotoUri', () => {
    const c: ContactCard = { id: 'c', addressBookIds: {}, media: { m: { kind: 'photo', uri: 'data:base64,AAAA' } } };
    expect(getContactPhotoUri(c)).toBe('data:image/jpeg;base64,AAAA');
  });
});

describe('partialDateToString', () => {
  it.each([
    [{ year: 1990, month: 5, day: 4 }, '1990-05-04'],
    [{ year: 1990, month: 5 }, '1990-05'],
    [{ year: 1990 }, '1990'],
    [{ month: 5, day: 4 }, '--05-04'],
    [{ month: 5 }, '--05'],
    [{ day: 4 }, '---04'],
  ])('is lossless for %j', (pd, expected) => {
    expect(partialDateToString(pd)).toBe(expected);
  });

  it('handles timestamps and strings', () => {
    expect(partialDateToString({ '@type': 'Timestamp', utc: '2020-01-02T03:04:05Z' })).toBe('2020-01-02');
    expect(partialDateToString('1999-12-31')).toBe('1999-12-31');
    expect(partialDateToString(undefined)).toBe('');
  });
});

describe('stringToPartialDate', () => {
  it.each([
    ['1990-05-04', { year: 1990, month: 5, day: 4 }],
    ['19900504', { year: 1990, month: 5, day: 4 }],
    ['1990-05-04T00:00:00Z', { year: 1990, month: 5, day: 4 }],
    ['1990-05', { year: 1990, month: 5 }],
    ['1990', { year: 1990 }],
    ['--05-04', { month: 5, day: 4 }],
    ['--0504', { month: 5, day: 4 }],
    ['--05', { month: 5 }],
    ['---04', { day: 4 }],
  ])('parses %s', (input, expected) => {
    expect(stringToPartialDate(input)).toEqual(expected);
  });

  it.each(['May 5', '1990-13-01', 'circa 1800', '', '   '])('rejects %s', (input) => {
    expect(stringToPartialDate(input)).toBeNull();
  });

  it('round-trips through partialDateToString', () => {
    for (const s of ['1990-05-04', '1990-05', '1990', '--05-04', '--05', '---04']) {
      expect(partialDateToString(stringToPartialDate(s)!)).toBe(s);
    }
  });
});
