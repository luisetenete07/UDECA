import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { CollapsibleCard } from './CollapsibleCard';
import { frase } from '../lib/idioma';
import { computeAchievements } from '../lib/stats';
import { colors, fonts, spacing, typography } from '../lib/theme';
import type { WeightLog, WorkoutLog } from '../lib/types';

/**
 * Los logros del alumno, en Progreso.
 *
 * Vivían en el perfil, que es la pantalla de los ajustes y casi no se abre.
 * Un logro es progreso —el primer entreno, la racha de un mes, la primera
 * marca—, así que va donde se viene a mirar cómo se avanza. Plegado, dice
 * cuántos lleva; abierto, la parrilla entera.
 */
export function LogrosDelAlumno({
  workoutLogs,
  weightLogs,
}: {
  workoutLogs: WorkoutLog[];
  weightLogs: WeightLog[];
}) {
  const logros = useMemo(() => computeAchievements(workoutLogs, weightLogs), [workoutLogs, weightLogs]);
  const conseguidos = logros.filter((a) => a.unlocked).length;
  return (
    <CollapsibleCard
      id="alumno-logros"
      icon="ribbon-outline"
      title="Logros"
      hint={frase`${conseguidos} de ${logros.length}`}
      defaultOpen={false}
    >
      <View style={styles.parrilla}>
        {logros.map((a) => (
          <View key={a.id} style={styles.logro}>
            <View style={[styles.icono, a.unlocked ? styles.iconoSi : styles.iconoNo]}>
              <Ionicons
                name={a.icon as keyof typeof Ionicons.glyphMap}
                size={22}
                color={a.unlocked ? colors.primary : colors.textFaint}
              />
            </View>
            <Text style={[styles.titulo, !a.unlocked && styles.tituloNo]}>{a.title}</Text>
            <Text style={styles.descripcion}>{a.description}</Text>
          </View>
        ))}
      </View>
    </CollapsibleCard>
  );
}

const styles = StyleSheet.create({
  parrilla: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  logro: { width: '30%', alignItems: 'center', marginBottom: spacing.md },
  icono: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 1,
  },
  iconoSi: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  iconoNo: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  titulo: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, textAlign: 'center' },
  tituloNo: { color: colors.textFaint },
  descripcion: { ...typography.small, color: colors.textFaint, textAlign: 'center', fontSize: 11 },
});
