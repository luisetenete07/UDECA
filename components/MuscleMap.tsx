import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { colors, fonts, typography } from '../lib/theme';
import type { MuscleId } from '../lib/muscles';

const RED = '#E5322A';
const BASE = colors.surfaceAlt;
const STROKE = colors.border;

/** Opacidad del rojo según la carga (0 = casi transparente, 1 = rojo intenso). */
const op = (v: number) => (0.07 + Math.min(1, Math.max(0, v)) * 0.83).toFixed(3);

const SILHOUETTE =
  'M60 8 q9 0 9 14 q0 8 -3 12 q10 2 12 12 l3 26 q2 12 -2 16 l-4 4 q4 20 4 40 ' +
  'l-1 30 q6 26 4 60 q-1 22 -4 40 q-2 12 -8 12 q-5 0 -6 -12 l-4 -40 l-4 40 ' +
  'q-1 12 -6 12 q-6 0 -8 -12 q-3 -18 -4 -40 q-2 -34 4 -60 l-1 -30 q0 -20 4 -40 ' +
  'l-4 -4 q-4 -4 -2 -16 l3 -26 q2 -10 12 -12 q-3 -4 -3 -12 q0 -14 9 -14 z';

function Body({ intensity, side }: { intensity: Record<MuscleId, number>; side: 'front' | 'back' }) {
  const v = (m: MuscleId) => intensity[m] ?? 0;
  return (
    <Svg width={130} height={330} viewBox="0 0 120 320">
      <Path d={SILHOUETTE} fill={BASE} stroke={STROKE} strokeWidth={1} />
      {side === 'front' ? (
        <>
          <Ellipse cx={34} cy={60} rx={13} ry={10} fill={RED} fillOpacity={op(v('shoulders'))} />
          <Ellipse cx={86} cy={60} rx={13} ry={10} fill={RED} fillOpacity={op(v('shoulders'))} />
          <Ellipse cx={50} cy={76} rx={11} ry={10} fill={RED} fillOpacity={op(v('chest'))} />
          <Ellipse cx={70} cy={76} rx={11} ry={10} fill={RED} fillOpacity={op(v('chest'))} />
          <Ellipse cx={26} cy={92} rx={7} ry={18} fill={RED} fillOpacity={op(v('biceps'))} />
          <Ellipse cx={94} cy={92} rx={7} ry={18} fill={RED} fillOpacity={op(v('biceps'))} />
          <Ellipse cx={21} cy={126} rx={6} ry={18} fill={RED} fillOpacity={op(v('forearms'))} />
          <Ellipse cx={99} cy={126} rx={6} ry={18} fill={RED} fillOpacity={op(v('forearms'))} />
          <Ellipse cx={60} cy={112} rx={12} ry={26} fill={RED} fillOpacity={op(v('abs'))} />
          <Ellipse cx={49} cy={192} rx={11} ry={38} fill={RED} fillOpacity={op(v('quads'))} />
          <Ellipse cx={71} cy={192} rx={11} ry={38} fill={RED} fillOpacity={op(v('quads'))} />
          <Ellipse cx={49} cy={262} rx={8} ry={24} fill={RED} fillOpacity={op(v('calves'))} />
          <Ellipse cx={71} cy={262} rx={8} ry={24} fill={RED} fillOpacity={op(v('calves'))} />
        </>
      ) : (
        <>
          <Ellipse cx={34} cy={60} rx={13} ry={10} fill={RED} fillOpacity={op(v('shoulders'))} />
          <Ellipse cx={86} cy={60} rx={13} ry={10} fill={RED} fillOpacity={op(v('shoulders'))} />
          <Path d="M50 52 L70 52 L64 78 L56 78 Z" fill={RED} fillOpacity={op(v('traps'))} />
          <Ellipse cx={26} cy={92} rx={7} ry={18} fill={RED} fillOpacity={op(v('triceps'))} />
          <Ellipse cx={94} cy={92} rx={7} ry={18} fill={RED} fillOpacity={op(v('triceps'))} />
          <Path d="M44 88 q-6 20 5 34 l11 0 0 -40 q-9 0 -16 6 z" fill={RED} fillOpacity={op(v('lats'))} />
          <Path d="M76 88 q6 20 -5 34 l-11 0 0 -40 q9 0 16 6 z" fill={RED} fillOpacity={op(v('lats'))} />
          <Ellipse cx={60} cy={140} rx={12} ry={16} fill={RED} fillOpacity={op(v('lowerBack'))} />
          <Ellipse cx={51} cy={175} rx={11} ry={14} fill={RED} fillOpacity={op(v('glutes'))} />
          <Ellipse cx={69} cy={175} rx={11} ry={14} fill={RED} fillOpacity={op(v('glutes'))} />
          <Ellipse cx={49} cy={222} rx={11} ry={32} fill={RED} fillOpacity={op(v('hamstrings'))} />
          <Ellipse cx={71} cy={222} rx={11} ry={32} fill={RED} fillOpacity={op(v('hamstrings'))} />
          <Ellipse cx={49} cy={280} rx={8} ry={24} fill={RED} fillOpacity={op(v('calves'))} />
          <Ellipse cx={71} cy={280} rx={8} ry={24} fill={RED} fillOpacity={op(v('calves'))} />
        </>
      )}
    </Svg>
  );
}

/** Cuerpo delante + detrás con las zonas coloreadas según lo trabajado. */
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
          <Body intensity={intensity} side="front" />
          <Text style={styles.bodyLabel}>Delante</Text>
        </View>
        <View style={styles.bodyWrap}>
          <Body intensity={intensity} side="back" />
          <Text style={styles.bodyLabel}>Detrás</Text>
        </View>
      </View>
      <View style={styles.scaleRow}>
        <Text style={styles.scaleText}>Menos</Text>
        <View style={styles.scaleBar}>
          {[0.12, 0.3, 0.5, 0.7, 0.9].map((o) => (
            <View key={o} style={[styles.scaleCell, { backgroundColor: RED, opacity: o }]} />
          ))}
        </View>
        <Text style={styles.scaleText}>Más</Text>
      </View>
      {!hasData ? (
        <Text style={styles.noData}>
          Entrena y marca tus series para ver qué músculos trabajas.
        </Text>
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
