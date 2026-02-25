import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApiUrlStore } from '../store/apiUrlStore';
import { theme } from '../theme';

const ApiSetupScreen: React.FC = () => {
  const getEffectiveUrl = useApiUrlStore((s) => s.getEffectiveUrl);
  const setApiUrl = useApiUrlStore((s) => s.setApiUrl);

  const [url, setUrl] = useState(() => getEffectiveUrl());
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    try {
      await setApiUrl(trimmed);
    } catch (e) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.brand}>
          <Text style={styles.title}>Backend API</Text>
          <Text style={styles.subtitle}>
            Enter your Ship Right API base URL. This is saved on your device.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>API base URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://your-api.example.com"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="url"
            value={url}
            onChangeText={(t) => { setUrl(t); setError(null); }}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <Text style={styles.hint}>No trailing slash</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save & Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.xxl + theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    ...theme.shadow.card,
  },
  brand: {
    marginBottom: theme.spacing.xxl,
  },
  title: {
    ...theme.typography.title,
    fontSize: 26,
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 20,
  },
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
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
  },
  hint: {
    marginTop: theme.spacing.xs,
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  errorBanner: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.errorDim,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
  },
  button: {
    height: 50,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ApiSetupScreen;
