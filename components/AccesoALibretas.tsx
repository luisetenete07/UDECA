import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Texto';
import { CardButton } from './CardButton';
import { frase } from '../lib/idioma';
import { contarLibretas } from '../lib/firestore/mealBooks';
import { colors, fonts, gradients, radius, spacing, typography } from '../lib/theme';

/**
 * La entrada a las libretas de comida, en Clientes.
 *
 * Era una fila gris con un libro pequeño y una frase: se leía como un aviso,
 * no como algo que abrir. Ahora tiene el mismo cuerpo que las fichas de los
 * alumnos de encima, un icono que se ve y lo que hay dentro ("3 libretas"), que
 * es lo que dice si vale la pena entrar.
 */
export function AccesoALibretas({ trainerId }: { trainerId: string }) {
  const router = useRouter();
  const [cuantas, setCuantas] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      contarLibretas(trainerId)
        .then((n) => {
          if (vivo) setCuantas(n);
        })
        .catch(() => {});
      return () => {
        vivo = false;
      };
    }, [trainerId])
  );

  const sub =
    cuantas === null
      ? 'Recetas y platos por foto para tu grupo'
      : cuantas === 0
        ? 'Crea la primera: recetas y platos por foto para tu grupo'
        : cuantas === 1
          ? frase`1 libreta para todo tu grupo`
          : frase`${cuantas} libretas para todo tu grupo`;

  return (
    <CardButton
      onPress={() => router.push('/(trainer)/clients/meal-books')}
      style={styles.card}
    >
      <LinearGradient
        colors={gradients.gold}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.icono}
      >
        <Ionicons name="restaurant" size={20} color={colors.onPrimary} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={styles.titulo}>Libretas de comida</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </CardButton>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  icono: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { ...typography.h3, color: colors.text },
  sub: { ...typography.small, color: colors.textMuted, marginTop: 2, fontFamily: fonts.body },
});
