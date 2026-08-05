import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressRing } from './ProgressRing';
import { QuickSheet, type AccionRapida } from './QuickSheet';
import { colors, fonts, spacing, typography } from '../lib/theme';

/**
 * La cabecera de la sesión: lo que estás haciendo y cuánto te queda.
 *
 * Antes, entre el botón de salir y la primera serie había seis filas: volver,
 * título, pestañas de día, reiniciar ciclo, fijar día, intensidad, contador y
 * barra. Una pantalla que se mira treinta veces en una hora no puede gastar
 * media pantalla en administración.
 *
 * Ahora es una sola fila. El anillo dice cuánto llevas —y se cierra según
 * marcas series, que es el premio— y todo lo que se toca una vez al mes
 * (reiniciar el ciclo, fijar el día, cancelar) se va detrás de un punto: sigue
 * ahí, pero deja de competir con lo que de verdad estás haciendo.
 */
export function SessionHeader({
  titulo,
  dia,
  intensidad,
  hechas,
  totales,
  onSalir,
  acciones = [],
}: {
  /** Nombre de la rutina. */
  titulo: string;
  /** Día en curso, si lo hay. */
  dia?: string | null;
  /** 1..10; se pinta como marca, no como frase. */
  intensidad?: number | null;
  hechas: number;
  totales: number;
  onSalir: () => void;
  /** Lo que se hace de uvas a peras: va detrás del punto. */
  acciones?: AccionRapida[];
}) {
  const [menu, setMenu] = useState(false);
  const hayAnillo = totales > 0;

  return (
    <View style={styles.bloque}>
      <View style={styles.barra}>
        <Pressable onPress={onSalir} hitSlop={12} style={styles.iconoBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
        </Pressable>
        {acciones.length > 0 ? (
          <Pressable onPress={() => setMenu(true)} hitSlop={12} style={styles.iconoBtn}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.fila}>
        {hayAnillo ? (
          <ProgressRing
            size={72}
            thickness={6}
            progress={hechas / totales}
            value={`${hechas}/${totales}`}
            label="series"
          />
        ) : null}
        <View style={styles.texto}>
          <Text style={styles.titulo} numberOfLines={2}>
            {titulo}
          </Text>
          {dia || intensidad ? (
            <View style={styles.metaFila}>
              {dia ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {dia}
                </Text>
              ) : null}
              {intensidad ? (
                <View style={styles.intensidad}>
                  <Ionicons name="flame" size={11} color={colors.primaryBright} />
                  <Text style={styles.intensidadTexto}>{intensidad}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <QuickSheet
        visible={menu}
        titulo={titulo}
        subtitulo={dia ?? undefined}
        acciones={acciones}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: spacing.md },
  barra: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    minHeight: 28,
  },
  iconoBtn: { padding: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texto: { flex: 1, gap: 4 },
  titulo: { ...typography.h1, color: colors.text },
  metaFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { ...typography.small, color: colors.textMuted, fontFamily: fonts.medium, flexShrink: 1 },
  intensidad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intensidadTexto: {
    fontSize: 11,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
  },
});
