import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDebugStore } from '../store/debugStore';

const DebugToast: React.FC = () => {
  const enabled = useDebugStore((s) => s.enabled);
  const toastEnabled = useDebugStore((s) => s.toastEnabled);
  const logs = useDebugStore((s) => s.logs);

  const [visibleId, setVisibleId] = useState<string | null>(null);
  const [opacity] = useState(new Animated.Value(0));

  const lastError = logs.find((l) => l.level === 'error');

  useEffect(() => {
    if (!enabled || !toastEnabled || !lastError) return;

    setVisibleId(lastError.id);
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setVisibleId(null);
      });
    }, 4500);

    return () => clearTimeout(timer);
  }, [enabled, toastEnabled, lastError, opacity]);

  if (!enabled || !toastEnabled || !lastError || visibleId !== lastError.id) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.card}>
        <Text style={styles.title}>API Error</Text>
        <Text style={styles.body} numberOfLines={3}>
          {lastError.message || lastError.title}
        </Text>
        <TouchableOpacity onPress={() => setVisibleId(null)}>
          <Text style={styles.dismiss}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    zIndex: 999,
  },
  card: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.7)',
  },
  title: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  body: {
    color: '#e5e7eb',
    fontSize: 11,
  },
  dismiss: {
    marginTop: 6,
    fontSize: 11,
    color: '#93c5fd',
    fontWeight: '600',
    textAlign: 'right',
  },
});

export default DebugToast;

