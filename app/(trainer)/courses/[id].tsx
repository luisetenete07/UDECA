import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
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
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import type { CourseSection, Lesson } from '../../../lib/types';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function CourseEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
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
      { id: uid(), title: `Sección ${prev.length + 1}`, lessons: [] },
    ]);
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const updateSectionTitle = (sectionId: string, value: string) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title: value } : s)));
  };

  const addLesson = (sectionId: string) => {
    const lesson: Lesson = { id: uid(), title: '', videoUrl: '' };
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

  const handlePickCover = async (target: 'course' | string) => {
    try {
      const url = await pickCoverPhoto();
      if (!url) return;
      if (target === 'course') setCoverURL(url);
      else
        setSections((prev) =>
          prev.map((s) => (s.id === target ? { ...s, coverURL: url } : s))
        );
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo cargar la imagen');
    }
  };

  const updateLesson = (
    sectionId: string,
    lessonId: string,
    field: 'title' | 'videoUrl' | 'durationLabel' | 'unlockAfterDays',
    value: string
  ) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              lessons: s.lessons.map((l) =>
                l.id === lessonId
                  ? field === 'unlockAfterDays'
                    ? { ...l, unlockAfterDays: parseInt(value, 10) || undefined }
                    : { ...l, [field]: value }
                  : l
              ),
            }
          : s
      )
    );
  };

  const handleSave = async () => {
    if (!profile) return;
    if (!title.trim()) {
      setError('El título del curso es obligatorio.');
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
    <ScreenContainer>
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

      <Pressable onPress={() => handlePickCover('course')} style={styles.coverPicker}>
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

      {sections.map((section) => (
        <Card key={section.id} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
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

          <Pressable onPress={() => handlePickCover(section.id)} style={styles.sectionCoverBtn}>
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

          {section.lessons.map((lesson, i) => (
            <View key={lesson.id} style={styles.lessonBlock}>
              <View style={styles.lessonHeader}>
                <Text style={styles.lessonNumber}>Lección {i + 1}</Text>
                <Pressable onPress={() => removeLesson(section.id, lesson.id)}>
                  <Ionicons name="close" size={16} color={colors.danger} />
                </Pressable>
              </View>
              <TextField
                value={lesson.title}
                onChangeText={(v) => updateLesson(section.id, lesson.id, 'title', v)}
                placeholder="Título de la lección"
              />
              <TextField
                value={lesson.videoUrl ?? ''}
                onChangeText={(v) => updateLesson(section.id, lesson.id, 'videoUrl', v)}
                placeholder="Enlace de Vimeo (ej. vimeo.com/123456789/abc123) o URL .mp4"
                autoCapitalize="none"
              />
              <TextField
                value={lesson.durationLabel ?? ''}
                onChangeText={(v) => updateLesson(section.id, lesson.id, 'durationLabel', v)}
                placeholder="Duración (ej. 12 min)"
              />
              <TextField
                label="Candado: desbloquear a los X días del alumno en tu grupo (vacío = libre)"
                value={lesson.unlockAfterDays ? String(lesson.unlockAfterDays) : ''}
                onChangeText={(v) => updateLesson(section.id, lesson.id, 'unlockAfterDays', v)}
                placeholder="Ej. 30"
                keyboardType="numeric"
              />
            </View>
          ))}

          <Button
            title="+ Añadir lección"
            variant="secondary"
            onPress={() => addLesson(section.id)}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      ))}

      <Button title="+ Añadir sección" variant="ghost" onPress={addSection} style={styles.addSection} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Guardar curso" onPress={handleSave} loading={saving} />

      {!isNew ? (
        <Button
          title="Eliminar curso"
          variant="danger"
          onPress={handleDelete}
          style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  textarea: { height: 78, textAlignVertical: 'top' },
  coverPicker: { marginBottom: spacing.md },
  coverImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md },
  coverEmpty: {
    width: '100%',
    aspectRatio: 16 / 9,
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
  sectionCard: { marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionNameInput: { flex: 1, marginBottom: 0 },
  iconBtn: { padding: spacing.xs },
  lessonBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  lessonNumber: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  addSection: { marginBottom: spacing.lg },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
});
