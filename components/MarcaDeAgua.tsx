import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  addScreenshotListener,
  allowScreenCaptureAsync,
  disableAppSwitcherProtectionAsync,
  enableAppSwitcherProtectionAsync,
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
 *
 * Van con ello otras dos cosas:
 *
 *  - El velo del CAMBIADOR DE APLICACIONES (iOS). Sin él quedaba un agujero
 *    tonto: el sistema guarda una foto de la app al salir de ella, y esa foto
 *    —con el fotograma de la clase— sí se puede fotografiar desde el
 *    cambiador. En Android ya lo tapa FLAG_SECURE.
 *  - El AVISO DE CAPTURA. Donde el bloqueo no llega (un iOS viejo), al menos
 *    se sabe que ha pasado y se puede reaccionar: se tapa el vídeo. No es una
 *    cerradura, es que quien lo intente sepa que no ha pasado desapercibido.
 */
export function useProteccionDePantalla(activo: boolean, alCapturar?: () => void) {
  // En una referencia y no en las dependencias: si no, cada render del padre
  // apagaría y encendería el bloqueo, y hay un instante entre las dos cosas.
  const avisar = useRef(alCapturar);
  avisar.current = alCapturar;

  useEffect(() => {
    if (!activo || Platform.OS === 'web') return;
    preventScreenCaptureAsync(CLAVE).catch(() => {});
    if (Platform.OS === 'ios') enableAppSwitcherProtectionAsync(0.9).catch(() => {});
    const sub = addScreenshotListener(() => avisar.current?.());
    return () => {
      allowScreenCaptureAsync(CLAVE).catch(() => {});
      if (Platform.OS === 'ios') disableAppSwitcherProtectionAsync().catch(() => {});
      sub.remove();
    };
  }, [activo]);
}

/**
 * Cierra en el navegador todo lo que sirve para llevarse el contenido.
 *
 * En el ordenador no hay FLAG_SECURE ni nada que se le parezca: la grabación
 * de pantalla la hace el sistema y ningún navegador puede prohibirla. Lo que
 * sí se puede cerrar es todo lo demás, que es por donde se va el material de
 * verdad: el menú del clic derecho (guardar, copiar la dirección, inspeccionar
 * el vídeo), seleccionar y copiar el texto de la clase, arrastrar una imagen
 * fuera de la pestaña, y el botón de compartir del navegador.
 *
 * Se enciende solo mientras hay una lección abierta. Fuera de ahí la app tiene
 * que comportarse como una app normal: el alumno copia su código de invitación
 * o el enlace de un ejercicio, y eso está bien.
 */
export function useSinCopiaEnWeb(activo: boolean) {
  useEffect(() => {
    if (!activo || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const frenar = (e: Event) => e.preventDefault();
    const sucesos = ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut'];
    for (const s of sucesos) document.addEventListener(s, frenar, true);
    const antes = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      for (const s of sucesos) document.removeEventListener(s, frenar, true);
      document.body.style.userSelect = antes;
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
