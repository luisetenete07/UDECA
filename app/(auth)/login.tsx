import React, { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Logo } from '../../components/Logo';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { auth } from '../../lib/firebase';
import { friendlyAuthError } from '../../lib/firebase-errors';
import { colors, fonts, gradients, spacing, typography } from '../../lib/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Escribe tu correo arriba y vuelve a pulsar el enlace.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Te hemos enviado un correo para restablecer tu contraseña. Revisa tu bandeja (y el spam).');
    } catch (e) {
      setError(friendlyAuthError(e));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);
    if (!email || !password) {
      setError('Introduce tu correo electrónico y contraseña.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <LinearGradient
          colors={gradients.goldHalo}
          style={styles.heroGlow}
          pointerEvents="none"
        />
        <Logo />
        <Text style={styles.title}>Bienvenido de nuevo</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar con tu entrenamiento</Text>
      </View>

      <Card accent style={styles.formCard}>
        <TextField
          label="Correo electrónico"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          placeholder="tucorreo@ejemplo.com"
        />
        <TextField
          label="Contraseña"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <Button
          title="Iniciar sesión"
          onPress={handleSubmit}
          loading={loading}
          style={styles.submit}
        />

        <Pressable onPress={handleForgotPassword} hitSlop={6}>
          <Text style={styles.forgot}>¿Has olvidado tu contraseña?</Text>
        </Pressable>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿No tienes cuenta?</Text>
        <Link href="/(auth)/register" asChild>
          <Text style={styles.link}> Regístrate</Text>
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  heroGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: -70,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  formCard: {
    padding: spacing.lg,
  },
  error: {
    ...typography.small,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  info: {
    ...typography.small,
    color: colors.primary,
    marginBottom: spacing.md,
    lineHeight: 19,
  },
  forgot: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    textDecorationLine: 'underline',
  },
  submit: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: colors.textMuted,
  },
  link: {
    ...typography.body,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
});
