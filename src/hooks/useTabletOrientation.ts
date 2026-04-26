import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 768;

/**
 * Phones stay portrait-locked; tablets can rotate for wider picking / history layouts.
 */
export function useTabletOrientation() {
  const { width } = useWindowDimensions();

  useEffect(() => {
    const run = async () => {
      try {
        if (width >= TABLET_BREAKPOINT) {
          await ScreenOrientation.unlockAsync();
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch {
        /* ignore */
      }
    };
    void run();
  }, [width]);
}
