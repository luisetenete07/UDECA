import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { VideoPlayer } from '../../../components/VideoPlayer';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth-context';
import { getCourse } from '../../../lib/firestore/courses';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import type { Course, Lesson } from '../../../lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function ClientCourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  // Antigüedad del alumno (días desde que se creó su cuenta): abre candados.
  const memberDays = profile ? Math.floor((Date.now() - profile.createdAt) / DAY_MS) : 0;
  const isLocked = (lesson: Lesson) =>
    !!lesson.unlockAfterDays && memberDays < lesson.unlockAfterDays;

  useEffect(() => {
    if (!id) return;
    (async () => {
      const data = await getCourse(id);
      setCourse(data);
      // Primera lección DESBLOQUEADA.
      const first = data?.sections
        .flatMap((s) => s.lessons)
        .find((l) => !l.unlockAfterDays || memberDays >= l.unlockAfterDays);
      if (first) setActiveLessonId(first.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {activeLesson && (activeLesson.kind === 'pdf' || (!activeLesson.videoUrl && activeLesson.pdfUrl)) ? (
        activeLesson.pdfUrl ? (
          <EmbeddedDoc url={activeLesson.pdfUrl} />
        ) : (
          <View style={styles.docPlaceholder}>
            <Ionicons name="document-text-outline" size={28} color={colors.textFaint} />
            <Text style={styles.metaText}>Documento no disponible</Text>
          </View>
        )
      ) : (
        <VideoPlayer url={activeLesson?.videoUrl} protectedContent />
      )}

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

      {/* E-book adjunto a una lección de VÍDEO (material de apoyo). */}
      {activeLesson?.kind !== 'pdf' && activeLesson?.videoUrl && activeLesson?.pdfUrl ? (
        <View style={styles.pdfBlock}>
          <View style={styles.pdfHead}>
            <Ionicons name="document-text-outline" size={15} color={colors.primary} />
            <Text style={styles.pdfTitle}>E-book de la lección</Text>
          </View>
          <EmbeddedDoc url={activeLesson.pdfUrl} />
        </View>
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
            {section.coverURL ? (
              <Image
                source={{ uri: section.coverURL }}
                style={styles.sectionCover}
                resizeMode="cover"
              />
            ) : null}
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.lessons.map((lesson, index) => {
              const isActive = lesson.id === activeLessonId;
              const locked = isLocked(lesson);
              const daysLeft = locked ? lesson.unlockAfterDays! - memberDays : 0;
              const isPdf = lesson.kind === 'pdf' || (!lesson.videoUrl && !!lesson.pdfUrl);
              const hasContent = isPdf ? !!lesson.pdfUrl : !!lesson.videoUrl;
              return (
                <Pressable
                  key={lesson.id}
                  onPress={() => {
                    if (locked) {
                      showToast(
                        `Se desbloquea en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`
                      );
                      return;
                    }
                    setActiveLessonId(lesson.id);
                  }}
                >
                  <Card
                    style={[
                      styles.lessonRow,
                      isActive && styles.lessonRowActive,
                      locked && styles.lessonRowLocked,
                    ]}
                  >
                    <Ionicons
                      name={
                        locked
                          ? 'lock-closed'
                          : isPdf
                            ? 'document-text-outline'
                            : isActive
                              ? 'pause-circle'
                              : 'play-circle-outline'
                      }
                      size={22}
                      color={locked ? colors.textFaint : isActive ? colors.primary : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.lessonName,
                          isActive && { color: colors.primary },
                          locked && { color: colors.textFaint },
                        ]}
                      >
                        {index + 1}. {lesson.title || 'Lección sin título'}
                      </Text>
                      {locked ? (
                        <Text style={styles.lessonMeta}>
                          Se desbloquea en {daysLeft} día{daysLeft === 1 ? '' : 's'}
                        </Text>
                      ) : lesson.durationLabel ? (
                        <Text style={styles.lessonMeta}>{lesson.durationLabel}</Text>
                      ) : null}
                    </View>
                    {!locked && !hasContent ? <Text style={styles.soon}>Pronto</Text> : null}
                    {!locked && isPdf && hasContent ? (
                      <Text style={styles.pdfTag}>PDF</Text>
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

/** Convierte enlaces de Drive/Dropbox a su versión embebible. */
function toEmbeddablePdf(url: string): string {
  if (url.includes('drive.google.com')) return url.replace(/\/view.*$/, '/preview');
  if (url.includes('dropbox.com')) return url.replace('?dl=0', '?raw=1');
  return url;
}

/** Visor de PDF/e-book DENTRO de la app (iframe en web, WebView en nativo). */
function EmbeddedDoc({ url }: { url: string }) {
  const src = toEmbeddablePdf(url);
  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      src,
      style: {
        width: '100%',
        height: 480,
        backgroundColor: '#000',
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
      },
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require('react-native-webview');
  return (
    <View style={styles.pdfNative}>
      <WebView source={{ uri: src }} style={{ flex: 1, borderRadius: radius.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  lessonTitle: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  metaText: { ...typography.small, color: colors.textMuted },
  lessonDesc: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  docPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pdfTag: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  pdfBlock: { marginTop: spacing.md },
  pdfHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  pdfTitle: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  pdfNative: { height: 480, borderRadius: radius.md, overflow: 'hidden' },
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
  sectionCover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  lessonRowActive: { borderColor: colors.primary },
  lessonRowLocked: { opacity: 0.6 },
  lessonName: { ...typography.body, color: colors.text, fontFamily: fonts.medium },
  lessonMeta: { ...typography.small, color: colors.textFaint, marginTop: 2 },
  soon: { ...typography.small, color: colors.textFaint },
});
