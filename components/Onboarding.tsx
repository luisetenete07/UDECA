import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { FadeIn } from './FadeIn';
import { MacroCalculator } from './MacroCalculator';
import type { Goal, MacroResult } from '../lib/nutritionCalc';
import { colors, fonts, radius, shadows, spacing, typography } from '../lib/theme';

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
  onDone,
}: {
  name?: string;
  /** Se llama al terminar; con los macros calculados si el alumno los rellenó. */
  onDone: (targets?: MacroResult, goal?: Goal) => void;
}) {
  const slides = useMemo<Slide[]>(() => {
    const base: Slide[] = [
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
  }, [name]);

  // El último paso es la calculadora de macros (deja el plan listo desde ya).
  const totalSteps = slides.length + 1;
  const [step, setStep] = useState(0);
  const isCalculator = step === slides.length;
  const isLastSlide = step === slides.length - 1;

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
              onDone={(result, goal) => onDone(result, goal)}
            />
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
          title={isLastSlide ? 'Calcular mis macros' : 'Siguiente'}
          onPress={() => setStep((s) => s + 1)}
          style={{ alignSelf: 'stretch' }}
        />
        <Pressable onPress={() => onDone()} hitSlop={8} style={styles.skip}>
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
