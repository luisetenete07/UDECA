import React from 'react';
import { frase } from '../lib/idioma';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';
import type { BlockAlert, BlockView } from '../lib/blockView';

/**
 * El bloque de un vistazo: volumen por grupo, semana a semana, con lo previsto
 * al lado de lo hecho, la frecuencia debajo y los avisos arriba.
 *
 * El orden es a propósito, de menos a más esfuerzo de lectura: primero el
 * titular (cumplimiento y lo que hay que mirar), después la tabla que responde
 * a las tres preguntas de golpe —volumen en las celdas, equilibrio en las
 * filas, frecuencia en la última— y el detalle por ejercicio a un toque, sin
 * ocupar sitio hasta que se pide.
 *
 * La primera columna y la de totales NO se desplazan: una cifra sin su fila
 * delante no dice nada, y es justo lo que pasa al arrastrar una tabla en un
 * móvil.
 */

const FILA = 34;
const CABECERA = 24;
// Anchos ajustados para que cuatro semanas quepan enteras en un móvil estrecho
// con la tarjeta y sus márgenes. A partir de cinco, la tabla se desplaza.
/*
 * 48 y no 56: en un móvil de 390 el ancho útil de la tarjeta da para cuatro
 * columnas justas, y un mesociclo típico son cuatro semanas. Con 56 la cuarta
 * se quedaba cortada por la mitad, que no se lee como "hay más a la derecha"
 * sino como que algo está roto.
 */
const ANCHO_SEMANA = 48;
const ANCHO_GRUPO = 76;
const ANCHO_TOTAL = 34;

function tonoDeCelda(done: number, planned: number | null) {
  if (planned == null) return styles.cellDone;
  if (done === 0 && planned > 0) return styles.cellZero;
  if (done < planned) return styles.cellUnder;
  if (done > planned) return styles.cellOver;
  return styles.cellDone;
}

/**
 * Una semana que aún no ha empezado enseña lo previsto y ya.
 *
 * Pintarle un "0/16" en rojo a la semana que viene es acusar a alguien de algo
 * que todavía no ha tenido ocasión de hacer, y convierte todo el bloque en un
 * muro de avisos falsos desde el primer lunes.
 */
function Celda({ done, planned, futura }: { done: number; planned: number | null; futura: boolean }) {
  if (futura) {
    return (
      <Text style={styles.cellText}>
        {planned != null ? <Text style={styles.cellFuture}>{planned}</Text> : <Text style={styles.cellPlan}>·</Text>}
      </Text>
    );
  }
  return (
    <Text style={styles.cellText}>
      <Text style={tonoDeCelda(done, planned)}>{done}</Text>
      {planned != null ? <Text style={styles.cellPlan}>/{planned}</Text> : null}
    </Text>
  );
}

function Aviso({ alert }: { alert: BlockAlert }) {
  const barra =
    alert.tone === 'bad'
      ? colors.danger
      : alert.tone === 'warn'
        ? colors.warning
        : colors.success;
  return (
    <View style={styles.alert}>
      <View style={[styles.alertBar, { backgroundColor: barra }]} />
      <View style={styles.alertBody}>
        <Text style={styles.alertTitle}>{alert.title}</Text>
        <Text style={styles.alertDetail}>{alert.detail}</Text>
      </View>
    </View>
  );
}

export function BlockOverview({
  view,
  title,
  subtitle,
  onPressDetail,
  detailLabel = 'Ver por ejercicio',
}: {
  view: BlockView;
  title: string;
  subtitle?: string;
  onPressDetail?: () => void;
  detailLabel?: string;
}) {
  const { weeks, rows, alerts, adherence, totalDone, totalPlanned, hasPlan, intensity } = view;

  if (rows.length === 0) {
    return (
      <View>
        <Text style={styles.label}>Volumen del bloque</Text>
        <Text style={styles.empty}>
          Todavía no hay entrenos ni rutina que medir. En cuanto el alumno entrene, aquí sale el
          reparto por grupo, semana a semana.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Volumen del bloque</Text>
          {/* Dos líneas: al lado del porcentaje de adherencia quedan 163
              píxeles y "Últimas 4 semanas" pide 194 a tamaño de titular. */}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {adherence != null ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{Math.round(adherence * 100)} %</Text>
          </View>
        ) : null}
      </View>

      {alerts.map((a) => (
        <Aviso key={a.id} alert={a} />
      ))}

      <View style={styles.table}>
        {/* Columna fija: los nombres de los grupos. */}
        <View>
          <View style={[styles.headCell, { width: ANCHO_GRUPO }]}>
            <Text style={styles.colHead}>Grupo</Text>
          </View>
          {rows.map((r) => (
            <View key={r.group} style={[styles.rowCell, { width: ANCHO_GRUPO }]}>
              <Text style={styles.groupName} numberOfLines={1}>
                {r.group}
              </Text>
            </View>
          ))}
          <View style={[styles.rowCell, styles.freqRow, { width: ANCHO_GRUPO }]}>
            <Text style={styles.freqLabel}>Entrenos</Text>
          </View>
        </View>

        {/* Semanas: lo único que se desplaza. */}
        <View style={{ flex: 1 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ minWidth: '100%' }}
        >
          <View>
            <View style={styles.line}>
              {weeks.map((w) => (
                <View key={w.start} style={[styles.headCell, { width: ANCHO_SEMANA }]}>
                  <Text style={[styles.colHead, w.isDeload && styles.colHeadDeload]}>
                    {w.label}
                    {w.isDeload ? '·D' : ''}
                  </Text>
                </View>
              ))}
            </View>

            {rows.map((r) => (
              <View key={r.group} style={styles.line}>
                {weeks.map((w, i) => (
                  <View key={w.start} style={[styles.rowCell, { width: ANCHO_SEMANA }]}>
                    <Celda done={r.done[i]} planned={r.planned[i]} futura={w.isFuture} />
                  </View>
                ))}
              </View>
            ))}

            <View style={[styles.line, styles.freqRow]}>
              {weeks.map((w) => (
                <View key={w.start} style={[styles.rowCell, { width: ANCHO_SEMANA }]}>
                  <Text style={styles.cellText}>
                    {w.isFuture ? (
                      <Text style={styles.cellFuture}>{w.sessionsPlanned ?? '·'}</Text>
                    ) : (
                      <>
                        <Text style={styles.freqValue}>{w.sessionsDone}</Text>
                        {w.sessionsPlanned != null ? (
                          <Text style={styles.cellPlan}>/{w.sessionsPlanned}</Text>
                        ) : null}
                      </>
                    )}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        {/* Un desvanecido en el canto derecho cuando hay más semanas de las
            que caben: es la única forma honesta de decir "sigue" sin escribir
            "desliza" en una tabla que ya va apretada. */}
        {weeks.length > 4 ? (
          <LinearGradient
            colors={['rgba(13,13,13,0)', colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.masALaDerecha}
            pointerEvents="none"
          />
        ) : null}
        </View>

        {/* Columna fija de totales: la que se mira al final. */}
        <View>
          <View style={[styles.headCell, styles.totalCol]}>
            <Text style={styles.colHead}>Σ</Text>
          </View>
          {rows.map((r) => (
            <View key={r.group} style={[styles.rowCell, styles.totalCol]}>
              <Text
                style={[
                  styles.totalText,
                  r.totalPlanned > 0 && r.totalDone === 0 && styles.cellZero,
                ]}
              >
                {r.totalDone}
              </Text>
            </View>
          ))}
          <View style={[styles.rowCell, styles.freqRow, styles.totalCol]}>
            <Text style={styles.freqValue}>
              {weeks.reduce((n, w) => n + w.sessionsDone, 0)}
            </Text>
          </View>
        </View>
      </View>

      {intensity.hasData ? (
        <View style={styles.intensity}>
          <Text style={styles.intensityLabel}>Intensidad · RIR reportado, y debajo el que pediste</Text>
          <View style={styles.intensityRow}>
            {weeks.map((w, i) => {
              const pedido = intensity.planned[i];
              const real = intensity.reported[i];
              // Se pasa de duro cuando entrena a más de un punto por debajo de
              // lo que se le pidió. Menos que eso es ruido, no una señal.
              const pasado = pedido != null && real != null && pedido - real >= 1;
              return (
                <View key={w.start} style={styles.intensityCell}>
                  <Text style={[styles.intensityValue, pasado && styles.intensityHot]}>
                    {real != null ? real.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '·'}
                  </Text>
                  <Text style={styles.intensityPlanned}>
                    {pedido != null
                      ? pedido.toLocaleString('es-ES', { maximumFractionDigits: 1 })
                      : '—'}
                  </Text>
                  <Text style={styles.intensityWeek}>{w.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <Text style={styles.footNote}>
        {hasPlan
          ? frase`Series hechas de previstas · ${totalDone} de ${totalPlanned} hasta hoy`
          : frase`Series hechas · ${totalDone} en el bloque. La rutina va a sensaciones, así que no hay previsión que comparar.`}
      </Text>

      {onPressDetail ? (
        <Pressable onPress={onPressDetail} style={styles.detailBtn}>
          <Text style={styles.detailText}>{detailLabel}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.primaryBright} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  label: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  title: { ...typography.h2, color: colors.text, marginTop: 2 },
  subtitle: { ...typography.small, color: colors.textMuted },
  empty: { ...typography.small, color: colors.textFaint, marginTop: spacing.xs },
  pill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  pillText: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    ...tabularNums,
  },

  alert: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  alertBar: { width: 3 },
  alertBody: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md - 2 },
  alertTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  alertDetail: { ...typography.small, color: colors.textMuted, marginTop: 1 },

  table: { flexDirection: 'row', marginTop: spacing.xs },
  line: { flexDirection: 'row' },
  headCell: {
    height: CABECERA,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineFaint,
    paddingBottom: 3,
  },
  rowCell: {
    height: FILA,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  masALaDerecha: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 22 },
  totalCol: { width: ANCHO_TOTAL, alignItems: 'flex-end' },
  colHead: {
    fontSize: 11,
    color: colors.textFaint,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.6,
  },
  colHeadDeload: { color: colors.primary },
  groupName: {
    ...typography.small,
    color: colors.text,
    alignSelf: 'flex-start',
    fontFamily: fonts.medium,
  },
  cellText: { ...typography.small, ...tabularNums },
  cellDone: { color: colors.text, fontFamily: fonts.semiBold },
  cellUnder: { color: colors.warning, fontFamily: fonts.semiBold },
  cellOver: { color: colors.primaryBright, fontFamily: fonts.semiBold },
  cellZero: { color: colors.danger, fontFamily: fonts.semiBold },
  cellPlan: { color: colors.textFaint },
  cellFuture: { color: colors.textFaint, fontFamily: fonts.medium },
  totalText: { ...typography.small, ...tabularNums, color: colors.text, fontFamily: fonts.semiBold },

  freqRow: { borderTopWidth: 1, borderTopColor: colors.hairlineFaint, borderBottomWidth: 0 },
  freqLabel: {
    ...typography.small,
    color: colors.textMuted,
    alignSelf: 'flex-start',
    fontSize: 12,
  },
  freqValue: { ...typography.small, ...tabularNums, color: colors.textMuted, fontFamily: fonts.semiBold },

  intensity: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  intensityLabel: { fontSize: 11, color: colors.textFaint, fontFamily: fonts.semiBold, letterSpacing: 0.5 },
  intensityRow: { flexDirection: 'row', gap: spacing.xs },
  intensityCell: { flex: 1, alignItems: 'center' },
  intensityValue: { ...typography.small, ...tabularNums, color: colors.text, fontFamily: fonts.semiBold },
  intensityHot: { color: colors.danger },
  intensityPlanned: { fontSize: 11, color: colors.textFaint, ...tabularNums },
  intensityWeek: { fontSize: 10, color: colors.textFaint, fontFamily: fonts.medium, marginTop: 1 },
  footNote: { ...typography.small, color: colors.textFaint, fontSize: 12 },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: 2,
  },
  detailText: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
});
