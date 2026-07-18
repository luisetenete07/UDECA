import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Line, Path } from 'react-native-svg';
import { colors, fonts, typography } from '../lib/theme';
import type { MuscleId } from '../lib/muscles';

const RED = '#E8322A';
const BASE = '#1B1E25';
const EDGE = '#3d424e';

const op = (v: number) => (0.05 + Math.min(1, Math.max(0, v)) * 0.9).toFixed(3);

/** Cápsula gris (hueso/miembro del cuerpo base) entre dos puntos. */
function Cap({ x1, y1, x2, y2, r }: { x1: number; y1: number; x2: number; y2: number; r: number }) {
  return <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={BASE} strokeWidth={r * 2} strokeLinecap="round" />;
}

function M({ d, v }: { d: string; v: number }) {
  return <Path d={d} fill={RED} fillOpacity={Number(op(v))} stroke={EDGE} strokeWidth={0.4} />;
}
/** Músculo simétrico: se dibuja a la derecha y se refleja a la izquierda (x=100). */
function Pair({ d, v }: { d: string; v: number }) {
  return (
    <>
      <M d={d} v={v} />
      <G transform="translate(200,0) scale(-1,1)">
        <M d={d} v={v} />
      </G>
    </>
  );
}

function Base() {
  return (
    <>
      <Ellipse cx={100} cy={40} rx={21} ry={25} fill={BASE} />
      <Cap x1={100} y1={60} x2={100} y2={80} r={11} />
      <Path
        d="M60 84 Q100 74 140 84 Q150 130 134 168 Q130 205 126 214 L74 214 Q70 205 66 168 Q50 130 60 84 Z"
        fill={BASE}
      />
      <Path d="M70 210 Q100 218 130 210 Q134 240 128 262 L72 262 Q66 240 70 210 Z" fill={BASE} />
      <Cap x1={140} y1={92} x2={150} y2={168} r={12} />
      <Cap x1={150} y1={168} x2={156} y2={238} r={9} />
      <Cap x1={60} y1={92} x2={50} y2={168} r={12} />
      <Cap x1={50} y1={168} x2={44} y2={238} r={9} />
      <Cap x1={118} y1={258} x2={122} y2={356} r={17} />
      <Cap x1={122} y1={356} x2={118} y2={442} r={12} />
      <Cap x1={82} y1={258} x2={78} y2={356} r={17} />
      <Cap x1={78} y1={356} x2={82} y2={442} r={12} />
      <Ellipse cx={116} cy={450} rx={10} ry={6} fill={BASE} />
      <Ellipse cx={84} cy={450} rx={10} ry={6} fill={BASE} />
    </>
  );
}

function FrontMuscles({ i }: { i: Record<MuscleId, number> }) {
  return (
    <>
      <Pair d="M120 86 q18 -2 22 12 q3 10 -4 15 q-10 5 -18 -3 q-6 -8 -4 -18 q1 -5 4 -6 z" v={i.shoulders} />
      <M d="M100 96 q22 -6 34 4 q6 6 3 15 q-4 10 -18 12 q-14 2 -19 -6 z" v={i.chest} />
      <Pair d="M100 96 q22 -6 34 4 q6 6 3 15 q-4 10 -18 12 q-14 2 -19 -6 z" v={i.chest} />
      <Pair d="M142 116 q9 6 9 24 q0 16 -6 26 q-7 -4 -9 -22 q-2 -18 6 -28 z" v={i.biceps} />
      <Pair d="M150 172 q7 8 6 30 q-1 18 -8 32 q-6 -8 -7 -30 q-1 -22 9 -32 z" v={i.forearms} />
      <M d="M85 120 q15 -4 30 0 q4 1 4 6 v78 q0 6 -6 8 l-13 5 -13 -5 q-6 -2 -6 -8 v-78 q0 -5 4 -6 z" v={i.abs} />
      <Line x1={100} y1={128} x2={100} y2={216} stroke={colors.surface} strokeOpacity={0.55} strokeWidth={1} />
      <Line x1={85} y1={150} x2={115} y2={150} stroke={colors.surface} strokeOpacity={0.55} strokeWidth={1} />
      <Line x1={84} y1={170} x2={116} y2={170} stroke={colors.surface} strokeOpacity={0.55} strokeWidth={1} />
      <Line x1={83} y1={192} x2={117} y2={192} stroke={colors.surface} strokeOpacity={0.55} strokeWidth={1} />
      <Pair d="M116 132 q9 4 10 26 q1 22 -6 40 q-8 -6 -9 -30 q-1 -24 5 -36 z" v={i.abs * 0.7} />
      <Pair d="M116 214 q14 6 16 40 q2 40 -10 66 q-9 -10 -12 -46 q-3 -40 6 -60 z" v={i.quads} />
      <Pair d="M116 348 q9 8 10 34 q1 26 -8 44 q-8 -12 -9 -40 q-1 -28 7 -38 z" v={i.calves} />
    </>
  );
}

function BackMuscles({ i }: { i: Record<MuscleId, number> }) {
  return (
    <>
      <M d="M74 86 q26 -8 52 0 q-4 20 -14 30 l-12 8 -12 -8 q-10 -10 -14 -30 z" v={i.traps} />
      <Pair d="M120 86 q18 -2 22 12 q3 10 -4 15 q-10 5 -18 -3 q-6 -8 -4 -18 q1 -5 4 -6 z" v={i.shoulders} />
      <Pair d="M142 116 q9 6 9 26 q0 16 -6 26 q-7 -4 -9 -22 q-2 -20 6 -30 z" v={i.triceps} />
      <Pair d="M118 84 q8 8 9 20 q1 8 -2 14 q-14 6 -25 4 q-2 -18 4 -30 q6 -8 14 -8 z" v={i.lats * 0.7} />
      <Pair d="M100 120 q22 4 30 26 q6 18 0 40 l-30 8 v-74 z" v={i.lats} />
      <M d="M86 150 q14 -3 28 0 v52 q0 5 -8 7 l-6 2 -6 -2 q-8 -2 -8 -7 z" v={i.lowerBack} />
      <Pair d="M100 210 q16 0 20 22 q3 18 -8 30 q-12 6 -18 -8 q-6 -18 -2 -34 q2 -10 8 -10 z" v={i.glutes} />
      <Pair d="M116 244 q14 8 15 42 q1 34 -10 58 q-9 -12 -11 -50 q-2 -40 6 -50 z" v={i.hamstrings} />
      <Pair d="M116 350 q10 8 11 36 q1 26 -8 46 q-9 -12 -10 -42 q-1 -30 7 -40 z" v={i.calves} />
    </>
  );
}

/** Cuerpo anatómico delante + detrás, coloreado según lo trabajado. */
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
          <Svg width={150} height={360} viewBox="0 0 200 480">
            <Base />
            <FrontMuscles i={intensity} />
          </Svg>
          <Text style={styles.bodyLabel}>Delante</Text>
        </View>
        <View style={styles.bodyWrap}>
          <Svg width={150} height={360} viewBox="0 0 200 480">
            <Base />
            <BackMuscles i={intensity} />
          </Svg>
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
        <Text style={styles.noData}>Entrena y marca tus series para ver qué músculos trabajas.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bodies: { flexDirection: 'row', justifyContent: 'center', gap: 4, flexWrap: 'wrap' },
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
