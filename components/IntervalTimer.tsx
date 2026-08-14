import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { playBeep, primeAudio } from '../lib/sound';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Temporizador EMOM (Every Minute On the Minute): cada intervalo arranca una
 * ronda nueva. Cuenta contra el reloj real (Date.now) para no desincronizarse
 * al bloquear la pantalla y avisa con sonido/háptica en cada ronda. El coach
 * decide por día si aparece esta herramienta dentro del entreno.
 */
export function IntervalTimer() {
  const [interval, setIntervalSec] = useState(60); // segundos por ronda
  const [rounds, setRounds] = useState(10);
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(1);
  const [remaining, setRemaining] = useState(60);

  const endsAt = useRef(0);
  const roundRef = useRef(1);

  // Reajusta la cuenta si se cambia la config estando parado.
  useEffect(() => {
    if (!running) setRemaining(interval);
  }, [interval, running]);

  const cue = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      playBeep();
    }
  };

  const stop = () => {
    setRunning(false);
    setRound(1);
    roundRef.current = 1;
    setRemaining(interval);
  };

  const start = () => {
    primeAudio();
    roundRef.current = 1;
    setRound(1);
    endsAt.current = Date.now() + interval * 1000;
    setRemaining(interval);
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const rem = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem > 0) return;
      cue();
      if (roundRef.current >= rounds) {
        clearInterval(id);
        setRunning(false);
        setRemaining(0);
        return;
      }
      roundRef.current += 1;
      setRound(roundRef.current);
      endsAt.current = Date.now() + interval * 1000;
    }, 250);
    return () => clearInterval(id);
  }, [running, interval, rounds]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const done = !running && remaining === 0;

  return (
    <View style={styles.card}>
      <Text style={styles.mode}>EMOM · cada ronda arranca al minuto</Text>

      <View style={styles.configRow}>
        <Stepper
          label="Intervalo"
          value={`${interval}s`}
          onMinus={() => !running && setIntervalSec((v) => Math.max(10, v - 5))}
          onPlus={() => !running && setIntervalSec((v) => Math.min(300, v + 5))}
        />
        <Stepper
          label="Rondas"
          value={String(rounds)}
          onMinus={() => !running && setRounds((v) => Math.max(1, v - 1))}
          onPlus={() => !running && setRounds((v) => Math.min(60, v + 1))}
        />
      </View>

      <Text style={[styles.time, { color: running ? colors.primaryBright : colors.textMuted }]}>
        {mm}:{ss.toString().padStart(2, '0')}
      </Text>
      <Text style={[styles.phase, { color: running ? colors.primary : colors.textMuted }]}>
        {done ? '¡Completado!' : `Ronda ${round}/${rounds}`}
      </Text>

      <Pressable onPress={running ? stop : start} style={styles.action}>
        <Ionicons
          name={running ? 'stop' : 'play'}
          size={16}
          color={running ? colors.danger : colors.onPrimary}
        />
        <Text style={[styles.actionText, running && { color: colors.danger }]}>
          {running ? 'Parar' : 'Empezar'}
        </Text>
      </Pressable>
    </View>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={onMinus} style={styles.stepBtn} hitSlop={6}>
          <Ionicons name="remove" size={16} color={colors.text} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable onPress={onPlus} style={styles.stepBtn} hitSlop={6}>
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  mode: { ...typography.small, color: colors.textFaint, marginBottom: spacing.sm },
  configRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  stepper: { alignItems: 'center', gap: 4 },
  stepperLabel: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    ...typography.body,
    color: colors.text,
    fontFamily: fonts.semiBold,
    minWidth: 44,
    textAlign: 'center',
  },
  time: { fontSize: 52, lineHeight: 58, fontFamily: fonts.heading, fontVariant: ['tabular-nums'] },
  phase: { ...typography.small, fontFamily: fonts.semiBold, letterSpacing: 1, marginBottom: spacing.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionText: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold },
});
