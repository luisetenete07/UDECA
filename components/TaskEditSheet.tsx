import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { deleteCoachTask, updateCoachTask } from '../lib/firestore/coachTasks';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import { TASK_SCOPE_LABEL, type CoachTask, type TaskScope } from '../lib/types';

const MOVE_SCOPES: TaskScope[] = ['day', 'week', 'month'];

interface Props {
  task: CoachTask | null;
  onClose: () => void;
  onChanged: () => void;
}

/** Hoja para editar una tarea u objetivo: texto, cubo, prioridad, notas, borrar. */
export function TaskEditSheet({ task, onClose, onChanged }: Props) {
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState<TaskScope>('day');
  const [flagged, setFlagged] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isGoal = task?.scope === 'goal';

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setScope(task.scope);
    setFlagged(!!task.flagged);
    setNotes(task.notes ?? '');
  }, [task]);

  if (!task) return null;

  const save = async () => {
    if (!title.trim()) {
      showToast('Escribe algo primero');
      return;
    }
    setSaving(true);
    try {
      await updateCoachTask(task.id, {
        title: title.trim(),
        scope: isGoal ? 'goal' : scope,
        flagged: flagged || undefined,
        notes: notes.trim() || undefined,
      });
      onChanged();
      onClose();
    } catch {
      showToast('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await deleteCoachTask(task.id);
      showToast('Eliminado');
      onChanged();
      onClose();
    } catch {
      showToast('No se pudo eliminar');
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.tap} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{isGoal ? 'Editar objetivo' : 'Editar tarea'}</Text>

            <TextField
              label={isGoal ? 'Objetivo' : 'Tarea'}
              value={title}
              onChangeText={setTitle}
              placeholder={isGoal ? 'Ej. Llegar a 20 alumnos' : 'Ej. Grabar reel de técnica'}
              multiline
            />

            {!isGoal ? (
              <>
                <Text style={styles.label}>¿Para cuándo?</Text>
                <View style={styles.chipRow}>
                  {MOVE_SCOPES.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setScope(s)}
                      style={[styles.chip, scope === s && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, scope === s && styles.chipTextActive]}>
                        {TASK_SCOPE_LABEL[s]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable style={styles.flagRow} onPress={() => setFlagged((f) => !f)}>
                  <Ionicons
                    name={flagged ? 'flag' : 'flag-outline'}
                    size={20}
                    color={flagged ? colors.primary : colors.textMuted}
                  />
                  <Text style={styles.flagText}>Destacar (prioridad)</Text>
                  <View style={[styles.toggle, flagged && styles.toggleOn]}>
                    <View style={[styles.knob, flagged && styles.knobOn]} />
                  </View>
                </Pressable>
              </>
            ) : null}

            <TextField
              label="Notas"
              value={notes}
              onChangeText={setNotes}
              placeholder="Detalles, pasos, enlaces…"
              multiline
              style={{ minHeight: 84, textAlignVertical: 'top' }}
            />

            <View style={styles.actions}>
              <Button title="Guardar" onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
            <Pressable style={styles.deleteBtn} onPress={remove} hitSlop={6}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.deleteText}>Eliminar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  tap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase', marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  chipTextActive: { color: colors.primaryBright },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  flagText: { ...typography.body, color: colors.text, flex: 1 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white },
  knobOn: { alignSelf: 'flex-end' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  deleteText: { ...typography.small, color: colors.danger, fontFamily: fonts.semiBold },
});
