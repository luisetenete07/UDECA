import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { updateCycle } from '../lib/firestore/cycles';
import { exerciseNames, semanaAnterior, weekPlanDraft } from '../lib/weekPlan';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';
import type { Routine, TrainingCycle, WeekPlanEntry } from '../lib/types';

/**
 * Programar UNA semana: series, repeticiones y RIR de cada ejercicio.
 *
 * Parte de lo que se puso la semana anterior (o de la rutina, la primera vez) y
 * se ajusta lo que haga falta. Es el "duplicar y ajustar" de toda la vida, y no
 * reglas automáticas del tipo "+1 repetición por semana": las reglas se rompen
 * en cuanto alguien se lesiona o se salta una semana, y entonces uno se pelea
 * con el sistema en vez de con el entrenamiento.
 *
 * Lo que se guarda son SOLO los números. Los ejercicios, su orden, los
 * descansos y las superseries siguen viviendo en la rutina, que no se toca: si
 * el plan se borra, el alumno se queda con su rutina intacta.
 */
export function WeekPlanSheet({
  visible,
  micro,
  cycles,
  routine,
  onClose,
  onSaved,
}: {
  visible: boolean;
  micro: TrainingCycle;
  cycles: TrainingCycle[];
  routine: Routine | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [entries, setEntries] = useState<WeekPlanEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const nombres = exerciseNames(routine);
  const previa = semanaAnterior(cycles, micro);
  const yaProgramada = (micro.weekPlan ?? []).length > 0;

  useEffect(() => {
    if (!visible) return;
    setEntries(
      yaProgramada ? (micro.weekPlan ?? []).map((e) => ({ ...e })) : weekPlanDraft(routine, cycles, micro)
    );
  }, [visible, micro, cycles, routine, yaProgramada]);

  const editar = (exerciseId: string, cambio: Partial<WeekPlanEntry>) =>
    setEntries((prev) =>
      prev.map((e) => (e.exerciseId === exerciseId ? { ...e, ...cambio } : e))
    );

  const traerAnterior = () => {
    setEntries(weekPlanDraft(routine, cycles, micro));
    showToast(previa ? 'Copiado de la semana anterior' : 'Copiado de la rutina');
  };

  const guardar = async () => {
    setSaving(true);
    try {
      // Firestore rechaza `undefined` también dentro de los arrays, así que
      // cada ficha se guarda solo con los campos que tienen valor. De paso, un
      // ejercicio sin ningún número no ocupa sitio: es la rutina tal cual.
      const limpias = entries
        .map((e) => ({
          exerciseId: e.exerciseId,
          ...(e.sets != null ? { sets: e.sets } : {}),
          ...(e.reps ? { reps: e.reps } : {}),
          ...(e.rir != null ? { rir: e.rir } : {}),
        }))
        .filter((e) => 'sets' in e || 'reps' in e || 'rir' in e);
      await updateCycle(micro.id, { weekPlan: limpias });
      showToast('Semana programada');
      onSaved();
      onClose();
    } catch {
      showToast('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const limpiar = async () => {
    setSaving(true);
    try {
      await updateCycle(micro.id, { weekPlan: [] });
      showToast('Esta semana vuelve a la rutina');
      onSaved();
      onClose();
    } catch {
      showToast('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{micro.name}</Text>
            <Text style={styles.sub}>
              {micro.isDeload
                ? 'Semana de descarga. Baja series o sube el RIR; lo que no toques se queda como en la rutina.'
                : 'Los números de esta semana. Lo que no toques se queda como en la rutina.'}
            </Text>

            {entries.length === 0 ? (
              <Text style={styles.vacio}>
                Este alumno no tiene rutina activa, así que todavía no hay ejercicios que
                programar. Créale una y vuelve.
              </Text>
            ) : (
              <>
                <Pressable onPress={traerAnterior} style={styles.copyBtn}>
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  <Text style={styles.copyText}>
                    {previa ? `Traer de ${previa.name}` : 'Traer de la rutina'}
                  </Text>
                </Pressable>

                <View style={styles.headRow}>
                  <Text style={[styles.colLabel, { flex: 1 }]}>Ejercicio</Text>
                  <Text style={[styles.colLabel, styles.colNum]}>Series</Text>
                  <Text style={[styles.colLabel, styles.colReps]}>Reps</Text>
                  <Text style={[styles.colLabel, styles.colNum]}>RIR</Text>
                </View>

                {entries.map((e) => (
                  <View key={e.exerciseId} style={styles.row}>
                    <Text style={styles.exName} numberOfLines={2}>
                      {nombres.get(e.exerciseId) ?? 'Ejercicio'}
                    </Text>
                    <TextField
                      value={e.sets != null ? String(e.sets) : ''}
                      onChangeText={(v) =>
                        editar(e.exerciseId, { sets: v.trim() ? Number(v) || undefined : undefined })
                      }
                      keyboardType="numeric"
                      placeholder="—"
                      containerStyle={styles.colNum}
                      style={styles.cellInput}
                    />
                    <TextField
                      value={e.reps ?? ''}
                      onChangeText={(v) => editar(e.exerciseId, { reps: v || undefined })}
                      placeholder="8"
                      containerStyle={styles.colReps}
                      style={styles.cellInput}
                    />
                    <TextField
                      value={e.rir != null ? String(e.rir) : ''}
                      onChangeText={(v) =>
                        editar(e.exerciseId, {
                          rir: v.trim() ? Math.max(0, Number(v) || 0) : undefined,
                        })
                      }
                      keyboardType="numeric"
                      placeholder="—"
                      containerStyle={styles.colNum}
                      style={styles.cellInput}
                    />
                  </View>
                ))}

                <Text style={styles.nota}>
                  Tu alumno verá estos números en su entreno de esta semana.
                </Text>
              </>
            )}

            <View style={styles.actions}>
              <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button
                title="Guardar semana"
                onPress={guardar}
                loading={saving}
                disabled={entries.length === 0}
                style={{ flex: 1 }}
              />
            </View>

            {yaProgramada ? (
              <Pressable onPress={limpiar} style={styles.resetBtn} hitSlop={6}>
                <Text style={styles.resetText}>Quitar la programación de esta semana</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.text },
  sub: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  vacio: { ...typography.small, color: colors.textFaint, marginBottom: spacing.md },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  copyText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineFaint,
  },
  colLabel: {
    fontSize: 10,
    color: colors.textFaint,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  colNum: { width: 54 },
  colReps: { width: 62 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exName: { ...typography.small, color: colors.text, flex: 1, fontFamily: fonts.medium },
  cellInput: {
    minHeight: 42,
    paddingHorizontal: spacing.xs,
    textAlign: 'center',
    ...tabularNums,
  },
  nota: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  resetBtn: { alignSelf: 'center', marginTop: spacing.md, padding: spacing.sm },
  resetText: { ...typography.small, color: colors.danger },
});
