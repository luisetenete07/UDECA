import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { altoDeLaMuestra, enlaceDeLectura, puedeAbrirse } from '../lib/visorDeEbook';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/*
 * EL LECTOR DE PDF DE TODA LA APP.
 *
 * Nació dentro de la pantalla de los cursos, para los e-books. Ahora lo usan
 * también las recetas de la libreta de comidas, y por eso vive aquí: dos
 * lectores serían dos sitios donde arreglar el recorte, el puente de Android y
 * la cerradura que impide abrirlo en otra ventana — y el día que se arreglara
 * uno, el otro se quedaría con el fallo.
 *
 * Todo lo que decide cómo se abre un documento está en lib/visorDeEbook.ts.
 */

/**
 * El e-book, dentro de la app (iframe en web, WebView en nativo).
 *
 * `lleno` es la diferencia entre una MUESTRA y la LECTURA. Lleno ocupa todo lo
 * que le den —que es toda la pantalla menos la cabecera y el pie— y es como se
 * lee de verdad. Sin llenar es la portada del e-book de apoyo de una clase de
 * vídeo, con la página siguiendo por debajo.
 *
 * La dirección la compone lib/visorDeEbook.ts: allí se decide si la página se
 * encaja a lo ancho o entera, se quita la barra del navegador —que tapaba la
 * primera y la última línea, y lleva el botón de descargar— y se mete el
 * puente de Android, cuyo WebView no sabe pintar un PDF.
 */
export function EmbeddedDoc({ url, lleno }: { url: string; lleno?: boolean }) {
  const { width, height } = useWindowDimensions();
  const src = enlaceDeLectura(url, Platform.OS, width, height);
  const altoMuestra = altoDeLaMuestra(height);
  if (Platform.OS === 'web') {
    const marco = React.createElement('iframe', {
      src,
      style: lleno
        ? { flex: 1, width: '100%', minHeight: 0, backgroundColor: '#000', border: 'none' }
        : {
            width: '100%',
            height: altoMuestra,
            backgroundColor: '#000',
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
          },
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    });
    // Llenando, el iframe necesita un padre con alto de verdad del que colgar:
    // un porcentaje sobre un padre sin medida no es una medida.
    return lleno ? <View style={styles.pdfLleno}>{marco}</View> : marco;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require('react-native-webview');
  return (
    <View style={lleno ? styles.pdfLleno : [styles.pdfNative, { height: altoMuestra }]}>
      <WebView
        source={{ uri: src }}
        // Un e-book de un curso es material de pago igual que el vídeo. Fuera
        // el menú de mantener pulsado (copiar, compartir, "abrir en...") y la
        // vista previa, que son las formas de sacarlo de la app sin descargarlo.
        allowsLinkPreview={false}
        suppressMenuItems={['copy', 'share', 'select', 'selectAll', 'lookup', 'translate']}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        /*
         * Y NO SE ABRE EN NINGUNA VENTANA APARTE.
         *
         * Aquí dentro solo se carga el documento (ver `puedeAbrirse`). El
         * botón de "abrir en una ventana" del visor de Google, un enlace
         * metido dentro del PDF y cualquier redirección quedan fuera: los
         * tres acaban en el mismo sitio, que es el e-book servido en una
         * página con su botón de descargar y su dirección a la vista.
         *
         * Los marcos de dentro pasan (`isTopFrame === false`): el visor de
         * Google pinta el documento en un marco suyo, y cortarlo dejaría
         * Android en blanco.
         */
        onShouldStartLoadWithRequest={(r: { url: string; isTopFrame?: boolean }) =>
          r.isTopFrame === false ? true : puedeAbrirse(r.url, src)
        }
        // La otra puerta: una ventana nueva de verdad. No se abre ninguna.
        onOpenWindow={() => {}}
        allowsBackForwardNavigationGestures={false}
        // Y que iOS no convierta en enlaces tocables lo que escriba el PDF.
        dataDetectorTypes="none"
        // Para poder acercar con los dedos. Sin esto, en un móvil un PDF con
        // letra pequeña no hay manera de leerlo: se ve, pero no se lee.
        scalesPageToFit
        style={{ flex: 1, borderRadius: lleno ? 0 : radius.md }}
      />
    </View>
  );
}

/** El enlace que abre el e-book de apoyo a pantalla completa. */
export function BotonLeerEntero({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.leerEntero} hitSlop={8}>
      <Ionicons name="expand-outline" size={14} color={colors.primary} />
      <Text style={styles.leerEnteroTexto}>Leer a pantalla completa</Text>
    </Pressable>
  );
}

/**
 * El e-book de apoyo, a pantalla completa.
 *
 * Mismo trato que el de la clase que ES un e-book: cabecera con el título y
 * salida, y debajo el documento y nada más. Un e-book no se lee en una ranura.
 */
export function LectorAPantallaCompleta({
  url,
  titulo,
  visible,
  onCerrar,
}: {
  url: string;
  titulo?: string;
  visible: boolean;
  onCerrar: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar} transparent={false}>
      <View style={styles.repFondo}>
        <View style={styles.repCabecera}>
          <Pressable onPress={onCerrar} hitSlop={10} style={styles.repCerrar}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.repCabeceraTexto} numberOfLines={1}>
            {titulo || 'E-book'}
          </Text>
        </View>
        <EmbeddedDoc url={url} lleno />
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  repFondo: { flex: 1, backgroundColor: colors.background },
  repCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    // Sitio para la barra de estado: el lector ocupa la pantalla entera.
    paddingTop: Platform.OS === 'web' ? spacing.md : spacing.xl + spacing.sm,
    paddingBottom: spacing.sm,
  },
  repCerrar: { padding: 2 },
  repCabeceraTexto: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  pdfNative: { borderRadius: radius.md, overflow: 'hidden' },
  /*
   * El documento, a pantalla completa. Sin esquinas redondeadas y sin margen a
   * propósito: un documento con marco parece una tarjeta dentro de una
   * pantalla, y aquí no hay pantalla alrededor — el documento ES la pantalla.
   */
  pdfLleno: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  leerEntero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  leerEnteroTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
