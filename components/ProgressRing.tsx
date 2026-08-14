import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, fonts, tabularNums } from '../lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Anillo de progreso: el número grande dentro y el arco que se cierra.
 *
 * Es el patrón que mejor funciona en una app de entrenamiento, y no por
 * casualidad: una barra se lee como "cuánto llevas", pero un anillo se lee como
 * "cuánto te FALTA para cerrarlo". Un hueco pide cerrarse; una barra a medias
 * no pide nada.
 *
 * Se anima al montar —crece desde cero— porque el movimiento es la mitad del
 * premio. Al completarse vibra una vez, y solo una: la celebración es del
 * momento en que se cierra, no de cada vez que se abre la pantalla.
 */
export function ProgressRing({
  progress,
  size = 92,
  thickness = 9,
  value,
  label,
  celebrate = true,
}: {
  /** 0..1. Por encima de 1 se recorta: el anillo lleno ya lo dice todo. */
  progress: number;
  size?: number;
  thickness?: number;
  /** Lo que va dentro (p. ej. "3/4"). */
  value: string;
  /** Debajo, pequeño. */
  label?: string;
  /** Vibrar al cerrarse. */
  celebrate?: boolean;
}) {
  const objetivo = Math.max(0, Math.min(1, progress));
  const anim = useRef(new Animated.Value(0)).current;
  const yaCelebrado = useRef(objetivo >= 1);

  const r = (size - thickness) / 2;
  const circunferencia = 2 * Math.PI * r;

  useEffect(() => {
    const a = Animated.timing(anim, {
      toValue: objetivo,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      // strokeDashoffset no lo puede animar el hilo nativo.
      useNativeDriver: false,
    });
    a.start();
    if (objetivo >= 1 && !yaCelebrado.current) {
      yaCelebrado.current = true;
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
    if (objetivo < 1) yaCelebrado.current = false;
    return () => a.stop();
  }, [anim, objetivo]);

  const offset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circunferencia, 0],
  });

  const cerrado = objetivo >= 1;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="anillo" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primaryBright} />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.surfaceAlt}
          strokeWidth={thickness}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#anillo)"
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circunferencia} ${circunferencia}`}
          strokeDashoffset={offset as unknown as number}
          // Empieza arriba y gira como un reloj, que es como se lee el tiempo.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.centro}>
        <Text style={[styles.valor, cerrado && styles.valorCerrado, { fontSize: size * 0.26 }]}>
          {value}
        </Text>
        {label ? <Text style={styles.etiqueta}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valor: { color: colors.text, fontFamily: fonts.heading, ...tabularNums },
  valorCerrado: { color: colors.primaryBright },
  etiqueta: {
    fontSize: 10,
    color: colors.textFaint,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 1,
  },
});
