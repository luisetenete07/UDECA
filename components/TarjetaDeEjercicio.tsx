import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { CardButton } from './CardButton';
import { useMiniaturaDeVimeo } from './MiniaturaCurso';
import { miniaturaDelEnlace } from '../lib/video';
import { musculosPrincipales } from '../lib/muscles';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import { MEASURE_SHORT, type Exercise, type ExerciseMeasure } from '../lib/types';

/** Cómo se mide, en un icono: lo que distingue una dominada de un front lever. */
export const ICONO_DE_MEDIDA: Record<ExerciseMeasure, React.ComponentProps<typeof Ionicons>['name']> = {
  reps: 'barbell-outline',
  seconds: 'timer-outline',
  combo: 'flash-outline',
  repsDual: 'swap-horizontal',
  secondsDual: 'hourglass-outline',
};

/**
 * Un ejercicio de la biblioteca del coach.
 *
 * ERA UNA FILA DE TEXTO REPETIDA: nombre, categoría y "Vídeo". Cien iguales.
 * Ahora cada uno tiene cara —la miniatura de su vídeo, o el color de su
 * categoría con el icono de cómo se mide— y dice lo que se busca al planificar:
 * qué músculos trabaja y cómo se anota. El que no tiene vídeo se ve de lejos,
 * que es lo que el coach necesita para completar su biblioteca.
 */
export function TarjetaDeEjercicio({
  ejercicio,
  color,
  conSubgrupo = true,
  onPress,
}: {
  ejercicio: Exercise;
  /** El color de su categoría. */
  color: string;
  /** Sin él cuando la lista ya va agrupada por subgrupo: no se repite. */
  conSubgrupo?: boolean;
  onPress: () => void;
}) {
  const medida = ejercicio.measure ?? 'reps';
  const deVimeo = useMiniaturaDeVimeo(ejercicio.videoUrl);
  const imagen = miniaturaDelEnlace(ejercicio.videoUrl, 'mq') ?? deVimeo;
  const musculos = musculosPrincipales(ejercicio);
  const meta = [conSubgrupo ? ejercicio.subgroup : undefined, MEASURE_SHORT[medida]]
    .filter(Boolean)
    .join(' · ');

  return (
    <CardButton onPress={onPress} style={styles.tarjeta}>
      <View style={[styles.miniatura, { backgroundColor: `${color}1F` }]}>
        {imagen ? (
          <>
            <Image source={{ uri: imagen }} style={styles.imagen} resizeMode="cover" />
            <View style={styles.play}>
              <Ionicons name="play" size={12} color={colors.text} style={{ marginLeft: 2 }} />
            </View>
          </>
        ) : ejercicio.videoUrl ? (
          // Vídeo propio (o de Vimeo aún sin portada): hay vídeo, no hay imagen.
          <Ionicons name="play-circle-outline" size={24} color={color} />
        ) : (
          <>
            <Ionicons name={ICONO_DE_MEDIDA[medida]} size={20} color={color} />
            <Text style={styles.sinVideo}>Sin vídeo</Text>
          </>
        )}
        {/* El filo de abajo, del color de su categoría: con miniatura o sin ella,
            se sigue leyendo a qué grupo pertenece. */}
        <View style={[styles.filo, { backgroundColor: color }]} />
      </View>

      <View style={styles.cuerpo}>
        <Text style={styles.nombre} numberOfLines={1}>
          {ejercicio.name}
        </Text>
        <View style={styles.metaFila}>
          <Ionicons name={ICONO_DE_MEDIDA[medida]} size={12} color={colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {musculos.length > 0 ? (
          <Text style={styles.musculos} numberOfLines={1}>
            {musculos.join(' · ')}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </CardButton>
  );
}

const styles = StyleSheet.create({
  // La separación entre tarjetas la pone la rejilla, no la tarjeta.
  tarjeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingLeft: spacing.sm + 2,
  },
  // 16:9, la forma de un vídeo: la miniatura de YouTube entra sin recortes.
  miniatura: {
    width: 96,
    height: 54,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  imagen: { ...StyleSheet.absoluteFill },
  play: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sinVideo: { ...typography.small, color: colors.textFaint, fontSize: 10, lineHeight: 12 },
  filo: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  cuerpo: { flex: 1, minWidth: 0, gap: 2 },
  nombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, fontSize: 16 },
  metaFila: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { ...typography.small, color: colors.textMuted, flexShrink: 1 },
  musculos: { ...typography.small, color: colors.textFaint, fontSize: 12 },
});
