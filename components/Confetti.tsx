import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const COLORS = ['#C9BDB0', '#A2968B', '#8A7E73', '#FFFFFF', '#D4AF37'];
const PIECES = 26;

interface Piece {
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
}

/**
 * Lluvia de confeti en la paleta oro de UDECA para celebrar hitos
 * (sesión completada, récords). Sin dependencias: RN Animated puro.
 * Se reproduce una vez al montar y desaparece sola.
 */
export function Confetti() {
  const { width, height } = Dimensions.get('window');
  const progress = useRef(new Animated.Value(0)).current;

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        x: Math.random() * width,
        size: 6 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 500,
        duration: 2400 + Math.random() * 1400,
        drift: (Math.random() - 0.5) * 120,
        spin: (Math.random() - 0.5) * 8,
      })),
    [width]
  );

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 3800,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => {
        // Cada pieza recorta su tramo temporal del progreso global.
        const start = piece.delay / 3800;
        const end = Math.min(1, (piece.delay + piece.duration) / 3800);
        const translateY = progress.interpolate({
          inputRange: [start, end],
          outputRange: [-40, height + 40],
          extrapolate: 'clamp',
        });
        const translateX = progress.interpolate({
          inputRange: [start, end],
          outputRange: [0, piece.drift],
          extrapolate: 'clamp',
        });
        const rotate = progress.interpolate({
          inputRange: [start, end],
          outputRange: ['0deg', `${piece.spin * 180}deg`],
          extrapolate: 'clamp',
        });
        const opacity = progress.interpolate({
          inputRange: [start, Math.max(start, end - 0.12), end],
          outputRange: [1, 1, 0],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: piece.x,
              width: piece.size,
              height: piece.size * 0.45,
              borderRadius: 2,
              backgroundColor: piece.color,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
