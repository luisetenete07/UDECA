import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  parseVimeoUrl,
  parseYouTubeId,
  seQuedaDentro,
  vimeoEmbedUrl,
  youTubeEmbedUrl,
} from '../lib/video';
import { colors, radius, spacing, typography } from '../lib/theme';

/**
 * Reproductor de vídeo de lecciones. Protecciones aplicadas:
 * - Solo se carga si el alumno tiene sesión y acceso (garantizado por las
 *   reglas de Firestore antes de llegar aquí).
 * - En web: sin botón de descarga (controlsList=nodownload), sin
 *   Picture-in-Picture y sin menú contextual (clic derecho).
 * - En nativo: los controles del sistema no incluyen opción de descarga.
 * Nota: ningún reproductor web puede impedir al 100% la grabación de
 * pantalla; esto disuade la descarga y el reparto de enlaces.
 */
export function VideoPlayer({
  url,
  protectedContent = false,
}: {
  url?: string;
  /** Cursos: refuerza las protecciones (sin PiP, sin menú contextual). */
  protectedContent?: boolean;
}) {
  if (!url) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="videocam-outline" size={28} color={colors.textFaint} />
        <Text style={styles.placeholderText}>Vídeo no disponible</Text>
      </View>
    );
  }

  // Enlaces de Vimeo: se reproducen con el player oficial embebido, que
  // respeta la privacidad "solo donde esté incrustado" configurada en Vimeo.
  const vimeo = parseVimeoUrl(url);
  if (vimeo) {
    return <VimeoVideo embedUrl={vimeoEmbedUrl(vimeo)} protectedContent={protectedContent} />;
  }

  const youtubeId = parseYouTubeId(url);
  if (youtubeId) {
    return (
      <VimeoVideo embedUrl={youTubeEmbedUrl(youtubeId)} protectedContent={protectedContent} />
    );
  }

  // Archivo de vídeo directo (mp4, HLS...): reproductor propio.
  const looksLikeFile = /\.(mp4|webm|mov|m4v|m3u8)(\?|#|$)/i.test(url);
  if (looksLikeFile) {
    return Platform.OS === 'web' ? <WebVideo url={url} /> : <NativeVideo url={url} />;
  }

  // Cualquier otro enlace (Drive, Dropbox, etc.): se muestra embebido DENTRO
  // de la app (iframe/WebView) para que el usuario nunca salga de UDECA.
  return <VimeoVideo embedUrl={url} protectedContent={protectedContent} />;
}

function VimeoVideo({
  embedUrl,
  protectedContent = false,
}: {
  embedUrl: string;
  protectedContent?: boolean;
}) {
  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      src: embedUrl,
      // Contenido protegido: sin Picture-in-Picture (no se puede "sacar" el
      // vídeo de la app) ni menú contextual sobre el marco.
      allow: protectedContent ? 'autoplay; fullscreen' : 'autoplay; fullscreen; picture-in-picture',
      allowFullScreen: true,
      frameBorder: '0',
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      style: {
        width: '100%',
        aspectRatio: '16 / 9',
        backgroundColor: '#000',
        borderRadius: radius.md,
        border: 'none',
      },
    });
  }
  /*
   * Nativo (iOS/Android): el reproductor dentro de un WebView.
   *
   * Con un vídeo de YouTube, el reproductor incrustado trae sus propios
   * enlaces —el título, el logo, "Ver en YouTube"— y cualquiera de ellos
   * sacaba al alumno de UDECA y lo dejaba en la app de YouTube, con el vídeo
   * del curso a la vista de quien pase por allí y sin forma cómoda de volver.
   *
   * Se arregla no dejando que el WebView navegue a ninguna otra parte: solo
   * carga el propio reproductor y lo que este necesite. Un toque en "Ver en
   * YouTube" no hace nada, que es exactamente lo que tiene que hacer.
   */
  const { WebView } = require('react-native-webview');
  return (
    <View style={styles.video}>
      <WebView
        source={{ uri: embedUrl }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Sin ventanas nuevas: en Android un enlace con target=_blank abría la
        // app de YouTube por su cuenta, sin pasar por la comprobación de abajo.
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        onShouldStartLoadWithRequest={(req: { url: string }) => seQuedaDentro(req.url, embedUrl)}
        style={{ flex: 1, backgroundColor: '#000', borderRadius: radius.md }}
      />
    </View>
  );
}

function NativeVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
      allowsPictureInPicture={false}
    />
  );
}

function WebVideo({ url }: { url: string }) {
  // En web renderizamos un <video> nativo para poder desactivar la descarga.
  const ref = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
    el.setAttribute('disablePictureInPicture', 'true');
    el.setAttribute('disableRemotePlayback', 'true');
    const block = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', block);
    return () => el.removeEventListener('contextmenu', block);
  }, [url]);

  return React.createElement('video', {
    ref,
    src: url,
    controls: true,
    playsInline: true,
    style: {
      width: '100%',
      aspectRatio: '16 / 9',
      backgroundColor: '#000',
      borderRadius: radius.md,
    },
  });
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: radius.md,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeholderText: { ...typography.small, color: colors.textFaint },
});
