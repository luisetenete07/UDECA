import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { shareMemberImage } from '../lib/brandCards';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { colors, fonts, gradients, radius, spacing, tabularNums, typography } from '../lib/theme';
import type { UserProfile } from '../lib/types';

/** Cómo se llama cada tipo de cuenta y qué hace, en una línea. */
function tipoDeCuenta(profile: UserProfile | null): { etiqueta: string; frase: string; icono: keyof typeof Ionicons.glyphMap } {
  switch (profile?.role) {
    case 'trainer':
      return { etiqueta: 'Entrenador', frase: 'Dirige, mide y cobra', icono: 'people' };
    case 'athlete':
      return { etiqueta: 'Atleta', frase: 'Entrena por su cuenta', icono: 'barbell' };
    default:
      return { etiqueta: 'Alumno', frase: 'Entrena con su entrenador', icono: 'person' };
  }
}

/** "julio de 2026" a partir de la fecha de alta. */
function desdeCuando(ts?: number): string | undefined {
  if (!ts) return undefined;
  return new Date(ts).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

/**
 * El carné de la cuenta, en el perfil.
 *
 * Dos cosas en una: dice qué tipo de cuenta es —entrenador, atleta o alumno— y,
 * a quien entró durante la campaña, le enseña su número de fundador.
 *
 * El número lo reparte el servidor al pagar el alta y es correlativo: el 7 es
 * el séptimo, y lo sigue siendo pase lo que pase. Ahí está su valor; un
 * distintivo que cualquiera pudiera ponerse no lo tendría, y por eso las reglas
 * impiden escribirlo desde la app.
 *
 * Se comparte como imagen: es lo que hace que la campaña se mueva sola.
 */
export function MemberCard() {
  const { profile } = useAuth();
  const [compartiendo, setCompartiendo] = React.useState(false);
  if (!profile) return null;

  const tipo = tipoDeCuenta(profile);
  const esFundador = typeof profile.founderNumber === 'number' && profile.founderNumber > 0;
  const desde = desdeCuando(profile.createdAt);

  const compartir = async () => {
    setCompartiendo(true);
    try {
      const r = await shareMemberImage({
        name: profile.name,
        roleLabel: tipo.etiqueta,
        founderNumber: esFundador ? profile.founderNumber : undefined,
        since: desde,
        tagline: tipo.frase,
      });
      if (r === 'downloaded') showToast('Tarjeta descargada');
    } catch {
      showToast('No se pudo crear la tarjeta');
    } finally {
      setCompartiendo(false);
    }
  };

  return (
    <View style={[styles.carne, esFundador && styles.carneFundador]}>
      {esFundador ? (
        <LinearGradient
          colors={gradients.goldSubtle}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <View style={styles.cabecera}>
        <View style={styles.tipo}>
          <Ionicons name={tipo.icono} size={14} color={colors.primary} />
          <Text style={styles.tipoTexto}>{tipo.etiqueta.toUpperCase()}</Text>
        </View>
        <Pressable onPress={compartir} hitSlop={10} disabled={compartiendo}>
          <Ionicons
            name="share-outline"
            size={18}
            color={compartiendo ? colors.textFaint : colors.primary}
          />
        </Pressable>
      </View>

      {/* El número manda. Es lo que se enseña, lo que no se puede volver a
          conseguir y lo único de esta tarjeta que nadie más va a tener: darle
          el tamaño de un párrafo era esconderlo. El texto explicativo sobra —
          un número con almohadilla se entiende solo. */}
      {esFundador ? (
        <View style={styles.numeroBloque}>
          <Text style={styles.numeroEtiqueta}>Miembro fundador</Text>
          <Text style={styles.numeroGrande}>
            #{String(profile.founderNumber).padStart(4, '0')}
          </Text>
        </View>
      ) : (
        <Text style={styles.frase}>{tipo.frase}</Text>
      )}

      <View style={styles.pie}>
        <Text style={styles.nombre} numberOfLines={1}>
          {profile.name}
        </Text>
        {desde ? <Text style={styles.desde}>Miembro desde {desde}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carne: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  carneFundador: { borderColor: colors.hairline },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tipo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipoTexto: {
    ...typography.small,
    color: colors.primary,
    letterSpacing: 1.5,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  frase: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  numeroBloque: { marginTop: spacing.lg, marginBottom: spacing.xs },
  numeroEtiqueta: {
    ...typography.small,
    color: colors.primaryBright,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  numeroGrande: {
    fontFamily: fonts.display,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -2,
    color: colors.text,
    ...tabularNums,
  },
  pie: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nombre: { ...typography.h3, color: colors.text },
  desde: { ...typography.small, color: colors.textFaint, marginTop: 2 },
});
