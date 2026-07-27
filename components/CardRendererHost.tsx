import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Renderizador de las tarjetas de marca en móvil.
 *
 * En nativo no existe <canvas>, así que montamos un WebView invisible que
 * ejecuta el mismo código de dibujo que la web (ver lib/cardEngine) y nos
 * devuelve el PNG en base64. Se monta una sola vez en el layout raíz, igual
 * que el anfitrión de los avisos, y se usa de forma imperativa.
 */

type Pending = {
  resolve: (base64: string) => void;
  reject: (error: Error) => void;
};

let submit: ((html: string, pending: Pending) => void) | null = null;

const RENDER_TIMEOUT_MS = 15000;

/** ¿Hay un renderizador montado y disponible? (siempre false en web) */
export function canRenderCardNatively(): boolean {
  return submit !== null;
}

/**
 * Pinta el documento HTML de la tarjeta y devuelve el PNG en base64 (sin el
 * prefijo `data:`). Rechaza si no hay renderizador, si tarda demasiado o si el
 * dibujo falla, para que quien llame pueda caer al texto.
 */
export function renderCardBase64(html: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!submit) {
      reject(new Error('El renderizador de tarjetas no está montado'));
      return;
    }
    submit(html, { resolve, reject });
  });
}

export function CardRendererHost() {
  const [html, setHtml] = useState<string | null>(null);
  const pending = useRef<Pending | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cierra la petición en curso: limpia el temporizador, descarga el WebView y
  // entrega el resultado (o el error) una única vez.
  const finish = (base64: string | null, error?: Error) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const current = pending.current;
    pending.current = null;
    setHtml(null);
    if (!current) return;
    if (base64) current.resolve(base64);
    else current.reject(error ?? new Error('No se pudo generar la imagen'));
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    submit = (nextHtml, next) => {
      // Solo una tarjeta a la vez: si llega otra mientras se dibuja, se
      // rechaza en vez de pisar la anterior.
      if (pending.current) {
        next.reject(new Error('Ya se está generando otra imagen'));
        return;
      }
      pending.current = next;
      setHtml(nextHtml);
      timer.current = setTimeout(() => {
        finish(null, new Error('La imagen tardó demasiado'));
      }, RENDER_TIMEOUT_MS);
    };
    return () => {
      submit = null;
      if (timer.current) clearTimeout(timer.current);
    };
    // Se monta una vez: `finish` solo usa refs y setState, ambos estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (Platform.OS === 'web' || !html) return null;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        // El canvas de 1080×1350 se dibuja fuera de pantalla; el WebView solo
        // hace de motor, nunca se ve.
        onMessage={(event) => {
          const data = event.nativeEvent.data ?? '';
          if (data.startsWith('ERROR:')) {
            finish(null, new Error(data.slice(6)));
            return;
          }
          const comma = data.indexOf(',');
          finish(comma >= 0 ? data.slice(comma + 1) : null);
        }}
        onError={() => finish(null, new Error('No se pudo cargar el renderizador'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -9999,
    top: -9999,
  },
});
