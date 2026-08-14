import React, { useCallback, useMemo, useRef, useState } from 'react';
import { nombreDeCiclo } from '../../lib/cyclePlan';
import { frase } from '../../lib/idioma';
import { diaLargo, inicioDelDia, mesLargo } from '../../lib/fechas';
import { useFocusEffect, useRouter } from 'expo-router';
import { LayoutAnimation, Modal, Platform, Pressable, StyleSheet, TextInput, UIManager, useWindowDimensions, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ProgressBar } from '../../components/ProgressBar';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ListSkeleton } from '../../components/Skeleton';
import { TaskEditSheet } from '../../components/TaskEditSheet';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import {
  createCoachTask,
  getCoachTasks,
  updateCoachTask,
} from '../../lib/firestore/coachTasks';
import { getClientsForTrainer } from '../../lib/firestore/users';
import { getCyclesForTrainer } from '../../lib/firestore/cycles';
import { ConectarCalendario } from '../../components/ConectarCalendario';
import { Segmented } from '../../components/Segmented';
import { Dialogo } from '../../components/Dialogo';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import {
  CYCLE_LEVEL_LABEL,
  TASK_SCOPE_LABEL,
  type CoachTask,
  type TaskScope,
  type TrainingCycle,
  type UserProfile,
} from '../../lib/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SCOPES: TaskScope[] = ['day', 'week', 'month', 'goal'];
const PLACEHOLDER: Record<TaskScope, string> = {
  day: 'Añade algo para hoy…',
  week: 'Algo para esta semana…',
  month: 'Algo para este mes…',
  goal: 'Nuevo objetivo de negocio…',
};

function animate() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
}

type EventType = 'payment' | 'cycle-start' | 'cycle-end' | 'task';
interface CalEvent {
  day: number;
  type: EventType;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}
const TONE: Record<EventType, string> = {
  payment: colors.danger,
  'cycle-start': colors.primary,
  'cycle-end': colors.primaryBright,
  task: colors.textMuted,
};
const TYPE_ICON: Record<EventType, keyof typeof Ionicons.glyphMap> = {
  payment: 'card-outline',
  'cycle-start': 'play-outline',
  'cycle-end': 'flag-outline',
  task: 'checkbox-outline',
};

export default function CoachCalendarScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<'calendar' | 'tasks'>('calendar');
  const [loading, setLoading] = useState(true);

  // --- Datos ---
  const [tasks, setTasks] = useState<CoachTask[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [cycles, setCycles] = useState<TrainingCycle[]>([]);

  // --- Tareas ---
  const [scope, setScope] = useState<TaskScope>('day');
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<CoachTask | null>(null);
  // Tarea que el coach está reubicando en el calendario (abre el selector de día).
  const [movingTask, setMovingTask] = useState<CoachTask | null>(null);
  const inputRef = useRef<TextInput>(null);

  // --- Calendario ---
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  });
  const [selectedDay, setSelectedDay] = useState<number>(() => inicioDelDia(Date.now()));
  const { width } = useWindowDimensions();
  const isWide = width >= 820;

  const load = useCallback(async () => {
    if (!profile) return;
    const [taskData, clientData, cycleData] = await Promise.all([
      getCoachTasks(profile.uid).catch(() => []),
      getClientsForTrainer(profile.uid).catch(() => []),
      getCyclesForTrainer(profile.uid).catch(() => []),
    ]);
    setTasks(taskData);
    setClients(clientData);
    setCycles(cycleData);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setLoading(false));
    }, [load])
  );

  // ---------- TAREAS: derivados y acciones ----------
  const inScope = useMemo(() => tasks.filter((t) => t.scope === scope), [tasks, scope]);
  const active = useMemo(
    () =>
      inScope
        .filter((t) => !t.done)
        .sort((a, b) => Number(!!b.flagged) - Number(!!a.flagged) || a.order - b.order),
    [inScope]
  );
  const done = useMemo(
    () => inScope.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    [inScope]
  );
  const pendingCount = (s: TaskScope) => tasks.filter((t) => t.scope === s && !t.done).length;

  const header = useMemo(() => {
    if (scope === 'goal') {
      const goals = inScope;
      const avg =
        goals.length > 0
          ? goals.reduce((s, g) => s + (g.progress ?? (g.done ? 100 : 0)), 0) / goals.length
          : 0;
      return { progress: avg / 100, text: frase`${Math.round(avg)}% de media`, total: goals.length };
    }
    const total = inScope.length;
    return {
      progress: total > 0 ? done.length / total : 0,
      text: total > 0 ? frase`${done.length} de ${total} hechas` : 'Sin tareas',
      total,
    };
  }, [scope, inScope, done]);

  const haptic = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addTask = async () => {
    const title = draft.trim();
    if (!title || !profile) return;
    setDraft('');
    const temp: CoachTask = {
      id: `tmp-${Date.now()}`,
      trainerId: profile.uid,
      title,
      scope,
      done: false,
      progress: scope === 'goal' ? 0 : undefined,
      order: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    animate();
    setTasks((prev) => [...prev, temp]);
    haptic();
    inputRef.current?.focus();
    try {
      const id = await createCoachTask({
        trainerId: profile.uid,
        title,
        scope,
        done: false,
        progress: scope === 'goal' ? 0 : undefined,
        order: temp.order,
      });
      setTasks((prev) => prev.map((t) => (t.id === temp.id ? { ...t, id } : t)));
    } catch {
      showToast('No se pudo guardar');
      setTasks((prev) => prev.filter((t) => t.id !== temp.id));
    }
  };

  const toggleDone = (task: CoachTask) => {
    haptic();
    animate();
    const next = !task.done;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: next, doneAt: next ? Date.now() : undefined } : t))
    );
    updateCoachTask(task.id, { done: next, doneAt: next ? Date.now() : undefined }).catch(() => {});
  };
  const toggleFlag = (task: CoachTask) => {
    haptic();
    animate();
    const next = !task.flagged;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, flagged: next } : t)));
    updateCoachTask(task.id, { flagged: next || undefined }).catch(() => {});
  };
  const setGoalProgress = (task: CoachTask, value: number) => {
    haptic();
    const v = Math.max(0, Math.min(100, value));
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, progress: v, done: v >= 100 } : t)));
    updateCoachTask(task.id, { progress: v, done: v >= 100 }).catch(() => {});
  };
  // Mueve una tarea a otro día del calendario (fija su fecha a las 00:00).
  const moveTask = (task: CoachTask, dayTs: number) => {
    haptic();
    const dueDate = inicioDelDia(dayTs);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, dueDate } : t)));
    updateCoachTask(task.id, { dueDate }).catch(() => {});
    setMovingTask(null);
    showToast('Tarea movida');
  };

  // ---------- CALENDARIO: eventos ----------
  const dayTasks = useMemo(() => tasks.filter((t) => t.scope === 'day' && !t.done), [tasks]);
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalEvent[]>();
    const add = (e: CalEvent) => map.set(e.day, [...(map.get(e.day) ?? []), e]);
    for (const c of clients) {
      if (c.nextPaymentDate) {
        add({
          day: inicioDelDia(c.nextPaymentDate),
          type: 'payment',
          title: `Cobro · ${c.name}`,
          subtitle: c.monthlyFeeEur ? `${c.monthlyFeeEur} €` : 'Renovación',
          onPress: () => router.push(`/(trainer)/clients/${c.uid}`),
        });
      }
    }
    for (const cy of cycles) {
      const who = clients.find((c) => c.uid === cy.clientId)?.name ?? 'alumno';
      if (cy.startDate)
        add({
          day: inicioDelDia(cy.startDate),
          type: 'cycle-start',
          title: frase`Empieza ${nombreDeCiclo(cy.name)}`,
          subtitle: `${CYCLE_LEVEL_LABEL[cy.level]} · ${who}`,
          onPress: () => router.push(`/(trainer)/clients/${cy.clientId}/cycles/${cy.id}`),
        });
      if (cy.endDate)
        add({
          day: inicioDelDia(cy.endDate),
          type: 'cycle-end',
          title: frase`Termina ${nombreDeCiclo(cy.name)}`,
          subtitle: `${CYCLE_LEVEL_LABEL[cy.level]} · ${who}`,
          onPress: () => router.push(`/(trainer)/clients/${cy.clientId}/cycles/${cy.id}`),
        });
    }
    for (const t of dayTasks) {
      add({
        day: inicioDelDia(t.dueDate ?? Date.now()),
        type: 'task',
        title: t.title,
        subtitle: 'Tarea · toca para mover de día',
        onPress: () => setMovingTask(t),
      });
    }
    return map;
  }, [clients, cycles, dayTasks, router]);

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Calendario" subtitle="Cargando..." />
        <ListSkeleton rows={5} />
      </ScreenContainer>
    );
  }

  const today = inicioDelDia(Date.now());
  const anchor = new Date(monthAnchor);
  const monthLabel = mesLargo(anchor);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1).getTime();
  const days = [...eventsByDay.keys()].filter((d) => d >= monthAnchor && d < monthEnd).sort((a, b) => a - b);
  const monthCount = days.reduce((n, d) => n + (eventsByDay.get(d)?.length ?? 0), 0);
  const shiftMonth = (delta: number) =>
    setMonthAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1).getTime());

  // Celdas de la rejilla mensual (lunes→domingo), con huecos de relleno.
  const firstDow = (new Date(anchor.getFullYear(), anchor.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const gridCells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) gridCells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    gridCells.push(new Date(anchor.getFullYear(), anchor.getMonth(), d).getTime());
  while (gridCells.length % 7 !== 0) gridCells.push(null);
  const selectedEvents = eventsByDay.get(selectedDay) ?? [];

  /**
   * Lo siguiente que pasa, a partir del día elegido.
   *
   * Un día sin nada era un callejón: "Sin eventos este día" y a buscar puntos
   * por el calendario a ver dónde hay algo. La mayoría de los días de un
   * entrenador están vacíos, así que ese callejón es el caso NORMAL, no el
   * raro. Ahora el día vacío responde a la pregunta que se venía a hacer: qué
   * es lo próximo y cuándo.
   */
  const proximo = (() => {
    if (selectedEvents.length > 0) return null;
    const dias = [...eventsByDay.keys()].filter((d) => d > selectedDay).sort((a, b) => a - b);
    const dia = dias[0];
    if (dia === undefined) return null;
    const eventos = eventsByDay.get(dia) ?? [];
    if (eventos.length === 0) return null;
    return { dia, evento: eventos[0], cuantos: eventos.length };
  })();
  const goToday = () => {
    const now = new Date();
    setMonthAnchor(new Date(now.getFullYear(), now.getMonth(), 1).getTime());
    setSelectedDay(inicioDelDia(Date.now()));
  };

  const allDone = scope !== 'goal' && header.total > 0 && active.length === 0;

  // Calendario mensual + eventos del día seleccionado.
  const calendarContent = (
    <>
      <View style={styles.monthHeader}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.monthNav} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <View style={styles.monthCenter}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Text style={styles.monthCount}>
            {monthCount === 0 ? 'Sin eventos' : `${monthCount} evento${monthCount === 1 ? '' : 's'}`}
          </Text>
        </View>
        <Pressable onPress={() => shiftMonth(1)} style={styles.monthNav} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <Pressable onPress={goToday} style={styles.todayBtn} hitSlop={6}>
        <Ionicons name="today-outline" size={14} color={colors.primary} />
        <Text style={styles.todayBtnText}>Hoy</Text>
      </Pressable>

      {/* Cabecera L-D */}
      <View style={styles.weekHead}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((w) => (
          <Text key={w} style={styles.weekHeadCell}>
            {w}
          </Text>
        ))}
      </View>

      {/* Rejilla del mes con puntos por tipo de evento */}
      <View style={styles.grid}>
        {gridCells.map((ts, i) => {
          if (ts == null) return <View key={`b${i}`} style={styles.cell} />;
          const evs = eventsByDay.get(ts) ?? [];
          const isToday = ts === today;
          const isSel = ts === selectedDay;
          const types = [...new Set(evs.map((e) => e.type))].slice(0, 4);
          return (
            <Pressable key={ts} style={styles.cell} onPress={() => setSelectedDay(ts)}>
              <View
                style={[
                  styles.cellInner,
                  isToday && !isSel && styles.cellToday,
                  isSel && styles.cellSel,
                ]}
              >
                <Text
                  style={[
                    styles.cellNum,
                    isToday && styles.cellNumToday,
                    isSel && styles.cellNumSel,
                  ]}
                >
                  {new Date(ts).getDate()}
                </Text>
                <View style={styles.dots}>
                  {types.map((t) => (
                    <View key={t} style={[styles.dot, { backgroundColor: TONE[t] }]} />
                  ))}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Eventos del día seleccionado */}
      <View style={styles.selectedHead}>
        <Text style={styles.selectedDate}>{diaLargo(selectedDay)}</Text>
        {selectedDay === today ? <Text style={styles.todayTag}>HOY</Text> : null}
      </View>
      {selectedEvents.length === 0 ? (
        proximo ? (
          <Pressable
            style={styles.proximo}
            onPress={() => {
              const d = new Date(proximo.dia);
              setMonthAnchor(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
              setSelectedDay(proximo.dia);
            }}
          >
            <View style={[styles.eventIcon, { borderColor: TONE[proximo.evento.type] }]}>
              <Ionicons
                name={TYPE_ICON[proximo.evento.type]}
                size={15}
                color={TONE[proximo.evento.type]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proximoEtiqueta}>Nada este día · lo siguiente</Text>
              <Text style={styles.proximoTexto} numberOfLines={1}>
                {proximo.evento.title}
                {proximo.cuantos > 1 ? frase` y ${proximo.cuantos - 1} más` : ''}
              </Text>
              <Text style={styles.proximoCuando}>{diaLargo(proximo.dia)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>
        ) : (
          <Text style={styles.noEvents}>Sin eventos este día.</Text>
        )
      ) : (
        selectedEvents.map((e, i) => (
          <Pressable key={i} onPress={e.onPress} style={styles.event}>
            <View style={[styles.eventBar, { backgroundColor: TONE[e.type] }]} />
            <View style={[styles.eventIcon, { borderColor: TONE[e.type] }]}>
              <Ionicons name={TYPE_ICON[e.type]} size={15} color={TONE[e.type]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle} numberOfLines={1}>
                {e.title}
              </Text>
              {e.subtitle ? <Text style={styles.eventSub}>{e.subtitle}</Text> : null}
            </View>
            {e.onPress ? (
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            ) : null}
          </Pressable>
        ))
      )}

      <View style={styles.legend}>
        <Legend tone={TONE.payment} label="Cobro" />
        <Legend tone={TONE['cycle-start']} label="Empieza ciclo" />
        <Legend tone={TONE['cycle-end']} label="Termina ciclo" />
        <Legend tone={TONE.task} label="Tareas" />
      </View>
    </>
  );

  // Gestor de tareas y objetivos del coach.
  const tasksContent = (
    <>
      <View style={styles.progressWrap}>
        <View style={styles.progressTop}>
          <Text style={styles.progressText}>{header.text}</Text>
          {allDone ? (
            <View style={styles.donePill}>
              <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
              <Text style={styles.donePillText}>Al día</Text>
            </View>
          ) : null}
        </View>
        <ProgressBar progress={header.progress} height={8} />
      </View>

      <Segmented
        compacto
        valor={scope}
        opciones={SCOPES.map((s) => ({
          valor: s,
          texto: TASK_SCOPE_LABEL[s],
          contador: pendingCount(s),
        }))}
        onChange={(s) => {
          animate();
          setScope(s);
          setShowDone(false);
        }}
      />

      <View style={styles.addRow}>
        <Ionicons name="add" size={20} color={colors.primary} />
        <TextInput
          ref={inputRef}
          style={styles.addInput}
          placeholder={PLACEHOLDER[scope]}
          placeholderTextColor={colors.textFaint}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addTask}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        {draft.trim() ? (
          <Pressable onPress={addTask} style={styles.addBtn} hitSlop={6}>
            <Text style={styles.addBtnText}>Añadir</Text>
          </Pressable>
        ) : null}
      </View>

      {scope === 'goal' ? (
        <GoalsList goals={active.concat(done)} onEdit={setEditing} onProgress={setGoalProgress} />
      ) : (
        <>
          {active.length === 0 && done.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="sunny-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Nada por aquí</Text>
              <Text style={styles.emptySub}>
                Apunta lo que quieras sacar adelante {TASK_SCOPE_LABEL[scope].toLowerCase()}.
              </Text>
            </View>
          ) : null}
          {active.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => toggleDone(task)}
              onFlag={() => toggleFlag(task)}
              onEdit={() => setEditing(task)}
            />
          ))}
          {done.length > 0 ? (
            <Pressable
              style={styles.doneHeader}
              onPress={() => {
                animate();
                setShowDone((v) => !v);
              }}
            >
              <Text style={styles.doneHeaderText}>Completadas · {done.length}</Text>
              <Ionicons name={showDone ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textFaint} />
            </Pressable>
          ) : null}
          {showDone
            ? done.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => toggleDone(task)}
                  onFlag={() => toggleFlag(task)}
                  onEdit={() => setEditing(task)}
                />
              ))
            : null}
        </>
      )}
    </>
  );

  return (
    <ScreenContainer>
      <Pressable
        onPress={() => router.push('/(trainer)/dashboard')}
        style={styles.backBtn}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      {/* Título de sección */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>
          {isWide ? 'Calendario y tareas' : view === 'calendar' ? 'Calendario' : 'Tareas'}
        </Text>
        <Text style={styles.screenSubtitle}>
          {isWide
            ? 'Cobros, ciclos y tus tareas, todo a la vista.'
            : view === 'calendar'
              ? 'Cobros, ciclos y tareas de tu grupo, día a día.'
              : 'Tus recordatorios y objetivos como coach.'}
        </Text>
      </View>

      {/* Conmutador (solo en móvil; en ancho se ven las dos columnas a la vez). */}
      {!isWide ? (
        <Segmented
          valor={view}
          opciones={[
            { valor: 'calendar' as const, texto: 'Calendario', icono: 'calendar-outline' },
            { valor: 'tasks' as const, texto: 'Tareas', icono: 'checkbox-outline' },
          ]}
          onChange={(v) => {
            animate();
            setView(v);
          }}
        />
      ) : null}

      {isWide ? (
        // Escritorio/tablet: calendario y tareas juntos, a pantalla completa.
        <View style={styles.twoCol}>
          <View style={styles.colCal}>
            <Text style={styles.colHeading}>Calendario</Text>
            {calendarContent}
          </View>
          <View style={styles.colTasks}>
            <Text style={styles.colHeading}>Tareas y objetivos</Text>
            {tasksContent}
          </View>
        </View>
      ) : view === 'calendar' ? (
        calendarContent
      ) : (
        tasksContent
      )}

      {/* La agenda, en el calendario que ya mira cada mañana. */}
      <ConectarCalendario perfil={profile} tareas={tasks} alumnos={clients} ciclos={cycles} />

      <MoveTaskModal
        task={movingTask}
        onClose={() => setMovingTask(null)}
        onPick={(dayTs) => movingTask && moveTask(movingTask, dayTs)}
      />

      <TaskEditSheet task={editing} onClose={() => setEditing(null)} onChanged={load} />
    </ScreenContainer>
  );
}

const WEEKDAY_HEADS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Selector de día (mini-calendario mensual) para reubicar una tarea. */
function MoveTaskModal({
  task,
  onClose,
  onPick,
}: {
  task: CoachTask | null;
  onClose: () => void;
  onPick: (dayTs: number) => void;
}) {
  const [anchor, setAnchor] = useState(() => {
    const base = task?.dueDate ?? Date.now();
    const d = new Date(base);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  });
  // Reancla el mes al abrir con otra tarea (o su fecha).
  const taskKey = task?.id ?? '';
  const lastKey = useRef(taskKey);
  if (taskKey && taskKey !== lastKey.current) {
    lastKey.current = taskKey;
    const d = new Date(task?.dueDate ?? Date.now());
    const first = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    if (first !== anchor) setAnchor(first);
  }

  if (!task) return null;
  const a = new Date(anchor);
  const monthLabel = mesLargo(a);
  const daysInMonth = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
  const leadRaw = new Date(a.getFullYear(), a.getMonth(), 1).getDay(); // 0=domingo
  const lead = (leadRaw + 6) % 7; // 0 = lunes
  const today = inicioDelDia(Date.now());
  const current = task.dueDate ? inicioDelDia(task.dueDate) : today;
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(a.getFullYear(), a.getMonth(), day).getTime());
  }
  const shift = (delta: number) =>
    setAnchor(new Date(a.getFullYear(), a.getMonth() + delta, 1).getTime());

  return (
    <Dialogo
      visible
      onClose={onClose}
      titulo={`Mover “${task.title}”`}
      texto="Elige el nuevo día para esta tarea."
    >

          <View style={styles.moveMonthRow}>
            <Pressable onPress={() => shift(-1)} style={styles.moveNav} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
            </Pressable>
            <Text style={styles.moveMonthLabel}>{monthLabel}</Text>
            <Pressable onPress={() => shift(1)} style={styles.moveNav} hitSlop={8}>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.moveGridHead}>
            {WEEKDAY_HEADS.map((w, i) => (
              <Text key={i} style={styles.moveHeadCell}>
                {w}
              </Text>
            ))}
          </View>
          <View style={styles.moveGrid}>
            {cells.map((ts, i) => {
              if (ts == null) return <View key={`b${i}`} style={styles.moveCell} />;
              const isToday = ts === today;
              const isCurrent = ts === current;
              return (
                <Pressable key={ts} style={styles.moveCell} onPress={() => onPick(ts)}>
                  <View
                    style={[
                      styles.moveCellInner,
                      isToday && styles.moveCellToday,
                      isCurrent && styles.moveCellCurrent,
                    ]}
                  >
                    <Text style={[styles.moveCellText, isCurrent && styles.moveCellTextOn]}>
                      {new Date(ts).getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.moveQuickRow}>
            <Pressable style={styles.moveQuick} onPress={() => onPick(today)} hitSlop={6}>
              <Text style={styles.moveQuickText}>Hoy</Text>
            </Pressable>
            <Pressable
              style={styles.moveQuick}
              onPress={() => onPick(today + 24 * 60 * 60 * 1000)}
              hitSlop={6}
            >
              <Text style={styles.moveQuickText}>Mañana</Text>
            </Pressable>
          </View>
    </Dialogo>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: tone }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function TaskRow({
  task,
  onToggle,
  onFlag,
  onEdit,
}: {
  task: CoachTask;
  onToggle: () => void;
  onFlag: () => void;
  onEdit: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onToggle} hitSlop={8} style={[styles.check, task.done && styles.checkDone]}>
        {task.done ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}
      </Pressable>
      <Pressable style={styles.rowBody} onPress={onEdit}>
        <Text style={[styles.rowTitle, task.done && styles.rowTitleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        {task.notes ? (
          <Text style={styles.rowNotes} numberOfLines={1}>
            {task.notes}
          </Text>
        ) : null}
      </Pressable>
      {!task.done ? (
        <Pressable onPress={onFlag} hitSlop={8} style={styles.flagBtn}>
          <Ionicons
            name={task.flagged ? 'flag' : 'flag-outline'}
            size={17}
            color={task.flagged ? colors.primary : colors.textFaint}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function GoalsList({
  goals,
  onEdit,
  onProgress,
}: {
  goals: CoachTask[];
  onEdit: (t: CoachTask) => void;
  onProgress: (t: CoachTask, v: number) => void;
}) {
  if (goals.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="flag-outline" size={26} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Tus objetivos como coach</Text>
        <Text style={styles.emptySub}>
          Marca metas de negocio (alumnos, ingresos, contenido…) y ve su avance.
        </Text>
      </View>
    );
  }
  return (
    <>
      {goals
        .slice()
        .sort((a, b) => (a.progress ?? 0) - (b.progress ?? 0) || a.order - b.order)
        .map((goal) => {
          const p = goal.progress ?? (goal.done ? 100 : 0);
          const reached = p >= 100;
          return (
            <View key={goal.id} style={styles.goalCard}>
              <Pressable onPress={() => onEdit(goal)}>
                <View style={styles.goalHead}>
                  <Text style={[styles.goalTitle, reached && styles.goalTitleDone]}>{goal.title}</Text>
                  {reached ? (
                    <View style={styles.reachedPill}>
                      <Ionicons name="trophy" size={12} color={colors.onPrimary} />
                      <Text style={styles.reachedText}>Logrado</Text>
                    </View>
                  ) : (
                    <Text style={styles.goalPct}>{Math.round(p)}%</Text>
                  )}
                </View>
                {goal.notes ? <Text style={styles.goalNotes}>{goal.notes}</Text> : null}
              </Pressable>
              <View style={{ marginTop: spacing.sm }}>
                <ProgressBar progress={p / 100} height={8} />
              </View>
              <View style={styles.goalControls}>
                <Pressable onPress={() => onProgress(goal, p - 25)} style={styles.goalStep} hitSlop={6}>
                  <Ionicons name="remove" size={18} color={colors.primary} />
                </Pressable>
                <Text style={styles.goalStepHint}>Ajusta el avance</Text>
                <Pressable onPress={() => onProgress(goal, p + 25)} style={styles.goalStep} hitSlop={6}>
                  <Ionicons name="add" size={18} color={colors.primary} />
                </Pressable>
              </View>
            </View>
          );
        })}
    </>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  screenHeader: { marginBottom: spacing.md },
  screenTitle: { ...typography.h1, color: colors.text },
  screenSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  // Escritorio/tablet: dos columnas a pantalla completa (calendario + tareas).
  twoCol: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  // El calendario ocupa más ancho que las tareas (aprox. 60/40): la rejilla
  // mensual se ve holgada y las tareas quedan en una columna cómoda al lado.
  colCal: { flex: 1.5, maxWidth: 560 },
  colTasks: { flex: 1, maxWidth: 460 },
  colHeading: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  // Calendario
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  monthNav: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: { alignItems: 'center' },
  monthLabel: { ...typography.h3, color: colors.text },
  monthCount: { ...typography.small, color: colors.textFaint, marginTop: 1 },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  todayBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  weekHead: { flexDirection: 'row', marginBottom: 6 },
  weekHeadCell: {
    flex: 1,
    textAlign: 'center',
    ...typography.small,
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1.3, padding: 2 },
  cellInner: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingTop: 4,
  },
  cellToday: { borderColor: colors.border },
  cellSel: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  cellNum: { ...typography.small, color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  cellNumToday: { color: colors.primaryBright, fontFamily: fonts.heading },
  cellNumSel: { color: colors.primaryBright },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  selectedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  selectedDate: { ...typography.h3, color: colors.text, flexShrink: 1 },
  proximo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  proximoEtiqueta: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  proximoTexto: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  proximoCuando: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  noEvents: { ...typography.small, color: colors.textFaint, marginBottom: spacing.md },
  todayTag: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, fontSize: 10, letterSpacing: 1 },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingRight: spacing.sm,
    overflow: 'hidden',
  },
  eventBar: { width: 4, alignSelf: 'stretch' },
  eventIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    marginVertical: spacing.sm,
  },
  eventTitle: { ...typography.body, color: colors.text, fontFamily: fonts.medium },
  eventSub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  // Tareas
  progressWrap: { marginBottom: spacing.lg },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  progressText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  donePillText: { ...typography.small, color: colors.onPrimary, fontSize: 11, fontFamily: fonts.semiBold },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.md,
    minHeight: 52,
  },
  addInput: { flex: 1, color: colors.text, fontSize: 15, fontFamily: fonts.body, paddingVertical: spacing.sm },
  addBtn: { backgroundColor: colors.primaryMuted, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  addBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  rowBody: { flex: 1, paddingVertical: 2 },
  rowTitle: { ...typography.body, color: colors.text },
  rowTitleDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  rowNotes: { ...typography.small, color: colors.textFaint, marginTop: 1 },
  flagBtn: { padding: 4 },
  doneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, marginTop: spacing.xs },
  doneHeaderText: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  goalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  goalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  goalTitle: { ...typography.h3, color: colors.text, flex: 1 },
  goalTitleDone: { color: colors.primaryBright },
  goalPct: { ...typography.body, color: colors.primaryBright, fontFamily: fonts.semiBold },
  goalNotes: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  reachedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  reachedText: { ...typography.small, color: colors.onPrimary, fontSize: 11, fontFamily: fonts.semiBold },
  goalControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  goalStep: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalStepHint: { ...typography.small, color: colors.textFaint },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  emptySub: { ...typography.small, color: colors.textMuted, textAlign: 'center', maxWidth: 320, lineHeight: 19 },
  // Mover tarea a otro día
  moveMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  moveNav: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveMonthLabel: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  moveGridHead: { flexDirection: 'row', marginBottom: 4 },
  moveHeadCell: { flex: 1, textAlign: 'center', ...typography.small, color: colors.textFaint, fontSize: 11 },
  moveGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  moveCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  moveCellInner: {
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  moveCellToday: { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  moveCellCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  moveCellText: { ...typography.small, color: colors.text, fontFamily: fonts.medium },
  moveCellTextOn: { color: colors.onPrimary, fontFamily: fonts.semiBold },
  moveQuickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  moveQuick: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  moveQuickText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
