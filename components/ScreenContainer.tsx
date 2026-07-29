import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeIn } from './FadeIn';
import { colors, gradients, spacing } from '../lib/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /**
   * Ancho máximo del contenido. Por defecto NO se limita: el contenido usa TODA
   * la pantalla a pantalla completa (móvil, tablet y escritorio), con solo un
   * margen fino y constante para que el texto no toque el borde. Únicamente los
   * formularios de acceso piden una columna estrecha.
   */
  maxWidth?: number;
}

/**
 * Contenedor base de pantalla: margen lateral fino y constante en todos los
 * tamaños, para que en ordenador y tablet el diseño llegue de lado a lado (sin
 * bandas negras) y a la vez el contenido no se pegue al borde. El ancho solo se
 * limita si una pantalla concreta lo pide.
 */
export function ScreenContainer({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  maxWidth,
}: ScreenContainerProps) {
  // Solo se limita el ancho si la pantalla lo pide expresamente (> 0).
  const cap = maxWidth && maxWidth > 0 ? { maxWidth } : null;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LinearGradient
          colors={gradients.appBackground}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.centerRow}>
          <FadeIn style={[styles.column, cap, contentStyle]}>{children}</FadeIn>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Fondo de la pantalla. Va aquí y no en el layout raíz porque el
          contenedor de navegación pinta su propio fondo por encima; dentro del
          marco de la pantalla queda fijo igualmente mientras el contenido se
          desplaza, que es lo que importa. */}
      <LinearGradient
        colors={gradients.appBackground}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          <FadeIn style={[styles.column, cap, contentStyle]}>{children}</FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    // Opaco a propósito: si esto fuera transparente se vería el fondo claro
    // que pinta el contenedor de navegación por debajo.
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  centerRow: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  column: {
    width: '100%',
    alignSelf: 'center',
  },
});
