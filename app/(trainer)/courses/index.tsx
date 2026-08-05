import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { DragList } from '../../../components/DragList';
import { moveItem } from '../../../lib/useDragReorder';
import { ListSkeleton } from '../../../components/Skeleton';
import { useAuth } from '../../../lib/auth-context';
import { getCoursesForTrainer, updateCourse } from '../../../lib/firestore/courses';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import type { Course } from '../../../lib/types';

function lessonCount(course: Course): number {
  return course.sections.reduce((sum, s) => sum + s.lessons.length, 0);
}

export default function TrainerCoursesScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const data = await getCoursesForTrainer(profile.uid);
    data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
    setCourses(data);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  // Reordena el curso (intercambio con el vecino) y persiste el orden.
  // Reordenar arrastrando (mantener pulsado y mover). Se guarda el nuevo
  // `order` de los cursos que hayan cambiado de sitio.
  const reordenar = (from: number, to: number) => {
    const next = moveItem(courses, from, to);
    setCourses(next);
    next.forEach((c, i) => {
      if ((c.order ?? -1) !== i) updateCourse(c.id, { order: i }).catch(() => {});
    });
  };


  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Esqueleto en sitio, con la cabecera ya pintada: cambiar a esta pestaña no
  // "apaga" la pantalla mientras llegan los datos.
  if (loading) {
    return (
      <ScreenContainer maxWidth={860}>
        <ScreenHeader title="Cursos" subtitle="Cargando..." />
        <ListSkeleton rows={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      maxWidth={860}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <ScreenHeader
        title="Cursos"
        subtitle={courses.length === 1 ? '1 curso' : `${courses.length} cursos`}
        actions={
          <Button title="+ Nuevo" onPress={() => router.push('/(trainer)/courses/new')} />
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title="Aún no tienes cursos"
          subtitle="Crea tu primer curso, organízalo en secciones y sube tus lecciones en vídeo."
        />
      ) : (
        <DragList
          items={courses}
          keyOf={(c) => c.id}
          onReorder={reordenar}
          handleOnly
          renderItem={(course, index, arrastrando, asa) => (
            <Pressable onPress={() => router.push(`/(trainer)/courses/${course.id}`)}>
              <Card style={[styles.card, arrastrando && styles.cardDragging]}>
                {course.coverURL ? (
                  <Image source={{ uri: course.coverURL }} style={styles.cover} resizeMode="cover" />
                ) : (
                  <View style={styles.cardIcon}>
                    <Ionicons name="play-circle" size={26} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseTitle}>{course.title}</Text>
                  <Text style={styles.courseMeta}>
                    {course.sections.length} secciones · {lessonCount(course)} lecciones
                  </Text>
                </View>
                <View style={[styles.badge, course.published ? styles.badgeOn : styles.badgeOff]}>
                  <Text style={[styles.badgeText, course.published && styles.badgeTextOn]}>
                    {course.published ? 'Publicado' : 'Borrador'}
                  </Text>
                </View>
                {/* Asa para reordenar: mantener pulsado aquí y mover. Va
                    aparte porque tocar la tarjeta abre el curso. */}
                <View {...asa} style={styles.dragHandle}>
                  <Ionicons name="reorder-three" size={20} color={colors.textFaint} />
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  cardDragging: { borderColor: colors.hairline },
  dragHandle: { padding: spacing.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: { width: 68, height: 44, borderRadius: radius.sm },
  courseTitle: { ...typography.h3, color: colors.text },
  courseMeta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  badgeOff: { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  badgeText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 11 },
  badgeTextOn: { color: colors.primary },
});
