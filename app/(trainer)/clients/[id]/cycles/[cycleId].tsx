import { t, frase } from '../../../../../lib/idioma';
import React, { useCallback, useState } from 'react';
import { diaMes, diaSemanaCorto } from '../../../../../lib/fechas';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../../components/Button';
import { Card } from '../../../../../components/Card';
import { CycleProgress } from '../../../../../components/CycleProgress';
import { CycleSheet } from '../../../../../components/CycleSheet';
import { WeekPlanSheet } from '../../../../../components/WeekPlanSheet';
import { EmptyState } from '../../../../../components/EmptyState';
import { LoadingScreen } from '../../../../../components/LoadingScreen';
import { PlanCalendar } from '../../../../../components/PlanCalendar';
import { ProgressBar } from '../../../../../components/ProgressBar';
import { ProgressMatrix } from '../../../../../components/ProgressMatrix';
import { ScreenContainer } from '../../../../../components/ScreenContainer';
import { StatTile } from '../../../../../components/StatTile';
import { showToast } from '../../../../../components/Toast';
import { useAuth } from '../../../../../lib/auth-context';
import { BlockOverview } from '../../../../../components/BlockOverview';
import { deleteCycles, getCyclesForClient } from '../../../../../lib/firestore/cycles';
import { savePlanAsTemplate } from '../../../../../lib/firestore/planTemplates';
import { TextField } from '../../../../../components/TextField';
import { getExerciseLibrary } from '../../../../../lib/firestore/exercises';
import { getUserProfile } from '../../../../../lib/firestore/users';
import { getWeightLogsForClient } from '../../../../../lib/firestore/weightLogs';
import { getActiveRoutineForClient } from '../../../../../lib/firestore/routines';
import { getWorkoutLogsForClient } from '../../../../../lib/firestore/workoutLogs';
import { computeCycleStats } from '../../../../../lib/cycleStats';
import { descendantIds, nombreDeCiclo } from '../../../../../lib/cyclePlan';
import { buildBlockView } from '../../../../../lib/blockView';
import { buildClientReportHtml } from '../../../../../lib/report';
import { printReportHtml } from '../../../../../lib/printReport';
import { Dialogo } from '../../../../../components/Dialogo';
import { colors, fieldLabel, fonts, radius, spacing, typography } from '../../../../../lib/theme';
import {
  CYCLE_LEVEL_LABEL,
  type Routine,
  type TrainingCycle,
  type UserProfile,
  type WeightLog,
  type WorkoutLog,
} from '../../../../../lib/types';

export default function CycleDashboardScreen() {
  const { id, cycleId } = useLocalSearchParams<{ id: string; cycleId: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [cycles, setCycles] = useState<TrainingCycle[]>([]);
  const [cycle, setCycle] = useState<TrainingCycle | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [muscleByExercise, setMuscleByExercise] = useState<Record<string, string>>({});
  const [measureByExercise, setMeasureByExercise] = useState<Record<string, string>>({});
  // Para la tabla de progreso y el informe, que antes vivían en una pantalla
  // aparte ("Progreso total") y ahora se miran aquí, dentro del ciclo.
  const [client, setClient] = useState<UserProfile | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [planExercises, setPlanExercises] = useState<{ id: string; name: string }[]>([]);
  const [vista, setVista] = useState<{ weeks: number; exerciseIds: string[] }>({
    weeks: 8,
    exerciseIds: [],
  });
  const [exportando, setExportando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplSaving, setTplSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile || !id || !cycleId) return;
    const [cyclesData, logsData, rutina, biblioteca, ficha, pesos] = await Promise.all([
      getCyclesForClient(profile.uid, id),
      getWorkoutLogsForClient(id, profile.uid),
      getActiveRoutineForClient(id, profile.uid).catch(() => null),
      getExerciseLibrary(profile.uid).catch(() => []),
      getUserProfile(id).catch(() => null),
      getWeightLogsForClient(id, profile.uid).catch(() => []),
    ]);
    setCycles(cyclesData);
    setCycle(cyclesData.find((c) => c.id === cycleId) ?? null);
    setLogs(logsData);
    setRoutine(rutina);
    setMuscleByExercise(Object.fromEntries(biblioteca.map((e) => [e.id, e.muscleGroup])));
    setMeasureByExercise(Object.fromEntries(biblioteca.map((e) => [e.id, e.measure ?? 'reps'])));
    setClient(ficha);
    setWeightLogs(pesos);
    // Ejercicios del plan activo, sin repetir: se pueden añadir a la tabla
    // aunque el alumno todavía no los haya registrado nunca.
    const vistos = new Map<string, string>();
    for (const day of rutina?.days ?? []) {
      for (const ex of day.exercises) {
        if (!vistos.has(ex.exerciseId)) vistos.set(ex.exerciseId, ex.name);
      }
    }
    setPlanExercises([...vistos.entries()].map(([exId, name]) => ({ id: exId, name })));
    setLoading(false);
  }, [profile, id, cycleId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setLoading(false));
    }, [load])
  );

  const cuelgan = cycleId ? descendantIds(cycles, cycleId) : [];

  const guardarPlantilla = async () => {
    if (!profile || !cycle) return;
    setTplSaving(true);
    try {
      await savePlanAsTemplate(profile.uid, cycle, cycles, tplName);
      showToast('Plantilla guardada');
      setTplOpen(false);
    } catch {
      showToast('No se pudo guardar la plantilla');
    } finally {
      setTplSaving(false);
    }
  };

  const exportarPdf = async () => {
    if (!client) return;
    setExportando(true);
    try {
      await printReportHtml(
        buildClientReportHtml({
          client,
          routine,
          weightLogs,
          workoutLogs: logs,
          muscleByExercise,
          measureByExercise,
          exerciseIds: vista.exerciseIds,
          weeks: vista.weeks,
          coachName: profile?.name,
        }),
        `informe-${client.name}`
      );
    } catch {
      showToast('No se pudo exportar el PDF');
    } finally {
      setExportando(false);
    }
  };

  const handleDelete = async () => {
    if (!cycleId) return;
    try {
      await deleteCycles([cycleId, ...cuelgan]);
      showToast(cuelgan.length > 0 ? 'Plan eliminado' : 'Ciclo eliminado');
      router.replace(`/(trainer)/clients/${id}/planning`);
    } catch {
      showToast('No se pudo eliminar');
    }
  };

  if (loading) return <LoadingScreen />;
  if (!cycle)
    return (
      <>
        <Stack.Screen options={{ title: t('Ciclo') }} />
        <EmptyState title="Ciclo no encontrado" />
      </>
    );

  const stats = computeCycleStats(cycle, logs);
  const pctText = stats.pctComplete != null ? `${Math.round(stats.pctComplete * 100)}%` : '—';
  const padre = cycle.parentId ? (cycles.find((c) => c.id === cycle.parentId) ?? null) : null;
  const hijos = cycles
    .filter((c) => c.parentId === cycle.id)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: CYCLE_LEVEL_LABEL[cycle.level] }} />

      {padre ? (
        <Pressable
          style={styles.breadcrumb}
          onPress={() => router.push(`/(trainer)/clients/${id}/cycles/${padre.id}`)}
        >
          <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          <Text style={styles.breadcrumbText} numberOfLines={1}>
            {nombreDeCiclo(padre.name)}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.headRow}>
        <Text style={styles.level}>{CYCLE_LEVEL_LABEL[cycle.level]}</Text>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{stats.statusLabel}</Text>
        </View>
        {cycle.isDeload ? (
          <View style={[styles.statusPill, styles.deloadPill]}>
            <Text style={styles.deloadText}>Descarga</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name}>{nombreDeCiclo(cycle.name)}</Text>
      <Text style={styles.dates}>
        {cycle.startDate ? diaMes(cycle.startDate) : 'Sin inicio'}
        {cycle.endDate ? ` – ${diaMes(cycle.endDate)}` : cycle.startDate ? ' · abierto' : ''}
        {stats.durationDays ? ` · ${Math.round(stats.durationDays / 7)} sem` : ''}
        {stats.daysElapsed != null && stats.status === 'active'
          ? frase` · lleva ${stats.daysElapsed} días`
          : ''}
      </Text>

      {stats.pctComplete != null ? (
        <View style={{ marginTop: spacing.md }}>
          <ProgressBar progress={stats.pctComplete} height={8} />
        </View>
      ) : null}

      {/* Una sola semana no tiene reparto que analizar: sus números ya están
          arriba, y hablar "del bloque" mirando siete días es confundir. */}
      {cycle.level !== 'micro' ? (
        <Card style={styles.section}>
          <BlockOverview
            view={buildBlockView({
              cycle,
              cycles,
              logs,
              routine,
              muscleByExercise,
              measureByExercise,
            })}
            title={nombreDeCiclo(cycle.name)}
            subtitle={`${CYCLE_LEVEL_LABEL[cycle.level]} · ${stats.sessionsDone} entreno${
              stats.sessionsDone === 1 ? '' : 's'
            }`}
          />
        </Card>
      ) : null}

      <View style={styles.tilesRow}>
        <StatTile icon="pie-chart" value={pctText} label="Completado" highlight />
        <StatTile
          icon="checkmark-done"
          value={
            stats.targetSessions
              ? `${stats.sessionsDone}/${stats.targetSessions}`
              : String(stats.sessionsDone)
          }
          label="Sesiones"
        />
      </View>
      <View style={styles.tilesRow}>
        <StatTile
          icon="repeat"
          value={
            stats.sessionsPerWeek != null
              ? stats.sessionsPerWeek.toLocaleString('es-ES', { maximumFractionDigits: 1 })
              : '—'
          }
          label="Por semana"
        />
        <StatTile
          icon="barbell"
          value={
            stats.totalVolumeKg > 0 ? stats.totalVolumeKg.toLocaleString('es-ES') : '—'
          }
          label="Volumen (kg)"
        />
      </View>

      <Card style={styles.section}>
        {hijos.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Calendario del plan</Text>
            <PlanCalendar
              root={cycle}
              cycles={cycles}
              logs={logs}
              onPressWeek={(w) =>
                w.micro && router.push(`/(trainer)/clients/${id}/cycles/${w.micro.id}`)
              }
            />
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Días entrenados</Text>
            <CycleProgress cycle={cycle} logs={logs} />
          </>
        )}
      </Card>

      {hijos.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>
            {CYCLE_LEVEL_LABEL[hijos[0].level]}s ({hijos.length})
          </Text>
          {hijos.map((h) => {
            const hs = computeCycleStats(h, logs);
            return (
              <Pressable
                key={h.id}
                style={styles.logRow}
                onPress={() => router.push(`/(trainer)/clients/${id}/cycles/${h.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.logDay}>{h.name}</Text>
                  <Text style={styles.logMeta}>
                    {h.startDate ? diaMes(h.startDate) : '—'}
                    {h.endDate ? ` – ${diaMes(h.endDate)}` : ''} · {hs.sessionsDone}
                    {h.targetSessions ? `/${h.targetSessions}` : ''} entrenos
                    {h.isDeload ? ' · descarga' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {/* La mejor serie de cada ejercicio, semana a semana. Estaba en una
          pantalla suya ("Progreso total"), a la que había que ir por otro
          camino: se miraba el bloque en un sitio y si el alumno mejoraba en
          otro. Vive aquí porque es la misma pregunta —cómo va este ciclo— y
          porque el informe sale con lo que se esté viendo. */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>Progreso por ejercicio</Text>
        <Text style={styles.mutedText}>
          Todo su historial, no solo este ciclo. Elige qué ejercicios seguir: es la misma tabla
          que ve tu alumno.
        </Text>
        <ProgressMatrix
          logs={logs}
          clientId={String(id)}
          ownerId={profile?.uid}
          editable
          planExercises={planExercises}
          onViewChange={setVista}
        />
        <Button
          title="Exportar a PDF"
          variant="secondary"
          onPress={exportarPdf}
          loading={exportando}
          disabled={!client}
          style={{ marginTop: spacing.lg }}
        />
        <Text style={styles.exportHint}>
          Sale con las semanas y los ejercicios que tengas puestos ahora mismo.
        </Text>
      </Card>

      {cycle.goal ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Objetivo</Text>
          <Text style={styles.goalText}>{cycle.goal}</Text>
        </Card>
      ) : null}

      {cycle.notes ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Notas</Text>
          <Text style={styles.notesText}>{cycle.notes}</Text>
        </Card>
      ) : null}

      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>Entrenos del ciclo ({stats.logs.length})</Text>
        {stats.logs.length === 0 ? (
          <Text style={styles.mutedText}>
            Aún no hay entrenos en este rango de fechas. Aparecerán aquí cuando el alumno entrene.
          </Text>
        ) : (
          stats.logs.map((log) => (
            <Pressable
              key={log.id}
              style={styles.logRow}
              onPress={() =>
                router.push(`/(trainer)/clients/${id}/session?logId=${log.id}`)
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.logDay}>{log.dayName}</Text>
                <Text style={styles.logMeta}>
                  {diaSemanaCorto(log.date)}
                  {log.durationMin ? ` · ${log.durationMin} min` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          ))
        )}
      </Card>

      {hijos.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Guardar como plantilla</Text>
          <Text style={styles.mutedText}>
            Guarda este plan entero —bloques, semanas y los números que hayas programado— para
            montárselo a otro alumno de un toque. No se guardan las fechas: esas se eligen al
            aplicarlo.
          </Text>
          <Button
            title="Guardar como plantilla"
            variant="secondary"
            onPress={() => {
              setTplName(cycle.name);
              setTplOpen(true);
            }}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      {cycle.level === 'micro' ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Programación de la semana</Text>
          <Text style={styles.mutedText}>
            {(cycle.weekPlan ?? []).length > 0
              ? frase`${(cycle.weekPlan ?? []).length} ejercicios con números propios esta semana. Tu alumno los ve en su entreno.`
              : 'Esta semana se hace la rutina tal cual. Prográmala si quieres subir series, repeticiones o apretar el RIR.'}
          </Text>
          <Button
            title={(cycle.weekPlan ?? []).length > 0 ? 'Editar la semana' : 'Programar la semana'}
            variant="secondary"
            onPress={() => setWeekOpen(true)}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="Editar ciclo"
          variant="secondary"
          onPress={() => setEditOpen(true)}
          style={{ flex: 1 }}
        />
        <Button
          title="Eliminar"
          variant="danger"
          onPress={() => setConfirmDelete(true)}
          style={{ flex: 1 }}
        />
      </View>

      {cycle.level === 'micro' ? (
        <WeekPlanSheet
          visible={weekOpen}
          micro={cycle}
          cycles={cycles}
          routine={routine}
          trainerId={profile?.uid}
          onClose={() => setWeekOpen(false)}
          onSaved={load}
        />
      ) : null}

      {profile && id ? (
        <CycleSheet
          visible={editOpen}
          trainerId={profile.uid}
          clientId={id}
          cycle={cycle}
          onClose={() => setEditOpen(false)}
          onSaved={load}
        />
      ) : null}

      <Dialogo
        visible={tplOpen}
        onClose={() => setTplOpen(false)}
        titulo="Nombre de la plantilla"
        texto="Con este nombre te saldrá al crear el plan de otro alumno."
      >
        <TextField
          value={tplName}
          onChangeText={setTplName}
          placeholder="Ej. Mi bloque de fuerza"
          containerStyle={{ marginTop: spacing.md, marginBottom: 0 }}
        />
        <Button
          title="Guardar"
          onPress={guardarPlantilla}
          loading={tplSaving}
          style={{ marginTop: spacing.md }}
        />
      </Dialogo>

      <Dialogo
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        icono="trash-outline"
        titulo={cuelgan.length > 0 ? '¿Eliminar el plan entero?' : '¿Eliminar este ciclo?'}
        texto={`${
          cuelgan.length > 0
            ? frase`Se borran también los ${cuelgan.length} ciclos que cuelgan de él (bloques y semanas). `
            : 'Se borra solo el ciclo. '
        }Los entrenos del alumno y su historial no se tocan.`}
        accion="Eliminar"
        onAccion={handleDelete}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  breadcrumbText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.medium },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  level: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  statusText: { ...typography.small, color: colors.textMuted, fontSize: 11, fontFamily: fonts.semiBold },
  deloadPill: { borderColor: colors.hairline, backgroundColor: colors.primaryMuted },
  deloadText: { ...typography.small, color: colors.primaryBright, fontSize: 11, fontFamily: fonts.semiBold },
  name: { ...typography.h1, color: colors.text, fontSize: 26 },
  dates: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  tilesRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  section: { marginTop: spacing.md },
  sectionLabel: fieldLabel,
  goalText: { ...typography.body, color: colors.text },
  notesText: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  mutedText: { ...typography.small, color: colors.textMuted, lineHeight: 19 },
  exportHint: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logDay: { ...typography.body, color: colors.text, fontFamily: fonts.medium },
  logMeta: { ...typography.small, color: colors.textFaint, marginTop: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});
