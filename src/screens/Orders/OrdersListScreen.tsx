import React, { useLayoutEffect, useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Filter, ArrowDown, ArrowUp } from 'lucide-react-native';
import { MainTabParamList } from '../../navigation/types';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useDebugStore } from '../../store/debugStore';
import { formatApiError } from '../../utils/formatApiError';
import { theme } from '../../theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Orders'>;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'picking', label: 'Picking' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'hold', label: 'Hold' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS: { value: string; label: string; order: 'asc' | 'desc' }[] = [
  { value: 'created_at', order: 'desc', label: 'Newest' },
  { value: 'created_at', order: 'asc', label: 'Oldest' },
  { value: 'total_amount', order: 'desc', label: 'Amount high' },
  { value: 'total_amount', order: 'asc', label: 'Amount low' },
  { value: 'customer_name', order: 'asc', label: 'Customer A–Z' },
];

type Order = {
  id: string;
  shopify_order_name?: string;
  customer_name: string;
  status: string;
  priority?: string | null;
  total_amount?: number | null;
  created_at: string;
};

type PaginatedOrders = {
  items: Order[];
  total: number;
  skip: number;
  limit: number;
};

const PAGE_SIZE = 20;

const OrdersListScreen: React.FC<Props> = ({ navigation }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const debugEnabled = useDebugStore((s) => s.enabled);

  const hasMore = orders.length < total;
  const canLoadMore = hasMore && !loadingMore && !loading && !refreshing;

  const ordersLengthRef = useRef(0);
  ordersLengthRef.current = orders.length;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => logout()}
          style={styles.headerButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.headerButtonText}>Sign out</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, logout]);

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!token) return;

    const skip = isRefresh ? 0 : ordersLengthRef.current;
    if (skip === 0) {
      if (orders.length === 0) setLoading(true);
      else setRefreshing(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    const params: Record<string, string | number> = {
      limit: PAGE_SIZE,
      skip,
      sort: sortBy,
      order: sortOrder,
    };
    if (statusFilter) params.status = statusFilter;

    try {
      const response = await api.get<PaginatedOrders | Order[]>('/api/orders', {
        params,
      });
      const data = response.data;
      let items: Order[] = [];
      let totalCount = 0;
      if (Array.isArray(data)) {
        items = data;
        totalCount = data.length;
      } else if (data && typeof data === 'object' && 'items' in data) {
        const paginated = data as PaginatedOrders;
        items = paginated.items ?? [];
        totalCount = paginated.total ?? items.length;
      }

      if (skip === 0) {
        setOrders(items);
        setTotal(totalCount);
      } else {
        setOrders((prev) => [...prev, ...items]);
        setTotal(totalCount);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
      const formatted = formatApiError(err);
      setError(debugEnabled ? `${formatted.message} (${formatted.title})` : 'Unable to load orders.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [token, statusFilter, sortBy, sortOrder]);

  const loadOrdersRef = useRef(loadOrders);
  loadOrdersRef.current = loadOrders;

  const loadMore = () => {
    if (canLoadMore) void loadOrders(false);
  };

  useEffect(() => {
    void loadOrdersRef.current(true);
  }, [token, statusFilter, sortBy, sortOrder]);

  const renderItem = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <View style={styles.rowHeader}>
        <Text style={styles.orderId} numberOfLines={1}>{item.shopify_order_name}</Text>
        <View style={[styles.badge, getStatusStyle(item.status)]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.customer} numberOfLines={1}>{item.customer_name}</Text>
      <View style={styles.rowMeta}>
        {item.priority ? <Text style={styles.meta}>{item.priority}</Text> : null}
        {item.total_amount != null ? (
          <Text style={styles.meta}>${item.total_amount.toFixed(2)}</Text>
        ) : null}
      </View>
    </View>
  );

  function getStatusStyle(status: string) {
    switch (status) {
      case 'pending': return styles.badgePending;
      case 'picking': return styles.badgePicking;
      case 'packed': return styles.badgePacked;
      case 'shipped': return styles.badgeShipped;
      default: return {};
    }
  }

  if (loading && !refreshing && orders.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingLabel}>Loading orders…</Text>
      </View>
    );
  }

  const applySort = (value: string, order: 'asc' | 'desc') => {
    setSortBy(value);
    setSortOrder(order);
    setShowFilters(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.filterBar}
        onPress={() => setShowFilters((v) => !v)}
        activeOpacity={0.7}
      >
        <Filter size={18} color={theme.colors.primary} strokeWidth={2} />
        <Text style={styles.filterBarText}>
          {statusFilter ? STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? statusFilter : 'All status'}
          {' · '}
          {SORT_OPTIONS.find((o) => o.value === sortBy && o.order === sortOrder)?.label ?? 'Newest'}
        </Text>
        <Text style={styles.filterBarHint}>{showFilters ? 'Tap to close' : 'Tap to filter'}</Text>
      </TouchableOpacity>

      {showFilters ? (
        <View style={styles.filterPanel}>
          <Text style={styles.filterSectionLabel}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value || 'all'}
                style={[styles.filterChip, (!opt.value && !statusFilter) || statusFilter === opt.value ? styles.filterChipActive : null]}
                onPress={() => {
                  setStatusFilter(opt.value);
                  setShowFilters(false);
                }}
              >
                <Text style={[styles.filterChipText, (!opt.value && !statusFilter) || statusFilter === opt.value ? styles.filterChipTextActive : null]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.filterSectionLabel}>Sort by</Text>
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={`${opt.value}-${opt.order}`}
                style={[styles.sortChip, sortBy === opt.value && sortOrder === opt.order ? styles.sortChipActive : null]}
                onPress={() => applySort(opt.value, opt.order)}
              >
                {opt.order === 'desc' ? (
                  <ArrowDown size={14} color={sortBy === opt.value && sortOrder === opt.order ? '#fff' : theme.colors.textSecondary} />
                ) : (
                  <ArrowUp size={14} color={sortBy === opt.value && sortOrder === opt.order ? '#fff' : theme.colors.textSecondary} />
                )}
                <Text style={[styles.sortChipText, sortBy === opt.value && sortOrder === opt.order ? styles.sortChipTextActive : null]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, orders.length === 0 && styles.emptyContainer]}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadOrders(true)}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              No orders yet. Orders will appear here once created.
            </Text>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.footerLoaderText}>Loading more…</Text>
            </View>
          ) : orders.length > 0 && !hasMore && total > 0 ? (
            <View style={styles.footerEnd}>
              <Text style={styles.footerEndText}>
                Showing all {total} order{total !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    gap: theme.spacing.md,
  },
  loadingLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  errorBanner: {
    margin: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.errorDim,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorText: {
    color: theme.colors.error,
    ...theme.typography.bodySmall,
  },
  card: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  orderId: {
    ...theme.typography.label,
    color: theme.colors.text,
    flex: 1,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.borderStrong,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  badgePending: { backgroundColor: 'rgba(251, 191, 36, 0.35)' },
  badgePicking: { backgroundColor: theme.colors.primaryDim },
  badgePacked: { backgroundColor: 'rgba(52, 211, 153, 0.35)' },
  badgeShipped: { backgroundColor: theme.colors.successDim },
  customer: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  rowMeta: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  meta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  emptyText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  footerLoaderText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  footerEnd: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  footerEndText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  headerButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  headerButtonText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundCard,
  },
  filterBarText: {
    ...theme.typography.label,
    color: theme.colors.text,
    flex: 1,
  },
  filterBarHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  filterPanel: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundElevated,
  },
  filterSectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  filterChips: {
    marginBottom: theme.spacing.md,
  },
  filterChip: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.sm,
  },
  filterChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryDim,
  },
  filterChipText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  sortChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  sortChipText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
  },
  sortChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default OrdersListScreen;
