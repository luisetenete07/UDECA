import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from './Texto';
import { Card } from './Card';
import { Segmented } from './Segmented';
import { CronoDeDescanso } from './CronoDeDescanso';
import { Cronometro } from './Cronometro';
import { t } from '../lib/idioma';
import { colors, fonts, spacing, typography } from '../lib/theme';

type Reloj = 'cuenta' | 'crono';
const CLAVE = 'calico:reloj-del-entreno';

/**
 * LOS RELOJES DEL ENTRENO: la cuenta atrás y el cronómetro, en una tarjeta.
 *
 * Es lo único que se usa con el móvil en la mano mientras se entrena (ver
 * lib/modoDeEntreno.ts). La cuenta atrás es la de siempre: suena y vibra al
 * acabar y sigue flotando aunque se cambie de pantalla. El cronómetro cuenta
 * hacia arriba, para lo que va por tiempo.
 *
 * Se recuerda cuál se usó la última vez: quien entrena con cronómetro abre la
 * pestaña y lo tiene delante.
 */
export function RelojesDelEntreno() {
  const [reloj, setReloj] = useState<Reloj>('cuenta');

  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((v) => (v === 'crono' || v === 'cuenta') && setReloj(v))
      .catch(() => {});
  }, []);

  const elegir = (r: Reloj) => {
    setReloj(r);
    AsyncStorage.setItem(CLAVE, r).catch(() => {});
  };

  return (
    <Card style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <Ionicons name="timer-outline" size={18} color={colors.primaryBright} />
        <Text style={styles.titulo}>Reloj</Text>
      </View>
      <Segmented<Reloj>
        opciones={[
          { valor: 'cuenta', texto: t('Cuenta atrás'), icono: 'hourglass-outline' },
          { valor: 'crono', texto: t('Cronómetro'), icono: 'stopwatch-outline' },
        ]}
        valor={reloj}
        onChange={elegir}
      />
      {reloj === 'cuenta' ? <CronoDeDescanso sinTarjeta /> : <Cronometro />}
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
});
