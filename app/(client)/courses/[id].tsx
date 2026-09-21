import React, { useEffect, useMemo, useState } from 'react';
import { frase } from '../../../lib/idioma';
import { useLocalSearchParams } from 'expo-router';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { PressableScale } from '../../../components/PressableScale';
import { MiniaturaCurso } from '../../../components/MiniaturaCurso';
import { ProgressRing } from '../../../components/ProgressRing';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { VideoPlayer } from '../../../components/VideoPlayer';
import { BotonAmpliar, VisorDeVideo } from '../../../components/VisorDeVideo';
import { mereceAmpliar, tamanoDelVisor } from '../../../lib/visorDeVideo';
import {
  altoDeLaMuestra,
  enlaceDeLectura,
  esEbook,
} from '../../../lib/visorDeEbook';
import {
  MarcaDeAgua,
  useProteccionDePantalla,
  useSinCopiaEnWeb,
} from '../../../components/MarcaDeAgua';
import { avisoDeCaptura, avisoDeProteccion } from '../../../lib/marcaDeAgua';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth-context';
import { getCourse } from '../../../lib/firestore/courses';
import { getCourseProgress, setLessonsSeen } from '../../../lib/firestore/courseProgress';
import { contenidosDeLeccion, estadoDeCurso, tieneContenido } from '../../../lib/courseProgress';
import { cursoParaMi, esVip } from '../../../lib/vip';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import type { ContenidoDeCurso, Course, Lesson } from '../../../lib/types';

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
      // Podado por VIP antes de nada (ver lib/vip.ts). Un alumno que llegue
      // por enlace directo a un curso entero VIP se encuentra un curso vacío,
      // no sus clases.
      const c = await getCourse(id);
      setCourse(c ? cursoParaMi(c, esVip(profile)) : c);
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

  /**
   * Lo que se está viendo, que puede ser una lección o una mini clase suya.
   *
   * Se busca en los dos niveles porque para el alumno son lo mismo: un vídeo
   * que se abre. La diferencia —que una esté dentro de otra— es cosa de cómo
   * el entrenador lo ha organizado, no de cómo se ve.
   */
  const activeLesson = useMemo<ContenidoDeCurso | null>(() => {
    if (!course || !activeLessonId) return null;
    for (const section of course.sections) {
      for (const l of section.lessons) {
        if (l.id === activeLessonId) return l;
        const mini = (l.minis ?? []).find((m) => m.id === activeLessonId);
        if (mini) return mini;
      }
    }
    return null;
  }, [course, activeLessonId]);

  /** La lección a la que pertenece lo que se ve (para su candado y su texto). */
  const leccionDeLoActivo = useMemo<Lesson | null>(() => {
    if (!course || !activeLessonId) return null;
    for (const section of course.sections) {
      for (const l of section.lessons) {
        if (l.id === activeLessonId || (l.minis ?? []).some((m) => m.id === activeLessonId)) {
          return l;
        }
      }
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
      {/* La portada del curso, no el vídeo: el vídeo se abre a pantalla
          completa al tocar una lección (ver ReproductorLeccion). Antes se
          cambiaba aquí arriba y había que subir a buscarlo cada vez, en móvil
          y en ordenador. */}
      {course.coverURL ? (
        <Image source={{ uri: course.coverURL }} style={styles.courseCover} resizeMode="cover" />
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
              : `${course.sections.length} ${course.sections.length === 1 ? 'sección' : 'secciones'} · ${estado.total} ${estado.total === 1 ? 'vídeo' : 'vídeos'}`}
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
                    {(() => {
                      // Se cuenta lo que se puede VER: una lección que solo
                      // agrupa mini clases no es un vídeo más, y contarla haría
                      // que los números de la sección no cuadraran con las filas.
                      const n = section.lessons.reduce(
                        (t, l) => t + contenidosDeLeccion(l).length,
                        0
                      );
                      return `${n} ${n === 1 ? 'vídeo' : 'vídeos'}`;
                    })()}
                  </Text>
                </View>
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </Card>
            </Pressable>
            {open
              ? section.lessons.map((lesson, index) => {
                  const locked = isLocked(lesson);
                  const daysLeft = locked ? lesson.unlockAfterDays! - memberDays : 0;
                  const minis = lesson.minis ?? [];
                  // Una lección puede ser solo un contenedor: sin vídeo propio
                  // y con mini clases dentro. Entonces la fila no se abre, se
                  // usa para agrupar.
                  const abrible = tieneContenido(lesson);
                  return (
                    <View key={lesson.id}>
                      <FilaDeContenido
                        contenido={lesson}
                        thumbURL={lesson.thumbURL}
                        numero={`${index + 1}`}
                        bloqueada={locked}
                        diasQueFaltan={daysLeft}
                        activa={lesson.id === activeLessonId}
                        vista={vista(lesson.id)}
                        abrible={abrible}
                        sub={
                          minis.length > 0
                            ? `${minis.length} ${minis.length === 1 ? 'mini clase' : 'mini clases'}`
                            : undefined
                        }
                        onAbrir={() => {
                          if (locked) {
                            showToast(frase`Se desbloquea en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`);
                            return;
                          }
                          if (abrible) setActiveLessonId(lesson.id);
                        }}
                        onMarcar={() => alternarVista(lesson.id)}
                      />

                      {/* Las mini clases van sangradas y con la miniatura más
                          pequeña: se ve de un vistazo que son de la lección de
                          arriba y no lecciones sueltas. */}
                      {minis.map((mini, j) => (
                        <FilaDeContenido
                          key={mini.id}
                          contenido={mini}
                          numero={`${index + 1}.${j + 1}`}
                          bloqueada={locked}
                          diasQueFaltan={daysLeft}
                          activa={mini.id === activeLessonId}
                          vista={vista(mini.id)}
                          abrible={tieneContenido(mini)}
                          sangrada
                          onAbrir={() => {
                            if (locked) {
                              showToast(
                                frase`Se desbloquea en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`
                              );
                              return;
                            }
                            if (tieneContenido(mini)) setActiveLessonId(mini.id);
                          }}
                          onMarcar={() => alternarVista(mini.id)}
                        />
                      ))}
                    </View>
                  );
                })
              : null}
          </View>
          );
        })
      )}

      <ReproductorLeccion
        contenido={activeLesson}
        leccion={leccionDeLoActivo}
        profile={profile}
        vista={activeLesson ? vista(activeLesson.id) : false}
        haySiguiente={
          !!estado.siguiente && !!activeLesson && estado.siguiente.id !== activeLesson.id
        }
        onCerrar={() => setActiveLessonId(null)}
        onMarcar={() => {
          if (!activeLesson) return;
          alternarVista(activeLesson.id);
          const resto = estadoDeCurso(course, [...vistas, activeLesson.id], memberDays).siguiente;
          // Encadenar sin cerrar: terminar una lección y empezar la siguiente
          // son dos gestos que siempre van juntos, así que aquí es uno.
          if (resto && resto.id !== activeLesson.id) setActiveLessonId(resto.id);
          else setActiveLessonId(null);
        }}
      />
    </ScreenContainer>
  );
}

/**
 * La lección, a pantalla completa.
 *
 * Antes el vídeo se cambiaba en una tarjeta arriba del todo y la lista estaba
 * debajo: al tocar la lección catorce había que subir a buscarlo, en móvil y
 * en ordenador. Ahora se abre encima, ocupando la pantalla, y al cerrar la
 * lista sigue justo donde estaba.
 *
 * Es también lo que se espera de un vídeo hoy: se toca y se ve, sin pasos.
 */
function ReproductorLeccion({
  contenido,
  leccion,
  vista,
  haySiguiente,
  onCerrar,
  onMarcar,
  profile,
}: {
  contenido: ContenidoDeCurso | null;
  leccion: Lesson | null;
  vista: boolean;
  haySiguiente: boolean;
  onCerrar: () => void;
  onMarcar: () => void;
  profile: ReturnType<typeof useAuth>['profile'];
}) {
  const esPdf = esEbook(contenido);
  const [pillado, setPillado] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  /** El e-book de apoyo de una clase de vídeo, abierto a pantalla completa. */
  const [leyendo, setLeyendo] = useState(false);
  // El vídeo ya no cabe en la columna de texto: se calcula el 16:9 más grande
  // que entra en esta pantalla (ver lib/visorDeVideo).
  const { width: ancho, height: alto } = useWindowDimensions();
  const tamVideo = tamanoDelVisor(ancho, alto);
  // Mientras hay una clase abierta, el sistema no deja grabar la pantalla
  // (Android e iOS). Se apaga al cerrar: bloquearlo todo el rato impediría al
  // alumno hacerle una captura a su propio entreno.
  //
  // El aviso de captura es para donde el bloqueo no llega (un iOS antiguo): se
  // tapa la clase y hay que volver a destaparla a mano. No es una cerradura
  // —quien lo intenta ya tiene su captura—, es que sepa que se ha visto.
  useProteccionDePantalla(!!contenido, () => setPillado(true));
  // Y el PDF de una lección también es material del curso: mientras esté
  // abierto, en el navegador no hay menú, ni selección, ni arrastrar fuera.
  useSinCopiaEnWeb(!!contenido);
  // Al encadenar con la siguiente, lo que estuviera ampliado se cierra. Este
  // reproductor no se desmonta entre lecciones —cambia lo que enseña—, así que
  // sin esto la lección nueva se abriría con el visor de la anterior encima.
  useEffect(() => {
    setAmpliado(false);
    setLeyendo(false);
  }, [contenido?.id]);
  if (!contenido) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar} transparent={false}>
      <View style={styles.repFondo}>
        <View style={styles.repCabecera}>
          <Pressable onPress={onCerrar} hitSlop={10} style={styles.repCerrar}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.repCabeceraTexto} numberOfLines={1}>
            {contenido.title || 'Lección'}
          </Text>
        </View>

        {/*
         * CUANDO LA CLASE ES EL E-BOOK, EL E-BOOK ES LA PANTALLA.
         *
         * Antes caía dentro del mismo `ScrollView` que el texto, en una caja de
         * 480 px, y debajo quedaba media pantalla negra vacía. El navegador
         * encogía la página entera hasta que cabía en esa ranura: el documento
         * salía recortado por arriba y por abajo, y lo que quedaba era
         * demasiado pequeño para leerlo.
         *
         * Aquí no hay scroll nuestro, ni columna de texto, ni tarjeta: el
         * documento ocupa todo lo que hay entre la cabecera y el pie, y quien
         * pasa páginas es el visor. El título ya está arriba —repetirlo debajo
         * era robarle sitio a lo único que importa— y del texto de la lección
         * quedan dos líneas, que es lo que se lee antes de empezar.
         */}
        {esPdf ? (
          <>
            {contenido.pdfUrl ? (
              <EmbeddedDoc url={contenido.pdfUrl} lleno />
            ) : (
              <View style={[styles.docPlaceholder, styles.docPlaceholderLleno]}>
                <Ionicons name="document-text-outline" size={28} color={colors.textFaint} />
                <Text style={styles.metaText}>Documento no disponible</Text>
              </View>
            )}
            <View style={styles.ebookPie}>
              {leccion?.description ? (
                <Text style={styles.ebookPieTexto} numberOfLines={2}>
                  {leccion.description}
                </Text>
              ) : null}
              {tieneContenido(contenido) ? (
                <Button
                  title={vista ? 'Quitar de vistas' : haySiguiente ? 'Leída · ir a la siguiente' : 'Marcar como leída'}
                  variant={vista ? 'secondary' : 'primary'}
                  onPress={onMarcar}
                />
              ) : null}
            </View>
          </>
        ) : (
        <ScrollView contentContainerStyle={styles.repContenido}>
          {/* El nombre de quien está viendo la clase, encima de la clase. No
              impide copiar: hace que la copia lleve el nombre de quien la
              filtró, que contra una cámara apuntando a la pantalla es lo
              único que queda. */}
          {/* El vídeo, tan ancho como caben 16:9 en esta pantalla y no atado a
              la columna de texto: en un ordenador esa columna dejaba la clase
              en un tercio de la pantalla, que para ver una técnica no da. */}
          <View style={[styles.repVideo, { width: tamVideo.width, height: tamVideo.height }]}>
            <MarcaDeAgua profile={profile}>
              <VideoPlayer url={contenido.videoUrl} protectedContent />
            </MarcaDeAgua>
          </View>
          {mereceAmpliar(tamVideo.width, ancho, alto) ? (
            <BotonAmpliar onPress={() => setAmpliado(true)} />
          ) : null}
          <VisorDeVideo
            visible={ampliado}
            url={contenido.videoUrl}
            titulo={contenido.title}
            profile={profile}
            onCerrar={() => setAmpliado(false)}
          />

          {/* El texto se queda en su columna legible aunque el vídeo sea muy
              ancho: una línea de 2.000 px no la lee nadie. */}
          <View style={styles.repTexto}>
          {/* Se le dice lo que hay, y solo lo que hay: en móvil el sistema no
              deja grabar; en web no hay forma de impedirlo y prometerlo sería
              mentir. Lo que sí es verdad en las dos es que el vídeo lleva su
              nombre encima. */}
          {contenido.videoUrl ? (
            <View style={styles.avisoProteccion}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.textFaint} />
              <Text style={styles.avisoProteccionTexto}>{avisoDeProteccion(Platform.OS)}</Text>
            </View>
          ) : null}

          <Text style={styles.lessonTitle}>{contenido.title}</Text>
          {contenido.durationLabel ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>{contenido.durationLabel}</Text>
            </View>
          ) : null}
          {/* La descripción es de la LECCIÓN: una mini clase no tiene texto
              propio, y enseñar el de su lección da el contexto de dónde está. */}
          {leccion?.description ? (
            <Text style={styles.lessonDesc}>{leccion.description}</Text>
          ) : null}

          {tieneContenido(contenido) ? (
            <Button
              title={vista ? 'Quitar de vistas' : haySiguiente ? 'Vista · ir a la siguiente' : 'Marcar como vista'}
              variant={vista ? 'secondary' : 'primary'}
              onPress={onMarcar}
              style={{ marginTop: spacing.md }}
            />
          ) : null}

          {/* El e-book de apoyo de una lección de vídeo, dentro de la propia
              lección: es material de ESA lección y fuera se perdía.
              Aquí es una MUESTRA —debajo sigue habiendo página—, y para leerlo
              está el botón: se abre a pantalla completa, igual que un e-book
              que sea la clase entera. */}
          {contenido.videoUrl && contenido.pdfUrl ? (
            <View style={styles.pdfBlock}>
              <View style={styles.pdfHead}>
                <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                <Text style={styles.pdfTitle}>E-book de la lección</Text>
              </View>
              {/* El botón va ENCIMA de la muestra, no debajo. Debajo hay que
                  pasar por encima del documento para llegar, y el dedo que
                  cruza un documento que se desplaza se queda dentro de él:
                  quien quería abrirlo entero acaba pasando páginas de la
                  muestra sin querer. */}
              <BotonLeerEntero onPress={() => setLeyendo(true)} />
              <EmbeddedDoc url={contenido.pdfUrl} />
              <LectorAPantallaCompleta
                visible={leyendo}
                url={contenido.pdfUrl}
                titulo={contenido.title}
                onCerrar={() => setLeyendo(false)}
              />
            </View>
          ) : null}
          </View>
        </ScrollView>
        )}

        {/* Se ha detectado una captura: se tapa la clase. Hay que destaparla a
            mano, y al hacerlo se lee de quién es la copia que se acaba de
            llevar. Es lo único que se puede hacer donde el sistema no bloquea,
            y es más de lo que parece: lo que frena de verdad no es la
            cerradura, es saber que hay nombre puesto. */}
        {pillado ? (
          <View style={styles.tapa}>
            <Ionicons name="eye-off-outline" size={30} color={colors.text} />
            <Text style={styles.tapaTitulo}>Captura detectada</Text>
            <Text style={styles.tapaTexto}>{avisoDeCaptura(profile?.name)}</Text>
            <Button title="Seguir viendo la clase" onPress={() => setPillado(false)} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * Una fila de la lista del curso: lección o mini clase.
 *
 * Es la misma fila para las dos a propósito. Para el alumno son lo mismo —un
 * vídeo que se abre— y la única diferencia que necesita ver es la sangría, que
 * le dice de quién cuelga. Dos filas distintas para lo mismo darían dos sitios
 * donde arreglar el mismo detalle.
 */
function FilaDeContenido({
  contenido,
  thumbURL,
  numero,
  bloqueada,
  diasQueFaltan,
  activa,
  vista,
  abrible,
  sangrada,
  sub,
  onAbrir,
  onMarcar,
}: {
  contenido: ContenidoDeCurso;
  /** Solo en lecciones: la portada que subió el entrenador. */
  thumbURL?: string;
  numero: string;
  bloqueada: boolean;
  diasQueFaltan: number;
  activa: boolean;
  vista: boolean;
  abrible: boolean;
  sangrada?: boolean;
  sub?: string;
  onAbrir: () => void;
  onMarcar: () => void;
}) {
  const esPdf = esEbook(contenido);
  return (
    <Pressable onPress={onAbrir}>
      <Card
        style={[
          styles.lessonRow,
          sangrada && styles.lessonRowMini,
          activa && styles.lessonRowActive,
          bloqueada && styles.lessonRowLocked,
        ]}
      >
        <MiniaturaCurso
          contenido={contenido}
          thumbURL={thumbURL}
          tamano={sangrada ? 'mini' : 'fila'}
          bloqueada={bloqueada}
          vista={vista}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.lessonName,
              sangrada && styles.lessonNameMini,
              activa && { color: colors.primary },
              bloqueada && { color: colors.textFaint },
            ]}
            numberOfLines={2}
          >
            {numero}. {contenido.title || 'Sin título'}
          </Text>
          {bloqueada ? (
            <Text style={styles.lessonMeta}>
              Se desbloquea en {diasQueFaltan} día{diasQueFaltan === 1 ? '' : 's'}
            </Text>
          ) : !abrible ? (
            <Text style={styles.lessonMeta}>{sub ?? 'Pronto'}</Text>
          ) : sub ? (
            <Text style={styles.lessonMeta}>{sub}</Text>
          ) : esPdf ? (
            <Text style={styles.lessonMeta}>E-book</Text>
          ) : null}
        </View>
        {/* El check cierra la fila, no la abre: delante del vídeo competiría
            con el gesto de ver, que es a lo que se viene. */}
        {abrible && !bloqueada ? (
          <PressableScale
            haptic
            hitSlop={10}
            onPress={onMarcar}
            style={[styles.check, vista && styles.checkOn]}
          >
            <Ionicons
              name="checkmark"
              size={16}
              color={vista ? colors.onPrimary : colors.textFaint}
            />
          </PressableScale>
        ) : null}
      </Card>
    </Pressable>
  );
}

/**
 * El e-book, dentro de la app (iframe en web, WebView en nativo).
 *
 * `lleno` es la diferencia entre una MUESTRA y la LECTURA. Lleno ocupa todo lo
 * que le den —que es toda la pantalla menos la cabecera y el pie— y es como se
 * lee de verdad. Sin llenar es la portada del e-book de apoyo de una clase de
 * vídeo, con la página siguiendo por debajo.
 *
 * La dirección la compone lib/visorDeEbook.ts: allí se decide si la página se
 * encaja a lo ancho o entera, se quita la barra del navegador —que tapaba la
 * primera y la última línea, y lleva el botón de descargar— y se mete el
 * puente de Android, cuyo WebView no sabe pintar un PDF.
 */
function EmbeddedDoc({ url, lleno }: { url: string; lleno?: boolean }) {
  const { width, height } = useWindowDimensions();
  const src = enlaceDeLectura(url, Platform.OS, width, height);
  const altoMuestra = altoDeLaMuestra(height);
  if (Platform.OS === 'web') {
    const marco = React.createElement('iframe', {
      src,
      style: lleno
        ? { flex: 1, width: '100%', minHeight: 0, backgroundColor: '#000', border: 'none' }
        : {
            width: '100%',
            height: altoMuestra,
            backgroundColor: '#000',
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
          },
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    });
    // Llenando, el iframe necesita un padre con alto de verdad del que colgar:
    // un porcentaje sobre un padre sin medida no es una medida.
    return lleno ? <View style={styles.pdfLleno}>{marco}</View> : marco;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require('react-native-webview');
  return (
    <View style={lleno ? styles.pdfLleno : [styles.pdfNative, { height: altoMuestra }]}>
      <WebView
        source={{ uri: src }}
        // Un e-book de un curso es material de pago igual que el vídeo. Fuera
        // el menú de mantener pulsado (copiar, compartir, "abrir en...") y la
        // vista previa, que son las formas de sacarlo de la app sin descargarlo.
        allowsLinkPreview={false}
        suppressMenuItems={['copy', 'share', 'select', 'selectAll', 'lookup', 'translate']}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        // Para poder acercar con los dedos. Sin esto, en un móvil un PDF con
        // letra pequeña no hay manera de leerlo: se ve, pero no se lee.
        scalesPageToFit
        style={{ flex: 1, borderRadius: lleno ? 0 : radius.md }}
      />
    </View>
  );
}

/** El enlace que abre el e-book de apoyo a pantalla completa. */
function BotonLeerEntero({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.leerEntero} hitSlop={8}>
      <Ionicons name="expand-outline" size={14} color={colors.primary} />
      <Text style={styles.leerEnteroTexto}>Leer a pantalla completa</Text>
    </Pressable>
  );
}

/**
 * El e-book de apoyo, a pantalla completa.
 *
 * Mismo trato que el de la clase que ES un e-book: cabecera con el título y
 * salida, y debajo el documento y nada más. Un e-book no se lee en una ranura.
 */
function LectorAPantallaCompleta({
  url,
  titulo,
  visible,
  onCerrar,
}: {
  url: string;
  titulo?: string;
  visible: boolean;
  onCerrar: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar} transparent={false}>
      <View style={styles.repFondo}>
        <View style={styles.repCabecera}>
          <Pressable onPress={onCerrar} hitSlop={10} style={styles.repCerrar}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.repCabeceraTexto} numberOfLines={1}>
            {titulo || 'E-book'}
          </Text>
        </View>
        <EmbeddedDoc url={url} lleno />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  repFondo: { flex: 1, backgroundColor: colors.background },
  tapa: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  tapaTitulo: { ...typography.h2, color: colors.text, textAlign: 'center' },
  tapaTexto: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  repCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    // Sitio para la barra de estado: el reproductor ocupa la pantalla entera.
    paddingTop: Platform.OS === 'web' ? spacing.md : spacing.xl + spacing.sm,
    paddingBottom: spacing.sm,
  },
  repCerrar: { padding: 2 },
  repCabeceraTexto: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  avisoProteccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  avisoProteccionTexto: { ...typography.small, color: colors.textFaint, flex: 1, fontSize: 11 },
  // El contenido se centra y ya no lo estrangula un ancho de 860: el vídeo
  // manda y el texto de debajo se queda en su columna legible.
  repContenido: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  repVideo: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
  repTexto: { width: '100%', maxWidth: 860 },
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
  docPlaceholderLleno: { flex: 1, aspectRatio: undefined, borderRadius: 0, borderWidth: 0 },
  pdfBlock: { marginTop: spacing.md },
  pdfHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  pdfTitle: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  pdfNative: { borderRadius: radius.md, overflow: 'hidden' },
  /*
   * El documento, a pantalla completa. Sin esquinas redondeadas y sin margen a
   * propósito: un e-book con marco parece una tarjeta dentro de una pantalla, y
   * aquí no hay pantalla alrededor — el documento ES la pantalla. Cada píxel
   * que se le quita al marco es página que se lee.
   */
  pdfLleno: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  ebookPie: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    // Sitio para el gesto de volver de iOS, que vive en el borde de abajo.
    paddingBottom: Platform.OS === 'web' ? spacing.md : spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  ebookPieTexto: { ...typography.small, color: colors.textMuted, lineHeight: 19 },
  leerEntero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  leerEnteroTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
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
  // Sangrada y algo más apagada: se ve que cuelga de la lección de arriba sin
  // necesidad de una línea ni de un título de grupo.
  lessonRowMini: { marginLeft: spacing.lg, backgroundColor: colors.surfaceAlt },
  lessonRowActive: { borderColor: colors.primary },
  lessonRowLocked: { opacity: 0.6 },
  lessonName: { ...typography.body, color: colors.text, fontFamily: fonts.medium },
  lessonNameMini: { ...typography.small, color: colors.textMuted },
  lessonMeta: { ...typography.small, color: colors.textFaint, marginTop: 2 },
});
