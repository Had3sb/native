import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { MailCheck } from 'lucide-react-native';
import type { Email } from '../../api/types';
import { spacing, typography, type ThemePalette } from '../../theme/tokens';
import { useColors } from '../../theme/colors';
import { useLocaleStore } from '../../stores/locale-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useEmailStore } from '../../stores/email-store';
import { sendReadReceipt, patchKeywordsForEmails } from '../../api/email';
import { findReceivingIdentity } from '../../lib/email-headers';
import { mailboxesForSiblingOf } from '../../lib/mailbox-tree';

interface Props {
  email: Email;
  /** Bare address from Disposition-Notification-To. */
  requestedBy: string;
  jmapAccountId?: string;
  /** Role of the folder the message was opened from (receipts only in received folders). */
  currentMailboxRole?: string | null;
  /** Reflect `$mdnsent` in the caller's cache. */
  onHandled: (email: Email) => void;
}

/**
 * Read-receipt (MDN, RFC 8098) request banner: Send / Ignore, or auto-send
 * in "always" mode. Either answer flags the message `$mdnsent` (RFC 3503) so
 * the request is suppressed in every client, not just here. Never offered
 * for the user's own copies, trash or spam.
 */
export function ReadReceiptBanner({ email, requestedBy, jmapAccountId, currentMailboxRole, onHandled }: Props) {
  const c = useColors();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const t = useLocaleStore((s) => s.t);
  const identities = useSettingsStore((s) => s.identities);
  const fetchIdentities = useSettingsStore((s) => s.fetchIdentities);
  const readReceiptResponse = useSettingsStore((s) => s.readReceiptResponse);
  const mailboxes = useEmailStore((s) => s.mailboxes);
  const currentMailboxId = useEmailStore((s) => s.currentMailboxId);
  const [busy, setBusy] = React.useState(false);
  const [handledLocally, setHandledLocally] = React.useState(false);
  const autoRef = React.useRef<string | null>(null);

  React.useEffect(() => { setHandledLocally(false); }, [email.id]);
  React.useEffect(() => { if (identities.length === 0) void fetchIdentities(); }, [identities.length, fetchIdentities]);

  const eligibleFolder = !['sent', 'drafts', 'trash', 'junk', 'spam'].includes(currentMailboxRole || '');
  const identity = React.useMemo(() => findReceivingIdentity(identities, email), [identities, email]);
  const shouldOffer =
    !!requestedBy
    && !email.keywords?.$mdnsent
    && !email.keywords?.$draft
    && !handledLocally
    && readReceiptResponse !== 'never'
    && eligibleFolder
    && !!identity;

  const flagSent = React.useCallback(async () => {
    try {
      await patchKeywordsForEmails([email.id], { $mdnsent: true }, jmapAccountId);
    } catch { /* best effort - the local flag still hides the banner */ }
    onHandled({ ...email, keywords: { ...email.keywords, $mdnsent: true } });
  }, [email, jmapAccountId, onHandled]);

  const send = React.useCallback(async (automatic: boolean) => {
    if (!identity) return;
    const scoped = mailboxesForSiblingOf(mailboxes, currentMailboxId);
    const sent = scoped.find((m) => m.role === 'sent');
    if (!sent) throw new Error(t('email_composer.no_sent_folder', 'No Sent folder found'));
    await sendReadReceipt({
      to: requestedBy,
      fromEmail: identity.email,
      fromName: identity.name,
      identityId: identity.id,
      sentMailboxId: sent.originalId ?? sent.id,
      accountId: jmapAccountId,
      originalMessageId: email.messageId,
      originalSubject: email.subject,
      originalRecipient: identity.email,
      automatic,
      subject: t('email_viewer.read_receipt.mdn_subject', 'Read: {subject}', { subject: email.subject || '' }),
      humanText: t(
        'email_viewer.read_receipt.mdn_body',
        "This is a return receipt for the message you sent to {recipient}.\n\nNote: This receipt only acknowledges that the message was displayed on the recipient's device. There is no guarantee that the recipient has read or understood the message contents.",
        { recipient: identity.email },
      ),
    });
    await flagSent();
  }, [identity, mailboxes, currentMailboxId, requestedBy, jmapAccountId, email.messageId, email.subject, t, flagSent]);

  // "always" mode: auto-send once when the message is opened.
  React.useEffect(() => {
    if (readReceiptResponse !== 'always' || !shouldOffer) return;
    if (autoRef.current === email.id) return;
    autoRef.current = email.id;
    setHandledLocally(true);
    send(true).catch((err) => {
      console.warn('[mdn] auto-send failed', err);
      autoRef.current = null;
    });
  }, [readReceiptResponse, shouldOffer, email.id, send]);

  if (!shouldOffer || readReceiptResponse === 'always') return null;

  const onSend = async () => {
    setBusy(true);
    try {
      await send(false);
      setHandledLocally(true);
    } catch (err) {
      Alert.alert(
        t('email_viewer.read_receipt.send_failed', 'Read receipt could not be sent'),
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setBusy(false);
    }
  };

  const onIgnore = async () => {
    setHandledLocally(true);
    await flagSent();
  };

  return (
    <View style={styles.banner}>
      <MailCheck size={16} color={c.textSecondary} />
      <Text style={styles.text}>{t('email_viewer.read_receipt.prompt', 'The sender asked to be notified when you open this message.')}</Text>
      {busy ? (
        <ActivityIndicator size="small" color={c.primary} />
      ) : (
        <View style={styles.actions}>
          <Pressable onPress={onSend} hitSlop={8}>
            <Text style={styles.primary}>{t('email_viewer.read_receipt.send', 'Send receipt')}</Text>
          </Pressable>
          <Pressable onPress={onIgnore} hitSlop={8}>
            <Text style={styles.secondary}>{t('email_viewer.read_receipt.ignore', 'Ignore')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function makeStyles(c: ThemePalette) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: c.surfaceHover,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    text: { ...typography.caption, color: c.textSecondary, flex: 1, minWidth: 160 },
    actions: { flexDirection: 'row', gap: spacing.md },
    primary: { ...typography.caption, color: c.primary, fontWeight: '600' },
    secondary: { ...typography.caption, color: c.textMuted, fontWeight: '600' },
  });
}
