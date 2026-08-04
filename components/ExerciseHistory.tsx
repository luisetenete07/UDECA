import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { LineChart } from './LineChart';
import { exerciseProgression, exerciseRecord, exerciseSessions } from '../lib/stats';
import { isHoldMeasure, type ExerciseMeasure, type WorkoutLog } from '../lib/types';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

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
  if (dias < 14) return `hace ${dias} días`;
  const semanas = Math.round(dias / 7);
  if (semanas < 9) return `hace ${semanas} semanas`;
  return `hace ${Math.round(dias / 30)} meses`;
}

interface Props {
  logs: WorkoutLog[];
  exerciseId: string;
  measureByExercise?: Record<string, string>;
}

/**
 * Historial de UN ejercicio: cuánto se hace ahora, cuánto se ha mejorado y qué
 * se hizo cada día.
 *
 * La versión anterior era una gráfica y poco más: para saber qué series se
 * habían hecho un día concreto había que salir a la pestaña de entrenos,
 * buscar la fecha y abrir la sesión entera. Aquí el ejercicio se cuenta solo,
 * y de arriba abajo en el orden en que se pregunta: cuánto hago ahora, cuánto
 * he mejorado, y qué hice cada día.
 *
 * Las series se leen como marcas y no como una tabla, con una barra que las
 * compara de un vistazo: dos sesiones seguidas se comparan mirando, sin tener
 * que restar números de cabeza.
 */
export function ExerciseHistory({ logs, exerciseId, measureByExercise }: Props) {
  const [verTodas, setVerTodas] = React.useState(false);

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

  // Al cambiar de ejercicio, la lista vuelve a empezar recogida.
  React.useEffect(() => setVerTodas(false), [exerciseId]);

  if (!progresion || sesiones.length === 0) return null;

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
  const unidad = progresion.hasWeight ? 'kg' : esAguante ? 's' : 'reps';
  /** Lo que se compara entre sesiones: el lastre si lo hay, y si no la marca. */
  const valorDe = (s: { sets: { reps: number; weight: number }[] }) =>
    Math.max(...s.sets.map((x) => (progresion.hasWeight ? x.weight : x.reps)), 0);

  // Ojo con el orden: `sesiones` viene de la más reciente a la más antigua.
  const ahora = valorDe(sesiones[0]);
  const primera = valorDe(sesiones[sesiones.length - 1]);
  const cambio = ahora - primera;
  const maximo = Math.max(...sesiones.map(valorDe), 1);
  const mejorHistorico = maximo;

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
      value: progresion.hasWeight ? p.weight : p.reps,
      label: partes.join(' '),
    };
  });

  const visibles = verTodas ? sesiones : sesiones.slice(0, 6);
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
            {sesiones.length > 1 ? (
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
              {sesiones.length > 1 ? 'desde que empezaste' : 'primera vez'}
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

      <Card style={styles.card}>
        <Text style={styles.tituloSeccion}>Día a día</Text>
        <Text style={styles.pista}>
          Cada barra compara ese día con tu mejor marca. Las series, tal y como las hiciste.
        </Text>

        {visibles.map((s) => {
          const valor = valorDe(s);
          const esRecord = valor >= mejorHistorico && valor > 0;
          const fecha = new Date(s.date);
          // La mejor serie del día se marca para que salte a la vista cuál fue.
          const mejorSerie = Math.max(
            ...s.sets.map((x) => (progresion.hasWeight ? x.weight : x.reps)),
            0
          );
          return (
            <View key={s.id} style={styles.dia}>
              <View style={styles.diaCabecera}>
                <Text style={styles.diaFecha}>
                  {fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </Text>
                <Text style={styles.diaNombre} numberOfLines={1}>
                  {s.dayName}
                </Text>
                {esRecord ? (
                  <Ionicons name="trophy" size={13} color={colors.primary} />
                ) : null}
                <Text style={styles.diaValor}>
                  {num(valor)} {unidad}
                </Text>
              </View>
              <View style={styles.barra}>
                <View
                  style={[
                    styles.barraRelleno,
                    { width: `${Math.max(4, (valor / maximo) * 100)}%` },
                    esRecord && styles.barraRecord,
                  ]}
                />
              </View>
              <View style={styles.marcas}>
                {s.sets.map((set, i) => {
                  const suya = progresion.hasWeight ? set.weight : set.reps;
                  const destaca = suya >= mejorSerie && mejorSerie > 0;
                  return (
                    <View key={i} style={[styles.marca, destaca && styles.marcaMejor]}>
                      {set.cluster ? (
                        <Ionicons name="layers-outline" size={11} color={colors.textMuted} />
                      ) : null}
                      <Text style={[styles.marcaTexto, destaca && styles.marcaTextoMejor]}>
                        {set.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {sesiones.length > 6 ? (
          <Pressable onPress={() => setVerTodas((v) => !v)} style={styles.masBoton}>
            <Ionicons
              name={verTodas ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.primary}
            />
            <Text style={styles.masTexto}>
              {verTodas ? 'Ver menos' : `Ver los ${sesiones.length} días`}
            </Text>
          </Pressable>
        ) : null}
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
  /**
   * La marca de ahora. A 46 px va en la display del rediseño y apretada, como
   * la cuenta atrás del descanso y la vitrina; e importa que sea tabular,
   * porque el número cambia al saltar de un ejercicio a otro.
   */
  heroValor: {
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.6,
    color: colors.text,
    fontFamily: fonts.display,
    ...tabularNums,
  },
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

  tituloSeccion: { ...typography.label, color: colors.text },
  pista: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },

  dia: { marginBottom: spacing.md },
  diaCabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  diaFecha: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    minWidth: 52,
  },
  diaNombre: { ...typography.small, color: colors.textFaint, flex: 1 },
  diaValor: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  barra: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: 5,
  },
  barraRelleno: { height: '100%', backgroundColor: colors.primaryDark, borderRadius: 3 },
  barraRecord: { backgroundColor: colors.primary },
  marcas: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  marcaMejor: { backgroundColor: colors.primaryMuted },
  marcaTexto: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  marcaTextoMejor: { color: colors.primaryBright, fontFamily: fonts.semiBold },

  masBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  masTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
