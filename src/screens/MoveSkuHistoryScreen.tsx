import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { History } from 'lucide-react-native';
import type { MoveSkuStackParamList } from '../navigation/types';
import { fetchMoveHistory, type MoveHistoryItem } from '../api/moveHistory';
import { formatApiError } from '../utils/formatApiError';
import { theme } from '../theme';
import { useLayout } from '../hooks/useLayout';
import { isLikelyConnectivityError } from '../utils/networkError';
import ConnectivityBanner from '../components/ConnectivityBanner';

type Props = NativeStackScreenProps<MoveSkuStackParamList, 'MoveSkuHistory'>;

const PAGE = 25;

export default function MoveSkuHistoryScreen({ navigation }: Props) {
  const { isTablet, maxContentWidth, horizontalPadding } = useLayout();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<MoveHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConnectivityRetry, setShowConnectivityRetry] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const reloadFromStart = useCallback(async (showRefresh: boolean) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { items: rows, total: tot } = await fetchMoveHistory({
        skip: 0,
        limit: PAGE,
        search: debouncedSearch || undefined,
      });
      setItems(rows);
      setTotal(tot);
      setShowConnectivityRetry(false);
    } catch (e) {
      setShowConnectivityRetry(isLikelyConnectivityError(e));
      setError(formatApiError(e).message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void reloadFromStart(false);
  }, [reloadFromStart]);

  const onRefresh = () => {
    void reloadFromStart(true);
  };

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing || items.length >= total) return;
    setLoadingMore(true);
    setError(null);
    try {
      const { items: rows, total: tot } = await fetchMoveHistory({
        skip: items.length,
        limit: PAGE,
        search: debouncedSearch || undefined,
      });
      setTotal(tot);
      setItems((prev) => [...prev, ...rows]);
      setShowConnectivityRetry(false);
    } catch (e) {
      setShowConnectivityRetry(isLikelyConnectivityError(e));
      setError(formatApiError(e).message);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, refreshing, items.length, total, debouncedSearch]);

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <View style={[styles.root, isTablet && { alignItems: 'center' }]}>
      <View style={[styles.inner, { maxWidth: maxContentWidth, width: '100%', paddingHorizontal: horizontalPadding }]}>
        <View style={styles.hero}>
          <History size={28} color={theme.colors.primary} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Move history</Text>
            <Text style={styles.subtitle}>Recent SKU transfers between locations</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('MoveSkuRoot')} hitSlop={8}>
            <Text style={styles.link}>Move SKU</Text>
          </TouchableOpacity>
        </View>

        <ConnectivityBanner visible={showConnectivityRetry} onRetry={() => void reloadFromStart(true)} />

        <TextInput
          style={styles.search}
          placeholder="Search SKU, location, user…"
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && items.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={0.3}
            ListHeaderComponent={
              total > 0 ? (
                <Text style={styles.countLine}>
                  Showing {items.length} of {total}
                </Text>
              ) : null
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={theme.colors.primary} /> : null}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No moves yet</Text>
                  <Text style={styles.emptySub}>Completed transfers appear here.</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardDate}>{fmtDate(item.moved_at)}</Text>
                <Text style={styles.cardSku}>{item.sku_code}</Text>
                <Text style={styles.cardName} numberOfLines={2}>
                  {item.sku_name}
                </Text>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLocLabel}>From</Text>
                  <Text style={styles.cardLoc}>{item.from_location_name || item.from_location_id}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLocLabel}>To</Text>
                  <Text style={styles.cardLoc}>{item.to_location_name || item.to_location_id}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.qty}>Qty {item.quantity}</Text>
                  <Text style={styles.by} numberOfLines={1}>
                    {item.moved_by_username || item.moved_by || '—'}
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  inner: { flex: 1, paddingTop: theme.spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 2 },
  link: { color: theme.colors.primary, fontWeight: '700' },
  search: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    marginBottom: theme.spacing.md,
    fontSize: 16,
  },
  errorBanner: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorDim,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.sm,
  },
  errorText: { color: theme.colors.error },
  center: { paddingVertical: 48, alignItems: 'center' },
  countLine: { ...theme.typography.caption, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
  card: {
    backgroundColor: theme.colors.backgroundElevated,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardDate: { ...theme.typography.caption, color: theme.colors.textMuted, marginBottom: 6 },
  cardSku: { fontSize: 17, fontWeight: '800', color: theme.colors.primary },
  cardName: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
  cardRow: { flexDirection: 'row', marginTop: 4, gap: 8 },
  cardLocLabel: { width: 44, ...theme.typography.caption, color: theme.colors.textMuted },
  cardLoc: { flex: 1, ...theme.typography.bodySmall, color: theme.colors.text },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  qty: { fontWeight: '800', color: theme.colors.text },
  by: { flex: 1, textAlign: 'right', ...theme.typography.caption, color: theme.colors.textSecondary },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyTitle: { ...theme.typography.titleSmall, color: theme.colors.text },
  emptySub: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 8 },
});
