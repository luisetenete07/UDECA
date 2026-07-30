import { Platform, useWindowDimensions } from 'react-native';
import { BREAKPOINTS, CONTENT_MAX_WIDTH } from './responsive';
import { colors, fonts, radius, spacing } from './theme';

/**
 * Estilo de navegación compartido (élite y consistente): barra de pestañas
 * negra con filo dorado y cabeceras de pila a juego. Un único sitio para
 * que todas las secciones se sientan la misma app.
 */
export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primaryBright,
  tabBarInactiveTintColor: colors.textFaint,
  tabBarStyle: {
    backgroundColor: '#050505',
    borderTopWidth: 1,
    borderTopColor: colors.hairlineFaint,
    height: Platform.OS === 'web' ? 62 : 84,
    paddingTop: 6,
  },
  tabBarLabelStyle: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.2,
    marginBottom: Platform.OS === 'web' ? 6 : 0,
  },
} as const;

/**
 * Barra de pestañas adaptada al tamaño de la ventana.
 *
 * A pantalla completa, una barra pegada al fondo de 1440 px con cinco iconos
 * repartidos cada 288 px es el patrón del móvil estirado: los destinos quedan
 * tan separados que hay que buscarlos con la vista. Aquí se convierte en un
 * muelle centrado, del mismo ancho que la columna de contenido y separado del
 * borde, que es lo que hace que la app se sienta pensada para el escritorio y
 * no simplemente redimensionada.
 *
 * En móvil se queda exactamente como estaba: pegada abajo y de lado a lado.
 */
export function useTabScreenOptions() {
  const { width } = useWindowDimensions();
  const pantallaAncha = Platform.OS === 'web' && width >= BREAKPOINTS.tablet;
  if (!pantallaAncha) return tabScreenOptions;

  // El muelle se alinea con la columna de contenido. Se calcula el desplazamiento
  // a mano en vez de centrarlo con `alignSelf`: en un elemento posicionado en
  // absoluto con `left` y `right`, `alignSelf` no hace nada y la barra se queda
  // pegada a la izquierda.
  const ancho = Math.min(CONTENT_MAX_WIDTH, width - spacing.xl * 2);
  const izquierda = Math.max(spacing.xl, Math.round((width - ancho) / 2));

  return {
    ...tabScreenOptions,
    tabBarStyle: {
      ...tabScreenOptions.tabBarStyle,
      position: 'absolute' as const,
      width: ancho,
      left: izquierda,
      right: undefined,
      bottom: spacing.md,
      height: 64,
      borderRadius: radius.full,
      borderTopWidth: 0,
      borderWidth: 1,
      borderColor: colors.hairlineFaint,
      // Casi opaco: el contenido pasa por debajo al desplazar y con menos
      // opacidad se transparenta el texto y ensucia la barra. Sin desenfoque
      // de fondo (no existe en nativo), lo limpio es tapar.
      backgroundColor: 'rgba(10,9,8,0.98)',
      paddingTop: 8,
      paddingHorizontal: spacing.sm,
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
  };
}

export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.primary,
  headerTitleStyle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    color: colors.text,
    letterSpacing: 0.2,
  },
  headerTitleAlign: 'center' as const,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
  contentStyle: { backgroundColor: colors.background },
} as const;
