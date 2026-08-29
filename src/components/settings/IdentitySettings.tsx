import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';
import { SettingsSection } from './settings-section';
import Button from '../Button';
import { typography, spacing, radius, type ThemePalette } from '../../theme/tokens';
import { useColors } from '../../theme/colors';
import { useSettingsStore } from '../../stores/settings-store';
import {
  createIdentity,
  deleteIdentity,
  updateIdentity,
} from '../../api/identity';
import type { Identity } from '../../api/types';
import { useLocaleStore } from '../../stores/locale-store';

type DraftIdentity = {
  id: string;
  name: string;
  email: string;
  textSignature: string;
  mayDelete: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toDraft(identity: Identity): DraftIdentity {
  return {
    id: identity.id,
    name: identity.name ?? '',
    email: identity.email,
    textSignature: identity.textSignature ?? '',
    mayDelete: identity.mayDelete,
  };
}

function emptyDraft(): DraftIdentity {
  return { id: '', name: '', email: '', textSignature: '', mayDelete: true };
}

export function IdentitySettings() {
  const c = useColors();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const identities = useSettingsStore((s) => s.identities);
  const t = useLocaleStore((s) => s.t);
  const loading = useSettingsStore((s) => s.loading);
  const error = useSettingsStore((s) => s.error);
  const fetchIdentities = useSettingsStore((s) => s.fetchIdentities);

  const [editing, setEditing] = useState<DraftIdentity | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchIdentities();
  }, [fetchIdentities]);

  const openCreate = () => setEditing(emptyDraft());
  const openEdit = (i: Identity) => setEditing(toDraft(i));
  const closeEditor = () => setEditing(null);

  const saveDraft = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const email = editing.email.trim();
    if (!email || !EMAIL_RE.test(email)) {
      Alert.alert(t('settings.identities.invalid_email_title', "Invalid email"), t('settings.identities.invalid_email', "Enter a valid email address for this identity."));
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        // JMAP doesn't allow changing `email` on an existing identity, so we
        // only PATCH the editable fields. The server will reject email
        // changes; the form disables that input below to make this obvious.
        await updateIdentity(editing.id, {
          name,
          textSignature: editing.textSignature,
        });
      } else {
        await createIdentity({
          name,
          email,
          textSignature: editing.textSignature || undefined,
        });
      }
      closeEditor();
      await fetchIdentities();
    } catch (err) {
      Alert.alert(t('settings.identities.save_failed', "Save failed"), err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (identity: Identity) => {
    if (!identity.mayDelete) {
      Alert.alert(t('settings.identities.cannot_delete_title', "Cannot delete"), t('settings.identities.cannot_delete', "The primary identity cannot be removed."));
      return;
    }
    Alert.alert(
      t('settings.identities.delete_title', "Delete identity"),
      t('settings.identities.delete_confirm', 'Remove "{name}"?', { name: identity.name || identity.email }),
      [
        { text: t('common.cancel', "Cancel"), style: 'cancel' },
        {
          text: t('common.delete', "Delete"),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(identity.id);
            try {
              await deleteIdentity(identity.id);
              await fetchIdentities();
            } catch (err) {
              Alert.alert(t('settings.identities.delete_failed', "Delete failed"), err instanceof Error ? err.message : String(err));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SettingsSection
      title={t('settings.identities.title', "Sending Identities")}
      description={t('settings.identities.description_mobile', "Manage sender names, email addresses, and signatures. Tap a row to edit.")}
    >
      <View style={styles.headerRow}>
        <Text style={styles.count}>
          {loading
            ? t('common.loading', "Loading...")
            : t('settings.identities.count', '{count, plural, =0 {No identities} one {# identity} other {# identities}}', { count: identities.length })}
        </Text>
        <Button
          variant="default"
          size="sm"
          onPress={openCreate}
          icon={<Plus size={14} color={c.primaryForeground} />}
          disabled={loading}
        >
          {t('settings.identities.new', "New")}
        </Button>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {identities.map((identity) => (
        <Pressable
          key={identity.id}
          onPress={() => openEdit(identity)}
          style={({ pressed }) => [styles.identityRow, pressed && styles.identityRowPressed]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.identityName}>{identity.name || t('settings.identities.no_name', "(no name)")}</Text>
            <Text style={styles.identityEmail}>{identity.email}</Text>
          </View>
          {!identity.mayDelete ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('settings.identities.primary', "primary")}</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => confirmDelete(identity)}
              hitSlop={8}
              style={styles.identityDelete}
              disabled={deletingId === identity.id}
              accessibilityRole="button"
              accessibilityLabel={t('common.delete', "Delete")}
            >
              {deletingId === identity.id ? (
                <ActivityIndicator size="small" color={c.error} />
              ) : (
                <Trash2 size={16} color={c.error} />
              )}
            </Pressable>
          )}
        </Pressable>
      ))}

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={closeEditor}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing?.id ? t('settings.identities.edit', "Edit identity") : t('settings.identities.create', "New identity")}
              </Text>
              <Pressable onPress={closeEditor} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close', "Close")}>
                <X size={20} color={c.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.fieldLabel}>{t('settings.identities.display_name', "Display name")}</Text>
              <TextInput
                value={editing?.name ?? ''}
                onChangeText={(name) => setEditing((d) => (d ? { ...d, name } : d))}
                placeholder="Jane Doe"
                placeholderTextColor={c.textMuted}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>{t('settings.identities.email_address', "Email address")}</Text>
              <TextInput
                value={editing?.email ?? ''}
                onChangeText={(email) => setEditing((d) => (d ? { ...d, email } : d))}
                placeholder="jane@example.com"
                placeholderTextColor={c.textMuted}
                style={[styles.input, !!editing?.id && styles.inputDisabled]}
                editable={!editing?.id}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              {!!editing?.id && (
                <Text style={styles.hint}>{t('settings.identities.email_locked', "JMAP does not allow changing an identity's email; create a new one instead.")}</Text>
              )}
              <Text style={styles.fieldLabel}>{t('settings.identities.text_signature', "Plain-text signature")}</Text>
              <TextInput
                value={editing?.textSignature ?? ''}
                onChangeText={(textSignature) => setEditing((d) => (d ? { ...d, textSignature } : d))}
                placeholder="--&#10;Jane Doe&#10;Bulwark Mail"
                placeholderTextColor={c.textMuted}
                multiline
                style={[styles.input, styles.bodyInput]}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button variant="outline" size="sm" onPress={closeEditor} disabled={saving}>{t('common.cancel', "Cancel")}</Button>
              <Button
                variant="default"
                size="sm"
                onPress={() => { void saveDraft(); }}
                loading={saving}
              >
                {t('common.save', "Save")}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SettingsSection>
  );
}

function makeStyles(c: ThemePalette) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    count: { ...typography.body, color: c.mutedForeground },
    errorBox: { padding: spacing.md, borderRadius: radius.sm, backgroundColor: c.errorBg },
    errorText: { ...typography.caption, color: c.error },
    identityRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.md, paddingHorizontal: spacing.md,
      borderRadius: radius.sm, backgroundColor: c.muted,
      marginTop: spacing.xs,
    },
    identityRowPressed: { backgroundColor: c.surfaceHover },
    identityName: { ...typography.bodyMedium, color: c.text },
    identityEmail: { ...typography.caption, color: c.mutedForeground, marginTop: 2 },
    identityDelete: { padding: 6 },
    badge: {
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full,
      backgroundColor: c.primaryBg,
    },
    badgeText: { fontSize: 10, fontWeight: '500', color: c.primary },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    modalTitle: { ...typography.h3, color: c.text },
    modalBody: { padding: spacing.lg, gap: spacing.sm },
    fieldLabel: { ...typography.captionMedium, color: c.textSecondary, marginTop: spacing.sm },
    input: {
      ...typography.body, color: c.text,
      backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: radius.sm,
      paddingHorizontal: spacing.md, paddingVertical: 10,
    },
    inputDisabled: { opacity: 0.6 },
    bodyInput: { minHeight: 100, textAlignVertical: 'top' },
    hint: { ...typography.caption, color: c.mutedForeground },
    modalActions: {
      flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm,
      padding: spacing.lg, borderTopWidth: 1, borderTopColor: c.border,
    },
  });
}
