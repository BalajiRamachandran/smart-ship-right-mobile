import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScanBarcode } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { AdjustStackParamList } from '../navigation/types';
import { formatApiError } from '../utils/formatApiError';
import { theme } from '../theme';

type Props = NativeStackScreenProps<AdjustStackParamList, 'AdjustRoot'>;

const AdjustScreen: React.FC<Props> = ({ navigation, route }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scannedField = route.params?.scannedField;
    const scannedValue = route.params?.scannedValue;
    if (scannedField !== 'sku' || !scannedValue?.trim()) return;

    const lookupAndNavigate = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<any>(`/api/inventory/skus/${encodeURIComponent(scannedValue.trim())}`);
        const data = res.data;
        if (data?.success === false && !data?.id) {
          throw new Error(data?.error || 'SKU not found');
        }
        if (!data?.id) {
          throw new Error('SKU not found');
        }
        navigation.replace('AdjustInventory', { skuId: data.id });
      } catch (e: any) {
        const formatted = formatApiError(e);
        setError(formatted.message);
        navigation.setParams({ scannedField: undefined, scannedValue: undefined } as any);
      } finally {
        setLoading(false);
      }
    };

    void lookupAndNavigate();
  }, [route.params?.scannedField, route.params?.scannedValue, navigation]);

  const openScanner = () => {
    setError(null);
    navigation.navigate('Scanner', { returnTo: 'AdjustRoot', field: 'sku', title: 'Scan SKU' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Adjust inventory</Text>
      <Text style={styles.subtitle}>Scan a SKU to set its quantity and reason</Text>

      <TouchableOpacity style={styles.scanButton} onPress={openScanner} disabled={loading} activeOpacity={0.9}>
        {loading ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <>
            <ScanBarcode size={32} color="#fff" strokeWidth={2} />
            <Text style={styles.scanButtonText}>Scan SKU</Text>
            <Text style={styles.scanHint}>Barcode, SKU code, or UUID</Text>
          </>
        )}
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.xl },
  title: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.xs },
  subtitle: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginBottom: theme.spacing.xl },
  scanButton: {
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
  scanButtonText: { marginTop: theme.spacing.sm, fontSize: 18, fontWeight: '800', color: '#fff' },
  scanHint: { marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  errorBanner: { marginTop: theme.spacing.lg, padding: theme.spacing.md, borderRadius: theme.radius.sm, backgroundColor: theme.colors.errorDim, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)' },
  errorText: { color: theme.colors.error, ...theme.typography.bodySmall },
});

export default AdjustScreen;
