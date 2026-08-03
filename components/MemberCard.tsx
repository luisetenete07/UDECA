import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { shareMemberImage } from '../lib/brandCards';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { colors, fonts, gradients, radius, spacing, typography } from '../lib/theme';
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

      {esFundador ? (
        <View style={styles.sello}>
          <View style={styles.selloAnilla}>
            <Text style={styles.selloNumero}>{profile.founderNumber}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fundadorTitulo}>Miembro fundador</Text>
            <Text style={styles.fundadorTexto}>
              Nº {profile.founderNumber} de UDECA. Estuviste aquí desde el principio, y eso
              no se puede volver a conseguir.
            </Text>
          </View>
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
  sello: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  selloAnilla: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selloNumero: { ...typography.h2, color: colors.text, fontFamily: fonts.heading },
  fundadorTitulo: { ...typography.body, color: colors.primaryBright, fontFamily: fonts.semiBold },
  fundadorTexto: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  frase: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  pie: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nombre: { ...typography.h3, color: colors.text },
  desde: { ...typography.small, color: colors.textFaint, marginTop: 2 },
});
