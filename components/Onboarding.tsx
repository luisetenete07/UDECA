import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { FadeIn } from './FadeIn';
import { MacroCalculator } from './MacroCalculator';
import { TextField } from './TextField';
import type { Goal, MacroResult } from '../lib/nutritionCalc';
import { colors, fonts, radius, shadows, spacing, typography } from '../lib/theme';

/** Sugerencias rápidas de objetivo (calistenia) para el paso del onboarding. */
const GOAL_SUGGESTIONS = [
  'Mi primera dominada',
  'Ganar músculo',
  'Perder grasa',
  'Front lever',
  'Handstand',
  'Más resistencia',
];

/**
 * Bienvenida del alumno (se muestra UNA vez por dispositivo): 4 pasos breves
 * que explican lo esencial y, en web, cómo instalar la app en la pantalla de
 * inicio (el paso se omite si ya está instalada como PWA o es app nativa).
 */

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  lines: string[];
}

/** true si ya corre instalada (PWA en modo standalone o app nativa). */
function isInstalled(): boolean {
  if (Platform.OS !== 'web') return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/** true si el navegador es iOS (Safari): instrucciones de instalación distintas. */
function isIOSWeb(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

export function Onboarding({
  name,
  role,
  onDone,
}: {
  name?: string;
  /** Rol de la cuenta: el atleta se autoentrena (sin coach), el alumno tiene coach. */
  role?: 'client' | 'athlete' | 'trainer';
  /**
   * Se llama al terminar; con los macros calculados (si los rellenó), el objetivo
   * de nutrición y el objetivo principal en texto libre (si lo definió).
   */
  onDone: (targets?: MacroResult, goal?: Goal, mainGoal?: string) => void;
}) {
  const isAthlete = role === 'athlete';
  const slides = useMemo<Slide[]>(() => {
    const base: Slide[] = isAthlete
      ? [
          {
            icon: 'flame',
            title: `Bienvenido a UDECA${name ? `, ${name.split(' ')[0]}` : ''}`,
            lines: [
              'Aquí diriges tú: crea tu plan, registra tu progreso y controla tu nutrición, todo en un mismo sitio.',
              'Este es tu campo base. Vamos a verlo en 20 segundos.',
            ],
          },
          {
            icon: 'construct',
            title: 'Diseña tu propio plan',
            lines: [
              'En Mi plan eliges el método: por días de la semana, días sueltos en ciclo o a sensaciones.',
              'Añade tus ejercicios con series, reps, descansos y superseries. Tú mandas.',
            ],
          },
          {
            icon: 'barbell',
            title: 'Entrena con el modo enfocado',
            lines: [
              'En Entreno, dale al día que toca: un ejercicio por pantalla, marca cada serie con ✓ y el crono de descanso arranca solo.',
              'Apunta reps o segundos según el ejercicio y deja notas para ti.',
            ],
          },
          {
            icon: 'trending-up',
            title: 'Mide tu progreso',
            lines: [
              'Peso, fotos y tus entrenos quedan guardados en Progreso, mes a mes.',
              'Tus récords y tu racha se actualizan solos para que veas tu evolución.',
            ],
          },
        ]
      : [
          {
            icon: 'flame',
            title: `Bienvenido a UDECA${name ? `, ${name.split(' ')[0]}` : ''}`,
            lines: [
              'Tu entrenador te acompaña desde aquí: rutina, progreso y comunicación en un solo sitio.',
              'Este es tu campo base. Vamos a verlo en 20 segundos.',
            ],
          },
          {
            icon: 'barbell',
            title: 'Entrena con el modo enfocado',
            lines: [
              'En Entreno, dale al día que toca: un ejercicio por pantalla, marca cada serie con ✓ y el crono de descanso arranca solo.',
              'Apunta reps o segundos según el ejercicio; si algo cambia, deja una nota al coach.',
            ],
          },
          {
            icon: 'trending-up',
            title: 'Registra tu progreso',
            lines: [
              'Peso, fotos y tus entrenos quedan guardados en Progreso, mes a mes.',
              'Cada semana, envía tu check-in (energía, sueño, sensaciones): tu coach lo lee y ajusta tu plan.',
            ],
          },
        ];
    if (!isInstalled()) {
      base.push({
        icon: 'download',
        title: 'Instálala como app',
        lines: isIOSWeb()
          ? [
              'En Safari: toca el botón Compartir (cuadrado con flecha, abajo).',
              'Elige “Añadir a pantalla de inicio” y confirma. UDECA quedará como una app más.',
            ]
          : [
              'En Chrome: toca el menú ⋮ (arriba a la derecha).',
              'Elige “Instalar aplicación” o “Añadir a pantalla de inicio”. UDECA quedará como una app más.',
            ],
      });
    }
    return base;
  }, [name, isAthlete]);

  // Pasos finales: definir el objetivo principal y calcular los macros.
  const totalSteps = slides.length + 2;
  const [step, setStep] = useState(0);
  const [mainGoal, setMainGoal] = useState('');
  const isGoalStep = step === slides.length;
  const isCalculator = step === slides.length + 1;
  const isLastSlide = step === slides.length - 1;
  const goalArg = mainGoal.trim() || undefined;

  const Dots = (
    <View style={styles.dots}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
      ))}
    </View>
  );

  if (isCalculator) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.calcContent} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <Ionicons name="nutrition" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Tus macros en 30 segundos</Text>
          <Text style={styles.line}>
            Calcula tus calorías y macros y los tendrás listos en Nutrición. Podrás
            recalcularlos cuando quieras.
          </Text>
          {Dots}
          <View style={{ alignSelf: 'stretch' }}>
            <MacroCalculator
              submitLabel="Guardar y empezar"
              onDone={(result, goal) => onDone(result, goal, goalArg)}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isGoalStep) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.calcContent} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <Ionicons name="flag" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>¿Cuál es tu objetivo?</Text>
          <Text style={styles.line}>
            {isAthlete
              ? 'Defínelo para tenerlo siempre presente y medir tu avance. Podrás cambiarlo cuando quieras desde tu perfil.'
              : 'Defínelo para que tu entrenador lo tenga presente. Podrás cambiarlo cuando quieras desde tu perfil.'}
          </Text>
          {Dots}
          <View style={{ alignSelf: 'stretch', maxWidth: 420, width: '100%' }}>
            <TextField
              label="Mi objetivo"
              value={mainGoal}
              onChangeText={setMainGoal}
              placeholder="Ej. Conseguir mi primera dominada"
            />
            <View style={styles.goalChips}>
              {GOAL_SUGGESTIONS.map((g) => (
                <Pressable key={g} onPress={() => setMainGoal(g)} style={styles.goalChip}>
                  <Text style={styles.goalChipText}>{g}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              title="Siguiente"
              onPress={() => setStep((s) => s + 1)}
              style={{ marginTop: spacing.md }}
            />
            <Pressable onPress={() => setStep((s) => s + 1)} hitSlop={8} style={styles.skip}>
              <Text style={styles.skipText}>Definirlo más tarde</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const slide = slides[step];
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />

        <FadeIn key={step} style={styles.slide}>
          <View style={styles.iconWrap}>
            <Ionicons name={slide.icon} size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          {slide.lines.map((l) => (
            <Text key={l} style={styles.line}>
              {l}
            </Text>
          ))}
        </FadeIn>

        {Dots}

        <Button
          title={isLastSlide ? 'Definir mi objetivo' : 'Siguiente'}
          onPress={() => setStep((s) => s + 1)}
          style={{ alignSelf: 'stretch' }}
        />
        <Pressable onPress={() => onDone(undefined, undefined, goalArg)} hitSlop={8} style={styles.skip}>
          <Text style={styles.skipText}>Saltar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcContent: {
    padding: spacing.xl,
    alignItems: 'center',
    paddingBottom: 48,
  },
  logo: { width: 64, height: 64, borderRadius: 16, marginBottom: spacing.xl, ...shadows.glowGold },
  slide: { alignItems: 'center', minHeight: 240 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  line: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
    maxWidth: 340,
  },
  goalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  goalChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  goalChipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  dots: { flexDirection: 'row', gap: 8, marginVertical: spacing.lg },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary, width: 22 },
  skip: { marginTop: spacing.md },
  skipText: { ...typography.small, color: colors.textFaint, fontFamily: fonts.semiBold },
});
