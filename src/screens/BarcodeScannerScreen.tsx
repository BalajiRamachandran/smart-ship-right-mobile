import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoveSkuStackParamList, PickingStackParamList } from '../navigation/types';
import { theme } from '../theme';

type Props = NativeStackScreenProps<MoveSkuStackParamList | PickingStackParamList, 'Scanner'>;

const BarcodeScannerScreen: React.FC<Props> = ({ navigation, route }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);

  const barcodeTypes = useMemo(
    () => [
      'qr',
      'code128',
      'code39',
      'code93',
      'ean13',
      'ean8',
      'upc_a',
      'upc_e',
      'itf14',
      'pdf417',
      'datamatrix',
    ],
    [],
  );

  useEffect(() => {
    setHasScanned(false);
  }, [route.params.field]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Preparing camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera permission required</Text>
        <Text style={styles.subtitle}>
          Enable camera access to scan barcodes.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => void requestPermission()}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes }}
        onBarcodeScanned={(result) => {
          if (hasScanned) return;
          const value = String((result as any).data || '').trim();
          if (!value) return;
          setHasScanned(true);
          navigation.navigate(route.params.returnTo, {
            scannedField: route.params.field,
            scannedValue: value,
          } as any);
        }}
      />

      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Scan {route.params.title || 'Barcode'}</Text>
        <Text style={styles.overlaySubtitle}>
          Align the barcode inside the frame.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.smallButton, styles.secondaryButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.smallButtonText}>Cancel</Text>
          </TouchableOpacity>
          {hasScanned ? (
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => setHasScanned(false)}
            >
              <Text style={styles.smallButtonText}>Scan Again</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundCard,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  overlayTitle: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  overlaySubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  actions: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  button: {
    marginTop: theme.spacing.lg,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  smallButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  smallButtonText: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  title: {
    marginTop: theme.spacing.xxl,
    ...theme.typography.titleSmall,
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
});

export default BarcodeScannerScreen;

