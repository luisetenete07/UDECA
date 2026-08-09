import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Entrar con Google.
 *
 * El logo va en SVG y con sus cuatro colores de siempre. No es capricho: las
 * condiciones de marca de Google exigen su logo tal cual, y además es lo que
 * hace que el botón se reconozca sin leerlo. Un círculo dorado con una "G"
 * dentro se parece a cualquier otra cosa.
 *
 * El botón es blanco sobre fondo negro, al revés que el resto de la app, por
 * lo mismo: es el botón de otra empresa y tiene que verse como tal. Aquí
 * "encajar con el diseño" es exactamente lo que no hay que hacer.
 */

function LogoGoogle({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

export function BotonGoogle({
  texto = 'Continuar con Google',
  cargando,
  onPress,
}: {
  texto?: string;
  cargando?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={cargando}
      style={({ pressed }) => [styles.boton, pressed && styles.pulsado, cargando && styles.ocupado]}
      accessibilityRole="button"
      accessibilityLabel={texto}
    >
      {cargando ? (
        <ActivityIndicator size="small" color="#1F1F1F" />
      ) : (
        <>
          <LogoGoogle />
          <Text style={styles.texto}>{texto}</Text>
        </>
      )}
    </Pressable>
  );
}

/** "o" entre el correo y Google, con sus dos rayas. */
export function Separador({ texto = 'o' }: { texto?: string }) {
  return (
    <View style={styles.separador}>
      <View style={styles.raya} />
      <Text style={styles.separadorTexto}>{texto}</Text>
      <View style={styles.raya} />
    </View>
  );
}

const styles = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
  },
  pulsado: { opacity: 0.85 },
  ocupado: { opacity: 0.7 },
  // El texto en el gris de Google, no en negro puro: es el suyo.
  texto: { ...typography.body, color: '#1F1F1F', fontFamily: fonts.semiBold },
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  raya: { flex: 1, height: 1, backgroundColor: colors.border },
  separadorTexto: { ...typography.small, color: colors.textFaint },
});
