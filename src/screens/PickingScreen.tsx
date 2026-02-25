import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { Package, PlusCircle, ScanBarcode } from 'lucide-react-native';
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
  location?: string | null;
  location_id?: string | null;
  quantity_required?: number;
  total_quantity_required?: number;
  quantity_picked?: number;
  remaining_to_pick?: number;
  status?: string;
};

type CategoryCounts = { total: number; single_item: number; multi_item: number };
type AvailableOrdersResponse = { available_orders?: Record<string, CategoryCounts> };
type CreateDynamicResponse = { batch_id: string; orders_included?: number; message?: string };

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
  const [loading, setLoading] = useState(false);
  const [pickList, setPickList] = useState<PickListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create batch state
  const [availableData, setAvailableData] = useState<Record<string, CategoryCounts> | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBatchType, setSelectedBatchType] = useState<'single_item' | 'multi_item' | null>(null);
  const [orderCount, setOrderCount] = useState(10);

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

  useEffect(() => {
    if (mode === 'create') {
      void loadAvailableOrders();
    }
  }, [mode, loadAvailableOrders]);

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
    } catch {
      setPickList([]);
    }
  }, []);

  // Handle scanner return params
  useEffect(() => {
    const scannedField = route.params?.scannedField;
    const scannedValue = route.params?.scannedValue;
    if (!scannedField || !scannedValue) return;

    if (scannedField === 'tote') {
      setToteBarcode(scannedValue);
    }

    if (scannedField === 'item') {
      void scanPickItem(scannedValue);
    }

    navigation.setParams({ scannedField: undefined, scannedValue: undefined } as any);
  }, [route.params?.scannedField, route.params?.scannedValue]);

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
    } catch (e) {
      console.error(e);
      const formatted = formatApiError(e);
      setError(debugEnabled ? `${formatted.message} (${formatted.title})` : 'Unable to load pick list.');
      setPickList([]);
    } finally {
      setLoading(false);
    }
  };

  const scanPickItem = async (barcode: string) => {
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
        quantity_picked: 1,
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
      setPickList([]);
      setBatchId('');
      setTote(null);
      setToteBarcode('');
      setMode('start');
    } catch (e: any) {
      console.error(e);
      const formatted = formatApiError(e);
      setError(debugEnabled ? `${formatted.message} (${formatted.title})` : formatted.message);
    } finally {
      setLoading(false);
    }
  };

  const startNewBatch = () => {
    setMode('start');
    setBatchId('');
    setPickList([]);
    setTote(null);
    setToteBarcode('');
    setError(null);
    setSelectedCategory('all');
    setSelectedBatchType(null);
    setOrderCount(10);
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

  // ——— Start view: Quick start (ShipHero-style) or Custom batch or Resume ———
  if (mode === 'start') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.startContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.startTitle}>Picking</Text>
        <Text style={styles.startSubtitle}>Start a batch or scan a tote to resume</Text>

        <TouchableOpacity style={styles.quickStartButton} onPress={() => void quickStartBatch()} disabled={loading} activeOpacity={0.9}>
          <ScanBarcode size={32} color="#fff" strokeWidth={2} />
          <Text style={styles.quickStartText}>Quick start</Text>
          <Text style={styles.quickStartHint}>Create batch · Scan tote · Pick items</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.customBatchButton} onPress={() => setMode('create')} activeOpacity={0.85}>
          <PlusCircle size={22} color={theme.colors.primary} strokeWidth={2} />
          <Text style={styles.customBatchText}>Custom batch</Text>
          <Text style={styles.customBatchHint}>Choose category, type & order count</Text>
        </TouchableOpacity>

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

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.startNewLink} onPress={startNewBatch}>
        <Text style={styles.startNewLinkText}>← New batch</Text>
      </TouchableOpacity>

      {/* Progress strip */}
      {pickList.length > 0 && (
        <View style={styles.progressStrip}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${totalItems ? Math.min(100, (pickedCount / totalItems) * 100) : 0}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {pickedCount} of {totalItems} picked
          </Text>
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
          <Text style={styles.batchChipValue} numberOfLines={1}>{batchId || '—'}</Text>
        </View>
      </View>
      {!needsTote && (
        <TouchableOpacity style={styles.lookupLink} onPress={() => void lookupTote()}>
          <Text style={styles.lookupLinkText}>Lookup tote</Text>
        </TouchableOpacity>
      )}

      {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
      {loading ? <View style={styles.loadingRow}><ActivityIndicator color={theme.colors.primary} size="small" /><Text style={styles.loadingText}>Working…</Text></View> : null}

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
          <Text style={styles.emptyText}>Pick list will appear here. Scan items to confirm picks.</Text>
        }
        renderItem={({ item }) => {
          const req = item.total_quantity_required ?? item.quantity_required ?? 0;
          const picked = item.quantity_picked ?? 0;
          const done = req > 0 && picked >= req;
          return (
            <View style={[styles.pickCard, done && styles.pickCardDone]}>
              <View style={styles.pickCardLeft}>
                <Text style={styles.pickCardSku}>{item.sku_code || item.sku_id}</Text>
                <Text style={styles.pickCardLocation}>{item.location || '—'}</Text>
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
    paddingBottom: theme.spacing.xxl,
  },
  startTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  startSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  quickStartButton: {
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
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
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  customBatchText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  customBatchHint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
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
    marginBottom: theme.spacing.sm,
  },
  startNewLinkText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
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
    marginBottom: theme.spacing.sm,
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
  pickCardDone: {
    borderColor: theme.colors.success,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
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
    marginBottom: theme.spacing.sm,
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
    paddingHorizontal: theme.spacing.xl,
  },
  emptyText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  completeButton: {
    marginTop: theme.spacing.lg,
    height: 50,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.success,
    ...theme.shadow.card,
  },
  completeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default PickingScreen;
