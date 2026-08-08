import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, fieldLabel, fonts, radius, spacing, typography } from '../lib/theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Estilo del contenedor exterior (p. ej. flex:1 para repartir una fila). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Acceso al TextInput interno (p. ej. para enfocar el campo siguiente). */
  ref?: React.Ref<TextInput>;
}

/**
 * Ajustes comunes de un campo de correo. Se comparten entre login y registro
 * para que ambos se comporten igual. El corrector y las sugerencias del teclado
 * van desactivados: al escribir direcciones pueden interferir con caracteres
 * como el punto o el guion.
 */
export const emailFieldProps = {
  autoCapitalize: 'none',
  autoCorrect: false,
  spellCheck: false,
  keyboardType: 'email-address',
  textContentType: 'emailAddress',
  autoComplete: 'email',
} as const satisfies Partial<TextInputProps>;

export function TextField({
  label,
  error,
  style,
  containerStyle,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  // El borde no salta a oro: entra. Es el mismo gesto que hace un botón al
  // hundirse —confirmar que la app te ha oído— y aquí importa más, porque un
  // campo de texto es donde más tiempo se pasa mirando sin que pase nada.
  const foco = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.timing(foco, {
      toValue: focused ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.quad),
      // El color del borde no lo puede animar el hilo nativo.
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [focused, foco]);

  const borde = foco.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <AnimatedTextInput
        placeholderTextColor={colors.textFaint}
        style={[
          styles.input,
          { borderColor: borde },
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: fieldLabel,
  input: {
    minHeight: 52,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.text,
    // Sin esto el texto que se escribe sale con la fuente del sistema, distinta
    // de todo lo que lo rodea: se nota aunque no se sepa decir por qué.
    fontFamily: fonts.body,
    fontSize: 15,
    width: '100%',
  },
  inputFocused: {
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    ...typography.small,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
