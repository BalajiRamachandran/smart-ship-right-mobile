import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getApiBaseUrl } from '../config/api';
import { useAuthStore } from '../store/authStore';
import { useDebugStore } from '../store/debugStore';
import { theme } from '../theme';

const SettingsScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const apiUrl = getApiBaseUrl();
  const debugEnabled = useDebugStore((s) => s.enabled);
  const setDebugEnabled = useDebugStore((s) => s.setEnabled);
  const toastEnabled = useDebugStore((s) => s.toastEnabled);
  const setToastEnabled = useDebugStore((s) => s.setToastEnabled);
  const logs = useDebugStore((s) => s.logs);
  const clear = useDebugStore((s) => s.clear);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.block}>
          <Text style={styles.label}>Backend API URL</Text>
          <Text style={styles.value} selectable>{apiUrl}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.block}>
          {user ? (
            <>
              <Text style={styles.label}>User</Text>
              <Text style={styles.value}>{user.full_name}</Text>
              <Text style={styles.label}>Role</Text>
              <Text style={styles.value}>{user.role}</Text>
            </>
          ) : (
            <Text style={styles.value}>Not signed in.</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug</Text>
        <View style={styles.block}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Detailed API errors</Text>
            <Switch
              value={debugEnabled}
              onValueChange={setDebugEnabled}
              trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primaryDim }}
              thumbColor={debugEnabled ? theme.colors.primary : theme.colors.textMuted}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Show debug popups</Text>
            <Switch
              value={toastEnabled}
              onValueChange={setToastEnabled}
              disabled={!debugEnabled}
              trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primaryDim }}
              thumbColor={toastEnabled ? theme.colors.primary : theme.colors.textMuted}
            />
          </View>
          {debugEnabled ? (
            <>
              <View style={[styles.row, { marginTop: theme.spacing.md }]}>
                <Text style={styles.label}>Recent API logs</Text>
                <TouchableOpacity onPress={clear}>
                  <Text style={styles.link}>Clear</Text>
                </TouchableOpacity>
              </View>
              {logs.length === 0 ? (
                <Text style={styles.muted}>No logs yet. Use the app to see requests here.</Text>
              ) : (
                <View style={styles.logBox}>
                  {logs.slice(0, 10).map((l) => (
                    <View key={l.id} style={styles.logRow}>
                      <Text style={[styles.logTitle, l.level === 'error' && styles.logError]}>
                        {new Date(l.ts).toLocaleTimeString()} {l.title}
                      </Text>
                      {l.message ? <Text style={styles.logMessage}>{l.message}</Text> : null}
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.muted}>
              Enable to see backend messages and status codes in Expo Go.
            </Text>
          )}
        </View>
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
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl + 20,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  block: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  rowLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    flex: 1,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  value: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
  },
  muted: {
    marginTop: theme.spacing.sm,
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  link: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  logBox: {
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  logRow: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  logTitle: {
    fontSize: 11,
    color: theme.colors.text,
    fontWeight: '600',
  },
  logError: {
    color: '#fca5a5',
  },
  logMessage: {
    marginTop: 4,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
});

export default SettingsScreen;
