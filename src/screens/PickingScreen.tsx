import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertTriangle, CheckCircle, Clock, Package, PlayCircle, PlusCircle, ScanBarcode } from 'lucide-react-native';
import type { MainTabParamList, PickingStackParamList } from '../navigation/types';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useDebugStore } from '../store/debugStore';
import { formatApiError } from '../utils/formatApiError';
import { theme } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Picking'>,
  NativeStackScreenProps<PickingStackParamList, 'PickingRoot'>
>;

type Tote = {
  id: string;
  barcode: string;
  name: string;
  status: string;
  current_batch_id?: string | null;
};

type PickListItem = {
  batch_item_id: string;
  sku_id: string;
  sku_code?: string | null;
  sku_name?: string | null;
  primary_image_url?: string | null;
  location?: string | null;
  location_id?: string | null;
  quantity_required?: number;
  total_quantity_required?: number;
  quantity_picked?: number;
  remaining_to_pick?: number;
  status?: string;
  order_id?: string | null;
  shopify_order_name?: string | null;
};

type CategoryCounts = { total: number; single_item: number; multi_item: number };
type AvailableOrdersResponse = { available_orders?: Record<string, CategoryCounts> };
type CreateDynamicResponse = { batch_id: string; orders_included?: number; message?: string };

type BatchListItem = {
  id: string;
  status: string;
  batch_type?: string | null;
  orders_count?: number;
  total_items?: number;
  items_picked?: number;
  created_at?: string | null;
  primary_tote?: { id: string; barcode?: string; name?: string } | null;
};

/** Skipped items (hospital / no location) returned with pick-list API */
type SkippedPickItem = {
  sku_id: string;
  sku_code?: string | null;
  sku_name?: string | null;
  reason?: string | null;
  order_id?: string | null;
  shopify_order_name?: string | null;
  hospital?: boolean;
  primary_image_url?: string | null;
};
type BatchesListResponse = { items?: BatchListItem[]; total?: number; skip?: number; limit?: number };

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Orders',
  marketing: 'Marketing',
  international: 'International',
  standard: 'Standard',
  priority: 'Priority',
  wholesale: 'Wholesale',
  default: 'Standard',
};

type PickingMode = 'start' | 'create' | 'picking';

const PickingScreen: React.FC<Props> = ({ navigation, route }) => {
  const user = useAuthStore((s) => s.user);
  const debugEnabled = useDebugStore((s) => s.enabled);

  const [mode, setMode] = useState<PickingMode>('start');
  const [toteBarcode, setToteBarcode] = useState('');
  const [tote, setTote] = useState<Tote | null>(null);
  const [batchId, setBatchId] = useState('');
  const [batchType, setBatchType] = useState<'single_item' | 'multi_item' | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickList, setPickList] = useState<PickListItem[]>([]);
  const [skippedItems, setSkippedItems] = useState<SkippedPickItem[]>([]);
  const [dashboardStats, setDashboardStats] = useState<{ pending: number; picking: number; packed: number; shipped: number; total: number } | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create batch state
  const [availableData, setAvailableData] = useState<Record<string, CategoryCounts> | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBatchType, setSelectedBatchType] = useState<'single_item' | 'multi_item' | null>(null);
  const [orderCount, setOrderCount] = useState(10);

  // Batches list (on start view)
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesRefreshing, setBatchesRefreshing] = useState(false);
  const [batchActionLoading, setBatchActionLoading] = useState<{ id: string; action: 'reset' | 'delete' } | null>(null);

  // Completion celebration (after batch complete)
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);

  const canPick = useMemo(() => user?.id && batchId.trim().length > 0, [user?.id, batchId]);

  const categories = useMemo(() => (availableData ? Object.keys(availableData) : []), [availableData]);
  const selectedCatData = selectedCategory && availableData ? availableData[selectedCategory] : null;
  const maxOrders = useMemo(() => {
    if (!selectedCatData || !selectedBatchType) return 0;
    return selectedBatchType === 'single_item' ? selectedCatData.single_item : selectedCatData.multi_item;
  }, [selectedCatData, selectedBatchType]);

  const loadAvailableOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AvailableOrdersResponse>('/api/picking/batches/available-orders');
      const data = res.data?.available_orders ?? res.data;
      if (data && typeof data === 'object') {
        setAvailableData(data as Record<string, CategoryCounts>);
        if (!selectedCategory || !(data as Record<string, CategoryCounts>)[selectedCategory]) {
          setSelectedCategory('all');
        }
        setSelectedBatchType(null);
        setOrderCount(10);
      } else {
        setAvailableData(null);
      }
    } catch (e) {
      console.error(e);
      const formatted = formatApiError(e);
      setError(debugEnabled ? `${formatted.message} (${formatted.title})` : 'Failed to load available orders.');
      setAvailableData(null);
    } finally {
      setLoading(false);
    }
  }, [debugEnabled, selectedCategory]);

  const loadBatches = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setBatchesRefreshing(true);
    else setBatchesLoading(true);
    try {
      const res = await api.get<BatchesListResponse>('/api/picking/batches', {
        params: { limit: 30, sort: 'created_at', order: 'desc', status: 'pending,in_progress' },
      });
      const list = res.data?.items ?? [];
      setBatches(Array.isArray(list) ? list : []);
    } catch {
      setBatches([]);
    } finally {
      setBatchesLoading(false);
      setBatchesRefreshing(false);
    }
  }, []);

  const resetBatch = useCallback(async (id: string) => {
    Alert.alert(
      'Reset batch',
      'Clear all picks and reset this batch so it can be started again? Totes will be released.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setError(null);
            setBatchActionLoading({ id, action: 'reset' });
            try {
              await api.post(`/api/picking/batches/${encodeURIComponent(id)}/reset`);
              await loadBatches();
              Alert.alert('Batch reset', 'The batch was reset and is ready to be started again.');
            } catch (e: any) {
              const formatted = formatApiError(e);
              setError(formatted.message);
              Alert.alert('Reset failed', formatted.message);
            } finally {
              setBatchActionLoading((curr) => (curr?.id === id && curr.action === 'reset' ? null : curr));
            }
          },
        },
      ]
    );
  }, [loadBatches]);

  const deleteBatch = useCallback(async (id: string) => {
    Alert.alert(
      'Delete batch',
      'Permanently remove this batch? Orders will be released for new batches. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError(null);
            setBatchActionLoading({ id, action: 'delete' });
            try {
              await api.delete(`/api/picking/batches/${encodeURIComponent(id)}`, { params: { force: true } });
              await loadBatches();
              Alert.alert('Batch deleted', 'The batch was deleted successfully.');
            } catch (e: any) {
              const formatted = formatApiError(e);
              setError(formatted.message);
              Alert.alert('Delete failed', formatted.message);
            } finally {
              setBatchActionLoading((curr) => (curr?.id === id && curr.action === 'delete' ? null : curr));
            }
          },
        },
      ]
    );
  }, [loadBatches]);

  useEffect(() => {
    if (mode === 'create') {
      void loadAvailableOrders();
    }
  }, [mode, loadAvailableOrders]);

  useEffect(() => {
    if (mode === 'start') {
      void loadBatches();
    }
  }, [mode, loadBatches]);

  const loadDashboardStats = useCallback(async () => {
    try {
      const res = await api.get<{ pending: number; picking: number; packed: number; shipped: number; total: number }>('/api/orders/stats/dashboard');
      setDashboardStats(res.data ?? null);
    } catch {
      setDashboardStats(null);
    }
  }, []);

  useEffect(() => {
    if (mode === 'start') {
      void loadDashboardStats();
    }
  }, [mode, loadDashboardStats]);

  const createBatch = useCallback(async () => {
    if (!selectedCategory || !selectedBatchType || orderCount <= 0 || orderCount > maxOrders) return;
    setLoading(true);
    setError(null);
    try {
      const categoryValue = selectedCategory === 'default' ? 'others' : selectedCategory;
      const res = await api.post<CreateDynamicResponse>('/api/picking/batches/create-dynamic', {
        order_count: orderCount,
        batch_type: selectedBatchType,
        categories: [categoryValue],
      });
      const id = res.data?.batch_id;
      if (id) {
        setBatchId(id);
        setBatchType(selectedBatchType);
        setMode('picking');
        setPickList([]);
        setTote(null);
        setToteBarcode('');
        void loadPickListForBatch(id);
      } else {
        setError('No batch ID in response.');
      }
    } catch (e: any) {
      console.error(e);
      const formatted = formatApiError(e);
      setError(debugEnabled ? `${formatted.message} (${formatted.title})` : formatted.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedBatchType, orderCount, maxOrders, debugEnabled]);

  const loadPickListForBatch = useCallback(async (id: string) => {
    try {
      const res = await api.get<any>(`/api/picking/batches/${encodeURIComponent(id)}/pick-list`, {
        params: { totes: 1 },
      });
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.pick_list;
      setPickList(Array.isArray(list) ? list : []);
      setSkippedItems(Array.isArray(data?.skipped_items) ? data.skipped_items : []);
    } catch {
      setPickList([]);
      setSkippedItems([]);
    }
  }, []);

  // Handle scanner return params
  useEffect(() => {
    const params = route.params as any;
    const scannedField = params?.scannedField;
    const scannedValue = params?.scannedValue;
    if (!scannedField || !scannedValue) return;

    if (scannedField === 'tote') {
      setToteBarcode(scannedValue);
    }

    if (scannedField === 'item') {
      void scanPickItem(scannedValue);
    }

    // Clear so we don't re-process; use empty string so SET_PARAMS payload is non-empty (avoids navigator error)
    navigation.setParams({ scannedField: '', scannedValue: '' } as any);
  }, [route.params]);

  const lookupTote = async () => {
    const barcode = toteBarcode.trim();
    if (!barcode) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Tote>(`/api/picking/totes/barcode/${encodeURIComponent(barcode)}`);
      setTote(res.data);
      const bid = res.data.current_batch_id || '';
      if (bid) {
        setBatchId(bid);
        setMode('picking');
        void loadPickListForBatch(bid);
      } else {
        setBatchId('');
        setError('Tote has no batch assigned.');
      }
    } catch (e) {
      console.error(e);
      const formatted = formatApiError(e);
      setError(debugEnabled ? `${formatted.message} (${formatted.title})` : 'Tote not found or server error.');
      setTote(null);
      setBatchId('');
    } finally {
      setLoading(false);
    }
  };

  const loadPickList = async () => {
    if (!batchId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<any>(`/api/picking/batches/${encodeURIComponent(batchId.trim())}/pick-list`, {
        params: { totes: 1 },
      });
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.pick_list;
      setPickList(Array.isArray(list) ? list : []);
      setSkippedItems(Array.isArray(data?.skipped_items) ? data.skipped_items : []);
    } catch (e) {
      console.error(e);
      const formatted = formatApiError(e);
      setError(debugEnabled ? `${formatted.message} (${formatted.title})` : 'Unable to load pick list.');
      setPickList([]);
      setSkippedItems([]);
    } finally {
      setLoading(false);
    }
  };

  const skipOrderInBatch = useCallback(
    async (orderId: string, reason: string) => {
      if (!batchId.trim()) return;
      setError(null);
      try {
        await api.post(`/api/picking/batches/${encodeURIComponent(batchId.trim())}/skip-order`, {
          order_id: orderId,
          reason,
        });
        await loadPickList();
      } catch (e: any) {
        const formatted = formatApiError(e);
        setError(formatted.message);
      }
    },
    [batchId, loadPickList]
  );

  const pickWithQuantity = async (barcode: string, quantityPicked: number) => {
    if (!user?.id) {
      setError('You must be signed in to pick items.');
      return;
    }
    if (!batchId.trim()) {
      setError('No batch selected.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/picking/batches/${encodeURIComponent(batchId.trim())}/scan_item`, {
        barcode,
        quantity_picked: quantityPicked,
        picker_id: user.id,
      });
      await loadPickListForBatch(batchId.trim());
    } catch (e: any) {
      console.error(e);
      const formatted = formatApiError(e);
      setError(debugEnabled ? `${formatted.message} (${formatted.title})` : formatted.message);
    } finally {
      setLoading(false);
    }
  };

  const scanPickItem = async (barcode: string) => {
    const candidate =
      pickList.find((i) => i.sku_id === barcode || i.sku_code === barcode) ??
      (currentItem && (currentItem.sku_id === barcode || currentItem.sku_code === barcode) ? currentItem : null) ??
      currentItem;

    const required = candidate ? (candidate.total_quantity_required ?? candidate.quantity_required ?? 0) : 0;
    const picked = candidate?.quantity_picked ?? 0;
    const remaining = Math.max(0, required - picked);

    // Backend expects cumulative quantity_picked, not an increment.
    const defaultCumulative = required > 0 ? Math.min(required, picked + 1) : 1;

    if (required > 1 && remaining > 1) {
      const maxQuick = Math.min(4, remaining);
      const quickOptions = Array.from({ length: maxQuick }, (_, idx) => idx + 1);
      const actions = quickOptions.map((n) => ({
        text: String(n),
        onPress: () => {
          void pickWithQuantity(barcode, Math.min(required, picked + n));
        },
      }));
      actions.push({
        text: `All (${remaining})`,
        onPress: () => {
          void pickWithQuantity(barcode, required);
        },
      });

      Alert.alert('Confirm quantity', `How many did you pick now?\nRequired: ${required} • Already picked: ${picked}`, [
        { text: 'Cancel', style: 'cancel' },
        ...actions,
      ]);
      return;
    }

    await pickWithQuantity(barcode, defaultCumulative);
  };

  const completeBatch = async () => {
    if (!user?.id) return;
    if (!batchId.trim() || !toteBarcode.trim()) {
      setError('Batch and tote are required to complete.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/picking/batches/${encodeURIComponent(batchId.trim())}/complete`, {
        tote_barcode: toteBarcode.trim(),
        picker_id: user.id,
      });
      setShowCompletionScreen(true);
    } catch (e: any) {
      console.error(e);
      const formatted = formatApiError(e);
      setError(debugEnabled ? `${formatted.message} (${formatted.title})` : formatted.message);
    } finally {
      setLoading(false);
    }
  };

  const dismissCompletionAndStartNew = () => {
    setShowCompletionScreen(false);
    setPickList([]);
    setSkippedItems([]);
    setBatchId('');
    setBatchType(null);
    setTote(null);
    setToteBarcode('');
    setMode('start');
  };

  const startNewBatch = () => {
    setMode('start');
    setBatchId('');
    setBatchType(null);
    setPickList([]);
    setSkippedItems([]);
    setTote(null);
    setToteBarcode('');
    setError(null);
    setSelectedCategory('all');
    setSelectedBatchType(null);
    setOrderCount(10);
    void loadBatches();
  };

  const openBatch = useCallback(
    (b: BatchListItem) => {
      setBatchId(b.id);
      setBatchType(b.batch_type === 'multi_item' ? 'multi_item' : b.batch_type === 'single_item' ? 'single_item' : null);
      setPickList([]);
      setSkippedItems([]);
      setMode('picking');
      if (b.primary_tote) {
        setTote({
          id: b.primary_tote.id,
          barcode: b.primary_tote.barcode ?? '',
          name: b.primary_tote.name ?? '',
          status: 'active',
          current_batch_id: b.id,
        });
        setToteBarcode(b.primary_tote.barcode ?? '');
      } else {
        setTote(null);
        setToteBarcode('');
      }
      void loadPickListForBatch(b.id);
    },
    [loadPickListForBatch]
  );

  const formatBatchDate = (raw: string | null | undefined) => {
    if (!raw) return '—';
    try {
      const d = new Date(raw);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return raw;
    }
  };

  const quickStartBatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AvailableOrdersResponse>('/api/picking/batches/available-orders');
      const data = res.data?.available_orders ?? res.data;
      const d = data as Record<string, CategoryCounts> | undefined;
      const allData = d?.all ?? d?.default;
      const count = allData ? Math.min(10, allData.single_item || allData.multi_item || 1) : 10;
      const orderCountToUse = count < 1 ? 10 : count;
      const categoryPayload = d?.all ? 'all' : 'others';
      const createRes = await api.post<CreateDynamicResponse>('/api/picking/batches/create-dynamic', {
        order_count: orderCountToUse,
        batch_type: 'single_item',
        categories: [categoryPayload],
      });
      const id = createRes.data?.batch_id;
      if (id) {
        setBatchId(id);
        setBatchType('single_item');
        setMode('picking');
        setPickList([]);
        setTote(null);
        setToteBarcode('');
        void loadPickListForBatch(id);
      } else {
        setError('Could not create batch. Try custom batch.');
      }
    } catch (e: any) {
      const formatted = formatApiError(e);
      setError(formatted.message);
    } finally {
      setLoading(false);
    }
  };

  const totalItems = useMemo(() => pickList.reduce((n, i) => n + (i.total_quantity_required ?? i.quantity_required ?? 0), 0), [pickList]);
  const pickedCount = useMemo(() => pickList.reduce((n, i) => n + (i.quantity_picked ?? 0), 0), [pickList]);
  const remainingCount = useMemo(
    () => pickList.reduce((n, i) => n + (i.remaining_to_pick ?? Math.max(0, (i.total_quantity_required ?? i.quantity_required ?? 0) - (i.quantity_picked ?? 0))), 0),
    [pickList]
  );
  const allPicked = pickList.length > 0 && remainingCount === 0;

  // Current item (first remaining) and step position for "Item X of Y"
  const remainingItems = useMemo(
    () =>
      pickList.filter((i) => {
        const req = i.total_quantity_required ?? i.quantity_required ?? 0;
        const picked = i.quantity_picked ?? 0;
        return req > 0 && picked < req;
      }),
    [pickList]
  );
  const currentItem = remainingItems[0] ?? null;
  const currentStepOfTotal = useMemo(
    () => (remainingItems.length > 0 ? { step: 1, total: remainingItems.length } : { step: 0, total: 0 }),
    [remainingItems.length]
  );
  // ShipHero: "orders in batch" (lower left) — unique orders for multi-item, 1 for single-item
  const ordersInBatch = useMemo(() => {
    if (batchType === 'multi_item' && pickList.length > 0) {
      const ids = new Set(pickList.map((i) => i.order_id).filter(Boolean));
      return ids.size;
    }
    return pickList.length > 0 ? 1 : 0;
  }, [batchType, pickList]);

  // ——— Start view: ShipHero layout — user, dashboard, three options, batches, resume tote ———
  if (mode === 'start') {
    const displayName = user?.full_name || user?.username || 'Picker';
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.startContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={batchesRefreshing}
            onRefresh={() => {
              loadBatches(true);
              loadDashboardStats();
            }}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Text style={styles.shipHeroUserName}>{displayName}</Text>
        <Text style={styles.shipHeroUserSubtitle}>Ready to ship</Text>

        {dashboardStats !== null && (
          <View style={styles.dashboardCard}>
            <Text style={styles.dashboardCardTitle}>Orders</Text>
            <View style={styles.dashboardCardRow}>
              <View style={styles.dashboardStat}>
                <Text style={styles.dashboardStatValue}>{dashboardStats.pending}</Text>
                <Text style={styles.dashboardStatLabel}>Pending</Text>
              </View>
              <View style={styles.dashboardStat}>
                <Text style={styles.dashboardStatValue}>{dashboardStats.picking}</Text>
                <Text style={styles.dashboardStatLabel}>Picking</Text>
              </View>
              <View style={styles.dashboardStat}>
                <Text style={styles.dashboardStatValue}>{dashboardStats.packed}</Text>
                <Text style={styles.dashboardStatLabel}>Packed</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.shipHeroOptionsTitle}>Picking</Text>
        <Text style={styles.shipHeroOptionsSubtitle}>Select a batch picking style</Text>

        <TouchableOpacity
          style={styles.shipHeroOptionCard}
          onPress={() => {
            setOrderCount(1);
            setSelectedBatchType(null);
            setMode('create');
          }}
          activeOpacity={0.9}
        >
          <Package size={28} color={theme.colors.primary} strokeWidth={2} />
          <Text style={styles.shipHeroOptionTitle}>Single Order</Text>
          <Text style={styles.shipHeroOptionHint}>Pick and ship one order at a time</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shipHeroOptionCard}
          onPress={() => {
            setSelectedBatchType('multi_item');
            setMode('create');
          }}
          activeOpacity={0.9}
        >
          <ScanBarcode size={28} color={theme.colors.primary} strokeWidth={2} />
          <Text style={styles.shipHeroOptionTitle}>Multi-Item Batch</Text>
          <Text style={styles.shipHeroOptionHint}>Pick multiple orders, each into a different tote</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shipHeroOptionCard, styles.shipHeroOptionCardPrimary]}
          onPress={() => void quickStartBatch()}
          disabled={loading}
          activeOpacity={0.9}
        >
          <ScanBarcode size={28} color="#fff" strokeWidth={2} />
          <Text style={styles.shipHeroOptionTitlePrimary}>Single Item Batch</Text>
          <Text style={styles.shipHeroOptionHintPrimary}>Pick several single-SKU orders into the same tote</Text>
        </TouchableOpacity>

        <View style={styles.batchesSection}>
          <Text style={styles.batchesSectionTitle}>Batches</Text>
          {batchesLoading && batches.length === 0 ? (
            <View style={styles.batchesLoadingWrap}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.batchesLoadingText}>Loading batches…</Text>
            </View>
          ) : batches.length === 0 ? (
            <View style={styles.batchesEmptyWrap}>
              <View style={styles.batchesEmptyIconWrap}>
                <Package size={32} color={theme.colors.textMuted} strokeWidth={1.5} />
              </View>
              <Text style={styles.batchesEmptyTitle}>No active batches</Text>
              <Text style={styles.batchesEmptyText}>Create one above or scan a tote to resume.</Text>
            </View>
          ) : (
            batches.map((b) => {
              const total = b.total_items ?? 0;
              const picked = b.items_picked ?? 0;
              const progress = total > 0 ? `${picked}/${total}` : '—';
              const statusLabel = b.status === 'in_progress' ? 'In progress' : b.status === 'pending' ? 'Pending' : b.status === 'completed' ? 'Completed' : b.status;
              const statusStyle = b.status === 'in_progress' ? styles.batchRowStatusInProgress : b.status === 'completed' ? styles.batchRowStatusCompleted : styles.batchRowStatusPending;
              const isResetting = batchActionLoading?.id === b.id && batchActionLoading.action === 'reset';
              const isDeleting = batchActionLoading?.id === b.id && batchActionLoading.action === 'delete';
              const rowActionBusy = isResetting || isDeleting;
              return (
                <View key={b.id} style={[styles.batchRow, statusStyle]}>
                  <TouchableOpacity
                    style={styles.batchRowMainTouchable}
                    onPress={() => openBatch(b)}
                    disabled={rowActionBusy}
                    activeOpacity={0.8}
                  >
                    <View style={styles.batchRowMain}>
                      <Text style={styles.batchRowId} numberOfLines={1}>{b.id}</Text>
                      <Text style={styles.batchRowMeta}>
                        {b.orders_count ?? 0} orders · {progress} items
                      </Text>
                    </View>
                    <View style={styles.batchRowStatusWrap}>
                      <View style={[styles.batchRowStatusBadge, b.status === 'in_progress' && styles.batchRowStatusBadgeInProgress, b.status === 'completed' && styles.batchRowStatusBadgeCompleted]}>
                        {b.status === 'in_progress' ? (
                          <PlayCircle size={14} color={theme.colors.primary} strokeWidth={2} style={styles.batchRowStatusIcon} />
                        ) : b.status === 'completed' ? (
                          <CheckCircle size={14} color={theme.colors.success} strokeWidth={2} style={styles.batchRowStatusIcon} />
                        ) : (
                          <Clock size={14} color={theme.colors.textMuted} strokeWidth={2} style={styles.batchRowStatusIcon} />
                        )}
                        <Text style={[styles.batchRowStatusText, b.status === 'in_progress' && styles.batchRowStatusTextInProgress, b.status === 'completed' && styles.batchRowStatusTextCompleted]}>{statusLabel}</Text>
                      </View>
                      <Text style={styles.batchRowDate}>{formatBatchDate(b.created_at)}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.batchRowAction, rowActionBusy && styles.batchRowActionDisabled]}
                    onPress={() => resetBatch(b.id)}
                    disabled={rowActionBusy}
                  >
                    {isResetting ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Text style={styles.batchRowActionText}>Reset</Text>}
                  </TouchableOpacity>
                  {b.status !== 'completed' ? (
                    <TouchableOpacity
                      style={[styles.batchRowAction, styles.batchRowActionDanger, rowActionBusy && styles.batchRowActionDisabled]}
                      onPress={() => deleteBatch(b.id)}
                      disabled={rowActionBusy}
                    >
                      {isDeleting ? <ActivityIndicator size="small" color={theme.colors.error} /> : <Text style={styles.batchRowActionTextDanger}>Delete</Text>}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.toteResumeSection}>
          <Text style={styles.toteResumeLabel}>Resume with tote</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={toteBarcode}
              placeholder="Scan or enter tote barcode"
              placeholderTextColor={theme.colors.textMuted}
              onChangeText={setToteBarcode}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => navigation.navigate('Scanner', { returnTo: 'PickingRoot', field: 'tote', title: 'Tote' })}
            >
              <ScanBarcode size={20} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.secondaryButtonBlock} onPress={() => void lookupTote()}>
            <Text style={styles.secondaryButtonText}>Lookup tote</Text>
          </TouchableOpacity>
        </View>

        {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
        {loading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={theme.colors.primary} /><Text style={styles.loadingText}>Creating batch…</Text></View> : null}
      </ScrollView>
    );
  }

  // ——— Create batch flow: category → batch type → order count ———
  if (mode === 'create') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.createContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.createBackLink} onPress={() => setMode('start')} activeOpacity={0.8}>
          <Text style={styles.createBackLinkText}>← Back to picking</Text>
        </TouchableOpacity>
        <View style={styles.createHero}>
          <Text style={styles.createTitle}>Create batch</Text>
          <Text style={styles.createSubtitle}>Choose category, type, and how many orders to pick</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && !availableData ? (
          <View style={styles.createLoadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading available orders…</Text>
          </View>
        ) : availableData && categories.length > 0 ? (
          <>
            <View style={styles.createSection}>
              <View style={styles.createSectionHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <Text style={styles.createSectionTitle}>Category</Text>
              </View>
              <View style={styles.categoryRow}>
                {categories.map((cat) => {
                  const d = availableData[cat];
                  if (!d) return null;
                  const isSelected = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                      onPress={() => {
                        setSelectedCategory(cat);
                        setSelectedBatchType(null);
                        setOrderCount(10);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                        {CATEGORY_LABELS[cat] || cat}
                      </Text>
                      <Text style={[styles.categoryChipMeta, isSelected && styles.categoryChipMetaSelected]}>
                        Single: {d.single_item}  ·  Multi: {d.multi_item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {selectedCatData && (
              <>
                <View style={styles.createSection}>
                  <View style={styles.createSectionHeader}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>2</Text>
                    </View>
                    <Text style={styles.createSectionTitle}>Batch type</Text>
                  </View>
                  <View style={styles.batchTypeRow}>
                    <TouchableOpacity
                      style={[
                        styles.batchTypeChip,
                        selectedBatchType === 'single_item' && styles.batchTypeChipSelected,
                        selectedCatData.single_item === 0 && styles.batchTypeChipDisabled,
                      ]}
                      onPress={() => {
                        setSelectedBatchType('single_item');
                        setOrderCount(Math.min(10, selectedCatData.single_item));
                      }}
                      disabled={selectedCatData.single_item === 0}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.batchTypeIconWrap, selectedBatchType === 'single_item' && styles.batchTypeIconWrapSelected]}>
                        <Package size={24} color={selectedBatchType === 'single_item' ? '#fff' : theme.colors.primary} strokeWidth={2} />
                      </View>
                      <Text style={[styles.batchTypeText, selectedBatchType === 'single_item' && styles.batchTypeTextSelected]}>
                        Single item
                      </Text>
                      <Text style={[styles.batchTypeMeta, selectedBatchType === 'single_item' && styles.batchTypeMetaSelected]}>
                        {selectedCatData.single_item} orders
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.batchTypeChip,
                        selectedBatchType === 'multi_item' && styles.batchTypeChipSelected,
                        selectedCatData.multi_item === 0 && styles.batchTypeChipDisabled,
                      ]}
                      onPress={() => {
                        setSelectedBatchType('multi_item');
                        setOrderCount(Math.min(10, selectedCatData.multi_item));
                      }}
                      disabled={selectedCatData.multi_item === 0}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.batchTypeIconWrap, selectedBatchType === 'multi_item' && styles.batchTypeIconWrapSelected]}>
                        <Package size={24} color={selectedBatchType === 'multi_item' ? '#fff' : theme.colors.primary} strokeWidth={2} />
                      </View>
                      <Text style={[styles.batchTypeText, selectedBatchType === 'multi_item' && styles.batchTypeTextSelected]}>
                        Multi item
                      </Text>
                      <Text style={[styles.batchTypeMeta, selectedBatchType === 'multi_item' && styles.batchTypeMetaSelected]}>
                        {selectedCatData.multi_item} orders
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {selectedBatchType && maxOrders > 0 && (
                  <View style={styles.createSection}>
                    <View style={styles.createSectionHeader}>
                      <View style={styles.stepBadge}>
                        <Text style={styles.stepBadgeText}>3</Text>
                      </View>
                      <Text style={styles.createSectionTitle}>Number of orders</Text>
                      <Text style={styles.createSectionHint}>Max {maxOrders} for this type</Text>
                    </View>
                    <View style={styles.orderCountCard}>
                      <View style={styles.orderCountRow}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => setOrderCount((c) => Math.max(1, c - 1))}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.stepperText}>−</Text>
                        </TouchableOpacity>
                        <View style={styles.orderCountValueWrap}>
                          <Text style={styles.orderCountValue}>{orderCount}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => setOrderCount((c) => Math.min(maxOrders, c + 1))}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.stepperText}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.quickCountRow}>
                        {[5, 10, 15, 20, 25].map((n) => (
                          <TouchableOpacity
                            key={n}
                            style={[styles.quickCountBtn, orderCount === n && styles.quickCountBtnSelected]}
                            onPress={() => setOrderCount(Math.min(maxOrders, n))}
                            disabled={n > maxOrders}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.quickCountText, orderCount === n && styles.quickCountTextSelected]}>{n}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.createActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setMode('start')} activeOpacity={0.85}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.createButton, (!selectedBatchType || orderCount <= 0 || loading) && styles.disabled]}
                    onPress={() => void createBatch()}
                    disabled={!selectedBatchType || orderCount <= 0 || loading}
                    activeOpacity={0.9}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={styles.createButtonContent}>
                        <Text style={styles.createButtonText}>Create batch</Text>
                        <Text style={styles.createButtonSubtext}>{orderCount} orders</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.createEmptyWrap}>
            <Text style={styles.emptyText}>No orders available for picking.</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ——— Picking view: ShipHero-style — progress, one primary CTA, list, complete ———
  const needsTote = !toteBarcode.trim();
  const primaryScanTote = () =>
    navigation.navigate('Scanner', { returnTo: 'PickingRoot', field: 'tote', title: 'Scan tote' });
  const primaryScanItem = () =>
    navigation.navigate('Scanner', { returnTo: 'PickingRoot', field: 'item', title: 'Scan item' });

  // ——— Completion celebration overlay ———
  if (showCompletionScreen) {
    return (
      <View style={styles.completionOverlay}>
        <View style={styles.completionCard}>
          <View style={styles.completionIconWrap}>
            <Package size={48} color={theme.colors.success} strokeWidth={2} />
          </View>
          <Text style={styles.completionTitle}>Batch complete!</Text>
          <Text style={styles.completionSubtitle}>All items picked. Ready for the next batch.</Text>
          <TouchableOpacity style={styles.completionButton} onPress={dismissCompletionAndStartNew} activeOpacity={0.9}>
            <Text style={styles.completionButtonText}>New batch</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const batchShortId = batchId.trim() ? `#${batchId.slice(-8)}` : '—';
  const workflowStep = needsTote ? 1 : allPicked ? 3 : 2; // 1 Tote, 2 Picking, 3 Complete

  return (
    <View style={styles.container}>
      <View style={styles.pickingTopRow}>
        <TouchableOpacity style={styles.startNewLink} onPress={startNewBatch}>
          <Text style={styles.startNewLinkText}>← New batch</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.progressButton} onPress={() => setShowProgressModal(true)}>
          <Text style={styles.progressButtonText}>Progress</Text>
        </TouchableOpacity>
      </View>

      {/* Batch header: short id + type badge */}
      {batchId.trim() ? (
        <View style={styles.batchHeader}>
          <Text style={styles.batchHeaderLabel}>Batch</Text>
          <Text style={styles.batchHeaderId}>{batchShortId}</Text>
          {batchType ? (
            <View style={[styles.batchTypeBadge, batchType === 'multi_item' && styles.batchTypeBadgeMulti]}>
              <Text style={[styles.batchTypeBadgeText, batchType === 'multi_item' && styles.batchTypeBadgeTextMulti]}>
                {batchType === 'single_item' ? 'Single item' : 'Multi item'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Workflow steps: Tote → Picking → Complete */}
      <View style={styles.workflowStrip}>
        {['Tote', 'Picking', 'Complete'].map((label, idx) => {
          const step = idx + 1;
          const done = step < workflowStep;
          const active = step === workflowStep;
          return (
            <View key={label} style={[styles.workflowStep, active && styles.workflowStepActive, done && styles.workflowStepDone]}>
              {done ? <Text style={styles.workflowStepCheck}>✓</Text> : <Text style={[styles.workflowStepNum, active && styles.workflowStepNumActive]}>{step}</Text>}
              <Text style={[styles.workflowStepLabel, active && styles.workflowStepLabelActive, done && styles.workflowStepLabelDone]}>{label}</Text>
            </View>
          );
        })}
      </View>

      {/* Progress bar + ShipHero-style footer: lower-left orders, lower-right remaining items */}
      {pickList.length > 0 && (
        <>
          <View style={styles.progressStrip}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${totalItems ? Math.min(100, (pickedCount / totalItems) * 100) : 0}%` }]} />
            </View>
          </View>
          <View style={styles.shipHeroFooter}>
            <View style={styles.shipHeroFooterLeft}>
              <Text style={styles.shipHeroFooterValue}>{ordersInBatch}</Text>
              <Text style={styles.shipHeroFooterLabel}>Orders in batch</Text>
            </View>
            <View style={styles.shipHeroFooterRight}>
              <Text style={styles.shipHeroFooterValue}>{remainingCount}</Text>
              <Text style={styles.shipHeroFooterLabel}>Items left</Text>
            </View>
          </View>
        </>
      )}

      {/* Progress modal: orders, totes, items left, Complete, Back */}
      <Modal visible={showProgressModal} transparent animationType="fade">
        <TouchableOpacity style={styles.progressModalOverlay} activeOpacity={1} onPress={() => setShowProgressModal(false)}>
          <TouchableOpacity style={styles.progressModalContent} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.progressModalTitle}>Progress</Text>
            <View style={styles.progressModalRow}>
              <Text style={styles.progressModalLabel}>Orders in batch</Text>
              <Text style={styles.progressModalValue}>{ordersInBatch}</Text>
            </View>
            <View style={styles.progressModalRow}>
              <Text style={styles.progressModalLabel}>Totes</Text>
              <Text style={styles.progressModalValue}>{tote ? 1 : 0}</Text>
            </View>
            <View style={styles.progressModalRow}>
              <Text style={styles.progressModalLabel}>Items left</Text>
              <Text style={styles.progressModalValue}>{remainingCount}</Text>
            </View>
            <View style={styles.progressModalActions}>
              <TouchableOpacity style={styles.progressModalCompleteButton} onPress={() => { setShowProgressModal(false); void completeBatch(); }}>
                <Text style={styles.progressModalCompleteText}>Complete batch</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.progressModalBackButton} onPress={() => setShowProgressModal(false)}>
                <Text style={styles.progressModalBackText}>Back</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Current item hero card — "Pick this item" with location first, SKU + image, +1 */}
      {!needsTote && currentItem && (
        <View style={styles.currentItemCard}>
          <Text style={styles.currentItemBadge}>Pick this item</Text>
          <Text style={styles.currentItemLocationLabel}>GO TO LOCATION</Text>
          <Text style={styles.currentItemLocation}>{currentItem.location || '—'}</Text>
          {currentItem.shopify_order_name ? (
            <Text style={styles.currentItemOrder} numberOfLines={1}>{currentItem.shopify_order_name}</Text>
          ) : null}
          <View style={styles.currentItemSkuRow}>
            {currentItem.primary_image_url ? (
              <Image source={{ uri: currentItem.primary_image_url }} style={styles.currentItemImage} resizeMode="cover" />
            ) : (
              <View style={styles.currentItemImagePlaceholder}>
                <Package size={24} color={theme.colors.textMuted} strokeWidth={2} />
              </View>
            )}
            <View style={styles.currentItemSkuInfo}>
              <Text style={styles.currentItemSku}>{currentItem.sku_code || currentItem.sku_id}</Text>
              {currentItem.sku_name ? <Text style={styles.currentItemSkuName} numberOfLines={2}>{currentItem.sku_name}</Text> : null}
              <Text style={styles.currentItemQty}>
                Qty: {(currentItem.total_quantity_required ?? currentItem.quantity_required ?? 0) - (currentItem.quantity_picked ?? 0)} remaining
              </Text>
            </View>
          </View>
          <View style={styles.currentItemFocusRow}>
            <View style={styles.currentItemFocusBlock}>
              <Text style={styles.currentItemFocusLabel}>LOCATION</Text>
              <Text style={styles.currentItemFocusValue}>{currentItem.location || '—'}</Text>
            </View>
            <View style={styles.currentItemFocusBlock}>
              <Text style={styles.currentItemFocusLabel}>PICK QTY</Text>
              <Text style={styles.currentItemFocusValue}>
                {Math.max(0, (currentItem.total_quantity_required ?? currentItem.quantity_required ?? 0) - (currentItem.quantity_picked ?? 0))}
              </Text>
            </View>
          </View>
          {currentStepOfTotal.total > 0 && (
            <Text style={styles.currentItemStep}>Item {currentStepOfTotal.step} of {currentStepOfTotal.total}</Text>
          )}
          <TouchableOpacity
            style={styles.plusOneButton}
            onPress={() => scanPickItem(String(currentItem.sku_id))}
            disabled={loading}
          >
            <PlusCircle size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.plusOneText}>+1 (no barcode)</Text>
          </TouchableOpacity>
          {batchType === 'multi_item' && currentItem.order_id ? (
            <TouchableOpacity
              style={styles.skipOrderButton}
              onPress={() => {
                Alert.alert(
                  'Skip order',
                  'Put this order on hold? It will be removed from the batch and can be resolved later.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Hospital issue', onPress: () => void skipOrderInBatch(currentItem.order_id!, 'Hospital issue') },
                    { text: 'Other', onPress: () => void skipOrderInBatch(currentItem.order_id!, 'Other') },
                  ]
                );
              }}
              disabled={loading}
            >
              <AlertTriangle size={18} color={theme.colors.warning} strokeWidth={2} />
              <Text style={styles.skipOrderButtonText}>Report issue / Skip order</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Single primary CTA: Scan tote first, then Scan next item */}
      <View style={styles.primaryCtaSection}>
        {needsTote ? (
          <>
            <TouchableOpacity style={styles.primaryScanButton} onPress={primaryScanTote} activeOpacity={0.9}>
              <ScanBarcode size={28} color="#fff" strokeWidth={2} />
              <Text style={styles.primaryScanText}>Scan tote</Text>
              <Text style={styles.primaryScanHint}>Assign a tote to this batch to start picking</Text>
            </TouchableOpacity>
            <View style={styles.enterToteRow}>
              <Text style={styles.enterToteLabel}>Or enter barcode</Text>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  value={toteBarcode}
                  placeholder="Tote barcode"
                  placeholderTextColor={theme.colors.textMuted}
                  onChangeText={setToteBarcode}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.scanButton} onPress={primaryScanTote}>
                  <ScanBarcode size={20} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.secondaryButtonBlock} onPress={() => void lookupTote()}>
                <Text style={styles.secondaryButtonText}>Lookup tote</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryScanButton, !canPick && styles.primaryScanButtonDisabled]}
            onPress={primaryScanItem}
            disabled={!canPick}
            activeOpacity={0.9}
          >
            <ScanBarcode size={28} color="#fff" strokeWidth={2} />
            <Text style={styles.primaryScanText}>{allPicked ? 'All picked' : 'Scan next item'}</Text>
            <Text style={styles.primaryScanHint}>
              {allPicked ? 'Complete batch below when ready' : `${remainingCount} remaining`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tote & batch row */}
      <View style={styles.toteBatchRow}>
        <View style={styles.toteChip}>
          <Text style={styles.toteChipLabel}>Tote</Text>
          <Text style={styles.toteChipValue} numberOfLines={1}>{toteBarcode || '—'}</Text>
          {!needsTote && (
            <TouchableOpacity style={styles.toteChipScan} onPress={primaryScanTote}>
              <ScanBarcode size={14} color={theme.colors.primary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.batchChip}>
          <Text style={styles.batchChipLabel}>Batch</Text>
          <Text style={styles.batchChipValue} numberOfLines={1}>{batchShortId}</Text>
        </View>
      </View>
      {!needsTote && (
        <TouchableOpacity style={styles.lookupLink} onPress={() => void lookupTote()}>
          <Text style={styles.lookupLinkText}>Lookup tote</Text>
        </TouchableOpacity>
      )}

      {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
      {loading ? <View style={styles.loadingRow}><ActivityIndicator color={theme.colors.primary} size="small" /><Text style={styles.loadingText}>Working…</Text></View> : null}

      {skippedItems.length > 0 ? (
        <View style={styles.skippedBanner}>
          <View style={styles.skippedBannerHeader}>
            <AlertTriangle size={20} color={theme.colors.warning} strokeWidth={2} />
            <Text style={styles.skippedBannerTitle}>Skipped items (Hospital)</Text>
          </View>
          <Text style={styles.skippedBannerSubtitle}>
            {skippedItems.length} item(s) not in pick list (hospital or no location). Resolve in warehouse dashboard.
          </Text>
          {(() => {
            const unique = Array.from(new Map(skippedItems.map((s) => [s.sku_id, s])).values());
            return unique.slice(0, 5).map((s) => (
              <View key={s.sku_id} style={styles.skippedRow}>
                <Text style={styles.skippedSku} numberOfLines={1}>{s.sku_code || s.sku_id}</Text>
                <Text style={styles.skippedReason} numberOfLines={1}>{s.reason || 'Skipped'}</Text>
              </View>
            ));
          })()}
          {skippedItems.length > 5 ? (
            <Text style={styles.skippedMore}>+{skippedItems.length - 5} more</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>Pick list</Text>
        <TouchableOpacity onPress={() => void loadPickList()}>
          <Text style={styles.refreshLink}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={pickList}
        keyExtractor={(item, idx) => item.batch_item_id || String(idx)}
        style={styles.list}
        contentContainerStyle={pickList.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Package size={36} color={theme.colors.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>Pick list</Text>
            <Text style={styles.emptyText}>Scan items to confirm picks. List updates as you go.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const req = item.total_quantity_required ?? item.quantity_required ?? 0;
          const picked = item.quantity_picked ?? 0;
          const done = req > 0 && picked >= req;
          const isCurrent = currentItem?.batch_item_id === item.batch_item_id;
          return (
            <View style={[styles.pickCard, done && styles.pickCardDone, isCurrent && styles.pickCardCurrent]}>
              {item.primary_image_url ? (
                <Image source={{ uri: item.primary_image_url }} style={styles.pickCardImage} resizeMode="cover" />
              ) : (
                <View style={styles.pickCardImagePlaceholder}>
                  <Package size={20} color={theme.colors.textMuted} strokeWidth={2} />
                </View>
              )}
              <View style={styles.pickCardLeft}>
                <Text style={styles.pickCardSku}>{item.sku_code || item.sku_id}</Text>
                <Text style={styles.pickCardLocation}>{item.location || '—'}</Text>
                {item.shopify_order_name ? (
                  <Text style={styles.pickCardOrder} numberOfLines={1}>{item.shopify_order_name}</Text>
                ) : null}
                <Text style={styles.pickCardMeta}>
                  {picked} / {req} {item.sku_name ? ` · ${item.sku_name}` : ''}
                </Text>
              </View>
              {done ? <View style={styles.pickCardCheck}><Text style={styles.pickCardCheckText}>✓</Text></View> : null}
            </View>
          );
        }}
      />

      <TouchableOpacity
        style={[styles.completeButton, (!batchId.trim() || !toteBarcode.trim()) && styles.disabled]}
        onPress={() => void completeBatch()}
        disabled={!batchId.trim() || !toteBarcode.trim()}
      >
        <Text style={styles.completeText}>Complete batch</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  startContent: {
    paddingBottom: theme.spacing.xxl + theme.spacing.section,
  },
  startTitle: {
    ...theme.typography.title,
    fontSize: 26,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    letterSpacing: -0.3,
  },
  startSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.section,
    lineHeight: 20,
  },
  dashboardCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dashboardCardTitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  dashboardCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dashboardStat: {
    alignItems: 'center',
    flex: 1,
  },
  dashboardStatValue: {
    ...theme.typography.titleSmall,
    color: theme.colors.text,
  },
  dashboardStatLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  shipHeroUserName: {
    ...theme.typography.title,
    fontSize: 24,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  shipHeroUserSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  shipHeroOptionsTitle: {
    ...theme.typography.titleSmall,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  shipHeroOptionsSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  shipHeroOptionCard: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    minHeight: theme.minTouchTarget,
  },
  shipHeroOptionCardPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  shipHeroOptionTitle: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  shipHeroOptionTitlePrimary: {
    ...theme.typography.body,
    fontWeight: '600',
    color: '#fff',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  shipHeroOptionHint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  shipHeroOptionHintPrimary: {
    ...theme.typography.bodySmall,
    color: 'rgba(255,255,255,0.9)',
  },
  quickStartButton: {
    minHeight: theme.minTouchTarget + 12,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadow.button,
  },
  quickStartText: {
    ...theme.typography.title,
    color: '#fff',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  quickStartHint: {
    ...theme.typography.bodySmall,
    color: 'rgba(255,255,255,0.9)',
  },
  customBatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.minTouchTarget,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.section,
    gap: theme.spacing.md,
  },
  customBatchTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  customBatchText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  customBatchHint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  createBatchButton: {
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    ...theme.shadow.card,
  },
  createBatchText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    marginTop: theme.spacing.sm,
  },
  createBatchHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 4,
  },
  batchesSection: {
    marginBottom: theme.spacing.xl,
  },
  batchesSectionTitle: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    letterSpacing: 0.3,
  },
  batchesLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
  },
  batchesLoadingText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  batchesEmptyWrap: {
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  batchesEmptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  batchesEmptyTitle: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  batchesEmptyText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundCard,
  },
  batchRowStatusPending: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.textMuted,
  },
  batchRowStatusInProgress: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  batchRowStatusCompleted: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success,
  },
  batchRowStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
  },
  batchRowStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.backgroundElevated,
    gap: theme.spacing.xs,
  },
  batchRowStatusIcon: {
    marginRight: 0,
  },
  batchRowStatusBadgeInProgress: {
    backgroundColor: theme.colors.primaryDim,
  },
  batchRowStatusBadgeCompleted: {
    backgroundColor: theme.colors.successDim,
  },
  batchRowStatusText: {
    ...theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  batchRowStatusTextInProgress: {
    color: theme.colors.primary,
  },
  batchRowStatusTextCompleted: {
    color: theme.colors.success,
  },
  batchRowMainTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  batchRowMain: { flex: 1, minWidth: 0 },
  batchRowId: {
    ...theme.typography.label,
    color: theme.colors.text,
    fontSize: 14,
  },
  batchRowMeta: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  batchRowDate: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  batchRowAction: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginLeft: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryDim,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.minTouchTarget - 8,
  },
  batchRowActionDisabled: {
    opacity: 0.6,
  },
  batchRowActionDanger: {
    backgroundColor: theme.colors.errorDim,
  },
  batchRowActionText: {
    ...theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  batchRowActionTextDanger: {
    ...theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.error,
  },
  toteResumeSection: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundCard,
  },
  toteResumeLabel: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  createContent: {
    paddingBottom: theme.spacing.xxl + 24,
  },
  createBackLink: {
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  createBackLinkText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  createHero: {
    marginBottom: theme.spacing.xl,
  },
  createTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  createSubtitle: {
    marginTop: theme.spacing.xs,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  createLoadingWrap: {
    paddingVertical: theme.spacing.xxl * 2,
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  createSection: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  createSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  createSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  createSectionHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 'auto',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryChip: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    minWidth: 110,
  },
  categoryChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  categoryChipTextSelected: {
    color: theme.colors.primary,
  },
  categoryChipMeta: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  categoryChipMetaSelected: {
    color: 'rgba(59, 130, 246, 0.9)',
  },
  batchTypeRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  batchTypeChip: {
    flex: 1,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  batchTypeChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  batchTypeChipDisabled: {
    opacity: 0.45,
  },
  batchTypeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  batchTypeIconWrapSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  batchTypeText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  batchTypeTextSelected: {
    color: '#fff',
  },
  batchTypeMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  batchTypeMetaSelected: {
    color: 'rgba(255,255,255,0.9)',
  },
  orderCountCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  orderCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  stepperBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: 24,
    color: theme.colors.text,
    fontWeight: '600',
  },
  orderCountValueWrap: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCountValue: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  quickCountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  quickCountBtn: {
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickCountBtnSelected: {
    backgroundColor: theme.colors.primaryDim,
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
  },
  quickCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  quickCountTextSelected: {
    color: theme.colors.primary,
  },
  createActions: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  cancelButton: {
    flex: 1,
    minHeight: 56,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  createButton: {
    flex: 1,
    minHeight: 56,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.success,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  createButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  createButtonSubtext: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  createEmptyWrap: {
    paddingVertical: theme.spacing.xxl * 2,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
  },
  secondaryButtonBlock: {
    marginTop: theme.spacing.md,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  startNewLink: {
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  startNewLinkText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  pickingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  progressButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  progressButtonText: {
    ...theme.typography.label,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  shipHeroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  shipHeroFooterLeft: { alignItems: 'flex-start' },
  shipHeroFooterRight: { alignItems: 'flex-end' },
  shipHeroFooterValue: {
    ...theme.typography.titleSmall,
    fontSize: 20,
    color: theme.colors.text,
  },
  shipHeroFooterLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  progressModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  progressModalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
  },
  progressModalTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  progressModalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  progressModalLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  progressModalValue: {
    ...theme.typography.titleSmall,
    color: theme.colors.text,
  },
  progressModalActions: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  progressModalCompleteButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  progressModalCompleteText: {
    ...theme.typography.label,
    color: '#fff',
    fontWeight: '600',
  },
  progressModalBackButton: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  progressModalBackText: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
  },
  progressStrip: {
    marginBottom: theme.spacing.lg,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.backgroundElevated,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  progressText: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  statCell: {
    alignItems: 'center',
  },
  statValue: {
    ...theme.typography.titleSmall,
    color: theme.colors.text,
    fontSize: 18,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  completionOverlay: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  completionCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl * 2,
    paddingHorizontal: theme.spacing.xxl + theme.spacing.lg,
    maxWidth: 320,
  },
  completionIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.successDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  completionTitle: {
    ...theme.typography.title,
    fontSize: 26,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  completionSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  completionButton: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.primary,
    minWidth: 200,
    alignItems: 'center',
  },
  completionButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  batchHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  batchHeaderLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  batchHeaderId: {
    ...theme.typography.label,
    fontSize: 16,
    color: theme.colors.text,
  },
  batchTypeBadge: {
    marginLeft: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryDim,
  },
  batchTypeBadgeMulti: {
    backgroundColor: theme.colors.successDim,
  },
  batchTypeBadgeText: {
    ...theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  batchTypeBadgeTextMulti: {
    color: theme.colors.success,
  },
  workflowStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  workflowStep: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  workflowStepActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryDim,
  },
  workflowStepDone: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.successDim,
  },
  workflowStepCheck: {
    fontSize: 14,
    color: theme.colors.success,
    fontWeight: '700',
  },
  workflowStepNum: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  workflowStepNumActive: {
    color: theme.colors.primary,
  },
  workflowStepLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  workflowStepLabelActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  workflowStepLabelDone: {
    color: theme.colors.success,
  },
  currentItemCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.card,
  },
  currentItemBadge: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  currentItemLocationLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: theme.spacing.xs,
  },
  currentItemLocation: {
    ...theme.typography.titleSmall,
    fontSize: 20,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  currentItemOrder: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
  },
  currentItemSkuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  currentItemImage: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
  },
  currentItemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentItemSkuInfo: {
    flex: 1,
    minWidth: 0,
  },
  currentItemSku: {
    ...theme.typography.label,
    color: theme.colors.text,
    fontSize: 15,
  },
  currentItemSkuName: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  currentItemQty: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  currentItemFocusRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  currentItemFocusBlock: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.backgroundElevated,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  currentItemFocusLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  currentItemFocusValue: {
    ...theme.typography.titleSmall,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  currentItemStep: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  plusOneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success,
  },
  plusOneText: {
    ...theme.typography.label,
    color: '#fff',
  },
  skipOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  skipOrderButtonText: {
    ...theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.warning,
  },
  primaryCtaSection: {
    marginBottom: theme.spacing.lg,
  },
  primaryScanButton: {
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryScanButtonDisabled: {
    opacity: 0.7,
  },
  primaryScanText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginTop: theme.spacing.sm,
  },
  primaryScanHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  enterToteRow: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  enterToteLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  toteBatchRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  toteChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toteChipLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginRight: theme.spacing.xs,
  },
  toteChipValue: {
    flex: 1,
    ...theme.typography.bodySmall,
    color: theme.colors.text,
  },
  toteChipScan: {
    padding: theme.spacing.xs,
  },
  batchChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  batchChipLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginRight: theme.spacing.xs,
  },
  batchChipValue: {
    flex: 1,
    ...theme.typography.bodySmall,
    color: theme.colors.text,
  },
  lookupLink: {
    marginBottom: theme.spacing.md,
  },
  lookupLinkText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listHeaderTitle: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  refreshLink: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pickCardImage: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    marginRight: theme.spacing.md,
  },
  pickCardImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickCardDone: {
    borderColor: theme.colors.success,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  pickCardCurrent: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  pickCardLeft: {
    flex: 1,
  },
  pickCardSku: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  pickCardLocation: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  pickCardOrder: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  pickCardMeta: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  pickCardCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickCardCheckText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  section: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundCard,
  },
  sectionTitle: {
    ...theme.typography.label,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  scanButton: {
    height: 46,
    width: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  lookupButton: {
    marginTop: theme.spacing.sm,
    height: 42,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryDim,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  batchIdDisplay: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: theme.colors.primaryDim,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  actionText: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  meta: {
    marginTop: theme.spacing.sm,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  errorBanner: {
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.errorDim,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorText: {
    color: theme.colors.error,
    ...theme.typography.bodySmall,
    lineHeight: 20,
  },
  skippedBanner: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning === '#f59e0b' ? 'rgba(245, 158, 11, 0.15)' : theme.colors.errorDim,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  skippedBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  skippedBannerTitle: {
    ...theme.typography.label,
    color: theme.colors.warning,
    flex: 1,
  },
  skippedBannerSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    lineHeight: 18,
  },
  skippedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.backgroundElevated,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.xs,
  },
  skippedSku: {
    ...theme.typography.caption,
    color: theme.colors.text,
    flex: 1,
  },
  skippedReason: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
    maxWidth: '60%',
  },
  skippedMore: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  loadingText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  list: {
    flex: 1,
  },
  itemRow: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  itemTitle: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  itemSub: {
    marginTop: 2,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  itemMeta: {
    marginTop: theme.spacing.xs,
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  badge: {
    ...theme.typography.caption,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.backgroundElevated,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl * 2,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  completeButton: {
    marginTop: theme.spacing.lg,
    minHeight: Math.max(50, theme.minTouchTarget),
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.success,
    ...theme.shadow.button,
  },
  completeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default PickingScreen;
