import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../lib/auth-context';
import { getClientsForTrainer } from '../../lib/firestore/users';
import { getCyclesForTrainer } from '../../lib/firestore/cycles';
import { getCoachTasks } from '../../lib/firestore/coachTasks';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import { CYCLE_LEVEL_LABEL, type TrainingCycle, type UserProfile } from '../../lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Lunes=0 para un timestamp. */
function weekdayMon0(ts: number): number {
  const d = new Date(ts).getDay();
  return d === 0 ? 6 : d - 1;
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

const TYPE_ICON: Record<EventType, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  payment: 'card-outline',
  'cycle-start': 'play-outline',
  'cycle-end': 'flag-outline',
  task: 'checkbox-outline',
};

export default function CalendarScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [cycles, setCycles] = useState<TrainingCycle[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  });
  const [selected, setSelected] = useState(startOfDay(Date.now()));

  const load = useCallback(async () => {
    if (!profile) return;
    const [clientsData, cyclesData, tasks] = await Promise.all([
      getClientsForTrainer(profile.uid),
      getCyclesForTrainer(profile.uid).catch(() => []),
      getCoachTasks(profile.uid).catch(() => []),
    ]);
    setClients(clientsData);
    setCycles(cyclesData);
    setTaskCount(tasks.filter((t) => t.scope === 'day' && !t.done).length);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setLoading(false));
    }, [load])
  );

  // Agrupa todos los eventos del negocio por día.
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalEvent[]>();
    const add = (e: CalEvent) => {
      const arr = map.get(e.day) ?? [];
      arr.push(e);
      map.set(e.day, arr);
    };
    for (const c of clients) {
      if (c.nextPaymentDate) {
        add({
          day: startOfDay(c.nextPaymentDate),
          type: 'payment',
          title: `Cobro · ${c.name}`,
          subtitle: c.monthlyFeeEur ? `${c.monthlyFeeEur} €` : undefined,
          onPress: () => router.push(`/(trainer)/clients/${c.uid}`),
        });
      }
    }
    for (const cy of cycles) {
      const who = clients.find((c) => c.uid === cy.clientId)?.name ?? 'alumno';
      if (cy.startDate) {
        add({
          day: startOfDay(cy.startDate),
          type: 'cycle-start',
          title: `Empieza ${cy.name}`,
          subtitle: `${CYCLE_LEVEL_LABEL[cy.level]} · ${who}`,
          onPress: () => router.push(`/(trainer)/clients/${cy.clientId}/cycles/${cy.id}`),
        });
      }
      if (cy.endDate) {
        add({
          day: startOfDay(cy.endDate),
          type: 'cycle-end',
          title: `Termina ${cy.name}`,
          subtitle: `${CYCLE_LEVEL_LABEL[cy.level]} · ${who}`,
          onPress: () => router.push(`/(trainer)/clients/${cy.clientId}/cycles/${cy.id}`),
        });
      }
    }
    if (taskCount > 0) {
      add({
        day: startOfDay(Date.now()),
        type: 'task',
        title: `${taskCount} tarea${taskCount === 1 ? '' : 's'} para hoy`,
        subtitle: 'Ver en Agenda',
        onPress: () => router.push('/(trainer)/agenda'),
      });
    }
    return map;
  }, [clients, cycles, taskCount, router]);

  // 42 celdas (6 semanas) empezando en el lunes de la semana del día 1.
  const cells = useMemo(() => {
    const first = new Date(monthAnchor);
    const offset = weekdayMon0(monthAnchor);
    const gridStart = startOfDay(first.getTime()) - offset * DAY_MS;
    return Array.from({ length: 42 }, (_, i) => gridStart + i * DAY_MS);
  }, [monthAnchor]);

  if (loading) return <LoadingScreen />;

  const monthLabel = new Date(monthAnchor).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
  const thisMonth = new Date(monthAnchor).getMonth();
  const today = startOfDay(Date.now());
  const selectedEvents = eventsByDay.get(selected) ?? [];

  const shiftMonth = (delta: number) => {
    const d = new Date(monthAnchor);
    setMonthAnchor(new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime());
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Calendario</Text>
      <Text style={styles.subtitle}>Cobros, vencimientos de ciclos y tareas, todo en un sitio.</Text>

      <View style={styles.monthHeader}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.monthNav} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => shiftMonth(1)} style={styles.monthNav} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekLabel}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day) => {
          const inMonth = new Date(day).getMonth() === thisMonth;
          const isToday = day === today;
          const isSelected = day === selected;
          const evs = eventsByDay.get(day) ?? [];
          const dots = Array.from(new Set(evs.map((e) => e.type))).slice(0, 3);
          return (
            <Pressable
              key={day}
              onPress={() => setSelected(day)}
              style={[styles.cell, isSelected && styles.cellSelected]}
            >
              <View style={[styles.cellNumWrap, isToday && styles.cellToday]}>
                <Text
                  style={[
                    styles.cellNum,
                    !inMonth && styles.cellNumMuted,
                    isToday && styles.cellNumToday,
                  ]}
                >
                  {new Date(day).getDate()}
                </Text>
              </View>
              <View style={styles.dotRow}>
                {dots.map((t) => (
                  <View key={t} style={[styles.dot, { backgroundColor: TONE[t] }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dayHeaderRow}>
        <Text style={styles.dayHeader}>
          {new Date(selected).toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>

      {selectedEvents.length === 0 ? (
        <Text style={styles.emptyDay}>Nada programado este día.</Text>
      ) : (
        selectedEvents.map((e, i) => (
          <Pressable key={i} style={styles.eventRow} onPress={e.onPress}>
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
    </ScreenContainer>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.lg },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthNav: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: { ...typography.h3, color: colors.text, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    ...typography.small,
    color: colors.textFaint,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingTop: 2,
  },
  cellSelected: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.hairline },
  cellNumWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellToday: { backgroundColor: colors.primary },
  cellNum: { ...typography.body, color: colors.text, fontSize: 14 },
  cellNumMuted: { color: colors.textFaint, opacity: 0.5 },
  cellNumToday: { color: colors.onPrimary, fontFamily: fonts.semiBold },
  dotRow: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dayHeaderRow: { marginTop: spacing.lg, marginBottom: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  dayHeader: { ...typography.h3, color: colors.text, textTransform: 'capitalize' },
  emptyDay: { ...typography.small, color: colors.textFaint, paddingVertical: spacing.sm },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  eventBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  eventIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
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
  legendText: { ...typography.small, color: colors.textMuted, fontSize: 12 },
});
