import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { textoDeDescanso } from '../lib/combinarRutinas';
import { frase, t } from '../lib/idioma';
import { bloqueDe, esSuperserie } from '../lib/superserie';
import { cuantoDe } from '../lib/emom';
import { getRest, startRest, useActiveRest } from '../lib/restTimerStore';
import {
  clusterBlocks,
  GRIP_LABEL,
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
 *
 * EL DESCANSO ES UN BOTÓN (`conCuentaAtras`): el que puso el entrenador en ese
 * ejercicio, de un toque, sin elegir nada. La cuenta atrás es la de siempre
 * (lib/restTimerStore.ts): flota abajo, sigue al cambiar de pantalla y suena
 * al acabar. En un día EMOM o de grease the groove no hay columna de descanso
 * (`sinDescansos`): allí lo marca el reloj del EMOM o el propio día.
 */
export function TablaDeEntreno({
  day,
  medidaDe,
  objetivoDe,
  videoDe,
  onVideo,
  conCuentaAtras = false,
  sinDescansos = false,
}: {
  day: RoutineDay;
  /** La medida de cada ejercicio (si no la trae el plan, la de la biblioteca). */
  medidaDe: (ex: RoutineExercise) => ExerciseMeasure | undefined;
  /** "RIR 1", "RPE 8"… o null si no se enseña o no lleva. */
  objetivoDe: (ex: RoutineExercise) => string | null;
  /** El vídeo de técnica de cada ejercicio, si el entrenador lo puso. */
  videoDe?: (ex: RoutineExercise) => string | undefined;
  /** Abrir ese vídeo (a pantalla completa, components/VisorDeVideo). */
  onVideo?: (url: string, titulo: string) => void;
  /** Tocar el descanso de un ejercicio lanza su cuenta atrás. */
  conCuentaAtras?: boolean;
  /** Sin la columna de descanso: un día EMOM o de grease the groove. */
  sinDescansos?: boolean;
}) {
  const ejercicios = day.exercises;
  const conObjetivo = ejercicios.some((ex) => !!objetivoDe(ex));
  const conDescanso = !sinDescansos;
  // Qué descanso corre y de qué fila salió: ese botón se ve encendido.
  const enCurso = useActiveRest();
  const [lanzado, setLanzado] = useState<{ rest: number; fila: number } | null>(null);
  const filaEnCurso = enCurso && lanzado?.rest === enCurso.id ? lanzado.fila : -1;
  const hayDescansos = conCuentaAtras && conDescanso && ejercicios.some((ex) => (ex.restSeconds ?? 0) > 0);

  const descansar = (segundos: number, fila: number, nombre: string) => {
    startRest(segundos, frase`Después de ${nombre}`);
    const r = getRest();
    if (r) setLanzado({ rest: r.id, fila });
  };

  return (
    <View style={styles.tabla}>
      {/* La cabecera: lo mismo en todas las filas, una sola vez. */}
      <View style={[styles.fila, styles.cabecera]}>
        <Text style={[styles.cab, styles.colNombre]}>Ejercicio</Text>
        <Text style={[styles.cab, styles.colNum]}>Series</Text>
        <Text style={[styles.cab, styles.colReps]}>Reps</Text>
        {conDescanso ? <Text style={[styles.cab, styles.colDesc]}>Desc.</Text> : null}
        {conObjetivo ? <Text style={[styles.cab, styles.colObj]}>Obj.</Text> : null}
      </View>

      {ejercicios.map((ex, i) => {
        const b = bloqueDe(ejercicios, i);
        const enSuperserie = esSuperserie(b);
        const letra = enSuperserie ? `${String.fromCharCode(65 + bloqueIndice(ejercicios, i))}${i - b.inicio + 1}` : null;
        const reps = cifra(ex, medidaDe(ex));
        const carga = resolveLoad(ex);
        // En una superserie el descanso va al final del bloque: en los demás
        // ejercicios del bloque se dice cómo se pasa al siguiente.
        const ultimoDelBloque = !enSuperserie || i === b.fin;
        const segundosDeDescanso = ultimoDelBloque ? ex.restSeconds ?? 0 : 0;
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
          // El clúster cambia cómo se hace cada serie: tiene que verse.
          ex.cluster
            ? frase`En clúster: ${clusterBlocks(ex.cluster)} bloques, ${ex.cluster.restSeconds} s entre bloques`
            : null,
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
                {/* La técnica, debajo de su ejercicio: es lo que se mira justo
                    antes de hacerlo. */}
                {(() => {
                  const video = videoDe?.(ex)?.trim();
                  return video && onVideo ? (
                    <Pressable
                      onPress={() => onVideo(video, ex.name)}
                      style={styles.tecnica}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={frase`Técnica de ${ex.name}`}
                    >
                      <Ionicons name="play-circle" size={16} color={colors.primary} />
                      <Text style={styles.tecnicaTexto}>Técnica</Text>
                    </Pressable>
                  ) : null;
                })()}
              </View>
              <Text style={[styles.celda, styles.colNum]}>{ex.sets || 1}</Text>
              <Text style={[styles.celda, styles.colReps]}>{reps}</Text>
              {!conDescanso ? null : conCuentaAtras && segundosDeDescanso > 0 ? (
                <View style={styles.colDesc}>
                  <Pressable
                    onPress={() => descansar(segundosDeDescanso, i, ex.name)}
                    style={[styles.boton, filaEnCurso === i && styles.botonEnCurso]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={frase`Empezar el descanso de ${ex.name}: ${textoDeDescanso(segundosDeDescanso)}`}
                  >
                    <Text style={[styles.botonTexto, filaEnCurso === i && styles.botonTextoEnCurso]}>{descanso}</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[styles.celda, styles.colDesc]}>{descanso}</Text>
              )}
              {conObjetivo ? (
                <Text style={[styles.celda, styles.colObj]}>{objetivoDe(ex) ?? '—'}</Text>
              ) : null}
            </View>
          </React.Fragment>
        );
      })}
      {hayDescansos ? (
        <View style={styles.pie}>
          <Ionicons name="hourglass-outline" size={13} color={colors.textMuted} />
          <Text style={styles.pieTexto}>Toca el descanso de un ejercicio y empieza la cuenta atrás.</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Lo que se hace en cada serie, en una celda estrecha: "8", "30 s", "8 + 8",
 * "5 + 10 s" (un combo: repeticiones y aguante).
 */
function cifra(ex: RoutineExercise, medida: ExerciseMeasure | undefined): string {
  return cuantoDe(ex, medida).replace(/ reps/g, '') || '—';
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
  colDesc: { width: 50, textAlign: 'center', alignItems: 'center' },
  colObj: { width: 52, textAlign: 'center' },
  nombre: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  letra: { color: colors.primaryBright, fontFamily: fonts.heading },
  detalle: { ...typography.small, fontSize: 12, color: colors.primaryBright, marginTop: 1 },
  nota: { ...typography.small, fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  tecnica: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 5 },
  tecnicaTexto: { ...typography.small, fontSize: 12, color: colors.primary, fontFamily: fonts.semiBold },
  celda: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, ...tabularNums },
  // El descanso, como botón: con su borde se ve que se puede tocar.
  boton: {
    minWidth: 46,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  botonEnCurso: { backgroundColor: colors.primary },
  botonTexto: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold, ...tabularNums },
  botonTextoEnCurso: { color: colors.onPrimary },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineFaint,
  },
  pieTexto: { ...typography.small, fontSize: 12, color: colors.textMuted, flex: 1 },
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
