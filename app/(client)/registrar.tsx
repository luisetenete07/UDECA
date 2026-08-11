import React, { useCallback, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip, ChipRow } from '../../components/Chip';
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

  const guardar = async () => {
    if (!profile || !routine || !diaDelPlan) return;
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
        dayName: diaDelPlan.name,
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
          `${profile.name.split(' ')[0]} ha registrado ${diaDelPlan.name} del ${diaYMes(dia)}.`
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
