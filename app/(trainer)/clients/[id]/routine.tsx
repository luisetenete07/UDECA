import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { TextField } from '../../../../components/TextField';
import { showToast } from '../../../../components/Toast';
import { useAuth } from '../../../../lib/auth-context';
import { getExercisesForTrainer } from '../../../../lib/firestore/exercises';
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
import { getClientsForTrainer } from '../../../../lib/firestore/users';
import { notifyUser } from '../../../../lib/notifications';
import { fonts, colors, radius, spacing, typography } from '../../../../lib/theme';
import {
  resolveLoad,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
  type Exercise,
  type ExerciseLoad,
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
  const [schedule, setSchedule] = useState<RoutineSchedule>('weekly');
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
  // Qué días están desplegados en el editor (compacto por defecto).
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDayExpanded = (dayId: string, fallback: boolean) => {
    setExpandedDays((prev) => ({ ...prev, [dayId]: !(prev[dayId] ?? fallback) }));
  };

  useEffect(() => {
    if (!clientId || !profile) return;
    (async () => {
      const [existing, library] = await Promise.all([
        getActiveRoutineForClient(clientId, profile.uid),
        getExercisesForTrainer(profile.uid),
      ]);
      setExercises(library);
      if (existing) {
        setRoutineId(existing.id);
        setName(existing.name);
        setDays(existing.days);
        setSchedule(existing.schedule ?? 'weekly');
        if (existing.cycleStartDate) setCycleStartDate(existing.cycleStartDate);
      } else {
        setDays([{ id: uid(), name: 'Día 1', exercises: [] }]);
      }
      setLoading(false);
    })();
  }, [clientId, profile]);

  const addDay = () => {
    const id = uid();
    setDays((prev) => [...prev, { id, name: `Día ${prev.length + 1}`, exercises: [] }]);
    setExpandedDays((prev) => ({ ...prev, [id]: true })); // el día nuevo se abre
  };

  const removeDay = (dayId: string) => {
    setDays((prev) => prev.filter((d) => d.id !== dayId));
  };

  // Mueve un día una posición arriba o abajo (reordenar la semana / el ciclo).
  const moveDay = (index: number, delta: -1 | 1) => {
    setDays((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const list = [...prev];
      [list[index], list[target]] = [list[target], list[index]];
      return list;
    });
  };

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

  const addExerciseToDay = (dayId: string, exercise: Exercise) => {
    const routineExercise: RoutineExercise = {
      id: uid(),
      exerciseId: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: exercise.measure === 'seconds' ? '30' : '10',
      measure: exercise.measure ?? 'reps',
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
    field: 'sets' | 'reps' | 'restSeconds' | 'notes' | 'rir',
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
  const moveExercise = (dayId: string, index: number, delta: -1 | 1) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const target = index + delta;
        if (target < 0 || target >= d.exercises.length) return d;
        const list = [...d.exercises];
        [list[index], list[target]] = [list[target], list[index]];
        return { ...d, exercises: list };
      })
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
            title="Plantillas"
            variant="secondary"
            onPress={openTemplates}
            style={{ flex: 1 }}
          />
          <Button
            title="Copiar de un alumno"
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
              Método REIN TENA
            </Text>
          </Pressable>
        </View>

        {schedule === 'cycle' ? (
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

      {days.map((day, dayIndex) => {
        const isOpen = expandedDays[day.id] ?? dayIndex === 0;
        const exCount = day.exercises.length;
        const summaryParts: string[] = [];
        if (schedule === 'cycle') {
          if (day.optionalRest) summaryParts.push(`Día ${dayIndex + 1}`, 'Descanso opcional');
          else if (day.isRest) summaryParts.push(`Día ${dayIndex + 1}`, 'Descanso');
          else summaryParts.push(`Día ${dayIndex + 1}`, `Int. ${day.intensity ?? 5}/10`);
        } else if (day.weekday !== undefined) {
          summaryParts.push(WEEKDAY_NAMES[day.weekday]);
        }
        summaryParts.push(`${exCount} ${exCount === 1 ? 'ejercicio' : 'ejercicios'}`);
        return (
        <Card key={day.id} style={styles.dayCard}>
          <View style={styles.dayHeaderRow}>
            <Pressable
              style={styles.dayHeaderMain}
              onPress={() => toggleDayExpanded(day.id, dayIndex === 0)}
            >
              <Text style={styles.dayTitle} numberOfLines={1}>
                {day.name || `Día ${dayIndex + 1}`}
              </Text>
              <Text style={styles.daySummary} numberOfLines={1}>
                {summaryParts.join(' · ')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => moveDay(dayIndex, -1)}
              disabled={dayIndex === 0}
              style={[styles.moveDayBtn, dayIndex === 0 && styles.moveDayBtnOff]}
              hitSlop={6}
            >
              <Ionicons name="arrow-up" size={16} color={colors.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => moveDay(dayIndex, 1)}
              disabled={dayIndex === days.length - 1}
              style={[styles.moveDayBtn, dayIndex === days.length - 1 && styles.moveDayBtnOff]}
              hitSlop={6}
            >
              <Ionicons name="arrow-down" size={16} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => duplicateDay(day.id)} style={styles.removeDayBtn} hitSlop={8}>
              <Ionicons name="copy-outline" size={17} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => removeDay(day.id)} style={styles.removeDayBtn} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
            <Pressable onPress={() => toggleDayExpanded(day.id, dayIndex === 0)} hitSlop={8}>
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
          ) : (
          <View style={styles.weekdayRow}>
            <Text style={styles.weekdayLabel}>Día de la semana</Text>
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
          </View>
          )}

          {day.exercises.map((ex, exIndex) => (
            <View
              key={ex.id}
              style={[styles.exerciseRow, ex.supersetWithPrevious && styles.exerciseRowLinked]}
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
                  {resolveLoad(ex) === 'assisted' ? '  🟡' : resolveLoad(ex) === 'weighted' ? '  🏋️' : ''}
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
                <Pressable
                  onPress={() => moveExercise(day.id, exIndex, -1)}
                  style={styles.moveBtn}
                  hitSlop={4}
                >
                  <Ionicons name="chevron-up" size={16} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  onPress={() => moveExercise(day.id, exIndex, 1)}
                  style={styles.moveBtn}
                  hitSlop={4}
                >
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </Pressable>
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

              <View style={styles.exerciseFields}>
                <TextField
                  label="Series"
                  keyboardType="number-pad"
                  value={String(ex.sets)}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'sets', v)}
                  style={styles.smallInput}
                />
                <TextField
                  label={ex.measure === 'seconds' ? 'Aguante (seg)' : 'Reps'}
                  value={ex.reps}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'reps', v)}
                  placeholder={ex.measure === 'seconds' ? '30' : '8-12'}
                  style={styles.smallInput}
                />
              </View>
              <View style={styles.exerciseFields}>
                <TextField
                  label="RIR"
                  keyboardType="number-pad"
                  value={ex.rir !== undefined ? String(ex.rir) : ''}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'rir', v)}
                  placeholder="2"
                  style={styles.smallInput}
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
                  style={styles.smallInput}
                />
              </View>
              <TextField
                label="Indicaciones (opcional)"
                value={ex.notes ?? ''}
                onChangeText={(v) => updateExerciseField(day.id, ex.id, 'notes', v)}
                placeholder="Tempo, agarre, técnica..."
                style={{ marginBottom: 0, marginTop: spacing.xs }}
              />
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
          ))}

          <Button
            title="+ Añadir ejercicio"
            variant="secondary"
            onPress={() => {
              setExerciseSearch('');
              setPickerForDay(day.id);
            }}
            style={{ marginTop: spacing.sm }}
          />
          </>
          ) : null}
        </Card>
        );
      })}

      <Modal
        visible={pickerForDay !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerForDay(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Añadir ejercicio</Text>
              <Pressable onPress={() => setPickerForDay(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <TextField
              placeholder="Buscar ejercicio..."
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              autoCapitalize="none"
              style={{ marginBottom: spacing.sm }}
            />
            {exercises.length === 0 ? (
              <Text style={styles.mutedText}>
                No tienes ejercicios en tu biblioteca todavía. Créalos en la pestaña Ejercicios.
              </Text>
            ) : (
              <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                {exercises
                  .filter((ex) =>
                    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase().trim())
                  )
                  .map((ex) => (
                    <Pressable
                      key={ex.id}
                      onPress={() => pickerForDay && addExerciseToDay(pickerForDay, ex)}
                      style={styles.pickerRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerRowText}>
                          {ex.name}
                          {resolveLoad(ex) === 'assisted' ? '  🟡' : resolveLoad(ex) === 'weighted' ? '  🏋️' : ''}
                        </Text>
                        <Text style={styles.pickerRowMuscle}>
                          {ex.muscleGroup}
                          {ex.measure === 'seconds' ? ' · isométrico' : ''}
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={22} color={colors.primary} />
                    </Pressable>
                  ))}
              </ScrollView>
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
  moveDayBtnOff: { opacity: 0.3 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayNameInput: { flex: 1, marginBottom: 0 },
  removeDayBtn: { paddingHorizontal: spacing.sm },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayHeaderMain: { flex: 1, paddingVertical: spacing.xs },
  dayTitle: { ...typography.h3, color: colors.text },
  daySummary: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  removeDayText: { ...typography.small, color: colors.danger },
  weekdayRow: { marginTop: spacing.sm, marginBottom: spacing.sm },
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
