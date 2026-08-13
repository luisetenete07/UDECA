import React from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Apuntar un entreno que ya se hizo, otro día.
 *
 * Es la función que más se usa de las que nadie encontraba. Se entrena sin el
 * móvil delante mucho más de lo que parece —en el parque, con las manos llenas
 * de magnesio, con el teléfono en la mochila— y el entreno de ayer se queda sin
 * apuntar. Cuando eso pasa, la racha se rompe, el coach ve un hueco que no
 * existe y quien entrenó de verdad siente que la app le lleva la contraria.
 *
 * Estaba escondida en dos sitios malos: una fila gris dentro de una pestaña de
 * Progreso, y el menú de los tres puntos de la sesión. Los dos son sitios a los
 * que se va a buscar otra cosa. Ahora está donde se cae en la cuenta: al abrir
 * la app y al abrir Entreno.
 *
 * Se pinta con el color de marca y no como un enlace de texto a propósito. No
 * es un ajuste: es una acción, y compite con el impulso de dejarlo para luego,
 * que es como se pierde.
 */
export function RegistrarOtroDia({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter();
  return (
    <PressableScale
      haptic
      onPress={() => router.push('/(client)/registrar')}
      style={[styles.caja, compacto && styles.compacta]}
      accessibilityRole="button"
      accessibilityLabel="Registrar un entreno de otro día"
    >
      <View style={styles.icono}>
        <Ionicons name="create-outline" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.titulo}>Registrar un entreno de otro día</Text>
        {compacto ? null : (
          <Text style={styles.pie}>
            ¿Entrenaste sin el móvil delante? Apúntalo con su fecha y cuenta igual: para tu
            racha, para tu progreso y para tu entrenador.
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  compacta: { paddingVertical: spacing.sm + 2 },
  icono: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  pie: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
});
