import React, { useMemo } from 'react';
import { frase } from '../lib/idioma';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from './ProgressBar';
import { bandasDelPlan, planCalendar, planSummary, type CalendarWeek, nombreDeCiclo } from '../lib/cyclePlan';
import { diaMes } from '../lib/fechas';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { TrainingCycle, WorkoutLog } from '../lib/types';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * El calendario del plan: una fila por semana, agrupadas por bloque, con los
 * días que el alumno entrenó y el cumplimiento de cada semana.
 *
 * Es la pantalla que convierte los ciclos en algo útil. Una lista de ciclos con
 * fechas no dice nada; ver catorce semanas seguidas y dónde se cayó el alumno
 * es lo que permite corregir a tiempo, que es para lo que se planifica.
 */
export function PlanCalendar({
  root,
  cycles,
  logs,
  onPressWeek,
  compact = false,
}: {
  root: TrainingCycle;
  cycles: TrainingCycle[];
  logs: WorkoutLog[];
  onPressWeek?: (week: CalendarWeek) => void;
  /** Solo la semana actual y las dos siguientes (para la ficha del alumno). */
  compact?: boolean;
}) {
  const { weeks, resumen, bandas } = useMemo(() => {
    const todas = planCalendar(root, cycles, logs);
    return { weeks: todas, resumen: planSummary(todas), bandas: bandasDelPlan(todas) };
  }, [root, cycles, logs]);

  const visibles = useMemo(() => {
    if (!compact) return weeks;
    const actual = weeks.findIndex((w) => w.isCurrent);
    const desde = actual < 0 ? 0 : Math.max(0, actual);
    return weeks.slice(desde, desde + 3);
  }, [weeks, compact]);

  return (
    <View>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.weekBig}>
            {resumen.week > 0 ? frase`Semana ${resumen.week}` : 'Sin empezar'}
            {resumen.totalWeeks ? <Text style={styles.weekOf}> de {resumen.totalWeeks}</Text> : null}
          </Text>
          <Text style={styles.headHint} numberOfLines={1}>
            {nombreDeCiclo(resumen.block ? resumen.block.name : root.name)}
            {resumen.isDeload ? ' · semana de descarga' : ''}
          </Text>
        </View>
        {resumen.adherence != null ? (
          <View style={styles.adherenceBox}>
            <Text style={styles.adherencePct}>{Math.round(resumen.adherence * 100)}%</Text>
            <Text style={styles.adherenceLabel}>
              {resumen.done}/{resumen.planned} entrenos
            </Text>
          </View>
        ) : null}
      </View>

      {resumen.adherence != null ? (
        <View style={{ marginBottom: spacing.md }}>
          <ProgressBar progress={resumen.adherence} height={6} />
        </View>
      ) : null}

      {/* La temporada entera de un vistazo. Va ANTES del detalle porque es la
          pregunta que uno se hace al abrir esto: en qué punto vamos. */}
      {!compact && bandas.length > 0 ? (
        <View style={styles.bandas}>
          {bandas.map((b) => (
            <View key={`${b.nombre}-${b.desde}`} style={styles.banda}>
              <View style={styles.bandaCabecera}>
                <Text style={styles.bandaNombre} numberOfLines={1}>
                  {b.nombre}
                </Text>
                <Text style={styles.bandaSemanas}>
                  {b.semanas} sem{b.semanas === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={styles.bandaCeldas}>
                {Array.from({ length: b.semanas }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.celda,
                      b.pasadas[i] && (b.hechas[i] ? styles.celdaHecha : styles.celdaFallada),
                      b.descargas[i] && styles.celdaDescarga,
                      i === b.actual && styles.celdaHoy,
                    ]}
                  >
                    <Text
                      style={[
                        styles.celdaTexto,
                        (b.pasadas[i] && b.hechas[i]) || i === b.actual
                          ? styles.celdaTextoFuerte
                          : null,
                      ]}
                    >
                      {b.desde + i}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          <View style={styles.leyenda}>
            <View style={[styles.celda, styles.celdaHecha, styles.celdaLeyenda]} />
            <Text style={styles.leyendaTexto}>cumplida</Text>
            <View style={[styles.celda, styles.celdaFallada, styles.celdaLeyenda]} />
            <Text style={styles.leyendaTexto}>fallada</Text>
            <View style={[styles.celda, styles.celdaDescarga, styles.celdaLeyenda]} />
            <Text style={styles.leyendaTexto}>descarga</Text>
          </View>
        </View>
      ) : null}

      {visibles.map((w, i) => {
        const nuevoBloque = w.blockStart || i === 0;
        const cumple = w.target ? w.done >= w.target : w.done > 0;
        const futura = !w.isPast && !w.isCurrent;
        const fila = (
          <View style={[styles.weekRow, w.isCurrent && styles.weekRowNow]}>
            <View style={[styles.band, w.isDeload && styles.bandDeload, w.isPast && styles.bandPast]} />
            <View style={styles.weekLabelBox}>
              <Text style={[styles.weekNum, w.isCurrent && styles.weekNumNow]}>S{w.index}</Text>
              <Text style={styles.weekDates}>{diaMes(w.start)}</Text>
            </View>

            <View style={styles.daysRow}>
              {w.days.map((hecho, d) => (
                <View key={d} style={styles.dayCell}>
                  <View
                    style={[
                      styles.dayDot,
                      hecho && styles.dayDotDone,
                      hecho && w.isDeload && styles.dayDotDeload,
                    ]}
                  />
                  <Text style={styles.dayLetter}>{WEEKDAYS[d]}</Text>
                </View>
              ))}
            </View>

            <View style={styles.countBox}>
              {/* Una semana que no ha empezado enseña lo previsto y ya: un
                  "0/4" en una semana futura acusa de algo que todavía no ha
                  tenido ocasión de pasar. */}
              <Text style={[styles.count, cumple && styles.countOk]}>
                {futura ? (
                  <Text style={styles.countTarget}>{w.target ?? '·'}</Text>
                ) : (
                  <>
                    {w.done}
                    {w.target ? <Text style={styles.countTarget}>/{w.target}</Text> : null}
                  </>
                )}
              </Text>
              {w.isDeload ? <Text style={styles.deloadTag}>descarga</Text> : null}
            </View>
          </View>
        );

        return (
          <View key={w.start}>
            {nuevoBloque && w.block ? (
              <View style={styles.blockHead}>
                <Text style={styles.blockName} numberOfLines={1}>
                  {nombreDeCiclo(w.block.name)}
                </Text>
                <Text style={styles.blockWeeks}>
                  {w.blockWeeks} sem{w.blockWeeks === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
            {onPressWeek && w.micro ? (
              <Pressable onPress={() => onPressWeek(w)}>{fila}</Pressable>
            ) : (
              fila
            )}
          </View>
        );
      })}

      {compact && weeks.length > visibles.length ? (
        <View style={styles.moreRow}>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textFaint} />
          <Text style={styles.moreText}>
            {weeks.length - visibles.length} semana
            {weeks.length - visibles.length === 1 ? '' : 's'} más en el plan
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  weekBig: { ...typography.h2, color: colors.text },
  weekOf: { ...typography.h3, color: colors.textMuted, fontFamily: fonts.medium },
  headHint: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  adherenceBox: { alignItems: 'flex-end' },
  adherencePct: { ...typography.h3, color: colors.primaryBright },
  adherenceLabel: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  bandas: { marginBottom: spacing.md, gap: spacing.sm },
  banda: { gap: 5 },
  bandaCabecera: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  bandaNombre: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    flex: 1,
  },
  bandaSemanas: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  bandaCeldas: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  celda: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celdaHecha: { backgroundColor: colors.primary, borderColor: colors.primary },
  // Una semana pasada sin cumplir no se pinta de rojo: no es un error, es un
  // dato. En rojo, un plan normal parecería un desastre.
  celdaFallada: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  celdaDescarga: { borderColor: colors.primaryBright, borderStyle: 'dashed' },
  celdaHoy: { borderColor: colors.accent, borderWidth: 2 },
  celdaTexto: { fontSize: 10, color: colors.textFaint, fontFamily: fonts.medium },
  celdaTextoFuerte: { color: colors.onPrimary },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  celdaLeyenda: { width: 12, height: 12 },
  leyendaTexto: { fontSize: 10, color: colors.textFaint, marginRight: spacing.sm },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  blockName: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    flex: 1,
  },
  blockWeeks: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    borderRadius: radius.md,
  },
  weekRowNow: { backgroundColor: colors.primaryMuted },
  band: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.primary },
  bandDeload: { backgroundColor: colors.textMuted },
  bandPast: { opacity: 0.45 },
  weekLabelBox: { width: 46 },
  weekNum: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  weekNumNow: { color: colors.primaryBright },
  weekDates: { fontSize: 10, color: colors.textFaint, fontFamily: fonts.medium },
  daysRow: { flexDirection: 'row', flex: 1, gap: 2 },
  dayCell: { flex: 1, alignItems: 'center', gap: 2 },
  dayDot: {
    width: 16,
    height: 16,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayDotDeload: { backgroundColor: colors.textMuted, borderColor: colors.textMuted },
  dayLetter: { fontSize: 9, color: colors.textFaint, fontFamily: fonts.medium },
  countBox: { width: 46, alignItems: 'flex-end' },
  count: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  countOk: { color: colors.primaryBright },
  countTarget: { color: colors.textFaint, fontFamily: fonts.medium },
  deloadTag: { fontSize: 9, color: colors.textFaint, fontFamily: fonts.medium },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  moreText: { ...typography.small, color: colors.textFaint },
});
