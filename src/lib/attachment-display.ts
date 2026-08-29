// Attachment-chip helpers for the reader: display names for unnamed parts,
// the parts that are hidden from the chip list, and preview classification.
// Ports of the webmail's `getAttachmentDisplayName`, the attachment filter
// chain in `components/email/email-viewer.tsx` and `lib/file-preview.ts`.

import type { Attachment, Email } from '../api/types';
import { findCalendarAttachment } from './calendar-invitation';

const MIME_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'Document.pdf',
  'application/zip': 'Archive.zip',
  'application/x-zip-compressed': 'Archive.zip',
  'application/gzip': 'Archive.gz',
  'application/x-rar-compressed': 'Archive.rar',
  'application/x-7z-compressed': 'Archive.7z',
  'application/msword': 'Document.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Document.docx',
  'application/vnd.ms-excel': 'Spreadsheet.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Spreadsheet.xlsx',
  'application/vnd.ms-powerpoint': 'Presentation.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Presentation.pptx',
  'text/plain': 'Text.txt',
  'text/html': 'Document.html',
  'text/csv': 'Data.csv',
  'application/json': 'Data.json',
  'application/xml': 'Data.xml',
  'application/octet-stream': 'Attachment',
  'message/rfc822': 'Email.eml',
};

export function getAttachmentDisplayName(name: string | null | undefined, mimeType?: string): string {
  if (name) return name;
  if (mimeType) {
    const base = mimeType.split(';')[0].trim().toLowerCase();
    const label = MIME_TYPE_LABELS[base];
    if (label) return label;
    const sub = base.split('/')[1];
    if (sub) {
      const clean = sub.replace(/^x-/, '').replace(/^vnd\./, '');
      return `Attachment.${clean}`;
    }
  }
  return 'Attachment';
}

const CAL_MIME = new Set(['text/calendar', 'application/ics', 'application/icalendar']);

export function isCalendarMimeType(type?: string | null): boolean {
  if (!type) return false;
  return CAL_MIME.has(type.split(';')[0].trim().toLowerCase());
}

/** Machine-readable report parts (MDN receipts, DSN bounces) - never real attachments. */
export function isReportPart(type?: string | null): boolean {
  const base = (type || '').split(';')[0].trim().toLowerCase();
  return base === 'message/disposition-notification' || base === 'message/delivery-status';
}

export function isRfc822Attachment(att: Pick<Attachment, 'name' | 'type'>): boolean {
  const base = (att.type || '').split(';')[0].trim().toLowerCase();
  return base === 'message/rfc822' || /\.eml$/i.test(att.name || '');
}

export function isTnefAttachment(name?: string | null, type?: string | null): boolean {
  const lowerName = (name || '').toLowerCase();
  const lowerType = (type || '').split(';')[0].trim().toLowerCase();
  return (
    lowerName === 'winmail.dat'
    || lowerType === 'application/ms-tnef'
    || lowerType === 'application/vnd.ms-tnef'
  );
}

export interface VisibleAttachmentOptions {
  hideInlineImageAttachments: boolean;
  /** True when the calendar-invitation banner renders for this message. */
  calendarBannerShown: boolean;
  /** True when a TNEF container was unpacked (its inner files are listed instead). */
  tnefUnpacked?: boolean;
}

/**
 * The attachments that get a chip. Mirrors the webmail filter chain:
 *  - inline cid images are hidden only when their disposition really is
 *    `inline` (an image with a Content-ID but `disposition: attachment` is a
 *    real attachment the body may never reference);
 *  - calendar parts are hidden while the invitation banner shows them;
 *  - MDN/DSN report parts are never listed;
 *  - winmail.dat is hidden once its content was extracted.
 */
export function visibleAttachments(email: Pick<Email, 'attachments'>, opts: VisibleAttachmentOptions): Attachment[] {
  const all = email.attachments ?? [];
  return all.filter((att) => {
    if (isReportPart(att.type)) return false;
    if (opts.calendarBannerShown && isCalendarMimeType(att.type)) return false;
    if (opts.tnefUnpacked && isTnefAttachment(att.name, att.type)) return false;
    if (
      opts.hideInlineImageAttachments
      && att.cid
      && att.disposition === 'inline'
      && (att.type || '').toLowerCase().startsWith('image/')
    ) return false;
    return true;
  });
}

/** Whether the calendar banner will render for this message. */
export function calendarBannerShownFor(email: Pick<Email, 'attachments'>, parsingEnabled: boolean): boolean {
  return parsingEnabled && !!findCalendarAttachment(email);
}

export type PreviewKind = 'image' | 'pdf' | 'text' | 'eml' | 'none';

const TEXT_EXT = /\.(txt|md|markdown|csv|log|json|xml|ics|vcf|yml|yaml|ini|conf|diff|patch)$/i;
// Script-bearing types are never previewed inline (html/svg/js) - webmail lib/file-preview.ts.
const SCRIPT_TYPES = /^(text\/html|image\/svg\+xml|application\/(x-)?javascript|text\/javascript|application\/xhtml\+xml)$/i;

/** How the in-app preview should render a part, if at all. */
export function previewKindFor(att: Pick<Attachment, 'name' | 'type'>): PreviewKind {
  const base = (att.type || '').split(';')[0].trim().toLowerCase();
  const name = att.name || '';
  if (SCRIPT_TYPES.test(base) || /\.(html?|svg|js)$/i.test(name)) return 'none';
  if (isRfc822Attachment(att)) return 'eml';
  if (base.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic|avif)$/i.test(name)) return 'image';
  if (base === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (base.startsWith('text/') || base === 'application/json' || base === 'application/xml' || TEXT_EXT.test(name)) return 'text';
  return 'none';
}

export function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
