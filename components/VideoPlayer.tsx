import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
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
export function VideoPlayer({ url }: { url?: string }) {
  if (!url) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="videocam-outline" size={28} color={colors.textFaint} />
        <Text style={styles.placeholderText}>Vídeo próximamente</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return <WebVideo url={url} />;
  }

  return <NativeVideo url={url} />;
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
