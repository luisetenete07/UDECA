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
  tabBarLabelStyle: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.2,
    marginBottom: Platform.OS === 'web' ? 6 : 0,
  },
} as const;

export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.primary,
  headerTitleStyle: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
  contentStyle: { backgroundColor: colors.background },
} as const;
