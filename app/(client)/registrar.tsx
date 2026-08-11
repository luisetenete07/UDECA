import React, { useCallback, useMemo, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip, ChipRow } from '../../components/Chip';
import { DictarEntreno } from '../../components/DictarEntreno';
import { EmptyState } from '../../components/EmptyState';
import { CardsSkeleton } from '../../components/Skeleton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { diaSemanaCorto, diaYMes, esMismoDia } from '../../lib/fechas';
import { getExerciseLibrary } from '../../lib/firestore/exercises';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import {
  createWorkoutLog,
  getWorkoutLogsForClient,
} from '../../lib/firestore/workoutLogs';
import { syncMySocialStats } from '../../lib/firestore/social';
import { notifyUser } from '../../lib/notifications';
import { aLog, catalogoParaLaIA, diaMasProbable, type Dictado } from '../../lib/dictado';
import {
  conUnaSerieMas,
  conUnaSerieMenos,
  diasParaElegir,
  entrenosDelDia,
  fechaDelRegistro,
  hayAlgoQueGuardar,
  logDelDia,
  minutosDeTexto,
} from '../../lib/registroTardio';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import { EXERCISE_MEASURES, isHoldMeasure, resolveLoad } from '../../lib/types';
import type {
  Exercise,
  ExerciseMeasure,
  LoggedExercise,
  Routine,
  RoutineDay,
  WorkoutLog,
} from '../../lib/types';

/**
 * Registrar un entreno que ya se hizo.
 *
 * La app da por hecho que se entrena con el móvil delante, marcando serie a
 * serie, y muchas veces no es así: se queda en la mochila, se acaba la
 * batería, o sencillamente se olvida. Ese entreno se perdía —no contaba para
 * la racha, no salía en el histórico, el entrenador no lo veía—, y perder
 * entrenos hechos es la forma más rápida de que alguien deje de fiarse de lo
 * que le cuenta la app.
 *
 * Aquí se elige el día, se ajustan las series y se escribe cuánto duró. No es
 * un entreno de segunda: cuenta igual que cualquier otro.
 */
export default function RegistrarScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [dia, setDia] = useState<number>(() => diasParaElegir()[0]);
  const [diaId, setDiaId] = useState<string | null>(null);
  const [log, setLog] = useState<LoggedExercise[]>([]);
  const [medidas, setMedidas] = useState<Record<string, ExerciseMeasure>>({});
  const [minutos, setMinutos] = useState('');
  const [biblioteca, setBiblioteca] = useState<Exercise[]>([]);
  const [dictadoAbierto, setDictadoAbierto] = useState(false);

  /** La medida que vale: la del plan, si no la de la biblioteca, si no reps. */
  const medidaDe = (ex: LoggedExercise): ExerciseMeasure => {
    const candidata = ex.measure ?? medidas[ex.exerciseId];
    return EXERCISE_MEASURES.includes(candidata as ExerciseMeasure)
      ? (candidata as ExerciseMeasure)
      : 'reps';
  };

  const dias = diasParaElegir();

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelado = false;
      (async () => {
        const [r, hist, biblioteca] = await Promise.all([
          getActiveRoutineForClient(profile.uid),
          getWorkoutLogsForClient(profile.uid).catch(() => [] as WorkoutLog[]),
          profile.trainerId
            ? getExerciseLibrary(profile.trainerId).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (cancelado) return;
        setRoutine(r);
        setLogs(hist);
        setBiblioteca(biblioteca);
        // La medida ACTUAL de cada ejercicio (repeticiones o segundos). Sin
        // ella, un aguante de 30 segundos se guardaría como 30 repeticiones y
        // el volumen del histórico contaría lo que no es.
        const medidas: Record<string, ExerciseMeasure> = {};
        for (const e of biblioteca) medidas[e.id] = e.measure ?? 'reps';
        setMedidas(medidas);
        // Se abre con el primer día que no sea descanso: es el que más veces
        // va a ser el bueno, y así se entra viendo ya las series.
        const primero = r?.days.find((d) => !d.isRest && !d.gtg) ?? r?.days[0] ?? null;
        if (primero) {
          setDiaId(primero.id);
          setLog(logDelDia(primero));
        }
        setLoading(false);
      })();
      return () => {
        cancelado = true;
      };
    }, [profile])
  );

  const elegirDiaDelPlan = (d: RoutineDay) => {
    setDiaId(d.id);
    setLog(logDelDia(d));
  };

  const diaDelPlan = routine?.days.find((d) => d.id === diaId) ?? null;
  const yaHay = entrenosDelDia(logs, dia);

  const cambiarMarca = (i: number, j: number, campo: 'reps' | 'weight', valor: string) => {
    setLog((prev) =>
      prev.map((ex, a) =>
        a === i ? { ...ex, sets: ex.sets.map((s, b) => (b === j ? { ...s, [campo]: valor } : s)) } : ex
      )
    );
  };

  /**
   * Guardar con unos datos concretos, no con lo que haya en pantalla.
   *
   * Existe así por el dictado: cuando la IA rellena y registra de una vez, el
   * estado de React todavía no se ha actualizado y guardar "lo que hay" sería
   * guardar lo de antes. Se le pasan los datos a la cara.
   */
  const guardarCon = async (datos: {
    log: LoggedExercise[];
    dia: number;
    diaPlan: RoutineDay;
    minutos: string;
  }) => {
    const { log, dia, diaPlan, minutos } = datos;
    if (!profile || !routine) return;
    if (!hayAlgoQueGuardar(log)) {
      showToast('Ponle al menos una serie');
      return;
    }
    setGuardando(true);
    try {
      const duracion = minutosDeTexto(minutos);
      await createWorkoutLog({
        trainerId: routine.trainerId,
        clientId: profile.uid,
        routineId: routine.id,
        routineName: routine.name,
        dayName: diaPlan.name,
        date: fechaDelRegistro(dia),
        // Se sella la medida, igual que al terminar una sesión: así el
        // histórico y las estadísticas lo leen bien años después aunque la
        // ficha del ejercicio cambie.
        exercises: log.map((ex) => ({ ...ex, measure: medidaDe(ex) })),
        ...(duracion ? { durationMin: duracion } : {}),
      });
      const frescos = await getWorkoutLogsForClient(profile.uid);
      setLogs(frescos);
      syncMySocialStats(profile, frescos).catch(() => {});
      // Al entrenador le interesa igual, y más sabiendo que es de otro día:
      // si no, ve aparecer un entreno con fecha vieja sin explicación.
      if (routine.trainerId !== profile.uid) {
        notifyUser(
          routine.trainerId,
          'Entreno registrado',
          `${profile.name.split(' ')[0]} ha registrado ${diaPlan.name} del ${diaYMes(dia)}.`
        ).catch(() => {});
      }
      showToast('Entreno registrado');
      router.back();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo registrar');
    } finally {
      setGuardando(false);
    }
  };

  const guardar = () => {
    if (!diaDelPlan) return;
    guardarCon({ log, dia, diaPlan: diaDelPlan, minutos });
  };

  /** Los ejercicios entre los que la IA puede elegir al oír el dictado. */
  const catalogo = useMemo(() => catalogoParaLaIA(routine, biblioteca), [routine, biblioteca]);

  /**
   * Lo dictado, ya en la pantalla.
   *
   * Manda sobre lo que hubiera puesto: día, entreno, ejercicios y duración. Lo
   * dictado es lo que se hizo; lo que había era una plantilla del plan que
   * nadie ha confirmado todavía.
   */
  const aplicarDictado = (d: Dictado, registrar: boolean) => {
    const nuevoLog = aLog(d, catalogo);
    const cuando = d.haceDias !== undefined ? (diasParaElegir()[d.haceDias] ?? dia) : dia;
    const planDia = diaMasProbable(d, routine, diaDelPlan);
    const nuevosMinutos = d.duracionMin ? String(d.duracionMin) : minutos;
    setLog(nuevoLog);
    setDia(cuando);
    if (planDia) setDiaId(planDia.id);
    setMinutos(nuevosMinutos);
    setDictadoAbierto(false);
    if (registrar && planDia) {
      guardarCon({ log: nuevoLog, dia: cuando, diaPlan: planDia, minutos: nuevosMinutos });
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <CardsSkeleton tarjetas={3} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Registrar entreno' }} />
      <Pressable onPress={() => router.back()} style={styles.volver} hitSlop={8}>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        <Text style={styles.volverTexto}>Volver</Text>
      </Pressable>

      <Text style={styles.titulo}>Registrar un entreno</Text>
      <Text style={styles.subtitulo}>
        ¿Entrenaste sin el móvil delante? Apúntalo ahora. Cuenta igual que cualquier otro:
        para tu racha, para tu histórico y para tu entrenador.
      </Text>

      {!routine || routine.days.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Sin rutina asignada"
          subtitle="Para registrar un entreno hace falta un plan del que sacar los ejercicios."
        />
      ) : (
        <>
          {/* Antes que rellenar treinta casillas: contarlo. Va arriba del todo
              porque el que llega aquí tres días después no viene con ganas de
              escribir, y si el atajo está abajo no lo ve nadie. */}
          <Pressable style={styles.dictar} onPress={() => setDictadoAbierto(true)}>
            <View style={styles.dictarIcono}>
              <Ionicons name="mic" size={20} color={colors.primary} />
            </View>
            <View style={styles.dictarTexto}>
              <Text style={styles.dictarTitulo}>Cuéntamelo hablando</Text>
              <Text style={styles.dictarPie}>
                Dime las series y las marcas en voz alta y lo apunto yo.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Card accent style={styles.tarjeta}>
            <Text style={styles.tituloTarjeta}>¿Qué día fue?</Text>
            <ChipRow scroll>
              {dias.map((d, i) => (
                <Chip
                  key={d}
                  texto={i === 0 ? 'Hoy' : i === 1 ? 'Ayer' : `${diaSemanaCorto(d)} ${diaYMes(d)}`}
                  activo={esMismoDia(d, dia)}
                  onPress={() => setDia(d)}
                />
              ))}
            </ChipRow>
            {/* No se impide: hay quien entrena dos veces en un día. Pero se
                avisa, porque casi siempre es que ya estaba puesto. */}
            {yaHay.length > 0 ? (
              <View style={styles.aviso}>
                <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.avisoTexto}>
                  Ese día ya tienes {yaHay.length === 1 ? 'un entreno' : `${yaHay.length} entrenos`}
                  {yaHay[0].dayName ? ` (${yaHay.map((l) => l.dayName).join(', ')})` : ''}. Si lo
                  registras otra vez, saldrán los dos.
                </Text>
              </View>
            ) : null}
          </Card>

          <Card accent style={styles.tarjeta}>
            <Text style={styles.tituloTarjeta}>¿Qué entrenaste?</Text>
            <ChipRow scroll>
              {routine.days
                .filter((d) => !d.isRest)
                .map((d) => (
                  <Chip
                    key={d.id}
                    texto={d.name || 'Entreno'}
                    activo={d.id === diaId}
                    onPress={() => elegirDiaDelPlan(d)}
                  />
                ))}
            </ChipRow>
          </Card>

          {log.length === 0 ? (
            <Card style={styles.tarjeta}>
              <Text style={styles.texto}>Ese día del plan no tiene ejercicios.</Text>
            </Card>
          ) : (
            log.map((ex, i) => {
              const enPlan = diaDelPlan?.exercises.find((e) => e.exerciseId === ex.exerciseId);
              const carga = enPlan ? resolveLoad(enPlan) : resolveLoad(ex);
              const enSegundos = isHoldMeasure(medidaDe(ex));
              return (
                <Card key={`${ex.exerciseId}-${i}`} style={styles.tarjeta}>
                  <View style={styles.cabeceraEjercicio}>
                    <Text style={styles.nombre} numberOfLines={2}>
                      {ex.name}
                    </Text>
                    <View style={styles.masMenos}>
                      <Pressable
                        onPress={() => setLog((p) => conUnaSerieMenos(p, i))}
                        style={styles.paso}
                        hitSlop={6}
                      >
                        <Ionicons name="remove" size={16} color={colors.text} />
                      </Pressable>
                      <Text style={styles.cuantas}>{ex.sets.length}</Text>
                      <Pressable
                        onPress={() => setLog((p) => conUnaSerieMas(p, i))}
                        style={styles.paso}
                        hitSlop={6}
                      >
                        <Ionicons name="add" size={16} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>

                  {ex.sets.map((serie, j) => (
                    <View key={j} style={styles.filaSerie}>
                      <Text style={styles.etiquetaSerie}>Serie {j + 1}</Text>
                      <TextField
                        value={serie.reps}
                        onChangeText={(v) => cambiarMarca(i, j, 'reps', v)}
                        placeholder={enPlan?.reps || (enSegundos ? 'seg' : 'reps')}
                        keyboardType="numeric"
                        containerStyle={styles.campo}
                        style={{ marginBottom: 0 }}
                      />
                      {carga !== 'none' ? (
                        <TextField
                          value={serie.weight}
                          onChangeText={(v) => cambiarMarca(i, j, 'weight', v)}
                          placeholder={carga === 'assisted' ? 'goma' : 'kg'}
                          keyboardType="decimal-pad"
                          containerStyle={styles.campo}
                          style={{ marginBottom: 0 }}
                        />
                      ) : null}
                    </View>
                  ))}
                </Card>
              );
            })
          )}

          <Card style={styles.tarjeta}>
            <TextField
              label="¿Cuánto duró? (minutos)"
              value={minutos}
              onChangeText={setMinutos}
              placeholder="Ej. 45"
              keyboardType="number-pad"
              style={{ marginBottom: 0 }}
            />
            <Text style={styles.pista}>
              Si no te acuerdas, déjalo en blanco: el entreno se guarda igual.
            </Text>
          </Card>

          <Button
            title={`Registrar el entreno del ${esMismoDia(dia, Date.now()) ? 'día de hoy' : diaYMes(dia)}`}
            onPress={guardar}
            loading={guardando}
            disabled={!hayAlgoQueGuardar(log)}
          />

          <DictarEntreno
            visible={dictadoAbierto}
            onClose={() => setDictadoAbierto(false)}
            catalogo={catalogo}
            onAplicar={aplicarDictado}
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  volver: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  volverTexto: { ...typography.small, color: colors.textMuted },
  titulo: { ...typography.h1, color: colors.text },
  subtitulo: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  tarjeta: { marginBottom: spacing.md },
  dictar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  dictarIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dictarTexto: { flex: 1, gap: 2 },
  dictarTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  dictarPie: { ...typography.small, color: colors.textMuted, lineHeight: 17 },
  tituloTarjeta: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  texto: { ...typography.small, color: colors.textMuted },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  avisoTexto: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 18 },
  cabeceraEjercicio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  nombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  masMenos: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  paso: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuantas: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, minWidth: 14, textAlign: 'center' },
  filaSerie: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  etiquetaSerie: { ...typography.small, color: colors.textMuted, flex: 1 },
  campo: { width: 88, marginBottom: 0 },
  pista: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm, lineHeight: 18 },
});
