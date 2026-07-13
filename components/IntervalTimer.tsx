import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { playBeep, primeAudio } from '../lib/sound';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Temporizador de intervalos para acondicionamiento (EMOM/Tabata y libre).
 * Cuenta contra el reloj real (Date.now) para no desincronizarse al bloquear
 * la pantalla, avisa con sonido/háptica en cada cambio de fase y muestra la
 * ronda actual. Herramienta desplegable dentro del entreno.
 */

type Mode = 'emom' | 'tabata' | 'custom';

interface Preset {
  work: number;
  rest: number;
  rounds: number;
}
const PRESETS: Record<Mode, Preset> = {
  emom: { work: 60, rest: 0, rounds: 10 },
  tabata: { work: 20, rest: 10, rounds: 8 },
  custom: { work: 40, rest: 20, rounds: 6 },
};

export function IntervalTimer() {
  const [mode, setMode] = useState<Mode>('tabata');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [round, setRound] = useState(1);
  const [remaining, setRemaining] = useState(PRESETS.tabata.work);

  const cfg = PRESETS[mode];
  const endsAt = useRef(0);
  const phaseRef = useRef<'work' | 'rest'>('work');
  const roundRef = useRef(1);

  // Reinicia al cambiar de modo (si no está corriendo).
  useEffect(() => {
    if (running) return;
    setPhase('work');
    setRound(1);
    setRemaining(PRESETS[mode].work);
    phaseRef.current = 'work';
    roundRef.current = 1;
  }, [mode, running]);

  const cue = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      playBeep();
    }
  };

  const stop = () => {
    setRunning(false);
    setPhase('work');
    setRound(1);
    setRemaining(PRESETS[mode].work);
    phaseRef.current = 'work';
    roundRef.current = 1;
  };

  const start = () => {
    primeAudio();
    phaseRef.current = 'work';
    roundRef.current = 1;
    setPhase('work');
    setRound(1);
    endsAt.current = Date.now() + PRESETS[mode].work * 1000;
    setRemaining(PRESETS[mode].work);
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const rem = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem > 0) return;
      // Fin de fase: avanzar.
      const c = PRESETS[mode];
      cue();
      if (phaseRef.current === 'work' && c.rest > 0) {
        phaseRef.current = 'rest';
        setPhase('rest');
        endsAt.current = Date.now() + c.rest * 1000;
      } else {
        // Siguiente ronda (o fin).
        if (roundRef.current >= c.rounds) {
          clearInterval(id);
          setRunning(false);
          setRemaining(0);
          return;
        }
        roundRef.current += 1;
        setRound(roundRef.current);
        phaseRef.current = 'work';
        setPhase('work');
        endsAt.current = Date.now() + c.work * 1000;
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, mode]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const isWork = phase === 'work';

  return (
    <View style={styles.card}>
      <View style={styles.modeRow}>
        {(['tabata', 'emom', 'custom'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => !running && setMode(m)}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
              {m === 'tabata' ? 'Tabata' : m === 'emom' ? 'EMOM' : 'Libre'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.config}>
        {cfg.work}s trabajo{cfg.rest > 0 ? ` · ${cfg.rest}s descanso` : ''} · {cfg.rounds} rondas
      </Text>

      <Text style={[styles.time, { color: isWork ? colors.primaryBright : colors.textMuted }]}>
        {mm}:{ss.toString().padStart(2, '0')}
      </Text>
      <Text style={[styles.phase, { color: isWork ? colors.primary : colors.textMuted }]}>
        {running || remaining > 0
          ? `${isWork ? 'TRABAJO' : 'DESCANSO'} · Ronda ${round}/${cfg.rounds}`
          : '¡Completado! 🎉'}
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
  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  modeTextActive: { color: colors.onPrimary },
  config: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm },
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
