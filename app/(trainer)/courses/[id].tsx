import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DragList } from '../../../components/DragList';
import { EditorDeLeccion } from '../../../components/EditorDeLeccion';
import {
  cabeElCurso,
  conLeccionCambiada,
  conMiniCambiada,
  conMiniNueva,
  leccionesReordenadas,
  minisReordenadas,
  seccionesReordenadas,
  sinMini,
} from '../../../lib/curso';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../lib/auth-context';
import {
  createCourse,
  deleteCourse,
  getCourse,
  updateCourse,
} from '../../../lib/firestore/courses';
import { pickCoverPhoto } from '../../../lib/image';
import { showToast } from '../../../components/Toast';
import { nuevoId } from '../../../lib/ids';
import { Dialogo } from '../../../components/Dialogo';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import type { CourseSection, Lesson } from '../../../lib/types';

export default function CourseEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  // Un curso se lleva por delante sus secciones y todas sus lecciones: horas
  // de vídeo grabado. No puede irse de un toque.
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(false);
  const [coverURL, setCoverURL] = useState<string | undefined>(undefined);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !id) return;
    (async () => {
      const course = await getCourse(id);
      if (course) {
        setTitle(course.title);
        setDescription(course.description ?? '');
        setPublished(course.published);
        setCoverURL(course.coverURL);
        setSections(course.sections);
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { id: nuevoId(), title: `Sección ${prev.length + 1}`, lessons: [] },
    ]);
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const updateSectionTitle = (sectionId: string, value: string) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title: value } : s)));
  };

  const addLesson = (sectionId: string) => {
    const lesson: Lesson = { id: nuevoId(), title: '', videoUrl: '' };
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, lessons: [...s.lessons, lesson] } : s))
    );
  };

  const removeLesson = (sectionId: string, lessonId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) } : s
      )
    );
  };

  /**
   * Elegir una miniatura. Sirve para la portada del curso, la de una sección,
   * la de una lección y la de una mini clase: es la misma acción con cuatro
   * destinos, y tenerla una sola vez evita que cada una comprima distinto.
   */
  const elegirImagen = async (aplicar: (url: string) => void) => {
    try {
      const url = await pickCoverPhoto();
      if (url) aplicar(url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo cargar la imagen');
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    if (!title.trim()) {
      setError('El título del curso es obligatorio.');
      return;
    }
    // Un curso entero vive en UN documento de Firestore y las miniaturas van
    // dentro. Si no cabe, Firestore contesta con un error que no dice nada y
    // el entrenador pierde el trabajo de la sesión sin saber por qué.
    const sitio = cabeElCurso({ sections });
    if (!sitio.cabe) {
      setError(sitio.aviso ?? 'El curso no cabe.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const data = {
        trainerId: profile.uid,
        title: title.trim(),
        description: description.trim() || undefined,
        published,
        coverURL,
        sections,
      };
      if (isNew) {
        await createCourse(data);
      } else if (id) {
        await updateCourse(id, data);
      }
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
      await deleteCourse(id);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer maxWidth={860}>
      <TextField
        label="Título del curso"
        value={title}
        onChangeText={setTitle}
        placeholder="Ej. Domina tu primer muscle-up"
      />
      <TextField
        label="Descripción"
        value={description}
        onChangeText={setDescription}
        placeholder="De qué trata el curso..."
        multiline
        numberOfLines={3}
        style={styles.textarea}
      />

      <Pressable onPress={() => elegirImagen(setCoverURL)} style={styles.coverPicker}>
        {coverURL ? (
          <Image source={{ uri: coverURL }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={styles.coverEmpty}>
            <Ionicons name="image-outline" size={22} color={colors.primary} />
            <Text style={styles.coverEmptyText}>Añadir portada del curso</Text>
          </View>
        )}
      </Pressable>

      <Card style={styles.publishRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.publishTitle}>Publicado</Text>
          <Text style={styles.publishHint}>
            Si está activo, tus alumnos podrán verlo. Déjalo desactivado como borrador.
          </Text>
        </View>
        <Switch
          value={published}
          onValueChange={setPublished}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </Card>

      <Text style={styles.sectionsHeader}>Contenido</Text>

      <DragList
        items={sections}
        keyOf={(s) => s.id}
        onReorder={(de, a) => setSections((prev) => seccionesReordenadas(prev, de, a))}
        handleOnly
        gap={spacing.md}
        renderItem={(section, _i, _arrastrando, asaSeccion) => (
          <Card key={section.id} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.asaSeccion} {...asaSeccion}>
                <Ionicons name="reorder-two-outline" size={22} color={colors.textFaint} />
              </View>
              <TextField
                value={section.title}
                onChangeText={(v) => updateSectionTitle(section.id, v)}
                placeholder="Nombre de la sección"
                style={styles.sectionNameInput}
              />
              <Pressable onPress={() => removeSection(section.id)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>

            <Pressable
              onPress={() =>
                elegirImagen((url) =>
                  setSections((prev) =>
                    prev.map((x) => (x.id === section.id ? { ...x, coverURL: url } : x))
                  )
                )
              }
              style={styles.sectionCoverBtn}
            >
              {section.coverURL ? (
                <Image
                  source={{ uri: section.coverURL }}
                  style={styles.sectionCoverImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons name="image-outline" size={15} color={colors.primary} />
                  <Text style={styles.sectionCoverText}>Portada de la sección</Text>
                </>
              )}
            </Pressable>

            {/* Las lecciones se arrastran por el asa y no por toda la fila:
                dentro hay campos de texto, y colocar el cursor en uno no puede
                mover la lección de sitio. */}
            <DragList
              items={section.lessons}
              keyOf={(l) => l.id}
              onReorder={(de, a) => setSections((prev) => leccionesReordenadas(prev, section.id, de, a))}
              handleOnly
              gap={spacing.md}
              style={{ marginTop: spacing.sm }}
              renderItem={(lesson, i, _arrastrando, asa) => (
                <EditorDeLeccion
                  leccion={lesson}
                  numero={i + 1}
                  handleProps={asa}
                  onCambiar={(campos) =>
                    setSections((prev) => conLeccionCambiada(prev, section.id, lesson.id, campos))
                  }
                  onQuitar={() => removeLesson(section.id, lesson.id)}
                  onMiniatura={() =>
                    elegirImagen((url) =>
                      setSections((prev) =>
                        conLeccionCambiada(prev, section.id, lesson.id, { thumbURL: url })
                      )
                    )
                  }
                  onQuitarMiniatura={() =>
                    setSections((prev) =>
                      conLeccionCambiada(prev, section.id, lesson.id, { thumbURL: undefined })
                    )
                  }
                  onMiniNueva={() => setSections((prev) => conMiniNueva(prev, section.id, lesson.id))}
                  onMiniQuitar={(miniId) =>
                    setSections((prev) => sinMini(prev, section.id, lesson.id, miniId))
                  }
                  onMiniCambiar={(miniId, campos) =>
                    setSections((prev) => conMiniCambiada(prev, section.id, lesson.id, miniId, campos))
                  }
                  onMiniReordenar={(de, a) =>
                    setSections((prev) => minisReordenadas(prev, section.id, lesson.id, de, a))
                  }
                  onMiniMiniatura={(miniId) =>
                    elegirImagen((url) =>
                      setSections((prev) =>
                        conMiniCambiada(prev, section.id, lesson.id, miniId, { thumbURL: url })
                      )
                    )
                  }
                  onMiniQuitarMiniatura={(miniId) =>
                    setSections((prev) =>
                      conMiniCambiada(prev, section.id, lesson.id, miniId, { thumbURL: undefined })
                    )
                  }
                />
              )}
            />

            <Button
              title="+ Añadir lección"
              variant="secondary"
              onPress={() => addLesson(section.id)}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        )}
      />

      <Button title="+ Añadir sección" variant="ghost" onPress={addSection} style={styles.addSection} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Guardar curso" onPress={handleSave} loading={saving} />

      {!isNew ? (
        <Pressable
          onPress={() => setConfirmarBorrado(true)}
          style={styles.borrarEnlace}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={14} color={colors.textFaint} />
          <Text style={styles.borrarEnlaceTexto}>Eliminar curso</Text>
        </Pressable>
      ) : null}

      <Dialogo
        visible={confirmarBorrado}
        onClose={() => setConfirmarBorrado(false)}
        icono="trash-outline"
        titulo={`¿Eliminar ${title || 'este curso'}?`}
        texto={`Se borran sus ${sections.length} ${
          sections.length === 1 ? 'sección' : 'secciones'
        } y todas sus lecciones. Tus alumnos dejarán de verlo. No se puede deshacer.`}
        accion="Eliminar"
        onAccion={handleDelete}
        cargando={saving}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  textarea: { height: 78, textAlignVertical: 'top' },
  coverPicker: { marginBottom: spacing.md },
  coverImage: { width: '100%', maxWidth: 480, aspectRatio: 16 / 9, borderRadius: radius.md, alignSelf: 'flex-start' },
  coverEmpty: {
    width: '100%',
    maxWidth: 480,
    aspectRatio: 16 / 9,
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  coverEmptyText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  sectionCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  sectionCoverImage: { width: 120, height: 68, borderRadius: radius.sm },
  sectionCoverText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  publishRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  publishTitle: { ...typography.h3, color: colors.text },
  publishHint: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  sectionsHeader: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  asaSeccion: { paddingRight: spacing.xs, paddingVertical: 2 },
  sectionCard: { marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionNameInput: { flex: 1, marginBottom: 0 },
  iconBtn: { padding: spacing.xs },
  addSection: { marginBottom: spacing.lg },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
});
