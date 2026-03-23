import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowRight,
  CheckCircle,
  Hash,
  MapPin,
  Package,
  PackagePlus,
  RotateCcw,
  ScanBarcode,
  Warehouse,
} from 'lucide-react-native';
import type { MoveSkuStackParamList } from '../navigation/types';
import { api } from '../api/client';
import { useDebugStore } from '../store/debugStore';
import { formatApiError } from '../utils/formatApiError';
import { theme } from '../theme';
import { isScreenDebugEnabled } from '../config/debug';
import { useMoveSkuPersistStore } from '../store/moveSkuPersistStore';
import SkuSearchDropdown, { type SkuSearchResult } from '../components/SkuSearchDropdown';

type Props = NativeStackScreenProps<MoveSkuStackParamList, 'MoveSkuRoot'>;

type Step = 'sku' | 'source' | 'destination' | 'quantity' | 'success';

type LastMoveSummary = {
  skuCode: string;
  skuName: string;
  imageUrl?: string | null;
  from: string;
  to: string;
  quantity: number;
};

type Sku = {
  id: string;
  sku_code: string;
  name: string;
  barcode?: string | null;
  primary_image_url?: string | null;
};

type LocationSkuInventory = {
  success: boolean;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  location_id: string;
  available_quantity: number;
};

type ScreenDebugEntry = {
  ts: number;
  action: string;
  method: string;
  url: string;
  status?: number;
  requestBody?: string;
  responseSnippet?: string;
  error?: string;
};

const MAX_DEBUG_ENTRIES = 15;

function safeStringify(obj: unknown, maxLen = 400): string {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
  } catch {
    return String(obj);
  }
}

const MoveSkuScreen: React.FC<Props> = ({ navigation, route }) => {
  const debugEnabled = useDebugStore((s) => s.enabled);
  const screenDebug = isScreenDebugEnabled();
  const persist = useMoveSkuPersistStore.getState();

  const [step, setStep] = useState<Step>(persist.step);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sku, setSku] = useState<Sku | null>(persist.sku);
  const [sourceLocation, setSourceLocation] = useState<string>(persist.sourceLocation);
  const [destinationLocation, setDestinationLocation] = useState<string>(persist.destinationLocation);
  const [availableQty, setAvailableQty] = useState<number>(persist.availableQty);
  const [quantity, setQuantity] = useState<string>(persist.quantity);

  const [lastMoveSummary, setLastMoveSummary] = useState<LastMoveSummary | null>(null);
  const [screenLog, setScreenLog] = useState<ScreenDebugEntry[]>([]);

  const addLog = useCallback((entry: Omit<ScreenDebugEntry, 'ts'>) => {
    setScreenLog((prev) => [{ ...entry, ts: Date.now() }, ...prev].slice(0, MAX_DEBUG_ENTRIES));
  }, []);

  // Restore state when screen is focused (e.g. returning from Scanner)
  useFocusEffect(
    useCallback(() => {
      const s = useMoveSkuPersistStore.getState();
      if (s.sku || s.sourceLocation || s.step !== 'sku') {
        setStep(s.step);
        setSku(s.sku);
        setSourceLocation(s.sourceLocation);
        setDestinationLocation(s.destinationLocation);
        setAvailableQty(s.availableQty);
        setQuantity(s.quantity);
      }
    }, []),
  );

  // Persist state whenever it changes (except success – we don't restore to success)
  useEffect(() => {
    if (step === 'success') return;
    const persistStep = step as 'sku' | 'source' | 'destination' | 'quantity';
    useMoveSkuPersistStore.getState().save({
      step: persistStep,
      sku,
      sourceLocation,
      destinationLocation,
      availableQty,
      quantity,
    });
  }, [step, sku, sourceLocation, destinationLocation, availableQty, quantity]);

  // Handle scanner return params
  useEffect(() => {
    const scannedField = route.params?.scannedField;
    const scannedValue = route.params?.scannedValue;
    if (!scannedField || !scannedValue) return;

    if (scannedField === 'sku') void handleSkuScan(scannedValue);
    if (scannedField === 'source') void handleSourceScan(scannedValue);
    if (scannedField === 'destination') void handleDestinationScan(scannedValue);

    // Clear so we don't re-process; use empty string so SET_PARAMS payload is non-empty (avoids navigator error)
    navigation.setParams({ scannedField: '', scannedValue: '' } as any);
  }, [route.params?.scannedField, route.params?.scannedValue]);

  const canMove = useMemo(() => {
    const qty = Number(quantity);
    return (
      sku != null &&
      sourceLocation.trim().length > 0 &&
      destinationLocation.trim().length > 0 &&
      qty > 0 &&
      qty <= availableQty
    );
  }, [availableQty, destinationLocation, quantity, sku, sourceLocation]);

  const handleSkuScan = async (identifier: string) => {
    const value = identifier.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    const url = `/api/inventory/skus/${encodeURIComponent(value)}`;
    try {
      const res = await api.get<any>(url);
      const data = res.data;
      if (screenDebug) {
        addLog({
          action: 'SKU lookup',
          method: 'GET',
          url,
          status: res.status,
          responseSnippet: safeStringify(data),
        });
      }
      if (!data?.success) {
        throw new Error(data?.error || 'SKU not found');
      }
      let imageUrls: string[] = [];
      if (Array.isArray(data.image_urls)) imageUrls = data.image_urls;
      else if (typeof data.additional_images === 'string') {
        try {
          const parsed = JSON.parse(data.additional_images);
          if (Array.isArray(parsed)) imageUrls = parsed;
        } catch {}
      }
      const primaryImage = data.primary_image_url || imageUrls[0] || null;
      setSku({
        id: data.id,
        sku_code: data.sku_code,
        name: data.name,
        barcode: data.barcode,
        primary_image_url: primaryImage,
      });
      setStep('source');
    } catch (e: any) {
      const formatted = formatApiError(e);
      const msg = debugEnabled || screenDebug
        ? `${formatted.message} (${formatted.title})`
        : formatted.message;
      setError(msg);
      if (screenDebug) {
        addLog({
          action: 'SKU lookup',
          method: 'GET',
          url,
          status: e?.response?.status,
          error: formatted.message + '\n' + safeStringify(e?.response?.data),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkuSelectFromSearch = (selected: SkuSearchResult) => {
    setError(null);
    setSku({
      id: selected.id,
      sku_code: selected.sku_code,
      name: selected.name,
      primary_image_url: selected.primary_image_url ?? null,
    });
    // Reset downstream steps for a clean flow
    setSourceLocation('');
    setDestinationLocation('');
    setAvailableQty(0);
    setQuantity('1');
    setStep('source');
  };

  const handleSourceScan = async (locationBarcode: string) => {
    const value = locationBarcode.trim();
    if (!value || !sku) return;
    setLoading(true);
    setError(null);
    const url = `/api/inventory/locations/${encodeURIComponent(value)}/skus/${encodeURIComponent(sku.id)}`;
    try {
      const res = await api.get<LocationSkuInventory>(url);
      const data = res.data;
      if (screenDebug) {
        addLog({
          action: 'Source location + SKU',
          method: 'GET',
          url,
          status: res.status,
          responseSnippet: safeStringify(data),
        });
      }
      if (!data?.success) {
        throw new Error('SKU not found in this location');
      }
      if (data.available_quantity <= 0) {
        throw new Error('No available inventory in this location');
      }
      setSourceLocation(data.location_id);
      setAvailableQty(data.available_quantity);
      setQuantity(String(Math.min(1, data.available_quantity)));
      setStep('destination');
    } catch (e: any) {
      const formatted = formatApiError(e);
      const verboseMsg = screenDebug
        ? `${formatted.message}\nURL: ${url}\nStatus: ${e?.response?.status ?? 'N/A'}\nBody: ${safeStringify(e?.response?.data)}`
        : (debugEnabled ? `${formatted.message} (${formatted.title})` : formatted.message);
      setError(verboseMsg);
      if (screenDebug) {
        addLog({
          action: 'Source location + SKU',
          method: 'GET',
          url,
          status: e?.response?.status,
          error: formatted.message,
          responseSnippet: safeStringify(e?.response?.data),
        });
      }
      // Do not change step or clear sku – keep user on source step so they can retry or see debug
    } finally {
      setLoading(false);
    }
  };

  const handleDestinationScan = async (locationBarcode: string) => {
    const value = locationBarcode.trim();
    if (!value) return;
    if (value === sourceLocation) {
      setError('Destination must be different from source');
      return;
    }
    setLoading(true);
    setError(null);
    const url = '/api/inventory/locations';
    try {
      const res = await api.get<any>(url, { params: { search: value, limit: 1 } });
      const data = res.data;
      const items = data?.items ?? data?.data?.items;
      if (screenDebug) {
        addLog({
          action: 'Destination location search',
          method: 'GET',
          url: url + '?search=' + encodeURIComponent(value) + '&limit=1',
          status: res.status,
          responseSnippet: safeStringify(data),
        });
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error(`Location not found: ${value}`);
      }
      const loc = items[0];
      setDestinationLocation(String(loc.id ?? value));
      setStep('quantity');
    } catch (e: any) {
      const formatted = formatApiError(e);
      const verboseMsg = screenDebug
        ? `${formatted.message}\nSearch: ${value}\nStatus: ${e?.response?.status ?? 'N/A'}\nBody: ${safeStringify(e?.response?.data)}`
        : (debugEnabled ? `${formatted.message} (${formatted.title})` : formatted.message);
      setError(verboseMsg);
      if (screenDebug) {
        addLog({
          action: 'Destination location search',
          method: 'GET',
          url: url + '?search=' + encodeURIComponent(value),
          status: e?.response?.status,
          error: formatted.message,
          responseSnippet: safeStringify(e?.response?.data),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmMove = async () => {
    if (!canMove || !sku) return;
    setLoading(true);
    setError(null);
    const body = {
      sku_id: sku.id,
      from_location_id: sourceLocation.trim(),
      to_location_id: destinationLocation.trim(),
      quantity: Number(quantity),
    };
    try {
      const res = await api.post('/api/inventory/move-sku', body);
      if (screenDebug) {
        addLog({
          action: 'Move SKU',
          method: 'POST',
          url: '/api/inventory/move-sku',
          status: res.status,
          requestBody: safeStringify(body),
          responseSnippet: safeStringify(res.data),
        });
      }
      useMoveSkuPersistStore.getState().clear();
      setLastMoveSummary({
        skuCode: sku.sku_code,
        skuName: sku.name,
        imageUrl: sku.primary_image_url,
        from: sourceLocation.trim(),
        to: destinationLocation.trim(),
        quantity: Number(quantity),
      });
      setSku(null);
      setSourceLocation('');
      setDestinationLocation('');
      setAvailableQty(0);
      setQuantity('1');
      setStep('success');
      setScreenLog((prev) => prev.slice(0, 0));
    } catch (e: any) {
      const formatted = formatApiError(e);
      const verboseMsg = screenDebug
        ? `${formatted.message}\nBody: ${safeStringify(body)}\nStatus: ${e?.response?.status}\nResponse: ${safeStringify(e?.response?.data)}`
        : (debugEnabled ? `${formatted.message} (${formatted.title})` : formatted.message);
      setError(verboseMsg);
      if (screenDebug) {
        addLog({
          action: 'Move SKU',
          method: 'POST',
          url: '/api/inventory/move-sku',
          status: e?.response?.status,
          requestBody: safeStringify(body),
          error: formatted.message,
          responseSnippet: safeStringify(e?.response?.data),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const scan = (field: string, title: string) => {
    const persistStep = step === 'success' ? 'sku' : (step as 'sku' | 'source' | 'destination' | 'quantity');
    useMoveSkuPersistStore.getState().save({
      step: persistStep,
      sku,
      sourceLocation,
      destinationLocation,
      availableQty,
      quantity,
    });
    navigation.navigate('Scanner', {
      returnTo: 'MoveSkuRoot',
      field,
      title,
    });
  };

  const startOver = () => {
    useMoveSkuPersistStore.getState().clear();
    setStep('sku');
    setSku(null);
    setSourceLocation('');
    setDestinationLocation('');
    setAvailableQty(0);
    setQuantity('1');
    setLastMoveSummary(null);
    setError(null);
    if (screenDebug) setScreenLog([]);
  };

  const moveAnother = () => {
    setLastMoveSummary(null);
    setStep('sku');
    setError(null);
    if (screenDebug) setScreenLog([]);
  };

  // ——— Success / confirmation screen after move ———
  if (step === 'success' && lastMoveSummary) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, styles.successContent]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.successCard}>
          <View style={styles.successIconWrap}>
            <CheckCircle size={56} color={theme.colors.success} strokeWidth={2} />
          </View>
          <Text style={styles.successTitle}>Move completed</Text>
          <Text style={styles.successSubtitle}>
            Inventory has been updated successfully.
          </Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              {lastMoveSummary.imageUrl ? (
                <Image source={{ uri: lastMoveSummary.imageUrl }} style={styles.summarySkuImage} resizeMode="cover" />
              ) : (
                <View style={styles.summarySkuImagePlaceholder}>
                  <Package size={20} color={theme.colors.textMuted} strokeWidth={2} />
                </View>
              )}
              <View style={styles.summaryTextBlock}>
                <Text style={styles.summaryLabel}>SKU</Text>
                <Text style={styles.summaryValue}>{lastMoveSummary.skuCode}</Text>
                <Text style={styles.summaryMuted} numberOfLines={1}>{lastMoveSummary.skuName}</Text>
              </View>
            </View>
            <View style={styles.flowRow}>
              <View style={styles.flowNode}>
                <View style={styles.flowNodeHeader}>
                  <Warehouse size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.flowLabel}>From</Text>
                </View>
                <Text style={styles.flowValue} numberOfLines={1}>{lastMoveSummary.from}</Text>
              </View>
              <ArrowRight size={20} color={theme.colors.primary} style={styles.flowArrow} />
              <View style={styles.flowNode}>
                <View style={styles.flowNodeHeader}>
                  <MapPin size={16} color={theme.colors.success} />
                  <Text style={styles.flowLabel}>To</Text>
                </View>
                <Text style={styles.flowValue} numberOfLines={1}>{lastMoveSummary.to}</Text>
              </View>
            </View>
            <View style={styles.quantityRow}>
              <View style={styles.quantityLabelWrap}>
                <Hash size={16} color={theme.colors.textMuted} />
                <Text style={styles.quantityLabel}>Quantity moved</Text>
              </View>
              <Text style={styles.quantityValue}>{lastMoveSummary.quantity}</Text>
            </View>
          </View>

            <TouchableOpacity style={styles.primaryButton} onPress={moveAnother} activeOpacity={0.85}>
            <PackagePlus size={20} color="#fff" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={styles.primaryText}>Move another</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const stepIndex = step === 'sku' ? 1 : step === 'source' ? 2 : step === 'destination' ? 3 : 4;
  const steps = [1, 2, 3, 4];
  const stepLabel = step === 'sku' ? 'Scan SKU' : step === 'source' ? 'Scan source' : step === 'destination' ? 'Scan destination' : 'Set quantity';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Move SKU</Text>
        <Text style={styles.subtitle}>
          Scan SKU → source → destination → set quantity.
        </Text>
        {screenDebug && (
          <Text style={styles.debugBadge}>SCREEN_DEBUG ON – verbose logs below</Text>
        )}
        <View style={styles.progressStrip}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${(stepIndex / 4) * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>Step {stepIndex} of 4 · {stepLabel}</Text>
        </View>
        <View style={styles.stepIndicator}>
          {steps.map((s) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                s === stepIndex && styles.stepDotActive,
                s < stepIndex && styles.stepDotDone,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        {step === 'sku' ? (
          <>
            <Text style={styles.searchLabel}>Search SKU</Text>
            <SkuSearchDropdown
              minChars={2}
              limit={8}
              onSelect={(skuItem) => handleSkuSelectFromSearch(skuItem)}
            />
            <Text style={styles.searchOr}>or</Text>
            <TouchableOpacity style={styles.primaryScanButton} onPress={() => scan('sku', 'SKU')} activeOpacity={0.9}>
              <ScanBarcode size={32} color="#fff" strokeWidth={2} />
              <Text style={styles.primaryScanText}>Scan SKU</Text>
              <Text style={styles.primaryScanHint}>Barcode, SKU code, or UUID</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {sku ? (
          <View style={styles.skuChip}>
            {sku.primary_image_url ? (
              <Image source={{ uri: sku.primary_image_url }} style={styles.skuChipImage} resizeMode="cover" />
            ) : (
              <View style={styles.skuChipImagePlaceholder}>
                <Package size={20} color={theme.colors.textMuted} strokeWidth={2} />
              </View>
            )}
            <View style={styles.skuChipText}>
              <Text style={styles.skuChipCode}>{sku.sku_code}</Text>
              <Text style={styles.skuChipName} numberOfLines={1}>{sku.name}</Text>
            </View>
          </View>
        ) : null}

        {step === 'source' ? (
          <>
            <TouchableOpacity style={styles.primaryScanButton} onPress={() => scan('source', 'Source Location')} activeOpacity={0.9}>
              <ScanBarcode size={32} color="#fff" strokeWidth={2} />
              <Text style={styles.primaryScanText}>Scan source location</Text>
              <Text style={styles.primaryScanHint}>Where the inventory is now</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {step === 'destination' ? (
          <>
            <View style={styles.locationChip}>
              <View style={styles.locationChipHeader}>
                <Warehouse size={16} color={theme.colors.textSecondary} />
                <Text style={styles.locationChipLabel}>Source</Text>
              </View>
              <Text style={styles.locationChipValue}>{sourceLocation}</Text>
              <Text style={styles.locationChipMeta}>Available: {availableQty}</Text>
            </View>
            <TouchableOpacity style={styles.primaryScanButton} onPress={() => scan('destination', 'Destination Location')} activeOpacity={0.9}>
              <ScanBarcode size={32} color="#fff" strokeWidth={2} />
              <Text style={styles.primaryScanText}>Scan destination</Text>
              <Text style={styles.primaryScanHint}>Where to move the inventory</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {step === 'quantity' ? (
          <>
            <View style={styles.flowRow}>
              <View style={styles.flowNode}>
                <View style={styles.flowNodeHeader}>
                  <Warehouse size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.flowLabel}>From</Text>
                </View>
                <Text style={styles.flowValue} numberOfLines={1}>{sourceLocation}</Text>
              </View>
              <ArrowRight size={18} color={theme.colors.primary} style={styles.flowArrow} />
              <View style={styles.flowNode}>
                <View style={styles.flowNodeHeader}>
                  <MapPin size={16} color={theme.colors.success} />
                  <Text style={styles.flowLabel}>To</Text>
                </View>
                <Text style={styles.flowValue} numberOfLines={1}>{destinationLocation}</Text>
              </View>
            </View>

            <View style={styles.quantityLabelRow}>
              <Hash size={18} color={theme.colors.textSecondary} />
              <Text style={[styles.label, { marginTop: 0, marginBottom: 0 }]}>
                Quantity (max {availableQty})
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={theme.colors.textMuted}
            />

            <View style={styles.quickRow}>
              {[1, 5, 10].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.quickButton}
                  onPress={() => setQuantity(String(Math.min(q, availableQty)))}
                >
                  <Text style={styles.quickText}>{q}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => setQuantity(String(availableQty))}
              >
                <Text style={styles.quickText}>All</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.confirmButton, !canMove && styles.disabled]}
              onPress={() => void confirmMove()}
              disabled={!canMove}
              activeOpacity={0.85}
            >
              <CheckCircle size={22} color="#fff" strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={styles.confirmText}>Confirm move</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText} selectable>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.primary} size="small" />
            <Text style={styles.loadingText}>Working…</Text>
          </View>
        ) : null}

        {(step !== 'sku' || sku) ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={startOver}>
            <RotateCcw size={18} color={theme.colors.textSecondary} strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryText}>Start over</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {screenDebug && screenLog.length > 0 ? (
        <View style={styles.debugPanel}>
          <Text style={styles.debugPanelTitle}>Screen debug log (last {screenLog.length})</Text>
          {screenLog.map((entry, i) => (
            <View key={`${entry.ts}-${i}`} style={styles.debugEntry}>
              <Text style={styles.debugEntryAction}>
                [{new Date(entry.ts).toLocaleTimeString()}] {entry.action} – {entry.method} {entry.url}
              </Text>
              {entry.status != null && (
                <Text style={styles.debugEntryMeta}>Status: {entry.status}</Text>
              )}
              {entry.error ? (
                <Text style={styles.debugEntryError} selectable>{entry.error}</Text>
              ) : null}
              {entry.responseSnippet ? (
                <Text style={styles.debugEntrySnippet} selectable numberOfLines={4}>
                  Res: {entry.responseSnippet}
                </Text>
              ) : null}
              {entry.requestBody ? (
                <Text style={styles.debugEntrySnippet} selectable numberOfLines={2}>
                  Req: {entry.requestBody}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl + 40,
  },
  successContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  progressStrip: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.backgroundElevated,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  progressLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.borderStrong,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
  stepDotDone: {
    backgroundColor: theme.colors.success,
  },
  debugBadge: {
    marginTop: theme.spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warning,
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundCard,
    padding: theme.spacing.xl,
    ...theme.shadow.card,
  },
  stepTitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  value: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  scanButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.primaryDim,
  },
  scanButtonText: {
    marginTop: theme.spacing.sm,
    ...theme.typography.label,
    color: theme.colors.primary,
    fontSize: 15,
  },
  scanHint: {
    marginTop: 2,
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  primaryScanButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryScanText: {
    marginTop: theme.spacing.sm,
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  primaryScanHint: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  searchLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  searchOr: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginVertical: theme.spacing.xs,
  },
  skuChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
    gap: theme.spacing.sm,
  },
  skuChipImage: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  skuChipImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skuChipText: { flex: 1 },
  skuChipCode: {
    ...theme.typography.label,
    fontSize: 15,
    color: theme.colors.text,
  },
  skuChipName: {
    marginTop: 2,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  locationChip: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  locationChipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  locationChipLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  locationChipValue: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  locationChipMeta: {
    marginTop: 2,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  flowNode: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  flowNodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  flowLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  flowValue: {
    ...theme.typography.label,
    color: theme.colors.text,
    fontSize: 13,
  },
  flowArrow: {
    marginHorizontal: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    ...theme.shadow.card,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  // ——— Success / confirmation ———
  successCard: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundCard,
    padding: theme.spacing.xxl,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  successIconWrap: {
    marginBottom: theme.spacing.lg,
  },
  successTitle: {
    ...theme.typography.title,
    fontSize: 22,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  successSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  summaryCard: {
    width: '100%',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  summarySkuImage: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  summarySkuImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextBlock: { flex: 1 },
  summaryLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  summaryValue: {
    ...theme.typography.label,
    fontSize: 16,
    color: theme.colors.text,
  },
  summaryMuted: {
    marginTop: 2,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  quantityLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantityLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  quantityValue: {
    ...theme.typography.titleSmall,
    color: theme.colors.success,
    fontSize: 18,
  },
  input: {
    height: 46,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  quantityLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: theme.spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  quickButton: {
    flex: 1,
    height: 42,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickText: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  confirmButton: {
    marginTop: theme.spacing.lg,
    height: 50,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.success,
    ...theme.shadow.card,
  },
  confirmText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    height: 46,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  secondaryText: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  errorBanner: {
    marginTop: theme.spacing.lg,
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
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  debugPanel: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  debugPanelTitle: {
    ...theme.typography.label,
    color: theme.colors.warning,
    marginBottom: theme.spacing.md,
  },
  debugEntry: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  debugEntryAction: {
    fontSize: 11,
    color: theme.colors.text,
    fontWeight: '600',
  },
  debugEntryMeta: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  debugEntryError: {
    fontSize: 10,
    color: theme.colors.error,
    marginTop: 4,
  },
  debugEntrySnippet: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});

export default MoveSkuScreen;
