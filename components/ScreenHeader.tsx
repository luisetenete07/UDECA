import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLayout } from '../lib/responsive';
import { colors, spacing, typography } from '../lib/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Rótulo pequeño encima del título ("Panel del entrenador"). */
  eyebrow?: string;
  /** Botones de la cabecera, alineados a la derecha del título. */
  actions?: React.ReactNode;
}

/**
 * Cabecera de pantalla: rótulo, título, subtítulo y acciones.
 *
 * Hasta ahora cada pantalla se montaba la suya con sus propios estilos, así que
 * el mismo título salía con tamaños y separaciones distintas según dónde
 * estuvieras. Esto es lo que hace que una app se sienta improvisada aunque cada
 * pantalla por separado esté bien.
 *
 * El título crece con la pantalla: 28 px mandan en un móvil, pero en un monitor
 * se quedan pequeños y la cabecera pierde el peso que debe tener.
 */
export function ScreenHeader({ title, subtitle, eyebrow, actions }: ScreenHeaderProps) {
  const layout = useLayout();
  const size = layout.isPhone ? 28 : layout.bp === 'tablet' ? 32 : 36;

  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { fontSize: size, lineHeight: Math.round(size * 1.24) }]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Las acciones se alinean con el título, no con el bloque entero: si no,
    // un subtítulo largo empuja los botones hacia abajo y la fila se descuadra.
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  // El título manda: si las acciones se hacen anchas, se encogen ellas. Sin
  // este suelo, dos botones largos estrujaban la columna hasta partir la
  // palabra por la mitad ("Bibliot / eca"), que es de las cosas que más barata
  // hacen parecer una pantalla.
  textCol: { flex: 1, minWidth: 150 },
  eyebrow: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexShrink: 1,
  },
});
