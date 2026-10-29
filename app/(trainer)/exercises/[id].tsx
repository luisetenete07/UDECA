import React, { useEffect, useMemo, useRef, useState } from 'react';
import { frase, t } from '../../../lib/idioma';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { updateUserProfile } from '../../../lib/firestore/users';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../lib/auth-context';
import {
  createExercise,
  deleteExercise,
  getExercise,
  getExercisesForTrainer,
  updateExercise,
} from '../../../lib/firestore/exercises';
import { propagarNombreDeEjercicio } from '../../../lib/firestore/renombrarEjercicio';
import { showToast } from '../../../components/Toast';
import { Chip, ChipRow } from '../../../components/Chip';
import { Dialogo } from '../../../components/Dialogo';
import { Sheet } from '../../../components/Sheet';
import { Card } from '../../../components/Card';
import { VisorDeVideo } from '../../../components/VisorDeVideo';
import { ICONO_DE_MEDIDA } from '../../../components/TarjetaDeEjercicio';
import { useMiniaturaDeVimeo } from '../../../components/MiniaturaCurso';
import { colorDeCategoria } from '../../../lib/colorDeCategoria';
import { musculosPrincipales, type MuscleId } from '../../../lib/muscles';
import { miniaturaDelEnlace, parseVimeoUrl, parseYouTubeId } from '../../../lib/video';
import { unido } from '../../../lib/texto';
import { colors, fieldLabel, fonts, radius, spacing, typography } from '../../../lib/theme';
import {
  conMedidaDeGrupo,
  ejerciciosADesactualizar,
  grupoRenombrado,
  medidaDelGrupo,
} from '../../../lib/medidaDeGrupo';
import {
  EXERCISE_MEASURES,
  MEASURE_LABEL,
  MEASURE_SHORT,
  MUSCLE_GROUPS,
  type ExerciseMeasure,
  type MuscleGroup,
} from '../../../lib/types';

export default function ExerciseEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();

  // Categorías del coach: las suyas si las tiene, si no las de por defecto.
  const categories = useMemo(
    () =>
      profile?.exerciseCategories && profile.exerciseCategories.length > 0
        ? profile.exerciseCategories
        : [...MUSCLE_GROUPS],
    [profile?.exerciseCategories]
  );
  const [editCats, setEditCats] = useState(false);
  const [newCat, setNewCat] = useState('');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  // Borrar un ejercicio se lleva por delante lo que ya está escrito con él:
  // las rutinas que lo usan y su rastro en el historial. No puede pasar de un
  // toque, y menos con un botón rojo a ancho completo pegado a "Guardar".
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string>(MUSCLE_GROUPS[0]);
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [measure, setMeasure] = useState<ExerciseMeasure>('reps');
  // "Solo este ejercicio": su medida es suya y el grupo no la toca.
  const [medidaPropia, setMedidaPropia] = useState(false);
  const [alcanceAbierto, setAlcanceAbierto] = useState(false);
  const [subgroup, setSubgroup] = useState<string>('');
  const [newSub, setNewSub] = useState('');
  // Renombrar un subgrupo ya creado, desde el propio editor del ejercicio.
  const [renameSub, setRenameSub] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renaming, setRenaming] = useState(false);
  // Nombres ya usados en la biblioteca, para no crear duplicados.
  const [takenNames, setTakenNames] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Los músculos del ejercicio guardado (vienen del pack): para la vista previa.
  const [pesos, setPesos] = useState<{
    muscles?: MuscleId[];
    muscleWeights?: Partial<Record<MuscleId, number>>;
  }>({});
  const [nuevoSubAbierto, setNuevoSubAbierto] = useState(false);
  const [verVideo, setVerVideo] = useState(false);
  const miniaturaVimeo = useMiniaturaDeVimeo(videoUrl.trim() || undefined);
  /*
   * Cómo se llamaba y qué vídeo tenía al abrir.
   *
   * Sirve para saber si hay algo que llevar a las copias. Sin esto habría que
   * recorrer las rutinas de todos los alumnos en CADA guardado, aunque lo único
   * que se haya tocado sea la descripción.
   *
   * El vídeo entró en la cuenta cuando las rutinas diarias empezaron a traerse
   * los ejercicios de la biblioteca: esas sí copian el enlace dentro, así que
   * cambiarlo en la biblioteca tiene que llegar hasta ellas.
   */
  const nombreAlAbrir = useRef('');
  const videoAlAbrir = useRef('');

  useEffect(() => {
    if (isNew || !id) return;
    (async () => {
      const exercise = await getExercise(id);
      if (exercise) {
        nombreAlAbrir.current = exercise.name;
        videoAlAbrir.current = exercise.videoUrl ?? '';
        setName(exercise.name);
        setMuscleGroup(exercise.muscleGroup);
        setDescription(exercise.description ?? '');
        setVideoUrl(exercise.videoUrl ?? '');
        setMeasure(exercise.measure ?? 'reps');
        setMedidaPropia(exercise.medidaPropia === true);
        setSubgroup(exercise.subgroup ?? '');
        setPesos({ muscles: exercise.muscles, muscleWeights: exercise.muscleWeights });
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  // Nombres del resto de la biblioteca (excluye el que se está editando).
  useEffect(() => {
    if (!profile) return;
    getExercisesForTrainer(profile.uid)
      .then((list) =>
        setTakenNames(
          new Set(list.filter((e) => e.id !== id).map((e) => e.name.trim().toLowerCase()))
        )
      )
      .catch(() => {});
  }, [profile, id]);

  const handleSave = async () => {
    if (!profile) return;
    if (!name.trim()) {
      setError('El nombre del ejercicio es obligatorio.');
      return;
    }
    // Un mismo nombre dos veces haría imposible distinguirlos en las rutinas y
    // rompería la sincronización del pack (que empareja por nombre).
    if (takenNames.has(name.trim().toLowerCase())) {
      setError('Ya tienes un ejercicio con ese nombre.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Si el grupo tiene medida, es la suya y no la que hubiera en pantalla:
      // así un ejercicio que se acaba de mover a "Aguantes" entra ya en
      // segundos, sin que nadie tenga que acordarse de cambiarlo. Salvo que
      // sea "solo este ejercicio": entonces manda la que se ha elegido aquí.
      const medidaFinal = medidaPropia ? measure : medidaGrupo ?? measure;
      const campos = {
        name: name.trim(),
        muscleGroup,
        description: description.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        measure: medidaFinal,
        subgroup: subgroup || undefined,
        // Se escribe también el `false`: si antes era propia y ahora vuelve al
        // grupo, un campo sin escribir dejaría el `true` viejo en Firestore.
        medidaPropia: medidaPropia ? true : isNew ? undefined : false,
      };
      if (isNew) {
        await createExercise({ trainerId: profile.uid, ...campos });
      } else if (id) {
        await updateExercise(id, campos);
        /*
         * El nombre está copiado dentro de cada rutina (ver
         * lib/renombrarEjercicio.ts). Si ha cambiado, hay que llevarlo a los
         * alumnos que ya tienen el ejercicio puesto; antes había que quitarlo
         * del plan y volverlo a poner para que les saliera bien escrito.
         *
         * Se hace DESPUÉS de guardar y sin tumbar el guardado: si esto falla
         * (cobertura, permisos), el ejercicio ya está bien en la biblioteca y
         * lo que queda pendiente son las copias, así que se avisa y punto. Lo
         * que no puede pasar es que un fallo aquí parezca que no se guardó
         * nada y el entrenador lo escriba otra vez.
         */
        const cambioElNombre = !!nombreAlAbrir.current && nombreAlAbrir.current !== campos.name;
        const cambioElVideo = videoAlAbrir.current !== (campos.videoUrl ?? '');
        if (cambioElNombre || cambioElVideo) {
          try {
            // El vídeo solo se manda si ha cambiado: `undefined` significa "no
            // lo toques", y una cadena vacía sí es una orden de quitarlo.
            await propagarNombreDeEjercicio(
              profile.uid,
              id,
              campos.name,
              cambioElVideo ? campos.videoUrl ?? '' : undefined
            );
            nombreAlAbrir.current = campos.name;
            videoAlAbrir.current = campos.videoUrl ?? '';
          } catch {
            showToast('Guardado, pero no se pudo actualizar en las rutinas');
            router.back();
            return;
          }
        }
      }
      showToast('Ejercicio guardado');
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !id) return;
    setConfirmarBorrado(false);
    setSaving(true);
    try {
      await deleteExercise(id);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const saveCategories = async (list: string[]) => {
    if (!profile) return;
    try {
      await updateUserProfile(profile.uid, { exerciseCategories: list });
      await refreshProfile();
    } catch {
      showToast('No se pudieron guardar las categorías');
    }
  };

  const addCategory = () => {
    const c = newCat.trim();
    if (!c) return;
    if (categories.some((g) => g.toLowerCase() === c.toLowerCase())) {
      showToast('Esa categoría ya existe');
      return;
    }
    setNewCat('');
    saveCategories([...categories, c]);
  };

  // Subgrupos definidos por el coach para la categoría seleccionada.
  const subgroups = profile?.categorySubgroups?.[muscleGroup] ?? [];

  /*
   * La medida decidida para el grupo al que pertenece este ejercicio.
   *
   * Cuando existe, este editor deja de preguntar por la medida del ejercicio:
   * la decide el grupo, y cambiarla aquí la cambia para todos. Es lo que evita
   * tener que acordarse en cada ficha nueva de que "Aguantes va en segundos"
   * —olvidarlo una vez saca un isométrico pidiendo repeticiones en mitad del
   * entreno, donde ya no hay forma de arreglarlo—.
   */
  const medidaGrupo = medidaDelGrupo(profile?.subgroupMeasures, muscleGroup, subgroup);
  const [aplicandoGrupo, setAplicandoGrupo] = useState(false);
  const [cuantosEnGrupo, setCuantosEnGrupo] = useState(0);
  const cuantosEnGrupoTexto =
    cuantosEnGrupo === 1 ? 'el ejercicio' : frase`los ${cuantosEnGrupo} ejercicios`;

  // Cuántos ejercicios hay ya en este grupo, para poder decir a cuántos afecta
  // un cambio antes de hacerlo.
  useEffect(() => {
    if (!profile || !subgroup) {
      setCuantosEnGrupo(0);
      return;
    }
    getExercisesForTrainer(profile.uid)
      .then((list) =>
        setCuantosEnGrupo(
          list.filter((e) => e.muscleGroup === muscleGroup && (e.subgroup ?? '') === subgroup).length
        )
      )
      .catch(() => setCuantosEnGrupo(0));
  }, [profile, muscleGroup, subgroup]);

  // Al entrar en un grupo que ya tiene medida, el ejercicio la adopta: es lo
  // que hace que no haya que ponerla a mano al crear cada uno. Si es "solo
  // este ejercicio", no: la suya no la cambia nadie más que el entrenador.
  useEffect(() => {
    if (medidaGrupo && !medidaPropia) setMeasure(medidaGrupo);
  }, [medidaGrupo, medidaPropia]);

  /**
   * Cambia la medida de TODO el grupo y la escribe en cada uno de sus
   * ejercicios.
   *
   * Se escribe en los ejercicios además de en el grupo porque el alumno no lee
   * el perfil de su entrenador: lee los ejercicios. El grupo es quien decide y
   * quien lo recuerda para los que vengan; la copia en cada ejercicio es lo que
   * hace que el resto de la app siga leyendo un único campo.
   */
  const aplicarMedidaAlGrupo = async (nueva: ExerciseMeasure) => {
    if (!profile || !subgroup) return;
    setMeasure(nueva);
    setAplicandoGrupo(true);
    try {
      const library = await getExercisesForTrainer(profile.uid);
      const pendientes = ejerciciosADesactualizar(library, muscleGroup, subgroup, nueva);
      await Promise.all(pendientes.map((e) => updateExercise(e.id, { measure: nueva })));
      await updateUserProfile(profile.uid, {
        subgroupMeasures: conMedidaDeGrupo(
          profile.subgroupMeasures,
          muscleGroup,
          subgroup,
          nueva
        ),
      });
      await refreshProfile();
      showToast(
        pendientes.length > 0
          ? `${MEASURE_LABEL[nueva]} en todo «${subgroup}» (${pendientes.length} actualizados)`
          : frase`«${subgroup}» se mide en ${MEASURE_LABEL[nueva].toLowerCase()}`
      );
    } catch {
      showToast('No se pudo aplicar la medida al grupo');
    } finally {
      setAplicandoGrupo(false);
    }
  };

  /*
   * A QUÉ SE APLICA: TODO EL GRUPO O SOLO ESTE EJERCICIO.
   *
   * Lo normal (y lo que viene puesto) es el grupo: se decide una vez y vale
   * para todos. "Solo este ejercicio" es la excepción —el único de "Aguantes"
   * que va en repeticiones—: su medida se queda como está aunque cambie la del
   * grupo, y solo la cambia el entrenador aquí. Se guarda con "Guardar", como
   * el resto de la ficha.
   */
  const elegirAlcance = (soloEste: boolean) => {
    setAlcanceAbierto(false);
    setMedidaPropia(soloEste);
    // De vuelta al grupo, coge la del grupo (si la tiene): es lo que significa.
    if (!soloEste && medidaGrupo) setMeasure(medidaGrupo);
  };

  /** Crea un subgrupo dentro de la categoría actual y lo deja seleccionado. */
  const addSubgroup = async () => {
    const sg = newSub.trim();
    if (!sg || !profile) return;
    if (subgroups.some((x) => x.toLowerCase() === sg.toLowerCase())) {
      showToast('Ese subgrupo ya existe');
      return;
    }
    setNewSub('');
    setSubgroup(sg);
    try {
      await updateUserProfile(profile.uid, {
        categorySubgroups: {
          ...(profile.categorySubgroups ?? {}),
          [muscleGroup]: [...subgroups, sg],
        },
      });
      await refreshProfile();
    } catch {
      showToast('No se pudo crear el subgrupo');
    }
  };

  /**
   * Renombra un subgrupo de la categoría actual. El nombre vive en dos sitios:
   * la lista del perfil y el campo `subgroup` de cada ejercicio que lo usa, así
   * que hay que tocar los dos o esos ejercicios quedan huérfanos.
   */
  const applyRenameSub = async () => {
    if (!profile || !renameSub) return;
    const to = renameText.trim();
    if (!to) return;
    if (to === renameSub) {
      setRenameSub(null);
      return;
    }
    if (subgroups.some((x) => x.toLowerCase() === to.toLowerCase())) {
      showToast('Ya existe un subgrupo con ese nombre');
      return;
    }
    setRenaming(true);
    try {
      const library = await getExercisesForTrainer(profile.uid);
      const affected = library.filter(
        (e) => e.muscleGroup === muscleGroup && e.subgroup === renameSub
      );
      await Promise.all(affected.map((e) => updateExercise(e.id, { subgroup: to })));
      await updateUserProfile(profile.uid, {
        categorySubgroups: {
          ...(profile.categorySubgroups ?? {}),
          [muscleGroup]: subgroups.map((x) => (x === renameSub ? to : x)),
        },
        // La medida viaja con el nombre. Si se quedara atrás, hoy no se notaría
        // —los ejercicios ya la tienen escrita— y el fallo saldría semanas
        // después, al añadir uno nuevo y verlo pedir repeticiones.
        subgroupMeasures: grupoRenombrado(
          profile.subgroupMeasures,
          muscleGroup,
          renameSub,
          to
        ),
      });
      await refreshProfile();
      // Si el ejercicio abierto estaba en ese subgrupo, sigue en él.
      if (subgroup === renameSub) setSubgroup(to);
      setRenameSub(null);
      showToast('Subgrupo renombrado');
    } catch {
      showToast('No se pudo renombrar el subgrupo');
    } finally {
      setRenaming(false);
    }
  };

  const removeCategory = (group: string) => {
    const list = categories.filter((g) => g !== group);
    if (list.length === 0) {
      showToast('Deja al menos una categoría');
      return;
    }
    if (muscleGroup === group) setMuscleGroup(list[0]);
    saveCategories(list);
  };

  if (loading) return <LoadingScreen />;

  // La categoría del ejercicio aunque ya no esté en la lista del coach (un
  // ejercicio antiguo, o importado): si no, ninguna pastilla saldría elegida.
  const categoriasVisibles = categories.includes(muscleGroup)
    ? categories
    : [...categories, muscleGroup];
  const color = colorDeCategoria(profile?.categoryColors, categories, muscleGroup);
  const enlace = videoUrl.trim();
  const deYouTube = enlace ? parseYouTubeId(enlace) : null;
  const deVimeo = enlace && !deYouTube ? parseVimeoUrl(enlace) : null;
  const miniatura = miniaturaDelEnlace(enlace, 'mq') ?? miniaturaVimeo;
  const enlaceRaro = !!enlace && !/^https?:\/\//i.test(enlace);
  // Sin nombre no se sabe qué trabaja: se deduciría solo de la categoría.
  const musculos = name.trim() ? musculosPrincipales({ name: name.trim(), muscleGroup, ...pesos }) : [];

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: isNew ? t('Nuevo ejercicio') : t('Editar ejercicio') }} />

      {/*
       * ASÍ SE VERÁ. La tarjeta de arriba es el ejercicio tal y como sale en la
       * biblioteca y en el entreno del alumno: su vídeo (o su color y cómo se
       * mide), su nombre y lo que trabaja. Se va rellenando mientras se
       * escribe, así que lo que falta se ve sin buscarlo.
       */}
      <View style={styles.vista}>
        <Pressable
          onPress={() => (enlace && !enlaceRaro ? setVerVideo(true) : undefined)}
          style={[styles.vistaMedia, { backgroundColor: `${color}1F` }]}
        >
          {miniatura ? (
            <>
              <Image source={{ uri: miniatura }} style={styles.vistaImagen} resizeMode="cover" />
              <View style={styles.vistaPlay}>
                <Ionicons name="play" size={18} color={colors.text} style={{ marginLeft: 2 }} />
              </View>
            </>
          ) : enlace && !enlaceRaro ? (
            <Ionicons name="play-circle-outline" size={36} color={color} />
          ) : (
            <>
              <Ionicons name={ICONO_DE_MEDIDA[measure]} size={30} color={color} />
              <Text style={styles.vistaSinVideo}>Sin vídeo todavía</Text>
            </>
          )}
          <View style={[styles.vistaFilo, { backgroundColor: color }]} />
        </Pressable>
        <View style={styles.vistaTexto}>
          <Text style={[styles.vistaNombre, !name.trim() && styles.vistaNombreVacio]} numberOfLines={2}>
            {name.trim() || (isNew ? 'Nuevo ejercicio' : 'Sin nombre')}
          </Text>
          <View style={styles.vistaMetaFila}>
            <View style={[styles.vistaPunto, { backgroundColor: color }]} />
            <Text style={styles.vistaMeta} numberOfLines={1}>
              {unido(muscleGroup, subgroup || undefined, MEASURE_SHORT[measure])}
            </Text>
          </View>
          {musculos.length > 0 ? (
            <Text style={styles.vistaMusculos} numberOfLines={1}>
              {frase`Trabaja ${musculos.join(' · ')}`}
            </Text>
          ) : null}
        </View>
      </View>

      <TextField
        label="Nombre"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder="Ej. Dominadas estrictas"
        autoFocus={isNew}
      />

      {/* DÓNDE VA: categoría y, dentro, su subgrupo. */}
      <Card style={styles.seccion}>
        <View style={styles.seccionCab}>
          <Ionicons name="albums-outline" size={16} color={colors.primary} />
          <Text style={styles.seccionTitulo}>Dónde va</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setEditCats((v) => !v)} hitSlop={6}>
            <Text style={styles.catEdit}>{editCats ? 'Listo' : 'Editar categorías'}</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Categoría</Text>
        {/* En varias líneas y no deslizando: así se ven todas, también la
            elegida, que deslizando podía quedarse fuera de la pantalla. */}
        <ChipRow>
          {categoriasVisibles.map((group) => (
            <Chip
              key={group}
              texto={group}
              punto={colorDeCategoria(profile?.categoryColors, categories, group)}
              activo={muscleGroup === group && !editCats}
              onPress={() => {
                if (editCats) return;
                setMuscleGroup(group);
                if (group !== muscleGroup) setSubgroup('');
              }}
              accion={editCats ? 'close-circle' : undefined}
              colorAccion={colors.danger}
              onAccion={() => removeCategory(group)}
            />
          ))}
        </ChipRow>
        {editCats ? (
          <View style={styles.addCatRow}>
            <TextInput
              value={newCat}
              onChangeText={setNewCat}
              placeholder="Nueva categoría…"
              placeholderTextColor={colors.textFaint}
              style={styles.addCatInput}
              onSubmitEditing={addCategory}
              returnKeyType="done"
            />
            <Pressable onPress={addCategory} style={styles.addCatBtn} hitSlop={6}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addCatText}>Añadir</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[styles.label, { marginTop: spacing.md }]}>{frase`Subgrupo de ${muscleGroup}`}</Text>
        <ChipRow>
          <Chip texto="Ninguno" activo={subgroup === ''} onPress={() => setSubgroup('')} />
          {subgroups.map((sg) => (
            <Chip
              key={sg}
              texto={sg}
              activo={subgroup === sg}
              onPress={() => setSubgroup(sg)}
              /* Lápiz para renombrarlo sin salir del editor. */
              accion="pencil"
              onAccion={() => {
                setRenameSub(sg);
                setRenameText(sg);
              }}
            />
          ))}
          {/* Crear uno es lo raro: va como una pastilla más, no como un campo
              siempre abierto en mitad de la ficha. */}
          <Chip
            texto="Nuevo"
            icono={nuevoSubAbierto ? 'close' : 'add'}
            suave
            onPress={() => setNuevoSubAbierto((v) => !v)}
          />
        </ChipRow>
        {nuevoSubAbierto ? (
          <View style={styles.addCatRow}>
            <TextInput
              value={newSub}
              onChangeText={setNewSub}
              placeholder={frase`Nuevo subgrupo de ${muscleGroup}…`}
              placeholderTextColor={colors.textFaint}
              style={styles.addCatInput}
              onSubmitEditing={() => {
                addSubgroup();
                setNuevoSubAbierto(false);
              }}
              returnKeyType="done"
              autoFocus
            />
            <Pressable
              onPress={() => {
                addSubgroup();
                setNuevoSubAbierto(false);
              }}
              style={styles.addCatBtn}
              hitSlop={6}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addCatText}>Crear</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      {/* CÓMO SE ANOTA: cinco formas, cada una con su ejemplo. Con el ejemplo
          al lado no hay que imaginar qué casillas verá el alumno. */}
      <Card style={styles.seccion}>
        <View style={styles.seccionCab}>
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={styles.seccionTitulo}>Cómo se anota</Text>
          <View style={{ flex: 1 }} />
          {/* A qué se aplica: lo dice el propio botón, y al tocarlo salen las
              dos opciones. Sin subgrupo no hay grupo, así que no hay nada que
              elegir. */}
          {subgroup ? (
            <Pressable
              onPress={() => setAlcanceAbierto(true)}
              hitSlop={6}
              style={styles.alcanceBoton}
              accessibilityRole="button"
            >
              <Text style={styles.catEdit} numberOfLines={1}>
                {medidaPropia ? 'Solo este ejercicio' : 'Todo el grupo'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
        {/* Con un subgrupo elegido, la medida es del GRUPO: se decide una vez y
            vale para todo lo que haya dentro y para lo que se meta después. Sin
            subgrupo no hay grupo que decida, así que es de este ejercicio. */}
        <Text style={styles.measureHint}>
          {subgroup
            ? medidaPropia
              ? frase`Solo para este ejercicio: aunque cambies la de «${subgroup}», este se queda como lo dejes aquí.`
              : medidaGrupo
                ? frase`La decide el grupo «${subgroup}»: vale para ${cuantosEnGrupoTexto} y para los que añadas después.`
                : frase`Se aplicará a ${cuantosEnGrupoTexto} de «${subgroup}» y a los que metas ahí después.`
            : 'Solo para este ejercicio.'}
        </Text>
        <View style={styles.medidas}>
          {EXERCISE_MEASURES.map((m) => {
            const activa = measure === m;
            return (
              <Pressable
                key={m}
                onPress={() => (subgroup && !medidaPropia ? aplicarMedidaAlGrupo(m) : setMeasure(m))}
                disabled={aplicandoGrupo}
                style={[styles.medida, activa && styles.medidaActiva]}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
              >
                <Ionicons
                  name={ICONO_DE_MEDIDA[m]}
                  size={18}
                  color={activa ? colors.primaryBright : colors.textMuted}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.medidaTexto, activa && styles.medidaTextoActiva]}>
                    {MEASURE_SHORT[m]}
                  </Text>
                  <Text style={styles.medidaEjemplo}>{EJEMPLO_DE_MEDIDA[m]}</Text>
                </View>
                {activa ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* TÉCNICA: el vídeo (con su comprobación al momento) y la explicación. */}
      <Card style={styles.seccion}>
        <View style={styles.seccionCab}>
          <Ionicons name="videocam-outline" size={16} color={colors.primary} />
          <Text style={styles.seccionTitulo}>Técnica</Text>
        </View>
        <TextField
          label="Vídeo"
          value={videoUrl}
          onChangeText={setVideoUrl}
          placeholder="Enlace de YouTube, Vimeo o del vídeo"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          containerStyle={{ marginBottom: spacing.xs }}
        />
        {enlace ? (
          <View style={styles.videoEstado}>
            <Ionicons
              name={enlaceRaro ? 'alert-circle-outline' : 'checkmark-circle'}
              size={14}
              color={enlaceRaro ? colors.danger : colors.primary}
            />
            <Text style={[styles.videoEstadoTexto, enlaceRaro && { color: colors.danger }]}>
              {enlaceRaro
                ? 'Tiene que empezar por https://'
                : deYouTube
                  ? 'Vídeo de YouTube'
                  : deVimeo
                    ? 'Vídeo de Vimeo'
                    : 'Enlace directo al vídeo'}
            </Text>
            {!enlaceRaro ? (
              <Pressable onPress={() => setVerVideo(true)} hitSlop={8}>
                <Text style={styles.catEdit}>Ver</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setVideoUrl('')} hitSlop={8}>
              <Text style={styles.videoQuitar}>Quitar</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.measureHint}>Con vídeo, el alumno puede ver la técnica en mitad del entreno.</Text>
        )}
        <TextField
          label="Indicaciones"
          value={description}
          onChangeText={setDescription}
          placeholder="Ej. Escápulas atrás, sin balanceo, bajada controlada."
          multiline
          numberOfLines={4}
          style={styles.textarea}
          containerStyle={{ marginTop: spacing.sm, marginBottom: 0 }}
        />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={isNew ? 'Crear ejercicio' : 'Guardar cambios'}
        onPress={handleSave}
        loading={saving}
        style={{ marginTop: spacing.sm }}
      />

      {!isNew ? (
        <Pressable
          onPress={() => setConfirmarBorrado(true)}
          style={styles.borrarEnlace}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={14} color={colors.textFaint} />
          <Text style={styles.borrarEnlaceTexto}>Eliminar ejercicio</Text>
        </Pressable>
      ) : (
        <View style={{ height: spacing.xl }} />
      )}

      <VisorDeVideo
        visible={verVideo}
        url={enlace}
        titulo={name.trim() || undefined}
        profile={profile}
        onCerrar={() => setVerVideo(false)}
        protegido={false}
      />

      <Dialogo
        visible={confirmarBorrado}
        onClose={() => setConfirmarBorrado(false)}
        icono="trash-outline"
        titulo={`¿Eliminar ${name || 'este ejercicio'}?`}
        texto="Desaparece de tu biblioteca y de las rutinas que lo usen. Los entrenamientos ya registrados con él se quedan como están."
        accion="Eliminar"
        onAccion={handleDelete}
        cargando={saving}
      />

      {/* Renombrar subgrupo (arrastra a todos los ejercicios que lo usan) */}
      <Dialogo
        visible={!!renameSub}
        onClose={() => setRenameSub(null)}
        titulo="Renombrar subgrupo"
        texto={frase`Se actualizarán también los ejercicios que ya están en «${renameSub ?? ''}».`}
      >
        <TextInput
          value={renameText}
          onChangeText={setRenameText}
          placeholder="Nuevo nombre"
          placeholderTextColor={colors.textFaint}
          style={[styles.addCatInput, { marginTop: spacing.md }]}
          onSubmitEditing={applyRenameSub}
          returnKeyType="done"
          autoFocus
        />
        <Button
          title="Guardar"
          onPress={applyRenameSub}
          loading={renaming}
          style={{ marginTop: spacing.md }}
        />
      </Dialogo>

      {/* A qué se aplica "Cómo se anota": las dos opciones, con lo que pasa
          en cada una dicho al lado, que es lo que hace falta para elegir. */}
      <Sheet
        visible={alcanceAbierto}
        onClose={() => setAlcanceAbierto(false)}
        titulo="¿A qué se aplica?"
      >
        <View style={styles.medidas}>
          {[
            {
              soloEste: false,
              icono: 'albums-outline' as const,
              titulo: frase`Todo el grupo «${subgroup}»`,
              detalle: frase`Predeterminado. Cambiarla aquí la cambia en ${cuantosEnGrupoTexto} y en los que añadas después.`,
            },
            {
              soloEste: true,
              icono: 'document-outline' as const,
              titulo: t('Solo este ejercicio'),
              detalle: t('Se queda con la suya aunque cambies la del grupo. Solo cambia si la tocas aquí.'),
            },
          ].map((o) => {
            const activa = medidaPropia === o.soloEste;
            return (
              <Pressable
                key={String(o.soloEste)}
                onPress={() => elegirAlcance(o.soloEste)}
                style={[styles.medida, activa && styles.medidaActiva]}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
              >
                <Ionicons name={o.icono} size={18} color={activa ? colors.primaryBright : colors.textMuted} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.medidaTexto, activa && styles.medidaTextoActiva]}>{o.titulo}</Text>
                  <Text style={styles.medidaEjemplo}>{o.detalle}</Text>
                </View>
                {activa ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </ScreenContainer>
  );
}

/** Lo que verá el alumno en cada serie, según cómo se anote. */
const EJEMPLO_DE_MEDIDA: Record<ExerciseMeasure, string> = {
  reps: '8 reps',
  seconds: '20 s de aguante',
  combo: '5 reps + 12 s',
  repsDual: '8 izq. · 8 der.',
  secondsDual: '20 s izq. · 20 s der.',
};

const styles = StyleSheet.create({
  vista: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  // 16:9, la forma de un vídeo.
  vistaMedia: {
    width: 128,
    height: 72,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  vistaImagen: { ...StyleSheet.absoluteFill },
  vistaPlay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vistaSinVideo: { ...typography.small, color: colors.textFaint, fontSize: 10 },
  vistaFilo: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  vistaTexto: { flex: 1, minWidth: 0, gap: 3 },
  vistaNombre: { ...typography.h3, color: colors.text },
  vistaNombreVacio: { color: colors.textFaint },
  vistaMetaFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vistaPunto: { width: 8, height: 8, borderRadius: 4 },
  vistaMeta: { ...typography.small, color: colors.textMuted, flexShrink: 1 },
  vistaMusculos: { ...typography.small, color: colors.textFaint, fontSize: 12 },
  seccion: { marginBottom: spacing.md },
  seccionCab: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  seccionTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  medidas: { gap: spacing.xs },
  medida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  medidaActiva: { borderColor: colors.hairline, backgroundColor: colors.primaryMuted },
  medidaTexto: { ...typography.body, color: colors.text },
  medidaTextoActiva: { fontFamily: fonts.semiBold, color: colors.primaryBright },
  medidaEjemplo: { ...typography.small, color: colors.textFaint, fontSize: 12 },
  videoEstado: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  videoEstadoTexto: { ...typography.small, color: colors.textMuted, flex: 1 },
  videoQuitar: { ...typography.small, color: colors.textFaint },
  borrarEnlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    paddingVertical: spacing.sm,
  },
  borrarEnlaceTexto: { ...typography.small, color: colors.textFaint },
  label: fieldLabel,
  catEdit: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  alcanceBoton: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  addCatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  addCatInput: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  addCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  addCatText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  textarea: { height: 100, textAlignVertical: 'top' },
  measureHint: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
});
