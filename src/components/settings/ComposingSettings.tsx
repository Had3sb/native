import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { SettingsSection, SettingItem, ToggleSwitch } from './settings-section';
import Button from '../Button';
import { spacing, radius, typography, type ThemePalette } from '../../theme/tokens';
import { useColors } from '../../theme/colors';
import { useSettingsStore } from '../../stores/settings-store';
import { useLocaleStore } from '../../stores/locale-store';

export function ComposingSettings() {
  const c = useColors();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const autoSelectReplyIdentity = useSettingsStore((s) => s.autoSelectReplyIdentity);
  const t = useLocaleStore((s) => s.t);
  const setAutoSelectReplyIdentity = useSettingsStore((s) => s.setAutoSelectReplyIdentity);
  const attachmentReminderEnabled = useSettingsStore((s) => s.attachmentReminderEnabled);
  const setAttachmentReminderEnabled = useSettingsStore((s) => s.setAttachmentReminderEnabled);
  const attachmentReminderKeywords = useSettingsStore((s) => s.attachmentReminderKeywords);
  const setAttachmentReminderKeywords = useSettingsStore((s) => s.setAttachmentReminderKeywords);
  const sendDelaySeconds = useSettingsStore((s) => s.sendDelaySeconds);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);

  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => { if (!hydrated) void hydrate(); }, [hydrated, hydrate]);

  const addKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (!trimmed || attachmentReminderKeywords.includes(trimmed)) {
      setNewKeyword('');
      return;
    }
    setAttachmentReminderKeywords([...attachmentReminderKeywords, trimmed]);
    setNewKeyword('');
  };

  const removeKeyword = (kw: string) => {
    setAttachmentReminderKeywords(attachmentReminderKeywords.filter((k) => k !== kw));
  };

  const SEND_DELAY_OPTIONS: { label: string; value: number }[] = [
    // Same set the webmail accepts (0/10/30/60); the store rejects others.
    { label: t('settings.email_behavior.send_delay.off', "Off"), value: 0 },
    { label: t('settings.email_behavior.send_delay.seconds', '{seconds} seconds', { seconds: 10 }), value: 10 },
    { label: t('settings.email_behavior.send_delay.seconds', '{seconds} seconds', { seconds: 30 }), value: 30 },
    { label: t('settings.email_behavior.send_delay.seconds', '{seconds} seconds', { seconds: 60 }), value: 60 },
  ];

  return (
    <SettingsSection
      title={t('settings.composer.title', "Composer")}
      description={t('settings.composer.description', "Configure email composition settings")}
    >
      <SettingItem
        label={t('settings.email_behavior.auto_select_reply_identity.label', "Reply From Received Address")}
        description={t('settings.email_behavior.auto_select_reply_identity.description_mobile', "When replying, send from the address the message was originally sent to.")}
      >
        <ToggleSwitch checked={autoSelectReplyIdentity} onChange={setAutoSelectReplyIdentity} />
      </SettingItem>

      <View style={styles.subBlock}>
        <Text style={styles.subLabel}>{t('settings.email_behavior.send_delay.label', "Undo send / send delay")}</Text>
        <Text style={styles.subDescription}>
          {t('settings.email_behavior.send_delay.description_mobile', "Hold outgoing mail for a few seconds so you can cancel it. Requires server support.")}
        </Text>
        <View style={styles.segmentRow}>
          {SEND_DELAY_OPTIONS.map((opt) => {
            const active = sendDelaySeconds === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => updateSetting('sendDelaySeconds', opt.value)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SettingItem
        label={t('settings.email_behavior.attachment_reminder.label', "Attachment Reminder")}
        description={t('settings.email_behavior.attachment_reminder.description', "Warn before sending when your message mentions attachments but none are attached")}
      >
        <ToggleSwitch
          checked={attachmentReminderEnabled}
          onChange={setAttachmentReminderEnabled}
        />
      </SettingItem>

      {attachmentReminderEnabled && (
        <View style={styles.subBlock}>
          <Text style={styles.subLabel}>{t('settings.email_behavior.attachment_reminder.keywords_label', "Trigger keywords")}</Text>
          <Text style={styles.subDescription}>
            {t('settings.email_behavior.attachment_reminder.keywords_description', "Words or phrases that trigger the reminder when found in your message")}
          </Text>

          <View style={styles.chips}>
            {attachmentReminderKeywords.map((kw) => (
              <View key={kw} style={styles.chip}>
                <Text style={styles.chipText}>{kw}</Text>
                <Pressable onPress={() => removeKeyword(kw)} hitSlop={6}>
                  <X size={12} color={c.textSecondary} />
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.addRow}>
            <TextInput
              value={newKeyword}
              onChangeText={setNewKeyword}
              placeholder={t('settings.email_behavior.attachment_reminder.add_placeholder', "Add keyword...")}
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              onSubmitEditing={addKeyword}
              returnKeyType="done"
            />
            <Button
              variant="default"
              size="sm"
              onPress={addKeyword}
              disabled={!newKeyword.trim()}
              icon={<Plus size={14} color={c.primaryForeground} />}
            >
              {t('settings.email_behavior.attachment_reminder.add', "Add")}
            </Button>
          </View>
        </View>
      )}
    </SettingsSection>
  );
}

function makeStyles(c: ThemePalette) {
  return StyleSheet.create({
  subBlock: { paddingVertical: spacing.md, gap: spacing.sm },
  subLabel: { ...typography.bodyMedium, color: c.text },
  subDescription: { ...typography.caption, color: c.mutedForeground },
  segmentRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
  },
  segmentActive: { backgroundColor: c.primary, borderColor: c.primary },
  segmentText: { ...typography.caption, color: c.text },
  segmentTextActive: { color: c.primaryForeground, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: c.muted,
  },
  chipText: { ...typography.caption, color: c.text },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  input: {
    flex: 1,
    backgroundColor: c.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: c.text,
    ...typography.body,
  },
});
}
