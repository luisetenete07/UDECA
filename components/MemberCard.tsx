import React from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from './PressableScale';
import { useAuth } from '../lib/auth-context';
import { numeroFundador } from '../lib/cardStats';
import { colors, fonts, gradients, radius, spacing, tabularNums, typography } from '../lib/theme';

/**
 * La entrada a la tarjeta, desde el perfil.
 *
 * El carné entero vivía aquí, apretado entre el código de invitación y los
 * ajustes y del tamaño de cualquier otra fila. Una cosa que se enseña no puede
 * compartir sitio: en cuanto lo hace, deja de ser lo que se mira.
 *
 * Así que aquí solo queda el anzuelo —el número, que es lo irrepetible— y la
 * tarjeta se abre a pantalla completa, donde se puede girar y enseñar.
 */
export function MemberCard() {
  const { profile } = useAuth();
  const router = useRouter();
  if (!profile) return null;

  const esFundador = typeof profile.founderNumber === 'number' && profile.founderNumber > 0;
  const esEntrenador = profile.role === 'trainer';
  const destino = esEntrenador ? '/(trainer)/card' : '/(client)/card';

  return (
    <PressableScale onPress={() => router.push(destino)} style={styles.fila}>
      {esFundador ? (
        <LinearGradient
          colors={gradients.goldSubtle}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <View style={{ flex: 1 }}>
        <Text style={styles.etiqueta}>
          {esFundador ? 'Miembro fundador' : 'Tu tarjeta'}
        </Text>
        {esFundador ? (
          <Text style={styles.numero}>{numeroFundador(profile.founderNumber!)}</Text>
        ) : (
          <Text style={styles.frase}>Tus cifras, para enseñarlas</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  etiqueta: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  numero: {
    fontSize: 30,
    lineHeight: 38,
    fontFamily: fonts.display,
    letterSpacing: -0.8,
    color: colors.primaryBright,
    ...tabularNums,
  },
  frase: { ...typography.body, color: colors.text, fontFamily: fonts.medium, marginTop: 2 },
});
