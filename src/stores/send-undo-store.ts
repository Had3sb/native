// A message sent with the undo-send delay: the submission is held by the
// server (HOLDFOR) and can still be cancelled or released early. The composer
// records it here after a delayed send; the UndoSnackbar on the mail list
// offers "Undo" / "Send now" for the length of the window (webmail
// `pendingUndoSend`, changelog 1.7.0).

import { create } from 'zustand';
import { cancelScheduledSend, rescheduleScheduledSend } from '../api/email';
import type { EmailAddress } from '../api/types';

export interface PendingUndoSend {
  emailSubmissionId: string;
  emailId: string;
  identityId: string;
  from?: EmailAddress[];
  to?: EmailAddress[];
  /** ISO time the server will release the message. */
  sendAt?: string;
  /** Milliseconds the message is held (drives the snackbar timer). */
  delaySeconds: number;
  createdAt: number;
}

interface SendUndoState {
  pending: PendingUndoSend | null;
  busy: boolean;
  /** Set after an undo so the composer can be reopened with the draft. */
  restoredEmailId: string | null;
  setPending: (entry: PendingUndoSend) => void;
  clear: () => void;
  /** Cancel delivery. The message stays in Sent; the caller may re-open it. */
  undo: () => Promise<boolean>;
  /** Release the held message immediately. */
  sendNow: () => Promise<boolean>;
}

export const useSendUndoStore = create<SendUndoState>((set, get) => ({
  pending: null,
  busy: false,
  restoredEmailId: null,

  setPending: (entry) => set({ pending: entry, restoredEmailId: null }),
  clear: () => set({ pending: null, busy: false }),

  undo: async () => {
    const entry = get().pending;
    if (!entry || get().busy) return false;
    set({ busy: true });
    try {
      await cancelScheduledSend(entry.emailSubmissionId);
      set({ pending: null, busy: false, restoredEmailId: entry.emailId });
      return true;
    } catch (err) {
      console.warn('[send-undo] cancel failed', err);
      set({ busy: false });
      return false;
    }
  },

  sendNow: async () => {
    const entry = get().pending;
    if (!entry || get().busy) return false;
    set({ busy: true });
    try {
      await rescheduleScheduledSend(
        {
          emailSubmissionId: entry.emailSubmissionId,
          emailId: entry.emailId,
          identityId: entry.identityId,
          from: entry.from,
          to: entry.to,
        },
        0,
      );
      set({ pending: null, busy: false });
      return true;
    } catch (err) {
      console.warn('[send-undo] send now failed', err);
      set({ busy: false });
      return false;
    }
  },
}));
