import React, { useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { db } from '../lib/firebase';
import { frase } from '../lib/idioma';
import {
  FICHA_EN_GOOGLE_PLAY,
  FICHA_EN_LA_APP_STORE,
  PLAY_DIRECTO,
  tocaActualizar,
} from '../lib/version';
import { VERSION_DE_LA_APP } from '../lib/versionDeLaApp';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * El muro de "actualiza para seguir".
 *
 * Tapa la app entera y no se puede cerrar. Es a propósito: si se pudiera
 * apartar no sería obligatorio, sería un consejo, y un consejo lo ignora
 * exactamente la gente que peor versión tiene.
 *
 * CUÁNDO APARECE
 *
 * Solo cuando el servidor dice que esta versión ya no vale (`config/version`,
 * campo `minima`). Ver lib/version.ts para el porqué de cada decisión: por qué
 * se compara la versión y no el número de compilación, y por qué ante cualquier
 * duda NO se bloquea.
 *
 * SE VUELVE A MIRAR AL VOLVER A LA APP
 *
 * Y no solo al arrancar. Quien deja la app abierta en segundo plano durante
 * días no volvería a preguntar nunca, que son justo los móviles que más se
 * quedan atrás. Al volver del segundo plano, además, es cuando acaba de
 * actualizar desde la tienda: es el momento en el que el muro tiene que
 * desaparecer solo.
 *
 * EN LA WEB NO SE USA
 *
 * Ahí no hay tienda ni versión instalada: la versión nueva llega recargando, y
 * de eso se encarga el aviso de app/+html.tsx, que también es obligatorio.
 */
export function ActualizacionObligatoria() {
  const [minima, setMinima] = useState<unknown>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let vivo = true;

    const mirar = () => {
      getDoc(doc(db, 'config', 'version'))
        .then((s) => {
          if (vivo) setMinima(s.exists() ? s.data()?.minima : null);
        })
        // Sin red, sin permiso o sin documento: no se bloquea a nadie. Un muro
        // por un fallo de red deja fuera a todo el mundo a la vez.
        .catch(() => {});
    };

    mirar();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') mirar();
    });
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);

  if (!tocaActualizar(VERSION_DE_LA_APP, minima)) return null;

  const abrirTienda = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL(FICHA_EN_LA_APP_STORE).catch(() => {});
      return;
    }
    // En Android el esquema de Play abre la app directamente; si el móvil no
    // tiene los servicios de Google, queda la web.
    Linking.openURL(PLAY_DIRECTO).catch(() =>
      Linking.openURL(FICHA_EN_GOOGLE_PLAY).catch(() => {})
    );
  };

  return (
    <View style={styles.fondo}>
      <View style={styles.caja}>
        <View style={styles.icono}>
          <Ionicons name="arrow-up-circle" size={30} color={colors.primary} />
        </View>
        <Text style={styles.titulo}>Hay una versión nueva</Text>
        {/* Se dice POR QUÉ, no solo que hay que hacerlo. Un muro sin motivo se
            lee como un capricho; con motivo, se entiende y se pulsa. */}
        <Text style={styles.texto}>
          Esta versión de UDECA ya no está al día. Actualiza para seguir
          entrenando: tus datos, tus rutinas y tu progreso te esperan intactos.
        </Text>
        <Button
          title={Platform.OS === 'ios' ? 'Actualizar en la App Store' : 'Actualizar en Google Play'}
          onPress={abrirTienda}
          style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
        />
        <Text style={styles.version}>
          {frase`Tienes la ${VERSION_DE_LA_APP || '—'}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Opaco del todo: se tapa lo que hubiera debajo, no se difumina. Ver algo a
    // medias por detrás invita a intentar tocarlo.
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    // Por encima de todo lo demás, avisos incluidos.
    zIndex: 9999,
  },
  caja: { width: '100%', maxWidth: 380, alignItems: 'center' },
  icono: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  titulo: { ...typography.h1, color: colors.text, textAlign: 'center' },
  texto: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  version: {
    ...typography.small,
    color: colors.textFaint,
    marginTop: spacing.md,
    fontFamily: fonts.medium,
  },
});
