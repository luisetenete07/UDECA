import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { FadeIn } from '../../../components/FadeIn';
import { Grid } from '../../../components/Grid';
import { DragList } from '../../../components/DragList';
import { moveItem } from '../../../lib/useDragReorder';
import { CardButton } from '../../../components/CardButton';
import { Card } from '../../../components/Card';
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
import {
  buildExerciseTemplate,
  parseExerciseTemplate,
  type ExportedExercise,
} from '../../../lib/exerciseTemplateIO';
import { grupoRenombrado, medidaDelGrupo } from '../../../lib/medidaDeGrupo';
import { getCached, setCached } from '../../../lib/screenCache';
import { STARTER_LIBRARY } from '../../../lib/starterLibrary';
import { showToast } from '../../../components/Toast';
import { Dialogo } from '../../../components/Dialogo';
import { QuickSheet } from '../../../components/QuickSheet';
import { Chip, ChipRow } from '../../../components/Chip';
import { fonts, colors, radius, spacing, typography } from '../../../lib/theme';
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
  const [importing, setImporting] = useState(false);
  const [template, setTemplate] = useState<TemplateExercise[]>([]);
  // Import/export de plantillas entre entrenadores.
  const [pendingImport, setPendingImport] = useState<ExportedExercise[] | null>(null);
  const [replacing, setReplacing] = useState(false);
  // Importar por pegado de texto (móvil, donde no hay selector de archivos).
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
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
  const [customColor, setCustomColor] = useState('');
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
    profile?.categoryColors?.[group] ??
    CATEGORY_PALETTE[Math.max(0, myCategories.indexOf(group)) % CATEGORY_PALETTE.length];

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

  // Color escrito a mano (#RRGGBB). Se valida antes de guardar para no dejar
  // una categoría con un color que la app no sepa pintar.
  const applyCustomColor = () => {
    const hex = normalizeHex(customColor);
    if (!colorTarget) return;
    if (!hex) {
      showToast('Escribe un color tipo #FF9900');
      return;
    }
    setCategoryColor(colorTarget, hex);
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
      showToast(`${missingPack.length} ejercicios añadidos a tu biblioteca`);
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

  // Exporta la biblioteca actual como archivo JSON (web) o texto (nativo) para
  // pasársela a otro entrenador.
  const handleExport = async () => {
    if (exercises.length === 0) {
      showToast('No tienes ejercicios que exportar');
      return;
    }
    const json = buildExerciseTemplate(exercises);
    const filename = `plantilla-ejercicios-udeca-${new Date().toISOString().slice(0, 10)}.json`;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Plantilla exportada');
    } else {
      try {
        await Share.share({ message: json });
      } catch {
        showToast('No se pudo exportar');
      }
    }
  };

  // Elige un archivo .json en la web y lo lee como texto.
  const pickJsonFile = (): Promise<string | null> =>
    new Promise((resolve) => {
      if (typeof document === 'undefined') return resolve(null);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };
      input.click();
    });

  const handleImportTemplate = async () => {
    // Móvil: sin selector de archivos, se pega el texto de la plantilla.
    if (Platform.OS !== 'web') {
      setPasteText('');
      setPasteOpen(true);
      return;
    }
    const text = await pickJsonFile();
    if (!text) return;
    const list = parseExerciseTemplate(text);
    if (!list) {
      showToast('El archivo no es una plantilla de ejercicios válida');
      return;
    }
    setPendingImport(list); // abre el aviso de confirmación
  };

  // Confirma el texto pegado (móvil): valida y abre el aviso de sustitución.
  const handlePasteImport = () => {
    const list = parseExerciseTemplate(pasteText);
    if (!list) {
      showToast('El texto no es una plantilla de ejercicios válida');
      return;
    }
    setPasteOpen(false);
    setPendingImport(list);
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
          (!subFilter || (e.subgroup ?? '') === subFilter)
      ),
    [exercises, search, muscleFilter, subFilter]
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

  // Lista agrupada por subgrupo, para que cada bloque se lea aparte.
  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const e of filtered) {
      const k = e.subgroup ?? '';
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    // Los que no tienen subgrupo van al final, bajo "Sin subgrupo".
    return [...map.entries()].sort((a, b) =>
      a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])
    );
  }, [filtered]);

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
                  texto: `Añadir el pack UDECA (${missingPack.length} ejercicios)`,
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
            icono: 'download-outline' as const,
            texto: 'Exportar mi biblioteca',
            onPress: () => {
              setMenuOpen(false);
              handleExport();
            },
          },
          {
            icono: 'cloud-upload-outline' as const,
            texto: 'Importar una biblioteca',
            onPress: () => {
              setMenuOpen(false);
              handleImportTemplate();
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
                onPress={() => {
                  setColorTarget(group);
                  setCustomColor(categoryColor(group));
                }}
                style={styles.catColorRow}
              >
                <View style={[styles.catDotBig, { backgroundColor: categoryColor(group) }]} />
                <Text style={styles.catColorName} numberOfLines={1}>
                  {group}
                </Text>
                <Text style={styles.catColorHex}>{categoryColor(group).toUpperCase()}</Text>
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
            activo={muscleFilter === null}
            onPress={() => {
              setMuscleFilter(null);
              setSubFilter(null);
              setSubEdit(false);
            }}
          />
          {filterCategories.map((group) => (
            <Chip
              key={group}
              texto={group}
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
        grouped.map(([sg, list]) => (
          <View key={sg || '__none__'}>
            {/* Solo se rotula si hay más de un bloque: con uno solo, la
                cabecera sobra y añade ruido. */}
            {grouped.length > 1 ? (
              <View style={styles.subgroupHeadRow}>
                <Text style={styles.subgroupHead}>{sg || 'Sin subgrupo'}</Text>
                {/* La medida del grupo solo se puede nombrar con la categoría
                    delante: "Aguantes" existe en varias y cada una decide la
                    suya. Sin filtro de categoría no se sabe de cuál es este
                    bloque, así que no se dice nada. */}
                {muscleFilter && medidaDelGrupo(profile?.subgroupMeasures, muscleFilter, sg) ? (
                  <Text style={styles.subgroupMedida}>
                    {MEASURE_SHORT[
                      medidaDelGrupo(profile?.subgroupMeasures, muscleFilter, sg)!
                    ].toLowerCase()}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Grid>
            {list.map((exercise, index) => (
          <FadeIn key={exercise.id} delay={Math.min(index * 30, 240)}>
          <CardButton
            onPress={() => router.push(`/(trainer)/exercises/${exercise.id}`)}
            style={styles.exerciseCard}
          >
              {/* Franja del color de su categoría: distingue de un vistazo a
                  qué grupo pertenece cada ejercicio de la lista. */}
              <View
                style={[styles.catStripe, { backgroundColor: categoryColor(exercise.muscleGroup) }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <View style={styles.exerciseMetaRow}>
                  <Text style={styles.exerciseGroup}>{exercise.muscleGroup}</Text>
                </View>
              </View>
              {exercise.videoUrl ? (
                <View style={styles.videoBadge}>
                  <Ionicons name="play-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.videoBadgeText}>Vídeo</Text>
                </View>
              ) : null}
          </CardButton>
          </FadeIn>
            ))}
            </Grid>
          </View>
        ))
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

      {/* Color de una categoría: paleta + color personalizado */}
      <Dialogo
        visible={!!colorTarget}
        onClose={() => setColorTarget(null)}
        titulo={colorTarget ?? ''}
        texto="Elige un color o escribe el tuyo."
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
            <View style={styles.customRow}>
              <View
                style={[
                  styles.catDotBig,
                  { backgroundColor: normalizeHex(customColor) ?? colors.surfaceAlt },
                ]}
              />
              <TextInput
                value={customColor}
                onChangeText={setCustomColor}
                placeholder="#FF9900"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                style={styles.addCatInput}
                onSubmitEditing={applyCustomColor}
                returnKeyType="done"
              />
              <Pressable onPress={applyCustomColor} style={styles.addCatBtn} hitSlop={6}>
                <Text style={styles.addCatText}>Usar</Text>
              </Pressable>
            </View>
      </Dialogo>

      {/* Renombrar un subgrupo (arrastra a sus ejercicios) */}
      <Dialogo
        visible={!!renameSub}
        onClose={() => setRenameSub(null)}
        titulo="Renombrar subgrupo"
        texto={`Se actualizarán también los ejercicios que ya están en «${renameSub?.from ?? ''}».`}
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

      {/* Importar por pegado de texto (móvil) */}
      <Dialogo
        visible={pasteOpen}
        onClose={() => setPasteOpen(false)}
        titulo="Pegar plantilla"
        texto="Pega aquí el texto de la plantilla que te ha compartido otro entrenador."
      >
        <TextInput
          value={pasteText}
          onChangeText={setPasteText}
          placeholder="Pega el contenido JSON…"
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.pasteInput}
        />
        <Button title="Continuar" onPress={handlePasteImport} style={{ marginTop: spacing.md }} />
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
        accion={`Sustituir por ${pendingImport?.length ?? 0} ejercicios`}
        onAccion={confirmReplace}
        cargando={replacing}
      />
    </ScreenContainer>
  );
}

/** Acepta "#abc", "abc123" o "#AABBCC" y devuelve "#AABBCC", o null si no vale. */
function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toUpperCase()}`;
  return null;
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
  catColorHex: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  paletteDot: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'transparent' },
  paletteDotOn: { borderColor: colors.text },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subgroupHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subgroupHead: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  subgroupMedida: {
    ...typography.small,
    color: colors.primaryBright,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  catStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: spacing.sm },
  exerciseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
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
  pasteInput: {
    marginTop: spacing.md,
    minHeight: 140,
    maxHeight: 240,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  // La separación entre tarjetas la pone la rejilla, no la tarjeta.
  exerciseCard: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  exerciseName: { ...typography.h3, color: colors.text },
  exerciseGroup: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  videoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  videoBadgeText: { ...typography.small, color: colors.primary, fontFamily: fonts.heading, },
});
