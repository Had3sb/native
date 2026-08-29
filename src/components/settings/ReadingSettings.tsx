import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { AlertTriangle, FolderSync, X } from 'lucide-react-native';
import { SettingsSection, SettingItem, Select, ToggleSwitch } from './settings-section';
import { spacing, radius, typography, type ThemePalette } from '../../theme/tokens';
import { useColors } from '../../theme/colors';
import {
  useSettingsStore,
  type ArchiveMode,
  type DeleteAction,
  type MailAttachmentAction,
  type AttachmentPosition,
  type PlainTextFont,
  type MessageSpacing,
  type ReadReceiptResponse,
} from '../../stores/settings-store';
import { useEmailStore } from '../../stores/email-store';
import { archiveEmails, queryEmails, getEmails } from '../../api/email';
import { ownMailboxes } from '../../lib/mailbox-tree';

export function ReadingSettings() {
  const c = useColors();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const update = useSettingsStore((s) => s.updateSetting);

  const archiveMode = useSettingsStore((s) => s.archiveMode);
  const markAsReadDelay = useSettingsStore((s) => s.markAsReadDelay);
  const deleteAction = useSettingsStore((s) => s.deleteAction);
  const permanentlyDeleteJunk = useSettingsStore((s) => s.permanentlyDeleteJunk);
  const showPreview = useSettingsStore((s) => s.showPreview);
  const disableThreading = useSettingsStore((s) => s.disableThreading);
  const includeGroupInUnified = useSettingsStore((s) => s.includeGroupInUnified);
  const autoSelectReplyIdentity = useSettingsStore((s) => s.autoSelectReplyIdentity);
  const plainTextMode = useSettingsStore((s) => s.plainTextMode);
  const emailsPerPage = useSettingsStore((s) => s.emailsPerPage);
  const mailAttachmentAction = useSettingsStore((s) => s.mailAttachmentAction);
  const attachmentPosition = useSettingsStore((s) => s.attachmentPosition);
  const attachmentReminderEnabled = useSettingsStore((s) => s.attachmentReminderEnabled);
  const attachmentReminderKeywords = useSettingsStore((s) => s.attachmentReminderKeywords);
  const hideInlineImageAttachments = useSettingsStore((s) => s.hideInlineImageAttachments);
  const plainTextFont = useSettingsStore((s) => s.plainTextFont);
  const messageSpacing = useSettingsStore((s) => s.messageSpacing);
  const readReceiptResponse = useSettingsStore((s) => s.readReceiptResponse);

  const [newKeyword, setNewKeyword] = useState('');
  const [reorganizing, setReorganizing] = useState(false);
  const [reorganizeResult, setReorganizeResult] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const handleReorganizeArchive = async () => {
    const { mailboxes, fetchMailboxes } = useEmailStore.getState();
    // Reorganising runs against the user's own archive only.
    const archiveMailbox = ownMailboxes(mailboxes).find(
      (m) => m.role === 'archive' || m.name.toLowerCase() === 'archive',
    );
    if (!archiveMailbox) {
      setReorganizeResult('No archive folder found.');
      return;
    }

    setReorganizing(true);
    setReorganizeResult(null);

    try {
      // Drain the archive in pages so we don't OOM on huge mailboxes.
      const PAGE = 100;
      let position = 0;
      let total = 0;
      let moved = 0;

      while (true) {
        const { ids, total: pageTotal } = await queryEmails(archiveMailbox.id, {
          position,
          limit: PAGE,
        });
        if (position === 0) total = pageTotal;
        if (ids.length === 0) break;

        const list = await getEmails(ids);
        const refreshed = ownMailboxes(useEmailStore.getState().mailboxes);
        await archiveEmails(
          list.map((e) => ({ id: e.id, receivedAt: e.receivedAt })),
          archiveMailbox.id,
          archiveMode,
          refreshed,
        );
        moved += list.length;

        // Newly-created year/month folders need to be visible to the next batch
        // so we don't try to create the same folder twice.
        await fetchMailboxes();

        // Items just got moved out of the root archive view; the next page
        // starts again at position 0 of the now-shorter list.
        if (ids.length < PAGE) break;
      }

      setReorganizeResult(`Moved ${moved} of ${total} emails.`);
    } catch (err) {
      setReorganizeResult(err instanceof Error ? err.message : 'Reorganize failed.');
    } finally {
      setReorganizing(false);
    }
  };

  return (
    <SettingsSection title="Email Behavior" description="How your inbox behaves day to day.">
      <SettingItem label="Mark as Read" description="When to flag an email as read.">
        <Select
          value={String(markAsReadDelay)}
          onChange={(v) => update('markAsReadDelay', Number(v))}
          options={[
            { value: '0', label: 'Instant' },
            { value: '3000', label: 'After 3s' },
            { value: '5000', label: 'After 5s' },
            { value: '-1', label: 'Never' },
          ]}
        />
      </SettingItem>

      <View style={styles.group}>
        <SettingItem label="Delete Action" description="Where deleted emails go." noBorder />
        <Select
          value={deleteAction}
          onChange={(v) => update('deleteAction', v as DeleteAction)}
          options={[
            { value: 'trash', label: 'Move to Trash' },
            { value: 'trash-and-read', label: 'Move to Trash and mark as read' },
            { value: 'permanent', label: 'Permanently delete' },
          ]}
        />
        {deleteAction === 'permanent' && (
          <View style={styles.warning}>
            <AlertTriangle size={14} color={c.error} />
            <Text style={styles.warningText}>Permanent deletion cannot be undone.</Text>
          </View>
        )}
        <View style={styles.divider} />
      </View>

      <View style={styles.group}>
        <SettingItem label="Archive Mode" description="Organize archive into subfolders." noBorder />
        <Select
          value={archiveMode}
          onChange={(v) => update('archiveMode', v as ArchiveMode)}
          options={[
            { value: 'single', label: 'Single folder' },
            { value: 'year', label: 'By year' },
            { value: 'month', label: 'By year/month' },
          ]}
        />
        {archiveMode !== 'single' && (
          <>
            <Pressable
              style={[styles.inlineBtn, reorganizing && styles.inlineBtnDisabled]}
              onPress={reorganizing ? undefined : handleReorganizeArchive}
              disabled={reorganizing}
            >
              {reorganizing ? (
                <ActivityIndicator size="small" color={c.text} />
              ) : (
                <FolderSync size={14} color={c.text} />
              )}
              <Text style={styles.inlineBtnText}>
                {reorganizing ? 'Reorganizing…' : 'Reorganize existing archive'}
              </Text>
            </Pressable>
            {reorganizeResult && (
              <Text style={styles.reorganizeResult}>{reorganizeResult}</Text>
            )}
          </>
        )}
        <View style={styles.divider} />
      </View>

      <SettingItem label="Permanently Delete Junk" description="Skip the trash when deleting spam.">
        <ToggleSwitch checked={permanentlyDeleteJunk} onChange={(v) => update('permanentlyDeleteJunk', v)} />
      </SettingItem>

      <SettingItem label="Show Preview" description="Preview text under each subject.">
        <ToggleSwitch checked={showPreview} onChange={(v) => update('showPreview', v)} />
      </SettingItem>

      <SettingItem label="Disable Thread Grouping" description="Show emails individually instead of threaded.">
        <ToggleSwitch checked={disableThreading} onChange={(v) => update('disableThreading', v)} />
      </SettingItem>

      <SettingItem label="Include Group Inboxes" description="Also show group and shared inboxes in the unified All Inboxes view.">
        <ToggleSwitch checked={includeGroupInUnified} onChange={(v) => update('includeGroupInUnified', v)} />
      </SettingItem>

      <SettingItem label="Plain Text Mode" description="Compose and read in plain text only.">
        <ToggleSwitch checked={plainTextMode} onChange={(v) => update('plainTextMode', v)} />
      </SettingItem>

      <SettingItem label="Auto-select Reply Identity" description="Pick the best identity when replying.">
        <ToggleSwitch checked={autoSelectReplyIdentity} onChange={(v) => update('autoSelectReplyIdentity', v)} />
      </SettingItem>

      <SettingItem label="Attachment Reminder" description="Warn when the word 'attached' is present but no file is attached.">
        <ToggleSwitch
          checked={attachmentReminderEnabled}
          onChange={(v) => update('attachmentReminderEnabled', v)}
        />
      </SettingItem>

      {attachmentReminderEnabled && (
        <View style={styles.group}>
          <Text style={styles.subLabel}>Trigger Keywords</Text>
          <Text style={styles.subDesc}>Add words that should trigger the reminder.</Text>
          <View style={styles.chipRow}>
            {attachmentReminderKeywords.map((kw) => (
              <View key={kw} style={styles.chip}>
                <Text style={styles.chipText}>{kw}</Text>
                <Pressable
                  onPress={() =>
                    update(
                      'attachmentReminderKeywords',
                      attachmentReminderKeywords.filter((k) => k !== kw),
                    )
                  }
                  hitSlop={6}
                >
                  <X size={12} color={c.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>
          <View style={styles.addKeywordRow}>
            <TextInput
              value={newKeyword}
              onChangeText={setNewKeyword}
              placeholder="Add a keyword"
              placeholderTextColor={c.mutedForeground}
              style={styles.keywordInput}
              onSubmitEditing={() => {
                const t = newKeyword.trim().toLowerCase();
                if (t && !attachmentReminderKeywords.includes(t)) {
                  update('attachmentReminderKeywords', [...attachmentReminderKeywords, t]);
                }
                setNewKeyword('');
              }}
            />
            <Pressable
              style={styles.addKeywordBtn}
              onPress={() => {
                const t = newKeyword.trim().toLowerCase();
                if (t && !attachmentReminderKeywords.includes(t)) {
                  update('attachmentReminderKeywords', [...attachmentReminderKeywords, t]);
                }
                setNewKeyword('');
              }}
            >
              <Text style={styles.addKeywordText}>Add</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
        </View>
      )}

      <SettingItem label="Hide Inline Image Attachments" description="Don't list inline images in the attachment list.">
        <ToggleSwitch checked={hideInlineImageAttachments} onChange={(v) => update('hideInlineImageAttachments', v)} />
      </SettingItem>

      <SettingItem label="Attachment Click Action" description="What happens when you tap an attachment.">
        <Select
          value={mailAttachmentAction}
          onChange={(v) => update('mailAttachmentAction', v as MailAttachmentAction)}
          options={[
            { value: 'preview', label: 'Preview' },
            { value: 'download', label: 'Download' },
          ]}
        />
      </SettingItem>

      <SettingItem label="Attachment Position" description="Where attachments appear in messages.">
        <Select
          value={attachmentPosition}
          onChange={(v) => update('attachmentPosition', v as AttachmentPosition)}
          options={[
            { value: 'beside-sender', label: 'Beside sender' },
            { value: 'below-header', label: 'Below header' },
          ]}
        />
      </SettingItem>

      <SettingItem label="Plain Text Font" description="Font used for plain-text messages.">
        <Select
          value={plainTextFont}
          onChange={(v) => update('plainTextFont', v as PlainTextFont)}
          options={[
            { value: 'sans', label: 'App font' },
            { value: 'mono', label: 'Monospace' },
          ]}
        />
      </SettingItem>

      <SettingItem label="Message Spacing" description="Gutter around the message body.">
        <Select
          value={messageSpacing}
          onChange={(v) => update('messageSpacing', v as MessageSpacing)}
          options={[
            { value: 'auto', label: 'Automatic' },
            { value: 'always', label: 'Always padded' },
            { value: 'edge', label: 'Edge to edge' },
          ]}
        />
      </SettingItem>

      <SettingItem label="Read Receipts" description="When a sender asks to be notified that you opened a message.">
        <Select
          value={readReceiptResponse}
          onChange={(v) => update('readReceiptResponse', v as ReadReceiptResponse)}
          options={[
            { value: 'ask', label: 'Ask me' },
            { value: 'always', label: 'Always send' },
            { value: 'never', label: 'Never send' },
          ]}
        />
      </SettingItem>

      <SettingItem label="Emails Per Page" description="How many emails to load at a time.">
        <Select
          value={String(emailsPerPage)}
          onChange={(v) => update('emailsPerPage', Number(v))}
          options={[
            { value: '10', label: '10' },
            { value: '25', label: '25' },
            { value: '50', label: '50' },
            { value: '100', label: '100' },
          ]}
        />
      </SettingItem>

    </SettingsSection>
  );
}

function makeStyles(c: ThemePalette) {
  return StyleSheet.create({
  group: {},
  warning: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  warningText: {
    ...typography.caption,
    color: c.error,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: c.border,
    marginTop: spacing.md,
  },
  inlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: c.muted,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  inlineBtnText: {
    ...typography.body,
    color: c.text,
  },
  inlineBtnDisabled: {
    opacity: 0.6,
  },
  reorganizeResult: {
    ...typography.caption,
    color: c.mutedForeground,
    marginTop: spacing.xs,
  },
  subLabel: {
    ...typography.bodyMedium,
    color: c.text,
    marginTop: spacing.sm,
  },
  subDesc: {
    ...typography.caption,
    color: c.mutedForeground,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: c.muted,
  },
  chipText: {
    ...typography.caption,
    color: c.text,
  },
  addKeywordRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  keywordInput: {
    flex: 1,
    height: 32,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    backgroundColor: c.background,
    color: c.text,
    ...typography.body,
  },
  addKeywordBtn: {
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: c.muted,
    borderRadius: radius.sm,
  },
  addKeywordText: {
    ...typography.body,
    color: c.text,
  },
  trustedList: {
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.muted,
  },
  trustedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  trustedEmail: { ...typography.caption, color: c.text, flex: 1 },
});
}
