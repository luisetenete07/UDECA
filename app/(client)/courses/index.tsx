import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { useAuth } from '../../../lib/auth-context';
import { getPublishedCourses } from '../../../lib/firestore/courses';
import { getCourseProgress } from '../../../lib/firestore/courseProgress';
import {
  diasDeAlta,
  estadoDeCurso,
  leccionesContables,
  type LessonsSeen,
} from '../../../lib/courseProgress';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import type { Course } from '../../../lib/types';

export default function ClientCoursesScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [vistas, setVistas] = useState<LessonsSeen>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.trainerId) {
      setLoading(false);
      return;
    }
    const data = await getPublishedCourses(profile.trainerId);
    data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
    setCourses(data);
    setVistas(await getCourseProgress(profile.uid));
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Los días de alta abren los candados por antigüedad de cada lección.
  const dias = diasDeAlta(profile?.createdAt);

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer
      maxWidth={860}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Text style={styles.title}>Academia</Text>
      <Text style={styles.subtitle}>Cursos exclusivos de tu coaching</Text>

      {courses.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title="Aún no hay cursos"
          subtitle="Cuando tu entrenador publique cursos, aparecerán aquí."
        />
      ) : (
        courses.map((course) => {
          const estado = estadoDeCurso(course, vistas[course.id], dias);
          return (
          <Pressable key={course.id} onPress={() => router.push(`/(client)/courses/${course.id}`)}>
            <Card style={styles.card}>
              {course.coverURL ? (
                <Image source={{ uri: course.coverURL }} style={styles.coverThumb} resizeMode="cover" />
              ) : (
                <View style={styles.thumb}>
                  <Ionicons name="play-circle" size={30} color={colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.courseTitle}>{course.title}</Text>
                {course.description ? (
                  <Text style={styles.courseDesc} numberOfLines={2}>
                    {course.description}
                  </Text>
                ) : null}
                {/* El avance manda sobre el recuento: cuántas secciones tiene
                    un curso importa antes de empezarlo y nunca más. */}
                {estado.total > 0 && estado.empezado ? (
                  <>
                    <View style={styles.barra}>
                      <View style={[styles.barraFill, { width: `${estado.ratio * 100}%` }]} />
                    </View>
                    <Text style={styles.courseMeta}>
                      {estado.terminado
                        ? 'Completado'
                        : `${estado.hechas} de ${estado.total} lecciones`}
                    </Text>
                    {/* Qué toca ahora. `estadoDeCurso` ya lo sabía y esta
                        pantalla no lo usaba: para retomar un curso había que
                        entrar y buscar entre las secciones cuál era la primera
                        sin marcar. Dicho aquí, el curso se retoma sin pensar. */}
                    {estado.siguiente ? (
                      <Text style={styles.siguiente} numberOfLines={1}>
                        Sigues por: {estado.siguiente.title}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.courseMeta}>
                    {course.sections.length}{' '}
                    {course.sections.length === 1 ? 'sección' : 'secciones'} ·{' '}
                    {leccionesContables(course).length}{' '}
                    {leccionesContables(course).length === 1 ? 'lección' : 'lecciones'}
                  </Text>
                )}
              </View>
              {estado.terminado ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
              )}
            </Card>
          </Pressable>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  coverThumb: { width: 84, height: 52, borderRadius: radius.sm },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseTitle: { ...typography.h3, color: colors.text },
  courseDesc: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  siguiente: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    marginTop: 3,
  },
  courseMeta: { ...typography.small, color: colors.textFaint, marginTop: 4 },
  barra: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  barraFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
});
