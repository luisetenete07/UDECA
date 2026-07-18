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

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
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
          subtitle: c.monthlyFeeEur ? `${c.monthlyFeeEur} €` : 'Renovación',
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

  if (loading) return <LoadingScreen />;

  const anchor = new Date(monthAnchor);
  const monthLabel = anchor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1).getTime();
  const today = startOfDay(Date.now());

  const days = [...eventsByDay.keys()]
    .filter((d) => d >= monthAnchor && d < monthEnd)
    .sort((a, b) => a - b);
  const monthCount = days.reduce((n, d) => n + (eventsByDay.get(d)?.length ?? 0), 0);

  const shiftMonth = (delta: number) => {
    setMonthAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1).getTime());
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Calendario</Text>
      <Text style={styles.subtitle}>Cobros, vencimientos de ciclos y tareas, todo en un sitio.</Text>

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

      {days.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-clear-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Mes despejado</Text>
          <Text style={styles.emptySub}>
            No hay cobros, ciclos ni tareas este mes. Cuando pongas fechas a los pagos o a los
            ciclos de tus alumnos, aparecerán aquí.
          </Text>
        </View>
      ) : (
        days.map((day) => {
          const d = new Date(day);
          const isToday = day === today;
          const isPast = day < today;
          return (
            <View key={day} style={styles.dayGroup}>
              <View style={styles.dayCol}>
                <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{d.getDate()}</Text>
                <Text style={[styles.dayWk, isToday && styles.dayWkToday]}>
                  {d.toLocaleDateString('es-ES', { weekday: 'short' })}
                </Text>
              </View>
              <View style={styles.dayEvents}>
                {isToday ? <Text style={styles.todayTag}>HOY</Text> : null}
                {(eventsByDay.get(day) ?? []).map((e, i) => (
                  <Pressable
                    key={i}
                    onPress={e.onPress}
                    style={[styles.event, isPast && styles.eventPast]}
                  >
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
                ))}
              </View>
            </View>
          );
        })
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
      <View style={[styles.legendDot, { backgroundColor: tone }]} />
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
    marginBottom: spacing.lg,
  },
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
  monthLabel: { ...typography.h3, color: colors.text, textTransform: 'capitalize' },
  monthCount: { ...typography.small, color: colors.textFaint, marginTop: 1 },
  dayGroup: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayCol: { width: 40, alignItems: 'center', paddingTop: 2 },
  dayNum: { ...typography.h2, color: colors.text, fontFamily: fonts.heading, fontSize: 22 },
  dayNumToday: { color: colors.primaryBright },
  dayWk: { ...typography.small, color: colors.textFaint, fontSize: 11, textTransform: 'uppercase' },
  dayWkToday: { color: colors.primary },
  dayEvents: { flex: 1, gap: spacing.sm },
  todayTag: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    letterSpacing: 1,
  },
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
  eventPast: { opacity: 0.55 },
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
});
