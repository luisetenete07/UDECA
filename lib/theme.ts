/**
 * Dos familias y ya.
 *
 * El display era Cinzel, una romana con capitales imperiales. Daba ceremonia,
 * pero también daba "diploma": en una pantalla que se abre veinte veces al día
 * para ver números, la ceremonia se lee como lentitud. Sora es geométrica, de
 * las que usan las herramientas técnicas — rendimiento y tecnología en vez de
 * solemnidad— y a tamaño grande con el interletrado apretado tiene la misma
 * presencia sin el disfraz.
 *
 * El oro no se toca: la marca es el color, no la letra.
 */
export const fonts = {
  display: 'Sora_700Bold',
  displaySemiBold: 'Sora_600SemiBold',
  heading: 'Inter_700Bold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
};

export const colors = {
  background: '#000000',
  surface: '#0D0D0D',
  surfaceAlt: '#181818',
  /**
   * Borde casi invisible: solo separa, no dibuja. Un borde que se ve compite
   * con el contenido y llena la pantalla de rectángulos; a este solo se le
   * nota la ausencia.
   */
  border: 'rgba(255,255,255,0.07)',
  /** Para lo poquísimo que de verdad necesita marcar un límite. */
  borderStrong: '#2A2A2A',
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
  // Igual, pero transparente TAMBIÉN al principio: para bandas que no arrancan
  // en el borde de la pantalla, donde `goldHalo` dejaría una línea dura al
  // empezar directamente a máxima opacidad.
  goldHaloSoft: [
    'rgba(162,150,139,0)',
    'rgba(162,150,139,0.18)',
    'rgba(162,150,139,0)',
  ] as const,
  surface: ['#141414', '#0A0A0A'] as const,
  /**
   * Fondo de toda la app. Negro, pero no plano: se aclara muy poco arriba y
   * cae a negro puro abajo, como luz cenital sobre una superficie oscura. El
   * matiz es cálido (no gris azulado) para convivir con el oro de la marca.
   *
   * La diferencia es deliberadamente pequeña: en un fondo oscuro, un degradado
   * que se nota es un degradado que ensucia.
   */
  appBackground: ['#141210', '#0A0908', '#000000'] as const,
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

/**
 * Cifras de ancho fijo. Sin esto, un cronómetro o un contador "bailan" al
 * cambiar de número porque el 1 es más estrecho que el 8. Es el tipo de
 * detalle que no se nota hasta que está bien.
 */
export const tabularNums = { fontVariant: ['tabular-nums' as const] };

/**
 * Escala tipográfica.
 *
 * El interletrado de los títulos pasa a NEGATIVO. Cinzel iba en capitales y
 * pedía aire entre letras; una geométrica a tamaño grande pide lo contrario:
 * apretarla es lo que la hace parecer una herramienta y no un cartel. Cuanto
 * más grande, más apretada — la misma regla que usan Apple, Linear o Stripe.
 *
 * Y hay un escalón nuevo arriba (`hero`) para el dato que manda en cada
 * pantalla. Sin un tamaño reservado a "lo importante", todo acaba a 21 y no
 * manda nada.
 */
export const typography = {
  hero: { fontSize: 34, fontFamily: fonts.display, letterSpacing: -1, lineHeight: 40 },
  h1: { fontSize: 28, fontFamily: fonts.display, letterSpacing: -0.7, lineHeight: 34 },
  h2: { fontSize: 21, fontFamily: fonts.displaySemiBold, letterSpacing: -0.4, lineHeight: 27 },
  h3: { fontSize: 17, fontFamily: fonts.heading, letterSpacing: -0.2, lineHeight: 23 },
  body: { fontSize: 15, fontFamily: fonts.body, lineHeight: 22 },
  small: { fontSize: 13, fontFamily: fonts.body, lineHeight: 19 },
  // Los rótulos sí van abiertos: en mayúsculas y a 12, apretar los hace ilegibles.
  label: { fontSize: 12, fontFamily: fonts.semiBold, letterSpacing: 1.4, lineHeight: 16 },
};

/**
 * Filo de luz superior de las superficies. Imita luz cenital sobre un material
 * real: es lo que separa una tarjeta "premium" de un rectángulo gris.
 */
export const surfaceHighlight = {
  position: 'absolute' as const,
  top: 0,
  // Se queda dentro del tramo recto del borde superior para no cruzar el arco
  // de las esquinas: así la tarjeta no necesita `overflow: hidden`, que
  // recortaría las insignias que hoy se salen del borde a propósito.
  left: radius.lg,
  right: radius.lg,
  height: 1,
  backgroundColor: 'rgba(255,255,255,0.07)',
};
