import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MarcaDeAgua } from './MarcaDeAgua';
import { VideoPlayer } from './VideoPlayer';
import { t } from '../lib/idioma';
import { margenesDelLienzo, pantallaCompleta, relacionDelVideo, sePuedeGirar } from '../lib/visorDeVideo';
import { colors, spacing } from '../lib/theme';
import type { UserProfile } from '../lib/types';

/**
 * Un vídeo a PANTALLA COMPLETA, sin salir de la app.
 *
 * Se abre así siempre: un vídeo de técnica durante el entreno y una clase de
 * un curso. Abrirlo ya es darle al play, así que empieza solo, y ocupa la
 * pantalla entera de borde a borde, que es además lo que hace que YouTube
 * escoja su mejor calidad (ver lib/visorDeVideo y `paraPantallaCompleta` en
 * lib/video).
 *
 * Es una pantalla completa NUESTRA, no la del sistema. La del sistema —la del
 * navegador o la del reproductor— pinta el vídeo POR ENCIMA de todo, y con él
 * se van la marca de agua con el nombre de quien mira y la tapa de la barra de
 * YouTube. Aquí el vídeo sigue siendo un elemento de la app: se ve igual de
 * grande y sigue protegido.
 *
 * En el móvil de pie un vídeo apaisado se pinta GIRADO, para verlo tumbando el
 * móvil; si alguien prefiere no girarlo, tiene el botón de al lado de cerrar.
 *
 * Se usa en todos los sitios donde hay vídeo porque las protecciones tienen que
 * ser las mismas en todos. Dos visores distintos serían dos sitios donde se
 * puede colar un botón de compartir.
 */
export function VisorDeVideo({
  url,
  titulo,
  profile,
  visible,
  onCerrar,
  protegido = true,
}: {
  url?: string;
  titulo?: string;
  profile: Pick<UserProfile, 'name' | 'uid'> | null | undefined;
  visible: boolean;
  onCerrar: () => void;
  /**
   * Si el vídeo va BLINDADO (el reproductor de la plataforma tapado con un
   * cristal y con controles nuestros) o con el embed normal.
   *
   * Las CLASES DE UN CURSO van blindadas: son el material que se vende, y ahí
   * el logo, el título y el "Ver en YouTube" son puertas para sacarlo.
   *
   * Los VÍDEOS DE TÉCNICA de un ejercicio, no. Es un enlace público de YouTube
   * que el entrenador ha pegado para que se vea dónde va el codo: no hay nada
   * que proteger, y el blindaje es la parte más frágil de todo esto —depende de
   * que la API de YouTube conteste dentro de una página con origen prestado—.
   * Poner en riesgo el vídeo que más se mira, para proteger un enlace que
   * cualquiera puede buscar, sale carísimo.
   *
   * Lo que NO cambia con esto: la marca de agua sigue encima, el vídeo sigue
   * sin poder navegar fuera de la app y sin la pantalla completa del sistema.
   */
  protegido?: boolean;
}) {
  const ventana = useWindowDimensions();
  const seguros = useSafeAreaInsets();
  /*
   * LA MEDIDA ES LA DEL PROPIO VISOR, NO LA DE LA VENTANA.
   *
   * En Android, según el móvil, la ventana cuenta o no la barra de navegación,
   * y un lienzo girado que no mide exactamente lo que la pantalla se queda
   * descentrado: con el vídeo asomando por un lado y una franja por el otro.
   * La ventana solo vale para el primer fotograma, antes de que se mida.
   */
  const [medida, setMedida] = useState<{ width: number; height: number } | null>(null);
  const [enVertical, setEnVertical] = useState(false);
  const relacion = relacionDelVideo(url);
  const ancho = medida?.width ?? ventana.width;
  const alto = medida?.height ?? ventana.height;
  const pc = pantallaCompleta(ancho, alto, relacion, enVertical);
  const m = margenesDelLienzo(seguros, pc.girado);

  // Cada vídeo se abre como se abre por defecto: girado si toca.
  useEffect(() => {
    if (!visible) setEnVertical(false);
  }, [visible]);

  usePantallaCompletaDelNavegador(visible, relacion > 1);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onCerrar}
      // De borde a borde: el vídeo también va por debajo de las barras del
      // sistema, que en esta pantalla no pintan nada.
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      {visible ? <StatusBar hidden /> : null}
      <View
        style={styles.fondo}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setMedida((antes) =>
            antes && antes.width === width && antes.height === height ? antes : { width, height }
          );
        }}
      >
        <View
          accessibilityLabel={titulo}
          style={[
            styles.lienzo,
            {
              width: pc.ancho,
              height: pc.alto,
              // Centrado a mano y no con flex: girado, el lienzo es más ancho
              // que la pantalla, y así no depende de cómo reparta cada
              // plataforma lo que se sale.
              left: (ancho - pc.ancho) / 2,
              top: (alto - pc.alto) / 2,
              transform: pc.girado ? [{ rotate: '90deg' }] : [],
            },
          ]}
        >
          {/* Una View a secas: ahí dentro están los controles del reproductor,
              y no puede haber nada por encima que le robe el toque. */}
          <View style={[styles.marco, { width: pc.video.width, height: pc.video.height }]}>
            <MarcaDeAgua profile={profile}>
              <VideoPlayer url={url} protectedContent={protegido} pantallaCompleta />
            </MarcaDeAgua>
          </View>

          {/*
           * LOS BOTONES, EN COLUMNA Y PEGADOS A LA ESQUINA.
           *
           * En el móvil girado el vídeo deja una franja negra a cada lado, y en
           * columna caben dentro: no tapan ni un píxel de la imagen. En fila se
           * meterían encima del vídeo.
           */}
          <View
            style={[
              styles.botones,
              { top: Math.max(spacing.md, m.top + spacing.xs), right: Math.max(spacing.md, m.right + spacing.xs) },
            ]}
          >
            <Pressable
              onPress={onCerrar}
              hitSlop={10}
              style={styles.boton}
              accessibilityRole="button"
              accessibilityLabel={t('Cerrar vídeo')}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            {sePuedeGirar(ancho, alto, relacion) ? (
              <Pressable
                onPress={() => setEnVertical((v) => !v)}
                hitSlop={10}
                style={styles.boton}
                accessibilityRole="button"
                accessibilityLabel={t(pc.girado ? 'Ver sin girar' : 'Ver en horizontal')}
              >
                <Ionicons
                  name={pc.girado ? 'phone-portrait-outline' : 'phone-landscape-outline'}
                  size={19}
                  color={colors.text}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * En el navegador, además, fuera las barras del propio navegador.
 *
 * Se pone a pantalla completa la PÁGINA entera, no el vídeo: así lo que ocupa
 * la pantalla sigue siendo nuestro, con la marca de agua y la tapa encima. Si
 * fuera el vídeo, el navegador lo pintaría solo y se perdería todo eso.
 *
 * Donde el navegador lo deja (Chrome en Android), se tumba la pantalla para un
 * vídeo apaisado, y entonces el visor ya no necesita girarlo. Donde no (el
 * iPhone, que no tiene pantalla completa de página), no pasa nada: el visor ya
 * ocupa toda la ventana igualmente.
 *
 * Solo se sale de la pantalla completa si la ha pedido el visor: si quien mira
 * ya estaba en ella por su cuenta, se queda como estaba.
 */
function usePantallaCompletaDelNavegador(activo: boolean, apaisado: boolean) {
  useEffect(() => {
    if (!activo || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const raiz = document.documentElement as HTMLElement & {
      requestFullscreen?: (o?: { navigationUI?: string }) => Promise<void>;
    };
    if (document.fullscreenElement || typeof raiz.requestFullscreen !== 'function') return;
    let vivo = true;
    let pedida = false;
    const orientacion = (typeof screen !== 'undefined' ? screen.orientation : undefined) as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined;
    try {
      pedida = true;
      raiz
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => {
          if (vivo && apaisado && orientacion?.lock) orientacion.lock('landscape').catch(() => {});
        })
        .catch(() => {
          pedida = false;
        });
    } catch {
      pedida = false;
    }
    return () => {
      vivo = false;
      try {
        orientacion?.unlock?.();
      } catch {
        /* sin bloqueo que quitar */
      }
      if (pedida && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [activo, apaisado]);
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  lienzo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  marco: { overflow: 'hidden', backgroundColor: '#000' },
  botones: { position: 'absolute', gap: spacing.sm },
  boton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
