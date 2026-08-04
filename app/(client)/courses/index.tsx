import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useAuth } from '../../../lib/auth-context';
import { getPublishedCourses } from '../../../lib/firestore/courses';
import { colors, radius, spacing, typography } from '../../../lib/theme';
import type { Course } from '../../../lib/types';

function lessonCount(course: Course): number {
  return course.sections.reduce((sum, s) => sum + s.lessons.length, 0);
}

export default function ClientCoursesScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
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
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
      <ScreenHeader title="Academia" subtitle="Cursos exclusivos de tu coaching" />

      {courses.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title="Aún no hay cursos"
          subtitle="Cuando tu entrenador publique cursos, aparecerán aquí."
        />
      ) : (
        courses.map((course) => (
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
                <Text style={styles.courseMeta}>
                  {course.sections.length} secciones · {lessonCount(course)} lecciones
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Card>
          </Pressable>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  courseMeta: { ...typography.small, color: colors.textFaint, marginTop: 4 },
});
