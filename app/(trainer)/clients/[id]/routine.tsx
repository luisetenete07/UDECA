import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { TextField } from '../../../../components/TextField';
import { DragList } from '../../../../components/DragList';
import { moveItem } from '../../../../lib/useDragReorder';
import { showToast } from '../../../../components/Toast';
import { useAuth } from '../../../../lib/auth-context';
import { createExercise, getExerciseLibrary } from '../../../../lib/firestore/exercises';
import {
  createRoutine,
  getActiveRoutineForClient,
  setActiveRoutine,
  updateRoutine,
} from '../../../../lib/firestore/routines';
import {
  createRoutineTemplate,
  deleteRoutineTemplate,
  getRoutineTemplatesForTrainer,
} from '../../../../lib/firestore/routineTemplates';
import { getClientsForTrainer, getUserProfile } from '../../../../lib/firestore/users';
import { notifyUser } from '../../../../lib/notifications';
import { flexLabel } from '../../../../lib/schedule';
import { generateRoutineDraft } from '../../../../lib/routineGenerator';
import { fonts, colors, radius, spacing, typography } from '../../../../lib/theme';
import {
  CLUSTER_DEFAULT,
  clusterBlocks,
  GRIP_LABEL,
  GRIP_TYPES,
  isDualMeasure,
  isHoldMeasure,
  MUSCLE_GROUPS,
  resolveLoad,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
  type ClusterConfig,
  type Exercise,
  type ExerciseLoad,
  type ExerciseMeasure,
  type GripType,
  type MuscleGroup,
  type RoutineDay,
  type RoutineExercise,
  type RoutineSchedule,
  type RoutineTemplate,
  type UserProfile,
} from '../../../../lib/types';

/** Variantes de carga elegibles al montar la rutina (por ejercicio del plan). */
const LOAD_OPTIONS: { key: ExerciseLoad; label: string }[] = [
  { key: 'none', label: 'Normal' },
  { key: 'weighted', label: 'Lastrado' },
  { key: 'assisted', label: 'Goma' },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Convierte el texto del descanso a segundos. Se escribe en MINUTOS
 * (admite decimales: "1.5" o "1,5" = 1 min 30 s). También acepta "mm:ss"
 * por si el coach lo escribe así.
 */
function parseClock(value: string): number {
  const t = value.trim().replace(',', '.');
  if (!t) return 0;
  if (t.includes(':')) {
    const [m, sec] = t.split(':');
    const mm = parseInt(m, 10) || 0;
    const ss = parseInt(sec, 10) || 0;
    return mm * 60 + ss;
  }
  const mins = parseFloat(t);
  if (Number.isNaN(mins) || mins < 0) return 0;
  return Math.round(mins * 60);
}

/** Formatea segundos como min:seg para el campo ("3:30" · vacío si no hay). */
function formatClock(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RoutineEditorScreen() {
  const { id: clientId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [name, setName] = useState('Rutina personalizada');
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pickerForDay, setPickerForDay] = useState<string | null>(null);
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [otherClients, setOtherClients] = useState<UserProfile[]>([]);
  const [copying, setCopying] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  // Filtros del selector de ejercicios: por categoría y, dentro de ella, por
  // subgrupo. Se guardan aquí y no en el modal para que al añadir varios
  // ejercicios del mismo bloque no haya que volver a elegir cada vez.
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroSubgrupo, setFiltroSubgrupo] = useState<string | null>(null);
  // Crear un ejercicio nuevo sin salir del selector (agiliza montar la rutina).
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  // La categoría del ejercicio nuevo es texto libre porque el entrenador puede
  // tener las suyas propias, no solo las de fábrica.
  const [newGroup, setNewGroup] = useState<string>('Empuje');
  const [newSubgroup, setNewSubgroup] = useState('');
  const [newMeasure, setNewMeasure] = useState<ExerciseMeasure>('reps');
  const [newLoad, setNewLoad] = useState<ExerciseLoad>('none');
  const [newVideo, setNewVideo] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [schedule, setSchedule] = useState<RoutineSchedule>('weekly');
  const [scheduleLabel, setScheduleLabel] = useState('Sensaciones');
  const [cycleStartDate, setCycleStartDate] = useState<number>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const [restText, setRestText] = useState<Record<string, string>>({});
  // Ejercicio pendiente de mover/copiar a otro día (abre el selector de día).
  const [movePicker, setMovePicker] = useState<{ dayId: string; ex: RoutineExercise } | null>(
    null
  );
  // Ejercicios con el recuadro de objetivo abierto (además de los que ya lo tienen).
  const [goalOpen, setGoalOpen] = useState<Record<string, boolean>>({});
  // Qué días están desplegados en el editor. Todos cerrados al entrar: con la
  // lista compacta se ve el plan completo de un vistazo y se abre solo el día
  // que se va a tocar.
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDayExpanded = (dayId: string) => {
    setExpandedDays((prev) => ({ ...prev, [dayId]: !prev[dayId] }));
  };

  // Nivel del alumno (para el borrador automático del copiloto).
  const [clientLevel, setClientLevel] = useState<
    import('../../../../lib/types').ExperienceLevel | undefined
  >(undefined);

  useEffect(() => {
    if (!clientId || !profile) return;
    (async () => {
      const [existing, library, clientProfile] = await Promise.all([
        getActiveRoutineForClient(clientId, profile.uid),
        getExerciseLibrary(profile.uid),
        getUserProfile(clientId).catch(() => null),
      ]);
      setExercises(library);
      setClientLevel(clientProfile?.level);
      if (existing) {
        setRoutineId(existing.id);
        setName(existing.name);
        setDays(existing.days);
        setSchedule(existing.schedule ?? 'weekly');
        if (existing.scheduleLabel) setScheduleLabel(flexLabel(existing.scheduleLabel));
        if (existing.cycleStartDate) setCycleStartDate(existing.cycleStartDate);
      } else {
        setDays([{ id: uid(), name: 'Día 1', exercises: [] }]);
      }
      setLoading(false);
    })();
  }, [clientId, profile]);

  // Copiloto: genera un borrador de rutina desde la biblioteca según el nivel
  // del alumno. Pide confirmación si hay días con contenido (los reemplaza).
  const handleGenerateDraft = async () => {
    if (exercises.length === 0) {
      showToast('Tu biblioteca está vacía: añade o importa ejercicios primero');
      return;
    }
    const hasContent = days.some((d) => d.exercises.length > 0);
    if (hasContent) {
      const ok =
        Platform.OS === 'web'
          ? // eslint-disable-next-line no-alert
            window.confirm('El borrador reemplazará los días actuales. ¿Continuar?')
          : await new Promise<boolean>((resolve) => {
              Alert.alert('Borrador automático', 'Reemplazará los días actuales. ¿Continuar?', [
                { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Generar', onPress: () => resolve(true) },
              ]);
            });
      if (!ok) return;
    }
    const draft = generateRoutineDraft({ library: exercises, level: clientLevel, schedule });
    setDays(draft);
    setExpandedDays(draft.length > 0 ? { [draft[0].id]: true } : {});
    showToast(
      `Borrador generado (nivel ${clientLevel ?? 'Intermedio'}) · revísalo y ajusta`
    );
  };

  const addDay = () => {
    const id = uid();
    setDays((prev) => [...prev, { id, name: `Día ${prev.length + 1}`, exercises: [] }]);
    setExpandedDays((prev) => ({ ...prev, [id]: true })); // el día nuevo se abre
  };

  const removeDay = (dayId: string) => {
    setDays((prev) => prev.filter((d) => d.id !== dayId));
  };

  // Mueve un día una posición arriba o abajo (reordenar la semana / el ciclo).

  // Duplica un día (con ids nuevos) justo debajo, para no rehacerlo.
  const duplicateDay = (dayId: string) => {
    const newId = uid();
    setDays((prev) => {
      const idx = prev.findIndex((d) => d.id === dayId);
      if (idx < 0) return prev;
      const src = prev[idx];
      const clone: RoutineDay = {
        ...src,
        id: newId,
        name: `${src.name} (copia)`,
        exercises: src.exercises.map((e) => ({ ...e, id: uid() })),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setExpandedDays((p) => ({ ...p, [newId]: true }));
    showToast('Día duplicado');
  };

  const updateDayName = (dayId: string, value: string) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, name: value } : d)));
  };

  // Marca/desmarca un día del ciclo como descanso (Método REIN TENA).
  const toggleRestDay = (dayId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, isRest: !d.isRest, optionalRest: !d.isRest ? d.optionalRest : false }
          : d
      )
    );
  };

  // Marca un descanso como OPCIONAL (Día 7 TENA): implica que sea descanso.
  const toggleOptionalRest = (dayId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? d.optionalRest
            ? { ...d, optionalRest: false }
            : { ...d, optionalRest: true, isRest: true }
          : d
      )
    );
  };

  // Asigna o quita el día de la semana (tocar el mismo chip lo desasigna).
  const updateDayWeekday = (dayId: string, weekday: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId ? { ...d, weekday: d.weekday === weekday ? undefined : weekday } : d
      )
    );
  };

  /**
   * Categorías del selector: las del entrenador si las ha personalizado y, si
   * no, las de fábrica. Se añaden además las que aparezcan en ejercicios
   * importados con el pack, para que ninguno quede fuera de todos los filtros.
   */
  const categoriasBiblioteca = React.useMemo(() => {
    const base = profile?.exerciseCategories?.length ? profile.exerciseCategories : [...MUSCLE_GROUPS];
    const enUso = [...new Set(exercises.map((e) => e.muscleGroup).filter(Boolean))];
    return [...base, ...enUso.filter((g) => !base.includes(g))];
  }, [profile?.exerciseCategories, exercises]);

  /** Subgrupos de la categoría filtrada que de verdad tienen ejercicios. */
  const subgruposVisibles = React.useMemo(() => {
    if (filtroCategoria === 'Todos') return [];
    const declarados = profile?.categorySubgroups?.[filtroCategoria] ?? [];
    const enUso = [
      ...new Set(
        exercises
          .filter((e) => e.muscleGroup === filtroCategoria && e.subgroup)
          .map((e) => e.subgroup as string)
      ),
    ];
    const todos = [...declarados, ...enUso.filter((s) => !declarados.includes(s))];
    return todos;
  }, [filtroCategoria, profile?.categorySubgroups, exercises]);

  const ejerciciosFiltrados = React.useMemo(() => {
    const busca = exerciseSearch.toLowerCase().trim();
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(busca) &&
        (filtroCategoria === 'Todos' || ex.muscleGroup === filtroCategoria) &&
        (!filtroSubgrupo || ex.subgroup === filtroSubgrupo)
    );
  }, [exercises, exerciseSearch, filtroCategoria, filtroSubgrupo]);

  const addExerciseToDay = (dayId: string, exercise: Exercise) => {
    const routineExercise: RoutineExercise = {
      id: uid(),
      exerciseId: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: exercise.measure === 'seconds' ? '30' : '10',
      measure: exercise.measure ?? 'reps',
      // La categoría viaja con el plan: así el reparto por grupos sigue
      // saliendo aunque el ejercicio se renombre o se borre de la biblioteca.
      muscleGroup: exercise.muscleGroup,
      load: resolveLoad(exercise),
      band: exercise.band ?? false,
    };
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId ? { ...d, exercises: [...d.exercises, routineExercise] } : d
      )
    );
    showToast(`${exercise.name} añadido`);
  };

  // Crea el ejercicio en la biblioteca del coach y lo añade al día de una vez.
  const handleCreateAndAdd = async () => {
    if (!profile || !pickerForDay || !newName.trim()) return;
    const dayId = pickerForDay;
    setSavingNew(true);
    try {
      const data = {
        trainerId: profile.uid,
        name: newName.trim(),
        muscleGroup: newGroup,
        subgroup: newSubgroup.trim() || undefined,
        measure: newMeasure,
        load: newLoad,
        videoUrl: newVideo.trim() || undefined,
      };
      const id = await createExercise(data);
      const ex: Exercise = { id, createdAt: Date.now(), ...data };
      setExercises((prev) => [...prev, ex]);
      addExerciseToDay(dayId, ex);
      setCreatingNew(false);
      setNewName('');
      setNewSubgroup('');
      setNewMeasure('reps');
      setNewLoad('none');
      setNewVideo('');
      setExerciseSearch('');
      setPickerForDay(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo crear el ejercicio');
    } finally {
      setSavingNew(false);
    }
  };

  const removeExercise = (dayId: string, exerciseRowId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter((e) => e.id !== exerciseRowId) }
          : d
      )
    );
  };

  const updateExerciseField = (
    dayId: string,
    exerciseRowId: string,
    field: 'sets' | 'reps' | 'seconds' | 'side2' | 'restSeconds' | 'notes' | 'rir' | 'goal',
    value: string
  ) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId
                  ? {
                      ...e,
                      [field]:
                        field === 'sets' || field === 'restSeconds' || field === 'rir'
                          ? Number(value) || 0
                          : value,
                    }
                  : e
              ),
            }
          : d
      )
    );
  };

  // Ajusta la intensidad (1-10) de un día del ciclo (Método REIN TENA).
  const updateDayIntensity = (dayId: string, delta: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, intensity: Math.max(1, Math.min(10, (d.intensity ?? 5) + delta)) }
          : d
      )
    );
  };

  const toggleIntervalTimer = (dayId: string) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, showIntervalTimer: !d.showIntervalTimer } : d))
    );
  };

  const updateApproaches = (dayId: string, value: string) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, approachesNote: value } : d)));
  };

  // Descanso en formato mm:ss; se guarda en segundos.
  const updateRestSeconds = (dayId: string, exerciseRowId: string, seconds: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId ? { ...e, restSeconds: seconds } : e
              ),
            }
          : d
      )
    );
  };

  // Fija la variante de carga de un ejercicio DENTRO de la rutina (normal /
  // lastrado / con goma), sin depender de la ficha del ejercicio.
  const setExerciseLoad = (dayId: string, exerciseRowId: string, load: ExerciseLoad) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId ? { ...e, load, band: load === 'assisted' } : e
              ),
            }
          : d
      )
    );
  };

  // Fija el agarre de un ejercicio DENTRO de la rutina. Va aquí y no en la
  // ficha del ejercicio porque las mismas dominadas son prono un día y supinas
  // otro: es cosa del plan, no del ejercicio. Volver a tocar el agarre activo
  // lo quita, para poder dejarlo sin especificar.
  const setExerciseGrip = (dayId: string, exerciseRowId: string, grip: GripType) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId ? { ...e, grip: e.grip === grip ? undefined : grip } : e
              ),
            }
          : d
      )
    );
  };

  /**
   * Series en clúster: activarlas, apagarlas o cambiar sus números.
   *
   * No es lo mismo que el EMOM del día: allí el reloj manda sobre toda la
   * sesión y aquí se parte UNA serie en bloques con una pausa mínima, ejercicio
   * a ejercicio. Por eso se configura en el ejercicio y no en el día.
   */
  const setExerciseCluster = (
    dayId: string,
    exerciseRowId: string,
    patch: Partial<ClusterConfig> | null
  ) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) => {
                if (e.id !== exerciseRowId) return e;
                if (patch === null) {
                  const { cluster: _fuera, ...resto } = e;
                  return resto;
                }
                return { ...e, cluster: { ...CLUSTER_DEFAULT, ...e.cluster, ...patch } };
              }),
            }
          : d
      )
    );
  };

  // Encadena o desencadena un ejercicio en superserie con el anterior.
  const toggleSuperset = (dayId: string, exerciseRowId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId
                  ? { ...e, supersetWithPrevious: !e.supersetWithPrevious }
                  : e
              ),
            }
          : d
      )
    );
  };

  // Mueve o copia un ejercicio a OTRO día sin tener que volver a montarlo
  // (mantiene series, reps, RIR, descanso, carga y notas).
  const moveOrCopyExercise = (targetDayId: string, keepOriginal: boolean) => {
    if (!movePicker) return;
    const { dayId, ex } = movePicker;
    setDays((prev) =>
      prev.map((d) => {
        let exercises = d.exercises;
        // Quitar del día de origen (solo al MOVER).
        if (!keepOriginal && d.id === dayId) {
          exercises = exercises.filter((e) => e.id !== ex.id);
        }
        // Añadir al final del día de destino (id nuevo, sin superserie heredada).
        if (d.id === targetDayId) {
          exercises = [...exercises, { ...ex, id: uid(), supersetWithPrevious: false }];
        }
        return exercises === d.exercises ? d : { ...d, exercises };
      })
    );
    // Deja el día de destino desplegado para verlo al instante.
    setExpandedDays((p) => ({ ...p, [targetDayId]: true }));
    setMovePicker(null);
    showToast(keepOriginal ? 'Ejercicio copiado' : 'Ejercicio movido');
  };

  // Mueve un ejercicio una posición arriba o abajo dentro de su día.
  const reordenarEjercicios = (dayId: string, from: number, to: number) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, exercises: moveItem(d.exercises, from, to) } : d))
    );
  };


  // Abre el selector de "copiar rutina de otro alumno".
  const openCopyPicker = async () => {
    if (!profile) return;
    setCopyPickerOpen(true);
    if (otherClients.length === 0) {
      const clients = await getClientsForTrainer(profile.uid);
      setOtherClients(clients.filter((c) => c.uid !== clientId));
    }
  };

  // Copia nombre y días (con ids nuevos) de la rutina activa de otro alumno.
  const copyFromClient = async (otherId: string) => {
    setCopying(true);
    try {
      const source = await getActiveRoutineForClient(otherId, profile?.uid);
      if (source) {
        setName(`${source.name}`);
        setDays(
          source.days.map((d) => ({
            ...d,
            id: uid(),
            exercises: d.exercises.map((e) => ({ ...e, id: uid() })),
          }))
        );
      }
      setCopyPickerOpen(false);
    } finally {
      setCopying(false);
    }
  };

  // Abre el panel de plantillas y las carga.
  const openTemplates = async () => {
    if (!profile) return;
    setTemplatesOpen(true);
    setTemplates(await getRoutineTemplatesForTrainer(profile.uid));
  };

  // Aplica una plantilla a la rutina actual (días con ids nuevos).
  const applyTemplate = (t: RoutineTemplate) => {
    setName(t.name);
    setSchedule(t.schedule ?? 'weekly');
    if (t.scheduleLabel) setScheduleLabel(flexLabel(t.scheduleLabel));
    if (t.cycleStartDate) setCycleStartDate(t.cycleStartDate);
    setDays(
      t.days.map((d) => ({
        ...d,
        id: uid(),
        exercises: d.exercises.map((e) => ({ ...e, id: uid() })),
      }))
    );
    setTemplatesOpen(false);
    showToast('Plantilla aplicada');
  };

  // Guarda la rutina que se está editando como plantilla reutilizable.
  const saveAsTemplate = async () => {
    if (!profile) return;
    if (days.length === 0) {
      showToast('Añade al menos un día antes de guardar la plantilla');
      return;
    }
    setSavingTemplate(true);
    try {
      await createRoutineTemplate({
        trainerId: profile.uid,
        name: name.trim() || 'Plantilla',
        schedule,
        cycleStartDate: schedule === 'cycle' ? cycleStartDate : undefined,
        scheduleLabel: schedule === 'flex' ? flexLabel(scheduleLabel) : undefined,
        days,
      });
      setTemplates(await getRoutineTemplatesForTrainer(profile.uid));
      showToast('Guardada como plantilla');
    } finally {
      setSavingTemplate(false);
    }
  };

  const removeTemplate = async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await deleteRoutineTemplate(id);
  };

  const handleSave = useCallback(async () => {
    if (!profile || !clientId) return;
    setSaving(true);
    try {
      const scheduleFields = {
        schedule,
        cycleStartDate: schedule === 'cycle' ? cycleStartDate : undefined,
        scheduleLabel: schedule === 'flex' ? flexLabel(scheduleLabel) : undefined,
      };
      if (routineId) {
        await updateRoutine(routineId, { name, days, ...scheduleFields });
        await setActiveRoutine(clientId, routineId, profile.uid);
      } else {
        const newId = await createRoutine({
          trainerId: profile.uid,
          clientId,
          name,
          days,
          active: true,
          ...scheduleFields,
        });
        await setActiveRoutine(clientId, newId, profile.uid);
      }
      notifyUser(
        clientId,
        routineId ? 'Rutina actualizada' : 'Nueva rutina asignada',
        `Tu entrenador ha actualizado tu plan: ${name}`
      );
      showToast('Rutina guardada');
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar la rutina.');
    } finally {
      setSaving(false);
    }
  }, [profile, clientId, routineId, name, days, schedule, cycleStartDate, router]);

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <TextField label="Nombre de la rutina" value={name} onChangeText={setName} />

      {copyPickerOpen ? (
        <Card style={styles.copyCard}>
          <Text style={styles.copyTitle}>Copiar la rutina activa de...</Text>
          {otherClients.length === 0 ? (
            <Text style={styles.mutedText}>Cargando alumnos...</Text>
          ) : (
            otherClients.map((c) => (
              <Pressable
                key={c.uid}
                onPress={() => copyFromClient(c.uid)}
                style={styles.pickerRow}
                disabled={copying}
              >
                <Text style={styles.pickerRowText}>{c.name}</Text>
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
              </Pressable>
            ))
          )}
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setCopyPickerOpen(false)}
            style={{ marginTop: spacing.xs }}
          />
        </Card>
      ) : templatesOpen ? (
        <Card style={styles.copyCard}>
          <Text style={styles.copyTitle}>Plantillas de rutina</Text>
          {templates.length === 0 ? (
            <Text style={styles.mutedText}>
              Aún no tienes plantillas. Guarda esta rutina para reutilizarla con
              otros alumnos.
            </Text>
          ) : (
            templates.map((t) => (
              <View key={t.id} style={styles.templateRow}>
                <Pressable style={{ flex: 1 }} onPress={() => applyTemplate(t)}>
                  <Text style={styles.pickerRowText}>{t.name}</Text>
                  <Text style={styles.mutedText}>
                    {t.days.length} día(s) · toca para aplicar
                  </Text>
                </Pressable>
                <Pressable onPress={() => removeTemplate(t.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))
          )}
          <Button
            title="Guardar rutina actual como plantilla"
            onPress={saveAsTemplate}
            loading={savingTemplate}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            title="Cerrar"
            variant="ghost"
            onPress={() => setTemplatesOpen(false)}
            style={{ marginTop: spacing.xs }}
          />
        </Card>
      ) : (
        <View style={styles.actionsRow}>
          <Button
            title="Borrador"
            variant="secondary"
            onPress={handleGenerateDraft}
            style={{ flex: 1 }}
          />
          <Button
            title="Plantillas"
            variant="secondary"
            onPress={openTemplates}
            style={{ flex: 1 }}
          />
          <Button
            title="Copiar alumno"
            variant="secondary"
            onPress={openCopyPicker}
            style={{ flex: 1 }}
          />
        </View>
      )}

      <Card accent style={styles.scheduleCard}>
        <Text style={styles.scheduleTitle}>Programación</Text>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setSchedule('weekly')}
            style={[styles.modeBtn, schedule === 'weekly' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, schedule === 'weekly' && styles.modeTextActive]}>
              Días de la semana
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSchedule('cycle')}
            style={[styles.modeBtn, schedule === 'cycle' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, schedule === 'cycle' && styles.modeTextActive]}>
              Días sueltos
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSchedule('flex')}
            style={[styles.modeBtn, schedule === 'flex' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, schedule === 'flex' && styles.modeTextActive]}>
              {flexLabel(scheduleLabel)}
            </Text>
          </Pressable>
        </View>

        {schedule === 'flex' ? (
          <>
            <Text style={styles.scheduleHint}>
              Modo a elección: creas varias rutinas (los "días" de abajo) y el alumno, antes de
              entrenar, elige cuál hacer según cómo se encuentre ese día. Sin calendario fijo.
            </Text>
            <TextField
              label="Nombre de esta programación (lo ve el alumno)"
              placeholder="Ej. Sensaciones"
              value={scheduleLabel}
              onChangeText={setScheduleLabel}
              style={{ marginTop: spacing.sm, marginBottom: 0 }}
            />
          </>
        ) : schedule === 'cycle' ? (
          <>
            <Text style={styles.scheduleHint}>
              Los {days.length} días rotan en ciclo constante (Día 1 → {days.length} → repite), sin
              depender del día de la semana. La intensidad se ajusta en cada día, abajo. Marca un
              día como “Opcional” (p. ej. el último) para que el alumno elija: descansar o reiniciar
              en el Día 1.
            </Text>

            <Pressable
              onPress={() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                setCycleStartDate(d.getTime());
                showToast('Ciclo reiniciado hoy');
              }}
              style={styles.cycleResetBtn}
            >
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.cycleResetText}>
                Empezar ciclo hoy · actual:{' '}
                {new Date(cycleStartDate).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                })}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.scheduleHint}>
            Asigna cada día a un día de la semana con los botones L-D de abajo.
          </Text>
        )}
      </Card>

      <DragList
        items={days}
        keyOf={(d) => d.id}
        gap={0}
        handleOnly
        onReorder={(from, to) => setDays((prev) => moveItem(prev, from, to))}
        renderItem={(day, dayIndex, diaArrastrando, asaDia) => {
        const isOpen = expandedDays[day.id] ?? false;
        const exCount = day.exercises.length;
        const summaryParts: string[] = [];
        if (schedule === 'cycle') {
          if (day.optionalRest) summaryParts.push(`Día ${dayIndex + 1}`, 'Descanso opcional');
          else if (day.isRest) summaryParts.push(`Día ${dayIndex + 1}`, 'Descanso');
          else summaryParts.push(`Día ${dayIndex + 1}`, `Int. ${day.intensity ?? 5}/10`);
        } else if (day.weekday !== undefined) {
          summaryParts.push(WEEKDAY_NAMES[day.weekday]);
          if (day.isRest) summaryParts.push('Descanso');
        }
        if (!day.isRest) {
          summaryParts.push(`${exCount} ${exCount === 1 ? 'ejercicio' : 'ejercicios'}`);
          // Series totales del día (suma de las series de todos sus ejercicios).
          const totalSets = day.exercises.reduce((acc, e) => acc + (e.sets || 0), 0);
          if (totalSets > 0) summaryParts.push(`${totalSets} series`);
        }
        return (
        <Card style={[styles.dayCard, diaArrastrando && styles.dayCardDragging]}>
          <View style={styles.dayHeaderRow}>
            <Pressable
              style={styles.dayHeaderMain}
              onPress={() => toggleDayExpanded(day.id)}
            >
              <Text style={styles.dayTitle} numberOfLines={1}>
                {day.name || `Día ${dayIndex + 1}`}
              </Text>
              <Text style={styles.daySummary} numberOfLines={1}>
                {summaryParts.join(' · ')}
              </Text>
            </Pressable>
            {/* Asa del día: mantener pulsado y mover para cambiar su orden. */}
            <View {...asaDia} style={styles.moveDayBtn}>
              <Ionicons name="reorder-three" size={18} color={colors.textMuted} />
            </View>
            <Pressable onPress={() => duplicateDay(day.id)} style={styles.removeDayBtn} hitSlop={8}>
              <Ionicons name="copy-outline" size={17} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => removeDay(day.id)} style={styles.removeDayBtn} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
            <Pressable onPress={() => toggleDayExpanded(day.id)} hitSlop={8}>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          {isOpen ? (
          <>
          <TextField
            label="Nombre del día"
            value={day.name}
            onChangeText={(v) => updateDayName(day.id, v)}
            style={{ marginTop: spacing.sm }}
          />

          {schedule === 'cycle' ? (
            <>
            <View style={styles.cycleDayRow}>
              <View style={styles.cyclePill}>
                <Text style={styles.cyclePillText}>Día {dayIndex + 1} del ciclo</Text>
              </View>
              <View style={styles.restToggles}>
                <Pressable
                  onPress={() => toggleRestDay(day.id)}
                  style={[styles.restToggle, day.isRest && !day.optionalRest && styles.restToggleOn]}
                  hitSlop={4}
                >
                  <Ionicons
                    name={day.isRest ? 'bed' : 'bed-outline'}
                    size={14}
                    color={day.isRest && !day.optionalRest ? colors.onPrimary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.restToggleText,
                      day.isRest && !day.optionalRest && styles.restToggleTextOn,
                    ]}
                  >
                    Descanso
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleOptionalRest(day.id)}
                  style={[styles.restToggle, day.optionalRest && styles.restToggleOn]}
                  hitSlop={4}
                >
                  <Ionicons
                    name={day.optionalRest ? 'shuffle' : 'shuffle-outline'}
                    size={14}
                    color={day.optionalRest ? colors.onPrimary : colors.textMuted}
                  />
                  <Text style={[styles.restToggleText, day.optionalRest && styles.restToggleTextOn]}>
                    Opcional
                  </Text>
                </Pressable>
              </View>
            </View>
            {day.optionalRest ? (
              <Text style={styles.optionalHint}>
                Descanso opcional: el alumno decide cada vez entre descansar o
                reiniciar el ciclo entrenando el Día 1.
              </Text>
            ) : null}
            {!day.isRest ? (
              <View style={styles.dayIntensityRow}>
                <Text style={styles.dayIntensityLabel}>
                  Intensidad · {day.intensity ?? 5}/10
                </Text>
                <View style={styles.dayIntensityControls}>
                  <Pressable
                    onPress={() => updateDayIntensity(day.id, -1)}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </Pressable>
                  <View style={styles.intensityTrack}>
                    <View
                      style={[
                        styles.intensityFill,
                        { width: `${((day.intensity ?? 5) / 10) * 100}%` },
                      ]}
                    />
                  </View>
                  <Pressable
                    onPress={() => updateDayIntensity(day.id, 1)}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            ) : null}
            </>
          ) : schedule === 'flex' ? null : (
          <View style={styles.weekdayRow}>
            <View style={styles.weekdayHeadRow}>
              <Text style={styles.weekdayLabel}>Día de la semana</Text>
              <Pressable
                onPress={() => toggleRestDay(day.id)}
                style={[styles.restToggle, day.isRest && styles.restToggleOn]}
                hitSlop={4}
              >
                <Ionicons
                  name={day.isRest ? 'bed' : 'bed-outline'}
                  size={14}
                  color={day.isRest ? colors.onPrimary : colors.textMuted}
                />
                <Text style={[styles.restToggleText, day.isRest && styles.restToggleTextOn]}>
                  Descanso
                </Text>
              </Pressable>
            </View>
            <View style={styles.weekdayChips}>
              {WEEKDAY_LABELS.map((label, i) => (
                <Pressable
                  key={label}
                  onPress={() => updateDayWeekday(day.id, i)}
                  style={[styles.weekdayChip, day.weekday === i && styles.weekdayChipSelected]}
                  hitSlop={4}
                >
                  <Text
                    style={[
                      styles.weekdayChipText,
                      day.weekday === i && styles.weekdayChipTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {day.isRest ? (
              <Text style={styles.optionalHint}>
                Día de descanso: en el día de la semana elegido, el alumno verá “Descanso”, no
                registra nada y no afecta a su racha.
              </Text>
            ) : null}
          </View>
          )}

          {!day.isRest ? (
            <View style={styles.dayTools}>
              <Pressable
                onPress={() => toggleIntervalTimer(day.id)}
                style={styles.checkRow}
                hitSlop={6}
              >
                <Ionicons
                  name={day.showIntervalTimer ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={day.showIntervalTimer ? colors.primary : colors.textMuted}
                />
                <Text style={styles.checkLabel}>
                  Temporizador de intervalos (EMOM) este día
                </Text>
              </Pressable>
              <TextField
                label="Aproximaciones (calentamiento · paso 3)"
                placeholder="Ej. 2 series al 60% y 70% del peso de trabajo"
                value={day.approachesNote ?? ''}
                onChangeText={(v) => updateApproaches(day.id, v)}
              />
            </View>
          ) : null}

          <DragList
            items={day.exercises}
            keyOf={(ex) => ex.id}
            gap={0}
            handleOnly
            onReorder={(from, to) => reordenarEjercicios(day.id, from, to)}
            renderItem={(ex, exIndex, arrastrando, asa) => (
            <View
              style={[
                styles.exerciseRow,
                ex.supersetWithPrevious && styles.exerciseRowLinked,
                arrastrando && styles.exerciseRowDragging,
              ]}
            >
              {ex.supersetWithPrevious ? (
                <View style={styles.supersetTag}>
                  <Ionicons name="link" size={12} color={colors.primaryBright} />
                  <Text style={styles.supersetTagText}>SUPERSERIE con el anterior</Text>
                </View>
              ) : null}
              <View style={styles.exerciseTitleRow}>
                <Text style={styles.exerciseName}>
                  {ex.name}
                  {resolveLoad(ex) === 'assisted' ? (
                    <Text style={styles.markAssisted}> · goma</Text>
                  ) : resolveLoad(ex) === 'weighted' ? (
                    <Text style={styles.markWeighted}> · lastre</Text>
                  ) : null}
                </Text>
                {days.length > 1 ? (
                  <Pressable
                    onPress={() => setMovePicker({ dayId: day.id, ex })}
                    style={styles.moveBtn}
                    hitSlop={4}
                  >
                    <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                  </Pressable>
                ) : null}
                {/* Asa: mantener pulsado aquí y mover arriba o abajo. Va
                    aparte de la fila porque está llena de campos de texto y
                    colocar el cursor no debe mover el ejercicio. */}
                <View {...asa} style={styles.moveBtn}>
                  <Ionicons name="reorder-three" size={18} color={colors.textMuted} />
                </View>
                <Pressable
                  onPress={() => removeExercise(day.id, ex.id)}
                  style={styles.deleteBtn}
                  hitSlop={4}
                >
                  <Ionicons name="close" size={18} color={colors.danger} />
                </Pressable>
              </View>

              <Text style={styles.loadLabel}>Carga</Text>
              <View style={styles.loadRow}>
                {LOAD_OPTIONS.map((opt) => {
                  const active = resolveLoad(ex) === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setExerciseLoad(day.id, ex.id, opt.key)}
                      style={[styles.loadChip, active && styles.loadChipActive]}
                      hitSlop={4}
                    >
                      <Text style={[styles.loadChipText, active && styles.loadChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.loadLabel}>Agarre (opcional)</Text>
              <View style={styles.loadRow}>
                {GRIP_TYPES.map((g) => {
                  const active = ex.grip === g;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => setExerciseGrip(day.id, ex.id, g)}
                      style={[styles.loadChip, active && styles.loadChipActive]}
                      hitSlop={4}
                    >
                      <Text style={[styles.loadChipText, active && styles.loadChipTextActive]}>
                        {GRIP_LABEL[g]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.exerciseFields}>
                <TextField
                  label="Series"
                  keyboardType="number-pad"
                  value={String(ex.sets)}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'sets', v)}
                  containerStyle={styles.smallInput}
                />
                <TextField
                  label={
                    isDualMeasure(ex.measure)
                      ? isHoldMeasure(ex.measure)
                        ? 'Aguante izq. (seg)'
                        : 'Reps izq.'
                      : isHoldMeasure(ex.measure)
                        ? 'Aguante (seg)'
                        : 'Reps'
                  }
                  value={ex.reps}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'reps', v)}
                  placeholder={isHoldMeasure(ex.measure) ? '30' : '8-12'}
                  containerStyle={styles.smallInput}
                />
                {/* Combo: además de las reps, el aguante de la misma serie. */}
                {ex.measure === 'combo' ? (
                  <TextField
                    label="Aguante (seg)"
                    value={ex.seconds ?? ''}
                    onChangeText={(v) => updateExerciseField(day.id, ex.id, 'seconds', v)}
                    placeholder="12"
                    containerStyle={styles.smallInput}
                  />
                ) : isDualMeasure(ex.measure) ? (
                  /* Por lados: el objetivo del lado derecho. Casi siempre será
                     el mismo que el izquierdo, pero no siempre, y ahí está la
                     gracia de poder ponerlo aparte. */
                  <TextField
                    label={isHoldMeasure(ex.measure) ? 'Aguante der. (seg)' : 'Reps der.'}
                    value={ex.side2 ?? ''}
                    onChangeText={(v) => updateExerciseField(day.id, ex.id, 'side2', v)}
                    placeholder={isHoldMeasure(ex.measure) ? '30' : '8-12'}
                    containerStyle={styles.smallInput}
                  />
                ) : null}
              </View>
              <View style={styles.exerciseFields}>
                <TextField
                  label="RIR"
                  keyboardType="number-pad"
                  value={ex.rir !== undefined ? String(ex.rir) : ''}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'rir', v)}
                  placeholder="2"
                  containerStyle={styles.smallInput}
                />
                <TextField
                  label="Descanso (min:seg)"
                  keyboardType="numbers-and-punctuation"
                  value={restText[ex.id] ?? formatClock(ex.restSeconds)}
                  onChangeText={(v) => {
                    setRestText((prev) => ({ ...prev, [ex.id]: v }));
                    updateRestSeconds(day.id, ex.id, parseClock(v));
                  }}
                  placeholder="3:30"
                  containerStyle={styles.smallInput}
                />
              </View>
              {/* Clúster: la serie se parte en bloques con una pausa mínima.
                  Los números solo aparecen si está activado, para no meter dos
                  casillas más en la ficha de todos los ejercicios. */}
              {ex.cluster ? (
                <View style={styles.exerciseFields}>
                  <TextField
                    label="Bloques por serie"
                    keyboardType="number-pad"
                    value={String(clusterBlocks(ex.cluster))}
                    onChangeText={(v) =>
                      setExerciseCluster(day.id, ex.id, { blocks: parseInt(v, 10) || 2 })
                    }
                    placeholder="3"
                    containerStyle={styles.smallInput}
                  />
                  <TextField
                    label="Pausa entre bloques (seg)"
                    keyboardType="number-pad"
                    value={String(ex.cluster.restSeconds)}
                    onChangeText={(v) =>
                      setExerciseCluster(day.id, ex.id, {
                        restSeconds: Math.max(0, Math.min(120, parseInt(v, 10) || 0)),
                      })
                    }
                    placeholder="15"
                    containerStyle={styles.smallInput}
                  />
                </View>
              ) : null}
              <TextField
                label="Indicaciones (opcional)"
                value={ex.notes ?? ''}
                onChangeText={(v) => updateExerciseField(day.id, ex.id, 'notes', v)}
                placeholder="Tempo, agarre, técnica..."
                style={{ marginBottom: 0, marginTop: spacing.xs }}
              />
              {goalOpen[ex.id] || ex.goal ? (
                <TextField
                  label="Objetivo (texto libre)"
                  value={ex.goal ?? ''}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'goal', v)}
                  placeholder={
                    ex.measure === 'seconds' ? 'Ej. 20 segundos con 5 kg' : 'Ej. 3x10 con 5 kg'
                  }
                  style={{ marginBottom: 0, marginTop: spacing.xs }}
                />
              ) : null}
              <View style={styles.linksRow}>
                <Pressable
                  onPress={() => setGoalOpen((p) => ({ ...p, [ex.id]: !p[ex.id] }))}
                  style={styles.linkBtn}
                >
                  <Ionicons name="flag-outline" size={14} color={colors.primary} />
                  <Text style={styles.linkBtnText}>
                    {ex.goal ? `Objetivo: ${ex.goal}` : 'Añadir objetivo'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setExerciseCluster(day.id, ex.id, ex.cluster ? null : { ...CLUSTER_DEFAULT })
                  }
                  style={styles.linkBtn}
                >
                  <Ionicons
                    name={ex.cluster ? 'layers' : 'layers-outline'}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.linkBtnText}>
                    {ex.cluster
                      ? `Clúster: ${clusterBlocks(ex.cluster)} bloques · ${ex.cluster.restSeconds}s`
                      : 'Series en clúster'}
                  </Text>
                </Pressable>
                {exIndex > 0 ? (
                  <Pressable onPress={() => toggleSuperset(day.id, ex.id)} style={styles.linkBtn}>
                    <Ionicons
                      name={ex.supersetWithPrevious ? 'unlink' : 'link'}
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.linkBtnText}>
                      {ex.supersetWithPrevious
                        ? 'Quitar superserie'
                        : 'Superserie con el anterior'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            )}
          />

          <Button
            title="+ Añadir ejercicio"
            variant="secondary"
            onPress={() => {
              setExerciseSearch('');
              setCreatingNew(false);
              setPickerForDay(day.id);
            }}
            style={{ marginTop: spacing.sm }}
          />
          </>
          ) : null}
        </Card>
        );
        }}
      />

      <Modal
        visible={pickerForDay !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerForDay(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {creatingNew ? 'Nuevo ejercicio' : 'Añadir ejercicio'}
              </Text>
              <Pressable
                onPress={() => {
                  setPickerForDay(null);
                  setCreatingNew(false);
                }}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {creatingNew ? (
              <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                <TextField
                  label="Nombre del ejercicio"
                  placeholder="Ej. Muscle up"
                  value={newName}
                  onChangeText={setNewName}
                />
                <Text style={styles.loadLabel}>Categoría</Text>
                <View style={styles.groupWrap}>
                  {categoriasBiblioteca.map((g) => (
                    <Pressable
                      key={g}
                      onPress={() => {
                        setNewGroup(g);
                        setNewSubgroup('');
                      }}
                      style={[styles.loadChip, newGroup === g && styles.loadChipActive]}
                    >
                      <Text style={[styles.loadChipText, newGroup === g && styles.loadChipTextActive]}>
                        {g}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {/* Subgrupo: solo si esa categoría ya tiene alguno definido. */}
                {(profile?.categorySubgroups?.[newGroup] ?? []).length > 0 ? (
                  <>
                    <Text style={styles.loadLabel}>Subgrupo (opcional)</Text>
                    <View style={styles.groupWrap}>
                      {(profile?.categorySubgroups?.[newGroup] ?? []).map((sg) => {
                        const activo = newSubgroup === sg;
                        return (
                          <Pressable
                            key={sg}
                            onPress={() => setNewSubgroup(activo ? '' : sg)}
                            style={[styles.loadChip, activo && styles.loadChipActive]}
                          >
                            <Text style={[styles.loadChipText, activo && styles.loadChipTextActive]}>
                              {sg}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}
                <Text style={styles.loadLabel}>Medida</Text>
                <View style={styles.loadRow}>
                  {(['reps', 'seconds'] as ExerciseMeasure[]).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setNewMeasure(m)}
                      style={[styles.loadChip, newMeasure === m && styles.loadChipActive]}
                    >
                      <Text style={[styles.loadChipText, newMeasure === m && styles.loadChipTextActive]}>
                        {m === 'reps' ? 'Repeticiones' : 'Segundos'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.loadLabel}>Carga</Text>
                <View style={styles.loadRow}>
                  {LOAD_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.key}
                      onPress={() => setNewLoad(opt.key)}
                      style={[styles.loadChip, newLoad === opt.key && styles.loadChipActive]}
                    >
                      <Text style={[styles.loadChipText, newLoad === opt.key && styles.loadChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextField
                  label="Vídeo de técnica (opcional)"
                  placeholder="Pega el enlace de YouTube"
                  value={newVideo}
                  onChangeText={setNewVideo}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={{ marginTop: spacing.sm }}
                />
                <Button
                  title="Crear y añadir al día"
                  onPress={handleCreateAndAdd}
                  loading={savingNew}
                  disabled={!newName.trim()}
                  style={{ marginTop: spacing.md }}
                />
                <Button
                  title="Volver a la biblioteca"
                  variant="ghost"
                  onPress={() => setCreatingNew(false)}
                  style={{ marginTop: spacing.xs }}
                />
              </ScrollView>
            ) : (
              <>
                <TextField
                  placeholder="Buscar ejercicio..."
                  value={exerciseSearch}
                  onChangeText={setExerciseSearch}
                  autoCapitalize="none"
                  style={{ marginBottom: spacing.sm }}
                />
                <Pressable
                  onPress={() => {
                    setNewName(exerciseSearch.trim());
                    setCreatingNew(true);
                  }}
                  style={styles.createNewBtn}
                >
                  <Ionicons name="add-circle" size={18} color={colors.primary} />
                  <Text style={styles.createNewText}>
                    Crear ejercicio nuevo
                    {exerciseSearch.trim() ? ` “${exerciseSearch.trim()}”` : ''}
                  </Text>
                </Pressable>
                {exercises.length === 0 ? (
                  <Text style={styles.mutedText}>
                    No tienes ejercicios en tu biblioteca todavía. Crea el primero con el botón de
                    arriba.
                  </Text>
                ) : (
                  <>
                    {/* Filtro por categoría. Con una biblioteca grande, buscar
                        por nombre obliga a saber ya lo que quieres; por
                        categoría se puede ir a "Tirón" y ver qué hay. */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filterRow}
                      keyboardShouldPersistTaps="handled"
                    >
                      {['Todos', ...categoriasBiblioteca].map((cat) => {
                        const activo = filtroCategoria === cat;
                        return (
                          <Pressable
                            key={cat}
                            onPress={() => {
                              setFiltroCategoria(cat);
                              setFiltroSubgrupo(null);
                            }}
                            style={[styles.filterChip, activo && styles.filterChipActive]}
                          >
                            <Text
                              style={[styles.filterChipText, activo && styles.filterChipTextActive]}
                            >
                              {cat}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    {/* Subgrupos: solo dentro de una categoría concreta y solo
                        si esa categoría los tiene. */}
                    {subgruposVisibles.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                        keyboardShouldPersistTaps="handled"
                      >
                        {subgruposVisibles.map((sg) => {
                          const activo = filtroSubgrupo === sg;
                          return (
                            <Pressable
                              key={sg}
                              onPress={() => setFiltroSubgrupo(activo ? null : sg)}
                              style={[styles.subChip, activo && styles.subChipActive]}
                            >
                              <Text
                                style={[styles.subChipText, activo && styles.filterChipTextActive]}
                              >
                                {sg}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    ) : null}

                  <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                    {ejerciciosFiltrados.length === 0 ? (
                      <Text style={styles.mutedText}>
                        Ningún ejercicio de esa categoría coincide con la búsqueda.
                      </Text>
                    ) : null}
                    {ejerciciosFiltrados
                      .map((ex) => (
                        <Pressable
                          key={ex.id}
                          onPress={() => pickerForDay && addExerciseToDay(pickerForDay, ex)}
                          style={styles.pickerRow}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pickerRowText}>
                              {ex.name}
                              {resolveLoad(ex) === 'assisted' ? (
                                <Text style={styles.markAssisted}> · goma</Text>
                              ) : resolveLoad(ex) === 'weighted' ? (
                                <Text style={styles.markWeighted}> · lastre</Text>
                              ) : null}
                            </Text>
                            <Text style={styles.pickerRowMuscle}>
                              {ex.muscleGroup}
                              {ex.subgroup ? ` · ${ex.subgroup}` : ''}
                              {ex.measure === 'seconds' ? ' · isométrico' : ''}
                            </Text>
                          </View>
                          <Ionicons name="add-circle" size={22} color={colors.primary} />
                        </Pressable>
                      ))}
                  </ScrollView>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={movePicker !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setMovePicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Mover o copiar</Text>
                <Text style={styles.moveExName} numberOfLines={1}>
                  {movePicker?.ex.name}
                </Text>
              </View>
              <Pressable onPress={() => setMovePicker(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalList}>
              {days.map((d, i) => {
                const isSource = d.id === movePicker?.dayId;
                return (
                  <View key={d.id} style={styles.moveDayRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerRowText}>
                        {d.name || `Día ${i + 1}`}
                        {isSource ? '  · actual' : ''}
                      </Text>
                      <Text style={styles.pickerRowMuscle}>
                        {d.exercises.length} ejercicio(s)
                        {d.isRest ? ' · descanso' : ''}
                      </Text>
                    </View>
                    <Button
                      title="Copiar"
                      variant="secondary"
                      onPress={() => moveOrCopyExercise(d.id, true)}
                      style={styles.moveActionBtn}
                    />
                    {!isSource ? (
                      <Button
                        title="Mover"
                        onPress={() => moveOrCopyExercise(d.id, false)}
                        style={styles.moveActionBtn}
                      />
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Button title="+ Añadir día" variant="ghost" onPress={addDay} style={styles.addDayBtn} />

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      <Button title="Guardar rutina" onPress={handleSave} loading={saving} style={styles.saveBtn} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dayCardDragging: { borderColor: colors.hairline },
  dayCard: { marginBottom: spacing.md },
  scheduleCard: { marginBottom: spacing.md },
  scheduleTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  modeTextActive: { color: colors.onPrimary },
  scheduleHint: { ...typography.small, color: colors.textMuted, lineHeight: 18 },
  dayTools: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkLabel: { ...typography.small, color: colors.text, flex: 1, lineHeight: 18 },
  dayIntensityRow: { marginBottom: spacing.sm },
  dayIntensityLabel: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  dayIntensityControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  intensityLabel: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  intensityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  intensityTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  intensityFill: { height: '100%', backgroundColor: colors.primary },
  cycleResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  cycleResetText: { ...typography.small, color: colors.primary, fontFamily: fonts.medium },
  cycleDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  cyclePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cyclePillText: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold, fontSize: 11 },
  restToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  restToggles: { flexDirection: 'row', gap: spacing.xs },
  restToggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  restToggleText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  restToggleTextOn: { color: colors.onPrimary },
  optionalHint: {
    ...typography.small,
    color: colors.primaryBright,
    fontSize: 12,
    marginBottom: spacing.sm,
    lineHeight: 17,
  },
  moveDayBtn: { paddingHorizontal: 4 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayNameInput: { flex: 1, marginBottom: 0 },
  removeDayBtn: { paddingHorizontal: spacing.sm },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayHeaderMain: { flex: 1, paddingVertical: spacing.xs },
  dayTitle: { ...typography.h3, color: colors.text },
  daySummary: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  removeDayText: { ...typography.small, color: colors.danger },
  weekdayRow: { marginTop: spacing.sm, marginBottom: spacing.sm },
  weekdayHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  weekdayLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  weekdayChips: { flexDirection: 'row', gap: spacing.xs },
  weekdayChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  weekdayChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  weekdayChipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  weekdayChipTextSelected: { color: colors.onPrimary },
  exerciseRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  exerciseRowDragging: { borderColor: colors.hairline },
  exerciseRowLinked: {
    borderLeftWidth: 2,
    borderLeftColor: colors.hairline,
    paddingLeft: spacing.sm,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  exerciseFields: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  // Va en `containerStyle`, no en `style`: `style` acaba en el TextInput de
  // dentro, así que el contenedor seguía midiendo lo que ocupase su etiqueta y
  // "Descanso (min:seg)" empujaba la fila fuera de la pantalla.
  smallInput: { flex: 1, marginBottom: 0 },
  loadLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    fontSize: 11,
  },
  loadRow: { flexDirection: 'row', gap: spacing.xs },
  // Marcadores de carga en color (sin emojis): azul = lastre, dorado = goma.
  markWeighted: { color: '#5B9BD5', fontFamily: fonts.semiBold, fontSize: 13 },
  markAssisted: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 13 },
  groupWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  createNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    backgroundColor: colors.primaryMuted,
    marginBottom: spacing.sm,
  },
  createNewText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, flex: 1 },
  filterRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  filterChipTextActive: { color: colors.onPrimary },
  subChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairlineFaint,
  },
  subChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  subChipText: { ...typography.small, color: colors.textFaint, fontSize: 12 },
  loadChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  loadChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  loadChipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  loadChipTextActive: { color: colors.onPrimary },
  moveBtn: { padding: spacing.xs },
  deleteBtn: { padding: spacing.xs },
  moveExName: { ...typography.small, color: colors.primaryBright, marginTop: 2 },
  moveDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moveActionBtn: { paddingHorizontal: spacing.md, paddingVertical: 10 },
  supersetTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  supersetTagText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 1,
    color: colors.primaryBright,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  linkBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  copyCard: { marginBottom: spacing.md },
  copyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.h2, color: colors.text },
  modalList: { maxHeight: 420 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerRowText: { ...typography.body, color: colors.text },
  pickerRowMuscle: { ...typography.small, color: colors.textFaint },
  mutedText: { ...typography.small, color: colors.textFaint },
  addDayBtn: { marginBottom: spacing.lg },
  saveError: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  saveBtn: { marginBottom: spacing.xl },
});
