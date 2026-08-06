import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { PressableScale } from '../../../components/PressableScale';
import { ProgressRing } from '../../../components/ProgressRing';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { VideoPlayer } from '../../../components/VideoPlayer';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth-context';
import { getCourse } from '../../../lib/firestore/courses';
import { getCourseProgress, setLessonsSeen } from '../../../lib/firestore/courseProgress';
import { estadoDeCurso, tieneContenido } from '../../../lib/courseProgress';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import type { Course, Lesson } from '../../../lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function ClientCourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [vistas, setVistas] = useState<string[]>([]);

  // Antigüedad del alumno (días desde que se creó su cuenta): abre candados.
  const memberDays = profile ? Math.floor((Date.now() - profile.createdAt) / DAY_MS) : 0;
  const isLocked = (lesson: Lesson) =>
    !!lesson.unlockAfterDays && memberDays < lesson.unlockAfterDays;

  // Secciones desplegadas (todas empiezan CERRADAS: el índice primero).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      setCourse(await getCourse(id));
      // Nada de autoseleccionar la primera lección: el curso se abre por su
      // índice de secciones y el alumno elige dónde entrar.
      setLoading(false);
    })();
    if (profile) {
      getCourseProgress(profile.uid)
        .then((m) => setVistas(m[id] ?? []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.uid]);

  /**
   * Marcar o desmarcar una lección.
   *
   * Se pinta al momento y se guarda detrás: nadie debería esperar a la red
   * para ver un check. Si el guardado falla se deshace y se avisa, que es la
   * única forma honesta de hacerlo — dejar el check puesto sería mentirle al
   * alumno y, de paso, a su entrenador.
   */
  const alternarVista = (lessonId: string) => {
    if (!profile || !id) return;
    const antes = vistas;
    const ahora = antes.includes(lessonId)
      ? antes.filter((x) => x !== lessonId)
      : [...antes, lessonId];
    setVistas(ahora);
    setLessonsSeen(profile.uid, id, ahora).catch(() => {
      setVistas(antes);
      showToast('No se pudo guardar. Inténtalo de nuevo.');
    });
  };

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
  const estado = estadoDeCurso(course, vistas, memberDays);
  const vista = (lessonId: string) => vistas.includes(lessonId);

  return (
    <ScreenContainer maxWidth={860}>
      {activeLesson ? (
        <>
          {activeLesson.kind === 'pdf' || (!activeLesson.videoUrl && activeLesson.pdfUrl) ? (
            activeLesson.pdfUrl ? (
              <EmbeddedDoc url={activeLesson.pdfUrl} />
            ) : (
              <View style={styles.docPlaceholder}>
                <Ionicons name="document-text-outline" size={28} color={colors.textFaint} />
                <Text style={styles.metaText}>Documento no disponible</Text>
              </View>
            )
          ) : (
            <VideoPlayer url={activeLesson.videoUrl} protectedContent />
          )}

          <Text style={styles.lessonTitle}>{activeLesson.title}</Text>
          {activeLesson.durationLabel ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>{activeLesson.durationLabel}</Text>
            </View>
          ) : null}
          {activeLesson.description ? (
            <Text style={styles.lessonDesc}>{activeLesson.description}</Text>
          ) : null}

          {/* Terminar una lección y empezar la siguiente son dos gestos que
              siempre van juntos: aquí es uno. Si ya estaba vista, el botón
              deja de empujar y solo permite desmarcarla. */}
          {tieneContenido(activeLesson) ? (
            vista(activeLesson.id) ? (
              <Button
                title="Quitar de vistas"
                variant="secondary"
                onPress={() => alternarVista(activeLesson.id)}
                style={{ marginTop: spacing.md }}
              />
            ) : (
              <Button
                title={estado.siguiente && estado.siguiente.id !== activeLesson.id
                  ? 'Vista · ir a la siguiente'
                  : 'Marcar como vista'}
                onPress={() => {
                  alternarVista(activeLesson.id);
                  const resto = estadoDeCurso(
                    course,
                    [...vistas, activeLesson.id],
                    memberDays
                  ).siguiente;
                  if (resto) setActiveLessonId(resto.id);
                }}
                style={{ marginTop: spacing.md }}
              />
            )
          ) : null}
        </>
      ) : course.coverURL ? (
        <Image source={{ uri: course.coverURL }} style={styles.courseCover} resizeMode="cover" />
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

      <View style={styles.courseHead}>
        {estado.total > 0 ? (
          <ProgressRing
            size={62}
            thickness={5}
            progress={estado.ratio}
            value={`${estado.hechas}/${estado.total}`}
            label="vistas"
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <Text style={styles.courseMeta}>
            {/* El total es el del anillo —lo que se puede ver hoy—, no todas
                las lecciones creadas: dos cifras distintas a dos dedos una de
                otra hacen dudar de las dos. Lo que falta por subir se dice
                aparte, que es una noticia buena y no un descuadre. */}
            {estado.terminado
              ? 'Curso completado'
              : `${course.sections.length} ${course.sections.length === 1 ? 'sección' : 'secciones'} · ${estado.total} ${estado.total === 1 ? 'lección' : 'lecciones'}`}
            {totalLessons > estado.total
              ? ` · ${totalLessons - estado.total} en camino`
              : ''}
          </Text>
        </View>
      </View>

      {totalLessons === 0 ? (
        <EmptyState title="Este curso aún no tiene lecciones" />
      ) : (
        course.sections.map((section) => {
          const open = !!openSections[section.id];
          return (
          <View key={section.id} style={styles.section}>
            {/* Cabecera de la sección: se toca para entrar/salir. La miniatura
                va pequeña al lado del título, nunca a pantalla completa. */}
            <Pressable
              onPress={() => setOpenSections((p) => ({ ...p, [section.id]: !open }))}
            >
              <Card style={[styles.sectionHead, open && styles.sectionHeadOpen]}>
                {section.coverURL ? (
                  <Image
                    source={{ uri: section.coverURL }}
                    style={styles.sectionThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.sectionThumb, styles.sectionThumbEmpty]}>
                    <Ionicons name="albums-outline" size={18} color={colors.textFaint} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionName}>{section.title}</Text>
                  <Text style={styles.sectionMeta}>
                    {section.lessons.length}{' '}
                    {section.lessons.length === 1 ? 'lección' : 'lecciones'}
                  </Text>
                </View>
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </Card>
            </Pressable>
            {open ? section.lessons.map((lesson, index) => {
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
                    {/* El check cierra la fila, no la abre: delante del play
                        competiría con el gesto de ver, que es a lo que se
                        viene. */}
                    {hasContent && !locked ? (
                      <PressableScale
                        haptic
                        hitSlop={10}
                        onPress={() => alternarVista(lesson.id)}
                        style={[styles.check, vista(lesson.id) && styles.checkOn]}
                      >
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={vista(lesson.id) ? colors.onPrimary : colors.textFaint}
                        />
                      </PressableScale>
                    ) : null}
                  </Card>
                </Pressable>
              );
            }) : null}
          </View>
          );
        })
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
  courseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  courseTitle: { ...typography.h3, color: colors.text },
  courseMeta: { ...typography.small, color: colors.textMuted },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  section: { marginBottom: spacing.sm },
  courseCover: {
    width: '100%',
    maxWidth: 520,
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionHeadOpen: { borderColor: colors.primary },
  sectionThumb: { width: 96, height: 54, borderRadius: radius.sm },
  sectionThumbEmpty: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  sectionMeta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  lessonRowActive: { borderColor: colors.primary },
  lessonRowLocked: { opacity: 0.6 },
  lessonName: { ...typography.body, color: colors.text, fontFamily: fonts.medium },
  lessonMeta: { ...typography.small, color: colors.textFaint, marginTop: 2 },
  soon: { ...typography.small, color: colors.textFaint },
});
