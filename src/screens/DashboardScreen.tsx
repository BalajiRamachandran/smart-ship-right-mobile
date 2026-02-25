import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Package, ClipboardList, Move, Warehouse, Settings, LogOut } from 'lucide-react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { theme } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;

const MENU_ITEMS: Array<{
  key: keyof MainTabParamList | 'MoveSku';
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  accent?: boolean;
}> = [
  { key: 'Orders', title: 'Orders', subtitle: 'View and track open orders', icon: ClipboardList, accent: true },
  { key: 'Picking', title: 'Picking', subtitle: 'Scan totes and items', icon: Package },
  { key: 'MoveSku', title: 'Move SKU', subtitle: 'Move inventory between locations', icon: Move },
  { key: 'Tools', title: 'Tools', subtitle: 'Warehouse tools & workflows', icon: Warehouse },
  { key: 'Settings', title: 'Settings', subtitle: 'Preferences & connection', icon: Settings },
];

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back</Text>
        {user ? (
          <Text style={styles.user}>
            {user.full_name} · {user.role}
          </Text>
        ) : null}
      </View>

      <View style={styles.grid}>
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isStack = item.key === 'MoveSku';
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.card, item.accent && styles.cardAccent]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(item.key as any)}
            >
              <View style={[styles.iconWrap, item.accent && styles.iconWrapAccent]}>
                <Icon size={22} color={item.accent ? theme.colors.primary : theme.colors.textSecondary} />
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody} numberOfLines={2}>{item.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
        <LogOut size={18} color={theme.colors.textSecondary} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  greeting: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  user: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  card: {
    width: '47%',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardAccent: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
    backgroundColor: theme.colors.primaryDim,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  iconWrapAccent: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  cardTitle: {
    ...theme.typography.label,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  cardBody: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  logoutButton: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  logoutText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
});

export default DashboardScreen;
