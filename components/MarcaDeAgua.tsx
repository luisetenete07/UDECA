import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  allowScreenCaptureAsync,
  preventScreenCaptureAsync,
} from 'expo-screen-capture';
import { PASO_MS, posicionDeMarca, textoDeMarca } from '../lib/marcaDeAgua';
import { fonts } from '../lib/theme';
import type { UserProfile } from '../lib/types';

const CLAVE = 'curso';

/**
 * Bloquea capturas y grabación de pantalla mientras el vídeo está abierto.
 *
 * Solo en móvil: en Android FLAG_SECURE deja la captura en negro, y en iOS
 * (11+/13+) el sistema hace lo propio. En web no existe forma de impedirlo, y
 * el módulo lanzaría una excepción, así que ahí ni se intenta.
 *
 * Se enciende y se apaga con el reproductor, no con la app entera: dejar la
 * pantalla bloqueada todo el rato impediría al alumno hacer una captura de su
 * propio entreno para mandársela a su entrenador, que es algo que queremos que
 * haga.
 */
export function useProteccionDePantalla(activo: boolean) {
  useEffect(() => {
    if (!activo || Platform.OS === 'web') return;
    preventScreenCaptureAsync(CLAVE).catch(() => {});
    return () => {
      allowScreenCaptureAsync(CLAVE).catch(() => {});
    };
  }, [activo]);
}

/**
 * El nombre de quien está viendo la clase, encima de la clase.
 *
 * No impide copiar: hace que la copia lleve el nombre de quien la filtró, que
 * contra una cámara apuntando a la pantalla es lo único que queda. Salta de
 * sitio cada pocos segundos porque una marca fija se recorta en diez.
 *
 * No captura toques (`pointerEvents="none"`): el alumno tiene que poder darle
 * a pausa a través de ella.
 */
export function MarcaDeAgua({
  profile,
  children,
}: {
  profile: Pick<UserProfile, 'name' | 'uid'> | null | undefined;
  children: React.ReactNode;
}) {
  const [paso, setPaso] = useState(0);
  const texto = useRef(textoDeMarca(profile));
  texto.current = textoDeMarca(profile);

  useEffect(() => {
    const t = setInterval(() => setPaso((p) => p + 1), PASO_MS);
    return () => clearInterval(t);
  }, []);

  const { x, y } = posicionDeMarca(paso);

  return (
    <View style={styles.caja}>
      {children}
      <View style={styles.capa} pointerEvents="none">
        <Text
          style={[styles.texto, { left: `${x * 100}%`, top: `${y * 100}%` }]}
          numberOfLines={1}
        >
          {texto.current}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { position: 'relative' },
  capa: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  texto: {
    position: 'absolute',
    fontSize: 12,
    fontFamily: fonts.semiBold,
    // Blanco muy apagado con sombra: se lee sobre cualquier fotograma —claro u
    // oscuro— y sigue sin competir con la clase.
    color: 'rgba(255,255,255,0.34)',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
