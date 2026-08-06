import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import {
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Confetti } from '../../components/Confetti';
import { PRBurst } from '../../components/PRBurst';
import { checkLivePR, type LivePR } from '../../lib/livePR';
import { FadeIn, PopIn } from '../../components/FadeIn';
import { EmptyState } from '../../components/EmptyState';
import { IntervalTimer } from '../../components/IntervalTimer';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { VideoPlayer } from '../../components/VideoPlayer';
import { StatTile } from '../../components/StatTile';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { getExerciseLibrary } from '../../lib/firestore/exercises';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import { getCyclesForClientSelf } from '../../lib/firestore/cycles';
import { applyWeekPlan } from '../../lib/weekPlan';
import { esfuerzoDePct, pctCombinado, textoIntensidad } from '../../lib/intensidad';
import { RirPicker } from '../../components/RirPicker';
import { mayusculaInicial } from '../../lib/fechas';
import { PressableScale } from '../../components/PressableScale';
import { SessionHeader } from '../../components/SessionHeader';
import type { AccionRapida } from '../../components/QuickSheet';
import { createWorkoutLog, getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { syncMySocialStats } from '../../lib/firestore/social';
import { flexLabel, resolveTodaySession } from '../../lib/schedule';
import { getCycleAnchor, setCycleAnchorForIndex, setCycleAnchorToday } from '../../lib/cycleAnchor';
import {
  addFlexRestDay,
  removeFlexRestDay,
  clearActiveSession,
  fetchSyncState,
  saveActiveSession,
  setCycleAnchorRemote,
} from '../../lib/firestore/sync';
import { tabScreenOptions } from '../../lib/navTheme';
import { notifyUser } from '../../lib/notifications';
import { enqueueWorkout, flushPendingWorkouts } from '../../lib/offlineQueue';
import { shareRecordImage, shareSessionImage } from '../../lib/brandCards';
import { startRest, stopRest, useActiveRest } from '../../lib/restTimerStore';
import {
  computeAchievements,
  currentStreak,
  detectNewPRs,
  lastPerformanceByExercise,
  sessionTotals,
  type Achievement,
  type LastPerformance,
  type PersonalRecord,
} from '../../lib/stats';
import { fonts, colors, radius, shadows, spacing, typography } from '../../lib/theme';
import {
  clusterBlocks,
  EXERCISE_MEASURES,
  GRIP_LABEL,
  type ExerciseMeasure,
  isDualMeasure,
  isHoldMeasure,
  resolveLoad,
  todayWeekday,
  WEEKDAY_NAMES,
  type LoggedExercise,
  type Routine,
  type RoutineDay,
  type WorkoutLog,
} from '../../lib/types';

const DEFAULT_REST_SECONDS = 90;
// Una sesión a medias se conserva hasta 3 días: dentro del MISMO día se retoma
// sola; si es de un día anterior, se ofrece el botón "Rellenar último entreno".
const DRAFT_TTL_MS = 72 * 60 * 60 * 1000;

interface WorkoutDraft {
  routineId: string;
  dayId: string;
  dayName?: string;
  log: LoggedExercise[];
  startedAt: number | null;
  savedAt: number;
  /** Ejercicio que se estaba viendo, para reanudar justo donde se dejó. */
  viewIndex?: number;
}

const draftKey = (uid: string) => `udeca-workout-draft-${uid}`;
// Entreno de un día anterior que quedó sin finalizar (se guarda aparte para que
// empezar uno nuevo hoy no lo borre).
const pendingKey = (uid: string) => `udeca-workout-pending-${uid}`;
// Un borrador merece restaurarse si contiene CUALQUIER dato del alumno, no solo
// series marcadas: reps o pesos tecleados y notas cuentan igual. Solo se
// escriben borradores que difieren de la plantilla del día (ver pristineRef),
// así que basta con comprobar que hay algo dentro.
const draftHasProgress = (d: WorkoutDraft) =>
  d.log.some(
    (ex) =>
      (ex.notes ?? '').trim() !== '' ||
      ex.sets.some(
        (st) => st.completed || (st.reps ?? '').trim() !== '' || (st.weight ?? '').trim() !== ''
      )
  );

/** Descanso en formato min:seg para las etiquetas: 90 → "1:30", 210 → "3:30". */
function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** ¿El timestamp cae en el mismo día natural que la referencia (hoy)? */
function isSameDay(ts: number, ref = Date.now()): boolean {
  const a = new Date(ts);
  const b = new Date(ref);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Timestamp a medianoche local (para agrupar por día natural). */
function startOfDayLocal(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function buildLog(day: RoutineDay): LoggedExercise[] {
  return day.exercises.map((ex) => {
    // Si el coach fijó un número exacto (p. ej. "10"), lo precargamos para
    // ahorrar tecleo. Si puso un RANGO ("8-12") o texto ("AMRAP"), dejamos el
    // campo VACÍO y mostramos ese objetivo como pista: así el alumno escribe
    // las repeticiones que de verdad ha hecho.
    const target = (ex.reps ?? '').trim();
    const prefill = /^\d+$/.test(target) ? target : '';
    return {
      exerciseId: ex.exerciseId,
      name: ex.name,
      measure: ex.measure ?? 'reps',
      load: resolveLoad(ex),
      sets: Array.from({ length: ex.sets || 1 }, () => ({
        reps: prefill,
        weight: '',
        completed: false,
      })),
    };
  });
}

interface SessionSummary {
  durationMin: number;
  sets: number;
  reps: number;
  seconds: number;
  volumeKg: number;
  prs: PersonalRecord[];
  streak: number;
  newAchievements: Achievement[];
}

export default function WorkoutScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();

  // Modo inmersivo: oculta la barra de pestañas mientras se entrena para
  // concentrarse; la restaura al salir de la pantalla.
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => parent?.setOptions({ tabBarStyle: tabScreenOptions.tabBarStyle });
    }, [navigation])
  );

  const [routine, setRoutine] = useState<Routine | null>(null);
  // Récord que se está celebrando ahora mismo, y los ya celebrados en esta
  // sesión: el mismo ejercicio no vuelve a saltar aunque siga subiendo serie a
  // serie, o el aviso pasaría de premio a ruido.
  const [prVivo, setPrVivo] = useState<LivePR | null>(null);
  const prCelebrados = useRef<Set<string>>(new Set());
  const [history, setHistory] = useState<import('../../lib/types').WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [log, setLog] = useState<LoggedExercise[]>([]);
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerformance>>({});
  const [videoByExercise, setVideoByExercise] = useState<Record<string, string>>({});
  // Medida ACTUAL de cada ejercicio en la biblioteca (reps/segundos). Manda
  // sobre la copia guardada en la rutina por si el coach la cambió después.
  const [measureByExercise, setMeasureByExercise] =
    useState<Record<string, import('../../lib/types').ExerciseMeasure>>({});
  // Grupo muscular de cada ejercicio (para el calentamiento sugerido del día).
  const [muscleByExercise, setMuscleByExercise] = useState<Record<string, string>>({});
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [restored, setRestored] = useState(false);
  // Borrador sin finalizar de un DÍA ANTERIOR: se ofrece rellenarlo o dejarlo.
  const [pastDraft, setPastDraft] = useState<WorkoutDraft | null>(null);
  const [pastDismissed, setPastDismissed] = useState(false);
  // Si estamos rellenando un entreno de otro día, se registra con SU fecha.
  const [resumeDate, setResumeDate] = useState<number | null>(null);
  // Evita que el efecto de recuperación pise una recuperación manual.
  const resumeGuard = useRef(false);
  // Descanso activo: cuando corre, el crono flota abajo; añadimos hueco al
  // final para que no tape los botones Anterior/Siguiente ni el de Terminar.
  const activeRest = useActiveRest();
  // Índice del ejercicio que se muestra en el modo enfocado (1 por pantalla).
  const [viewIndex, setViewIndex] = useState(0);
  // Índice del ejercicio con el vídeo de técnica desplegado (null = ninguno).
  const [videoOpenIndex, setVideoOpenIndex] = useState<number | null>(null);
  // Índice del ejercicio con el campo de nota abierto (null = ninguno).
  const [noteOpenIndex, setNoteOpenIndex] = useState<number | null>(null);
  // Ancla local del ciclo (Método REIN TENA): el alumno puede reiniciar en Día 1.
  const [cycleAnchor, setCycleAnchor] = useState<number | null>(null);
  // Elección del descanso opcional (Día 7 TENA): pendiente hasta que decide.
  const [optionalResolved, setOptionalResolved] = useState(false);
  const [restingToday, setRestingToday] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // Modo "Sensaciones": selección múltiple de rutinas (en orden) y descanso.
  const [flexSelection, setFlexSelection] = useState<string[]>([]);
  const [combinedDay, setCombinedDay] = useState<RoutineDay | null>(null);
  // Sensaciones: el alumno pide hacer un SEGUNDO entreno el mismo día. Ignora
  // temporalmente la tarjeta de "ya completado" para volver a elegir rutina.
  const [flexAgain, setFlexAgain] = useState(false);
  // Sensaciones: "hoy descanso" se recuerda entre sesiones (persistido en
  // flexRestDays), así al cerrar y reabrir la app el día sigue como descanso.
  const [flexResting, setFlexResting] = useState<boolean>(() => {
    const today = startOfDayLocal(Date.now());
    return (profile?.flexRestDays ?? []).some((d) => startOfDayLocal(d) === today);
  });
  const startedAt = useRef<number | null>(null);
  // Log "en blanco" del día tal y como lo genera la plantilla. Sirve para saber
  // si el alumno ha tocado algo: en cuanto el log difiere de esto, hay datos que
  // conservar y el borrador empieza a guardarse.
  const pristineRef = useRef<string>('');
  // Sesión en curso traída de la cuenta (otro dispositivo). Se compara con el
  // borrador local para recuperar siempre la versión más reciente.
  const remoteDraftRef = useRef<WorkoutDraft | null>(null);
  // Temporizador para no escribir en Firestore en cada tecla (debounce).
  const remoteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        // Sube entrenos que quedaron pendientes por falta de conexión.
        const uploaded = await flushPendingWorkouts().catch(() => 0);
        if (uploaded > 0) showToast(`${uploaded} entreno(s) pendiente(s) subido(s) ✓`);
        const [data, logs, ciclos] = await Promise.all([
          getActiveRoutineForClient(profile.uid),
          getWorkoutLogsForClient(profile.uid),
          // Si el entrenador programó ESTA semana (4×8 la primera, 5×8 la
          // tercera), es eso lo que hay que entrenar hoy. Sin ciclos, la
          // rutina se usa tal cual y aquí no cambia nada.
          getCyclesForClientSelf(profile.uid).catch(() => []),
        ]);
        if (cancelled) return;
        setRoutine(applyWeekPlan(data, ciclos));
        prCelebrados.current = new Set();
        setHistory(logs);
        setLastPerf(lastPerformanceByExercise(logs));
        // Vídeos de técnica de la biblioteca del entrenador (no bloquea).
        if (profile.trainerId) {
          getExerciseLibrary(profile.trainerId)
            .then((library) => {
              if (cancelled) return;
              const map: Record<string, string> = {};
              const measures: Record<string, import('../../lib/types').ExerciseMeasure> = {};
              const muscles: Record<string, string> = {};
              for (const ex of library) {
                if (ex.videoUrl) map[ex.id] = ex.videoUrl;
                measures[ex.id] = ex.measure ?? 'reps';
                muscles[ex.id] = ex.muscleGroup;
              }
              setVideoByExercise(map);
              setMeasureByExercise(measures);
              setMuscleByExercise(muscles);
            })
            .catch(() => {});
        }
        // Estado sincronizado de la cuenta (sesión en curso + ancla del ciclo),
        // para que cualquier dispositivo con la misma cuenta vaya al día.
        const sync = await fetchSyncState(profile.uid);
        if (cancelled) return;
        remoteDraftRef.current = sync.activeSession ?? null;
        // El ancla del ciclo es la más reciente entre la de la cuenta (otro
        // dispositivo) y la local de este dispositivo.
        const localAnchor = data ? await getCycleAnchor(data.id) : null;
        const remoteAnchor = data ? sync.cycleAnchors[data.id] ?? null : null;
        const anchor = Math.max(localAnchor ?? 0, remoteAnchor ?? 0) || null;
        if (cancelled) return;
        setCycleAnchor(anchor);
        if (data && data.days.length > 0) {
          // Preselecciona el día que toca hoy. Prioridad: sesión en curso en
          // otro dispositivo → día ya entrenado hoy → día que toca → primero.
          const session = resolveTodaySession(data, anchor ?? undefined);
          const remoteFresh =
            sync.activeSession &&
            sync.activeSession.routineId === data.id &&
            Date.now() - sync.activeSession.savedAt < DRAFT_TTL_MS &&
            sync.activeSession.log.some((ex) => ex.sets.some((st) => st.completed))
              ? data.days.find((d) => d.id === sync.activeSession!.dayId)
              : undefined;
          const doneToday = logs.find(
            (l) => l.routineId === data.id && isSameDay(l.date)
          );
          const doneTodayDay = doneToday
            ? data.days.find((d) => d.name === doneToday.dayName)
            : undefined;
          if (data.schedule === 'flex') {
            // Modo a elección ("Sensaciones"): el alumno elige rutina antes de
            // empezar; solo preseleccionamos si hay sesión en curso o ya entrenó.
            setSelectedDayId((prev) => prev ?? remoteFresh?.id ?? doneTodayDay?.id ?? null);
          } else {
            const fallback = data.days.find((d) => !d.isRest) ?? data.days[0];
            setSelectedDayId(
              (prev) =>
                prev ?? remoteFresh?.id ?? doneTodayDay?.id ?? session.day?.id ?? fallback.id
            );
          }
        }
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  useEffect(() => {
    if (!routine || !selectedDayId || !profile) return;
    const day = routine.days.find((d) => d.id === selectedDayId);
    if (!day) return;
    // Estamos en un día REAL de la rutina: si quedó pegado un "día combinado"
    // de Sensaciones de una sesión anterior, lo limpiamos. Si no, el nombre del
    // entreno (dayName) se guardaría con el del combinado antiguo aunque los
    // ejercicios sean los de este día (p. ej. salía "Core" en un Tirón suave).
    setCombinedDay(null);
    // Una recuperación manual (botón "Rellenar último entreno") ya ha fijado el
    // log; no lo pisamos.
    if (resumeGuard.current) {
      resumeGuard.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const uid = profile.uid;
      const today = startOfDayLocal(Date.now());
      // 1) Carry-over: entreno de un día anterior sin finalizar (guardado aparte).
      let pending: WorkoutDraft | null = null;
      try {
        const rawP = await AsyncStorage.getItem(pendingKey(uid));
        if (rawP) pending = JSON.parse(rawP) as WorkoutDraft;
      } catch {
        // ilegible: se ignora
      }
      if (
        !pending ||
        !draftHasProgress(pending) ||
        Date.now() - pending.savedAt >= DRAFT_TTL_MS ||
        startOfDayLocal(pending.startedAt ?? pending.savedAt) >= today
      ) {
        if (pending) AsyncStorage.removeItem(pendingKey(uid)).catch(() => {});
        pending = null;
      }

      // 2) Borrador principal: local vs. cuenta (otro dispositivo), gana el más reciente.
      let draft: WorkoutDraft | null = null;
      try {
        const raw = await AsyncStorage.getItem(draftKey(uid));
        if (raw) draft = JSON.parse(raw) as WorkoutDraft;
      } catch {
        // ilegible
      }
      const remote = remoteDraftRef.current;
      if (remote && (!draft || remote.savedAt > draft.savedAt)) draft = remote;

      let restoredHere = false;
      if (draft && draftHasProgress(draft) && Date.now() - draft.savedAt < DRAFT_TTL_MS) {
        const draftDay = startOfDayLocal(draft.startedAt ?? draft.savedAt);
        if (draftDay === today && draft.routineId === routine.id && draft.dayId === selectedDayId) {
          // Mismo día: se retoma sin preguntar.
          if (cancelled) return;
          // La referencia sigue siendo la plantilla del día: el borrador difiere
          // de ella, así que los cambios se seguirán guardando.
          pristineRef.current = JSON.stringify(buildLog(day));
          setLog(draft.log);
          startedAt.current = draft.startedAt;
          setRestored(true);
          setResumeDate(null);
          setSummary(null);
          // Vuelve al ejercicio que estaba viendo; si no consta, al primero sin
          // terminar.
          const resume = draft.log.findIndex((ex) => ex.sets.some((st) => !st.completed));
          setViewIndex(draft.viewIndex ?? (resume >= 0 ? resume : 0));
          restoredHere = true;
        } else if (draftDay < today) {
          // El borrador principal es de un día anterior: pásalo a "pendiente" para
          // que empezar hoy no lo borre, y libéralo del borrador/sesión activos.
          AsyncStorage.setItem(pendingKey(uid), JSON.stringify(draft)).catch(() => {});
          AsyncStorage.removeItem(draftKey(uid)).catch(() => {});
          clearActiveSession(uid);
          remoteDraftRef.current = null;
          pending = draft;
        }
      }

      if (cancelled) return;
      setPastDraft(pending);
      if (!restoredHere) {
        const fresh = buildLog(day);
        pristineRef.current = JSON.stringify(fresh);
        setLog(fresh);
        setRestored(false);
        setResumeDate(null);
        setSummary(null);
        setViewIndex(0);
        startedAt.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routine, selectedDayId, profile]);

  // Guarda el borrador con cada cambio: al instante en el dispositivo y, con un
  // pequeño retardo, en la cuenta (Firestore) para sincronizar entre móviles.
  useEffect(() => {
    if (!profile || !routine || !selectedDayId || log.length === 0) return;
    // Hay algo que guardar en cuanto el log deja de ser la plantilla del día:
    // basta con teclear unas repeticiones, un peso o una nota, sin necesidad de
    // marcar ninguna serie como completada.
    if (!pristineRef.current || JSON.stringify(log) === pristineRef.current) return;
    const draft: WorkoutDraft = {
      routineId: routine.id,
      dayId: selectedDayId,
      dayName:
        combinedDay?.name ?? routine.days.find((d) => d.id === selectedDayId)?.name ?? undefined,
      log,
      startedAt: startedAt.current,
      savedAt: Date.now(),
      viewIndex,
    };
    AsyncStorage.setItem(draftKey(profile.uid), JSON.stringify(draft)).catch(() => {});
    remoteDraftRef.current = draft;
    // Debounce: sube a la cuenta como mucho ~1,5 s después del último cambio.
    if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    remoteSaveTimer.current = setTimeout(() => {
      saveActiveSession(profile.uid, draft);
    }, 1500);
  }, [log, viewIndex, combinedDay, profile, routine, selectedDayId]);

  // Si la app pasa a segundo plano (bloqueo de pantalla, llamada, cambio de
  // app), no esperamos al debounce: subimos el borrador ya, para que la sesión
  // siga intacta aunque el sistema cierre la app sin previo aviso.
  useEffect(() => {
    if (!profile) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      const draft = remoteDraftRef.current;
      if (!draft) return;
      if (remoteSaveTimer.current) {
        clearTimeout(remoteSaveTimer.current);
        remoteSaveTimer.current = null;
      }
      saveActiveSession(profile.uid, draft);
    });
    return () => sub.remove();
  }, [profile]);

  // Al salir de la pantalla, cancela cualquier subida pendiente en cola.
  useEffect(() => {
    return () => {
      if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    };
  }, []);

  const discardDraft = () => {
    if (!routine || !selectedDayId) return;
    const day = routine.days.find((d) => d.id === selectedDayId);
    if (profile) {
      AsyncStorage.removeItem(draftKey(profile.uid)).catch(() => {});
      clearActiveSession(profile.uid);
    }
    remoteDraftRef.current = null;
    if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    if (day) setLog(buildLog(day));
    startedAt.current = null;
    setRestored(false);
  };

  // Rellenar el entreno de un día anterior que quedó sin finalizar. Carga su
  // log y lo deja listo para completar y guardar (se registrará con SU fecha).
  const resumePastDraft = () => {
    if (!routine || !pastDraft) return;
    const d = pastDraft;
    setLog(d.log);
    startedAt.current = d.startedAt;
    setRestored(true);
    setResumeDate(startOfDayLocal(d.startedAt ?? d.savedAt));
    setPastDraft(null);
    setSummary(null);
    const realDay = routine.days.find((x) => x.id === d.dayId);
    if (realDay && d.dayId !== selectedDayId) {
      // Cambiar de día re-dispara el efecto de recuperación: lo bloqueamos una vez.
      resumeGuard.current = true;
      setCombinedDay(null);
      setSelectedDayId(d.dayId);
    } else if (!realDay) {
      // Rutina de Sensaciones (día combinado) o día ya inexistente: día sintético.
      setCombinedDay({ id: d.dayId, name: d.dayName || 'Entreno', exercises: [] });
    }
    const resume = d.log.findIndex((ex) => ex.sets.some((st) => !st.completed));
    setViewIndex(resume >= 0 ? resume : 0);
  };

  // Dejar el entreno de ayer para más tarde: se oculta el aviso y se puede
  // empezar uno nuevo hoy (el borrador se conserva para volver a ofrecerlo).
  const dismissPastDraft = () => setPastDismissed(true);

  const isFlex = routine?.schedule === 'flex';
  const day = combinedDay ?? routine?.days.find((d) => d.id === selectedDayId) ?? null;
  const todaySession = resolveTodaySession(routine, cycleAnchor ?? undefined);

  // Sensaciones: alterna una rutina en la selección (guarda el orden de elección).
  const toggleFlexRoutine = (id: string) => {
    setFlexSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Sensaciones: monta el entreno combinando las rutinas elegidas, en orden.
  const startFlexSession = () => {
    if (!routine || flexSelection.length === 0) return;
    const chosen = flexSelection
      .map((id) => routine.days.find((d) => d.id === id))
      .filter((d): d is RoutineDay => !!d);
    const combined: RoutineDay = {
      id: `flex-${Date.now()}`,
      name: chosen.map((d) => d.name || 'Rutina').join(' + '),
      exercises: chosen.flatMap((d) => d.exercises),
      // Encadenando rutinas manda la más dura: un día suave ANTES de uno fuerte
      // no hace la sesión medio fuerte, la hace fuerte y con más fatiga.
      intensityPct: pctCombinado(chosen),
    };
    setCombinedDay(combined);
    setLog(buildLog(combined));
    setViewIndex(0);
    startedAt.current = null;
  };

  // Sensaciones: marca hoy como descanso (no afecta a la racha).
  const chooseFlexRest = async () => {
    setFlexResting(true);
    if (profile) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      addFlexRestDay(profile.uid, today.getTime()).catch(() => {});
    }
  };

  // Sensaciones: cancela el entreno en curso y vuelve a la selección de rutinas.
  const cancelFlexSession = () => {
    setCombinedDay(null);
    setFlexSelection([]);
    setFlexResting(false);
    setLog([]);
    setViewIndex(0);
    setRestored(false);
    startedAt.current = null;
    if (profile) {
      AsyncStorage.removeItem(draftKey(profile.uid)).catch(() => {});
      clearActiveSession(profile.uid);
    }
    remoteDraftRef.current = null;
    stopRest();
  };

  // Sensaciones: alumno añade/quita una serie a un ejercicio según se sienta.
  const addSet = (exerciseIndex: number) => {
    setLog((prev) =>
      prev.map((ex, i) => {
        if (i !== exerciseIndex) return ex;
        // La casilla de la marca a apuntar arranca siempre vacía (no hereda la
        // marca de la serie anterior).
        return { ...ex, sets: [...ex.sets, { reps: '', weight: '', completed: false }] };
      })
    );
  };
  const removeSet = (exerciseIndex: number) => {
    setLog((prev) => {
      const ex = prev[exerciseIndex];
      if (!ex) return prev;
      // Sensaciones: si se quita la única serie, el ejercicio sale del día.
      if (ex.sets.length <= 1) {
        const next = prev.filter((_, i) => i !== exerciseIndex);
        setViewIndex((v) => Math.max(0, Math.min(v, next.length - 1)));
        return next;
      }
      return prev.map((e, i) => (i === exerciseIndex ? { ...e, sets: e.sets.slice(0, -1) } : e));
    });
  };

  // Historial de los últimos 7 días (para decidir qué toca hoy en Sensaciones).
  const last7FlexDays = (() => {
    const out: { ts: number; label: string; what: string }[] = [];
    const rest = new Set((profile?.flexRestDays ?? []).map((t) => startOfDayLocal(t)));
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const ts = d.getTime();
      const logsThatDay = history.filter(
        (l) => routine && l.routineId === routine.id && startOfDayLocal(l.date) === ts
      );
      // Un día pasado sin nada registrado ES un descanso, lo haya marcado el
      // alumno o no: si no entrenó, descansó. Antes salía un guion, que no
      // dice nada y deja el historial lleno de huecos.
      //
      // HOY se queda sin marcar a propósito: el día no ha terminado y darlo
      // por descanso a media mañana sería contarle un día que aún puede hacer.
      const what = logsThatDay.length
        ? logsThatDay.map((l) => l.dayName).join(', ')
        : rest.has(ts)
          ? 'Descanso'
          : i === 0
            ? '—'
            : 'Descanso';
      out.push({
        ts,
        label:
          i === 0
            ? 'Hoy'
            : i === 1
              ? 'Ayer'
              : d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' }),
        what,
      });
    }
    return out;
  })();

  // Descanso opcional (Día 7 TENA): reinicia el ciclo entrenando el Día 1 hoy.
  const handleStartCycleToday = async () => {
    if (!routine || routine.days.length === 0) return;
    const ts = await setCycleAnchorToday(routine.id);
    setCycleAnchor(ts);
    // Sincroniza el día del ciclo con el resto de dispositivos de la cuenta.
    if (profile) setCycleAnchorRemote(profile.uid, routine.id, ts);
    setOptionalResolved(true);
    setRestingToday(false);
    const firstDay = routine.days[0];
    setSelectedDayId(firstDay.id);
    setViewIndex(0);
    startedAt.current = null;
    showToast('Ciclo reiniciado · hoy es el Día 1');
  };

  // Fija qué día del ciclo es HOY (plan desfasado o entreno pospuesto).
  const handleSetTodayIndex = async (index: number) => {
    if (!routine || routine.days.length === 0) return;
    const ts = await setCycleAnchorForIndex(routine.id, index, routine.days.length);
    setCycleAnchor(ts);
    if (profile) setCycleAnchorRemote(profile.uid, routine.id, ts);
    setOptionalResolved(true);
    setRestingToday(false);
    setSelectedDayId(routine.days[index].id);
    setViewIndex(0);
    setDayPickerOpen(false);
    showToast(`Hoy es el Día ${index + 1}`);
  };

  const isOptionalRestToday = routine?.schedule === 'cycle' && todaySession.optionalRest;
  const showOptionalChoice = isOptionalRestToday && !optionalResolved;
  const showRestingCard = isOptionalRestToday && optionalResolved && restingToday;

  const handleShareSummary = async () => {
    if (!summary || !routine) return;
    // Imagen de marca (mucho más vistosa que el texto). Si por lo que sea no
    // se puede generar, se comparte el resumen escrito.
    try {
      const result = await shareSessionImage({
        routineName: routine.name,
        dayName: day?.name,
        durationMin: summary.durationMin,
        sets: summary.sets,
        reps: summary.reps,
        seconds: summary.seconds,
        volumeKg: summary.volumeKg,
        streak: summary.streak,
        prCount: summary.prs.length,
        date: Date.now(),
      });
      if (result === 'downloaded') showToast('Imagen de la sesión descargada');
      if (result) return;
    } catch {
      // Caemos al texto.
    }
    const parts = [
      `Sesión completada en UDECA: ${day?.name ?? routine.name}`,
      summary.durationMin > 0 ? `${summary.durationMin} min` : null,
      `${summary.sets} series`,
      summary.reps > 0 ? `${summary.reps} reps` : null,
      summary.seconds > 0 ? `${summary.seconds}s isométrico` : null,
      summary.volumeKg > 0 ? `${summary.volumeKg} kg de volumen` : null,
      summary.prs.length > 0
        ? `${summary.prs.length} récord${summary.prs.length > 1 ? 's' : ''} personal${
            summary.prs.length > 1 ? 'es' : ''
          }`
        : null,
      summary.streak > 1 ? `Racha: ${summary.streak} días` : null,
    ].filter(Boolean);
    const message = `${parts.join(' · ')}\n\nEntreno con UDECA — Universidad de Calistenia`;
    try {
      await Share.share({ message });
    } catch {
      // El usuario canceló o el navegador no soporta compartir: copiamos.
      try {
        await navigator.clipboard.writeText(message);
        showToast('Resumen copiado, pégalo donde quieras');
      } catch {
        showToast('No se pudo compartir');
      }
    }
  };

  // Comparte una sesión YA guardada hoy (pantalla "entrenamiento terminado"),
  // reconstruyendo las estadísticas desde el registro guardado.
  const handleShareCompleted = async (logToShare: WorkoutLog) => {
    if (!routine) return;
    const t = sessionTotals(logToShare.exercises, measureByExercise);
    try {
      const result = await shareSessionImage({
        routineName: logToShare.routineName ?? routine.name,
        dayName: logToShare.dayName,
        durationMin: logToShare.durationMin ?? 0,
        sets: t.sets,
        reps: t.reps,
        seconds: t.seconds,
        volumeKg: t.volumeKg,
        streak: 0,
        prCount: 0,
        date: logToShare.date,
      });
      if (result === 'downloaded') showToast('Imagen de la sesión descargada');
      if (result) return;
    } catch {
      // Caemos al texto.
    }
    const parts = [
      `Sesión completada en UDECA: ${logToShare.dayName ?? routine.name}`,
      logToShare.durationMin ? `${logToShare.durationMin} min` : null,
      `${t.sets} series`,
      t.reps > 0 ? `${t.reps} reps` : null,
      t.seconds > 0 ? `${t.seconds}s isométrico` : null,
      t.volumeKg > 0 ? `${t.volumeKg} kg de volumen` : null,
    ].filter(Boolean);
    const message = `${parts.join(' · ')}\n\nEntreno con UDECA — Universidad de Calistenia`;
    try {
      await Share.share({ message });
    } catch {
      try {
        await navigator.clipboard.writeText(message);
        showToast('Resumen copiado, pégalo donde quieras');
      } catch {
        showToast('No se pudo compartir');
      }
    }
  };

  // Comparte el récord como IMAGEN de marca (canvas 1080×1350, para stories).
  // Si la imagen no es posible (nativo antiguo, canvas no disponible), texto.
  const handleShareRecord = async () => {
    if (!summary || summary.prs.length === 0) return;
    try {
      const result = await shareRecordImage({
        prs: summary.prs.map((p) => ({ exerciseName: p.exerciseName, label: p.label })),
        streak: summary.streak,
      });
      if (result === 'downloaded') showToast('Imagen del récord descargada');
      if (result) return;
    } catch {
      // Caemos al texto.
    }
    const lines = summary.prs.map((pr) => `${pr.exerciseName}: ${pr.label}`);
    const message = `NUEVO RÉCORD PERSONAL\n\n${lines.join('\n')}\n\n${
      summary.streak > 1 ? `Racha de ${summary.streak} días\n` : ''
    }Entrenando con UDECA — Universidad de Calistenia\nwww.udeca.app`;
    try {
      await Share.share({ message });
    } catch {
      try {
        await navigator.clipboard.writeText(message);
        showToast('Récord copiado, pégalo donde quieras');
      } catch {
        showToast('No se pudo compartir');
      }
    }
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: 'reps' | 'seconds' | 'side2' | 'weight' | 'completed',
    value: string | boolean
  ) => {
    setLog((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? {
              ...ex,
              sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, [field]: value } : s)),
            }
          : ex
      )
    );

    // Al completar una serie: arranca el crono de descanso del ejercicio.
    // (En clúster, el descanso CORTO entre bloques se pide aparte: ver
    // `descansoDeBloque`. Este es el descanso largo, el de la serie entera.)
    if (field === 'completed' && value === true) {
      if (!startedAt.current) startedAt.current = Date.now();
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // ¿Acaba de batir su marca? Se comprueba con el estado NUEVO, porque el
      // de React todavía no se ha actualizado cuando llega aquí.
      const ejercicio = log[exerciseIndex];
      if (ejercicio && !prCelebrados.current.has(ejercicio.exerciseId)) {
        const conLaSerie = ejercicio.sets.map((s2, j) =>
          j === setIndex ? { ...s2, completed: true } : s2
        );
        const record = checkLivePR(history, ejercicio, conLaSerie);
        if (record) {
          prCelebrados.current.add(record.exerciseId);
          setPrVivo(record);
        }
      }
      // En superserie no hay descanso: se encadena con el siguiente ejercicio.
      const nextIsLinked = day?.exercises[exerciseIndex + 1]?.supersetWithPrevious === true;
      if (!nextIsLinked) {
        const rest = day?.exercises[exerciseIndex]?.restSeconds || DEFAULT_REST_SECONDS;
        // Qué toca al terminar el descanso: otra serie del mismo ejercicio o el siguiente.
        const setsInEx = log[exerciseIndex]?.sets.length ?? 0;
        const exName = log[exerciseIndex]?.name ?? '';
        const nextEx = day?.exercises[exerciseIndex + 1];
        const nextLabel =
          setIndex + 1 < setsInEx
            ? `Ahora: Serie ${setIndex + 2} · ${exName}`
            : nextEx
              ? `Ahora: ${nextEx.name}`
              : 'Última serie hecha · guarda la sesión';
        startRest(rest, nextLabel);
      }

      // Autoavance: si al marcar esta serie el ejercicio queda COMPLETO, pasa
      // solo al siguiente (deja ver el ✓ un instante). El último no avanza.
      const exSets = log[exerciseIndex]?.sets ?? [];
      const nowAllDone =
        exSets.length > 0 && exSets.every((s, j) => (j === setIndex ? true : s.completed));
      if (nowAllDone && exerciseIndex < log.length - 1) {
        setTimeout(() => {
          setViewIndex((cur) => (cur === exerciseIndex ? exerciseIndex + 1 : cur));
        }, 900);
      }
    }
  };

  /**
   * Marca de un bloque de una serie en clúster. El bloque 1 es la casilla de
   * siempre (`reps`); estos son los siguientes, y viven en `clusters` para no
   * tocar nada de lo que ya lee la marca principal.
   */
  const updateCluster = (
    exerciseIndex: number,
    setIndex: number,
    blockIndex: number,
    value: string
  ) => {
    setLog((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? {
              ...ex,
              sets: ex.sets.map((s, j) => {
                if (j !== setIndex) return s;
                const marcas = [...(s.clusters ?? [])];
                while (marcas.length <= blockIndex) marcas.push('');
                marcas[blockIndex] = value;
                return { ...s, clusters: marcas };
              }),
            }
          : ex
      )
    );
  };

  /** Descanso corto entre bloques de un clúster, el que fija el entrenador. */
  const descansoDeBloque = (segundos: number, exName: string) => {
    if (!startedAt.current) startedAt.current = Date.now();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    startRest(segundos, `Ahora: siguiente bloque · ${exName}`);
  };

  // Nota escrita del alumno sobre un ejercicio (p. ej. "hice la variante X").
  const updateExerciseNote = (exerciseIndex: number, value: string) => {
    setLog((prev) =>
      prev.map((ex, i) => (i === exerciseIndex ? { ...ex, notes: value } : ex))
    );
  };

  /**
   * Esfuerzo del ejercicio (RIR). Se puede desmarcar volviendo a pulsar: si no
   * se puede quitar un dato que se ha metido sin querer, la gente deja de
   * meterlo.
   */
  const updateExerciseRir = (exerciseIndex: number, value: number) => {
    setLog((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex ? { ...ex, rir: ex.rir === value ? undefined : value } : ex
      )
    );
  };

  // El esfuerzo solo se le pregunta a quien sabe contestarlo: al atleta
  // siempre (se autoentrena) y al alumno que su entrenador haya marcado. A
  // quien empieza, el RIR no le suena y lo rellenaría al azar.
  const pideRir = profile?.role === 'athlete' || profile?.trackRir === true;

  const totalSets = log.reduce((acc, ex) => acc + ex.sets.length, 0);
  const doneSets = log.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0);
  // Índice visible en el modo enfocado (acotado por si la lista cambió).
  const safeIndex = Math.min(viewIndex, Math.max(0, log.length - 1));
  const isLastExercise = safeIndex >= log.length - 1;

  // ¿Ya se ha entrenado HOY (rutina semanal, ciclo o Sensaciones)? Si hay una
  // sesión guardada hoy y no hay otra en curso, mostramos "entrenamiento
  // terminado" con estadísticas y compartir, sin dejar entrenar de nuevo hasta
  // el día siguiente.
  const completedTodayLog = routine
    ? history.find((l) => l.routineId === routine.id && isSameDay(l.date))
    : undefined;
  const inProgress = doneSets > 0 || restored;
  // En Sensaciones, "flexAgain" permite ignorar la tarjeta de completado para
  // encadenar un segundo entreno el mismo día.
  const showCompleted = !!completedTodayLog && !inProgress && !(isFlex && flexAgain);

  // Lo que se toca una vez al mes vive detrás del punto de la cabecera, no
  // ocupando dos filas encima de la primera serie.
  const accionesSesion: AccionRapida[] = [
    ...(routine?.schedule === 'cycle'
      ? ([
          {
            icono: 'refresh' as const,
            texto: todaySession.cycleLabel
              ? `Reiniciar ciclo (hoy: ${todaySession.cycleLabel})`
              : 'Reiniciar ciclo',
            onPress: () => {
              handleStartCycleToday();
            },
          },
          {
            icono: 'calendar-outline' as const,
            texto: 'Fijar el día de hoy',
            onPress: () => setDayPickerOpen(true),
          },
        ] satisfies AccionRapida[])
      : []),
    ...(isFlex && combinedDay
      ? ([
          {
            icono: 'close-circle-outline' as const,
            texto: 'Cancelar este entreno',
            onPress: cancelFlexSession,
            peligro: true,
          },
        ] satisfies AccionRapida[])
      : []),
  ];

  const handleSave = async () => {
    if (!profile || !routine || !day) return;
    setSaving(true);
    setSaveError(null);
    try {
      const durationMin = startedAt.current
        ? Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))
        : 0;
      // Si no marcó ninguna serie, damos la sesión por hecha igualmente (para
      // que cuente): marcamos todas las series como completadas.
      const baseLog =
        doneSets > 0
          ? log
          : log.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s, completed: true })) }));
      // Sella la medida ACTUAL de cada ejercicio para que el histórico y las
      // estadísticas la interpreten bien años después, aunque el entrenador
      // cambie la ficha del ejercicio. Manda la del plan; si no la trae, la de
      // la biblioteca; y si tampoco, reps.
      const finalLog: LoggedExercise[] = baseLog.map((ex) => {
        const candidata = ex.measure ?? measureByExercise[ex.exerciseId];
        const measure: ExerciseMeasure = EXERCISE_MEASURES.includes(
          candidata as ExerciseMeasure
        )
          ? (candidata as ExerciseMeasure)
          : 'reps';
        return { ...ex, measure };
      });
      const prs = detectNewPRs(history, finalLog);
      const totals = sessionTotals(finalLog);
      // Logros que estaban desbloqueados antes de esta sesión (base entrenos).
      const beforeUnlocked = new Set(
        computeAchievements(history, []).filter((a) => a.unlocked).map((a) => a.id)
      );

      const payload = {
        trainerId: routine.trainerId,
        clientId: profile.uid,
        routineId: routine.id,
        routineName: routine.name,
        dayName: day.name,
        // Si estamos rellenando el entreno de otro día, se registra con SU fecha.
        date: resumeDate ?? Date.now(),
        exercises: finalLog,
        ...(durationMin > 0 ? { durationMin } : {}),
      };

      let freshLogs: WorkoutLog[];
      let savedOffline = false;
      try {
        await createWorkoutLog(payload);
        freshLogs = await getWorkoutLogsForClient(profile.uid);
        syncMySocialStats(
          profile,
          freshLogs,
          prs.length > 0
            ? { exerciseName: prs[0].exerciseName, label: prs[0].label, date: Date.now() }
            : undefined
        ).catch(() => {});
        // Aviso al coach en tiempo real (nunca bloquea el guardado).
        notifyUser(
          routine.trainerId,
          'Sesión completada',
          `${profile.name.split(' ')[0]} ha terminado ${day.name} (${totals.sets} series${
            prs.length > 0 ? `, ${prs.length} récord${prs.length > 1 ? 's' : ''}` : ''
          }).`
        ).catch(() => {});
      } catch {
        // Sin conexión (o Firestore caído): el entreno se encola en el
        // dispositivo y se subirá solo. La sesión NUNCA se pierde.
        await enqueueWorkout(payload);
        savedOffline = true;
        freshLogs = [
          { id: `pending-${Date.now()}`, ...payload, createdAt: Date.now() } as WorkoutLog,
          ...history,
        ];
      }
      const newAchievements = computeAchievements(freshLogs, []).filter(
        (a) => a.unlocked && !beforeUnlocked.has(a.id)
      );
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      stopRest();
      if (profile) {
        AsyncStorage.removeItem(draftKey(profile.uid)).catch(() => {});
        AsyncStorage.removeItem(pendingKey(profile.uid)).catch(() => {});
        clearActiveSession(profile.uid);
      }
      remoteDraftRef.current = null;
      if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
      setRestored(false);
      setResumeDate(null);
      setPastDraft(null);
      setPastDismissed(false);
      setFlexAgain(false); // consumido: tras guardar vuelve la tarjeta de completado
      // Limpia el "día combinado" de Sensaciones para que no contamine la
      // próxima sesión (evita que un entreno futuro herede este nombre).
      setCombinedDay(null);
      // Deja el estado detrás del resumen "limpio": el día queda como completado
      // (doneSets 0), de modo que nunca se vuelven a mostrar sus ejercicios.
      if (day) setLog(buildLog(day));
      setViewIndex(0);
      startedAt.current = null;
      setSummary({
        durationMin,
        ...totals,
        prs,
        streak: currentStreak(freshLogs, {
          routine,
          cycleAnchor,
          restDays: profile?.flexRestDays,
        }),
        newAchievements,
      });
      if (savedOffline) {
        showToast('Sin conexión: la sesión se subirá sola al recuperarla');
      } else if (newAchievements.length > 0) {
        showToast(`¡Logro desbloqueado: ${newAchievements[0].title}!`);
      }
      setHistory(freshLogs);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar la sesión.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!routine || routine.days.length === 0) {
    return (
      <ScreenContainer>
        <Pressable
          onPress={() => router.push('/(client)/dashboard')}
          style={styles.exitBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
          <Text style={styles.exitText}>Volver a inicio</Text>
        </Pressable>
        <Text style={styles.title}>Mi entrenamiento</Text>
        <EmptyState
          icon="barbell-outline"
          title="Sin rutina asignada"
          subtitle="Tu entrenador todavía no te ha asignado una rutina. Vuelve a comprobarlo pronto."
        />
      </ScreenContainer>
    );
  }

  // ---------- Resumen post-entreno ----------
  if (summary) {
    return (
      <ScreenContainer contentStyle={styles.summaryContent}>
        <Confetti />
        <PopIn style={{ alignSelf: 'center' }}>
          <View style={styles.summaryBadge}>
            <Ionicons name="checkmark" size={44} color={colors.onPrimary} />
          </View>
        </PopIn>
        <FadeIn delay={150}>
          <Text style={styles.summaryTitle}>¡Entrenamiento completado!</Text>
          <Text style={styles.summarySubtitle}>
            {routine.name} · {day?.name}
          </Text>
        </FadeIn>

        <FadeIn delay={300} style={styles.summaryTiles}>
          {summary.durationMin > 0 ? (
            <View style={styles.tileHalf}>
              <StatTile icon="time" value={`${summary.durationMin} min`} label="Duración" />
            </View>
          ) : null}
          <View style={styles.tileHalf}>
            <StatTile icon="layers" value={`${summary.sets}`} label="Series" />
          </View>
          <View style={styles.tileHalf}>
            <StatTile icon="repeat" value={`${summary.reps}`} label="Reps" />
          </View>
          {summary.seconds > 0 ? (
            <View style={styles.tileHalf}>
              <StatTile icon="hourglass" value={`${summary.seconds}s`} label="Isométrico" />
            </View>
          ) : null}
          {summary.volumeKg > 0 ? (
            <View style={styles.tileHalf}>
              <StatTile
                icon="barbell"
                value={`${summary.volumeKg.toLocaleString('es-ES')} kg`}
                label="Volumen"
              />
            </View>
          ) : null}
        </FadeIn>

        {summary.prs.length > 0 ? (
          <FadeIn delay={450}>
          <Card accent style={styles.prCard}>
            <View style={styles.prHeader}>
              <Ionicons name="trophy" size={18} color={colors.primary} />
              <Text style={styles.prTitle}>
                {summary.prs.length === 1 ? 'Nuevo récord personal' : 'Nuevos récords personales'}
              </Text>
            </View>
            {summary.prs.map((pr) => (
              <View key={pr.exerciseName} style={styles.prRow}>
                <Text style={styles.prExercise}>{pr.exerciseName}</Text>
                <Text style={styles.prLabel}>{pr.label}</Text>
              </View>
            ))}
            <Button
              title="Compartir récord"
              variant="secondary"
              onPress={handleShareRecord}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
          </FadeIn>
        ) : null}

        {summary.newAchievements.length > 0 ? (
          <FadeIn delay={550}>
            <Card accent style={styles.prCard}>
              <View style={styles.prHeader}>
                <Ionicons name="medal" size={18} color={colors.primary} />
                <Text style={styles.prTitle}>
                  {summary.newAchievements.length === 1
                    ? 'Logro desbloqueado'
                    : 'Logros desbloqueados'}
                </Text>
              </View>
              {summary.newAchievements.map((a) => (
                <View key={a.id} style={styles.prRow}>
                  <View style={styles.achRow}>
                    <Ionicons
                      name={a.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.prExercise}>{a.title}</Text>
                  </View>
                  <Text style={styles.achDesc}>{a.description}</Text>
                </View>
              ))}
            </Card>
          </FadeIn>
        ) : null}

        {summary.streak > 1 ? (
          (() => {
            // Los hitos se celebran aparte: una racha de 30 días no puede
            // anunciarse con la misma frase que una de 3. Los números son los
            // que la gente cuenta de verdad (una semana, un mes, cien días).
            const HITOS = [7, 14, 30, 50, 100, 200, 365];
            const hito = HITOS.includes(summary.streak) ? summary.streak : null;
            return (
              <View style={[styles.streakRow, hito ? styles.streakMilestone : null]}>
                <Ionicons
                  name="flame"
                  size={hito ? 22 : 18}
                  color={hito ? colors.primaryBright : colors.primary}
                />
                <Text style={[styles.streakText, hito ? styles.streakTextBig : null]}>
                  {hito === 7
                    ? 'Una semana seguida entrenando.'
                    : hito === 30
                      ? '¡Un mes entero de racha!'
                      : hito === 365
                        ? 'Un año. Trescientos sesenta y cinco días.'
                        : hito
                          ? `¡${hito} días de racha!`
                          : `Racha de ${summary.streak} días. Sigue así.`}
                </Text>
              </View>
            );
          })()
        ) : null}

        <Text style={styles.completedNote}>
          Guardado en tu progreso · pestaña Entrenos
        </Text>
        <Button
          title="Compartir mi sesión"
          onPress={handleShareSummary}
          style={{ marginTop: spacing.md }}
        />
        <Button
          title="Ir a inicio"
          onPress={() => router.push('/(client)/dashboard')}
          style={{ marginTop: spacing.sm }}
        />
      </ScreenContainer>
    );
  }

  // ---------- Modo entreno ----------
  return (
    <ScreenContainer contentStyle={activeRest ? styles.restSpacer : undefined}>
      {prVivo ? (
        <PRBurst
          key={`${prVivo.exerciseId}-${prVivo.label}`}
          exerciseName={prVivo.exerciseName}
          label={prVivo.label}
          previous={prVivo.previous}
          onDone={() => setPrVivo(null)}
        />
      ) : null}

      <SessionHeader
        titulo={routine.name}
        dia={day && !showCompleted ? day.name : null}
        intensidad={showCompleted ? null : textoIntensidad(day, routine.schedule)}
        hechas={doneSets}
        totales={showCompleted ? 0 : totalSets}
        acciones={accionesSesion}
        onSalir={() => {
          // Con la sesión en marcha no se sale a la ligera: confirmación.
          if (inProgress) setExitConfirmOpen(true);
          else router.push('/(client)/dashboard');
        }}
      />

      {/* Entreno de un día anterior sin finalizar: rellenarlo o dejarlo para luego. */}
      {pastDraft && !pastDismissed && !restored ? (
        <FadeIn>
          <View style={styles.pastDraftCard}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pastDraftTitle}>Tienes un entreno sin terminar</Text>
              <Text style={styles.pastDraftSub}>
                {mayusculaInicial(
                  `${pastDraft.dayName ? `${pastDraft.dayName} · ` : ''}${new Date(
                    pastDraft.startedAt ?? pastDraft.savedAt
                  ).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })}`
                )}
              </Text>
            </View>
            <View style={styles.pastDraftActions}>
              <Pressable onPress={resumePastDraft} style={styles.pastDraftFill} hitSlop={6}>
                <Text style={styles.pastDraftFillText}>Rellenar datos</Text>
              </Pressable>
              <Pressable onPress={dismissPastDraft} hitSlop={6}>
                <Text style={styles.pastDraftLater}>Más tarde</Text>
              </Pressable>
            </View>
          </View>
        </FadeIn>
      ) : null}

      <Modal
        visible={exitConfirmOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setExitConfirmOpen(false)}
      >
        <View style={styles.exitBackdrop}>
          <Card accent style={styles.exitCard}>
            <Ionicons name="barbell" size={26} color={colors.primary} style={{ alignSelf: 'center' }} />
            <Text style={styles.exitTitle}>Estás entrenando</Text>
            <Text style={styles.exitMsg}>
              Termina tu sesión antes de salir: tu progreso lo merece. Si sales, la sesión queda
              guardada y podrás retomarla.
            </Text>
            <Button
              title="Seguir entrenando"
              onPress={() => setExitConfirmOpen(false)}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Salir (emergencia)"
              variant="ghost"
              onPress={() => {
                setExitConfirmOpen(false);
                router.push('/(client)/dashboard');
              }}
              style={{ marginTop: spacing.xs }}
            />
          </Card>
        </View>
      </Modal>

      {isFlex ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
          {routine.days.map((d, i) => {
            const isCycle = routine.schedule === 'cycle';
            const isToday = isCycle
              ? todaySession.cycleIndex === i
              : d.weekday === todayWeekday();
            return (
              <Pressable
                key={d.id}
                onPress={() => {
                  setSelectedDayId(d.id);
                  // Tocar un día resuelve el descanso opcional: se entrena ese día.
                  setOptionalResolved(true);
                  setRestingToday(false);
                }}
                style={[styles.dayTab, selectedDayId === d.id && styles.dayTabSelected]}
              >
                <Text
                  style={[styles.dayTabText, selectedDayId === d.id && styles.dayTabTextSelected]}
                >
                  {isCycle
                    ? `Día ${i + 1}`
                    : `${d.weekday !== undefined ? `${WEEKDAY_NAMES[d.weekday].slice(0, 3)} · ` : ''}${d.name}`}
                  {d.optionalRest ? ' · descanso opcional' : d.isRest ? ' · descanso' : ''}
                  {isToday ? '  ·  HOY' : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {!showCompleted && isFlex && flexResting ? (
        <FadeIn>
          <Card accent style={styles.optionalCard}>
            <View style={styles.optionalHeader}>
              <Ionicons name="bed" size={18} color={colors.primary} />
              <Text style={styles.optionalTitle}>Día de descanso</Text>
            </View>
            <Text style={styles.optionalText}>
              Hoy descansas. No cuenta contra tu racha. Vuelve mañana con todo.
            </Text>
            <Button
              title="Mejor entrenar"
              variant="secondary"
              onPress={() => {
                setFlexResting(false);
                // Deshace el descanso persistido para que no reaparezca al volver.
                if (profile) removeFlexRestDay(profile.uid, startOfDayLocal(Date.now())).catch(() => {});
              }}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </FadeIn>
      ) : !showCompleted && isFlex && !combinedDay ? (
        <FadeIn>
          <Card accent style={styles.optionalCard}>
            <View style={styles.optionalHeader}>
              <Ionicons name="options-outline" size={18} color={colors.primary} />
              <Text style={styles.optionalTitle}>{flexLabel(routine.scheduleLabel)}</Text>
            </View>
            <Text style={styles.optionalText}>
              ¿Cómo te sientes hoy? Marca una o varias rutinas (en el orden que quieras hacerlas):
            </Text>
            {routine.days.map((d) => {
              const pos = flexSelection.indexOf(d.id);
              const on = pos >= 0;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => toggleFlexRoutine(d.id)}
                  style={[styles.flexPick, on && styles.flexPickOn]}
                >
                  <View style={[styles.flexCheck, on && styles.flexCheckOn]}>
                    {on ? <Text style={styles.flexCheckNum}>{pos + 1}</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.flexPickText, on && styles.flexPickTextOn]}>
                      {d.name || 'Rutina'}
                      {d.exercises.length ? ` · ${d.exercises.length} ejercicios` : ''}
                    </Text>
                    {/* Lo que va a pedir esa rutina, ANTES de elegirla: es
                        justo el dato sobre el que se decide "cómo me siento
                        hoy", y hasta ahora no estaba en ninguna parte. */}
                    {d.intensityPct ? (
                      <Text style={styles.flexPickPct}>
                        {esfuerzoDePct(d.intensityPct)} · {d.intensityPct} %
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            <Button
              title={
                flexSelection.length > 1
                  ? `Empezar (${flexSelection.length} rutinas)`
                  : 'Empezar'
              }
              onPress={startFlexSession}
              disabled={flexSelection.length === 0}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Hoy descanso"
              variant="ghost"
              onPress={chooseFlexRest}
              style={{ marginTop: spacing.xs }}
            />

            {/* Últimos 7 días para saber qué te toca hoy. */}
            <View style={styles.flexHistory}>
              <Text style={styles.flexHistoryLabel}>Tus últimos 7 días</Text>
              {last7FlexDays.map((h) => (
                <View key={h.ts} style={styles.flexHistoryRow}>
                  <Text style={styles.flexHistoryDate}>{h.label}</Text>
                  <Text style={styles.flexHistoryWhat}>{h.what}</Text>
                </View>
              ))}
            </View>
          </Card>
        </FadeIn>
      ) : null}

      {/* Fijar qué día del ciclo es HOY (plan desactualizado o día pospuesto). */}
      <Modal
        visible={dayPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDayPickerOpen(false)}
      >
        <View style={styles.dayPickerBackdrop}>
          <View style={styles.dayPickerSheet}>
            <View style={styles.dayPickerHeader}>
              <Text style={styles.dayPickerTitle}>¿Qué día del plan es hoy?</Text>
              <Pressable onPress={() => setDayPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.dayPickerHint}>
              Si pospusiste un entreno o el plan va desfasado, elige el día que te toca hoy y toda
              la programación se recoloca desde ahí.
            </Text>
            {routine.days.map((d, i) => (
              <Button
                key={d.id}
                title={`Día ${i + 1}${d.name ? ` · ${d.name}` : ''}${d.isRest ? ' (descanso)' : ''}`}
                variant={todaySession.cycleIndex === i ? 'primary' : 'secondary'}
                onPress={() => handleSetTodayIndex(i)}
                style={{ marginTop: spacing.sm }}
              />
            ))}
          </View>
        </View>
      </Modal>

      {showOptionalChoice ? (
        <FadeIn>
          <Card accent style={styles.optionalCard}>
            <View style={styles.optionalHeader}>
              <Ionicons name="shuffle" size={18} color={colors.primary} />
              <Text style={styles.optionalTitle}>Hoy: descanso opcional</Text>
            </View>
            <Text style={styles.optionalText}>
              {todaySession.cycleLabel ? `${todaySession.cycleLabel}. ` : ''}Puedes descansar hoy, o
              reiniciar el ciclo y entrenar el Día 1 ahora. Tú decides.
            </Text>
            <Button
              title="Entrenar Día 1 ahora"
              onPress={handleStartCycleToday}
              style={{ marginTop: spacing.sm }}
            />
            <Button
              title="Descansar hoy"
              variant="secondary"
              onPress={() => {
                setOptionalResolved(true);
                setRestingToday(true);
              }}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </FadeIn>
      ) : showRestingCard ? (
        <FadeIn>
          <Card accent style={styles.optionalCard}>
            <View style={styles.optionalHeader}>
              <Ionicons name="bed" size={18} color={colors.primary} />
              <Text style={styles.optionalTitle}>Día de descanso</Text>
            </View>
            <Text style={styles.optionalText}>
              Disfruta tu descanso. El ciclo continuará solo con el Día 1.
            </Text>
            <Button
              title="He cambiado de idea: entrenar Día 1"
              variant="secondary"
              onPress={handleStartCycleToday}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </FadeIn>
      ) : day?.isRest ? (
        // Día de descanso normal: solo informa. No hay nada que completar y
        // no afecta a la racha (la racha cuenta días entrenados).
        <FadeIn>
          <Card accent style={styles.optionalCard}>
            <View style={styles.optionalHeader}>
              <Ionicons name="bed" size={18} color={colors.primary} />
              <Text style={styles.optionalTitle}>Día de descanso</Text>
            </View>
            <Text style={styles.optionalText}>
              Hoy toca recuperar: el descanso también es parte del entrenamiento. No tienes que
              marcar nada.
            </Text>
          </Card>
        </FadeIn>
      ) : showCompleted && completedTodayLog ? (
        (() => {
          const t = sessionTotals(completedTodayLog.exercises, measureByExercise);
          return (
            <FadeIn>
              <Card accent style={styles.completedCard}>
                <PopIn style={{ alignSelf: 'center' }}>
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark" size={38} color={colors.onPrimary} />
                  </View>
                </PopIn>
                <Text style={styles.completedTitle}>Entrenamiento terminado</Text>
                <Text style={styles.completedSubtitle}>
                  {completedTodayLog.routineName || routine.name}
                  {completedTodayLog.dayName ? ` · ${completedTodayLog.dayName}` : ''}
                </Text>
                <View style={styles.completedTiles}>
                  {completedTodayLog.durationMin ? (
                    <View style={styles.tileHalf}>
                      <StatTile
                        icon="time"
                        value={`${completedTodayLog.durationMin} min`}
                        label="Duración"
                      />
                    </View>
                  ) : null}
                  <View style={styles.tileHalf}>
                    <StatTile icon="layers" value={`${t.sets}`} label="Series" />
                  </View>
                  <View style={styles.tileHalf}>
                    <StatTile icon="repeat" value={`${t.reps}`} label="Reps" />
                  </View>
                  {t.seconds > 0 ? (
                    <View style={styles.tileHalf}>
                      <StatTile icon="hourglass" value={`${t.seconds}s`} label="Isométrico" />
                    </View>
                  ) : null}
                  {t.volumeKg > 0 ? (
                    <View style={styles.tileHalf}>
                      <StatTile
                        icon="barbell"
                        value={`${t.volumeKg.toLocaleString('es-ES')} kg`}
                        label="Volumen"
                      />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.completedNote}>
                  Guardado en tu progreso · pestaña Entrenos. Vuelve mañana para tu próxima sesión.
                </Text>
                <Button
                  title="Compartir sesión"
                  onPress={() => handleShareCompleted(completedTodayLog)}
                  style={{ marginTop: spacing.md }}
                />
                <Button
                  title="Ver mi progreso"
                  variant="secondary"
                  onPress={() => router.push('/(client)/progress')}
                  style={{ marginTop: spacing.sm }}
                />
                <Button
                  title="Ir a inicio"
                  variant="ghost"
                  onPress={() => router.push('/(client)/dashboard')}
                  style={{ marginTop: spacing.sm }}
                />
                {isFlex ? (
                  <Pressable
                    onPress={() => {
                      setCombinedDay(null);
                      setFlexSelection([]);
                      setFlexResting(false);
                      setFlexAgain(true);
                    }}
                    style={styles.againLink}
                    hitSlop={8}
                  >
                    <Ionicons name="add-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.againLinkText}>Hacer otro entrenamiento hoy</Text>
                  </Pressable>
                ) : null}
              </Card>
            </FadeIn>
          );
        })()
      ) : isFlex && (!combinedDay || flexResting) ? null : (
      <>
      {/* El cuánto llevas lo dice el anillo de la cabecera; aquí solo queda el
          salto entre ejercicios, que es navegación y no información. */}
      {totalSets > 0 && log.length > 1 ? (
        <View style={styles.exDotsRow}>
          {log.map((ex, i) => {
            const exDone = ex.sets.length > 0 && ex.sets.every((s) => s.completed);
            const current = i === safeIndex;
            return (
              <Pressable
                key={i}
                onPress={() => setViewIndex(i)}
                hitSlop={8}
                style={[styles.exDot, exDone && styles.exDotDone, current && styles.exDotCurrent]}
              />
            );
          })}
        </View>
      ) : null}

      {restored ? (
        <View style={styles.restoredBanner}>
          <Ionicons name="refresh-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.restoredText}>Sesión anterior recuperada</Text>
          <Pressable onPress={discardDraft} hitSlop={6}>
            <Text style={styles.restoredAction}>Empezar de cero</Text>
          </Pressable>
        </View>
      ) : null}

      {safeIndex === 0 && doneSets === 0 && day && !day.isRest ? (
        <View style={styles.warmupCard}>
          <Pressable onPress={() => setWarmupOpen((o) => !o)} style={styles.warmupHead} hitSlop={6}>
            <Ionicons name="flame-outline" size={15} color={colors.primary} />
            <Text style={styles.warmupTitle}>Calentamiento</Text>
            <Ionicons
              name={warmupOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>
          {warmupOpen ? (
            <View style={styles.warmupList}>
              {[
                'Cardio suave · 5 min',
                'Movilidad con gomas y activación',
                day.approachesNote?.trim()
                  ? `Aproximaciones · ${day.approachesNote.trim()}`
                  : 'Aproximaciones (series progresivas hacia tu peso de trabajo)',
              ].map((item, i) => (
                <View key={i} style={styles.warmupStep}>
                  <View style={styles.warmupNum}>
                    <Text style={styles.warmupNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.warmupText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {day && !day.isRest && day.showIntervalTimer ? (
        <View style={styles.warmupCard}>
          <Pressable
            onPress={() => setIntervalOpen((o) => !o)}
            style={styles.warmupHead}
            hitSlop={6}
          >
            <Ionicons name="timer-outline" size={15} color={colors.primary} />
            <Text style={styles.warmupTitle}>Temporizador de intervalos</Text>
            <Ionicons
              name={intervalOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>
          {intervalOpen ? (
            <View style={{ marginTop: spacing.sm }}>
              <IntervalTimer />
            </View>
          ) : null}
        </View>
      ) : null}

      {(() => {
        const exerciseIndex = safeIndex;
        const exercise = log[exerciseIndex];
        if (!exercise) return null;
        const prev = lastPerf[exercise.exerciseId];
        const planned = day?.exercises[exerciseIndex];
        const isDone = exercise.sets.length > 0 && exercise.sets.every((s) => s.completed);
        // Carga del ejercicio: define si hay casilla extra (peso/goma) o ninguna.
        const load = planned ? resolveLoad(planned) : 'none';
        // Medida real: isométrico (segundos) si CUALQUIER fuente lo indica —la
        // biblioteca actual del coach, la copia de la rutina o el registro—. Así
        // una plancha marcada como segundos nunca se muestra como reps.
        // La medida que manda: la del plan si la trae, si no la del registro y,
        // en último caso, la de la biblioteca del entrenador.
        const medida =
          planned?.measure ?? exercise.measure ?? measureByExercise[exercise.exerciseId];
        const isSeconds = isHoldMeasure(medida);
        // Combo: la serie combina repeticiones Y aguante, así que lleva una
        // casilla extra de segundos junto a la de reps.
        const isCombo = medida === 'combo';
        // Por lados: la segunda casilla es el otro brazo, no otra cosa.
        const isDual = isDualMeasure(medida);
        // Clúster: la serie se hace en bloques con una pausa mínima, así que
        // lleva una casilla por bloque y un botón para ese descanso corto.
        const cluster = planned?.cluster;
        const bloques = cluster ? clusterBlocks(cluster) : 1;
        const categoriaEjercicio = [
          planned?.muscleGroup ?? muscleByExercise[exercise.exerciseId],
          planned?.subgroup,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <FadeIn key={exercise.exerciseId + exerciseIndex}>
          <Card accent style={[styles.exerciseCard, isDone && styles.exerciseCardDone]}>
            {planned?.supersetWithPrevious ? (
              <View style={styles.supersetRow}>
                <Ionicons name="link" size={12} color={colors.primaryBright} />
                <Text style={styles.supersetText}>SUPERSERIE con el anterior — sin descanso</Text>
              </View>
            ) : null}
            <View style={styles.exerciseHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.exerciseName, styles.exerciseNameCurrent]}>
                  {exercise.name}
                </Text>
                {/* Categoría y subgrupo bajo el nombre: entrenando, dos
                    ejercicios que se llaman parecido solo se distinguen así
                    ("Dominadas · Tirón · Aguantes"). Viene del plan, y si es
                    de antes de que se guardara ahí, de la biblioteca. */}
                {categoriaEjercicio ? (
                  <Text style={styles.exerciseCategory}>{categoriaEjercicio}</Text>
                ) : null}
              </View>
              {isDone ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              ) : null}
            </View>
            {planned ? (
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>
                    {planned.sets} × {planned.reps}
                    {isSeconds ? 's' : ''}
                  </Text>
                </View>
                {planned.rir !== undefined && planned.rir !== null ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>RIR {planned.rir}</Text>
                  </View>
                ) : null}
                {planned.restSeconds ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      Descanso {formatRest(planned.restSeconds)}
                    </Text>
                  </View>
                ) : null}
                {load === 'assisted' ? (
                  <View style={[styles.metaChip, styles.metaChipBand]}>
                    <Text style={styles.metaChipText}>Con goma</Text>
                  </View>
                ) : load === 'weighted' ? (
                  <View style={[styles.metaChip, styles.metaChipWeighted]}>
                    <Text style={[styles.metaChipText, styles.metaChipWeightedText]}>
                      Lastrado
                    </Text>
                  </View>
                ) : null}
                {planned?.grip ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      Agarre {GRIP_LABEL[planned.grip].toLowerCase()}
                    </Text>
                  </View>
                ) : null}
                {planned?.goal ? (
                  <View style={[styles.metaChip, styles.metaChipBand]}>
                    <Text style={styles.metaChipText}>Objetivo: {planned.goal}</Text>
                  </View>
                ) : null}
                {cluster ? (
                  <View style={[styles.metaChip, styles.metaChipCluster]}>
                    <Text style={styles.metaChipText}>
                      Clúster {bloques} bloques · {cluster.restSeconds}s
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {planned?.notes ? <Text style={styles.coachNotes}>{planned.notes}</Text> : null}
            {videoByExercise[exercise.exerciseId] ? (
              <>
                <Pressable
                  onPress={() =>
                    setVideoOpenIndex(videoOpenIndex === exerciseIndex ? null : exerciseIndex)
                  }
                  style={styles.videoLink}
                  hitSlop={4}
                >
                  <Ionicons
                    name={videoOpenIndex === exerciseIndex ? 'chevron-up' : 'play-circle-outline'}
                    size={15}
                    color={colors.primary}
                  />
                  <Text style={styles.videoLinkText}>
                    {videoOpenIndex === exerciseIndex ? 'Ocultar técnica' : 'Ver técnica'}
                  </Text>
                </Pressable>
                {videoOpenIndex === exerciseIndex ? (
                  <View style={{ marginBottom: spacing.sm }}>
                    <VideoPlayer url={videoByExercise[exercise.exerciseId]} />
                  </View>
                ) : null}
              </>
            ) : null}
            {prev ? (
              <View style={styles.prevRow}>
                <Ionicons name="time-outline" size={13} color={colors.primary} />
                <Text style={styles.prevText}>
                  Última vez: {load !== 'none' && prev.weight ? `${prev.weight} kg × ` : ''}
                  {prev.reps ?? '—'} {isSeconds ? 's' : 'reps'}
                </Text>
              </View>
            ) : null}
            <View style={styles.setHead}>
              <Text style={styles.setHeadCap}>
                {cluster
                  ? 'BLOQUE 1'
                  : isDual
                    ? isSeconds
                      ? 'IZQ. S'
                      : 'IZQ.'
                    : isSeconds
                      ? 'SEGUNDOS'
                      : 'REPS'}
              </Text>
              {cluster
                ? Array.from({ length: bloques - 1 }, (_, b) => (
                    <Text key={b} style={styles.setHeadCap}>
                      BLOQUE {b + 2}
                    </Text>
                  ))
                : null}
              {isCombo ? <Text style={styles.setHeadCap}>AGUANTE S</Text> : null}
              {isDual ? (
                <Text style={styles.setHeadCap}>{isSeconds ? 'DER. S' : 'DER.'}</Text>
              ) : null}
              {load === 'weighted' ? (
                <Text style={styles.setHeadCap}>PESO KG</Text>
              ) : load === 'assisted' ? (
                <Text style={styles.setHeadCap}>GOMA KG</Text>
              ) : null}
            </View>
            {exercise.sets.map((set, setIndex) => (
              <View key={setIndex} style={styles.setRow}>
                {/* El nombre de la serie también marca: es hueco muerto al lado
                    del círculo, y con las manos cansadas se falla menos cuanto
                    más grande es lo que hay que tocar. */}
                <View style={styles.setToggleWrap}>
                  <PressableScale
                    haptic
                    onPress={() => updateSet(exerciseIndex, setIndex, 'completed', !set.completed)}
                    style={styles.setToggle}
                    hitSlop={6}
                  >
                    <View style={[styles.checkButton, set.completed && styles.checkButtonDone]}>
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={set.completed ? colors.onPrimary : colors.textFaint}
                      />
                    </View>
                    <Text style={[styles.setLabel, set.completed && styles.setLabelDone]}>
                      Serie {setIndex + 1}
                    </Text>
                  </PressableScale>
                </View>
                <TextField
                  value={set.reps}
                  onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'reps', v)}
                  placeholder={planned?.reps || (isSeconds ? 'seg' : 'reps')}
                  keyboardType="numeric"
                  style={styles.setFieldInput}
                />
                {/* Un bloque más de la misma serie: se apunta lo que salió en
                    cada uno, que es justo lo que un clúster quiere medir. */}
                {cluster
                  ? Array.from({ length: bloques - 1 }, (_, b) => (
                      <TextField
                        key={b}
                        value={set.clusters?.[b] ?? ''}
                        onChangeText={(v) => updateCluster(exerciseIndex, setIndex, b, v)}
                        placeholder={planned?.reps || (isSeconds ? 'seg' : 'reps')}
                        keyboardType="numeric"
                        style={styles.setFieldInput}
                      />
                    ))
                  : null}
                {isCombo ? (
                  <TextField
                    value={set.seconds ?? ''}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'seconds', v)}
                    placeholder={planned?.seconds ? String(planned.seconds) : 'seg'}
                    keyboardType="numeric"
                    style={styles.setFieldInput}
                  />
                ) : isDual ? (
                  <TextField
                    value={set.side2 ?? ''}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'side2', v)}
                    placeholder={planned?.side2 || planned?.reps || (isSeconds ? 'seg' : 'reps')}
                    keyboardType="numeric"
                    style={styles.setFieldInput}
                  />
                ) : null}
                {load !== 'none' ? (
                  <TextField
                    value={set.weight}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'weight', v)}
                    // Precarga visual con el peso de la última vez: cero tecleo
                    // si repites carga (solo escribes si cambias de peso).
                    placeholder={prev?.weight || '—'}
                    keyboardType="decimal-pad"
                    style={styles.setFieldInput}
                  />
                ) : null}
              </View>
            ))}
            {cluster ? (
              <Pressable
                onPress={() => descansoDeBloque(cluster.restSeconds, exercise.name)}
                style={styles.clusterRestBtn}
                hitSlop={6}
              >
                <Ionicons name="timer-outline" size={15} color={colors.primary} />
                <Text style={styles.clusterRestText}>
                  Descanso entre bloques · {cluster.restSeconds}s
                </Text>
              </Pressable>
            ) : null}
            {isFlex ? (
              <View style={styles.setEditRow}>
                <Pressable onPress={() => removeSet(exerciseIndex)} style={styles.setEditBtn} hitSlop={6}>
                  <Ionicons name="remove" size={16} color={colors.textMuted} />
                  <Text style={styles.setEditText}>Quitar serie</Text>
                </Pressable>
                <Pressable onPress={() => addSet(exerciseIndex)} style={styles.setEditBtn} hitSlop={6}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={[styles.setEditText, { color: colors.primary }]}>Añadir serie</Text>
                </Pressable>
              </View>
            ) : null}
            {pideRir ? (
              <RirPicker
                value={exercise.rir}
                onChange={(v) => updateExerciseRir(exerciseIndex, v)}
              />
            ) : null}
            {noteOpenIndex === exerciseIndex || exercise.notes ? (
              <TextField
                value={exercise.notes ?? ''}
                onChangeText={(v) => updateExerciseNote(exerciseIndex, v)}
                placeholder="Ej. Hice la variante con goma, molestia en hombro..."
                style={styles.noteField}
              />
            ) : null}
            <Pressable
              onPress={() =>
                setNoteOpenIndex(noteOpenIndex === exerciseIndex ? null : exerciseIndex)
              }
              style={styles.noteBtn}
              hitSlop={6}
            >
              <Ionicons
                name={exercise.notes ? 'create' : 'create-outline'}
                size={13}
                color={colors.textMuted}
              />
              <Text style={styles.noteBtnText}>
                {exercise.notes ? 'Editar nota' : 'Añadir nota'}
              </Text>
            </Pressable>
          </Card>
          </FadeIn>
        );
      })()}

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

      {isLastExercise && doneSets === 0 ? (
        <Text style={styles.saveHint}>
          Marca cada serie con ✓, o pulsa “Terminar” para dar la sesión por hecha
          sin apuntar nada.
        </Text>
      ) : null}

      <View style={styles.navRow}>
        <Pressable
          onPress={() => setViewIndex((i) => Math.max(0, i - 1))}
          disabled={safeIndex === 0}
          style={[styles.navBtn, safeIndex === 0 && styles.navBtnDisabled]}
          hitSlop={6}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={safeIndex === 0 ? colors.textFaint : colors.text}
          />
          <Text style={[styles.navBtnText, safeIndex === 0 && styles.navBtnTextDisabled]}>
            Anterior
          </Text>
        </Pressable>

        {isLastExercise ? (
          <Button
            title={
              doneSets === 0
                ? 'Terminar (sin apuntar)'
                : doneSets < totalSets
                  ? `Terminar (${doneSets}/${totalSets})`
                  : 'Terminar sesión'
            }
            onPress={handleSave}
            loading={saving}
            style={{ flex: 1, marginLeft: spacing.sm }}
          />
        ) : (
          <Pressable
            onPress={() => setViewIndex((i) => Math.min(log.length - 1, i + 1))}
            style={[styles.navBtn, styles.navNext]}
            hitSlop={6}
          >
            <Text style={[styles.navBtnText, styles.navNextText]}>Siguiente</Text>
            <Ionicons name="chevron-forward" size={22} color={colors.onPrimary} />
          </Pressable>
        )}
      </View>
      </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  // Hueco al pie para que el crono flotante de descanso no tape la navegación.
  restSpacer: { paddingBottom: 210 },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  exitText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  dayTabs: { marginBottom: spacing.md },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  dayTabSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayTabText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  dayTabTextSelected: { color: colors.onPrimary },
  dayPickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  dayPickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  dayPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dayPickerTitle: { ...typography.h3, color: colors.text },
  dayPickerHint: { ...typography.small, color: colors.textMuted, lineHeight: 18 },
  exitBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.scrim,
  },
  exitCard: { paddingVertical: spacing.lg },
  flexPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.sm,
  },
  flexPickOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  flexCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexCheckOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  flexCheckNum: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.heading, fontSize: 12 },
  flexPickText: { ...typography.body, color: colors.textMuted, flex: 1 },
  flexPickPct: { ...typography.small, color: colors.primary, fontSize: 11, marginTop: 2 },
  flexPickTextOn: { color: colors.text, fontFamily: fonts.semiBold },
  flexHistory: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  flexHistoryLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  flexHistoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md, paddingVertical: 3 },
  flexHistoryDate: { ...typography.small, color: colors.textFaint, width: 74 },
  flexHistoryWhat: { ...typography.small, color: colors.textMuted, flex: 1, textAlign: 'right' },
  setEditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  setEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clusterRestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  clusterRestText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  setEditText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  exitTitle: { ...typography.h2, color: colors.text, textAlign: 'center', marginTop: spacing.sm },
  exitMsg: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  // Tira de puntos: un ejercicio por punto (dorado = hecho, aro = actual).
  exDotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  exDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  exDotCurrent: {
    width: 20,
    borderRadius: 4,
    borderColor: colors.primaryBright,
    backgroundColor: colors.primaryMuted,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  navBtnTextDisabled: { color: colors.textFaint },
  navNext: { flex: 1, backgroundColor: colors.primary, borderColor: colors.primary },
  navNextText: { color: colors.onPrimary },
  exerciseCard: { marginBottom: spacing.md },
  exerciseCardDone: { opacity: 0.55 },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  exerciseCategory: {
    ...typography.small,
    color: colors.primary,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  exerciseName: { ...typography.h3, color: colors.text, flex: 1 },
  exerciseNameCurrent: { color: colors.primaryBright },
  nowChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  nowChipText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 1.2,
    color: colors.primaryBright,
  },
  prevRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  prevText: { ...typography.small, color: colors.primary, fontFamily: fonts.medium },
  supersetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  supersetText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 1,
    color: colors.primaryBright,
  },
  restoredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  restoredText: { ...typography.small, color: colors.primaryBright, flex: 1 },
  pastDraftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  pastDraftTitle: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  pastDraftSub: { ...typography.small, color: colors.textMuted, fontSize: 11, marginTop: 1 },
  pastDraftActions: { alignItems: 'flex-end', gap: 4 },
  pastDraftFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  pastDraftFillText: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold, fontSize: 12 },
  pastDraftLater: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  warmupCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  warmupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  warmupTitle: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  warmupList: { marginTop: spacing.sm, gap: spacing.sm },
  warmupStep: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  warmupNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupNumText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, fontSize: 12 },
  warmupText: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 18 },
  restoredAction: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    textDecorationLine: 'underline',
  },
  saveError: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  saveHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  coachNotes: {
    ...typography.small,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  metaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaChipBand: { borderColor: colors.hairline, backgroundColor: colors.primaryMuted },
  metaChipCluster: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  // Lastre en azul (distinto de la goma dorada), sin emojis.
  metaChipWeighted: { borderColor: 'rgba(91,155,213,0.5)', backgroundColor: 'rgba(91,155,213,0.14)' },
  metaChipWeightedText: { color: '#7FB3E0' },
  metaChipText: { ...typography.small, color: colors.primaryBright, fontSize: 11, fontFamily: fonts.semiBold },
  videoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  videoLinkText: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    textDecorationLine: 'underline',
  },
  setHead: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginBottom: 4,
  },
  setHeadCap: {
    ...typography.small,
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.8,
    width: 66,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  // El flex vive fuera: PressableScale pone el estilo en su capa animada, no en
  // el Pressable, así que sin envoltorio la fila no reparte el espacio.
  setToggleWrap: { flex: 1 },
  setToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  setLabel: { ...typography.small, color: colors.text, flex: 1, fontFamily: fonts.semiBold },
  setLabelDone: { color: colors.textMuted },
  setFieldInput: {
    width: 66,
    marginBottom: 0,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
  noteField: { marginTop: spacing.sm, marginBottom: 0 },
  noteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  noteBtnText: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  checkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  checkButtonDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // ----- Descanso opcional (Día 7 TENA) -----
  optionalCard: { marginBottom: spacing.md },
  optionalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  optionalTitle: { ...typography.h3, color: colors.primaryBright },
  optionalText: { ...typography.small, color: colors.textMuted, lineHeight: 19 },
  // ----- Día ya completado hoy -----
  completedCard: { alignItems: 'stretch', marginBottom: spacing.md },
  completedBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.glowGold,
  },
  completedTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  completedSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  completedTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  tileHalf: { width: '48%' },
  completedNote: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  retrainLink: { alignSelf: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  retrainText: {
    ...typography.small,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  againLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  againLinkText: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  // ----- Resumen -----
  summaryContent: { flexGrow: 1, justifyContent: 'center' },
  summaryBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
    ...shadows.glowGold,
  },
  summaryTitle: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  summarySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  summaryTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    marginBottom: spacing.md,
  },
  prCard: { marginBottom: spacing.md },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  prTitle: { ...typography.h3, color: colors.primaryBright },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  prExercise: { ...typography.body, color: colors.text },
  prLabel: { ...typography.body, color: colors.primary, fontFamily: fonts.semiBold },
  achRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  achDesc: { ...typography.small, color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
  streakMilestone: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  streakTextBig: { ...typography.h3, color: colors.primaryBright },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  streakText: { ...typography.body, color: colors.textMuted },
});
