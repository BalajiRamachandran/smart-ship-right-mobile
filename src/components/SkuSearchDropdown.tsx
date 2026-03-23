import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api/client';
import { theme } from '../theme';
import { Package } from 'lucide-react-native';

export type SkuSearchResult = {
  id: string;
  sku_code: string;
  name: string;
  primary_image_url?: string | null;
};

type Props = {
  placeholder?: string;
  minChars?: number;
  limit?: number;
  onSelect: (sku: SkuSearchResult) => void;
};

function normalizeText(s: string) {
  return s.trim();
}

const SkuSearchDropdown: React.FC<Props> = ({ placeholder = 'Search SKU', minChars = 2, limit = 8, onSelect }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SkuSearchResult[]>([]);

  const [error, setError] = useState<string | null>(null);
  const lastReqId = useRef(0);

  const canSearch = useMemo(() => normalizeText(query).length >= minChars, [query, minChars]);

  const fetchResults = useCallback(async (q: string) => {
    const reqId = ++lastReqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<any>('/api/inventory/skus', {
        params: { search: q, limit },
      });

      // Backend paginated_response: { success: true, data: { items: [] } }
      const items: any[] = res.data?.data?.items ?? res.data?.items ?? [];
      const mapped: SkuSearchResult[] = Array.isArray(items)
        ? items.map((it) => ({
            id: it.id,
            sku_code: it.sku_code,
            name: it.name,
            primary_image_url: it.primary_image_url ?? null,
          }))
        : [];

      if (reqId !== lastReqId.current) return; // stale
      setResults(mapped.slice(0, limit));
    } catch (e: any) {
      if (reqId !== lastReqId.current) return;
      setError('SKU search failed');
      setResults([]);
    } finally {
      if (reqId === lastReqId.current) setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const q = normalizeText(query);
    const t = setTimeout(() => {
      void fetchResults(q);
    }, 300);
    return () => clearTimeout(t);
  }, [canSearch, query, fetchResults]);

  const onPick = (sku: SkuSearchResult) => {
    setQuery(`${sku.sku_code}`);
    setResults([]);
    onSelect(sku);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(t) => setQuery(t)}
        />
        {loading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {canSearch && results.length > 0 ? (
        <View style={styles.dropdown}>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => onPick(item)} activeOpacity={0.8}>
                {item.primary_image_url ? (
                  <Image source={{ uri: item.primary_image_url }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={styles.thumbFallback}>
                    <Package size={18} color={theme.colors.textMuted} strokeWidth={2} />
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={styles.code} numberOfLines={1}>
                    {item.sku_code}
                  </Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListFooterComponent={results.length >= limit ? <View style={{ height: 8 }} /> : null}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: theme.spacing.lg,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    fontSize: 16,
  },
  dropdown: {
    marginTop: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundCard,
    maxHeight: 260,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.backgroundElevated,
  },
  thumbFallback: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  code: { ...theme.typography.label, color: theme.colors.text },
  name: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 2 },
  errorText: { color: theme.colors.error, ...theme.typography.bodySmall, marginTop: theme.spacing.xs },
});

export default SkuSearchDropdown;

