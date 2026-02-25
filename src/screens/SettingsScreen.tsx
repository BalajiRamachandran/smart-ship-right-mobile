import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Settings, LogOut } from 'lucide-react-native';
import { useApiUrlStore } from '../store/apiUrlStore';
import { useAuthStore } from '../store/authStore';
import { theme } from '../theme';

const SettingsScreen: React.FC = () => {
  const getEffectiveUrl = useApiUrlStore((s) => s.getEffectiveUrl);
  const setApiUrl = useApiUrlStore((s) => s.setApiUrl);
  const logout = useAuthStore((s) => s.logout);

  const [url, setUrl] = useState(() => getEffectiveUrl());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter the backend API URL');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await setApiUrl(trimmed, { clearAuth: true });
      setMessage('Saved. You will need to sign in again.');
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Settings size={20} color={theme.colors.primary} strokeWidth={2} />
          <Text style={styles.sectionTitle}>Backend API</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Change the server this app connects to. You will be signed out after saving.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="https://your-api.example.com"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          value={url}
          onChangeText={(t) => { setUrl(t); setError(null); setMessage(null); }}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.messageText}>{message}</Text> : null}
        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Save API URL</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LogOut size={20} color={theme.colors.textSecondary} strokeWidth={2} />
          <Text style={styles.sectionTitle}>Account</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={() => logout()} activeOpacity={0.85}>
          <Text style={styles.logoutButtonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl + 40,
  },
  section: {
    marginBottom: theme.spacing.xxl,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.titleSmall,
    color: theme.colors.text,
  },
  sectionDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  input: {
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: theme.spacing.lg,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    fontSize: 16,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
    marginBottom: theme.spacing.sm,
  },
  messageText: {
    color: theme.colors.success,
    fontSize: 13,
    marginBottom: theme.spacing.sm,
  },
  primaryButton: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
  },
  logoutButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;
