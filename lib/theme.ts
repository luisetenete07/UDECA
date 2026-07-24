export const fonts = {
  display: 'Cinzel_700Bold',
  displaySemiBold: 'Cinzel_600SemiBold',
  heading: 'Inter_700Bold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
};

export const colors = {
  background: '#000000',
  surface: '#0D0D0D',
  surfaceAlt: '#181818',
  border: '#2A2A2A',
  primary: '#A2968B',
  /** Oro claro: brillos, extremos de degradado, estados resaltados. */
  primaryBright: '#C9BDB0',
  primaryDark: '#7A6F66',
  primaryMuted: 'rgba(162, 150, 139, 0.16)',
  /** Línea fina dorada translúcida para bordes premium. */
  hairline: 'rgba(162, 150, 139, 0.35)',
  hairlineFaint: 'rgba(162, 150, 139, 0.18)',
  onPrimary: '#0A0A0A',
  accent: '#FFFFFF',
  danger: '#C4433B',
  dangerMuted: 'rgba(196, 67, 59, 0.14)',
  /** Aviso (ámbar): distinto del error rojo, para "próximo/atención" sin alarmar. */
  warning: '#E0A43B',
  warningMuted: 'rgba(224, 164, 59, 0.14)',
  /** Éxito (verde salvia): confirmaciones, "en línea", cobros activos. */
  success: '#4CAF7D',
  successMuted: 'rgba(76, 175, 125, 0.15)',
  successBorder: 'rgba(76, 175, 125, 0.45)',
  text: '#FFFFFF',
  textMuted: '#ADADAD',
  textFaint: '#666666',
  white: '#FFFFFF',
};

/** Degradados de marca (para expo-linear-gradient). */
export const gradients = {
  gold: ['#C9BDB0', '#A2968B', '#8A7E73'] as const,
  goldSubtle: ['rgba(162,150,139,0.22)', 'rgba(162,150,139,0.06)'] as const,
  // Halo ambiental: se funde a totalmente transparente (sin corte contra el negro).
  goldHalo: ['rgba(162,150,139,0.20)', 'rgba(162,150,139,0)'] as const,
  surface: ['#141414', '#0A0A0A'] as const,
};

/** Sombras suaves reutilizables (web + nativo). */
export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  glowGold: {
    shadowColor: '#A2968B',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
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
  h1: { fontSize: 28, fontFamily: fonts.display, letterSpacing: 0.4, lineHeight: 36 },
  h2: { fontSize: 21, fontFamily: fonts.displaySemiBold, letterSpacing: 0.3, lineHeight: 28 },
  h3: { fontSize: 17, fontFamily: fonts.heading, lineHeight: 23 },
  body: { fontSize: 15, fontFamily: fonts.body, lineHeight: 22 },
  small: { fontSize: 13, fontFamily: fonts.body, lineHeight: 19 },
  label: { fontSize: 12, fontFamily: fonts.semiBold, letterSpacing: 1.4, lineHeight: 16 },
};
