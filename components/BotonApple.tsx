import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Entrar con Apple.
 *
 * En iOS se usa el botón NATIVO de Apple, no uno pintado por nosotros. Y no es
 * por comodidad: las normas de la App Store exigen que el botón lleve su
 * logotipo oficial, su texto aprobado, sus colores y sus proporciones, y el
 * botón del sistema cumple todo eso por definición —además de traducirse solo
 * y funcionar con el lector de pantalla—. Un botón casero que se parezca es
 * justo lo que hace que una revisión se caiga.
 *
 * En web no existe ese botón, así que ahí va uno hecho a mano siguiendo las
 * mismas reglas: fondo blanco, manzana negra, texto aprobado.
 *
 * El fondo es blanco y no negro por el fondo de la app: un botón negro sobre
 * negro no se ve, y Apple prohíbe cambiarle el color a su gusto de uno.
 */

function LogoApple({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 814 1000">
      <Path
        fill="#000000"
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zM554.1 159.4c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
      />
    </Svg>
  );
}

/**
 * El botón nativo de iOS.
 *
 * Se carga con `require` y no con `import` a propósito: en web y en Android el
 * módulo no existe, y un import de arriba se evalúa siempre, aunque el
 * componente no se llegue a pintar.
 */
function BotonNativo({ onPress }: { onPress: () => void }) {
  const AppleAuthentication = require('expo-apple-authentication');
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={radius.md}
      style={styles.nativo}
      onPress={onPress}
    />
  );
}

export function BotonApple({
  texto = 'Continuar con Apple',
  cargando,
  onPress,
}: {
  texto?: string;
  cargando?: boolean;
  onPress: () => void;
}) {
  // Mientras se abre la hoja de Apple hace falta enseñar que algo pasa, y el
  // botón del sistema no tiene estado de espera: se tapa con el nuestro.
  if (Platform.OS === 'ios' && !cargando) return <BotonNativo onPress={onPress} />;

  return (
    <Pressable
      onPress={onPress}
      disabled={cargando}
      style={({ pressed }) => [styles.boton, pressed && styles.pulsado, cargando && styles.ocupado]}
      accessibilityRole="button"
      accessibilityLabel={texto}
    >
      {cargando ? (
        <ActivityIndicator size="small" color="#000000" />
      ) : (
        <View style={styles.contenido}>
          <LogoApple />
          <Text style={styles.texto}>{texto}</Text>
        </View>
      )}
    </Pressable>
  );
}

const ALTO = 48;

const styles = StyleSheet.create({
  nativo: { width: '100%', height: ALTO },
  boton: {
    height: ALTO,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  pulsado: { opacity: 0.85 },
  ocupado: { opacity: 0.7 },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  texto: {
    ...typography.body,
    color: '#000000',
    fontFamily: fonts.semiBold,
  },
});
