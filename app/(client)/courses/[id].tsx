import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { VideoPlayer } from '../../../components/VideoPlayer';
import { getCourse } from '../../../lib/firestore/courses';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import type { Course, Lesson } from '../../../lib/types';

export default function ClientCourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const data = await getCourse(id);
      setCourse(data);
      const first = data?.sections.flatMap((s) => s.lessons)[0];
      if (first) setActiveLessonId(first.id);
      setLoading(false);
    })();
  }, [id]);

  const activeLesson = useMemo<Lesson | null>(() => {
    if (!course) return null;
    for (const section of course.sections) {
      const found = section.lessons.find((l) => l.id === activeLessonId);
      if (found) return found;
    }
    return null;
  }, [course, activeLessonId]);

  if (loading) return <LoadingScreen />;
  if (!course) return <EmptyState title="Curso no encontrado" />;

  const totalLessons = course.sections.reduce((sum, s) => sum + s.lessons.length, 0);

  return (
    <ScreenContainer>
      <VideoPlayer url={activeLesson?.videoUrl} />

      <Text style={styles.lessonTitle}>{activeLesson?.title || course.title}</Text>
      {activeLesson?.durationLabel ? (
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{activeLesson.durationLabel}</Text>
        </View>
      ) : null}
      {activeLesson?.description ? (
        <Text style={styles.lessonDesc}>{activeLesson.description}</Text>
      ) : null}

      <View style={styles.privateBadge}>
        <Ionicons name="lock-closed" size={13} color={colors.primary} />
        <Text style={styles.privateText}>Contenido privado · solo para miembros</Text>
      </View>

      <Text style={styles.courseTitle}>{course.title}</Text>
      <Text style={styles.courseMeta}>
        {course.sections.length} secciones · {totalLessons} lecciones
      </Text>

      {totalLessons === 0 ? (
        <EmptyState title="Este curso aún no tiene lecciones" />
      ) : (
        course.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.lessons.map((lesson, index) => {
              const isActive = lesson.id === activeLessonId;
              return (
                <Pressable key={lesson.id} onPress={() => setActiveLessonId(lesson.id)}>
                  <Card style={[styles.lessonRow, isActive && styles.lessonRowActive]}>
                    <Ionicons
                      name={isActive ? 'pause-circle' : 'play-circle-outline'}
                      size={22}
                      color={isActive ? colors.primary : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lessonName, isActive && { color: colors.primary }]}>
                        {index + 1}. {lesson.title || 'Lección sin título'}
                      </Text>
                      {lesson.durationLabel ? (
                        <Text style={styles.lessonMeta}>{lesson.durationLabel}</Text>
                      ) : null}
                    </View>
                    {!lesson.videoUrl ? (
                      <Text style={styles.soon}>Pronto</Text>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lessonTitle: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  metaText: { ...typography.small, color: colors.textMuted },
  lessonDesc: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  privateText: { ...typography.small, color: colors.primary, fontFamily: fonts.medium },
  courseTitle: { ...typography.h3, color: colors.text },
  courseMeta: { ...typography.small, color: colors.textMuted, marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  lessonRowActive: { borderColor: colors.primary },
  lessonName: { ...typography.body, color: colors.text, fontFamily: fonts.medium },
  lessonMeta: { ...typography.small, color: colors.textFaint, marginTop: 2 },
  soon: { ...typography.small, color: colors.textFaint },
});
