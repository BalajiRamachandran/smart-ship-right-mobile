import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { Settings as SettingsIcon } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useLayout } from '../hooks/useLayout';
import { GlassView } from '../components/GlassView';
import ShipRightLogo from '../components/ShipRightLogo';
import { useApiUrlStore } from '../store/apiUrlStore';
import { theme } from '../theme';

const LoginScreen: React.FC = () => {
  const { contentWidth, horizontalPadding } = useLayout();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showBackendSettings, setShowBackendSettings] = useState(false);

  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const clearApiUrl = useApiUrlStore((s) => s.clearApiUrl);
  const effectiveApiUrl = useApiUrlStore((s) => s.getEffectiveUrl());
  const appVersion = Constants.expoConfig?.version ?? (Constants as any).manifest?.version ?? 'unknown';

  const handleSubmit = () => {
    if (!username || !password || loading) return;
    void login(username.trim(), password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <GlassView style={[styles.card, { maxWidth: contentWidth, marginHorizontal: horizontalPadding }]}>
        <TouchableOpacity
          style={styles.settingsIconButton}
          activeOpacity={0.8}
          onPress={() => setShowBackendSettings(true)}
        >
          <SettingsIcon size={20} color={theme.colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.brand}>
          <ShipRightLogo />
          <Text style={styles.subtitle}>Warehouse Management</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            returnKeyType="next"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.button,
            (!username || !password || loading) && styles.buttonDisabled,
          ]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={!username || !password || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            // Clear the saved URL so RootNavigator shows API setup again.
            void clearApiUrl();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Clear Backend URL</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Use your existing Ship-Right credentials
        </Text>
        <Text style={styles.versionText}>Version {appVersion}</Text>
      </GlassView>

      <Modal
        visible={showBackendSettings}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBackendSettings(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBackendSettings(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend Settings</Text>
            <Text style={styles.modalLabel}>Current API base URL</Text>
            <Text style={styles.modalUrl} numberOfLines={4}>
              {effectiveApiUrl}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => {
                  void clearApiUrl();
                  setShowBackendSettings(false);
                }}
              >
                <Text style={styles.modalSecondaryButtonText}>Clear & Re-enter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={() => setShowBackendSettings(false)}
              >
                <Text style={styles.modalPrimaryButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.xxl + theme.spacing.md,
    ...theme.shadow.card,
    position: 'relative',
  },
  brand: {
    marginBottom: theme.spacing.xxl,
  },
  subtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
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
  secondaryButton: {
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  settingsIconButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  hint: {
    marginTop: theme.spacing.lg,
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  versionText: {
    marginTop: theme.spacing.sm,
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  modalTitle: {
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    ...theme.typography.title,
    fontSize: 20,
    color: theme.colors.text,
  },
  modalLabel: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  modalUrl: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modalSecondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
  },
  modalSecondaryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  modalPrimaryButton: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default LoginScreen;
