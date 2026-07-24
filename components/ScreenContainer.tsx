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
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeIn } from './FadeIn';
import { colors, spacing } from '../lib/theme';

/**
 * Ancho máximo por defecto del contenido. Los móviles (ancho < 720) no se ven
 * afectados; en tablet y escritorio el contenido queda centrado y legible en
 * vez de estirarse de borde a borde. Cada pantalla puede sobreescribirlo.
 */
const DEFAULT_MAX_WIDTH = 720;

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /**
   * Ancho máximo del contenido (columna centrada). Por defecto 720 (cómodo en
   * tablet/escritorio, transparente en móvil). Pasa un valor propio para
   * formularios más estrechos (p. ej. acceso) o `0` para ancho completo.
   */
  maxWidth?: number;
}

/**
 * Contenedor base de pantalla: padding coherente en todas las vistas y, si
 * se pide, columna centrada de ancho máximo (p. ej. formularios de acceso).
 */
export function ScreenContainer({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  maxWidth,
}: ScreenContainerProps) {
  // 0 = ancho completo explícito; undefined = usa el máximo por defecto.
  const cap = maxWidth === 0 ? null : { maxWidth: maxWidth ?? DEFAULT_MAX_WIDTH };
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerRow}>
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
