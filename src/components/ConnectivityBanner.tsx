import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  visible: boolean;
  onRetry: () => void;
};

/**
 * Shown when a request failed without an HTTP response (offline, DNS, timeout).
 */
export default function ConnectivityBanner({ visible, onRetry }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Text style={styles.title}>Connection problem</Text>
      <Text style={styles.body}>Check Wi‑Fi or cellular data, then try again.</Text>
      <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85} accessibilityLabel="Retry">
        <Text style={styles.btnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  title: { ...theme.typography.label, color: theme.colors.warning, marginBottom: 4 },
  body: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
  btn: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
