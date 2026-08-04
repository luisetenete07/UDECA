import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

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

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[
          styles.input,
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
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 52,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.text,
    fontSize: 15,
    /**
     * Los campos escribían en la letra del sistema.
     *
     * Es el único sitio de la app donde no mandaba Inter, porque un TextInput
     * sin `fontFamily` cae en la del móvil: Roboto en Android, San Francisco en
     * iPhone, Helvetica en el navegador. No se nota mirando un campo — se nota
     * al mirar el formulario entero, donde la etiqueta y el texto tecleado
     * parecen de dos aplicaciones distintas. En media, además, porque lo que
     * escribe el usuario es un dato, no un párrafo.
     */
    fontFamily: fonts.medium,
    width: '100%',
  },
  inputFocused: {
    borderColor: colors.primary,
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
