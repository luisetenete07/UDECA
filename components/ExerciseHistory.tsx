import React from 'react';
import { frase } from '../lib/idioma';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { LineChart } from './LineChart';
import { exerciseProgression, exerciseRecord, exerciseSessions } from '../lib/stats';
import { isHoldMeasure, type ExerciseMeasure, type WorkoutLog } from '../lib/types';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/** Número corto en español: sin decimales si no los tiene (7,5 / 10). */
function num(n: number): string {
  return (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',');
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** "hoy", "ayer", "hace 5 días", "hace 3 semanas". */
function hace(fecha: number): string {
  const dias = Math.floor((Date.now() - fecha) / DIA_MS);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return frase`hace ${dias} días`;
  const semanas = Math.round(dias / 7);
  if (semanas < 9) return frase`hace ${semanas} semanas`;
  return frase`hace ${Math.round(dias / 30)} meses`;
}

interface Props {
  logs: WorkoutLog[];
  exerciseId: string;
  measureByExercise?: Record<string, string>;
}

/**
 * Historial de UN ejercicio: cuánto se hace ahora, cuánto se ha mejorado y su
 * gráfica de marcas.
 *
 * LA GRÁFICA, SOLO CON MARCAS DE VERDAD. Un punto por cada registro, con la
 * mejor marca de ese registro. Los días sin entrenar no son puntos (no hay
 * ceros que no han pasado) y los puntos van seguidos, sin huecos por los días
 * de en medio.
 *
 * CON EL PESO CORPORAL NO HAY KG. Si el ejercicio se hace sin lastre —o solo
 * a veces con él— la gráfica va en repeticiones (o segundos) y los kilos solo
 * se escriben en el punto que los llevó. Antes, bastaba un registro con lastre
 * para que la gráfica entera pasara a kg y los días sin él cayeran a 0 kg.
 *
 * Fuera "Día a día": lo pidió Luis. La gráfica ya dice qué se hizo cada vez.
 */
export function ExerciseHistory({ logs, exerciseId, measureByExercise }: Props) {
  const progresion = React.useMemo(
    () => exerciseProgression(logs, exerciseId),
    [logs, exerciseId]
  );
  const record = React.useMemo(
    () => exerciseRecord(logs, exerciseId, measureByExercise),
    [logs, exerciseId, measureByExercise]
  );
  const sesiones = React.useMemo(
    () => exerciseSessions(logs, exerciseId, measureByExercise),
    [logs, exerciseId, measureByExercise]
  );

  /*
   * Los días con alguna serie de VERDAD, es decir, no en regresión. Son los que
   * dicen cuánto hace ahora y cuánto ha mejorado: una serie en regresión es de
   * un ejercicio más fácil, y compararla con estas daría un hundimiento que no
   * ha pasado. Los días en regresión se ven igual en la lista, marcados.
   */
  const deVerdad = sesiones.filter((s) => s.sets.some((x) => !x.regresion));
  if (!progresion || deVerdad.length === 0) return null;

  /**
   * Cómo se mide este ejercicio.
   *
   * La progresión solo conoce la medida que quedó GRABADA en el entreno, y los
   * registros antiguos no la guardaban: sin el respaldo de la biblioteca, un
   * aguante de 40 segundos se anunciaba como "40 reps".
   */
  const medida: ExerciseMeasure =
    progresion.measure !== 'reps'
      ? progresion.measure
      : ((measureByExercise?.[exerciseId] as ExerciseMeasure | undefined) ?? 'reps');
  const esAguante = isHoldMeasure(medida);
  const esCombo = medida === 'combo';
  // En kg solo si TODOS los registros llevan lastre: un ejercicio de peso
  // corporal no tiene kilos que contar.
  const usaKg = progresion.hasWeight && progresion.points.every((p) => p.weight !== 0);
  const unidad = usaKg ? 'kg' : esAguante ? 's' : 'reps';
  /** Lo que se compara entre sesiones: el lastre si siempre lo hay, y si no la marca. */
  const valorDe = (s: { sets: { reps: number; weight: number; regresion?: boolean }[] }) =>
    Math.max(...s.sets.filter((x) => !x.regresion).map((x) => (usaKg ? x.weight : x.reps)), 0);

  // Ojo con el orden: `sesiones` viene de la más reciente a la más antigua.
  const ahora = valorDe(deVerdad[0]);
  const primera = valorDe(deVerdad[deVerdad.length - 1]);
  const cambio = ahora - primera;

  /**
   * Cada punto de la gráfica lleva escrita SU MARCA y SU DÍA. La línea sola
   * enseña la forma, pero no contesta a "¿cuánto hice aquel día?", que es
   * justo lo que se mira. En los combos van las dos marcas, reps y aguante,
   * porque una sin la otra no dice cómo fue la serie.
   */
  const puntos = progresion.points.map((p) => {
    const marca = esAguante ? `${p.reps}s` : String(p.reps);
    const partes = [
      esCombo && p.seconds > 0 ? `${marca} · ${p.seconds}s` : marca,
      p.weight > 0 ? `×${num(p.weight)}kg` : null,
    ].filter(Boolean);
    return {
      date: p.date,
      value: usaKg ? p.weight : p.reps,
      label: partes.join(' '),
    };
  });

  const totalSeries = sesiones.reduce((n, s) => n + s.sets.length, 0);

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.cabecera}>
          <Text style={styles.nombre} numberOfLines={2}>
            {progresion.name}
          </Text>
          {record ? (
            <View style={styles.recordPill}>
              <Ionicons name="trophy" size={13} color={colors.primary} />
              <Text style={styles.recordText}>Récord {record.label}</Text>
            </View>
          ) : null}
        </View>

        {/* Lo primero que se pregunta: cuánto hago ahora y cuánto he mejorado. */}
        <View style={styles.heroFila}>
          <View style={styles.hero}>
            <Text style={styles.heroValor}>{num(ahora)}</Text>
            <Text style={styles.heroUnidad}>{unidad}</Text>
          </View>
          <View style={styles.heroLado}>
            {deVerdad.length > 1 ? (
              <View style={styles.cambioFila}>
                <Ionicons
                  name={cambio > 0 ? 'trending-up' : cambio < 0 ? 'trending-down' : 'remove'}
                  size={16}
                  color={cambio > 0 ? colors.success : cambio < 0 ? colors.danger : colors.textFaint}
                />
                <Text
                  style={[
                    styles.cambio,
                    cambio > 0 && { color: colors.success },
                    cambio < 0 && { color: colors.danger },
                  ]}
                >
                  {cambio > 0 ? '+' : ''}
                  {num(cambio)} {unidad}
                </Text>
              </View>
            ) : null}
            <Text style={styles.heroPie}>
              {deVerdad.length > 1 ? 'desde que empezaste' : 'primera vez'}
            </Text>
          </View>
        </View>

        <View style={styles.resumen}>
          <Dato valor={String(sesiones.length)} etiqueta="días" />
          <Dato valor={String(totalSeries)} etiqueta="series" />
          <Dato valor={hace(sesiones[0].date)} etiqueta="última vez" />
        </View>

        <LineChart
          points={puntos}
          unit={unidad}
          labelAll
          // El resumen de la gráfica repetiría el número grande de arriba.
          showSummary={false}
          emptyMessage="Necesitas al menos dos sesiones con este ejercicio."
        />
      </Card>

    </>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoValor}>{valor}</Text>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nombre: { ...typography.h2, color: colors.text, flex: 1 },
  recordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairlineFaint,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  recordText: { ...typography.small, color: colors.primaryBright, fontSize: 11 },

  heroFila: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  hero: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroValor: { fontSize: 46, lineHeight: 50, color: colors.text, fontFamily: fonts.heading },
  heroUnidad: { ...typography.body, color: colors.textMuted },
  heroLado: { alignItems: 'flex-end' },
  cambioFila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cambio: { ...typography.body, color: colors.textMuted, fontFamily: fonts.semiBold },
  heroPie: { ...typography.small, color: colors.textFaint, fontSize: 11, marginTop: 1 },

  resumen: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  dato: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  datoValor: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  datoEtiqueta: { ...typography.small, color: colors.textFaint, fontSize: 10, marginTop: 1 },


  // En regresión: se ve, en ámbar, y nunca como la mejor del día.

});
