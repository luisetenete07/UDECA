import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Card } from './Card';
import { inicioDelDia, masDias } from '../lib/fechas';
import { frase } from '../lib/idioma';
import { getDiasDeRutinaDiaria, getRutinaDiaria } from '../lib/firestore/rutinaDiaria';
import {
  resumenDeSeries,
  seriesDiariasPorDia,
  seriesGtgPorDia,
  type DiaDeSeries,
} from '../lib/historialGtg';
import { hayRutinaDiaria, NOMBRE_POR_DEFECTO } from '../lib/rutinaDiaria';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';
import { WEEKDAY_LABELS, weekdayOf } from '../lib/types';
import type { DiaDeRutinaDiaria, Routine, RutinaDiaria, WorkoutLog } from '../lib/types';

/** Días que se enseñan: dos semanas caben en una fila de móvil sin apretarse. */
const DIAS = 14;

/**
 * Las series del grease the groove, día a día: lo mismo en el Progreso del
 * alumno y en la ficha que ve su entrenador.
 *
 * Una barra por día. Llena en dorado si se llegó a lo que se buscaba, más
 * tenue si se quedó a medias, y un punto si ese día no hubo nada. Debajo, la
 * semana en una línea. Es lo que se viene a mirar —¿lo estoy haciendo?— y nada
 * más: el detalle serie a serie está en el historial.
 *
 * Solo sale lo que existe: el día GTG del plan si el plan lo tiene (o hubo
 * series), y la rutina diaria si está puesta (o se marcó algo).
 */
export function SeriesDelGtg({
  clientId,
  trainerId,
  workoutLogs,
  routine,
}: {
  clientId: string;
  /** Solo desde la cuenta del entrenador: sus reglas le dejan leer lo de SU alumno. */
  trainerId?: string;
  workoutLogs: WorkoutLog[];
  routine: Routine | null | undefined;
}) {
  const [rutina, setRutina] = useState<RutinaDiaria | null>(null);
  const [diasDiaria, setDiasDiaria] = useState<DiaDeRutinaDiaria[]>([]);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      const desde = masDias(inicioDelDia(Date.now()), -(DIAS - 1));
      Promise.all([
        getRutinaDiaria(clientId).catch(() => null),
        getDiasDeRutinaDiaria(clientId, desde, trainerId).catch(() => []),
      ]).then(([r, d]) => {
        if (!vivo) return;
        setRutina(r);
        setDiasDiaria(d);
      });
      return () => {
        vivo = false;
      };
    }, [clientId, trainerId])
  );

  const delPlan = seriesGtgPorDia(workoutLogs, routine, DIAS);
  const planTieneGtg = routine?.schedule === 'gtg' || !!routine?.days.some((d) => d.gtg);
  const diaria = seriesDiariasPorDia(diasDiaria, rutina, DIAS);
  const verPlan = planTieneGtg || delPlan.some((d) => d.hechas > 0);
  const verDiaria = hayRutinaDiaria(rutina) || diaria.some((d) => d.hechas > 0);
  if (!verPlan && !verDiaria) return null;

  const nombreGtg = routine?.days.find((d) => d.gtg)?.name || 'Grease the groove';
  return (
    <>
      {verPlan ? <Barras titulo={nombreGtg} icono="repeat" dias={delPlan} unidad="series" /> : null}
      {/* En la rutina diaria también hay casillas sin series (dos minutos de
          movilidad): se cuentan como "hechas", no como series. */}
      {verDiaria ? (
        <Barras titulo={rutina?.nombre || NOMBRE_POR_DEFECTO} icono="repeat-outline" dias={diaria} unidad="hechas" />
      ) : null}
    </>
  );
}

function Barras({
  titulo,
  icono,
  dias,
  unidad,
}: {
  titulo: string;
  icono: React.ComponentProps<typeof Ionicons>['name'];
  dias: DiaDeSeries[];
  unidad: 'series' | 'hechas';
}) {
  const r = resumenDeSeries(dias);
  const tope = Math.max(1, ...dias.map((d) => Math.max(d.hechas, d.objetivo)));
  const hoy = inicioDelDia(Date.now());
  return (
    <Card style={styles.tarjeta}>
      {/* El nombre entero en su línea, y la cifra de la semana debajo: al lado
          no cabían los dos y el nombre se quedaba en "Dominadas s…". */}
      <View style={styles.cab}>
        <Ionicons name={icono} size={16} color={colors.primary} />
        <Text style={styles.titulo} numberOfLines={2}>
          {titulo}
        </Text>
      </View>
      <View style={styles.semana}>
        <Text style={styles.cifra}>{r.semana}</Text>
        <Text style={styles.cifraTexto}>
          {unidad === 'series'
            ? r.semana === 1
              ? 'serie en los últimos 7 días'
              : 'series en los últimos 7 días'
            : r.semana === 1
              ? 'hecha en los últimos 7 días'
              : 'hechas en los últimos 7 días'}
        </Text>
      </View>

      <View style={styles.barras}>
        {dias.map((d) => {
          const lleno = d.objetivo > 0 && d.hechas >= d.objetivo;
          const alto = d.hechas > 0 ? Math.max(6, Math.round((d.hechas / tope) * ALTO)) : 0;
          const esHoy = d.dia === hoy;
          return (
            <View key={d.dia} style={styles.columna}>
              <Text style={[styles.numero, d.hechas === 0 && styles.numeroVacio]}>
                {d.hechas > 0 ? d.hechas : ''}
              </Text>
              <View style={styles.hueco}>
                {d.hechas > 0 ? (
                  <View style={[styles.barra, { height: alto }, lleno ? styles.barraLlena : styles.barraMedia]} />
                ) : (
                  <View style={styles.punto} />
                )}
              </View>
              <Text style={[styles.dia, esHoy && styles.diaHoy]}>{WEEKDAY_LABELS[weekdayOf(d.dia)]}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.resumen}>
        {r.semana === 0
          ? 'Nada en los últimos 7 días.'
          : frase`${r.dias} de 7 días · objetivo cumplido ${r.cumplidos} · media ${String(r.media).replace('.', ',')} al día`}
      </Text>
      <View style={styles.leyenda}>
        <View style={[styles.muestra, styles.barraLlena]} />
        <Text style={styles.leyendaTexto}>Objetivo hecho</Text>
        <View style={[styles.muestra, styles.barraMedia]} />
        <Text style={styles.leyendaTexto}>A medias</Text>
      </View>
    </Card>
  );
}

const ALTO = 56;

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cab: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titulo: { ...typography.h3, color: colors.text, flex: 1, minWidth: 0 },
  semana: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: spacing.xs },
  cifra: { ...typography.h2, color: colors.primaryBright, ...tabularNums },
  cifraTexto: { ...typography.small, color: colors.textMuted },
  barras: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.md, gap: 3 },
  columna: { flex: 1, alignItems: 'center' },
  numero: { ...typography.small, fontSize: 10, color: colors.textMuted, height: 14, ...tabularNums },
  numeroVacio: { color: 'transparent' },
  hueco: { height: ALTO, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  barra: { width: '78%', maxWidth: 18, borderRadius: radius.sm },
  barraLlena: { backgroundColor: colors.primary },
  barraMedia: { backgroundColor: colors.primaryMuted, borderWidth: 1, borderColor: colors.primary },
  punto: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 1 },
  dia: { ...typography.small, fontSize: 10, color: colors.textFaint, marginTop: 4 },
  diaHoy: { color: colors.primary, fontFamily: fonts.semiBold },
  resumen: { ...typography.small, color: colors.textMuted, marginTop: spacing.md },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  muestra: { width: 10, height: 10, borderRadius: 3 },
  leyendaTexto: { ...typography.small, fontSize: 11, color: colors.textFaint, marginRight: spacing.sm },
});
