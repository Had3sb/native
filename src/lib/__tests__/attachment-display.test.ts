import { describe, it, expect } from 'vitest';
import {
  getAttachmentDisplayName, visibleAttachments, previewKindFor, isReportPart, isRfc822Attachment,
} from '../attachment-display';
import { buildForwardAsAttachmentPayload } from '../forward-as-attachment';
import type { Email } from '../../api/types';

describe('getAttachmentDisplayName', () => {
  it('uses the name, else a MIME-derived label', () => {
    expect(getAttachmentDisplayName('a.pdf', 'application/pdf')).toBe('a.pdf');
    expect(getAttachmentDisplayName(null, 'application/pdf')).toBe('Document.pdf');
    expect(getAttachmentDisplayName(undefined, 'message/rfc822')).toBe('Email.eml');
    expect(getAttachmentDisplayName(undefined, 'application/x-foo')).toBe('Attachment.foo');
    expect(getAttachmentDisplayName(undefined, undefined)).toBe('Attachment');
  });
});

describe('visibleAttachments', () => {
  const email = {
    attachments: [
      { blobId: '1', type: 'image/png', name: 'logo.png', cid: 'logo', disposition: 'inline' },
      { blobId: '2', type: 'image/png', name: 'photo.png', cid: 'photo', disposition: 'attachment' },
      { blobId: '3', type: 'message/disposition-notification', name: undefined },
      { blobId: '4', type: 'text/calendar', name: 'invite.ics' },
      { blobId: '5', type: 'application/ms-tnef', name: 'winmail.dat' },
      { blobId: '6', type: 'application/pdf', name: 'doc.pdf' },
    ],
  };

  it('hides only inline-disposition cid images, report parts, shown calendar parts and unpacked TNEF', () => {
    const shown = visibleAttachments(email, { hideInlineImageAttachments: true, calendarBannerShown: true, tnefUnpacked: true });
    expect(shown.map((a) => a.blobId)).toEqual(['2', '6']);
  });

  it('keeps calendar parts and inline images when asked', () => {
    const shown = visibleAttachments(email, { hideInlineImageAttachments: false, calendarBannerShown: false });
    expect(shown.map((a) => a.blobId)).toEqual(['1', '2', '4', '5', '6']);
  });
});

describe('previewKindFor / classification', () => {
  it('classifies previewable types and refuses script-bearing ones', () => {
    expect(previewKindFor({ type: 'image/jpeg', name: 'a.jpg' })).toBe('image');
    expect(previewKindFor({ type: 'application/pdf', name: 'a.pdf' })).toBe('pdf');
    expect(previewKindFor({ type: 'text/plain', name: 'a.txt' })).toBe('text');
    expect(previewKindFor({ type: 'application/octet-stream', name: 'notes.md' })).toBe('text');
    expect(previewKindFor({ type: 'message/rfc822', name: 'fwd.eml' })).toBe('eml');
    expect(previewKindFor({ type: 'text/html', name: 'a.html' })).toBe('none');
    expect(previewKindFor({ type: 'image/svg+xml', name: 'a.svg' })).toBe('none');
    expect(previewKindFor({ type: 'application/zip', name: 'a.zip' })).toBe('none');
    expect(isReportPart('message/delivery-status')).toBe(true);
    expect(isRfc822Attachment({ type: 'application/octet-stream', name: 'x.eml' })).toBe(true);
  });
});

describe('buildForwardAsAttachmentPayload', () => {
  const email = {
    id: 'e1', threadId: 't1', mailboxIds: {}, keywords: {}, size: 1234,
    receivedAt: '2026-03-04T10:00:00Z', subject: 'Invoice', blobId: 'blob-1', hasAttachment: false,
    from: [{ email: 'a@b.co', name: 'A' }], to: [{ email: 'me@x.co' }],
  } as Email;

  it('references the blob with a {date}-{subject}.eml name and a Fwd: subject', () => {
    const p = buildForwardAsAttachmentPayload(email, 'Fwd:', { template: '{from}-{to}', lowercase: true });
    expect(p?.subject).toBe('Fwd: Invoice');
    expect(p?.attachment).toMatchObject({ blobId: 'blob-1', type: 'message/rfc822', size: 1234 });
    expect(p?.attachment.name).toMatch(/^2026-03-04.*-invoice\.eml$/);
    expect(p?.attachment.name).not.toContain('a@b.co');
  });

  it('returns null without a blob and leaves an empty subject alone', () => {
    expect(buildForwardAsAttachmentPayload({ ...email, blobId: undefined }, 'Fwd:')).toBeNull();
    expect(buildForwardAsAttachmentPayload({ ...email, subject: undefined }, 'Fwd:')?.subject).toBe('');
  });
});
