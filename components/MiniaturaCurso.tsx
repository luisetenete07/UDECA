import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, typography } from '../lib/theme';
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
 * Sin miniatura no se deja un hueco gris: se pinta el icono de lo que hay
 * dentro (vídeo o documento), que al menos dice qué es.
 */

export function MiniaturaCurso({
  contenido,
  tamano = 'fila',
  bloqueada,
  vista,
  style,
}: {
  contenido: ContenidoDeCurso;
  /** `fila` para listas; `ancha` para la portada de una lección abierta. */
  tamano?: 'fila' | 'ancha' | 'mini';
  bloqueada?: boolean;
  vista?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const esPdf = contenido.kind === 'pdf' || (!contenido.videoUrl && !!contenido.pdfUrl);
  const medida =
    tamano === 'ancha' ? styles.ancha : tamano === 'mini' ? styles.mini : styles.fila;

  return (
    <View style={[styles.base, medida, style]}>
      {contenido.thumbURL ? (
        <Image source={{ uri: contenido.thumbURL }} style={styles.imagen} resizeMode="cover" />
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
