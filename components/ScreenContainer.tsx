import React, { useMemo, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeIn } from './FadeIn';
import { ContextoDeBloqueo, type BloqueoDeScroll } from '../lib/bloqueoDeScroll';
import { useLayout } from '../lib/responsive';
import { colors, gradients, spacing } from '../lib/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /**
   * Ancho máximo del contenido. Por defecto se usa el de `useLayout()`, que
   * mantiene la columna legible en pantallas grandes. Solo se indica aquí para
   * pedir algo más estrecho (los formularios de acceso) o para una pantalla que
   * de verdad quiera ocupar todo el ancho (`0`).
   */
  maxWidth?: number;
}

/**
 * Contenedor base de pantalla: fondo, margen lateral proporcional al tamaño y
 * columna de contenido centrada con un ancho máximo.
 *
 * El ancho máximo es lo que evita que en un monitor una fila de alumno mida
 * 1400 px con el nombre a la izquierda del todo y la flecha a 1350 px. El
 * espacio que queda a los lados no es hueco desaprovechado: es el margen que
 * hace que el contenido se lea. Para aprovechar el ancho se usan más columnas
 * (ver `Grid`), no filas más largas.
 */
export function ScreenContainer({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  maxWidth,
}: ScreenContainerProps) {
  const layout = useLayout();
  // `maxWidth={0}` es la forma de pedir explícitamente todo el ancho.
  const limite = maxWidth === undefined ? layout.maxWidth : maxWidth;
  const cap = limite > 0 ? { maxWidth: limite } : null;
  // En tablet la barra de pestañas es un muelle flotante (ver
  // `useTabScreenOptions`), así que el contenido necesita sitio por debajo para
  // no quedarse escondido detrás de ella al llegar al final. Con barra lateral
  // no hay nada que esquivar y ese hueco sobraría.
  const dock =
    Platform.OS === 'web' && layout.isWide && !layout.sidebar ? spacing.xxl + spacing.lg : 0;

  /**
   * El hueco de abajo, que se había quedado en CERO en el móvil.
   *
   * Aquí había un fallo tonto y muy visible: este objeto se aplicaba DESPUÉS de
   * los estilos base, y traía `paddingBottom: dock`. En web ancho `dock` vale
   * algo, pero en el móvil vale 0, así que pisaba el `paddingBottom` del estilo
   * base y lo dejaba en nada. Resultado: el último botón de la pantalla —"usar
   * otra cuenta", "regístrate"— quedaba pegado al borde inferior, encima de la
   * barra de gestos del sistema.
   *
   * Ahora el hueco se SUMA en vez de sustituirse, y lleva además el margen que
   * reserva el propio teléfono (`insets.bottom`): la barra de gestos de Android
   * y la raya del iPhone se comen esa franja, y nada que se pueda pulsar debe
   * quedar debajo.
   *
   * En las pantallas con barra de pestañas ese `insets.bottom` ya viene a cero:
   * la barra ocupa esa franja y es ella quien la respeta, así que no se suma dos
   * veces.
   */
  const insets = useSafeAreaInsets();
  const abajo = dock + insets.bottom;
  const gutter = { paddingHorizontal: layout.gutter };

  /*
   * La pantalla se queda quieta cuando algo de dentro lo pide.
   *
   * Lo pide el carné mientras se gira: en el móvil, arrastrar la tarjeta y
   * desplazar la pantalla son el mismo gesto, y ganaba la pantalla. Ver
   * `lib/bloqueoDeScroll.ts` para el porqué de hacerlo por contexto.
   *
   * Se cuenta en vez de encender y apagar, por si algún día hay dos cosas
   * pidiendo quieto a la vez.
   */
  const [bloqueos, setBloqueos] = useState(0);
  const bloqueo = useMemo<BloqueoDeScroll>(
    () => ({
      bloquear: () => setBloqueos((n) => n + 1),
      soltar: () => setBloqueos((n) => Math.max(0, n - 1)),
    }),
    []
  );

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LinearGradient
          colors={gradients.appBackground}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={[styles.centerRow, gutter, { paddingBottom: spacing.lg + abajo }]}>
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
          contentContainerStyle={[
            styles.scrollContent,
            gutter,
            { paddingBottom: spacing.xxl + abajo },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          scrollEnabled={bloqueos === 0}
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
          <ContextoDeBloqueo.Provider value={bloqueo}>
            <FadeIn style={[styles.column, cap, contentStyle]}>{children}</FadeIn>
          </ContextoDeBloqueo.Provider>
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
