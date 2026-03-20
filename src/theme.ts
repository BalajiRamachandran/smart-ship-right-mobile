/**
 * Smart-Ship-Right mobile app theme
 * Clean, modern, dark-first design system
 */
export const theme = {
  colors: {
    background: '#0f172a',
    backgroundElevated: '#1e293b',
    backgroundCard: 'rgba(30, 41, 59, 0.85)',
    surface: '#1e293b',
    border: 'rgba(148, 163, 184, 0.25)',
    borderStrong: 'rgba(148, 163, 184, 0.45)',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    primary: '#3b82f6',
    primaryDim: 'rgba(59, 130, 246, 0.2)',
    success: '#10b981',
    successDim: 'rgba(16, 185, 129, 0.2)',
    warning: '#f59e0b',
    error: '#ef4444',
    errorDim: 'rgba(239, 68, 68, 0.15)',
    tabActive: '#3b82f6',
    tabInactive: '#94a3b8', // visible on dark tab bar
    tabBarBackground: '#0f172a', // solid dark to match app, ensure contrast
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    section: 28, // visual rhythm between sections
  },
  minTouchTarget: 44, // accessibility
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  typography: {
    title: { fontSize: 24, fontWeight: '700' as const },
    titleSmall: { fontSize: 18, fontWeight: '700' as const },
    body: { fontSize: 15 },
    bodySmall: { fontSize: 13 },
    caption: { fontSize: 12 },
    label: { fontSize: 13, fontWeight: '600' as const },
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 3,
    },
    button: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
  },
} as const;
