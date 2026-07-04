export const colors = {
  background: '#000000',
  surface: '#0D0D0D',
  surfaceAlt: '#181818',
  border: '#2A2A2A',
  primary: '#E0242F',
  primaryDark: '#8F1720',
  primaryMuted: 'rgba(224, 36, 47, 0.14)',
  accent: '#FFFFFF',
  danger: '#E0242F',
  dangerMuted: 'rgba(224, 36, 47, 0.14)',
  warning: '#E0242F',
  text: '#FFFFFF',
  textMuted: '#ADADAD',
  textFaint: '#666666',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  full: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: 0.2 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.2 },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 1 },
};
