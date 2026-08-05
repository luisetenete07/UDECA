import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { DateField, startOfToday } from './DateField';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { createCyclePlan } from '../lib/firestore/cycles';
import { applyPlanTemplate, getPlanTemplates } from '../lib/firestore/planTemplates';
import { templateSessions, templateWeeks, type PlanTemplate } from '../lib/planTemplates';
import {
  PLAN_TEMPLATES,
  planEndDate,
  startOfWeek,
  totalWeeks,
  type PlanBlock,
  type PlanDraft,
} from '../lib/cyclePlan';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

const MAX_BLOQUES = 8;

function fmtCorta(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

interface Props {
  visible: boolean;
  trainerId: string;
  clientId: string;
  onClose: () => void;
  /** Recibe el id del macrociclo creado. */
  onSaved: (macroId: string) => void;
}

/**
 * Crear una temporada entera de una vez: nombre, fecha, bloques y entrenos por
 * semana → macrociclo, mesociclos y microciclos ya colocados en el calendario.
 *
 * Es la diferencia entre planificar de verdad y no hacerlo: montar 12 semanas a
 * mano son 16 formularios, y nadie los rellena dos veces. Aquí son treinta
 * segundos, y después se puede tocar lo que haga falta ciclo a ciclo.
 */
export function CyclePlanSheet({ visible, trainerId, clientId, onClose, onSaved }: Props) {
  const [plantilla, setPlantilla] = useState<string>(PLAN_TEMPLATES[0].id);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<number>(startOfToday());
  const [blocks, setBlocks] = useState<PlanBlock[]>(PLAN_TEMPLATES[0].blocks);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(4);
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [misPlantillas, setMisPlantillas] = useState<PlanTemplate[]>([]);
  const [plantillaPropia, setPlantillaPropia] = useState<PlanTemplate | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPlantilla(PLAN_TEMPLATES[0].id);
    setName('');
    setStartDate(startOfToday());
    setBlocks(PLAN_TEMPLATES[0].blocks.map((b) => ({ ...b })));
    setSessionsPerWeek(4);
    setGoal('');
    setPlantillaPropia(null);
    // Las plantillas guardadas van primero: si el entrenador ya montó su método
    // una vez, lo normal es que quiera repetirlo, no volver a construirlo.
    getPlanTemplates(trainerId)
      .then(setMisPlantillas)
      .catch(() => setMisPlantillas([]));
  }, [visible, trainerId]);

  const usarPlantilla = (id: string) => {
    setPlantillaPropia(null);
    setPlantilla(id);
    const t = PLAN_TEMPLATES.find((x) => x.id === id);
    if (t) setBlocks(t.blocks.map((b) => ({ ...b })));
  };

  /** Cualquier retoque a mano deja de ser "la plantilla". */
  const editarBloque = (i: number, cambio: Partial<PlanBlock>) => {
    setPlantilla('libre');
    setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, ...cambio } : b)));
  };

  const anadirBloque = () => {
    setPlantilla('libre');
    setBlocks((prev) =>
      prev.length >= MAX_BLOQUES
        ? prev
        : [...prev, { name: `Bloque ${prev.length + 1}`, weeks: 4, deloadLast: true }]
    );
  };

  const quitarBloque = (i: number) => {
    setPlantilla('libre');
    setBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  };

  const draft: PlanDraft = {
    name: name.trim() || 'Temporada',
    startDate,
    blocks,
    sessionsPerWeek,
    goal,
  };
  const semanas = totalWeeks(draft);
  const inicio = startOfWeek(startDate);
  const fin = planEndDate(draft);
  const entrenos = semanas * sessionsPerWeek;

  const guardar = async () => {
    setSaving(true);
    try {
      const macroId = plantillaPropia
        ? await applyPlanTemplate(trainerId, clientId, plantillaPropia, startDate)
        : await createCyclePlan(trainerId, clientId, draft);
      showToast(
        plantillaPropia
          ? `Plantilla aplicada · ${templateWeeks(plantillaPropia)} semanas`
          : `Plan creado · ${semanas} semanas`
      );
      onSaved(macroId);
      onClose();
    } catch {
      showToast('No se pudo crear el plan');
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
            <Text style={styles.title}>Nuevo plan</Text>
            <Text style={styles.sub}>
              Elige una estructura, ajústala y la app crea el macrociclo con sus bloques y sus
              semanas.
            </Text>

            {misPlantillas.length > 0 ? (
              <>
                <Text style={styles.label}>Tus plantillas</Text>
                {misPlantillas.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => setPlantillaPropia(plantillaPropia?.id === t.id ? null : t)}
                    style={[styles.tpl, plantillaPropia?.id === t.id && styles.tplActive]}
                  >
                    <Ionicons
                      name={plantillaPropia?.id === t.id ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={plantillaPropia?.id === t.id ? colors.primaryBright : colors.textFaint}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.tplName,
                          plantillaPropia?.id === t.id && styles.tplNameActive,
                        ]}
                      >
                        {t.name}
                      </Text>
                      <Text style={styles.tplHint}>
                        {templateWeeks(t)} semanas · {t.blocks.length} bloque
                        {t.blocks.length === 1 ? '' : 's'}
                        {templateSessions(t) > 0 ? ` · ${templateSessions(t)} entrenos` : ''}
                        {t.blocks.some((b) => b.weeks.some((w) => w.weekPlan?.length))
                          ? ' · con los números'
                          : ''}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                <View style={styles.divider} />
              </>
            ) : null}

            <Text style={styles.label}>
              {misPlantillas.length > 0 ? 'O empezar de cero' : 'Estructura'}
            </Text>
            {PLAN_TEMPLATES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => usarPlantilla(t.id)}
                style={[styles.tpl, plantilla === t.id && styles.tplActive]}
              >
                <Ionicons
                  name={plantilla === t.id ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={plantilla === t.id ? colors.primaryBright : colors.textFaint}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tplName, plantilla === t.id && styles.tplNameActive]}>
                    {t.label}
                  </Text>
                  <Text style={styles.tplHint}>{t.hint}</Text>
                </View>
              </Pressable>
            ))}

            <TextField
              label="Nombre del plan"
              placeholder="Ej. Temporada de otoño"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Empieza</Text>
            <DateField value={startDate} onChange={setStartDate} />
            <Text style={styles.hint}>
              Las semanas van de lunes a domingo, así que el plan arranca el lunes{' '}
              {fmtCorta(inicio)}.
            </Text>

            <Text style={styles.label}>Entrenos por semana</Text>
            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => setSessionsPerWeek((n) => Math.max(1, n - 1))}
                style={styles.stepBtn}
                hitSlop={6}
              >
                <Ionicons name="remove" size={18} color={colors.primary} />
              </Pressable>
              <Text style={styles.stepValue}>{sessionsPerWeek}</Text>
              <Pressable
                onPress={() => setSessionsPerWeek((n) => Math.min(7, n + 1))}
                style={styles.stepBtn}
                hitSlop={6}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
              </Pressable>
              <Text style={styles.hintInline}>
                Es la meta de cada semana; en las de descarga se resta una.
              </Text>
            </View>

            <View style={styles.divider} />
            <Text style={styles.label}>Bloques</Text>

            {blocks.map((b, i) => (
              <View key={i} style={styles.block}>
                <View style={styles.blockHead}>
                  <Text style={styles.blockIndex}>{i + 1}</Text>
                  <TextField
                    value={b.name}
                    onChangeText={(v) => editarBloque(i, { name: v })}
                    placeholder="Nombre del bloque"
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                  />
                  {blocks.length > 1 ? (
                    <Pressable onPress={() => quitarBloque(i)} hitSlop={8} style={styles.trash}>
                      <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.stepperRow}>
                  <Pressable
                    onPress={() => editarBloque(i, { weeks: Math.max(1, b.weeks - 1) })}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="remove" size={18} color={colors.primary} />
                  </Pressable>
                  <Text style={styles.stepValue}>{b.weeks}</Text>
                  <Pressable
                    onPress={() => editarBloque(i, { weeks: Math.min(16, b.weeks + 1) })}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                  </Pressable>
                  <Text style={styles.hintInline}>semana{b.weeks === 1 ? '' : 's'}</Text>
                </View>

                <View style={styles.rowBetween}>
                  <Text style={styles.switchLabel}>Última semana de descarga</Text>
                  <Switch
                    value={b.deloadLast}
                    onValueChange={(v) => editarBloque(i, { deloadLast: v })}
                    trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
                    thumbColor={colors.white}
                  />
                </View>
              </View>
            ))}

            {blocks.length < MAX_BLOQUES ? (
              <Pressable onPress={anadirBloque} style={styles.addBlock}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.addBlockText}>Añadir bloque</Text>
              </Pressable>
            ) : null}

            <View style={styles.divider} />
            <TextField
              label="Objetivo del plan (opcional)"
              placeholder="Ej. Muscle-up estricto por 3"
              value={goal}
              onChangeText={setGoal}
            />

            <View style={styles.resumen}>
              <Text style={styles.resumenBig}>
                {plantillaPropia ? templateWeeks(plantillaPropia) : semanas} semanas ·{' '}
                {plantillaPropia ? plantillaPropia.blocks.length : blocks.length} bloque
                {(plantillaPropia ? plantillaPropia.blocks.length : blocks.length) === 1 ? '' : 's'}
              </Text>
              <Text style={styles.resumenText}>
                {plantillaPropia
                  ? `${plantillaPropia.name} · desde el ${fmtCorta(inicio)}`
                  : `Del ${fmtCorta(inicio)} al ${fmtCorta(fin)} · ${entrenos} entrenos previstos`}
              </Text>
            </View>

            <View style={styles.actions}>
              <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button
                title={plantillaPropia ? 'Aplicar plantilla' : 'Crear plan'}
                onPress={guardar}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
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
  label: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  hint: { ...typography.small, color: colors.textFaint, marginBottom: spacing.sm },
  hintInline: { ...typography.small, color: colors.textFaint, flex: 1 },
  tpl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  tplActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  tplName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  tplNameActive: { color: colors.primaryBright },
  tplHint: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
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
  stepValue: {
    ...typography.h3,
    color: colors.text,
    minWidth: 34,
    textAlign: 'center',
  },
  block: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockIndex: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.heading,
    width: 16,
  },
  trash: { padding: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { ...typography.small, color: colors.textMuted, flex: 1 },
  addBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  addBlockText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  resumen: {
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  resumenBig: { ...typography.h3, color: colors.text },
  resumenText: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
