import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { MessageSquarePlus } from 'lucide-react-native';
import { theme } from '../theme';
import { useAuthStore } from '../store/authStore';
import { submitSupportFeedback } from '../api/supportFeedback';

type Props = {
  /** View to capture (tab shell); must have collapsable={false} on native. */
  shotRef: React.RefObject<View | null>;
};

const FAB_SIZE = 52;

export default function FeedbackFab({ shotRef }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const captureUriRef = useRef<string | null>(null);

  const openModal = useCallback(async () => {
    captureUriRef.current = null;
    setFormError(null);
    try {
      const uri = await captureRef(shotRef, { format: 'jpg', quality: 0.65, result: 'tmpfile' });
      captureUriRef.current = uri;
    } catch {
      /* still allow text-only if capture fails (e.g. web) */
    }
    setOpen(true);
  }, [shotRef]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setMessage('');
    setFormError(null);
    captureUriRef.current = null;
  }, []);

  const onSubmit = async () => {
    if (!message.trim()) {
      setFormError('Please enter a message.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await submitSupportFeedback({
        message: message.trim(),
        screenshotUri: captureUriRef.current,
      });
      const num = res.issue_number;
      setSuccessToast(num != null ? `Thanks! Issue #${num} created.` : 'Feedback submitted.');
      closeModal();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!successToast) return;
    const t = setTimeout(() => setSuccessToast(null), 5000);
    return () => clearTimeout(t);
  }, [successToast]);

  if (!user) return null;

  const bottom = Math.max(insets.bottom, 10) + 56 + 12;

  return (
    <>
      <Pressable
        accessibilityLabel="Send feedback"
        onPress={() => void openModal()}
        style={({ pressed }) => [
          styles.fab,
          { bottom },
          pressed && styles.fabPressed,
        ]}
      >
        <MessageSquarePlus size={26} color="#fff" strokeWidth={2} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send feedback</Text>
            <Text style={styles.modalHint}>
              Bug reports and ideas go to the same pipeline as the warehouse web app. A screen capture is included when available.
            </Text>
            <TextInput
              style={styles.textarea}
              placeholder="What would you like to share?"
              placeholderTextColor={theme.colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              editable={!submitting}
            />
            {formError ? (
              <Text style={styles.formError}>{formError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnGhost} onPress={closeModal} disabled={submitting}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => void onSubmit()} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {successToast ? (
        <View style={[styles.toast, { bottom: bottom + FAB_SIZE + 8 }, styles.toastOk]} pointerEvents="none">
          <Text style={styles.toastText}>{successToast}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  fabPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.backgroundElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.sm },
  modalHint: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg },
  textarea: {
    minHeight: 140,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    padding: theme.spacing.md,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: theme.spacing.md },
  btnGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
  },
  btnGhostText: { color: theme.colors.text, fontWeight: '700' },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    zIndex: 60,
  },
  toastOk: { backgroundColor: theme.colors.success },
  toastText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  formError: { color: theme.colors.error, marginBottom: theme.spacing.md, ...theme.typography.bodySmall },
});
