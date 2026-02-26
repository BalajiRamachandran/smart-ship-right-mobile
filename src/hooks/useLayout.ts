import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

const TABLET_BREAKPOINT = 768;

/**
 * Use for responsive layout: content width, padding, and whether we're on a tablet (e.g. iPad).
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = useMemo(() => width >= TABLET_BREAKPOINT, [width]);
  const contentWidth = useMemo(() => (isTablet ? Math.min(560, width * 0.6) : width), [width, isTablet]);
  const horizontalPadding = useMemo(() => (isTablet ? 32 : 16), [isTablet]);
  return { width, height, isTablet, contentWidth, horizontalPadding };
}
