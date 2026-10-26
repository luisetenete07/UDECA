import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Sheet } from './Sheet';
import { Chip, ChipRow } from './Chip';
import { frase } from '../lib/idioma';
import { minutosSegundos } from '../lib/duracion';
import { textoDePrescripcion, type PlanPersonalizado } from '../lib/planPersonalizado';
import { bloqueDe, esSuperserie, miembros } from '../lib/superserie';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';
import { isHoldMeasure, type RoutineDay } from '../lib/types';

/**
 * "VER COMO EL ALUMNO": el día tal y como le sale antes de empezar.
 *
 * El editor enseña la rutina como se MONTA —campos, flechas, opciones—, y lo
 * que el alumno ve es otra cosa: una lista corta con sus series, las
 * superseries como bloque, el esfuerzo que se le pide y las notas. Antes, para
 * comprobarlo, había que pedirle una captura. Aquí se ve sin salir del editor
 * y antes de guardar.
 */
export function VistaDelAlumno({
  visible,
  onClose,
  dias,
  perso,
  pedirEsfuerzo,
}: {
  visible: boolean;
  onClose: () => void;
  dias: RoutineDay[];
  /** Lo que acompaña a cada ejercicio (RIR, letras, tempo…), sea el plan que sea. */
  perso?: PlanPersonalizado;
  /** Fuera del personalizado: si se le pide el RIR. */
  pedirEsfuerzo: boolean;
}) {
  const [elegido, setElegido] = useState(0);
  const dia = dias[Math.min(elegido, dias.length - 1)];
  return (
    <Sheet visible={visible} onClose={onClose} titulo="Así lo ve tu alumno" descripcion="Antes de empezar el entreno de ese día.">
      {dias.length > 1 ? (
        <ChipRow scroll>
          {dias.map((d, i) => (
            <Chip
              key={d.id}
              texto={d.name || frase`Día ${i + 1}`}
              activo={i === elegido}
              onPress={() => setElegido(i)}
            />
          ))}
        </ChipRow>
      ) : null}
      <ScrollView style={{ maxHeight: 460 }}>
        {!dia ? (
          <Text style={styles.vacio}>Aún no hay días.</Text>
        ) : dia.isRest ? (
          <View style={styles.descanso}>
            <Ionicons name="moon-outline" size={22} color={colors.textMuted} />
            <Text style={styles.vacio}>Día de descanso: no ve ejercicios.</Text>
          </View>
        ) : dia.exercises.length === 0 ? (
          <Text style={styles.vacio}>Este día aún no tiene ejercicios.</Text>
        ) : (
          <View style={styles.previa}>
            <Text style={styles.previaTitulo}>
              {dia.exercises.length === 1 ? frase`1 ejercicio` : frase`${dia.exercises.length} ejercicios`}
            </Text>
            {dia.exercises.map((ex, i) => {
              const b = bloqueDe(dia.exercises, i);
              const enlazado = esSuperserie(b);
              const segundos = isHoldMeasure(ex.measure);
              const cuanto = segundos ? `${ex.seconds || ex.reps} s` : ex.reps;
              const pres =
                perso || pedirEsfuerzo ? textoDePrescripcion(ex, perso) : null;
              const detalle = [
                pres,
                !enlazado || i === b.fin
                  ? ex.restSeconds
                    ? frase`descanso ${minutosSegundos(ex.restSeconds, false)}`
                    : null
                  : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <React.Fragment key={ex.id ?? i}>
                  {enlazado && i === b.inicio ? (
                    <View style={styles.superserie}>
                      <Ionicons name="link" size={12} color={colors.primaryBright} />
                      <Text style={styles.superserieTexto}>
                        {frase`Superserie · ${miembros(b).length} seguidos, sin descanso`}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.fila, enlazado && styles.filaEnlazada]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.nombre} numberOfLines={2}>
                        {enlazado ? `${String.fromCharCode(65 + i - b.inicio)} · ` : ''}
                        {ex.name}
                      </Text>
                      {detalle ? <Text style={styles.detalle}>{detalle}</Text> : null}
                      {ex.notes ? (
                        <Text style={styles.nota} numberOfLines={3}>
                          {ex.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.series}>
                      {cuanto ? `${ex.sets} × ${cuanto}` : frase`${ex.sets} series`}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  previa: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  previaTitulo: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase', paddingVertical: spacing.xs },
  superserie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  superserieTexto: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  filaEnlazada: {
    borderTopWidth: 0,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.sm,
    marginLeft: 2,
  },
  nombre: { ...typography.body, color: colors.text },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  nota: { ...typography.small, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  series: { ...typography.body, color: colors.textMuted, fontFamily: fonts.semiBold, ...tabularNums },
  descanso: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  vacio: { ...typography.body, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
});
