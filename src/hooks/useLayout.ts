import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

const TABLET_BREAKPOINT = 768;

/**
 * Use for responsive layout: content width, padding, and whether we're on a tablet (e.g. iPad).
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = useMemo(() => width >= TABLET_BREAKPOINT, [width]);
  const horizontalPadding = useMemo(() => (isTablet ? 32 : 16), [isTablet]);
  const contentWidth = useMemo(() => (isTablet ? Math.min(560, width * 0.6) : width), [width, isTablet]);
  /** Max width for primary flows (picking, adjust, hospital) on tablet — centered column. */
  const maxContentWidth = useMemo(() => {
    if (!isTablet) return width;
    return Math.min(820, width - horizontalPadding * 2);
  }, [isTablet, width, horizontalPadding]);
  return { width, height, isTablet, contentWidth, horizontalPadding, maxContentWidth };
}
