import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, typography } from '../lib/theme';
import { miniaturaDelEnlace, parseVimeoUrl, urlDeOEmbedVimeo } from '../lib/video';
import type { ContenidoDeCurso } from '../lib/types';

/**
 * La miniatura de una lección o de una mini clase, con su duración encima.
 *
 * La duración va SOBRE la imagen y no debajo por la misma razón que en
 * cualquier reproductor de vídeo: es lo que decide si algo se abre ahora o
 * luego, y en una lista de veinte lecciones esa decisión se toma de un
 * vistazo. Puesta en una línea aparte se lee después de haber decidido, que es
 * cuando ya no sirve.
 *
 * DE DÓNDE SALE LA IMAGEN, EN ESTE ORDEN
 *
 *  1. La que subió el entrenador, si es una lección. Solo las lecciones pueden
 *     llevar una propia (ver lib/types.ts).
 *  2. La de la plataforma del enlace: la de YouTube se deduce de la dirección
 *     y la de Vimeo hay que preguntársela.
 *  3. Nada: se pinta el icono de lo que hay dentro, que al menos dice qué es.
 */

/**
 * Miniaturas de Vimeo ya preguntadas.
 *
 * Una lista de curso repinta la misma miniatura cada vez que se desplaza, y
 * sin esto sería una petición a Vimeo por repintado. El mapa vive fuera del
 * componente a propósito: es de la app, no de una pantalla.
 */
const vimeoCache = new Map<string, string | null>();

function useMiniaturaDeVimeo(url: string | undefined): string | null {
  const ref = url ? parseVimeoUrl(url) : null;
  const clave = ref ? `${ref.id}:${ref.hash ?? ''}` : null;
  const [imagen, setImagen] = useState<string | null>(() =>
    clave ? (vimeoCache.get(clave) ?? null) : null
  );

  useEffect(() => {
    if (!ref || !clave) return;
    if (vimeoCache.has(clave)) {
      setImagen(vimeoCache.get(clave) ?? null);
      return;
    }
    let vivo = true;
    fetch(urlDeOEmbedVimeo(ref))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const encontrada = typeof j?.thumbnail_url === 'string' ? j.thumbnail_url : null;
        // Se guarda también el "no hay": un vídeo privado o borrado contestaría
        // que no en cada repintado, y preguntarlo mil veces no lo arregla.
        vimeoCache.set(clave, encontrada);
        if (vivo) setImagen(encontrada);
      })
      .catch(() => {
        vimeoCache.set(clave, null);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return imagen;
}

export function MiniaturaCurso({
  contenido,
  thumbURL,
  tamano = 'fila',
  bloqueada,
  vista,
  style,
}: {
  contenido: ContenidoDeCurso;
  /** La subida por el entrenador. Solo la tienen las lecciones. */
  thumbURL?: string;
  /** `fila` para listas; `ancha` para la portada de una lección abierta. */
  tamano?: 'fila' | 'ancha' | 'mini';
  bloqueada?: boolean;
  vista?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const esPdf = contenido.kind === 'pdf' || (!contenido.videoUrl && !!contenido.pdfUrl);
  const deVimeo = useMiniaturaDeVimeo(esPdf ? undefined : contenido.videoUrl);
  const imagen = thumbURL ?? miniaturaDelEnlace(contenido.videoUrl) ?? deVimeo;
  const medida =
    tamano === 'ancha' ? styles.ancha : tamano === 'mini' ? styles.mini : styles.fila;

  return (
    <View style={[styles.base, medida, style]}>
      {imagen ? (
        <Image source={{ uri: imagen }} style={styles.imagen} resizeMode="cover" />
      ) : (
        <View style={styles.vacia}>
          <Ionicons
            name={esPdf ? 'document-text-outline' : 'play-circle-outline'}
            size={tamano === 'ancha' ? 32 : tamano === 'mini' ? 16 : 22}
            color={colors.textFaint}
          />
        </View>
      )}

      {/* Con candado, la imagen se apaga: se ve que existe y que aún no toca. */}
      {bloqueada ? (
        <View style={styles.velo}>
          <Ionicons name="lock-closed" size={tamano === 'mini' ? 12 : 16} color={colors.textMuted} />
        </View>
      ) : null}

      {vista && !bloqueada ? (
        <View style={styles.visto}>
          <Ionicons name="checkmark" size={11} color={colors.onPrimary} />
        </View>
      ) : null}

      {contenido.durationLabel ? (
        <View style={[styles.duracion, tamano === 'mini' && styles.duracionMini]}>
          <Text style={[styles.duracionTexto, tamano === 'mini' && styles.duracionTextoMini]}>
            {contenido.durationLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // 16:9 en los tres tamaños: es la forma de un vídeo, y cambiarla según el
  // sitio haría que la misma miniatura se recortara distinto en cada pantalla.
  fila: { width: 108, height: 61 },
  mini: { width: 76, height: 43 },
  ancha: { width: '100%', aspectRatio: 16 / 9 },
  imagen: { width: '100%', height: '100%' },
  vacia: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  velo: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  visto: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duracion: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.scrim,
  },
  duracionMini: { right: 3, bottom: 3, paddingHorizontal: 4, paddingVertical: 1 },
  duracionTexto: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  duracionTextoMini: { fontSize: 9, lineHeight: 12 },
});
