import React, { useCallback, useMemo, useState } from 'react';
import { frase } from '../../../lib/idioma';
import { useFocusEffect, useRouter } from 'expo-router';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { FadeIn } from '../../../components/FadeIn';
import { Grid } from '../../../components/Grid';
import { DragList } from '../../../components/DragList';
import { moveItem } from '../../../lib/useDragReorder';
import { TarjetaDeEjercicio } from '../../../components/TarjetaDeEjercicio';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ListSkeleton } from '../../../components/Skeleton';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../lib/auth-context';
import { isAdmin } from '../../../lib/subscription';
import {
  createExercise,
  deleteExercise,
  getExercisesForTrainer,
  updateExercise,
} from '../../../lib/firestore/exercises';
import { getTemplateExercises } from '../../../lib/firestore/templateExercises';
import { updateUserProfile } from '../../../lib/firestore/users';
import { type ExportedExercise } from '../../../lib/exerciseTemplateIO';
import {
  compartirBiblioteca,
  leerBiblioteca,
  queLeFaltan,
  type BibliotecaCompartida,
} from '../../../lib/firestore/bibliotecas';
import { grupoRenombrado, medidaDelGrupo } from '../../../lib/medidaDeGrupo';
import { getCached, setCached } from '../../../lib/screenCache';
import { STARTER_LIBRARY } from '../../../lib/starterLibrary';
import { colorDeCategoria } from '../../../lib/colorDeCategoria';
import { showToast } from '../../../components/Toast';
import { Dialogo } from '../../../components/Dialogo';
import { QuickSheet } from '../../../components/QuickSheet';
import { Chip, ChipRow } from '../../../components/Chip';
import { fonts, colors, radius, spacing, tabularNums, typography } from '../../../lib/theme';
import {
  CATEGORY_PALETTE,
  MEASURE_SHORT,
  MUSCLE_GROUPS,
  type Exercise,
  type TemplateExercise,
} from '../../../lib/types';

export default function ExercisesScreen() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `exercises-${profile?.uid ?? ''}`;
  const [exercises, setExercises] = useState<Exercise[]>(
    () => getCached<Exercise[]>(cacheKey) ?? []
  );
  const [loading, setLoading] = useState(() => getCached(cacheKey) === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState<string | null>(null);
  // Solo los que aún no tienen vídeo: para completar la biblioteca de una vez.
  const [soloSinVideo, setSoloSinVideo] = useState(false);
  const [importing, setImporting] = useState(false);
  const [template, setTemplate] = useState<TemplateExercise[]>([]);
  // Import/export de plantillas entre entrenadores.
  const [pendingImport, setPendingImport] = useState<ExportedExercise[] | null>(null);
  const [replacing, setReplacing] = useState(false);
  // Compartir e importar con un código.
  const [compartiendo, setCompartiendo] = useState(false);
  const [codigoMostrado, setCodigoMostrado] = useState<string | null>(null);
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [codigoEscrito, setCodigoEscrito] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [encontrada, setEncontrada] = useState<BibliotecaCompartida | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);
  // Gestión de categorías del entrenador (Tren superior, Empuje…).
  const [editCats, setEditCats] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  // Color de categoría: un único diálogo por categoría (paleta + personalizado),
  // en vez de una parrilla de muestras repetida en cada fila.
  const [colorTarget, setColorTarget] = useState<string | null>(null);
  // Confirmación previa de "Actualizar a pack UDECA": es destructivo (sustituye
  // toda la biblioteca), así que nunca se ejecuta a la primera pulsación.
  const [confirmPack, setConfirmPack] = useState(false);
  // Renombrar subgrupos dentro de la categoría filtrada.
  const [subEdit, setSubEdit] = useState(false);
  const [renameSub, setRenameSub] = useState<{ group: string; from: string } | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Categorías propias del coach (las suyas si las tiene, si no las de por defecto).
  const myCategories = useMemo(
    () =>
      profile?.exerciseCategories && profile.exerciseCategories.length > 0
        ? profile.exerciseCategories
        : [...MUSCLE_GROUPS],
    [profile?.exerciseCategories]
  );

  // Color asignado a cada categoría. Si el coach no ha elegido ninguno, se
  // reparte la paleta de forma estable por posición, para que dos categorías
  // nunca salgan del mismo color por accidente.
  const categoryColor = (group: string) =>
    colorDeCategoria(profile?.categoryColors, myCategories, group);

  const setCategoryColor = async (group: string, color: string) => {
    if (!profile) return;
    setColorTarget(null);
    try {
      await updateUserProfile(profile.uid, {
        categoryColors: { ...(profile.categoryColors ?? {}), [group]: color },
      });
      await refreshProfile();
    } catch {
      showToast('No se pudo guardar el color');
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
    if (myCategories.some((g) => g.toLowerCase() === c.toLowerCase())) {
      showToast('Esa categoría ya existe');
      return;
    }
    setNewCat('');
    saveCategories([...myCategories, c]);
  };
  const removeCategory = (group: string) => {
    const list = myCategories.filter((g) => g !== group);
    if (list.length === 0) {
      showToast('Deja al menos una categoría');
      return;
    }
    if (muscleFilter === group) setMuscleFilter(null);
    saveCategories(list);
  };

  // Renombrar un subgrupo. El nombre vive en dos sitios: la lista del perfil y
  // el campo `subgroup` de cada ejercicio que lo usa; si solo se cambiara la
  // lista, esos ejercicios quedarían huérfanos bajo el nombre antiguo.
  const applyRenameSub = async () => {
    if (!profile || !renameSub) return;
    const { group, from } = renameSub;
    const to = renameText.trim();
    if (!to) return;
    if (to === from) {
      setRenameSub(null);
      return;
    }
    const list = profile.categorySubgroups?.[group] ?? [];
    if (list.some((s) => s.toLowerCase() === to.toLowerCase())) {
      showToast('Ya existe un subgrupo con ese nombre');
      return;
    }
    setRenaming(true);
    try {
      const affected = exercises.filter((e) => e.muscleGroup === group && e.subgroup === from);
      await Promise.all(affected.map((e) => updateExercise(e.id, { subgroup: to })));
      const next = list.includes(from) ? list.map((s) => (s === from ? to : s)) : [...list, to];
      await updateUserProfile(profile.uid, {
        categorySubgroups: { ...(profile.categorySubgroups ?? {}), [group]: next },
        // La medida del grupo viaja con el nombre (ver lib/medidaDeGrupo.ts).
        subgroupMeasures: grupoRenombrado(profile.subgroupMeasures, group, from, to),
      });
      await refreshProfile();
      const updated = exercises.map((e) =>
        e.muscleGroup === group && e.subgroup === from ? { ...e, subgroup: to } : e
      );
      setExercises(updated);
      setCached(cacheKey, updated);
      if (subFilter === from) setSubFilter(to);
      setRenameSub(null);
      showToast('Subgrupo renombrado');
    } catch {
      showToast('No se pudo renombrar el subgrupo');
    } finally {
      setRenaming(false);
    }
  };

  // Pack a precargar: la plantilla oficial de UDECA (editada por el CEO) si
  // existe; si no, el pack estático de calistenia. Cada ejercicio arrastra sus
  // músculos para el cuerpo anatómico.
  const packItems = useMemo(
    () =>
      template.length > 0
        ? template.map((t) => ({
            name: t.name,
            muscleGroup: t.muscleGroup,
            measure: t.measure ?? ('reps' as const),
            description: t.description ?? '',
            // La plantilla nunca trae vídeo: el entrenador lo pone luego.
            videoUrl: undefined as string | undefined,
            muscles: t.muscles,
            muscleWeights: t.muscleWeights,
            subgroup: t.subgroup,
          }))
        : STARTER_LIBRARY.map((s) => ({
            name: s.name,
            muscleGroup: s.muscleGroup as string,
            measure: s.measure,
            description: s.description,
            videoUrl: undefined as string | undefined,
            muscles: undefined as import('../../../lib/muscles').MuscleId[] | undefined,
            muscleWeights: undefined as
              | Partial<Record<import('../../../lib/muscles').MuscleId, number>>
              | undefined,
            subgroup: undefined as string | undefined,
          })),
    [template]
  );

  const missingPack = useMemo(() => {
    const existing = new Set(exercises.map((e) => e.name.trim().toLowerCase()));
    return packItems.filter((p) => !existing.has(p.name.trim().toLowerCase()));
  }, [packItems, exercises]);

  // Importa el pack UDECA saltando los ejercicios que ya existen (por nombre).
  const handleImportPack = async () => {
    if (!profile) return;
    setImporting(true);
    try {
      if (missingPack.length === 0) {
        showToast('Ya tienes todos los ejercicios del pack');
        return;
      }
      await Promise.all(
        missingPack.map((s) =>
          createExercise({
            trainerId: profile.uid,
            name: s.name,
            muscleGroup: s.muscleGroup,
            measure: s.measure,
            description: s.description || undefined,
            videoUrl: s.videoUrl,
            muscles: s.muscles,
            muscleWeights: s.muscleWeights,
            subgroup: s.subgroup,
          })
        )
      );
      showToast(frase`${missingPack.length} ejercicios añadidos a tu biblioteca`);
      await load();
    } finally {
      setImporting(false);
    }
  };

  // ACTUALIZAR pack (solo la cuenta admin de UDECA): deja la biblioteca
  // exactamente como el pack actual. Actualiza por nombre (conservando el id,
  // para que las rutinas que referencian el ejercicio no se rompan, y su
  // vídeo), crea los nuevos, BORRA los que ya no están en el pack y reemplaza
  // las categorías por las del pack, en su orden.
  const handleUpdatePackFull = async () => {
    if (!profile || packItems.length === 0) return;
    setConfirmPack(false);
    setImporting(true);
    try {
      const key = (n: string) => n.trim().toLowerCase();
      const byName = new Map(exercises.map((e) => [key(e.name), e]));
      const packNames = new Set(packItems.map((p) => key(p.name)));
      const ops: Promise<unknown>[] = [];
      for (const p of packItems) {
        const existing = byName.get(key(p.name));
        if (existing) {
          ops.push(
            updateExercise(existing.id, {
              muscleGroup: p.muscleGroup,
              measure: p.measure,
              description: p.description || undefined,
              muscles: p.muscles,
              muscleWeights: p.muscleWeights,
              subgroup: p.subgroup,
            })
          );
        } else {
          ops.push(
            createExercise({
              trainerId: profile.uid,
              name: p.name,
              muscleGroup: p.muscleGroup,
              measure: p.measure,
              description: p.description || undefined,
              videoUrl: undefined,
              muscles: p.muscles,
              muscleWeights: p.muscleWeights,
              subgroup: p.subgroup,
            })
          );
        }
      }
      for (const e of exercises) {
        if (!packNames.has(key(e.name))) ops.push(deleteExercise(e.id));
      }
      await Promise.all(ops);
      // Categorías del pack, en su orden de aparición.
      const cats: string[] = [];
      for (const p of packItems) {
        if (!cats.includes(p.muscleGroup)) cats.push(p.muscleGroup);
      }
      if (cats.length > 0) {
        // Las categorías del pack conservan el color que ya tuvieran; a las
        // nuevas se les asigna uno de la paleta para que ninguna quede sin él.
        const colors_: Record<string, string> = {};
        cats.forEach((c, i) => {
          colors_[c] =
            profile.categoryColors?.[c] ?? CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
        });
        // Subgrupos que trae el pack, por categoría y en su orden.
        const subs: Record<string, string[]> = {};
        for (const p of packItems) {
          if (!p.subgroup) continue;
          const list = subs[p.muscleGroup] ?? [];
          if (!list.includes(p.subgroup)) subs[p.muscleGroup] = [...list, p.subgroup];
        }
        await updateUserProfile(profile.uid, {
          exerciseCategories: cats,
          categoryColors: colors_,
          categorySubgroups: { ...(profile.categorySubgroups ?? {}), ...subs },
        });
        await refreshProfile();
      }
      showToast('Biblioteca sincronizada con el pack UDECA');
      await load();
    } catch {
      showToast('No se pudo actualizar el pack');
    } finally {
      setImporting(false);
    }
  };

  /*
   * COMPARTIR E IMPORTAR CON UN CÓDIGO (lib/firestore/bibliotecas.ts).
   *
   * Sustituye al archivo y al texto para pegar: un código de seis letras se
   * dicta o se manda por mensaje, y al otro lado basta con escribirlo.
   */
  const handleCompartir = async () => {
    if (!profile) return;
    if (exercises.length === 0) {
      showToast('No tienes ejercicios que compartir');
      return;
    }
    setCompartiendo(true);
    try {
      const codigo = await compartirBiblioteca(
        profile.uid,
        profile.name ?? '',
        exercises,
        profile.codigoBiblioteca
      );
      if (codigo !== profile.codigoBiblioteca) {
        await updateUserProfile(profile.uid, { codigoBiblioteca: codigo });
        await refreshProfile();
      }
      setCodigoMostrado(codigo);
    } catch {
      showToast('No se pudo compartir');
    } finally {
      setCompartiendo(false);
    }
  };

  const handleBuscarCodigo = async () => {
    setBuscando(true);
    setEncontrada(null);
    try {
      const b = await leerBiblioteca(codigoEscrito);
      if (!b) {
        showToast('No hay ninguna biblioteca con ese código');
        return;
      }
      setEncontrada(b);
    } catch {
      showToast('No se pudo buscar el código');
    } finally {
      setBuscando(false);
    }
  };

  /** Añade solo los que no tiene: lo seguro, y casi siempre lo que se quiere. */
  const handleAnadirNuevos = async () => {
    if (!profile || !encontrada) return;
    const nuevos = queLeFaltan(exercises, encontrada.ejercicios);
    if (nuevos.length === 0) {
      showToast('Ya tienes todos esos ejercicios');
      return;
    }
    setAnadiendo(true);
    try {
      await Promise.all(
        nuevos.map((e) =>
          createExercise({
            trainerId: profile.uid,
            name: e.name,
            muscleGroup: e.muscleGroup,
            measure: e.measure,
            description: e.description,
            videoUrl: e.videoUrl,
            muscles: e.muscles,
            muscleWeights: e.muscleWeights,
            subgroup: e.subgroup,
            load: e.load,
            band: e.band,
          })
        )
      );
      cerrarImportar();
      await load();
      showToast(frase`${nuevos.length} ejercicios añadidos a tu biblioteca`);
    } catch {
      showToast('No se pudieron añadir');
    } finally {
      setAnadiendo(false);
    }
  };

  const cerrarImportar = () => {
    setImportarAbierto(false);
    setCodigoEscrito('');
    setEncontrada(null);
  };

  // Sustituye TODA la biblioteca por la plantilla importada.
  const confirmReplace = async () => {
    if (!profile || !pendingImport) return;
    setReplacing(true);
    try {
      await Promise.all(exercises.map((e) => deleteExercise(e.id)));
      await Promise.all(
        pendingImport.map((e) =>
          createExercise({
            trainerId: profile.uid,
            name: e.name,
            muscleGroup: e.muscleGroup,
            measure: e.measure,
            description: e.description,
            videoUrl: e.videoUrl,
            muscles: e.muscles,
            muscleWeights: e.muscleWeights,
            subgroup: e.subgroup,
            load: e.load,
            band: e.band,
          })
        )
      );
      setPendingImport(null);
      await load();
      showToast('Plantilla importada');
    } catch {
      showToast('No se pudo importar la plantilla');
    } finally {
      setReplacing(false);
    }
  };

  const load = useCallback(async () => {
    if (!profile) return;
    const data = await getExercisesForTrainer(profile.uid);
    setExercises(data);
    setCached(cacheKey, data);
    // La plantilla oficial (para precargar). Silenciosa si falla.
    getTemplateExercises()
      .then(setTemplate)
      .catch(() => {});
    setLoading(false);
    setRefreshing(false);
  }, [profile, cacheKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(
    () =>
      exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase().trim()) &&
          (!muscleFilter || e.muscleGroup === muscleFilter) &&
          (!subFilter || (e.subgroup ?? '') === subFilter) &&
          (!soloSinVideo || !e.videoUrl)
      ),
    [exercises, search, muscleFilter, subFilter, soloSinVideo]
  );

  // Subgrupos disponibles en la categoría filtrada: los definidos por el coach
  // más los que ya use algún ejercicio, para no esconder ninguno.
  const subOptions = useMemo(() => {
    if (!muscleFilter) return [];
    const base = profile?.categorySubgroups?.[muscleFilter] ?? [];
    const used = exercises
      .filter((e) => e.muscleGroup === muscleFilter && e.subgroup)
      .map((e) => e.subgroup as string);
    return Array.from(new Set([...base, ...used]));
  }, [muscleFilter, profile?.categorySubgroups, exercises]);

  // Filtros: las categorías del coach (o las de por defecto) más cualquier otra
  // que ya use algún ejercicio, para no ocultar ninguno.
  const filterCategories = useMemo(() => {
    const base =
      profile?.exerciseCategories && profile.exerciseCategories.length > 0
        ? profile.exerciseCategories
        : [...MUSCLE_GROUPS];
    const extra = exercises.map((e) => e.muscleGroup).filter((g) => g && !base.includes(g));
    return [...base, ...Array.from(new Set(extra))];
  }, [profile?.exerciseCategories, exercises]);

  // Cuántos hay en cada categoría (para las pastillas) y cuántos con vídeo.
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of exercises) m.set(e.muscleGroup, (m.get(e.muscleGroup) ?? 0) + 1);
    return m;
  }, [exercises]);
  const sinVideo = useMemo(() => exercises.filter((e) => !e.videoUrl).length, [exercises]);

  /*
   * La lista, en bloques.
   *
   * Con "Todos", por CATEGORÍA y en el orden del coach: cien ejercicios
   * seguidos no se leen, y cada bloque con su color es lo que se busca al
   * planificar ("un tirón más"). Con una categoría elegida, por SUBGRUPO, que
   * es el siguiente nivel; los que no tienen van al final.
   */
  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const e of filtered) {
      const k = muscleFilter ? (e.subgroup ?? '') : e.muscleGroup;
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    const entradas = [...map.entries()];
    if (!muscleFilter) {
      return entradas.sort((a, b) => filterCategories.indexOf(a[0]) - filterCategories.indexOf(b[0]));
    }
    return entradas.sort((a, b) =>
      a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])
    );
  }, [filtered, muscleFilter, filterCategories]);

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Biblioteca" subtitle="Cargando ejercicios..." />
        <ListSkeleton rows={7} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <ScreenHeader
        title="Biblioteca"
        subtitle={`${exercises.length} ${exercises.length === 1 ? 'ejercicio' : 'ejercicios'}`}
        actions={
          <View style={styles.accionesCab}>
            <Button title="+ Nuevo" onPress={() => router.push('/(trainer)/exercises/new')} />
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} style={styles.masBtn}>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        }
      />

      {/* Todo lo que se toca una vez cada muchos meses —el pack, importar,
          exportar, renombrar categorías, la plantilla del CEO— vive aquí
          detrás. Antes ocupaba cinco filas por encima de los ejercicios, que
          es lo que sí se mira todos los días. */}
      <QuickSheet
        visible={menuOpen}
        titulo="Biblioteca"
        subtitulo={`${exercises.length} ${exercises.length === 1 ? 'ejercicio' : 'ejercicios'}`}
        onClose={() => setMenuOpen(false)}
        acciones={[
          ...(missingPack.length > 0
            ? [
                {
                  icono: 'cube-outline' as const,
                  texto: frase`Añadir el pack UDECA (${missingPack.length} ejercicios)`,
                  onPress: () => {
                    setMenuOpen(false);
                    handleImportPack();
                  },
                },
              ]
            : []),
          {
            icono: 'pricetags-outline' as const,
            texto: editCats ? 'Terminar de editar categorías' : 'Editar categorías',
            onPress: () => {
              setMenuOpen(false);
              setEditCats((v) => !v);
            },
          },
          {
            icono: 'share-social-outline' as const,
            texto: compartiendo ? 'Compartiendo…' : 'Compartir mi biblioteca',
            onPress: () => {
              setMenuOpen(false);
              handleCompartir();
            },
          },
          {
            icono: 'download-outline' as const,
            texto: 'Importar con un código',
            onPress: () => {
              setMenuOpen(false);
              setImportarAbierto(true);
            },
          },
          ...(isAdmin(profile)
            ? [
                {
                  icono: 'shield-checkmark' as const,
                  texto: 'Plantilla UDECA (CEO)',
                  onPress: () => {
                    setMenuOpen(false);
                    router.push('/(trainer)/exercises/template');
                  },
                },
                ...(packItems.length > 0
                  ? [
                      {
                        icono: 'sync-outline' as const,
                        texto: 'Actualizar a pack UDECA',
                        peligro: true,
                        onPress: () => {
                          setMenuOpen(false);
                          setConfirmPack(true);
                        },
                      },
                    ]
                  : []),
              ]
            : []),
        ]}
      />

      <TextField placeholder="Buscar ejercicio..." value={search} onChangeText={setSearch} />

      {editCats ? (
        <View style={styles.catHeader}>
          <Text style={styles.catLabel}>Categorías</Text>
          <Pressable onPress={() => setEditCats(false)} hitSlop={8}>
            <Text style={styles.catEdit}>Listo</Text>
          </Pressable>
        </View>
      ) : null}

      {editCats ? (
        <>
          {/* En edición se listan en vertical, no como fichas sueltas: el gesto
              de reordenar es el mismo de toda la app (mantener pulsado y
              mover arriba o abajo), y en horizontal ese gesto no existe. */}
          <DragList
            items={myCategories}
            keyOf={(g) => g}
            onReorder={(from, to) => saveCategories(moveItem(myCategories, from, to))}
            gap={spacing.xs}
            handleOnly
            renderItem={(group, i, arrastrando, asa) => (
              <View style={[styles.catRow, arrastrando && styles.catRowDragging]}>
                <View {...asa} style={styles.dragHandle}>
                  <Ionicons name="reorder-three" size={18} color={colors.textFaint} />
                </View>
                <Text style={styles.catRowText}>{group}</Text>
                <Pressable onPress={() => removeCategory(group)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.danger} />
                </Pressable>
              </View>
            )}
          />
          <Text style={styles.catColorHint}>Toca un color para cambiarlo</Text>
          <View style={styles.catColorList}>
            {myCategories.map((group) => (
              <Pressable
                key={group}
                onPress={() => setColorTarget(group)}
                style={styles.catColorRow}
              >
                <View style={[styles.catDotBig, { backgroundColor: categoryColor(group) }]} />
                <Text style={styles.catColorName} numberOfLines={1}>
                  {group}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
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
        </>
      ) : (
        <ChipRow scroll>
          <Chip
            texto="Todos"
            cuenta={exercises.length}
            activo={muscleFilter === null}
            onPress={() => {
              setMuscleFilter(null);
              setSubFilter(null);
              setSubEdit(false);
            }}
          />
          {/* Va junto a "Todos" y no al final: al final se queda fuera de la
              pantalla, y es el filtro que dice qué falta por hacer. */}
          {sinVideo > 0 || soloSinVideo ? (
            <Chip
              texto="Sin vídeo"
              icono="videocam-off-outline"
              cuenta={sinVideo}
              activo={soloSinVideo}
              onPress={() => setSoloSinVideo((v) => !v)}
            />
          ) : null}
          {filterCategories.map((group) => (
            <Chip
              key={group}
              texto={group}
              punto={categoryColor(group)}
              cuenta={porCategoria.get(group) ?? 0}
              activo={muscleFilter === group}
              onPress={() => {
                setMuscleFilter(group);
                setSubFilter(null);
                setSubEdit(false);
              }}
            />
          ))}
        </ChipRow>
      )}

      {muscleFilter && subOptions.length > 0 ? (
        <ChipRow scroll>
          {subEdit ? null : (
            <Chip
              texto="Toda la categoría"
              activo={subFilter === null}
              onPress={() => setSubFilter(null)}
            />
          )}
          {subOptions.map((sg) =>
            subEdit ? (
              // En modo edición el chip abre el renombrado en vez de filtrar.
              <Chip
                key={sg}
                texto={sg}
                icono="pencil"
                suave
                onPress={() => {
                  setRenameSub({ group: muscleFilter, from: sg });
                  setRenameText(sg);
                }}
              />
            ) : (
              <Chip
                key={sg}
                texto={sg}
                activo={subFilter === sg}
                onPress={() => setSubFilter(sg)}
                />
            )
          )}
          <Chip
            texto={subEdit ? 'Listo' : 'Renombrar'}
            icono={subEdit ? 'checkmark' : 'pencil'}
            suave
            onPress={() => setSubEdit((v) => !v)}
          />
        </ChipRow>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon="barbell-outline"
          title="No hay ejercicios"
          subtitle={
            exercises.length === 0 && missingPack.length > 0
              ? 'Empieza con el pack UDECA o crea el primero con «+ Nuevo».'
              : 'Prueba con otra búsqueda o categoría.'
          }
          // Con la biblioteca vacía el pack es LA acción a hacer, así que aquí
          // sí se muestra en grande (en la cabecera va como pastilla pequeña).
          actionLabel={
            exercises.length === 0 && missingPack.length > 0
              ? `Importar pack UDECA (${missingPack.length})`
              : undefined
          }
          onAction={
            exercises.length === 0 && missingPack.length > 0 ? handleImportPack : undefined
          }
        />
      ) : (
        grouped.map(([clave, list]) => {
          // Sin filtro, cada bloque es una categoría (con su color); con
          // filtro, un subgrupo de la elegida.
          const color = muscleFilter ? null : categoryColor(clave);
          const medida = muscleFilter
            ? medidaDelGrupo(profile?.subgroupMeasures, muscleFilter, clave)
            : undefined;
          return (
            <View key={clave || '__none__'} style={styles.bloque}>
              {/* Con un solo subgrupo, la cabecera sobra: ya lo dice la pastilla.
                  Las categorías se rotulan siempre: su color es la guía. */}
              {!muscleFilter || grouped.length > 1 ? (
                <View style={styles.bloqueCab}>
                  {color ? <View style={[styles.bloquePunto, { backgroundColor: color }]} /> : null}
                  <Text style={styles.bloqueTitulo} numberOfLines={1}>
                    {clave || 'Sin subgrupo'}
                  </Text>
                  {/* La medida del grupo solo se puede nombrar con la categoría
                      delante: "Aguantes" existe en varias y cada una decide la
                      suya. Sin filtro de categoría no se dice nada. */}
                  {medida ? (
                    <Text style={styles.bloqueMedida}>{MEASURE_SHORT[medida].toLowerCase()}</Text>
                  ) : null}
                  <View style={styles.bloqueLinea} />
                  <Text style={styles.bloqueCuenta}>{list.length}</Text>
                </View>
              ) : null}
              <Grid>
                {list.map((exercise, index) => (
                  <FadeIn key={exercise.id} delay={Math.min(index * 30, 240)}>
                    <TarjetaDeEjercicio
                      ejercicio={exercise}
                      color={categoryColor(exercise.muscleGroup)}
                      // Con una categoría elegida, el subgrupo ya es la cabecera.
                      conSubgrupo={!muscleFilter}
                      onPress={() => router.push(`/(trainer)/exercises/${exercise.id}`)}
                    />
                  </FadeIn>
                ))}
              </Grid>
            </View>
          );
        })
      )}

      {/* Confirmación previa de "Actualizar a pack UDECA" (destructivo) */}
      <Dialogo
        visible={confirmPack}
        onClose={() => setConfirmPack(false)}
        icono="warning-outline"
        titulo="¿Actualizar a pack UDECA?"
        texto={`Tu biblioteca quedará EXACTAMENTE igual que el pack UDECA actual (${packItems.length} ejercicios): se sustituyen los datos de los que ya tienes, se añaden los que falten y se BORRAN tus ${exercises.length} ${
          exercises.length === 1 ? 'ejercicio' : 'ejercicios'
        } que no estén en el pack. También se reemplazan tus categorías. No se puede deshacer.`}
        accion="Sí, sustituirlo todo"
        onAccion={handleUpdatePackFull}
        cargando={importing}
      />

      {/* Color de una categoría: solo la paleta. Escribir un código de color
          a mano era una puerta a colores que no casan con la app. */}
      <Dialogo
        visible={!!colorTarget}
        onClose={() => setColorTarget(null)}
        titulo={colorTarget ?? ''}
        texto="Elige su color."
        cancelar="Cerrar"
      >
        <View style={{ height: spacing.md }} />
            <View style={styles.paletteGrid}>
              {CATEGORY_PALETTE.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => colorTarget && setCategoryColor(colorTarget, c)}
                  style={[
                    styles.paletteDot,
                    { backgroundColor: c },
                    colorTarget && categoryColor(colorTarget).toLowerCase() === c.toLowerCase()
                      ? styles.paletteDotOn
                      : null,
                  ]}
                />
              ))}
            </View>
      </Dialogo>

      {/* Renombrar un subgrupo (arrastra a sus ejercicios) */}
      <Dialogo
        visible={!!renameSub}
        onClose={() => setRenameSub(null)}
        titulo="Renombrar subgrupo"
        texto={frase`Se actualizarán también los ejercicios que ya están en «${renameSub?.from ?? ''}».`}
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

      {/* El código para compartir la biblioteca, grande y para copiar. */}
      <Dialogo
        visible={!!codigoMostrado}
        onClose={() => setCodigoMostrado(null)}
        icono="share-social-outline"
        tono="normal"
        titulo="Tu código de biblioteca"
        texto={frase`Quien lo escriba en «Importar con un código» recibe tus ${exercises.length} ejercicios. Si cambias tu biblioteca, vuelve a compartir: el código no cambia.`}
        accion="Enviar el código"
        onAccion={() => {
          Share.share({
            message: frase`Mi biblioteca de ejercicios en UDECA: ${codigoMostrado ?? ''}. Ábrela en Ejercicios › … › Importar con un código.`,
          }).catch(() => {});
        }}
        cancelar="Cerrar"
      >
        <Text style={styles.codigoGrande} selectable>
          {codigoMostrado}
        </Text>
      </Dialogo>

      {/* Importar con un código: se escribe, se ve qué trae y se elige. */}
      <Dialogo
        visible={importarAbierto}
        onClose={cerrarImportar}
        icono="download-outline"
        tono="normal"
        titulo="Importar con un código"
        texto="Escribe el código que te ha pasado otro entrenador."
        cancelar="Cerrar"
      >
        <View style={styles.codigoFila}>
          <TextInput
            value={codigoEscrito}
            onChangeText={(v) => {
              setCodigoEscrito(v);
              setEncontrada(null);
            }}
            placeholder="ABC123"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            style={[styles.addCatInput, styles.codigoInput]}
            onSubmitEditing={handleBuscarCodigo}
            returnKeyType="search"
          />
        </View>
        {/* Debajo y a lo ancho: al lado del campo no cabía en un móvil. */}
        {encontrada ? null : (
          <Button
            title="Buscar"
            variant="secondary"
            onPress={handleBuscarCodigo}
            loading={buscando}
            disabled={codigoEscrito.trim().length < 6}
            style={{ marginTop: spacing.sm }}
          />
        )}
        {encontrada ? (
          <View style={styles.encontrada}>
            <Text style={styles.encontradaTitulo}>
              {encontrada.nombre
                ? frase`Biblioteca de ${encontrada.nombre}`
                : 'Biblioteca encontrada'}
            </Text>
            <Text style={styles.encontradaTexto}>
              {frase`${encontrada.ejercicios.length} ejercicios · ${queLeFaltan(exercises, encontrada.ejercicios).length} que no tienes`}
            </Text>
            <Button
              title={
                queLeFaltan(exercises, encontrada.ejercicios).length === 0
                  ? 'Ya los tienes todos'
                  : frase`Añadir los ${queLeFaltan(exercises, encontrada.ejercicios).length} que no tengo`
              }
              onPress={handleAnadirNuevos}
              loading={anadiendo}
              disabled={queLeFaltan(exercises, encontrada.ejercicios).length === 0}
              style={{ marginTop: spacing.md }}
            />
            <Pressable
              onPress={() => {
                const lista = encontrada.ejercicios;
                cerrarImportar();
                setPendingImport(lista);
              }}
              hitSlop={8}
              style={styles.sustituirEnlace}
            >
              <Text style={styles.sustituirTexto}>O sustituir toda mi biblioteca por esta</Text>
            </Pressable>
          </View>
        ) : null}
      </Dialogo>

      {/* Aviso de confirmación al importar (sustituye TODA la biblioteca) */}
      <Dialogo
        visible={!!pendingImport}
        onClose={() => setPendingImport(null)}
        icono="warning-outline"
        titulo="¿Sustituir tu plantilla actual?"
        texto={`Esto borrará tus ${exercises.length} ${
          exercises.length === 1 ? 'ejercicio' : 'ejercicios'
        } y los reemplazará por los ${pendingImport?.length ?? 0} de la plantilla importada. No se puede deshacer.`}
        accion={frase`Sustituir por ${pendingImport?.length ?? 0} ejercicios`}
        onAccion={confirmReplace}
        cargando={replacing}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  accionesCab: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  masBtn: { padding: spacing.xs },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  catLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  catEdit: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  catColorHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  catColorList: { gap: spacing.xs, marginBottom: spacing.sm },
  catColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceAlt,
  },
  catDotBig: { width: 22, height: 22, borderRadius: 11 },
  catColorName: { ...typography.small, color: colors.text, flex: 1 },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  paletteDot: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'transparent' },
  paletteDotOn: { borderColor: colors.text },
  bloque: { marginBottom: spacing.sm },
  bloqueCab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  bloquePunto: { width: 9, height: 9, borderRadius: 5 },
  bloqueTitulo: {
    ...typography.label,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
    flexShrink: 1,
  },
  bloqueMedida: { ...typography.small, color: colors.primaryBright },
  bloqueLinea: { flex: 1, height: 1, backgroundColor: colors.border },
  bloqueCuenta: { ...typography.small, color: colors.textFaint, ...tabularNums },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  catRowDragging: { borderColor: colors.hairline },
  dragHandle: { padding: spacing.xs },
  catRowText: { ...typography.body, color: colors.text, flex: 1 },
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
  codigoGrande: {
    ...typography.h1,
    color: colors.primaryBright,
    textAlign: 'center',
    letterSpacing: 6,
    marginTop: spacing.md,
    ...tabularNums,
  },
  codigoFila: { marginTop: spacing.md },
  codigoInput: { flex: 0, letterSpacing: 3, fontFamily: fonts.semiBold, textAlign: 'center' },
  encontrada: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  encontradaTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  encontradaTexto: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  sustituirEnlace: { alignSelf: 'center', marginTop: spacing.md },
  sustituirTexto: { ...typography.small, color: colors.textMuted, textDecorationLine: 'underline' },
});
