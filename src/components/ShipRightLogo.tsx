import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
};

const LOGO_XML = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="56" viewBox="0 0 260 56">
  <rect x="0" y="2" width="52" height="52" rx="12" fill="#0f172a"/>
  <rect x="10" y="18" width="32" height="24" rx="3" fill="#3b82f6"/>
  <path d="M10 18 L26 11 L26 18 Z" fill="#2563eb"/>
  <path d="M42 18 L26 11 L26 18 Z" fill="#60a5fa"/>
  <path d="M20 32 L26 26 L32 32" stroke="#ffffff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="26" y1="26" x2="26" y2="38" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round"/>
  <text x="62" y="24" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="600" font-size="13" fill="#64748b" letter-spacing="1.5">SMART</text>
  <text x="62" y="44" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#ffffff">Ship Right</text>
</svg>`;

const ShipRightLogo: React.FC<Props> = ({ width = 220, height = 48 }) => {
  return (
    <View style={styles.wrap}>
      <SvgXml xml={LOGO_XML} width={width} height={height} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ShipRightLogo;
