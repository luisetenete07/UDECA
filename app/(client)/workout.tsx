import React, { useCallback, useMemo, useState } from 'react';
import { frase, t } from '../../lib/idioma';
import { diaLargo } from '../../lib/fechas';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip, ChipRow } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { FadeIn } from '../../components/FadeIn';
import { ContadorEmom } from '../../components/ContadorEmom';
import { CronoDeDescanso } from '../../components/CronoDeDescanso';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ApuntarMarca } from '../../components/ApuntarMarca';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { TablaDeEntreno } from '../../components/TablaDeEntreno';
import { VisorDeVideo } from '../../components/VisorDeVideo';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { getExerciseLibrary } from '../../lib/firestore/exercises';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import { getCyclesForClientSelf } from '../../lib/firestore/cycles';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { fetchSyncState, setCycleAnchorRemote } from '../../lib/firestore/sync';
import { applyWeekPlan } from '../../lib/weekPlan';
import { textoIntensidad } from '../../lib/intensidad';
import { queVeElAlumno } from '../../lib/visibilidad';
import { pausaActiva } from '../../lib/pausa';
import { flexLabel, resolveTodaySession } from '../../lib/schedule';
import { planDeLaPrescripcion, textoDeIntensidadDelDia, textoDePrescripcion } from '../../lib/planPersonalizado';
import { esGtg, objetivoDelDia } from '../../lib/gtg';
import { anclaDeLaCuenta, getCycleAnchor, setCycleAnchorForIndex, setCycleAnchorToday } from '../../lib/cycleAnchor';
import { anclaQueManda, type AnclaDelAlumno } from '../../lib/ciclo';
import { calentamientoParaVer } from '../../lib/calentamiento';
import { intervaloDelDia, resumenDelEmom, rondasDelEmom } from '../../lib/emom';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import {
  todayWeekday,
  WEEKDAY_NAMES,
  type ExerciseMeasure,
  type Routine,
  type RoutineDay,
  type RoutineExercise,
  type WorkoutLog,
} from '../../lib/types';

/**
 * ENTRENO: EL PROGRAMA A LA VISTA Y SUS TIEMPOS.
 *
 * Ya no se entrena en directo con la app (ver lib/modoDeEntreno.ts). Esta
 * pestaña es la hoja del entrenador, bien ordenada, y lo que se usa con el
 * móvil en la mano:
 *
 *  - Los días del plan, con el de hoy marcado y abierto.
 *  - El calentamiento y, del día, cada ejercicio con sus series, sus
 *    repeticiones, su descanso, las notas del entrenador y su técnica en vídeo.
 *  - Los tiempos que puso el entrenador, de un toque: el descanso de cada
 *    ejercicio lanza su cuenta atrás (components/TablaDeEntreno), y un día
 *    EMOM trae su contador por rondas (components/ContadorEmom).
 *  - "Apuntar una marca", para quien quiera ir viendo su progreso. Opcional:
 *    no hay nada que empezar ni que terminar.
 *
 * Antes esta pantalla era el entreno entero —4.000 líneas: series, borradores
 * entre dispositivos, récords en directo, resumen al acabar—. Está en el
 * historial del repositorio si algún día vuelve a hacer falta.
 */
export default function WorkoutScreen() {
  const { profile } = useAuth();

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [cycleAnchor, setCycleAnchor] = useState<AnclaDelAlumno | null>(null);
  const [videoByExercise, setVideoByExercise] = useState<Record<string, string>>({});
  const [measureByExercise, setMeasureByExercise] = useState<Record<string, ExerciseMeasure>>({});
  const [videoAbierto, setVideoAbierto] = useState<{ url: string; titulo: string } | null>(null);
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [apuntando, setApuntando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        const [data, historial, ciclos] = await Promise.all([
          getActiveRoutineForClient(profile.uid),
          getWorkoutLogsForClient(profile.uid).catch(() => [] as WorkoutLog[]),
          // Si el entrenador programó ESTA semana (4×8 la primera, 5×8 la
          // tercera), es eso lo que se enseña hoy.
          getCyclesForClientSelf(profile.uid).catch(() => []),
        ]);
        if (cancelled) return;
        const rutina = applyWeekPlan(data, ciclos);
        setRoutine(rutina);
        setLogs(historial);
        // Vídeos de técnica y medidas de la biblioteca del entrenador. La
        // medida de la biblioteca manda sobre la copia de la rutina, por si el
        // entrenador la cambió después.
        if (profile.trainerId) {
          getExerciseLibrary(profile.trainerId)
            .then((library) => {
              if (cancelled) return;
              const videos: Record<string, string> = {};
              const medidas: Record<string, ExerciseMeasure> = {};
              for (const ex of library) {
                if (ex.videoUrl) videos[ex.id] = ex.videoUrl;
                medidas[ex.id] = ex.measure ?? 'reps';
              }
              setVideoByExercise(videos);
              setMeasureByExercise(medidas);
            })
            .catch(() => {});
        }
        // En qué día del ciclo va: el ancla que se decidió más tarde entre
        // este móvil y la cuenta (lib/ciclo.ts).
        const sync = await fetchSyncState(profile.uid).catch(() => null);
        const anchor = rutina
          ? anclaQueManda(
              await getCycleAnchor(rutina.id),
              sync ? anclaDeLaCuenta({ cycleAnchors: sync.cycleAnchors, cycleAnchorsSetAt: sync.cycleAnchorsSetAt }, rutina.id) : null
            )
          : null;
        if (cancelled) return;
        setCycleAnchor(anchor);
        if (rutina && rutina.days.length > 0) {
          // Se abre el día que toca hoy, sea de entrenar o de descansar: la
          // portada dice lo mismo, y dos pantallas que cuentan días distintos
          // hacen dudar del plan. Con "a elección", la primera rutina.
          const hoy = resolveTodaySession(rutina, { alumno: anchor, pausas: profile.planPauses });
          const porDefecto = rutina.days.find((d) => !d.isRest) ?? rutina.days[0];
          setSelectedDayId(
            (prev) =>
              (prev && rutina.days.some((d) => d.id === prev) ? prev : null) ??
              (rutina.schedule === 'flex' ? null : hoy.day?.id ?? hoy.diaDeHoy?.id) ??
              porDefecto.id
          );
        }
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  const todaySession = resolveTodaySession(routine, { alumno: cycleAnchor, pausas: profile?.planPauses });
  const day = routine?.days.find((d) => d.id === selectedDayId) ?? null;
  const ve = queVeElAlumno(routine);
  const planPrescrito = planDeLaPrescripcion(routine);
  const enPausa = pausaActiva(profile?.planPauses);
  const esCiclo = routine?.schedule === 'cycle';
  const esFlex = routine?.schedule === 'flex';
  const medidaDe = useCallback(
    (ex: RoutineExercise) => ex.measure ?? measureByExercise[ex.exerciseId],
    [measureByExercise]
  );
  const ejerciciosDelDia = useMemo(() => day?.exercises ?? [], [day]);

  // Fija qué día del ciclo es HOY (plan desfasado o entreno pospuesto).
  const fijarHoy = async (index: number) => {
    if (!routine || routine.days.length === 0) return;
    const decision = await setCycleAnchorForIndex(routine.id, index, profile?.planPauses);
    setCycleAnchor(decision);
    if (profile) setCycleAnchorRemote(profile.uid, routine.id, decision.ancla, decision.decididaEn);
    setSelectedDayId(routine.days[index].id);
    setDayPickerOpen(false);
    showToast(frase`Hoy es el Día ${index + 1}`);
  };

  const reiniciarCiclo = async () => {
    if (!routine || routine.days.length === 0) return;
    const decision = await setCycleAnchorToday(routine.id, profile?.planPauses);
    setCycleAnchor(decision);
    if (profile) setCycleAnchorRemote(profile.uid, routine.id, decision.ancla, decision.decididaEn);
    setSelectedDayId(routine.days[0].id);
    showToast('Ciclo reiniciado · hoy es el Día 1');
  };

  if (loading) return <LoadingScreen />;

  // Sin rutina no hay descansos del entrenador: el temporizador suelto, que
  // para descansar entre series no hace falta plan.
  if (!routine || routine.days.length === 0) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('Entreno')} />
        <CronoDeDescanso />
        <EmptyState
          icon="barbell-outline"
          title="Sin rutina asignada"
          subtitle="Luis todavía no te ha asignado una rutina en la app. Mientras, tienes el temporizador para tus descansos."
        />
      </ScreenContainer>
    );
  }

  const esHoy = (d: RoutineDay, i: number) =>
    esFlex ? false : esCiclo ? todaySession.cycleIndex === i : d.weekday === todayWeekday();
  const diaGtg = day && (esGtg(routine) || esGtg(routine, day)) ? day : null;
  // Un día EMOM: el tiempo lo marca su contador, no los descansos.
  const diaEmom = day && !diaGtg && day.showIntervalTimer && day.exercises.length > 0 ? day : null;
  // La intensidad, si su entrenador deja verla (lib/visibilidad.ts). En un
  // plan personalizado, en SU escala (porcentaje o sus etiquetas).
  const intensidad =
    day && ve.intensidad && !diaGtg
      ? (esFlex ? textoDeIntensidadDelDia(day, routine.personalizado) : textoIntensidad(day, routine.schedule)) || null
      : null;
  const cal = day && !day.isRest ? calentamientoParaVer(day) : null;
  const calAbierto = cal ? (cal.propio ? !warmupOpen : warmupOpen) : false;
  const indiceDelDia = day ? routine.days.findIndex((d) => d.id === day.id) : -1;

  return (
    <ScreenContainer>
      <ScreenHeader
        title={routine.name || t('Entreno')}
        subtitle={
          esFlex
            ? frase`${flexLabel(routine.scheduleLabel)} · eliges tú según cómo estés`
            : esCiclo && todaySession.cycleLabel
              ? todaySession.cycleLabel
              : undefined
        }
      />

      {/* Plan en pausa: se dice, pero el programa se sigue pudiendo ver. */}
      {enPausa ? (
        <View style={styles.pausaAviso}>
          <Ionicons name="pause-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.pausaAvisoTexto}>
            Tu plan está en pausa hasta el {diaLargo(enPausa.hasta)}. Hoy no se espera nada.
          </Text>
        </View>
      ) : null}

      {/* Los días del plan. El de hoy, marcado. */}
      <ChipRow scroll>
        {routine.days.map((d, i) => (
          <Chip
            key={d.id}
            texto={
              (esCiclo
                ? frase`Día ${i + 1}`
                : `${d.weekday !== undefined ? `${WEEKDAY_NAMES[d.weekday].slice(0, 3)} · ` : ''}${d.name}`) +
              (d.optionalRest ? t(' · descanso opcional') : d.isRest ? t(' · descanso') : '') +
              (esHoy(d, i) ? t('  ·  HOY') : '')
            }
            activo={selectedDayId === d.id}
            onPress={() => setSelectedDayId(d.id)}
          />
        ))}
      </ChipRow>

      {esCiclo ? (
        <Pressable onPress={() => setDayPickerOpen(true)} style={styles.cambiarDia} hitSlop={6}>
          <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
          <Text style={styles.cambiarDiaTexto}>¿No vas por este día? Cambiar el día de hoy</Text>
        </Pressable>
      ) : null}

      {!day ? (
        <Card style={styles.aviso}>
          <Text style={styles.avisoTexto}>Elige arriba qué rutina quieres ver.</Text>
        </Card>
      ) : day.isRest || day.optionalRest ? (
        <FadeIn>
          <Card accent style={styles.aviso}>
            <View style={styles.avisoCab}>
              <Ionicons name="bed" size={18} color={colors.primary} />
              <Text style={styles.avisoTitulo}>{day.optionalRest ? 'Descanso opcional' : 'Día de descanso'}</Text>
            </View>
            <Text style={styles.avisoTexto}>
              {day.optionalRest
                ? 'Puedes descansar hoy, o empezar el ciclo de nuevo por el Día 1. Tú decides.'
                : 'Hoy toca recuperar: el descanso también es parte del entrenamiento.'}
            </Text>
            {day.optionalRest ? (
              <Button
                title="Empezar de nuevo por el Día 1"
                variant="secondary"
                onPress={reiniciarCiclo}
                style={{ marginTop: spacing.sm }}
              />
            ) : null}
          </Card>
        </FadeIn>
      ) : (
        <FadeIn key={day.id}>
          <View style={styles.diaCab}>
            <Text style={styles.diaNombre}>
              {esCiclo ? frase`Día ${indiceDelDia + 1}${day.name ? ` · ${day.name}` : ''}` : day.name}
            </Text>
            <Text style={styles.diaSub}>
              {diaGtg
                ? frase`Todo el día · ${objetivoDelDia(routine, day)} series sueltas, ninguna al fallo`
                : [
                    diaEmom
                      ? frase`EMOM · ${resumenDelEmom(rondasDelEmom(diaEmom.exercises).length, intervaloDelDia(diaEmom))}`
                      : day.exercises.length === 1
                        ? t('1 ejercicio')
                        : frase`${day.exercises.length} ejercicios`,
                    intensidad ? frase`Intensidad ${intensidad}` : null,
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
            </Text>
          </View>

          {/* El calentamiento, antes que nada: es lo que se hace ANTES. El de
              su entrenador sale abierto; el de siempre, plegado. */}
          {cal ? (
            <View style={styles.warmupCard}>
              <Pressable onPress={() => setWarmupOpen((o) => !o)} style={styles.warmupHead} hitSlop={6}>
                <Ionicons name="flame-outline" size={15} color={colors.primary} />
                <Text style={styles.warmupTitle}>Calentamiento</Text>
                <Ionicons name={calAbierto ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
              </Pressable>
              {calAbierto ? (
                <View style={styles.warmupList}>
                  {cal.video ? (
                    <Pressable
                      onPress={() => setVideoAbierto({ url: cal.video!, titulo: t('Calentamiento') })}
                      style={styles.warmupVideo}
                      accessibilityRole="button"
                    >
                      <Ionicons name="play-circle" size={22} color={colors.primary} />
                      <Text style={styles.warmupVideoTexto}>Ver el vídeo de calentamiento</Text>
                    </Pressable>
                  ) : null}
                  {cal.nota ? <Text style={styles.warmupNota}>{cal.nota}</Text> : null}
                  {cal.pasos.map((paso, i) => (
                    <View key={i} style={styles.warmupStep}>
                      <View style={styles.warmupNum}>
                        <Text style={styles.warmupNumText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.warmupText}>
                        {paso.texto}
                        {paso.cuanto ? <Text style={styles.warmupCuanto}>{` · ${paso.cuanto}`}</Text> : null}
                      </Text>
                      {paso.video ? (
                        <Pressable
                          onPress={() => setVideoAbierto({ url: paso.video!, titulo: paso.texto })}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={frase`Vídeo de ${paso.texto}`}
                        >
                          <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* EL PROGRAMA DEL DÍA: una fila por ejercicio, con su técnica. */}
          {day.exercises.length > 0 ? (
            <TablaDeEntreno
              day={day}
              medidaDe={medidaDe}
              objetivoDe={(ex) => (ve.objetivo ? textoDePrescripcion(ex, planPrescrito) : null)}
              videoDe={(ex) => videoByExercise[ex.exerciseId]}
              onVideo={(url, titulo) => setVideoAbierto({ url, titulo })}
              conCuentaAtras
              sinDescansos={!!diaEmom || !!diaGtg}
            />
          ) : (
            <Card style={styles.aviso}>
              <Text style={styles.avisoTexto}>Luis aún no ha puesto ejercicios en este día.</Text>
            </Card>
          )}

          {/* EL EMOM: su contador, justo debajo de lo que se hace en cada ronda. */}
          {diaEmom ? <ContadorEmom day={diaEmom} medidaDe={medidaDe} /> : null}

          {day.exercises.length > 0 && profile ? (
            <Pressable onPress={() => setApuntando(true)} style={styles.apuntar} accessibilityRole="button">
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={styles.apuntarTexto}>Apuntar una marca</Text>
              <Text style={styles.apuntarHint}>Opcional, para ver tu progreso</Text>
            </Pressable>
          ) : null}
        </FadeIn>
      )}

      {/* Hueco para que el descanso flotando (components/GlobalRestTimer) no
          tape lo último de la pantalla. */}
      <View style={{ height: 96 }} />

      <VisorDeVideo
        visible={videoAbierto !== null}
        url={videoAbierto?.url}
        titulo={videoAbierto?.titulo}
        profile={profile}
        onCerrar={() => setVideoAbierto(null)}
        protegido={false}
      />

      {esCiclo ? (
        <Sheet
          visible={dayPickerOpen}
          onClose={() => setDayPickerOpen(false)}
          titulo={t('¿Qué día te toca hoy?')}
          descripcion={t('Si te has saltado un día o lo has cambiado, dile a la app por dónde vas.')}
        >
          {routine.days.map((d, i) => (
            <Button
              key={d.id}
              title={frase`Día ${i + 1}${d.name ? ` · ${d.name}` : ''}${d.isRest ? t(' (descanso)') : ''}`}
              variant={todaySession.cycleIndex === i ? 'primary' : 'secondary'}
              onPress={() => fijarHoy(i)}
              style={{ marginTop: spacing.sm }}
            />
          ))}
        </Sheet>
      ) : null}

      {day && profile ? (
        <ApuntarMarca
          visible={apuntando}
          onClose={() => setApuntando(false)}
          profile={profile}
          routine={routine}
          dayName={day.name}
          ejercicios={ejerciciosDelDia}
          medidaDe={medidaDe}
          logs={logs}
          onGuardada={setLogs}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pausaAviso: {
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
  pausaAvisoTexto: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 18 },
  cambiarDia: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: spacing.xs, marginBottom: spacing.sm },
  cambiarDiaTexto: { ...typography.small, color: colors.primary },
  aviso: { marginBottom: spacing.md },
  avisoCab: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  avisoTitulo: { ...typography.h3, color: colors.primaryBright },
  avisoTexto: { ...typography.small, color: colors.textMuted, lineHeight: 19 },
  diaCab: { marginTop: spacing.xs, marginBottom: spacing.md },
  diaNombre: { ...typography.h2, color: colors.text },
  diaSub: { ...typography.small, color: colors.textMuted, marginTop: 2 },
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
  warmupCuanto: { color: colors.text, fontFamily: fonts.semiBold },
  warmupNota: { ...typography.small, color: colors.text, lineHeight: 18 },
  warmupVideo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
  },
  warmupVideoTexto: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  apuntar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  apuntarTexto: { ...typography.body, color: colors.primary, fontFamily: fonts.semiBold },
  apuntarHint: { ...typography.small, color: colors.textFaint },
});
