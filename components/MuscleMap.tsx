import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BODY_BACK, BODY_FRONT, type BodyPart } from '../lib/bodyPaths';
import { colors, fonts, typography } from '../lib/theme';
import type { MuscleId } from '../lib/muscles';

const GREY = '#41464F'; // músculo sin trabajar
const SEPARATOR = '#15171C'; // separación entre músculos (sobre fondo negro)

/** slug del cuerpo anatómico → músculo de la app (y factor de aportación). */
const SLUG_TO_MUSCLE: Record<string, { m: MuscleId; f: number }> = {
  chest: { m: 'chest', f: 1 },
  deltoids: { m: 'shoulders', f: 1 },
  biceps: { m: 'biceps', f: 1 },
  triceps: { m: 'triceps', f: 1 },
  forearm: { m: 'forearms', f: 1 },
  abs: { m: 'abs', f: 1 },
  obliques: { m: 'abs', f: 0.7 },
  trapezius: { m: 'traps', f: 1 },
  'upper-back': { m: 'lats', f: 1 },
  'lower-back': { m: 'lowerBack', f: 1 },
  gluteal: { m: 'glutes', f: 1 },
  quadriceps: { m: 'quads', f: 1 },
  adductors: { m: 'quads', f: 0.5 },
  hamstring: { m: 'hamstrings', f: 1 },
  calves: { m: 'calves', f: 1 },
  tibialis: { m: 'calves', f: 0.6 },
};

/** Interpola gris → rojo intenso según la intensidad 0..1. */
function fillFor(v: number): string {
  if (v <= 0.04) return GREY;
  // De rojo oscuro (#6E1C15) a rojo intenso (#F0392C).
  const lo = [0x6e, 0x1c, 0x15];
  const hi = [0xf0, 0x39, 0x2c];
  const t = Math.min(1, v);
  const c = lo.map((l, i) => Math.round(l + (hi[i] - l) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function pathsOf(part: BodyPart): string[] {
  return [...(part.path.common ?? []), ...(part.path.left ?? []), ...(part.path.right ?? [])];
}

function BodySvg({
  parts,
  viewBox,
  intensity,
}: {
  parts: BodyPart[];
  viewBox: string;
  intensity: Record<MuscleId, number>;
}) {
  return (
    <Svg width={150} height={300} viewBox={viewBox}>
      {parts.map((part, idx) => {
        const map = SLUG_TO_MUSCLE[part.slug];
        const v = map ? (intensity[map.m] ?? 0) * map.f : 0;
        const fill = fillFor(v);
        return pathsOf(part).map((d, i) => (
          <Path key={`${idx}-${i}`} d={d} fill={fill} stroke={SEPARATOR} strokeWidth={1} />
        ));
      })}
    </Svg>
  );
}

/** Cuerpo anatómico (delante + detrás) coloreado según lo trabajado. */
export function MuscleMap({
  intensity,
  hasData,
}: {
  intensity: Record<MuscleId, number>;
  hasData: boolean;
}) {
  return (
    <View>
      <View style={styles.bodies}>
        <View style={styles.bodyWrap}>
          <BodySvg parts={BODY_FRONT} viewBox="0 0 724 1448" intensity={intensity} />
          <Text style={styles.bodyLabel}>Delante</Text>
        </View>
        <View style={styles.bodyWrap}>
          <BodySvg parts={BODY_BACK} viewBox="724 0 724 1448" intensity={intensity} />
          <Text style={styles.bodyLabel}>Detrás</Text>
        </View>
      </View>
      <View style={styles.scaleRow}>
        <Text style={styles.scaleText}>Menos</Text>
        <View style={styles.scaleBar}>
          {[0.15, 0.4, 0.65, 0.85, 1].map((v) => (
            <View key={v} style={[styles.scaleCell, { backgroundColor: fillFor(v) }]} />
          ))}
        </View>
        <Text style={styles.scaleText}>Más</Text>
      </View>
      {!hasData ? (
        <Text style={styles.noData}>Entrena y marca tus series para ver qué músculos trabajas.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bodies: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  bodyWrap: { alignItems: 'center' },
  bodyLabel: { ...typography.small, color: colors.textMuted, fontSize: 11, marginTop: 2 },
  scaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  scaleText: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  scaleBar: { flexDirection: 'row', borderRadius: 4, overflow: 'hidden' },
  scaleCell: { width: 22, height: 8 },
  noData: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 10,
    fontFamily: fonts.body,
  },
});
