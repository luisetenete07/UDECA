import { Platform } from 'react-native';
import { colors, fonts } from './theme';

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
  // El navegador pinta un fondo opaco propio en cada escena y tapaba el
  // degradado de app/_layout.tsx. Transparente para que se vea el de detrás.
  sceneStyle: { backgroundColor: 'transparent' },
  tabBarLabelStyle: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.2,
    marginBottom: Platform.OS === 'web' ? 6 : 0,
  },
} as const;

export const stackScreenOptions = {
  headerStyle: { backgroundColor: 'transparent' },
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
  contentStyle: { backgroundColor: 'transparent' },
} as const;
