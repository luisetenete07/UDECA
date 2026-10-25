import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { textoDeDescanso } from '../lib/combinarRutinas';
import { frase, t } from '../lib/idioma';
import { bloqueDe, esSuperserie } from '../lib/superserie';
import {
  GRIP_LABEL,
  isHoldMeasure,
  resolveLoad,
  type ExerciseMeasure,
  type RoutineDay,
  type RoutineExercise,
} from '../lib/types';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/**
 * EL ENTRENO EN TABLA, para entrenar sin ir apuntando en la app.
 *
 * Lo elige el entrenador para cada alumno (`modoAlumno: 'tabla'` en su
 * rutina). Es lo que haría con una hoja de cálculo, pero ordenado: una fila
 * por ejercicio y una columna por dato, siempre en el mismo sitio. Debajo del
 * nombre, lo que no cabe en una columna: lastre o goma, agarre, objetivo y las
 * notas del entrenador.
 *
 * Las superseries van juntas, con su letra (A1, A2) y una raya a la izquierda,
 * y una línea que dice cómo se encadenan. La columna del objetivo (RIR, o la
 * variable del plan) solo sale si alguno lo lleva y el entrenador la enseña.
 */
export function TablaDeEntreno({
  day,
  medidaDe,
  objetivoDe,
}: {
  day: RoutineDay;
  /** La medida de cada ejercicio (si no la trae el plan, la de la biblioteca). */
  medidaDe: (ex: RoutineExercise) => ExerciseMeasure | undefined;
  /** "RIR 1", "RPE 8"… o null si no se enseña o no lleva. */
  objetivoDe: (ex: RoutineExercise) => string | null;
}) {
  const ejercicios = day.exercises;
  const conObjetivo = ejercicios.some((ex) => !!objetivoDe(ex));

  return (
    <View style={styles.tabla}>
      {/* La cabecera: lo mismo en todas las filas, una sola vez. */}
      <View style={[styles.fila, styles.cabecera]}>
        <Text style={[styles.cab, styles.colNombre]}>Ejercicio</Text>
        <Text style={[styles.cab, styles.colNum]}>Series</Text>
        <Text style={[styles.cab, styles.colReps]}>Reps</Text>
        <Text style={[styles.cab, styles.colDesc]}>Desc.</Text>
        {conObjetivo ? <Text style={[styles.cab, styles.colObj]}>Obj.</Text> : null}
      </View>

      {ejercicios.map((ex, i) => {
        const b = bloqueDe(ejercicios, i);
        const enSuperserie = esSuperserie(b);
        const letra = enSuperserie ? `${String.fromCharCode(65 + bloqueIndice(ejercicios, i))}${i - b.inicio + 1}` : null;
        const enSegundos = isHoldMeasure(medidaDe(ex));
        const reps = enSegundos ? `${ex.seconds || ex.reps || '—'} s` : ex.reps || '—';
        const carga = resolveLoad(ex);
        // En una superserie el descanso va al final del bloque: en los demás
        // ejercicios del bloque se dice cómo se pasa al siguiente.
        const ultimoDelBloque = !enSuperserie || i === b.fin;
        const descanso = ultimoDelBloque
          ? ex.restSeconds
            ? textoCorto(ex.restSeconds)
            : '—'
          : ejercicios[i + 1]?.transicionSegundos
            ? textoCorto(ejercicios[i + 1].transicionSegundos!)
            : '0';
        const detalle = [
          carga === 'weighted' ? t('Lastrado') : carga === 'assisted' ? t('Con goma') : null,
          ex.grip ? frase`Agarre ${GRIP_LABEL[ex.grip].toLowerCase()}` : null,
          ex.goal ? frase`Objetivo: ${ex.goal}` : null,
        ].filter(Boolean);
        return (
          <React.Fragment key={ex.id ?? i}>
            {enSuperserie && i === b.inicio ? (
              <View style={styles.superserie}>
                <Ionicons name="link" size={12} color={colors.primaryBright} />
                <Text style={styles.superserieTexto}>
                  {ejercicios[b.inicio + 1]?.transicionSegundos
                    ? frase`Superserie · ${textoDeDescanso(ejercicios[b.inicio + 1].transicionSegundos!)} para cambiar`
                    : 'Superserie · sin descanso entre ellos'}
                </Text>
              </View>
            ) : null}
            <View
              style={[
                styles.fila,
                i % 2 === 1 && styles.filaPar,
                enSuperserie && styles.filaEnlazada,
              ]}
            >
              <View style={styles.colNombre}>
                <Text style={styles.nombre}>
                  {letra ? <Text style={styles.letra}>{letra} </Text> : null}
                  {ex.name}
                </Text>
                {detalle.length > 0 ? <Text style={styles.detalle}>{detalle.join(' · ')}</Text> : null}
                {ex.notes ? <Text style={styles.nota}>{ex.notes}</Text> : null}
              </View>
              <Text style={[styles.celda, styles.colNum]}>{ex.sets || 1}</Text>
              <Text style={[styles.celda, styles.colReps]}>{reps}</Text>
              <Text style={[styles.celda, styles.colDesc]}>{descanso}</Text>
              {conObjetivo ? (
                <Text style={[styles.celda, styles.colObj]}>{objetivoDe(ex) ?? '—'}</Text>
              ) : null}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

/** El número de bloque (A, B, C…) de cada superserie, contando solo superseries. */
function bloqueIndice(ejercicios: RoutineExercise[], i: number): number {
  let n = 0;
  let k = 0;
  while (k < ejercicios.length) {
    const b = bloqueDe(ejercicios, k);
    if (k <= i && i <= b.fin) return n;
    if (esSuperserie(b)) n++;
    k = b.fin + 1;
  }
  return n;
}

/** 90 → "1:30", 45 → "45 s". En una celda estrecha. */
function textoCorto(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  tabla: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineFaint,
  },
  filaPar: { backgroundColor: 'rgba(255,255,255,0.025)' },
  // La superserie, con una raya a la izquierda: se ve que va junta.
  filaEnlazada: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  cabecera: { backgroundColor: colors.surfaceAlt, borderTopWidth: 0, paddingVertical: 6 },
  cab: {
    ...typography.small,
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  colNombre: { flex: 1, minWidth: 0 },
  colNum: { width: 44, textAlign: 'center' },
  colReps: { width: 54, textAlign: 'center' },
  colDesc: { width: 46, textAlign: 'center' },
  colObj: { width: 52, textAlign: 'center' },
  nombre: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  letra: { color: colors.primaryBright, fontFamily: fonts.heading },
  detalle: { ...typography.small, fontSize: 12, color: colors.primaryBright, marginTop: 1 },
  nota: { ...typography.small, fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  celda: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, ...tabularNums },
  superserie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineFaint,
  },
  superserieTexto: { ...typography.small, fontSize: 11, color: colors.primaryBright, fontFamily: fonts.semiBold },
});
