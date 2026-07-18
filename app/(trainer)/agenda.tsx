import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ProgressBar } from '../../components/ProgressBar';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TaskEditSheet } from '../../components/TaskEditSheet';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import {
  createCoachTask,
  deleteCoachTask,
  getCoachTasks,
  updateCoachTask,
} from '../../lib/firestore/coachTasks';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import { TASK_SCOPE_LABEL, type CoachTask, type TaskScope } from '../../lib/types';

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

export default function AgendaScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<CoachTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<TaskScope>('day');
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<CoachTask | null>(null);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const data = await getCoachTasks(profile.uid);
    setTasks(data);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setLoading(false));
    }, [load])
  );

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

  // Progreso de la cabecera según el cubo activo.
  const header = useMemo(() => {
    if (scope === 'goal') {
      const goals = inScope;
      const avg =
        goals.length > 0
          ? goals.reduce((s, g) => s + (g.progress ?? (g.done ? 100 : 0)), 0) / goals.length
          : 0;
      return { progress: avg / 100, text: `${Math.round(avg)}% de media`, total: goals.length };
    }
    const total = inScope.length;
    const doneN = done.length;
    return {
      progress: total > 0 ? doneN / total : 0,
      text: total > 0 ? `${doneN} de ${total} hechas` : 'Sin tareas',
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
    // Mantén el foco para capturar varias seguidas.
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

  const toggleDone = async (task: CoachTask) => {
    haptic();
    animate();
    const next = !task.done;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: next, doneAt: next ? Date.now() : undefined } : t))
    );
    updateCoachTask(task.id, { done: next, doneAt: next ? Date.now() : undefined }).catch(() => {});
  };

  const toggleFlag = async (task: CoachTask) => {
    haptic();
    animate();
    const next = !task.flagged;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, flagged: next } : t)));
    updateCoachTask(task.id, { flagged: next || undefined }).catch(() => {});
  };

  const setGoalProgress = async (task: CoachTask, value: number) => {
    haptic();
    const v = Math.max(0, Math.min(100, value));
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, progress: v, done: v >= 100 } : t))
    );
    updateCoachTask(task.id, { progress: v, done: v >= 100 }).catch(() => {});
  };

  if (loading) return <LoadingScreen />;

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const allDone = scope !== 'goal' && header.total > 0 && active.length === 0;

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mi agenda</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(trainer)/calendar')}
          style={styles.calBtn}
          hitSlop={6}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.calBtnText}>Calendario</Text>
        </Pressable>
      </View>

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

      {/* Cubos */}
      <View style={styles.segments}>
        {SCOPES.map((s) => {
          const count = pendingCount(s);
          const isActive = scope === s;
          return (
            <Pressable
              key={s}
              onPress={() => {
                animate();
                setScope(s);
                setShowDone(false);
              }}
              style={[styles.segment, isActive && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {TASK_SCOPE_LABEL[s]}
              </Text>
              {count > 0 ? (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Captura rápida */}
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

      {/* Lista */}
      {scope === 'goal' ? (
        <GoalsList
          goals={active.concat(done)}
          onEdit={setEditing}
          onProgress={setGoalProgress}
        />
      ) : (
        <>
          {active.length === 0 && done.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="sunny-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Nada por aquí</Text>
              <Text style={styles.emptySub}>
                Apunta lo que quieras sacar adelante {TASK_SCOPE_LABEL[scope].toLowerCase()}. Escribe
                arriba y pulsa intro.
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
              <Ionicons
                name={showDone ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textFaint}
              />
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

      <TaskEditSheet task={editing} onClose={() => setEditing(null)} onChanged={load} />
    </ScreenContainer>
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
          Marca metas de negocio (alumnos, ingresos, contenido…) y ve su avance. Escribe arriba para
          crear la primera.
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
                <Pressable
                  onPress={() => onProgress(goal, p - 25)}
                  style={styles.goalStep}
                  hitSlop={6}
                >
                  <Ionicons name="remove" size={18} color={colors.primary} />
                </Pressable>
                <Text style={styles.goalStepHint}>Ajusta el avance</Text>
                <Pressable
                  onPress={() => onProgress(goal, p + 25)}
                  style={styles.goalStep}
                  hitSlop={6}
                >
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.h1, color: colors.text },
  date: { ...typography.small, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  calBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    marginTop: 4,
  },
  calBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  progressWrap: { marginTop: spacing.lg, marginBottom: spacing.lg },
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
  segments: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  segmentTextActive: { color: colors.onPrimary },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: { backgroundColor: 'rgba(0,0,0,0.18)' },
  badgeText: { ...typography.small, color: colors.textMuted, fontSize: 10, fontFamily: fonts.semiBold },
  badgeTextActive: { color: colors.onPrimary },
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
  addBtn: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
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
  doneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  doneHeaderText: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  // Objetivos
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
  goalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
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
  // Vacío
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
});
