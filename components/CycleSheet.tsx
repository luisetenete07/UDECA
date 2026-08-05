import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { DateField, fmtDate as fmt, startOfToday } from './DateField';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { createCycle, updateCycle } from '../lib/firestore/cycles';
import { Sheet } from './Sheet';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import {
  CYCLE_DEFAULT_WEEKS,
  CYCLE_LEVEL_LABEL,
  type CycleLevel,
  type TrainingCycle,
} from '../lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVELS: CycleLevel[] = ['macro', 'meso', 'micro'];

interface Props {
  visible: boolean;
  trainerId: string;
  clientId: string;
  /** Ciclo existente para editar; sin valor = crear uno nuevo. */
  cycle?: TrainingCycle | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Hoja para crear o editar un ciclo. Simple a propósito: nivel + nombre y, si
 * se quiere, duración en semanas y fecha de inicio. Todo lo demás es opcional.
 */
export function CycleSheet({ visible, trainerId, clientId, cycle, onClose, onSaved }: Props) {
  const editing = !!cycle;
  const [level, setLevel] = useState<CycleLevel>('meso');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<number>(startOfToday());
  const [weeks, setWeeks] = useState<number>(CYCLE_DEFAULT_WEEKS.meso);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [goal, setGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [isDeload, setIsDeload] = useState(false);
  const [saving, setSaving] = useState(false);

  // Rellena el formulario al abrir (con los valores del ciclo si se edita).
  useEffect(() => {
    if (!visible) return;
    if (cycle) {
      setLevel(cycle.level);
      setName(cycle.name);
      setStartDate(cycle.startDate ?? startOfToday());
      setOpen(!cycle.endDate);
      if (cycle.startDate && cycle.endDate) {
        setWeeks(Math.max(1, Math.round((cycle.endDate - cycle.startDate) / DAY_MS / 7)));
      } else {
        setWeeks(CYCLE_DEFAULT_WEEKS[cycle.level]);
      }
      setTarget(cycle.targetSessions ? String(cycle.targetSessions) : '');
      setGoal(cycle.goal ?? '');
      setNotes(cycle.notes ?? '');
      setIsDeload(!!cycle.isDeload);
    } else {
      setLevel('meso');
      setName('');
      setStartDate(startOfToday());
      setWeeks(CYCLE_DEFAULT_WEEKS.meso);
      setOpen(false);
      setTarget('');
      setGoal('');
      setNotes('');
      setIsDeload(false);
    }
  }, [visible, cycle]);

  const pickLevel = (l: CycleLevel) => {
    setLevel(l);
    if (!editing) setWeeks(CYCLE_DEFAULT_WEEKS[l]);
    if (l !== 'micro') setIsDeload(false);
  };

  const endDate = open ? undefined : startDate + (weeks * 7 - 1) * DAY_MS;

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Ponle un nombre al ciclo');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        level,
        name: name.trim(),
        startDate,
        endDate,
        targetSessions: target.trim() ? Number(target) || undefined : undefined,
        goal: goal.trim() || undefined,
        notes: notes.trim() || undefined,
        isDeload: level === 'micro' && isDeload ? true : undefined,
      };
      if (cycle) {
        await updateCycle(cycle.id, payload);
        showToast('Ciclo actualizado');
      } else {
        await createCycle({ trainerId, clientId, ...payload });
        showToast('Ciclo creado');
      }
      onSaved();
      onClose();
    } catch {
      showToast('No se pudo guardar el ciclo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <Text style={styles.title}>{editing ? 'Editar ciclo' : 'Nuevo ciclo'}</Text>

      <Text style={styles.label}>Nivel</Text>
      <View style={styles.chipRow}>
        {LEVELS.map((l) => (
          <Pressable
            key={l}
            onPress={() => pickLevel(l)}
            style={[styles.chip, level === l && styles.chipActive]}
          >
            <Text style={[styles.chipText, level === l && styles.chipTextActive]}>
              {CYCLE_LEVEL_LABEL[l]}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextField
        label="Nombre"
        placeholder="Ej. Hipertrofia"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Empieza</Text>
      <DateField value={startDate} onChange={setStartDate} />

      <View style={styles.rowBetween}>
        <Text style={styles.label}>Sin fecha de fin (abierto)</Text>
        <Switch
          value={open}
          onValueChange={setOpen}
          trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
          thumbColor={colors.white}
        />
      </View>

      {!open ? (
        <>
          <Text style={styles.label}>Duración</Text>
          <View style={styles.dateRow}>
            <Pressable
              onPress={() => setWeeks((w) => Math.max(1, w - 1))}
              style={styles.stepBtn}
              hitSlop={6}
            >
              <Ionicons name="remove" size={18} color={colors.primary} />
            </Pressable>
            <Text style={styles.dateText}>
              {weeks} semana{weeks === 1 ? '' : 's'}
            </Text>
            <Pressable
              onPress={() => setWeeks((w) => Math.min(52, w + 1))}
              style={styles.stepBtn}
              hitSlop={6}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
            </Pressable>
            <Text style={styles.endHint}>hasta {endDate ? fmt(endDate) : '—'}</Text>
          </View>
        </>
      ) : null}

      {level === 'micro' ? (
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Semana de descarga (deload)</Text>
          <Switch
            value={isDeload}
            onValueChange={setIsDeload}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}

      <View style={styles.divider} />
      <Text style={styles.optHint}>Opcional</Text>

      <TextField
        label="Meta de sesiones"
        placeholder="Ej. 16"
        keyboardType="numeric"
        value={target}
        onChangeText={setTarget}
      />
      <TextField
        label="Objetivo del ciclo"
        placeholder="Ej. Dominadas lastradas +25 kg × 5"
        value={goal}
        onChangeText={setGoal}
      />
      <TextField
        label="Notas del coach"
        placeholder="Notas privadas…"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={{ minHeight: 72, textAlignVertical: 'top' }}
      />

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={editing ? 'Guardar' : 'Crear ciclo'}
          onPress={handleSave}
          loading={saving}
          style={{ flex: 1 }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.md },
  label: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, minWidth: 120, textAlign: 'center' },
  endHint: { ...typography.small, color: colors.textFaint, flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  optHint: {
    ...typography.label,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
