import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeIn } from './FadeIn';
import { colors, spacing } from '../lib/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /**
   * Ancho máximo del contenido (columna centrada). Por defecto NO se limita: el
   * contenido usa TODA la pantalla (móvil, tablet y escritorio a pantalla
   * completa). Solo se pasa un valor en pantallas concretas que se ven mejor
   * en columna estrecha (p. ej. los formularios de acceso).
   */
  maxWidth?: number;
}

/**
 * Márgenes laterales que crecen con el tamaño de pantalla: el contenido ocupa
 * todo el ancho, pero en tablet/escritorio respira con más aire a los lados en
 * vez de pegarse a los bordes. Así la experiencia es a pantalla completa y a la
 * vez elegante en cualquier dispositivo.
 */
function horizontalPadding(width: number): number {
  if (width >= 1400) return 72;
  if (width >= 1100) return 56;
  if (width >= 820) return 40;
  return spacing.lg; // móvil: 24
}

/**
 * Contenedor base de pantalla: padding coherente y responsive. El contenido usa
 * todo el ancho disponible salvo que una pantalla pida un ancho máximo propio.
 */
export function ScreenContainer({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  maxWidth,
}: ScreenContainerProps) {
  const { width } = useWindowDimensions();
  const hPad = horizontalPadding(width);
  // Solo se limita el ancho si la pantalla lo pide expresamente (> 0).
  const cap = maxWidth && maxWidth > 0 ? { maxWidth } : null;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.centerRow, { paddingHorizontal: hPad }]}>
          <FadeIn style={[styles.column, cap, contentStyle]}>{children}</FadeIn>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: hPad }]}
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
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  centerRow: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  column: {
    width: '100%',
    alignSelf: 'center',
  },
});
