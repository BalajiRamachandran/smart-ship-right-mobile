import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CheckCircle, Package, RotateCcw } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { AdjustStackParamList } from '../navigation/types';
import { formatApiError } from '../utils/formatApiError';
import { theme } from '../theme';

type Props = NativeStackScreenProps<AdjustStackParamList, 'AdjustInventory'>;

type SkuInfo = {
  id: string;
  sku_code: string;
  name: string;
  inventory_quantity?: number | null;
};

type LocationsResponse = {
  success?: boolean;
  total_quantity?: number;
  locations?: Array<{ quantity: number }>;
};

const AdjustInventoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const { skuId } = route.params;
  const [sku, setSku] = useState<SkuInfo | null>(null);
  const [currentQuantity, setCurrentQuantity] = useState(0);
  const [newQuantity, setNewQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadSku = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [skuRes, locRes] = await Promise.all([
        api.get<any>(`/api/inventory/skus/${encodeURIComponent(skuId)}`),
        api.get<LocationsResponse>(`/api/inventory/skus/${encodeURIComponent(skuId)}/locations`).catch(() => ({ data: {} })),
      ]);
      const skuData = skuRes.data;
      if (skuData?.success === false && skuData?.id == null) {
        throw new Error(skuData?.error || 'SKU not found');
      }
      if (!skuData?.id) {
        throw new Error('SKU not found');
      }
      const qty = skuData.inventory_quantity ?? locRes.data?.total_quantity ?? 0;
      setSku({
        id: skuData.id,
        sku_code: skuData.sku_code,
        name: skuData.name ?? '',
        inventory_quantity: skuData.inventory_quantity,
      });
      setCurrentQuantity(Number(qty) || 0);
      setNewQuantity(String(Number(qty) || 0));
    } catch (e: any) {
      const formatted = formatApiError(e);
      setError(formatted.message);
      setSku(null);
    } finally {
      setLoading(false);
    }
  }, [skuId]);

  useEffect(() => {
    void loadSku();
  }, [loadSku]);

  const handleSave = async () => {
    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      setError('Quantity must be 0 or greater');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.post(`/api/inventory/skus/${encodeURIComponent(skuId)}/adjust-inventory`, {
        new_quantity: qty,
        reason: reason.trim(),
      });
      setSuccess(true);
    } catch (e: any) {
      const formatted = formatApiError(e);
      setError(formatted.message);
    } finally {
      setSaving(false);
    }
  };

  const adjustAnother = () => {
    setSuccess(false);
    setReason('');
    navigation.navigate('AdjustRoot');
  };

  const difference = parseInt(newQuantity, 10) - currentQuantity;
  const showDiff = !isNaN(difference) && difference !== 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading SKU…</Text>
      </View>
    );
  }

  if (error && !sku) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('AdjustRoot')}>
          <Text style={styles.backButtonText}>Back to Scan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (success && sku) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.successContent} keyboardShouldPersistTaps="handled">
        <View style={styles.successCard}>
          <View style={styles.successIconWrap}>
            <CheckCircle size={56} color={theme.colors.success} strokeWidth={2} />
          </View>
          <Text style={styles.successTitle}>Inventory updated</Text>
          <Text style={styles.successSubtitle}>
            {sku.sku_code} is now set to {newQuantity} units.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={adjustAnother} activeOpacity={0.85}>
            <RotateCcw size={20} color="#fff" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Adjust another</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (!sku) return null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.skuCard}>
          <Package size={24} color={theme.colors.primary} strokeWidth={2} />
          <View style={styles.skuInfo}>
            <Text style={styles.skuCode}>{sku.sku_code}</Text>
            <Text style={styles.skuName} numberOfLines={2}>{sku.name}</Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Current quantity</Text>
          <View style={styles.currentQtyWrap}>
            <Text style={styles.currentQty}>{currentQuantity}</Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New quantity *</Text>
          <TextInput
            style={styles.input}
            value={newQuantity}
            onChangeText={(t) => { setNewQuantity(t); setError(null); }}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={theme.colors.textMuted}
            editable={!saving}
          />
          {showDiff && (
            <Text style={[styles.diffText, difference > 0 ? styles.diffPlus : styles.diffMinus]}>
              {difference > 0 ? '+' : ''}{difference} units
            </Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Reason for change *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={reason}
            onChangeText={(t) => { setReason(t); setError(null); }}
            placeholder="e.g. Physical count, damaged goods"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={3}
            editable={!saving}
          />
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl + 40 },
  loadingText: { marginTop: theme.spacing.md, ...theme.typography.bodySmall, color: theme.colors.textSecondary },
  errorText: { color: theme.colors.error, ...theme.typography.bodySmall, textAlign: 'center' },
  backButton: { marginTop: theme.spacing.lg, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xl },
  backButtonText: { color: theme.colors.primary, fontWeight: '600', fontSize: 16 },
  skuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  skuInfo: { flex: 1, marginLeft: theme.spacing.md },
  skuCode: { ...theme.typography.label, fontSize: 16, color: theme.colors.text },
  skuName: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 2 },
  fieldGroup: { marginBottom: theme.spacing.lg },
  label: { ...theme.typography.label, color: theme.colors.text, marginBottom: theme.spacing.sm },
  currentQtyWrap: { padding: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.backgroundElevated, borderWidth: 1, borderColor: theme.colors.border },
  currentQty: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  input: {
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    fontSize: 16,
  },
  textArea: { height: 88, paddingTop: theme.spacing.md, textAlignVertical: 'top' },
  diffText: { marginTop: theme.spacing.xs, fontSize: 13, fontWeight: '600' },
  diffPlus: { color: theme.colors.success },
  diffMinus: { color: theme.colors.error },
  errorBanner: { marginBottom: theme.spacing.md, padding: theme.spacing.md, borderRadius: theme.radius.sm, backgroundColor: theme.colors.errorDim, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    marginTop: theme.spacing.sm,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  successContent: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.xl },
  successCard: { alignItems: 'center', padding: theme.spacing.xxl },
  successIconWrap: { marginBottom: theme.spacing.lg },
  successTitle: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.xs },
  successSubtitle: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginBottom: theme.spacing.xl, textAlign: 'center' },
});

export default AdjustInventoryScreen;
