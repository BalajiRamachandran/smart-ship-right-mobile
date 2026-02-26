import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
import { theme } from '../theme';

/** In Expo Go, BlurView can show "Unimplemented component: ViewManagerAdapter". Use fallback there. */
const useBlur = (Platform.OS === 'ios' || Platform.OS === 'android') && Constants.appOwnership !== 'expo';

type GlassViewProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  borderRadius?: number;
};

/**
 * Apple-style liquid glass / frosted glass surface.
 * Uses BlurView on iOS/Android in dev/production builds; in Expo Go uses a solid fallback to avoid native view errors.
 */
export function GlassView({
  children,
  style,
  intensity = 60,
  tint = 'dark',
  borderRadius = theme.radius.xl,
}: GlassViewProps) {
  if (useBlur) {
    return (
      <BlurView
        intensity={intensity}
        tint={tint}
        style={[styles.glass, { borderRadius }, style]}
      >
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[styles.fallback, { borderRadius }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(30, 41, 59, 0.5)' : 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  fallback: {
    backgroundColor: theme.colors.backgroundCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
