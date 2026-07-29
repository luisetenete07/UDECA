import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import { describeError, logError } from '../lib/errorLog';

/**
 * Red de seguridad de la app. Si una pantalla lanza un error al pintarse, sin
 * esto el usuario se queda con la pantalla en blanco y solo puede cerrar la
 * app. Aquí lo atrapamos y ofrecemos volver a intentarlo, conservando la
 * sesión: para el usuario es un tropiezo, no una app rota.
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  // Se registra aquí y no en getDerivedStateFromError porque ese método debe
  // ser puro: React puede llamarlo más de una vez por el mismo fallo.
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const { message, stack } = describeError(error);
    void logError({
      message,
      stack: stack ?? info.componentStack ?? undefined,
      where: 'render',
      fatal: true,
    });
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.icon}>
          <Ionicons name="warning-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>Algo no ha ido bien</Text>
        <Text style={styles.subtitle}>
          Ha fallado esta pantalla, pero tu sesión y tus entrenamientos siguen a salvo.
          Vuelve a intentarlo.
        </Text>
        <Pressable onPress={this.reset} style={styles.button}>
          <Ionicons name="refresh" size={18} color={colors.onPrimary} />
          <Text style={styles.buttonText}>Reintentar</Text>
        </Pressable>
        {__DEV__ ? <Text style={styles.detail}>{error.message}</Text> : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 380,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  buttonText: { ...typography.body, color: colors.onPrimary, fontFamily: fonts.semiBold },
  detail: {
    ...typography.small,
    color: colors.textFaint,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
