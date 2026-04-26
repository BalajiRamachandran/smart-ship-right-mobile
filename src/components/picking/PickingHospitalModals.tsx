import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle, MapPin, X } from 'lucide-react-native';
import { theme } from '../../theme';
import { markLocationHospital, reportItemHospitalDuringPicking } from '../../api/pickingHospital';
import { formatApiError } from '../../utils/formatApiError';

export type PickListItem = {
  batch_item_id: string;
  sku_id: string;
  sku_code?: string | null;
  sku_name?: string | null;
  location?: string | null;
  location_id?: string | null;
  quantity_required?: number;
  total_quantity_required?: number;
  quantity_picked?: number;
};

const ISSUE_TYPES: { value: string; label: string }[] = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'missing', label: 'Missing' },
  { value: 'misplaced', label: 'Misplaced' },
  { value: 'defective', label: 'Defective' },
  { value: 'expired', label: 'Expired' },
  { value: 'wrong_item', label: 'Wrong item' },
];

const SEVERITIES: { value: string; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const LOCATION_REASONS: { value: string; label: string }[] = [
  { value: 'not_enough_units', label: 'Not enough units' },
  { value: 'damaged_items', label: 'Damaged items' },
  { value: 'location_empty', label: 'Location empty' },
  { value: 'needs_count', label: 'Needs count' },
];

type Props = {
  itemModalVisible: boolean;
  locationModalVisible: boolean;
  currentItem: PickListItem | null;
  onCloseItem: () => void;
  onCloseLocation: () => void;
  onReported: () => void;
};

export function PickingHospitalModals({
  itemModalVisible,
  locationModalVisible,
  currentItem,
  onCloseItem,
  onCloseLocation,
  onReported,
}: Props) {
  const [issueType, setIssueType] = useState('damaged');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [pickerNotes, setPickerNotes] = useState('');
  const [pauseBatch, setPauseBatch] = useState(false);
  const [itemSubmitting, setItemSubmitting] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  const [locReason, setLocReason] = useState('not_enough_units');
  const [locDescription, setLocDescription] = useState('');
  const [locSubmitting, setLocSubmitting] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemModalVisible) {
      setIssueType('damaged');
      setSeverity('medium');
      setDescription('');
      setPickerNotes('');
      setPauseBatch(false);
      setItemError(null);
    }
  }, [itemModalVisible]);

  useEffect(() => {
    if (!locationModalVisible) {
      setLocReason('not_enough_units');
      setLocDescription('');
      setLocError(null);
    }
  }, [locationModalVisible]);

  const qtyRemaining = currentItem
    ? Math.max(
        0,
        (currentItem.total_quantity_required ?? currentItem.quantity_required ?? 0) - (currentItem.quantity_picked ?? 0),
      )
    : 0;

  const submitItem = async () => {
    if (!currentItem?.location_id) {
      setItemError('This line has no warehouse location ID. Use skip order or flag location by ID in the web app.');
      return;
    }
    if (!description.trim()) {
      setItemError('Please describe the issue.');
      return;
    }
    setItemSubmitting(true);
    setItemError(null);
    try {
      await reportItemHospitalDuringPicking({
        batch_item_id: currentItem.batch_item_id,
        sku_id: currentItem.sku_id,
        location_id: currentItem.location_id,
        quantity_affected: qtyRemaining || 1,
        issue_type: issueType,
        severity,
        description: description.trim(),
        picker_notes: pickerNotes.trim() || undefined,
        pause_batch: pauseBatch,
      });
      onCloseItem();
      onReported();
    } catch (e: unknown) {
      setItemError(formatApiError(e).message);
    } finally {
      setItemSubmitting(false);
    }
  };

  const submitLocation = async () => {
    if (!currentItem?.location_id) {
      setLocError('No location ID for this pick line.');
      return;
    }
    setLocSubmitting(true);
    setLocError(null);
    try {
      await markLocationHospital(currentItem.location_id, {
        reason: locReason,
        description: locDescription.trim() || undefined,
      });
      onCloseLocation();
      onReported();
    } catch (e: unknown) {
      setLocError(formatApiError(e).message);
    } finally {
      setLocSubmitting(false);
    }
  };

  const SelectChip = ({
    options,
    value,
    onChange,
  }: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
  }) => (
    <View style={styles.chipWrap}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          style={[styles.chip, value === o.value && styles.chipSelected]}
          onPress={() => onChange(o.value)}
          activeOpacity={0.85}
        >
          <Text style={[styles.chipText, value === o.value && styles.chipTextSelected]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <>
      <Modal visible={itemModalVisible} transparent animationType="fade" onRequestClose={onCloseItem}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <AlertTriangle size={22} color={theme.colors.error} strokeWidth={2} />
              <Text style={styles.sheetTitle}>Report item issue</Text>
              <TouchableOpacity onPress={onCloseItem} hitSlop={12} accessibilityLabel="Close">
                <X size={24} color={theme.colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSubtitle}>Quarantines the SKU line and holds affected orders (same as web picking).</Text>
            {currentItem ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoSku}>{currentItem.sku_code || currentItem.sku_id}</Text>
                {currentItem.sku_name ? <Text style={styles.infoMuted}>{currentItem.sku_name}</Text> : null}
                <Text style={styles.infoMuted}>Qty affected: {qtyRemaining || 1}</Text>
              </View>
            ) : null}
            {itemError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{itemError}</Text>
              </View>
            ) : null}
            <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Issue type</Text>
              <SelectChip options={ISSUE_TYPES} value={issueType} onChange={setIssueType} />
              <Text style={styles.label}>Severity</Text>
              <SelectChip options={SEVERITIES} value={severity} onChange={setSeverity} />
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.input}
                placeholder="What did you find at the bin?"
                placeholderTextColor={theme.colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
              <Text style={styles.label}>Picker notes (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Anything else for the team"
                placeholderTextColor={theme.colors.textMuted}
                value={pickerNotes}
                onChangeText={setPickerNotes}
                multiline
              />
              <View style={styles.pauseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pauseTitle}>Pause entire batch</Text>
                  <Text style={styles.pauseHint}>Use when the issue needs immediate attention</Text>
                </View>
                <Switch value={pauseBatch} onValueChange={setPauseBatch} trackColor={{ false: '#334155', true: theme.colors.primaryDim }} />
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnGhost} onPress={onCloseItem} disabled={itemSubmitting}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => void submitItem()} disabled={itemSubmitting}>
                {itemSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Submit report</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={locationModalVisible} transparent animationType="fade" onRequestClose={onCloseLocation}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <MapPin size={22} color={theme.colors.warning} strokeWidth={2} />
              <Text style={styles.sheetTitle}>Flag location</Text>
              <TouchableOpacity onPress={onCloseLocation} hitSlop={12} accessibilityLabel="Close">
                <X size={24} color={theme.colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSubtitle}>Marks the bin non-pickable until cleared in the warehouse app.</Text>
            {currentItem?.location ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoSku}>{currentItem.location}</Text>
                {currentItem.location_id ? <Text style={styles.infoMuted}>ID: {currentItem.location_id}</Text> : null}
              </View>
            ) : null}
            {locError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{locError}</Text>
              </View>
            ) : null}
            <Text style={styles.label}>Reason</Text>
            <SelectChip options={LOCATION_REASONS} value={locReason} onChange={setLocReason} />
            <Text style={styles.label}>Details (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Short note for ops"
              placeholderTextColor={theme.colors.textMuted}
              value={locDescription}
              onChangeText={setLocDescription}
              multiline
            />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnGhost} onPress={onCloseLocation} disabled={locSubmitting}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnWarn} onPress={() => void submitLocation()} disabled={locSubmitting}>
                {locSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Flag location</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: theme.colors.backgroundElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    padding: theme.spacing.lg,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  sheetTitle: { flex: 1, ...theme.typography.titleSmall, color: theme.colors.text },
  sheetSubtitle: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginBottom: theme.spacing.md },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoSku: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  infoMuted: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 4 },
  errorBox: {
    backgroundColor: theme.colors.errorDim,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  errorText: { color: theme.colors.error, ...theme.typography.bodySmall },
  formScroll: { maxHeight: 320 },
  label: { ...theme.typography.label, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs, marginTop: theme.spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipSelected: { backgroundColor: theme.colors.primaryDim, borderColor: theme.colors.primary },
  chipText: { ...theme.typography.bodySmall, color: theme.colors.textSecondary },
  chipTextSelected: { color: theme.colors.text, fontWeight: '700' },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    padding: theme.spacing.md,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  pauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  pauseTitle: { fontWeight: '700', color: theme.colors.text },
  pauseHint: { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  btnGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
  },
  btnGhostText: { color: theme.colors.text, fontWeight: '700' },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnWarn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },
});
