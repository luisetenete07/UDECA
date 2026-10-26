import { diaMes, inicioDelDia } from '../../../../lib/fechas';
import { t, frase  } from '../../../../lib/idioma';
import { unido } from '../../../../lib/texto';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import {
  ajustaPct,
  esfuerzoDePct,
  proporcionIntensidad,
} from '../../../../lib/intensidad';
import { Sheet } from '../../../../components/Sheet';
import { VistaDelAlumno } from '../../../../components/VistaDelAlumno';
import { sugerenciaDeProgresion } from '../../../../lib/progresion';
import { getWorkoutLogsForClient } from '../../../../lib/firestore/workoutLogs';
import { AplicarAVarios } from '../../../../components/AplicarAVarios';
import { Chip, ChipRow } from '../../../../components/Chip';
import { DiasSemana } from '../../../../components/DiasSemana';
import { Opciones } from '../../../../components/Opciones';
import { Segmented } from '../../../../components/Segmented';
import { QuickSheet, type AccionRapida } from '../../../../components/QuickSheet';
import {
  ajustesDeFusion,
  combinarRutinas,
  comoSeCombinan,
  primerasRondas,
  segundosDeMinutos,
  textoDeDescanso,
  type ComoSeCombinan,
} from '../../../../lib/combinarRutinas';
import { RutinaDiariaEditor } from '../../../../components/RutinaDiariaEditor';
import { TextField } from '../../../../components/TextField';
import { DragList } from '../../../../components/DragList';
import { moveItem } from '../../../../lib/useDragReorder';
import {
  alUnirConElAnterior,
  conLoDelBloque,
  encabezaSuperserie,
  igualarEjercicios,
  numerosHeredados,
  primerDiaLibre,
  resumenDeEjercicios,
  unificarSuperseries,
  vaEnSuperserie,
  type Igualar,
} from '../../../../lib/editorRutina';
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
import { getClientsForTrainer, getUserProfile, setClientTrackRir } from '../../../../lib/firestore/users';
import { notifyUser } from '../../../../lib/notifications';
import { flexLabel, nombreDelDia } from '../../../../lib/schedule';
import { SERIES_POR_DEFECTO } from '../../../../lib/gtg';
import {
  diasParaGuardar,
  ejemploDeLaVariable,
  LARGO_DEL_NOMBRE_DE_VARIABLE,
  MAX_NIVELES,
  MAX_NIVELES_INTENSIDAD,
  NIVELES_DE_INTENSIDAD_POR_DEFECTO,
  NIVELES_POR_DEFECTO,
  nivelesDeIntensidad,
  nivelesDeTexto,
  nombreDeLaVariable,
  POR_DEFECTO,
  prescripcionDe,
  resumenDePrescripcion,
  rirDeTexto,
  textoDeIntensidadDelDia,
  type CuandoElEsfuerzo,
  type EscalaDeEsfuerzo,
  type EscalaDeIntensidad,
  type PlanPersonalizado,
  type PrescripcionDelPlan,
  type VariableDeEjercicio,
  planDeLaPrescripcion,
} from '../../../../lib/planPersonalizado';
import { generateRoutineDraft } from '../../../../lib/routineGenerator';
import {
  modoDelAlumno,
  queVeElAlumno,
  visibilidadAGuardar,
  type ModoDelAlumno,
  type QueVeElAlumno,
} from '../../../../lib/visibilidad';
import { minutosSegundos, segundosDeTexto } from '../../../../lib/duracion';
import { nuevoId } from '../../../../lib/ids';
import { medidaDelGrupo } from '../../../../lib/medidaDeGrupo';
import { colors, fieldLabel, fonts, radius, spacing, typography } from '../../../../lib/theme';
import {
  CLUSTER_DEFAULT,
  clusterBlocks,
  type ClusterConfig,
  type Exercise,
  type ExerciseLoad,
  type ExerciseMeasure,
  GRIP_LABEL,
  GRIP_TYPES,
  type GripType,
  isDualMeasure,
  isHoldMeasure,
  LOAD_LABEL,
  LOAD_TYPES,
  MEASURE_SHORT,
  MUSCLE_GROUPS,
  type MuscleGroup,
  resolveLoad,
  type RoutineDay,
  type RoutineExercise,
  type RoutineSchedule,
  type RoutineTemplate,
  type UserProfile,
  type WorkoutLog,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
} from '../../../../lib/types';

/** Variantes de carga elegibles al montar la rutina (por ejercicio del plan). */
/**
 * Una casilla de número de la ficha del ejercicio: etiqueta corta en una línea
 * y campo bajo. Cuatro o cinco caben en una fila de móvil; con el TextField de
 * siempre (52 de alto, etiqueta que se parte) cabían dos.
 */
function Casilla({
  etiqueta,
  ...resto
}: { etiqueta: string } & React.ComponentProps<typeof TextField>) {
  return (
    <View style={styles.casilla}>
      <Text style={styles.casillaEtiqueta} numberOfLines={1}>
        {etiqueta}
      </Text>
      <TextField {...resto} containerStyle={styles.casillaCaja} style={styles.casillaCampo} />
    </View>
  );
}

/**
 * Lo que hay puesto dentro de "más opciones", en una línea: así se sabe sin
 * abrirlo. Vacío si no hay nada.
 */
function resumenDeOpciones(ex: RoutineExercise): string {
  const partes: string[] = [];
  if (ex.grip) partes.push(t(GRIP_LABEL[ex.grip]));
  if (ex.cluster) partes.push(`${t('Clúster')} ${clusterBlocks(ex.cluster)}×${ex.cluster.restSeconds}s`);
  if (ex.goal) partes.push(`${t('Objetivo')}: ${ex.goal}`);
  if (ex.notes?.trim()) partes.push(`"${ex.notes.trim()}"`);
  return partes.join(' · ');
}

/** Lo que puede acompañar a cada ejercicio, en los tres tipos de plan. */
const VARIABLES_DE_EJERCICIO: [VariableDeEjercicio, string][] = [
  ['rir', 'RIR'],
  ['rpe', 'RPE'],
  ['porcentaje', '% RM'],
  ['tempo', 'Tempo'],
  ['propia', 'La mía'],
  ['ninguna', 'Nada'],
];

/** La superserie se hace toda junta: unas series y un descanso por bloque. */
function conSuperseriesJuntas(dias: RoutineDay[]): RoutineDay[] {
  return dias.map((d) => (d.gtg ? d : { ...d, exercises: unificarSuperseries(d.exercises) }));
}

export default function RoutineEditorScreen() {
  const { id: clientId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // "Ver como el alumno" y "Aplicar a otros alumnos" (paneles de abajo).
  const [verComoAlumno, setVerComoAlumno] = useState(false);
  // El historial del alumno: para sugerir subir lo que ya cumple de sobra.
  const [logsDelAlumno, setLogsDelAlumno] = useState<WorkoutLog[]>([]);
  useEffect(() => {
    if (!clientId || !profile) return;
    getWorkoutLogsForClient(clientId, profile.uid)
      .then(setLogsDelAlumno)
      .catch(() => {});
  }, [clientId, profile]);
  const [aplicarVarios, setAplicarVarios] = useState(false);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [name, setName] = useState('Rutina personalizada');
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pickerForDay, setPickerForDay] = useState<string | null>(null);
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  /*
   * TODO LO QUE NO ES MONTAR LA RUTINA, EN UN MENÚ.
   *
   * Arriba había tres botones (Borrador, Plantillas, Copiar) y abajo otros
   * tres (Ver como el alumno, Aplicar a otros, Guardar también como
   * plantilla): seis botones alrededor de lo único que se viene a hacer, que es
   * poner ejercicios y guardar. Ahora van juntos en "Más", al lado del nombre,
   * y abajo queda "Guardar rutina" solo.
   */
  const [masAbierto, setMasAbierto] = useState(false);
  /** El menú de un día (duplicar, borrar), por id de día. */
  const [menuDia, setMenuDia] = useState<string | null>(null);
  // "Igualar el día": qué día y lo escrito en sus casillas (vacío = no tocar).
  const [igualando, setIgualando] = useState<string | null>(null);
  const [ig, setIg] = useState({ sets: '', reps: '', segundos: '', rir: '', prescrito: '', descanso: '' });
  /** "Lo que ve el alumno", plegado: se toca poco y ocupaba media pantalla. */
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  /** Los días con "más del día" (EMOM, aproximaciones) a la vista. */
  const [masDelDia, setMasDelDia] = useState<Set<string>>(() => new Set());
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
  // La medida que impone el grupo elegido, si ese grupo ya la tiene decidida.
  const medidaDelNuevoGrupo = medidaDelGrupo(profile?.subgroupMeasures, newGroup, newSubgroup);
  const [newLoad, setNewLoad] = useState<ExerciseLoad>('none');
  const [newVideo, setNewVideo] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [schedule, setSchedule] = useState<RoutineSchedule>('weekly');
  const [scheduleLabel, setScheduleLabel] = useState('Personalizado');
  /*
   * Cómo funciona por dentro el plan personalizado.
   *
   * Se guarda entero en la rutina (ver lib/planPersonalizado.ts): la escala con
   * la que se mide el esfuerzo, cuándo se pregunta, qué ve el alumno antes de
   * elegir, cómo se llaman las cosas y qué puede tocar.
   */
  const [perso, setPerso] = useState<PlanPersonalizado>(POR_DEFECTO);
  // Las etiquetas de la escala propia se teclean seguidas, separadas por comas.
  const [nivelesTexto, setNivelesTexto] = useState(NIVELES_POR_DEFECTO.join(', '));
  // Y las de la intensidad propia de cada día, igual: seguidas, con comas.
  const [nivelesIntensidadTexto, setNivelesIntensidadTexto] = useState(
    NIVELES_DE_INTENSIDAD_POR_DEFECTO.join(', ')
  );
  const [personalizacionAbierta, setPersonalizacionAbierta] = useState(false);
  /*
   * LA PRESCRIPCIÓN DE LA SEMANA Y DE LOS DÍAS SUELTOS.
   *
   * Qué acompaña a cada ejercicio no tiene por qué ser el RIR: hay quien
   * programa con sus letras (A, B, C), con RPE, con tempo o sin nada. Y en los
   * días sueltos, la intensidad del día puede ir de 1 a 10 o con sus
   * etiquetas. Va aparte de la del personalizado (`perso`), para que cambiar
   * de tipo de plan y volver no mezcle una con otra.
   */
  const [presSimple, setPresSimple] = useState<PrescripcionDelPlan>({ variable: { tipo: 'rir' } });
  const [nivelesSimplesTexto, setNivelesSimplesTexto] = useState(
    NIVELES_DE_INTENSIDAD_POR_DEFECTO.join(', ')
  );
  /*
   * Qué ve el alumno al entrenar (intensidad del día y objetivo de cada
   * ejercicio). Vale para los tres tipos de plan; ver lib/visibilidad.ts.
   */
  const [visibilidad, setVisibilidad] = useState<QueVeElAlumno>({});
  /** Cómo ve el alumno su entreno: apuntando en la app o en tabla. */
  const [modoAlumno, setModoAlumno] = useState<ModoDelAlumno>('app');
  // Lo mismo, ya resuelto: qué se enseña en el editor y en el entreno.
  const seMuestra = queVeElAlumno({ visibilidad });
  /*
   * PEDIRLE EL ESFUERZO (RIR) AL TERMINAR CADA EJERCICIO, en los planes por
   * semana y por ciclo. Es parte de cómo se entrena este plan, así que se
   * decide aquí y no en la ficha del alumno, donde ocupaba una tarjeta para
   * un solo interruptor. En el personalizado lo decide "Cuándo se le
   * pregunta".
   *
   * Se sigue guardando donde siempre (`trackRir` en el perfil del alumno):
   * así lo leen igual las versiones de la app que ya están instaladas. Se
   * escribe al guardar, y solo si ha cambiado.
   */
  const [pedirEsfuerzo, setPedirEsfuerzo] = useState(false);
  const pedirEsfuerzoAlAbrir = useRef(false);
  /** Cambia una parte de la configuración sin pisar el resto. */
  const cambiaPerso = (parte: Partial<PlanPersonalizado>) =>
    setPerso((prev) => ({ ...prev, ...parte }));
  const [cycleStartDate, setCycleStartDate] = useState<number>(() => inicioDelDia(Date.now()));
  /*
   * La fecha con la que se abrió la rutina, para saber si el coach la ha
   * CAMBIADO de verdad.
   *
   * Importa porque el alumno puede reiniciar su ciclo o fijar qué día es hoy, y
   * lo que decida el último manda. Si cada vez que el coach guarda la rutina
   * —para corregir una serie, por ejemplo— se anotara que acaba de reprogramar
   * el ciclo, le estaría robando al alumno su día sin querer y sin enterarse.
   */
  const fechaAlAbrir = useRef<number | null>(null);
  /**
   * La configuración tal y como se guarda.
   *
   * Las etiquetas de la escala propia se tecleaban en un campo de texto; aquí
   * se convierten en lista. Y solo se guardan SI la escala es la propia: unas
   * etiquetas colgando de un plan que mide en RIR son un ajuste invisible que
   * reaparece el día que alguien cambie de escala y no entiende de dónde sale.
   */
  const configuracionAGuardar = (): PlanPersonalizado => {
    const { intensidad, variable } = prescripcionDe(perso);
    const nombre = (variable.nombre ?? '').trim().slice(0, LARGO_DEL_NOMBRE_DE_VARIABLE);
    return {
      ...perso,
      esfuerzo: {
        escala: perso.esfuerzo?.escala ?? 'rir',
        cuando: perso.esfuerzo?.cuando ?? 'ejercicio',
        ...(perso.esfuerzo?.escala === 'propia'
          ? { niveles: nivelesDeTexto(nivelesTexto) }
          : {}),
      },
      // Igual que las etiquetas del esfuerzo: solo lo que se usa. Unas
      // etiquetas de intensidad colgando de un plan en porcentaje reaparecen
      // el día que alguien cambia de escala y no entiende de dónde salen.
      prescripcion: {
        intensidad: {
          escala: intensidad.escala,
          ...(intensidad.escala === 'propia'
            ? { niveles: nivelesDeTexto(nivelesIntensidadTexto).slice(0, MAX_NIVELES_INTENSIDAD) }
            : {}),
        },
        variable: {
          tipo: variable.tipo,
          ...(variable.tipo === 'propia' && nombre ? { nombre } : {}),
        },
      },
    };
  };
  /** La prescripción de la semana o de los días sueltos, limpia para guardar. */
  const prescripcionSimpleAGuardar = (): PrescripcionDelPlan => {
    const v = presSimple.variable ?? { tipo: 'rir' as const };
    const nombre = (v.nombre ?? '').trim().slice(0, LARGO_DEL_NOMBRE_DE_VARIABLE);
    const conEtiquetas = schedule === 'cycle' && presSimple.intensidad?.escala === 'propia';
    return {
      variable: { tipo: v.tipo, ...(v.tipo === 'propia' && nombre ? { nombre } : {}) },
      ...(conEtiquetas
        ? {
            intensidad: {
              escala: 'propia' as const,
              niveles: nivelesDeTexto(nivelesSimplesTexto).slice(0, MAX_NIVELES_INTENSIDAD),
            },
          }
        : {}),
    };
  };
  /** Lo que manda en lo que se escribe en cada ejercicio, sea el plan que sea. */
  const planActivo = (): PlanPersonalizado =>
    schedule === 'flex' ? configuracionAGuardar() : { prescripcion: prescripcionSimpleAGuardar() };
  /** En los días sueltos, ¿la intensidad del día va con etiquetas en vez de 1-10? */
  const cicloConEtiquetas = schedule === 'cycle' && presSimple.intensidad?.escala === 'propia';
  const cambiaPresSimple = (parte: Partial<PrescripcionDelPlan>) => setPresSimple((prev) => ({ ...prev, ...parte }));

  /** Cambia una parte de la prescripción sin pisar el resto. */
  const cambiaPrescripcion = (parte: Partial<NonNullable<PlanPersonalizado['prescripcion']>>) =>
    setPerso((prev) => ({ ...prev, prescripcion: { ...prescripcionDe(prev), ...parte } }));
  /*
   * Un ejemplo de fusión con SUS rutinas (las dos primeras con ejercicios):
   * "Flexiones + Dominadas, descanso, Fondos + Remo". Se entiende mejor que
   * cualquier explicación.
   */
  const fusion = ajustesDeFusion(perso);
  const ejemploDeFusion = (() => {
    const dos = days.filter((d) => !d.gtg && !d.isRest && d.exercises.length > 0).slice(0, 2);
    if (dos.length < 2) return '';
    // Ronda a ronda, como se va a entrenar: "Tuck – Press, descanso, Tuck – Press".
    const rondas = primerasRondas(combinarRutinas(dos, 'superseries', fusion), 3).filter((r) => r.length > 1);
    if (rondas.length === 0) return '';
    const pausa = fusion.descanso ? frase`, ${textoDeDescanso(fusion.descanso)} de descanso, ` : t(', descanso, ');
    return rondas.map((r) => r.join(' – ')).join(pausa);
  })();
  /*
   * El descanso tras cada superserie fusionada, escrito a mano cuando no es
   * uno de los botones (null: se enseña el que haya guardado).
   */
  const [descansoOtro, setDescansoOtro] = useState<string | null>(null);
  const DESCANSOS_DE_FUSION = [120, 180, 240, 300, 360];
  const descansoOtroVisible =
    descansoOtro ??
    (fusion.descanso && !DESCANSOS_DE_FUSION.includes(fusion.descanso)
      ? fusion.descanso % 60 === 0
        ? String(fusion.descanso / 60)
        : `${Math.floor(fusion.descanso / 60)}:${String(fusion.descanso % 60).padStart(2, '0')}`
      : '');
  /** Marca (o desmarca) un ejercicio como aislado al fusionar rutinas. */
  const setAislado = (dayId: string, exerciseRowId: string, aislado: boolean) =>
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId ? { ...e, aislado: aislado || undefined } : e
              ),
            }
          : d
      )
    );
  /** Los días tal y como se guardan: cada valor en su sitio (ver diasParaGuardar). */
  const diasAGuardar = () => {
    // La superserie se hace toda junta: unas series y un descanso por bloque.
    const juntos = conSuperseriesJuntas(days);
    if (schedule === 'flex') return diasParaGuardar(juntos, configuracionAGuardar());
    const plan = { prescripcion: prescripcionSimpleAGuardar() };
    const limpios = diasParaGuardar(juntos, plan);
    // Con etiquetas, el 1-10 que hubiera debajo no se queda: reaparecería el
    // día que alguien vuelva a la escala de siempre sin saber de dónde sale.
    if (plan.prescripcion.intensidad?.escala !== 'propia') return limpios;
    return limpios.map(({ intensity: _fuera, ...resto }) => resto);
  };

  const [restText, setRestText] = useState<Record<string, string>>({});
  // Ejercicio pendiente de mover/copiar a otro día (abre el selector de día).
  const [movePicker, setMovePicker] = useState<{ dayId: string; ex: RoutineExercise } | null>(
    null
  );
  // Ejercicios con el recuadro de objetivo abierto (además de los que ya lo tienen).
  const [goalOpen, setGoalOpen] = useState<Record<string, boolean>>({});
  // Qué fichas tienen abiertas las opciones de carga, agarre, notas...
  const [detalleAbierto, setDetalleAbierto] = useState<Record<string, boolean>>({});
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
      setPedirEsfuerzo(clientProfile?.trackRir === true);
      pedirEsfuerzoAlAbrir.current = clientProfile?.trackRir === true;
      if (existing) {
        setRoutineId(existing.id);
        setName(existing.name);
        // Las superseries ya montadas, con unas series y un descanso por
        // bloque (sin cambiar lo que el alumno hacía: lib/editorRutina.ts).
        setDays(conSuperseriesJuntas(existing.days));
        if (existing.prescripcion) {
          setPresSimple(existing.prescripcion);
          const etiquetas = existing.prescripcion.intensidad?.niveles;
          if (etiquetas?.length) setNivelesSimplesTexto(etiquetas.join(', '));
        }
        /*
         * UN PLAN VIEJO DE GREASE THE GROOVE SE ABRE COMO PERSONALIZADO.
         *
         * Ese modo ya no se puede elegir (ver RoutineSchedule en lib/types.ts).
         * Mantener su editor entero vivo para algo que nadie puede crear es
         * pantalla muerta que hay que seguir arreglando; y dejar el plan a
         * medias, con un modo que la app no sabe editar, es peor.
         *
         * Así que se lee como lo que de verdad es: un plan personalizado cuya
         * primera rutina se hace en grease the groove, con sus series al día
         * intactas. Nada se pierde y no queda ningún camino sin salida.
         */
        const modo = existing.schedule ?? 'weekly';
        setSchedule(modo === 'gtg' ? 'flex' : modo);
        if (modo === 'gtg') {
          setDays((prev) =>
            prev.map((d, i) =>
              i === 0
                ? { ...d, gtg: true, gtgSetsPerDay: d.gtgSetsPerDay ?? existing.gtgSetsPerDay }
                : d
            )
          );
        }
        if (existing.scheduleLabel) setScheduleLabel(flexLabel(existing.scheduleLabel));
        setVisibilidad(queVeElAlumno(existing));
        setModoAlumno(modoDelAlumno(existing));
        if (existing.cycleStartDate) setCycleStartDate(existing.cycleStartDate);
        fechaAlAbrir.current = existing.cycleStartDate ?? null;
        if (existing.personalizado) {
          // La prescripción se resuelve aparte: la de POR_DEFECTO (RIR) pisaría la
          // herencia de un plan guardado antes de que existiera (ver prescripcionDe).
          setPerso({
            ...POR_DEFECTO,
            ...existing.personalizado,
            prescripcion: prescripcionDe(existing.personalizado),
          });
          const niveles = existing.personalizado.esfuerzo?.niveles;
          if (niveles?.length) setNivelesTexto(niveles.join(', '));
          const deIntensidad = existing.personalizado.prescripcion?.intensidad?.niveles;
          if (deIntensidad?.length) setNivelesIntensidadTexto(deIntensidad.join(', '));
        }
      } else {
        setDays([{ id: nuevoId(), name: 'Día 1', exercises: [] }]);
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
      frase`Borrador generado (nivel ${t(clientLevel ?? 'Intermedio')}) · revísalo y ajusta`
    );
  };

  const addDay = () => {
    const id = nuevoId();
    setDays((prev) => [
      ...prev,
      {
        id,
        name: `Día ${prev.length + 1}`,
        exercises: [],
        // En la semana, el primer día que aún no tiene nada: así no hay que
        // ir a buscarlo en la fila L-D de cada día nuevo.
        ...(schedule === 'weekly' ? { weekday: primerDiaLibre(prev) } : {}),
      },
    ]);
    setExpandedDays((prev) => ({ ...prev, [id]: true })); // el día nuevo se abre
  };

  const removeDay = (dayId: string) => {
    setDays((prev) => prev.filter((d) => d.id !== dayId));
  };

  // Mueve un día una posición arriba o abajo (reordenar la semana / el ciclo).
  // Desde su menú: arrastrar el asa en un móvil, con la lista llena de campos,
  // es lo más lento que hay para "este va uno más arriba".
  const moverDia = (dayId: string, delta: number) => {
    setDays((prev) => {
      const idx = prev.findIndex((d) => d.id === dayId);
      const destino = idx + delta;
      if (idx < 0 || destino < 0 || destino >= prev.length) return prev;
      return moveItem(prev, idx, destino);
    });
  };

  // Igualar el día (su menú): series, reps, RIR o descanso para todos a la vez.
  const igualarDia = (dayId: string, valores: Igualar) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, exercises: igualarEjercicios(d.exercises, valores) } : d))
    );
    // Los descansos a medio escribir se olvidan: manda lo que se acaba de igualar.
    setRestText({});
  };

  // Duplica un día (con ids nuevos) justo debajo, para no rehacerlo.
  const duplicateDay = (dayId: string) => {
    const newId = nuevoId();
    setDays((prev) => {
      const idx = prev.findIndex((d) => d.id === dayId);
      if (idx < 0) return prev;
      const src = prev[idx];
      const clone: RoutineDay = {
        ...src,
        id: newId,
        name: `${src.name} (copia)`,
        exercises: src.exercises.map((e) => ({ ...e, id: nuevoId() })),
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
  /*
   * Días que comparten el mismo día de la semana.
   *
   * Nada lo impide, y a veces se hace a propósito —dos sesiones el mismo día—,
   * pero la app solo puede PROPONER una: la primera. La otra existe, se ve en la
   * tira de días y se puede entrenar, pero nunca sale como "lo de hoy" ni en los
   * avisos. Sin decirlo, el entrenador cree que ha programado dos y el alumno
   * solo ve una, y ninguno de los dos tiene forma de enterarse.
   */
  const diasRepetidos = (() => {
    const cuenta = new Map<number, number>();
    for (const d of days) {
      if (d.weekday === undefined) continue;
      cuenta.set(d.weekday, (cuenta.get(d.weekday) ?? 0) + 1);
    }
    return new Set([...cuenta.entries()].filter(([, n]) => n > 1).map(([w]) => w));
  })();

  const updateDayWeekday = (dayId: string, weekday: number | undefined) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, weekday } : d)));
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

  // El día al que se están añadiendo ejercicios (el buscador abierto).
  const diaDelPicker = pickerForDay ? days.find((d) => d.id === pickerForDay) : undefined;

  const addExerciseToDay = (dayId: string, exercise: Exercise) => {
    const dia = days.find((d) => d.id === dayId);
    const routineExercise: RoutineExercise = {
      id: nuevoId(),
      exerciseId: exercise.id,
      name: exercise.name,
      // Con los números del de antes: un día se monta casi siempre con las
      // mismas series y el mismo descanso, y teclearlos en cada ejercicio
      // era lo que más tiempo se llevaba (ver numerosHeredados).
      ...numerosHeredados(dia?.exercises ?? [], exercise.measure ?? 'reps'),
      measure: exercise.measure ?? 'reps',
      // La categoría y el subgrupo viajan con el plan: se enseñan durante el
      // entrenamiento junto al nombre —para no confundir dos ejercicios que se
      // llaman parecido— y sostienen el reparto por grupos aunque el ejercicio
      // se renombre o se borre de la biblioteca.
      muscleGroup: exercise.muscleGroup,
      subgroup: exercise.subgroup,
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
        // Si el grupo ya decidió cómo se mide, manda él: es justo para lo que
        // está, para no tener que acordarse ejercicio a ejercicio.
        measure: medidaDelNuevoGrupo ?? newMeasure,
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
    field:
      | 'sets'
      | 'reps'
      | 'seconds'
      | 'side2'
      | 'restSeconds'
      | 'notes'
      | 'rir'
      | 'goal'
      | 'prescrito',
    value: string
  ) => {
    // Las series de una superserie son las de todo el bloque: se hacen juntas.
    if (field === 'sets') {
      setDays((prev) =>
        prev.map((d) => {
          if (d.id !== dayId) return d;
          const i = d.exercises.findIndex((e) => e.id === exerciseRowId);
          if (i < 0) return d;
          const sets = Number(value) || 0;
          return {
            ...d,
            exercises: d.gtg
              ? d.exercises.map((e, k) => (k === i ? { ...e, sets } : e))
              : conLoDelBloque(d.exercises, i, { sets }),
          };
        })
      );
      return;
    }
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId
                  ? {
                      ...e,
                      // El RIR vacío es "sin RIR" y no 0, que es "al fallo"
                      // (ver rirDeTexto): borrar la casilla tiene que quitar
                      // la indicación, no prescribir la más dura.
                      [field]:
                        field === 'rir'
                          ? rirDeTexto(value)
                          : field === 'restSeconds'
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

  // Ajusta el porcentaje de intensidad de una rutina de Sensaciones.
  const eligeIntensidad = (dayId: string, etiqueta: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, intensityLabel: d.intensityLabel === etiqueta ? undefined : etiqueta }
          : d
      )
    );
  };

  const updateDayPct = (dayId: string, delta: number) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, intensityPct: ajustaPct(d.intensityPct, delta) } : d))
    );
  };

  /**
   * Sensaciones: marca esta rutina como grease the groove.
   *
   * Es la opción para el día que el alumno no tiene cuerpo para una sesión:
   * en vez de no hacer nada, seis series fáciles repartidas. Y va por rutina y
   * no por plan entero porque en Sensaciones conviven varias formas de
   * entrenar y el alumno elige una cada mañana.
   */
  const toggleGtgDay = (dayId: string) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, gtg: !d.gtg, isRest: false } : d))
    );
  };

  const updateDayGtgSets = (dayId: string, valor: string) => {
    const n = Number.parseInt(valor, 10);
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, gtgSetsPerDay: Number.isFinite(n) && n > 0 ? n : undefined }
          : d
      )
    );
  };

  const updateDayGtgIndicaciones = (dayId: string, texto: string) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, gtgIndicaciones: texto.trim() ? texto : undefined } : d))
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
  // En una superserie, el descanso es el de todo el bloque (tras la ronda).
  const updateRestSeconds = (dayId: string, exerciseRowId: string, seconds: number) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const i = d.exercises.findIndex((e) => e.id === exerciseRowId);
        if (i < 0) return d;
        return {
          ...d,
          exercises: d.gtg
            ? d.exercises.map((e, k) => (k === i ? { ...e, restSeconds: seconds } : e))
            : conLoDelBloque(d.exercises, i, { restSeconds: seconds }),
        };
      })
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

  // Encadena o desencadena un ejercicio en superserie con el anterior. Al
  // unirlo, se queda con las series y el descanso del primero del bloque: la
  // superserie se hace toda junta (lib/editorRutina.ts).
  const toggleSuperset = (dayId: string, exerciseRowId: string) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const i = d.exercises.findIndex((e) => e.id === exerciseRowId);
        if (i < 0) return d;
        const unir = !d.exercises[i].supersetWithPrevious;
        const exercises = d.exercises.map((e, k) => (k === i ? { ...e, supersetWithPrevious: unir } : e));
        return { ...d, exercises: unir ? alUnirConElAnterior(exercises, i) : exercises };
      })
    );
    setRestText({});
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
        // Duplicar en el mismo día lo deja justo debajo del original, que es
        // donde se va a editar.
        if (d.id === targetDayId) {
          const copia = { ...ex, id: nuevoId(), supersetWithPrevious: false };
          const junto = d.id === dayId ? exercises.findIndex((e) => e.id === ex.id) : -1;
          exercises =
            junto >= 0
              ? [...exercises.slice(0, junto + 1), copia, ...exercises.slice(junto + 1)]
              : [...exercises, copia];
        }
        return exercises === d.exercises ? d : { ...d, exercises };
      })
    );
    // Deja el día de destino desplegado para verlo al instante.
    setExpandedDays((p) => ({ ...p, [targetDayId]: true }));
    setMovePicker(null);
    showToast(
      !keepOriginal ? 'Ejercicio movido' : targetDayId === dayId ? 'Ejercicio duplicado' : 'Ejercicio copiado'
    );
  };

  // Mueve un ejercicio una posición arriba o abajo dentro de su día.
  // El primero de un día no puede ir "en superserie con el anterior": si sube
  // a la cabeza, pierde la marca en vez de dejarla colgando.
  const reordenarEjercicios = (dayId: string, from: number, to: number) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const exercises = moveItem(d.exercises, from, to);
        if (exercises === d.exercises) return d;
        const limpios = exercises.map((e, i) =>
          i === 0 && e.supersetWithPrevious ? { ...e, supersetWithPrevious: false } : e
        );
        // Mover uno puede meterlo en una superserie o sacarlo: cada bloque, con
        // unas series y un descanso.
        return { ...d, exercises: d.gtg ? limpios : unificarSuperseries(limpios) };
      })
    );
    setRestText({});
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
          conSuperseriesJuntas(
            source.days.map((d) => ({
              ...d,
              id: nuevoId(),
              exercises: d.exercises.map((e) => ({ ...e, id: nuevoId() })),
            }))
          )
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
    setVisibilidad(queVeElAlumno(t));
    setModoAlumno(modoDelAlumno(t));
    if (t.prescripcion) {
      setPresSimple(t.prescripcion);
      const etiquetas = t.prescripcion.intensidad?.niveles;
      if (etiquetas?.length) setNivelesSimplesTexto(etiquetas.join(', '));
    }
    if (t.personalizado) {
      // La prescripción se resuelve aparte: la de POR_DEFECTO (RIR) pisaría la
          // herencia de un plan guardado antes de que existiera (ver prescripcionDe).
          setPerso({
            ...POR_DEFECTO,
            ...t.personalizado,
            prescripcion: prescripcionDe(t.personalizado),
          });
      const niveles = t.personalizado.esfuerzo?.niveles;
      if (niveles?.length) setNivelesTexto(niveles.join(', '));
      const deIntensidad = t.personalizado.prescripcion?.intensidad?.niveles;
      if (deIntensidad?.length) setNivelesIntensidadTexto(deIntensidad.join(', '));
    }
    /*
     * La fecha de inicio del ciclo NO viene de la plantilla.
     *
     * Una plantilla es una estructura —los días y sus ejercicios—, no un
     * calendario. Aplicando una guardada en marzo, el ciclo arrancaba en marzo:
     * el alumno estrenaba plan y le tocaba un día cualquiera de la rueda, sin
     * que nada en la pantalla explicara por qué. Se queda la fecha que hay
     * puesta, que por defecto es hoy.
     */
    setDays(
      conSuperseriesJuntas(
        t.days.map((d) => ({
          ...d,
          id: nuevoId(),
          exercises: d.exercises.map((e) => ({ ...e, id: nuevoId() })),
        }))
      )
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
        scheduleLabel: schedule === 'flex' ? flexLabel(scheduleLabel) : undefined,
        personalizado: schedule === 'flex' ? configuracionAGuardar() : undefined,
        prescripcion: schedule !== 'flex' ? prescripcionSimpleAGuardar() : undefined,
        visibilidad: visibilidadAGuardar(visibilidad),
        modoAlumno,
        days: diasAGuardar(),
      });
      setTemplates(await getRoutineTemplatesForTrainer(profile.uid));
      showToast('Guardada como plantilla');
    } finally {
      setSavingTemplate(false);
    }
  };

  /**
   * Lo que hay en pantalla, como rutina activa de otros alumnos: a cada uno su
   * copia (ids nuevos, para que retocar la de uno no toque la de otro).
   */
  const aplicarAOtros = async (alumnos: UserProfile[]) => {
    if (!profile || alumnos.length === 0) return;
    const dias = diasAGuardar();
    let hechos = 0;
    for (const a of alumnos) {
      try {
        const nuevaId = await createRoutine({
          trainerId: profile.uid,
          clientId: a.uid,
          name,
          active: true,
          days: dias.map((d) => ({
            ...d,
            id: nuevoId(),
            exercises: d.exercises.map((e) => ({ ...e, id: nuevoId() })),
          })),
          schedule,
          // Para ellos el ciclo empieza HOY: la fecha de este alumno puede ser
          // de hace semanas, y les tocaría un día cualquiera de la rueda.
          cycleStartDate: schedule === 'cycle' ? inicioDelDia(Date.now()) : undefined,
          cycleStartDateSetAt: schedule === 'cycle' ? Date.now() : undefined,
          scheduleLabel: schedule === 'flex' ? flexLabel(scheduleLabel) : undefined,
          personalizado: schedule === 'flex' ? configuracionAGuardar() : undefined,
          prescripcion: schedule !== 'flex' ? prescripcionSimpleAGuardar() : undefined,
          visibilidad: visibilidadAGuardar(visibilidad),
          modoAlumno,
        });
        await setActiveRoutine(a.uid, nuevaId, profile.uid);
        if (schedule !== 'flex') await setClientTrackRir(a.uid, pedirEsfuerzo).catch(() => {});
        notifyUser(a.uid, 'Nueva rutina asignada', frase`Tu entrenador ha actualizado tu plan: ${name}`);
        hechos++;
      } catch {
        // Uno que falle no para a los demás; se cuenta abajo.
      }
    }
    showToast(
      hechos === alumnos.length
        ? hechos === 1
          ? 'Aplicada a 1 alumno'
          : frase`Aplicada a ${hechos} alumnos`
        : frase`Aplicada a ${hechos} de ${alumnos.length}: revisa los que faltan`
    );
  };

  const removeTemplate = async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await deleteRoutineTemplate(id);
  };

  const handleSave = useCallback(async () => {
    if (!profile || !clientId) return;
    setSaving(true);
    try {
      // Solo se anota "el coach ha reprogramado el ciclo" si la fecha CAMBIA.
      const cambioLaFecha = schedule === 'cycle' && cycleStartDate !== fechaAlAbrir.current;
      const scheduleFields = {
        schedule,
        cycleStartDate: schedule === 'cycle' ? cycleStartDate : undefined,
        cycleStartDateSetAt: cambioLaFecha ? Date.now() : undefined,
        scheduleLabel: schedule === 'flex' ? flexLabel(scheduleLabel) : undefined,
        // Solo el plan personalizado la lleva: en los otros dos no significa
        // nada, y guardarla ahí sería dejar escrito un ajuste que no se aplica.
        personalizado: schedule === 'flex' ? configuracionAGuardar() : undefined,
        // La semana y los días sueltos, con su RIR, sus letras o lo que use.
        prescripcion: schedule !== 'flex' ? prescripcionSimpleAGuardar() : undefined,
        // Los tres tipos de plan: se guarda siempre, con las dos claves.
        visibilidad: visibilidadAGuardar(visibilidad),
        modoAlumno,
      };
      if (cambioLaFecha) fechaAlAbrir.current = cycleStartDate;
      const dias = diasAGuardar();
      if (routineId) {
        await updateRoutine(routineId, { name, days: dias, ...scheduleFields });
        await setActiveRoutine(clientId, routineId, profile.uid);
      } else {
        const newId = await createRoutine({
          trainerId: profile.uid,
          clientId,
          name,
          days: dias,
          active: true,
          ...scheduleFields,
        });
        await setActiveRoutine(clientId, newId, profile.uid);
      }
      if (schedule !== 'flex' && pedirEsfuerzo !== pedirEsfuerzoAlAbrir.current) {
        await setClientTrackRir(clientId, pedirEsfuerzo);
        pedirEsfuerzoAlAbrir.current = pedirEsfuerzo;
      }
      notifyUser(
        clientId,
        routineId ? 'Rutina actualizada' : 'Nueva rutina asignada',
        frase`Tu entrenador ha actualizado tu plan: ${name}`
      );
      showToast('Rutina guardada');
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar la rutina.');
    } finally {
      setSaving(false);
    }
    /*
     * `perso` y `nivelesTexto` NO SON OPCIONALES EN ESTA LISTA.
     *
     * Sin ellos, esto guardaba la configuración del plan personalizado tal y
     * como estaba al abrir la pantalla —la de por defecto—, y no la que el
     * entrenador acababa de tocar: `useCallback` congela lo que no se declara.
     * Desde fuera se ve como "la app no guarda los datos en personalizado", y
     * es peor que un error, porque el plan SÍ se guarda: lo que se pierde en
     * silencio es la escala, el vocabulario y los permisos.
     */
  }, [
    profile,
    clientId,
    routineId,
    name,
    days,
    schedule,
    scheduleLabel,
    cycleStartDate,
    perso,
    nivelesTexto,
    // Mismo motivo: sin ella se guardarían las etiquetas de intensidad de
    // cuando se abrió la pantalla, no las que se acaban de escribir.
    nivelesIntensidadTexto,
    // Y las de la semana o los días sueltos, por lo mismo.
    presSimple,
    nivelesSimplesTexto,
    // Lo mismo: sin ella se guardaría lo que se veía al abrir la pantalla.
    visibilidad,
    modoAlumno,
    pedirEsfuerzo,
    router,
  ]);

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer
      /*
        "GUARDAR RUTINA", SIEMPRE A MANO. Fijo abajo, fuera del desplazamiento:
        con los días abiertos el editor mide varias pantallas, y tenerlo solo
        al final obligaba a bajar del todo para guardar un cambio de arriba.
      */
      pie={
        <>
          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
          <Button title="Guardar rutina" onPress={handleSave} loading={saving} />
        </>
      }
    >
      <View style={styles.nombreFila}>
        <TextField
          label="Nombre de la rutina"
          value={name}
          onChangeText={setName}
          containerStyle={{ flex: 1, marginBottom: 0 }}
        />
        <Pressable onPress={() => setMasAbierto(true)} style={styles.masBtn} hitSlop={6} accessibilityLabel="Más opciones">
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.primary} />
          <Text style={styles.masBtnTexto}>Más</Text>
        </Pressable>
      </View>
      <QuickSheet
        visible={masAbierto}
        onClose={() => setMasAbierto(false)}
        titulo="Más opciones"
        acciones={[
          { icono: 'albums-outline', texto: 'Usar una plantilla', onPress: () => { setMasAbierto(false); openTemplates(); } },
          { icono: 'copy-outline', texto: 'Copiar de otro alumno', onPress: () => { setMasAbierto(false); openCopyPicker(); } },
          { icono: 'sparkles-outline', texto: 'Generar un borrador', onPress: () => { setMasAbierto(false); handleGenerateDraft(); } },
          { icono: 'eye-outline', texto: 'Ver como el alumno', onPress: () => { setMasAbierto(false); setVerComoAlumno(true); } },
          { icono: 'people-outline', texto: 'Aplicar a otros alumnos', onPress: () => { setMasAbierto(false); setAplicarVarios(true); } },
          { icono: 'bookmark-outline', texto: 'Guardar como plantilla', onPress: () => { setMasAbierto(false); saveAsTemplate(); } },
        ]}
      />

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
                    {t.days.length} {t.days.length === 1 ? 'día' : 'días'} · toca para
                    aplicar
                  </Text>
                  {/* Una plantilla de plan personalizado trae su forma de
                      trabajar; se dice, para saber qué se va a aplicar. */}
                  {t.schedule === 'flex' ? (
                    <Text style={styles.mutedText} numberOfLines={2}>
                      {resumenDePrescripcion(t.personalizado)}
                    </Text>
                  ) : null}
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
      ) : null}

      <Card accent style={styles.scheduleCard}>
        <Text style={styles.scheduleTitle}>Programación</Text>
        <Segmented
          compacto
          valor={schedule}
          /*
            TRES MODOS, NO CUATRO.
            
            "Grease the groove" estaba aquí como un cuarto plan entero, y no le
            pegaba: es una forma de entrenar UN día —series sueltas repartidas,
            ninguna al fallo—, no una programación. Sigue existiendo en los dos
            sitios donde significa algo: marcando un día suelto dentro del plan
            personalizado, y en la rutina diaria de cada alumno.
          */
          opciones={[
            { valor: 'weekly' as RoutineSchedule, texto: 'Semana' },
            { valor: 'cycle' as RoutineSchedule, texto: 'Días sueltos' },
            { valor: 'flex' as RoutineSchedule, texto: 'Crear personalizado' },
          ]}
          onChange={setSchedule}
        />

        {schedule === 'flex' ? (
          <>
            <Text style={styles.scheduleHint}>
              Tu método, montado por ti: creas varias rutinas (las de abajo) y el alumno elige cuál
              hacer cada día. Y decides cómo funciona por dentro — en qué unidades se mide el
              esfuerzo, qué ve antes de elegir, cómo se llaman las cosas y qué puede tocar.
            </Text>
            <TextField
              label="Nombre de esta programación (lo ve el alumno)"
              containerStyle={{ marginTop: spacing.md }}
              placeholder="Ej. Personalizado"
              value={scheduleLabel}
              onChangeText={setScheduleLabel}
              style={{ marginTop: spacing.sm, marginBottom: 0 }}
            />

            {/*
              AL COMBINAR RUTINAS. El alumno puede marcar varias para el mismo
              entreno; cómo se juntan lo decides tú. A la vista y no dentro de
              "Personalizar": es una decisión de cómo se entrena, no de cómo se
              llaman las cosas.
            */}
            <Text style={styles.persoTitulo}>Si el alumno combina varias rutinas</Text>
            <Segmented
              compacto
              valor={comoSeCombinan(perso)}
              opciones={[
                { valor: 'seguidas' as ComoSeCombinan, texto: 'Una detrás de otra' },
                { valor: 'superseries' as ComoSeCombinan, texto: 'En superseries' },
              ]}
              onChange={(v) => cambiaPerso({ combinar: v === 'superseries' ? 'superseries' : undefined })}
            />
            <Text style={[styles.persoAyuda, { marginTop: spacing.xs }]}>
              {comoSeCombinan(perso) === 'superseries'
                ? ejemploDeFusion
                  ? frase`Se fusionan: una serie de cada rutina y después descanso. Ej.: ${ejemploDeFusion}…`
                  : 'Se fusionan: una serie de cada rutina y después descanso.'
                : 'Primero una rutina entera y después la siguiente, en el orden en que las marque.'}
            </Text>
            {/*
              LOS TIEMPOS Y EL ORDEN DE LA FUSIÓN. Cada entrenador tiene los
              suyos: 6 minutos tras una pareja de skills no es lo que pide otro
              método. Y lo que no deba ir en superserie se marca "Aislado" en el
              propio ejercicio: va solo y con su descanso.
            */}
            {comoSeCombinan(perso) === 'superseries' ? (
              <View style={styles.fusionCaja}>
                <Text style={[styles.fusionEtiqueta, { marginTop: 0 }]}>Descanso tras cada superserie</Text>
                <View style={styles.persoFichas}>
                  <Chip
                    texto="El de cada ejercicio"
                    compacto
                    activo={!fusion.descanso}
                    onPress={() => {
                      setDescansoOtro(null);
                      cambiaPerso({ descansoFusion: undefined });
                    }}
                  />
                  {DESCANSOS_DE_FUSION.map((seg) => (
                    <Chip
                      key={seg}
                      texto={textoDeDescanso(seg)}
                      compacto
                      activo={fusion.descanso === seg}
                      onPress={() => {
                        setDescansoOtro(null);
                        cambiaPerso({ descansoFusion: seg });
                      }}
                    />
                  ))}
                </View>
                <TextField
                  label="Otro (minutos, p. ej. 8 o 2:30)"
                  value={descansoOtroVisible}
                  onChangeText={(v) => {
                    setDescansoOtro(v);
                    const seg = segundosDeMinutos(v);
                    if (seg) cambiaPerso({ descansoFusion: seg });
                    else if (!v.trim()) cambiaPerso({ descansoFusion: undefined });
                  }}
                  keyboardType="numbers-and-punctuation"
                  containerStyle={{ marginTop: spacing.sm, marginBottom: 0 }}
                  style={{ marginBottom: 0 }}
                />

                <Text style={styles.fusionEtiqueta}>Entre un ejercicio y otro de la superserie</Text>
                <View style={styles.persoFichas}>
                  {[0, 15, 30, 60].map((seg) => (
                    <Chip
                      key={seg}
                      texto={seg === 0 ? 'Seguido' : textoDeDescanso(seg)}
                      compacto
                      activo={(fusion.transicion ?? 0) === seg}
                      onPress={() => cambiaPerso({ transicionFusion: seg || undefined })}
                    />
                  ))}
                </View>

                <Text style={styles.fusionEtiqueta}>Qué rutina va primero</Text>
                <View style={styles.persoFichas}>
                  <Chip
                    texto="La que marque el alumno"
                    compacto
                    activo={perso.ordenFusion !== 'plan'}
                    onPress={() => cambiaPerso({ ordenFusion: undefined })}
                  />
                  <Chip
                    texto="La de más arriba en tu plan"
                    compacto
                    activo={perso.ordenFusion === 'plan'}
                    onPress={() => cambiaPerso({ ordenFusion: 'plan' })}
                  />
                </View>

                <View style={styles.fusionAviso}>
                  <Ionicons name="remove-circle-outline" size={15} color={colors.primary} style={{ marginTop: 1 }} />
                  <Text style={styles.fusionAvisoTexto}>
                    ¿Ejercicios que no deben ir en superserie, como la hipertrofia con descansos cortos? Márcalos
                    como «Aislado» en su rutina: van solos y con su propio descanso. Si están al principio de la
                    rutina, antes de las superseries; si no, al final.
                  </Text>
                </View>
              </View>
            ) : null}
            <Pressable
              onPress={() => setPersonalizacionAbierta((v) => !v)}
              style={styles.persoToggle}
              hitSlop={6}
            >
              <Ionicons
                name={personalizacionAbierta ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.persoToggleTexto}>Personalizar cómo funciona</Text>
            </Pressable>
            {personalizacionAbierta ? (
              <View style={styles.persoCaja}>
                {/* LA PRESCRIPCIÓN, LO PRIMERO. Es lo que ESCRIBE el entrenador
                    al montar el plan, y es lo primero que piensa: con qué
                    números programa, o sin ninguno. Lo de debajo es otra cosa
                    —lo que APUNTA el alumno al entrenar— y va después. */}
                <Text style={styles.persoTitulo}>Intensidad de cada rutina</Text>
                <Segmented
                  compacto
                  valor={prescripcionDe(perso).intensidad.escala}
                  opciones={[
                    { valor: 'porcentaje' as EscalaDeIntensidad, texto: '%' },
                    { valor: 'propia' as EscalaDeIntensidad, texto: 'La mía' },
                    { valor: 'ninguna' as EscalaDeIntensidad, texto: 'Nada' },
                  ]}
                  onChange={(v) =>
                    cambiaPrescripcion({
                      intensidad: { ...prescripcionDe(perso).intensidad, escala: v },
                    })
                  }
                />
                {prescripcionDe(perso).intensidad.escala === 'propia' ? (
                  <TextField
                    label={frase`Tus niveles, separados por comas (máx. ${MAX_NIVELES_INTENSIDAD})`}
                    containerStyle={{ marginTop: spacing.sm }}
                    placeholder="Ej. Suave, Media, Dura · A, B, C · *, **, ***"
                    value={nivelesIntensidadTexto}
                    onChangeText={setNivelesIntensidadTexto}
                    style={{ marginTop: spacing.xs, marginBottom: 0 }}
                  />
                ) : null}

                <Text style={styles.persoTitulo}>Qué pones en cada ejercicio</Text>
                <Text style={styles.persoAyuda}>
                  Además de series y repeticiones. Si lo dejas vacío en un ejercicio, el alumno no ve
                  nada en ese.
                </Text>
                <View style={styles.persoFichas}>
                  {VARIABLES_DE_EJERCICIO.map(([tipo, texto]) => (
                    <Chip
                      key={tipo}
                      texto={texto}
                      activo={prescripcionDe(perso).variable.tipo === tipo}
                      compacto
                      onPress={() =>
                        cambiaPrescripcion({
                          variable: { ...prescripcionDe(perso).variable, tipo },
                        })
                      }
                    />
                  ))}
                </View>
                {prescripcionDe(perso).variable.tipo === 'propia' ? (
                  <TextField
                    label="Cómo se llama"
                    containerStyle={{ marginTop: spacing.sm }}
                    placeholder="Ej. Zona, Carga, Nivel"
                    maxLength={LARGO_DEL_NOMBRE_DE_VARIABLE}
                    value={prescripcionDe(perso).variable.nombre ?? ''}
                    onChangeText={(v) =>
                      cambiaPrescripcion({
                        variable: { ...prescripcionDe(perso).variable, nombre: v },
                      })
                    }
                    style={{ marginTop: spacing.xs, marginBottom: 0 }}
                  />
                ) : null}

                {/* 1 · LA ESCALA. Lo que el entrenador usa para hablar de
                    esfuerzo con su gente. Si trabaja con letras, la app trabaja
                    con letras. */}
                <Text style={styles.persoTitulo}>Cómo apunta el alumno su esfuerzo</Text>
                <Segmented
                  compacto
                  valor={perso.esfuerzo?.escala ?? 'rir'}
                  opciones={[
                    { valor: 'rir' as EscalaDeEsfuerzo, texto: 'RIR' },
                    { valor: 'porcentaje' as EscalaDeEsfuerzo, texto: '%' },
                    { valor: 'propia' as EscalaDeEsfuerzo, texto: 'La mía' },
                  ]}
                  onChange={(v) =>
                    cambiaPerso({
                      esfuerzo: {
                        escala: v,
                        cuando: perso.esfuerzo?.cuando ?? 'ejercicio',
                        niveles: perso.esfuerzo?.niveles,
                      },
                    })
                  }
                />
                {perso.esfuerzo?.escala === 'propia' ? (
                  <TextField
                    label={frase`Tus niveles, separados por comas (máx. ${MAX_NIVELES})`}
                    containerStyle={{ marginTop: spacing.sm }}
                    placeholder="Ej. A, B, C, D"
                    value={nivelesTexto}
                    onChangeText={setNivelesTexto}
                    style={{ marginTop: spacing.xs, marginBottom: 0 }}
                  />
                ) : null}

                {/* 2 · CUÁNDO. En cada serie, mientras descansa (un toque con el
                    crono corriendo), es lo más fino; una vez al terminar es lo
                    más ligero; y hay quien no quiere preguntar nada. El valor
                    guardado sigue siendo 'ejercicio' para no tocar los planes
                    que ya existen. */}
                <Text style={styles.persoTitulo}>Cuándo se le pregunta</Text>
                <Segmented
                  compacto
                  valor={perso.esfuerzo?.cuando ?? 'ejercicio'}
                  opciones={[
                    { valor: 'ejercicio' as CuandoElEsfuerzo, texto: 'En cada serie' },
                    { valor: 'sesion' as CuandoElEsfuerzo, texto: 'Al terminar' },
                    { valor: 'nunca' as CuandoElEsfuerzo, texto: 'Nunca' },
                  ]}
                  onChange={(v) =>
                    cambiaPerso({
                      esfuerzo: {
                        escala: perso.esfuerzo?.escala ?? 'rir',
                        cuando: v,
                        niveles: perso.esfuerzo?.niveles,
                      },
                    })
                  }
                />

                {/* 3 · LA FICHA. Lo que se lee antes de decidir "cómo me siento
                    hoy": es la pantalla donde el plan personalizado se gana o
                    se pierde. */}
                <Text style={styles.persoTitulo}>Qué ve antes de elegir</Text>
                <View style={styles.persoFichas}>
                {(
                  [
                    ['intensidad', 'La intensidad'],
                    ['ejercicios', 'Cuántos ejercicios lleva'],
                    ['duracion', 'Cuánto dura, estimado'],
                    ['grupos', 'Qué grupos musculares toca'],
                  ] as const
                ).map(([clave, texto]) => (
                  <Chip
                    key={clave}
                    texto={texto}
                    icono={perso.ficha?.[clave] ? 'eye' : 'eye-outline'}
                    activo={!!perso.ficha?.[clave]}
                    compacto
                    onPress={() =>
                      cambiaPerso({
                        ficha: { ...perso.ficha, [clave]: !perso.ficha?.[clave] },
                      })
                    }
                  />
                ))}
                </View>

                {/* 4 · EL VOCABULARIO. Un entrenador que trabaja por bloques no
                    quiere que su app diga "días". */}
                <Text style={styles.persoTitulo}>Cómo se llaman las cosas</Text>
                <TextField
                  label="Cada rutina del plan"
                  placeholder="Día"
                  value={perso.vocabulario?.rutina ?? ''}
                  onChangeText={(v) =>
                    cambiaPerso({ vocabulario: { ...perso.vocabulario, rutina: v } })
                  }
                  style={{ marginBottom: spacing.sm }}
                />
                <TextField
                  label="Cada serie"
                  placeholder="Serie"
                  value={perso.vocabulario?.serie ?? ''}
                  onChangeText={(v) =>
                    cambiaPerso({ vocabulario: { ...perso.vocabulario, serie: v } })
                  }
                  style={{ marginBottom: 0 }}
                />

                {/* 5 · LOS PERMISOS. Hasta ahora el plan era intocable y el
                    alumno solo elegía rutina. Hay métodos que viven de lo
                    contrario. */}
                <Text style={styles.persoTitulo}>Qué puede tocar el alumno</Text>
                <View style={styles.persoFichas}>
                {(
                  [
                    ['saltar', 'Saltarse un ejercicio', 'barbell-outline'],
                    ['reordenar', 'Cambiar el orden', 'swap-vertical-outline'],
                    ['anadir', 'Añadir uno de otra rutina', 'add-circle-outline'],
                  ] as const
                ).map(([clave, texto, icono]) => (
                  <Chip
                    key={clave}
                    texto={texto}
                    icono={icono}
                    activo={!!perso.permisos?.[clave]}
                    compacto
                    onPress={() =>
                      cambiaPerso({
                        permisos: { ...perso.permisos, [clave]: !perso.permisos?.[clave] },
                      })
                    }
                  />
                ))}
                </View>
              </View>
            ) : null}
          </>
        ) : schedule === 'cycle' ? (
          <>
            <Text style={styles.scheduleHint}>
              Los {days.length} días rotan en bucle (1 → {days.length} → 1), sin atarse al
              calendario. Marca uno como “Opcional” y el alumno elige: descansar o volver al Día 1.
            </Text>

            <Pressable
              onPress={() => {
                setCycleStartDate(inicioDelDia(Date.now()));
                showToast('Ciclo reiniciado hoy');
              }}
              style={styles.cycleResetBtn}
            >
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.cycleResetText}>
                Empezar ciclo hoy · actual:{' '}
                {diaMes(cycleStartDate)}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.scheduleHint}>
            Cada día va a un día de la semana (L-D, abajo); uno nuevo coge el primero libre.
          </Text>
        )}

        {/*
          QUÉ VA JUNTO A SERIES Y REPS, TAMBIÉN EN LA SEMANA Y LOS DÍAS SUELTOS.
          El RIR era fijo y no todo el mundo programa con RIR: hay quien usa
          sus letras, RPE, tempo o nada. Y en los días sueltos, la intensidad
          del día puede ir de 1 a 10 o con sus propias etiquetas.
        */}
        {schedule !== 'flex' ? (
          <>
            <Text style={styles.persoTitulo}>Junto a series y reps</Text>
            <View style={styles.persoFichas}>
              {VARIABLES_DE_EJERCICIO.map(([tipo, texto]) => (
                <Chip
                  key={tipo}
                  texto={texto}
                  activo={(presSimple.variable?.tipo ?? 'rir') === tipo}
                  compacto
                  onPress={() => cambiaPresSimple({ variable: { ...presSimple.variable, tipo } })}
                />
              ))}
            </View>
            {presSimple.variable?.tipo === 'propia' ? (
              <TextField
                label="Cómo se llama (lo ve el alumno)"
                containerStyle={{ marginTop: spacing.sm, marginBottom: 0 }}
                placeholder="Ej. Nivel, Zona, Carga"
                maxLength={LARGO_DEL_NOMBRE_DE_VARIABLE}
                value={presSimple.variable?.nombre ?? ''}
                onChangeText={(v) => cambiaPresSimple({ variable: { tipo: 'propia', nombre: v } })}
                style={{ marginTop: spacing.xs, marginBottom: 0 }}
              />
            ) : null}
            {presSimple.variable?.tipo === 'propia' ? (
              <Text style={[styles.persoAyuda, { marginTop: spacing.xs }]}>
                En cada ejercicio escribes lo suyo (A, B, C…), y el alumno lo ve así: «Nivel B».
              </Text>
            ) : null}
            {schedule === 'cycle' ? (
              <>
                <Text style={styles.persoTitulo}>Intensidad de cada día</Text>
                <Segmented
                  compacto
                  valor={cicloConEtiquetas ? 'propia' : 'diez'}
                  opciones={[
                    { valor: 'diez' as const, texto: 'De 1 a 10' },
                    { valor: 'propia' as const, texto: 'Mis etiquetas' },
                  ]}
                  onChange={(v) =>
                    cambiaPresSimple({
                      intensidad: v === 'propia' ? { escala: 'propia' } : undefined,
                    })
                  }
                />
                {cicloConEtiquetas ? (
                  <TextField
                    label={frase`Tus niveles, separados por comas (máx. ${MAX_NIVELES_INTENSIDAD})`}
                    containerStyle={{ marginTop: spacing.sm, marginBottom: 0 }}
                    placeholder="Ej. A, B, C · Suave, Media, Dura"
                    value={nivelesSimplesTexto}
                    onChangeText={setNivelesSimplesTexto}
                    style={{ marginTop: spacing.xs, marginBottom: 0 }}
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {/*
         * CÓMO LO VE EL ALUMNO: apuntando cada serie en la app, o en una tabla
         * para entrenar sin ella (y al acabar, "Lo he hecho"). Se decide
         * alumno por alumno: va en su rutina.
         */}
        <Pressable onPress={() => setAjustesAbiertos((v) => !v)} style={styles.ajustesCab} hitSlop={6}>
          <View style={{ flex: 1 }}>
            <Text style={styles.persoTitulo}>Lo que ve el alumno</Text>
            {!ajustesAbiertos ? (
              <Text style={styles.ajustesResumen} numberOfLines={1}>
                {unido(
                  modoAlumno === 'tabla' ? t('En tabla') : t('Apunta en la app'),
                  seMuestra.intensidad ? t('intensidad') : null,
                  seMuestra.objetivo ? t('objetivo') : null,
                  schedule !== 'flex' && pedirEsfuerzo ? t('esfuerzo') : null
                )}
              </Text>
            ) : null}
          </View>
          <Ionicons name={ajustesAbiertos ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </Pressable>
        {ajustesAbiertos ? (
        <>
        <Segmented<ModoDelAlumno>
          opciones={[
            { valor: 'app', texto: 'Apunta en la app', icono: 'checkbox-outline' },
            { valor: 'tabla', texto: 'En tabla', icono: 'grid-outline' },
          ]}
          valor={modoAlumno}
          onChange={setModoAlumno}
          compacto
        />
        <Text style={styles.persoAyuda}>
          {modoAlumno === 'tabla'
            ? 'Ve su plan en una tabla para entrenar sin la app, y al acabar marca "Lo he hecho".'
            : 'Empieza el entreno en la app y marca cada serie.'}
        </Text>

        {/*
         * QUÉ VE EL ALUMNO AL ENTRENAR. En los tres tipos de plan.
         *
         * Apagado, desaparece para los dos: del entreno del alumno y de este
         * editor (casillas, barra de intensidad y resumen del día), hasta que
         * se vuelva a encender. Esconder no es borrar: lo que ya estaba puesto
         * se guarda y vuelve tal cual al encenderlo. Un interruptor que no aplica (un personalizado sin intensidad o sin
         * variable por ejercicio) no se enseña: no habría nada que esconder.
         */}
        {(() => {
          const ve = seMuestra;
          const presc = schedule === 'flex' ? prescripcionDe(perso) : null;
          const hayIntensidad = !presc || presc.intensidad.escala !== 'ninguna';
          const nombreObjetivo = nombreDeLaVariable(planActivo());
          if (!hayIntensidad && !nombreObjetivo) return null;
          return (
            <>
              <Text style={styles.persoTitulo}>Qué se usa en este plan</Text>
              <View style={styles.persoFichas}>
                {hayIntensidad ? (
                  <Chip
                    texto="Intensidad del día"
                    icono={ve.intensidad ? 'eye' : 'eye-off-outline'}
                    activo={ve.intensidad}
                    compacto
                    onPress={() => setVisibilidad({ ...ve, intensidad: !ve.intensidad })}
                  />
                ) : null}
                {nombreObjetivo ? (
                  <Chip
                    texto={frase`${nombreObjetivo} objetivo`}
                    icono={ve.objetivo ? 'eye' : 'eye-off-outline'}
                    activo={ve.objetivo}
                    compacto
                    onPress={() => setVisibilidad({ ...ve, objetivo: !ve.objetivo })}
                  />
                ) : null}
                {schedule !== 'flex' ? (
                  <Chip
                    texto="Pedirle el esfuerzo"
                    icono={pedirEsfuerzo ? 'speedometer' : 'speedometer-outline'}
                    activo={pedirEsfuerzo}
                    compacto
                    onPress={() => setPedirEsfuerzo((v) => !v)}
                  />
                ) : null}
              </View>
              {/* Una línea, no dos párrafos: lo que hace cada pastilla ya se
                  ve al tocarla, y lo que hay que saber es que apagar no borra. */}
              <Text style={styles.persoAyuda}>
                Apagado no lo ve nadie; lo ya puesto se guarda.
                {schedule !== 'flex' && pedirEsfuerzo
                  ? ' El esfuerzo se le pregunta en cada serie, mientras descansa.'
                  : ''}
              </Text>
            </>
          );
        })()}
        </>
        ) : null}
      </Card>

      <DragList
        items={days}
        keyOf={(d) => d.id}
        gap={0}
        handleOnly
        onReorder={(from, to) => setDays((prev) => moveItem(prev, from, to))}
        renderItem={(day, dayIndex, diaArrastrando) => {
        const isOpen = expandedDays[day.id] ?? false;
        const exCount = day.exercises.length;
        const summaryParts: string[] = [];
        if (schedule === 'cycle') {
          if (day.optionalRest) summaryParts.push(frase`Día ${dayIndex + 1}`, 'Descanso opcional');
          else if (day.isRest) summaryParts.push(frase`Día ${dayIndex + 1}`, 'Descanso');
          else {
            summaryParts.push(frase`Día ${dayIndex + 1}`);
            if (seMuestra.intensidad) {
              if (!cicloConEtiquetas) summaryParts.push(`Intensidad ${day.intensity ?? 5}`);
              else if (day.intensityLabel?.trim()) summaryParts.push(frase`Intensidad ${day.intensityLabel.trim()}`);
            }
          }
        } else if (schedule === 'flex') {
          if (day.isRest) summaryParts.push('Descanso');
          else if (day.gtg) {
            summaryParts.push(frase`Todo el día · ${day.gtgSetsPerDay ?? SERIES_POR_DEFECTO} series`);
          }
          else if (seMuestra.intensidad && textoDeIntensidadDelDia(day, perso)) {
            summaryParts.push(textoDeIntensidadDelDia(day, perso)!);
            // La palabra ("Exigente"...) solo acompaña al porcentaje: a una
            // etiqueta del entrenador no se le pone otro nombre encima.
            const palabra =
              prescripcionDe(perso).intensidad.escala === 'porcentaje'
                ? esfuerzoDePct(day.intensityPct)
                : null;
            if (palabra) summaryParts.push(palabra);
          }
        } else if (day.weekday !== undefined) {
          summaryParts.push(WEEKDAY_NAMES[day.weekday]);
          if (day.isRest) summaryParts.push('Descanso');
        }
        if (!day.isRest) {
          summaryParts.push(`${exCount} ${exCount === 1 ? 'ejercicio' : 'ejercicios'}`);
          // Series totales del día (suma de las series de todos sus ejercicios).
          const totalSets = day.exercises.reduce((acc, e) => acc + (e.sets || 0), 0);
          if (totalSets > 0) summaryParts.push(frase`${totalSets} series`);
        }
        return (
        <Card style={[styles.dayCard, diaArrastrando && styles.dayCardDragging]}>
          <View style={styles.dayHeaderRow}>
            {/* Abierto, el nombre se cambia en el propio título: antes había
                además un campo "Nombre del día" que repetía lo mismo justo
                debajo y empujaba los ejercicios media pantalla. */}
            {isOpen ? (
              <View style={[styles.dayHeaderMain, styles.dayTitleEditable]}>
                <TextInput
                  value={day.name}
                  onChangeText={(v) => updateDayName(day.id, v)}
                  placeholder={nombreDelDia('', dayIndex)}
                  placeholderTextColor={colors.textFaint}
                  style={[styles.dayTitle, styles.dayTitleInput]}
                  accessibilityLabel={t('Nombre del día')}
                />
                <Ionicons name="pencil" size={13} color={colors.textFaint} />
              </View>
            ) : (
              <Pressable
                style={styles.dayHeaderMain}
                onPress={() => toggleDayExpanded(day.id)}
              >
                <Text style={styles.dayTitle} numberOfLines={1}>
                  {nombreDelDia(day.name, dayIndex)}
                </Text>
              </Pressable>
            )}
            {/* Igualar, duplicar, subir, bajar y borrar, en el menú del día.
                Sin asa de arrastrar (como en los ejercicios): en un móvil,
                arrastrar dentro de una lista llena de campos era lo más lento
                para "este va uno más arriba", y el asa era un icono más. */}
            <Pressable onPress={() => setMenuDia(day.id)} style={styles.removeDayBtn} hitSlop={8} accessibilityLabel="Opciones del día">
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => toggleDayExpanded(day.id)} hitSlop={8}>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          {/* El resumen del día va DEBAJO de la fila, a lo ancho de la tarjeta.
              Al lado de los cuatro botones —mover, duplicar, borrar, desplegar—
              le quedaban 81 píxeles en un móvil de 320, y lo que se leía era
              "Día 1 · Intensidad ...": se perdían los ejercicios y las series,
              que es justo lo que se viene a mirar sin abrir el día. */}
          <Pressable onPress={() => toggleDayExpanded(day.id)}>
            <Text style={styles.daySummary} numberOfLines={2}>
              {summaryParts.join(' · ')}
            </Text>
            {/* Plegado, también QUÉ lleva: se repasa la semana entera sin
                abrir día por día. El "+" es la superserie. */}
            {!isOpen && !day.isRest && day.exercises.length > 0 ? (
              <Text style={styles.dayEjercicios} numberOfLines={2}>
                {resumenDeEjercicios(day.exercises)}
              </Text>
            ) : null}
          </Pressable>

          {isOpen ? (
          <>

          {schedule === 'cycle' ? (
            <>
            <View style={styles.cycleDayRow}>
              <View style={styles.cyclePill}>
                <Text style={styles.cyclePillText}>Día {dayIndex + 1} del ciclo</Text>
              </View>
              <View style={styles.restToggles}>
                <Chip
                  texto="Descanso"
                  icono={day.isRest ? 'bed' : 'bed-outline'}
                  activo={day.isRest && !day.optionalRest}
                  compacto
                  onPress={() => toggleRestDay(day.id)}
                />
                <Chip
                  texto="Opcional"
                  icono={day.optionalRest ? 'shuffle' : 'shuffle-outline'}
                  activo={!!day.optionalRest}
                  compacto
                  onPress={() => toggleOptionalRest(day.id)}
                />
              </View>
            </View>
            {day.optionalRest ? (
              <Text style={styles.optionalHint}>
                Descanso opcional: el alumno decide cada vez entre descansar o
                reiniciar el ciclo entrenando el Día 1.
              </Text>
            ) : null}
            {!day.isRest && seMuestra.intensidad && cicloConEtiquetas ? (
              /* Con las etiquetas del entrenador: se toca la que va, y tocar la
                 que ya está puesta la quita. */
              <View style={styles.dayIntensityRow}>
                <Text style={styles.dayIntensityLabel}>
                  Intensidad · {day.intensityLabel?.trim() || 'sin poner'}
                </Text>
                <View style={styles.persoFichas}>
                  {nivelesDeIntensidad({ prescripcion: prescripcionSimpleAGuardar() }).map((etiqueta) => (
                    <Chip
                      key={etiqueta}
                      texto={etiqueta}
                      activo={day.intensityLabel === etiqueta}
                      compacto
                      onPress={() => eligeIntensidad(day.id, etiqueta)}
                    />
                  ))}
                </View>
              </View>
            ) : !day.isRest && seMuestra.intensidad ? (
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
          ) : schedule === 'flex' ? (
            // En Sensaciones el alumno elige entre varias rutinas: lo que
            // necesita saber antes de elegir es cuánto le va a pedir cada una.
            !day.isRest ? (
              <>
              <View style={styles.gtgFila}>
                <Chip
                  texto="Grease the groove"
                  icono={day.gtg ? 'repeat' : 'repeat-outline'}
                  activo={!!day.gtg}
                  compacto
                  onPress={() => toggleGtgDay(day.id)}
                />
                {day.gtg ? (
                  <TextField
                    keyboardType="number-pad"
                    placeholder={frase`${SERIES_POR_DEFECTO} series al día`}
                    value={day.gtgSetsPerDay ? String(day.gtgSetsPerDay) : ''}
                    onChangeText={(v) => updateDayGtgSets(day.id, v)}
                    containerStyle={styles.gtgCampo}
                    style={{ marginBottom: 0 }}
                  />
                ) : null}
              </View>
              {day.gtg ? (
                <>
                <Text style={styles.optionalHint}>
                  Esta rutina no es una sesión: son series sueltas repartidas por todo el día,
                  ninguna al fallo. El alumno la elige sola, no encadenada con otra, y en
                  repeticiones va el objetivo de CADA serie.
                </Text>
                {/* Lo que vale para todo el día y no es de ningún ejercicio:
                    cada cuánto, cuánto dejar, qué hacer si una sale fea. Lo
                    ve el alumno encima de sus series. */}
                <TextField
                  label="Indicaciones del día (opcional)"
                  value={day.gtgIndicaciones ?? ''}
                  onChangeText={(v) => updateDayGtgIndicaciones(day.id, v)}
                  placeholder="Cada cuánto, cuánto dejar en la recámara, qué hacer si una serie sale fea…"
                  multiline
                  style={styles.gtgIndicaciones}
                  containerStyle={{ marginBottom: spacing.sm }}
                />
                </>
              ) : null}
              {day.gtg || !seMuestra.intensidad || prescripcionDe(perso).intensidad.escala === 'ninguna' ? null : prescripcionDe(perso).intensidad.escala === 'propia' ? (
              /* Con las etiquetas del entrenador: se toca la que va, y tocar
                 la que ya está puesta la quita. Sin barra: una "B" no es un
                 punto de una escala que se pueda dibujar. */
              <View style={styles.dayIntensityRow}>
                <Text style={styles.dayIntensityLabel}>
                  Intensidad · {day.intensityLabel?.trim() || 'sin poner'}
                </Text>
                <View style={styles.persoFichas}>
                  {nivelesDeIntensidad(configuracionAGuardar()).map((etiqueta) => (
                    <Chip
                      key={etiqueta}
                      texto={etiqueta}
                      activo={day.intensityLabel === etiqueta}
                      compacto
                      onPress={() => eligeIntensidad(day.id, etiqueta)}
                    />
                  ))}
                </View>
              </View>
              ) : (
              <View style={styles.dayIntensityRow}>
                <Text style={styles.dayIntensityLabel}>
                  Intensidad · {day.intensityPct ? `${day.intensityPct} %` : 'sin poner'}
                  {esfuerzoDePct(day.intensityPct)
                    ? ` · ${esfuerzoDePct(day.intensityPct)}`
                    : ''}
                </Text>
                <View style={styles.dayIntensityControls}>
                  <Pressable
                    onPress={() => updateDayPct(day.id, -1)}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </Pressable>
                  <View style={styles.intensityTrack}>
                    <View
                      style={[
                        styles.intensityFill,
                        { width: `${proporcionIntensidad(day, 'flex') != null ? proporcionIntensidad(day, 'flex')! * 100 : 0}%` },
                      ]}
                    />
                  </View>
                  <Pressable
                    onPress={() => updateDayPct(day.id, 1)}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                  </Pressable>
                </View>
              </View>
              )}
              </>
            ) : null
          ) : (
          <View style={styles.weekdayRow}>
            <View style={styles.weekdayHeadRow}>
              <Text style={styles.weekdayLabel}>Día de la semana</Text>
              <Chip
                texto="Descanso"
                icono={day.isRest ? 'bed' : 'bed-outline'}
                activo={day.isRest}
                compacto
                onPress={() => toggleRestDay(day.id)}
              />
            </View>
            <DiasSemana
              valor={day.weekday}
              onChange={(weekday) => updateDayWeekday(day.id, weekday)}
            />
            {day.isRest ? (
              <Text style={styles.optionalHint}>
                Día de descanso: en el día de la semana elegido, el alumno verá “Descanso”, no
                registra nada y no afecta a su racha.
              </Text>
            ) : null}
            {day.weekday !== undefined && diasRepetidos.has(day.weekday) ? (
              <Text style={styles.avisoRepetido}>
                Otro día del plan cae en el mismo día de la semana. El alumno verá los dos y podrá
                entrenar el que quiera, pero la app le propondrá el primero.
              </Text>
            ) : null}
          </View>
          )}

          {!day.isRest && !(masDelDia.has(day.id) || day.showIntervalTimer || day.approachesNote) ? (
            <Pressable
              onPress={() => setMasDelDia((prev) => new Set(prev).add(day.id))}
              style={styles.masDelDia}
              hitSlop={6}
            >
              <Ionicons name="add-circle-outline" size={15} color={colors.textMuted} />
              <Text style={styles.masDelDiaTexto}>Calentamiento y temporizador</Text>
            </Pressable>
          ) : null}
          {!day.isRest && (masDelDia.has(day.id) || day.showIntervalTimer || day.approachesNote) ? (
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
              {/*
               * LA SUPERSERIE, DE UN TOQUE, SOBRE LA RAYA ENTRE LOS DOS.
               *
               * Estaba dentro de "Carga, agarre, indicaciones…": para unir dos
               * ejercicios había que abrir las opciones del segundo y buscar
               * el enlace. Ahora es la pastilla que cose uno con otro: "+
               * Superserie" para unirlos y, unidos, "Superserie · Separar".
               * En un día de grease the groove no hay superseries: no sale.
               */}
              {exIndex > 0 && !day.gtg ? (
                <Pressable
                  onPress={() => toggleSuperset(day.id, ex.id)}
                  style={[styles.enlace, ex.supersetWithPrevious && styles.enlaceActivo]}
                  hitSlop={6}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !!ex.supersetWithPrevious }}
                  accessibilityLabel={t('Superserie con el anterior')}
                >
                  <Ionicons
                    name={ex.supersetWithPrevious ? 'link' : 'add'}
                    size={13}
                    color={ex.supersetWithPrevious ? colors.primaryBright : colors.textFaint}
                  />
                  <Text style={[styles.enlaceTexto, ex.supersetWithPrevious && styles.enlaceTextoActivo]}>
                    Superserie
                  </Text>
                  {ex.supersetWithPrevious ? <Text style={styles.enlaceSeparar}>· Separar</Text> : null}
                </Pressable>
              ) : null}
              {/*
               * LA CABECERA: nombre y, a la derecha, todo lo que mueve.
               *
               * Ordenar era solo arrastrar, y arrastrar en un móvil, dentro de
               * una lista con scroll y llena de campos de texto, es lo más
               * lento que hay para "este va uno más arriba". Las flechas lo
               * hacen de un toque; el asa se queda para los saltos largos.
               */}
              <View style={styles.exerciseTitleRow}>
                <View style={styles.exerciseTitleText}>
                  <Text style={styles.exerciseName} numberOfLines={2}>
                    {ex.name}
                    {resolveLoad(ex) === 'assisted' ? (
                      <Text style={styles.markAssisted}> · goma</Text>
                    ) : resolveLoad(ex) === 'weighted' ? (
                      <Text style={styles.markWeighted}> · lastre</Text>
                    ) : null}
                  </Text>
                  {/* La categoría, debajo del nombre: dos ejercicios que
                      empiezan igual ("Front lever", "Front lever press") se
                      distinguen aquí igual que en la pantalla del alumno. */}
                  {ex.muscleGroup || ex.subgroup ? (
                    <Text style={styles.exerciseGrupo} numberOfLines={1}>
                      {ex.muscleGroup}
                      {ex.muscleGroup && ex.subgroup ? ' · ' : ''}
                      {ex.subgroup}
                      {ex.measure === 'seconds' ? ' · isométrico' : ''}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.ordenGrupo}>
                  <Pressable
                    onPress={() => reordenarEjercicios(day.id, exIndex, exIndex - 1)}
                    disabled={exIndex === 0}
                    style={[styles.ordenBtn, exIndex === 0 && styles.ordenBtnApagado]}
                    hitSlop={4}
                    accessibilityLabel="Subir"
                  >
                    <Ionicons name="chevron-up" size={18} color={colors.text} />
                  </Pressable>
                  <View style={styles.ordenSeparador} />
                  <Pressable
                    onPress={() => reordenarEjercicios(day.id, exIndex, exIndex + 1)}
                    disabled={exIndex === day.exercises.length - 1}
                    style={[
                      styles.ordenBtn,
                      exIndex === day.exercises.length - 1 && styles.ordenBtnApagado,
                    ]}
                    hitSlop={4}
                    accessibilityLabel="Bajar"
                  >
                    <Ionicons name="chevron-down" size={18} color={colors.text} />
                  </Pressable>
                </View>
                {/* Sin asa de arrastrar: eran tres formas de mover lo mismo
                    (flechas, asa y menú). Las flechas, de un toque, para
                    "uno más arriba"; el menú, para llevarlo a otro día. */}
                <Pressable
                  onPress={() => setMovePicker({ dayId: day.id, ex })}
                  style={styles.moveBtn}
                  hitSlop={4}
                  accessibilityLabel="Mover, copiar o duplicar"
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.primary} />
                </Pressable>
              </View>

              {/* AL FUSIONAR RUTINAS: si este se empareja o va aislado. Solo
                  se enseña si el plan fusiona en superseries; a la vista y no
                  en "más opciones", porque es justo lo que se decide al montar
                  una rutina de skills con su parte de hipertrofia. */}
              {schedule === 'flex' && comoSeCombinan(perso) === 'superseries' && !day.gtg ? (
                <View style={styles.fusionFila}>
                  <Text style={styles.fusionFilaTexto}>Al fusionar</Text>
                  <Chip
                    texto="Se empareja"
                    icono="git-merge-outline"
                    compacto
                    activo={!ex.aislado}
                    onPress={() => setAislado(day.id, ex.id, false)}
                  />
                  <Chip
                    texto="Aislado"
                    icono="remove-circle-outline"
                    compacto
                    activo={!!ex.aislado}
                    onPress={() => setAislado(day.id, ex.id, true)}
                  />
                </View>
              ) : null}

              {/* Si lo cumple de sobra dos sesiones seguidas, se dice aquí, en
                  la ficha, con el nuevo objetivo a un toque (lib/progresion.ts). */}
              {(() => {
                const sug = sugerenciaDeProgresion(logsDelAlumno, ex);
                return sug ? (
                  <View style={styles.sugerencia}>
                    <Ionicons name="trending-up" size={15} color={colors.primaryBright} />
                    <Text style={styles.sugerenciaTexto}>{sug.texto}</Text>
                    {sug.reps ? (
                      <Pressable
                        onPress={() => updateExerciseField(day.id, ex.id, 'reps', sug.reps!)}
                        hitSlop={8}
                      >
                        <Text style={styles.sugerenciaAplicar}>Aplicar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null;
              })()}

              {/*
               * LOS NÚMEROS, EN UNA SOLA FILA. Series, reps, la variable y el
               * descanso son lo que se toca en cada ficha: antes eran dos
               * filas de casillas grandes debajo de dos filas de botones.
               */}
              <View style={styles.exerciseFields}>
                {/* En una superserie, series y descanso van UNA vez, en el
                    primero: se hace todo junto (A, B, descanso). */}
                {!day.gtg && vaEnSuperserie(day.exercises, exIndex) ? null : (
                  <Casilla
                    etiqueta="Series"
                    keyboardType="number-pad"
                    value={String(ex.sets)}
                    onChangeText={(v) => updateExerciseField(day.id, ex.id, 'sets', v)}
                  />
                )}
                <Casilla
                  etiqueta={
                    isDualMeasure(ex.measure)
                      ? isHoldMeasure(ex.measure)
                        ? 'Seg. izq.'
                        : 'Reps izq.'
                      : isHoldMeasure(ex.measure)
                        ? 'Segundos'
                        : 'Reps'
                  }
                  value={ex.reps}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'reps', v)}
                  placeholder={isHoldMeasure(ex.measure) ? '30' : '8-12'}
                />
                {/* Combo: además de las reps, el aguante de la misma serie. */}
                {ex.measure === 'combo' ? (
                  <Casilla
                    etiqueta="Aguante"
                    value={ex.seconds ?? ''}
                    onChangeText={(v) => updateExerciseField(day.id, ex.id, 'seconds', v)}
                    placeholder="12"
                  />
                ) : isDualMeasure(ex.measure) ? (
                  /* Por lados: el objetivo del lado derecho. Casi siempre será
                     el mismo que el izquierdo, pero no siempre. */
                  <Casilla
                    etiqueta={isHoldMeasure(ex.measure) ? 'Seg. der.' : 'Reps der.'}
                    value={ex.side2 ?? ''}
                    onChangeText={(v) => updateExerciseField(day.id, ex.id, 'side2', v)}
                    placeholder={isHoldMeasure(ex.measure) ? '30' : '8-12'}
                  />
                ) : null}
                {/*
                 * LA VARIABLE DEL EJERCICIO. Fuera del plan personalizado,
                 * RIR como siempre. Dentro, la que haya elegido el entrenador:
                 * RIR, RPE, % RM, tempo, la suya... o ninguna, y entonces la
                 * casilla desaparece. Vacía, el alumno no ve nada.
                 */}
                {!seMuestra.objetivo ? null : prescripcionDe(planActivo()).variable.tipo === 'rir' ? (
                  <Casilla
                    etiqueta="RIR"
                    keyboardType="number-pad"
                    value={ex.rir !== undefined ? String(ex.rir) : ''}
                    onChangeText={(v) => updateExerciseField(day.id, ex.id, 'rir', v)}
                    placeholder="2"
                  />
                ) : nombreDeLaVariable(planActivo()) ? (
                  <Casilla
                    etiqueta={nombreDeLaVariable(planActivo())!}
                    keyboardType={
                      prescripcionDe(planActivo()).variable.tipo === 'rpe' ||
                      prescripcionDe(planActivo()).variable.tipo === 'porcentaje'
                        ? 'numbers-and-punctuation'
                        : 'default'
                    }
                    // Las letras se escriben como las pone el entrenador ("B").
                    autoCapitalize={prescripcionDe(planActivo()).variable.tipo === 'propia' ? 'characters' : 'none'}
                    value={ex.prescrito ?? ''}
                    onChangeText={(v) => updateExerciseField(day.id, ex.id, 'prescrito', v)}
                    placeholder={ejemploDeLaVariable(planActivo()) || 'B'}
                  />
                ) : null}
                {!day.gtg && vaEnSuperserie(day.exercises, exIndex) ? null : (
                  <Casilla
                    etiqueta="Descanso"
                    keyboardType="numbers-and-punctuation"
                    value={restText[ex.id] ?? minutosSegundos(ex.restSeconds)}
                    onChangeText={(v) => {
                      setRestText((prev) => ({ ...prev, [ex.id]: v }));
                      updateRestSeconds(day.id, ex.id, segundosDeTexto(v));
                    }}
                    placeholder="3:30"
                  />
                )}
              </View>
              {!day.gtg && encabezaSuperserie(day.exercises, exIndex) ? (
                <Text style={styles.bloqueNota}>Series y descanso, para toda la superserie</Text>
              ) : null}

              {/*
               * LO DEMÁS, PLEGADO. Carga, agarre, indicaciones, objetivo,
               * clúster y superserie se ponen una vez y no se vuelven a mirar:
               * no tienen por qué ocupar media pantalla en cada ficha. Plegado
               * dice en una línea lo que hay puesto, para no tener que abrirlo
               * para saberlo.
               */}
              <Pressable
                onPress={() => setDetalleAbierto((p) => ({ ...p, [ex.id]: !p[ex.id] }))}
                style={styles.masFila}
                hitSlop={4}
              >
                <Ionicons
                  name={detalleAbierto[ex.id] ? 'chevron-up' : 'options-outline'}
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.masTexto} numberOfLines={1}>
                  {detalleAbierto[ex.id]
                    ? 'Cerrar opciones'
                    : resumenDeOpciones(ex) || 'Carga, agarre, indicaciones...'}
                </Text>
              </Pressable>

              {detalleAbierto[ex.id] ? (
              <View style={styles.masCaja}>
              <Text style={styles.loadLabel}>Carga</Text>
              <Opciones
                opciones={LOAD_TYPES.map((l) => ({ valor: l, texto: LOAD_LABEL[l] }))}
                valor={resolveLoad(ex)}
                onChange={(v) => v && setExerciseLoad(day.id, ex.id, v)}
              />

              <Text style={styles.loadLabel}>Agarre (opcional)</Text>
              <Opciones
                opciones={GRIP_TYPES.map((g) => ({ valor: g, texto: GRIP_LABEL[g] }))}
                valor={ex.grip}
                desmarcable
                onChange={(g) => g && setExerciseGrip(day.id, ex.id, g)}
              />
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
              </View>
              </View>
              ) : null}
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

      <Sheet
        visible={pickerForDay !== null}
        onClose={() => {
          setPickerForDay(null);
          setCreatingNew(false);
        }}
        titulo={creatingNew ? 'Nuevo ejercicio' : 'Añadir ejercicio'}
      >

            {creatingNew ? (
              <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                <TextField
                  label="Nombre del ejercicio"
                  placeholder="Ej. Muscle up"
                  value={newName}
                  onChangeText={setNewName}
                />
                <Text style={styles.loadLabel}>Categoría</Text>
                <Opciones
                  opciones={categoriasBiblioteca.map((g) => ({ valor: g, texto: g }))}
                  valor={newGroup}
                  envuelve
                  onChange={(g) => {
                    setNewGroup(g ?? '');
                    setNewSubgroup('');
                  }}
                />
                {/* Subgrupo: solo si esa categoría ya tiene alguno definido. */}
                {(profile?.categorySubgroups?.[newGroup] ?? []).length > 0 ? (
                  <>
                    <Text style={styles.loadLabel}>Subgrupo (opcional)</Text>
                    <Opciones
                      opciones={(profile?.categorySubgroups?.[newGroup] ?? []).map((sg) => ({
                        valor: sg,
                        texto: sg,
                      }))}
                      valor={newSubgroup}
                      desmarcable
                      envuelve
                      onChange={(sg) => setNewSubgroup(sg ?? '')}
                    />
                  </>
                ) : null}
                {/* Con el grupo decidido no se pregunta: se dice cuál es y se
                    sigue. Preguntar aquí solo sirve para que alguien conteste
                    distinto de lo que su propio grupo ya dice. */}
                {medidaDelNuevoGrupo ? (
                  <Text style={styles.medidaHeredada}>
                    Medida: {MEASURE_SHORT[medidaDelNuevoGrupo].toLowerCase()} · lo decide el
                    grupo «{newSubgroup}»
                  </Text>
                ) : (
                  <>
                    <Text style={styles.loadLabel}>Medida</Text>
                    <Opciones
                      opciones={[
                        { valor: 'reps' as ExerciseMeasure, texto: 'Repeticiones' },
                        { valor: 'seconds' as ExerciseMeasure, texto: 'Segundos' },
                      ]}
                      valor={newMeasure}
                      onChange={(m) => m && setNewMeasure(m)}
                    />
                  </>
                )}
                <Text style={styles.loadLabel}>Carga</Text>
                <Opciones
                  opciones={LOAD_TYPES.map((l) => ({ valor: l, texto: LOAD_LABEL[l] }))}
                  valor={newLoad}
                  onChange={(v) => v && setNewLoad(v)}
                />
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
                    <ChipRow scroll>
                      {['Todos', ...categoriasBiblioteca].map((cat) => (
                        <Chip
                          key={cat}
                          texto={cat}
                          activo={filtroCategoria === cat}
                          onPress={() => {
                            setFiltroCategoria(cat);
                            setFiltroSubgrupo(null);
                          }}
                        />
                      ))}
                    </ChipRow>

                    {/* Subgrupos: solo dentro de una categoría concreta y solo
                        si esa categoría los tiene. */}
                    {subgruposVisibles.length > 0 ? (
                      <ChipRow scroll>
                        {subgruposVisibles.map((sg) => (
                          <Chip
                            key={sg}
                            texto={sg}
                            activo={filtroSubgrupo === sg}
                            onPress={() =>
                              setFiltroSubgrupo(filtroSubgrupo === sg ? null : sg)
                            }
                          />
                        ))}
                      </ChipRow>
                    ) : null}

                  <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                    {ejerciciosFiltrados.length === 0 ? (
                      <Text style={styles.mutedText}>
                        Ningún ejercicio de esa categoría coincide con la búsqueda.
                      </Text>
                    ) : null}
                    {ejerciciosFiltrados
                      .map((ex) => {
                        // Lo que ya está en el día, marcado: se añaden varios
                        // seguidos sin perder la cuenta (y sin cerrar).
                        const yaEsta = (diaDelPicker?.exercises ?? []).filter((e) => e.exerciseId === ex.id).length;
                        return (
                        <Pressable
                          key={ex.id}
                          onPress={() => pickerForDay && addExerciseToDay(pickerForDay, ex)}
                          style={[styles.pickerRow, yaEsta > 0 && styles.pickerRowYa]}
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
                          {yaEsta > 0 ? (
                            <View style={styles.pickerYa}>
                              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                              <Text style={styles.pickerYaTexto}>
                                {yaEsta > 1 ? frase`En el día ×${yaEsta}` : 'En el día'}
                              </Text>
                            </View>
                          ) : (
                            <Ionicons name="add-circle" size={22} color={colors.primary} />
                          )}
                        </Pressable>
                        );
                      })}
                  </ScrollView>
                  </>
                )}
                {/* Se queda abierto para añadir varios seguidos; "Listo" cierra
                    y dice cuántos lleva el día. */}
                <Button
                  title={
                    diaDelPicker && diaDelPicker.exercises.length > 0
                      ? frase`Listo · ${diaDelPicker.exercises.length} en el día`
                      : 'Listo'
                  }
                  onPress={() => setPickerForDay(null)}
                  style={{ marginTop: spacing.sm }}
                />
              </>
            )}
      </Sheet>

      {/*
       * MOVER, COPIAR O DUPLICAR. Un solo sitio para todo lo que se hace con
       * un ejercicio entero: llevarlo a otro día, copiarlo, duplicarlo en el
       * mismo, mandarlo arriba o abajo del todo de un toque y quitarlo.
       */}
      <Sheet
        visible={movePicker !== null}
        onClose={() => setMovePicker(null)}
        titulo="Mover, copiar o duplicar"
        descripcion={movePicker?.ex.name}
      >
            <ScrollView style={styles.modalList}>
              {(() => {
                const origen = days.find((d) => d.id === movePicker?.dayId);
                const pos = origen?.exercises.findIndex((e) => e.id === movePicker?.ex.id) ?? -1;
                if (!origen || pos < 0 || origen.exercises.length < 2) return null;
                const ultimo = origen.exercises.length - 1;
                return (
                  <View style={styles.moveExtremos}>
                    <Button
                      title="Al principio"
                      variant="secondary"
                      disabled={pos === 0}
                      onPress={() => {
                        reordenarEjercicios(origen.id, pos, 0);
                        setMovePicker(null);
                      }}
                      style={styles.moveExtremoBtn}
                    />
                    <Button
                      title="Al final"
                      variant="secondary"
                      disabled={pos === ultimo}
                      onPress={() => {
                        reordenarEjercicios(origen.id, pos, ultimo);
                        setMovePicker(null);
                      }}
                      style={styles.moveExtremoBtn}
                    />
                  </View>
                );
              })()}
              {days.map((d, i) => {
                const isSource = d.id === movePicker?.dayId;
                return (
                  <View key={d.id} style={styles.moveDayRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerRowText}>
                        {nombreDelDia(d.name, i)}
                        {isSource ? '  · actual' : ''}
                      </Text>
                      <Text style={styles.pickerRowMuscle}>
                        {d.exercises.length}{' '}
                        {d.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
                        {d.isRest ? ' · descanso' : ''}
                      </Text>
                    </View>
                    {isSource ? (
                      <Button
                        title="Duplicar"
                        variant="secondary"
                        onPress={() => moveOrCopyExercise(d.id, true)}
                        compacto
                        style={styles.moveActionBtn}
                      />
                    ) : (
                      <>
                        <Button
                          title="Copiar"
                          variant="secondary"
                          onPress={() => moveOrCopyExercise(d.id, true)}
                          compacto
                          style={styles.moveActionBtn}
                        />
                        <Button
                          title="Mover"
                          onPress={() => moveOrCopyExercise(d.id, false)}
                          compacto
                          style={styles.moveActionBtn}
                        />
                      </>
                    )}
                  </View>
                );
              })}
              <Pressable
                onPress={() => {
                  if (movePicker) removeExercise(movePicker.dayId, movePicker.ex.id);
                  setMovePicker(null);
                }}
                style={styles.moveEliminar}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={styles.moveEliminarTexto}>Eliminar del día</Text>
              </Pressable>
            </ScrollView>
      </Sheet>

      <QuickSheet
        visible={menuDia !== null}
        onClose={() => setMenuDia(null)}
        titulo="Opciones del día"
        acciones={(() => {
          const idx = days.findIndex((d) => d.id === menuDia);
          const dia = days[idx];
          if (!dia) return [];
          const cerrarY = (hacer: () => void) => () => {
            hacer();
            setMenuDia(null);
          };
          const acciones: AccionRapida[] = [];
          // Lo que más tiempo ahorra, lo primero: todo el día de una vez.
          if (!dia.isRest && dia.exercises.length > 1) {
            acciones.push({
              icono: 'options-outline',
              texto: 'Igualar series, reps y descanso',
              onPress: cerrarY(() => {
                setIg({ sets: '', reps: '', segundos: '', rir: '', prescrito: '', descanso: '' });
                setIgualando(dia.id);
              }),
            });
          }
          acciones.push({ icono: 'copy-outline', texto: 'Duplicar el día', onPress: cerrarY(() => duplicateDay(dia.id)) });
          if (idx > 0) acciones.push({ icono: 'arrow-up', texto: 'Subir el día', onPress: cerrarY(() => moverDia(dia.id, -1)) });
          if (idx < days.length - 1) {
            acciones.push({ icono: 'arrow-down', texto: 'Bajar el día', onPress: cerrarY(() => moverDia(dia.id, 1)) });
          }
          acciones.push({ icono: 'trash-outline', texto: 'Borrar el día', peligro: true, onPress: cerrarY(() => removeDay(dia.id)) });
          return acciones;
        })()}
      />

      {/*
        IGUALAR EL DÍA. Cinco ejercicios a 4 series y 2:00 de descanso eran
        veinte casillas; aquí son dos. Lo que se deja vacío no cambia, y las
        reps no pisan los segundos de un isométrico (lib/editorRutina.ts).
      */}
      {(() => {
        const dia = days.find((d) => d.id === igualando);
        const ejercicios = dia?.exercises ?? [];
        const hayReps = ejercicios.some((e) => !isHoldMeasure(e.measure));
        const haySegundos = ejercicios.some((e) => isHoldMeasure(e.measure));
        const variable = prescripcionDe(planActivo()).variable.tipo;
        const conRir = seMuestra.objetivo && variable === 'rir';
        // RPE, letras, tempo…: con su nombre, como en cada ejercicio.
        const otraVariable = seMuestra.objetivo && variable !== 'rir' ? nombreDeLaVariable(planActivo()) : null;
        const valores: Igualar = {
          sets: Number.parseInt(ig.sets, 10) > 0 ? Number.parseInt(ig.sets, 10) : undefined,
          reps: ig.reps.trim() || undefined,
          segundos: ig.segundos.trim() || undefined,
          rir: conRir && ig.rir.trim() ? rirDeTexto(ig.rir) : undefined,
          prescrito: otraVariable && ig.prescrito.trim() ? ig.prescrito.trim() : undefined,
          restSeconds: ig.descanso.trim() ? segundosDeTexto(ig.descanso) || undefined : undefined,
        };
        const algo = Object.values(valores).some((v) => v !== undefined);
        return (
          <Sheet
            visible={!!dia}
            onClose={() => setIgualando(null)}
            titulo="Igualar el día"
            descripcion={dia ? frase`${nombreDelDia(dia.name, days.indexOf(dia))} · lo que dejes vacío no cambia` : undefined}
          >
            <View style={styles.exerciseFields}>
              <Casilla
                etiqueta="Series"
                keyboardType="number-pad"
                value={ig.sets}
                onChangeText={(v) => setIg((p) => ({ ...p, sets: v }))}
                placeholder="4"
              />
              {hayReps ? (
                <Casilla
                  etiqueta="Reps"
                  value={ig.reps}
                  onChangeText={(v) => setIg((p) => ({ ...p, reps: v }))}
                  placeholder="8-12"
                />
              ) : null}
              {haySegundos ? (
                <Casilla
                  etiqueta="Segundos"
                  value={ig.segundos}
                  onChangeText={(v) => setIg((p) => ({ ...p, segundos: v }))}
                  placeholder="30"
                />
              ) : null}
              {conRir ? (
                <Casilla
                  etiqueta="RIR"
                  keyboardType="number-pad"
                  value={ig.rir}
                  onChangeText={(v) => setIg((p) => ({ ...p, rir: v }))}
                  placeholder="2"
                />
              ) : otraVariable ? (
                <Casilla
                  etiqueta={otraVariable}
                  value={ig.prescrito}
                  onChangeText={(v) => setIg((p) => ({ ...p, prescrito: v }))}
                  placeholder={ejemploDeLaVariable(planActivo()) || 'B'}
                />
              ) : null}
              <Casilla
                etiqueta="Descanso"
                keyboardType="numbers-and-punctuation"
                value={ig.descanso}
                onChangeText={(v) => setIg((p) => ({ ...p, descanso: v }))}
                placeholder="2:00"
              />
            </View>
            <Button
              title={frase`Aplicar a los ${ejercicios.length} ejercicios`}
              disabled={!algo}
              onPress={() => {
                if (dia) igualarDia(dia.id, valores);
                setIgualando(null);
                showToast('Día igualado');
              }}
              style={{ marginTop: spacing.md }}
            />
          </Sheet>
        );
      })()}

      <Button title="+ Añadir día" variant="ghost" onPress={addDay} style={styles.addDayBtn} />

      {/* Lo que hará TODOS los días aparte del plan (el pino, la movilidad).
          Va después de los días y no encima: es un extra que se pone una vez,
          y arriba empujaba los días —lo que se viene a tocar— una tarjeta más
          abajo cada vez que se abría el editor. */}
      {clientId && profile ? (
        <RutinaDiariaEditor trainerId={profile.uid} clientId={clientId} />
      ) : null}

      <VistaDelAlumno
        visible={verComoAlumno}
        onClose={() => setVerComoAlumno(false)}
        dias={diasAGuardar()}
        perso={planDeLaPrescripcion({
          schedule,
          personalizado: configuracionAGuardar(),
          prescripcion: prescripcionSimpleAGuardar(),
        })}
        pedirEsfuerzo={pedirEsfuerzo}
      />
      {profile ? (
        <AplicarAVarios
          visible={aplicarVarios}
          onClose={() => setAplicarVarios(false)}
          trainerId={profile.uid}
          excepto={clientId}
          onAplicar={aplicarAOtros}
        />
      ) : null}

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  nombreFila: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.md },
  masBtn: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  masBtnTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  ajustesCab: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  ajustesResumen: { ...typography.small, color: colors.textMuted, marginTop: -4 },
  masDelDia: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: spacing.xs, marginBottom: spacing.sm },
  masDelDiaTexto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  sugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryMuted,
  },
  sugerenciaTexto: { ...typography.small, color: colors.text, flex: 1 },
  sugerenciaAplicar: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  dayCardDragging: { borderColor: colors.hairline },
  dayCard: { marginBottom: spacing.md },
  scheduleCard: { marginBottom: spacing.md },
  scheduleTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
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
  // El panel de personalización: cerrado por defecto para que el editor siga
  // empezando por lo de siempre —los ejercicios—, y abierto de un toque para
  // quien quiera montarse su método.
  persoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  persoToggleTexto: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  persoCaja: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceAlt,
    gap: spacing.xs,
  },
  persoTitulo: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  persoAyuda: { ...typography.small, color: colors.textFaint, marginBottom: spacing.xs },
  fusionCaja: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  fusionEtiqueta: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  fusionAviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
  },
  fusionAvisoTexto: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 18 },
  fusionFila: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  fusionFilaTexto: { ...typography.small, color: colors.textMuted, marginRight: 2 },
  // En fila y envolviendo: son interruptores cortos, y en columna ocupaban
  // media pantalla para decir cuatro palabras.
  persoFichas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  gtgFila: {
    flexDirection: 'row',
    alignItems: 'center',
    // El nombre del método no se abrevia: "Grease the groove" pide seis
    // píxeles más de los que quedan al lado del campo de series en un móvil
    // estrecho, así que el campo se va debajo en vez de comerse la etiqueta.
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gtgCampo: { flex: 1, marginBottom: 0 },
  gtgIndicaciones: { minHeight: 76, textAlignVertical: 'top', marginBottom: 0 },
  dayIntensityRow: { marginBottom: spacing.sm },
  dayIntensityLabel: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  dayIntensityControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  restToggles: { flexDirection: 'row', gap: spacing.xs },
  optionalHint: {
    ...typography.small,
    color: colors.primaryBright,
    fontSize: 12,
    marginBottom: spacing.sm,
    lineHeight: 17,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  removeDayBtn: { paddingHorizontal: spacing.sm },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayHeaderMain: { flex: 1, paddingVertical: spacing.xs },
  dayTitle: { ...typography.h3, color: colors.text },
  pickerRowYa: { opacity: 0.85 },
  pickerYa: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pickerYaTexto: { ...typography.small, fontSize: 12, color: colors.primary, fontFamily: fonts.semiBold },
  // Abierto, el título es el campo del nombre: una raya debajo y un lápiz.
  dayTitleEditable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayTitleInput: { flex: 1, minWidth: 0, padding: 0, minHeight: 34 },
  daySummary: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  dayEjercicios: { ...typography.small, color: colors.text, marginTop: 4, lineHeight: 18 },
  weekdayRow: { marginTop: spacing.sm, marginBottom: spacing.sm },
  avisoRepetido: { ...typography.small, color: colors.warning, marginTop: spacing.xs },
  weekdayHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  weekdayLabel: fieldLabel,
  // Con aire entre ejercicio y ejercicio: la pastilla de la superserie va
  // montada sobre la raya que los separa.
  exerciseRow: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  enlace: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    // Opaco: tapa la raya, y la pastilla se lee como el broche entre los dos.
    backgroundColor: colors.surface,
    marginTop: -(spacing.md + 13),
    marginBottom: spacing.sm,
  },
  enlaceActivo: { borderColor: colors.primary },
  enlaceTexto: { ...typography.small, fontSize: 12, color: colors.textFaint, fontFamily: fonts.semiBold },
  enlaceTextoActivo: { color: colors.primaryBright },
  enlaceSeparar: { ...typography.small, fontSize: 12, color: colors.textMuted },
  bloqueNota: { ...typography.small, fontSize: 12, color: colors.primaryBright, marginTop: spacing.xs },
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
  },
  exerciseTitleText: { flex: 1, minWidth: 0 },
  // Subir y bajar, juntos en una pastilla: se leen como un solo control.
  ordenGrupo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  ordenBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  ordenBtnApagado: { opacity: 0.25 },
  ordenSeparador: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  exerciseFields: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: spacing.sm },
  casilla: { flex: 1, minWidth: 0 },
  casillaEtiqueta: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textMuted, marginBottom: 3 },
  casillaCaja: { marginBottom: 0 },
  casillaCampo: {
    minHeight: 40,
    paddingVertical: 6,
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: 15,
  },
  masFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  masTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, flexShrink: 1 },
  masCaja: { marginTop: spacing.xs },
  // Va en `containerStyle`, no en `style`: `style` acaba en el TextInput de
  // dentro, así que el contenedor seguía midiendo lo que ocupase su etiqueta y
  // "Descanso (min:seg)" empujaba la fila fuera de la pantalla.
  smallInput: { flex: 1, marginBottom: 0 },
  medidaHeredada: {
    ...typography.small,
    color: colors.primaryBright,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  loadLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    fontSize: 11,
  },
  // Marcadores de carga en color (sin emojis): azul = lastre, dorado = goma.
  markWeighted: { color: '#5B9BD5', fontFamily: fonts.semiBold, fontSize: 13 },
  markAssisted: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 13 },
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
  moveBtn: { padding: spacing.xs },
  moveDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moveActionBtn: { paddingVertical: 10 },
  moveExtremos: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  moveExtremoBtn: { flex: 1, paddingVertical: 10 },
  moveEliminar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  moveEliminarTexto: { ...typography.small, color: colors.danger, fontFamily: fonts.semiBold },
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
  /*
   * Tres botones en fila, y si no caben, en dos filas.
   *
   * Con `flex: 1` a secas se reparten el ancho pase lo que pase, y en un móvil
   * estrecho —o con la letra del sistema más grande— a cada uno le tocan menos
   * píxeles de los que mide su palabra: "Borrador" se partía en "Borrado" y una
   * "r" suelta debajo. Con un ancho mínimo, cuando los tres ya no caben la fila
   * se parte en dos y cada botón vuelve a tener sitio para su texto.
   */
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
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
  exerciseGrupo: { ...typography.small, color: colors.textFaint, marginTop: 2 },
  mutedText: { ...typography.small, color: colors.textFaint },
  addDayBtn: { marginBottom: spacing.lg },
  saveError: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
