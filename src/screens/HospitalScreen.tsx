import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle, CheckCircle, ClipboardList, XCircle } from 'lucide-react-native';
import { api } from '../api/client';
import { theme } from '../theme';
import { formatApiError } from '../utils/formatApiError';

type HospitalItem = {
  sku_id: string;
  sku_code: string;
  name: string;
  hospital_status: boolean;
  hospital_reason?: string | null;
  hospital_severity?: string | null;
  hospital_reported_at?: string | null;
  hospital_reported_by?: string | null;
  hospital_quantity_backup?: number | null;
  inventory_quantity: number;
};

type ResolveType = 'auto_revert' | 'manual';

const severityColor = (severity?: string | null) => {
  const s = (severity ?? '').toLowerCase();
  if (s === 'critical') return theme.colors.error;
  if (s === 'high') return theme.colors.warning;
  return theme.colors.textMuted;
};

const HospitalScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HospitalItem[]>([]);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveType, setResolveType] = useState<ResolveType>('auto_revert');
  const [resolveNewQty, setResolveNewQty] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [activeSku, setActiveSku] = useState<HospitalItem | null>(null);
  const [resolving, setResolving] = useState(false);

  const fetchList = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<any>('/api/hospital/skus', {
        params: {
          search: q && q.trim().length > 0 ? q.trim() : undefined,
          limit: 30,
          skip: 0,
          order: 'desc',
        },
      });
      const list: HospitalItem[] = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems(list);
    } catch (e: any) {
      const formatted = formatApiError(e);
      setError(formatted.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList(search);
  }, [fetchList, search]);

  const openResolve = (item: HospitalItem) => {
    setActiveSku(item);
    setResolveType('auto_revert');
    setResolveNewQty(String(item.hospital_quantity_backup ?? 0));
    setResolveNotes('');
    setResolveOpen(true);
  };

  const canResolve = useMemo(() => {
    if (!activeSku) return false;
    if (resolveType === 'auto_revert') return true;
    const n = parseInt(resolveNewQty, 10);
    return !isNaN(n) && n >= 0;
  }, [activeSku, resolveType, resolveNewQty]);

  const doResolve = async () => {
    if (!activeSku) return;
    if (!canResolve) {
      Alert.alert('Invalid quantity', 'Please enter a valid quantity.');
      return;
    }

    setResolving(true);
    setError(null);
    try {
      if (resolveType === 'auto_revert') {
        await api.put(`/api/hospital/sku/${encodeURIComponent(activeSku.sku_id)}/resolve`, {
          resolution_type: 'auto_revert',
          notes: resolveNotes.trim() ? resolveNotes.trim() : undefined,
        });
      } else {
        const qty = parseInt(resolveNewQty, 10);
        await api.put(`/api/hospital/sku/${encodeURIComponent(activeSku.sku_id)}/resolve`, {
          resolution_type: 'manual',
          new_quantity: qty,
          notes: resolveNotes.trim() ? resolveNotes.trim() : undefined,
        });
      }

      setResolveOpen(false);
      setActiveSku(null);
      await fetchList(search);
      Alert.alert('Resolved', 'SKU was resolved successfully.');
    } catch (e: any) {
      const formatted = formatApiError(e);
      setError(formatted.message);
      Alert.alert('Resolve failed', formatted.message);
    } finally {
      setResolving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AlertTriangle size={20} color={theme.colors.warning} strokeWidth={2} />
          <Text style={styles.title}>Hospital</Text>
        </View>
        <Text style={styles.subtitle}>Quarantined SKUs that need resolution</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by SKU code or name"
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.refreshBtn} onPress={() => void fetchList(search)} activeOpacity={0.85}>
          <ClipboardList size={16} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading hospital SKUs…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(it) => it.sku_id}
        style={styles.list}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <XCircle size={26} color={theme.colors.textMuted} strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>No hospital items</Text>
            <Text style={styles.emptyText}>When a SKU is quarantined, it will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardCode}>{item.sku_code}</Text>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
              <View style={styles.severityPill}>
                <Text style={[styles.severityText, { color: severityColor(item.hospital_severity) }]}>
                  {(item.hospital_severity ?? '—').toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.cardReason} numberOfLines={2}>
              {item.hospital_reason ? `Reason: ${item.hospital_reason}` : 'Reason: —'}
            </Text>

            <View style={styles.cardMetaRow}>
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Backup qty</Text>
                <Text style={styles.metaValue}>{item.hospital_quantity_backup ?? 0}</Text>
              </View>
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Current qty</Text>
                <Text style={styles.metaValue}>{item.inventory_quantity ?? 0}</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => openResolve(item)}
                activeOpacity={0.85}
              >
                <CheckCircle size={16} color="#fff" strokeWidth={2} />
                <Text style={styles.actionTextPrimary}>Resolve</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Resolve modal */}
      <Modal visible={resolveOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => (resolving ? null : setResolveOpen(false))}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Resolve hospital SKU</Text>

            {activeSku ? (
              <>
                <Text style={styles.modalSkuCode}>{activeSku.sku_code}</Text>
                <Text style={styles.modalSkuName} numberOfLines={1}>
                  {activeSku.name}
                </Text>

                <View style={styles.modalTypeRow}>
                  <TouchableOpacity
                    style={[styles.typePill, resolveType === 'auto_revert' && styles.typePillSelected]}
                    onPress={() => setResolveType('auto_revert')}
                    disabled={resolving}
                  >
                    <Text style={[styles.typePillText, resolveType === 'auto_revert' && styles.typePillTextSelected]}>Auto revert</Text>
                    <Text style={styles.typePillMeta}>Restore backup</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typePill, resolveType === 'manual' && styles.typePillSelected]}
                    onPress={() => setResolveType('manual')}
                    disabled={resolving}
                  >
                    <Text style={[styles.typePillText, resolveType === 'manual' && styles.typePillTextSelected]}>Manual</Text>
                    <Text style={styles.typePillMeta}>Set new quantity</Text>
                  </TouchableOpacity>
                </View>

                {resolveType === 'manual' ? (
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>New quantity</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={resolveNewQty}
                      keyboardType="numeric"
                      onChangeText={setResolveNewQty}
                    />
                  </View>
                ) : null}

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Notes (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={resolveNotes}
                    placeholder="e.g. count confirmed, discrepancy explained"
                    placeholderTextColor={theme.colors.textMuted}
                    onChangeText={setResolveNotes}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.modalResolveBtn, (!canResolve || resolving) && styles.modalResolveBtnDisabled]}
                  onPress={() => void doResolve()}
                  disabled={!canResolve || resolving}
                  activeOpacity={0.9}
                >
                  {resolving ? <ActivityIndicator color="#fff" /> : <CheckCircle size={18} color="#fff" strokeWidth={2} />}
                  <Text style={styles.modalResolveText}>{resolving ? 'Resolving…' : 'Resolve'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalBackBtn} onPress={() => setResolveOpen(false)} disabled={resolving} activeOpacity={0.85}>
                  <Text style={styles.modalBackText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl + 40 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing.xxl },
  loadingText: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  header: { marginBottom: theme.spacing.lg },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  title: { ...theme.typography.titleSmall, color: theme.colors.text, fontSize: 20 },
  subtitle: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  searchInput: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundElevated,
    color: theme.colors.text,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  list: { flexGrow: 0 },
  card: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.sm },
  cardTitleWrap: { flex: 1, minWidth: 0 },
  cardCode: { ...theme.typography.label, color: theme.colors.text, fontSize: 16 },
  cardName: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 4 },
  severityPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  severityText: { ...theme.typography.caption, fontWeight: '800' },
  cardReason: { ...theme.typography.bodySmall, color: theme.colors.textMuted, marginTop: theme.spacing.sm, lineHeight: 18 },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.md, gap: theme.spacing.sm },
  metaBlock: { flex: 1, backgroundColor: theme.colors.backgroundElevated, borderRadius: theme.radius.md, padding: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  metaLabel: { ...theme.typography.caption, color: theme.colors.textSecondary },
  metaValue: { ...theme.typography.titleSmall, color: theme.colors.text, marginTop: 4, fontSize: 18 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: theme.spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: 12, paddingHorizontal: theme.spacing.lg, borderRadius: theme.radius.md, borderWidth: 1 },
  actionBtnPrimary: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  actionTextPrimary: { ...theme.typography.label, color: '#fff', fontWeight: '800' },

  errorBanner: { padding: theme.spacing.lg, borderRadius: theme.radius.lg, backgroundColor: theme.colors.errorDim, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)', marginBottom: theme.spacing.lg },
  errorText: { color: theme.colors.error, ...theme.typography.bodySmall },

  emptyWrap: { paddingVertical: theme.spacing.xxl, alignItems: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.backgroundElevated, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.md },
  emptyTitle: { ...theme.typography.titleSmall, color: theme.colors.text, fontSize: 18 },
  emptyText: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: theme.spacing.xs, textAlign: 'center', maxWidth: 320 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.xl },
  modalContent: { width: '100%', backgroundColor: theme.colors.backgroundCard, borderRadius: theme.radius.xl, padding: theme.spacing.xl, borderWidth: 1, borderColor: theme.colors.border },
  modalTitle: { ...theme.typography.titleSmall, color: theme.colors.text, fontSize: 20, textAlign: 'center', marginBottom: theme.spacing.md },
  modalSkuCode: { ...theme.typography.label, color: theme.colors.text, fontSize: 18, textAlign: 'center' },
  modalSkuName: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.xs },

  modalTypeRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  typePill: { flex: 1, borderRadius: theme.radius.lg, backgroundColor: theme.colors.backgroundElevated, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.sm, alignItems: 'center' },
  typePillSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryDim },
  typePillText: { ...theme.typography.label, color: theme.colors.textSecondary, fontWeight: '800' },
  typePillTextSelected: { color: theme.colors.text },
  typePillMeta: { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 },

  modalField: { marginTop: theme.spacing.lg },
  modalLabel: { ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
  modalInput: {
    height: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundElevated,
    color: theme.colors.text,
  },

  modalResolveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.radius.lg, marginTop: theme.spacing.xl },
  modalResolveBtnDisabled: { opacity: 0.65 },
  modalResolveText: { ...theme.typography.label, color: '#fff', fontWeight: '800' },

  modalBackBtn: { marginTop: theme.spacing.md, paddingVertical: 10, alignItems: 'center' },
  modalBackText: { ...theme.typography.label, color: theme.colors.textSecondary, fontWeight: '700' },
});

export default HospitalScreen;

