import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/** Ficha de la app en Google Play (el `package` de app.json). */
const PLAY_ID = 'entrenadores.app';
const PLAY_WEB = `https://play.google.com/store/apps/details?id=${PLAY_ID}`;

/**
 * Valorar la app.
 *
 * Antes esto aparecía solo en el inicio del ALUMNO, y a traición: tras cinco
 * entrenos saltaba una tarjeta pidiendo una valoración justo cuando venía a ver
 * su rutina. Pedir por sorpresa en mitad de la tarea es la forma más rápida de
 * ganarse un "ahora no" —y, con suerte, dos estrellas.
 *
 * Ahora vive al final del perfil de quien PAGA la plataforma (entrenador y
 * atleta), que es quien tiene criterio para valorarla y quien entra al perfil
 * precisamente cuando no está entrenando. Está siempre, no interrumpe, y quien
 * quiera valorar sabe dónde encontrarlo.
 *
 * En iOS no se enseña: todavía no hay ficha en la App Store a la que mandar a
 * nadie, y un botón que lleva a un error es peor que no tener botón.
 */
export function RateApp() {
  if (Platform.OS === 'ios') return null;

  const valorar = () => {
    // En Android, market:// abre la app de Play directamente; si no existe
    // (emuladores, móviles sin servicios de Google), queda la web.
    const directo = Platform.OS === 'android' ? `market://details?id=${PLAY_ID}` : PLAY_WEB;
    Linking.openURL(directo).catch(() => Linking.openURL(PLAY_WEB).catch(() => {}));
  };

  return (
    <Card style={styles.card}>
      <View style={styles.fila}>
        <View style={styles.icono}>
          <Ionicons name="star" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>¿Te está gustando UDECA?</Text>
          <Text style={styles.texto}>
            Una valoración tuya vale más que cualquier anuncio: es lo que hace que otros
            se atrevan a probarla.
          </Text>
        </View>
      </View>
      <Pressable onPress={valorar} style={styles.boton} hitSlop={6}>
        <Ionicons name="logo-google-playstore" size={15} color={colors.onPrimary} />
        <Text style={styles.botonTexto}>Valorar la app</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  icono: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  texto: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 9,
    marginTop: spacing.md,
  },
  botonTexto: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold },
});
