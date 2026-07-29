import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Logo } from '../../components/Logo';
import { ScreenContainer } from '../../components/ScreenContainer';
import { emailFieldProps, TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { track } from '../../lib/analytics';
import { auth } from '../../lib/firebase';
import { friendlyAuthError } from '../../lib/firebase-errors';
import {
  forgetAccount,
  getRememberedAccounts,
  type RememberedAccount,
} from '../../lib/rememberedAccounts';
import { colors, fonts, gradients, radius, spacing, typography } from '../../lib/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<RememberedAccount[]>([]);
  // Modo selector: si hay cuentas guardadas y aún no se ha elegido ninguna,
  // mostramos las cuentas en vez del formulario para que solo haya que elegir.
  const [picking, setPicking] = useState(true);
  // Permite saltar del correo a la contraseña al pulsar "siguiente".
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    getRememberedAccounts().then((list) => {
      setAccounts(list);
      setPicking(list.length > 0);
    });
  }, []);

  const pickAccount = (acc: RememberedAccount) => {
    setEmail(acc.email);
    setPassword('');
    setError(null);
    setPicking(false);
  };

  const removeAccount = async (acc: RememberedAccount) => {
    await forgetAccount(acc.email);
    const list = await getRememberedAccounts();
    setAccounts(list);
    if (list.length === 0) setPicking(false);
  };

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
      void track('login_ok');
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.content} maxWidth={560}>
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

      {picking && accounts.length > 0 ? (
        <Card accent style={styles.formCard}>
          <Text style={styles.pickTitle}>Elige tu cuenta</Text>
          {accounts.map((acc) => (
            <Pressable key={acc.email} style={styles.accRow} onPress={() => pickAccount(acc)}>
              <Avatar name={acc.name} photoURL={acc.photoURL} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.accName} numberOfLines={1}>
                  {acc.name}
                </Text>
                <Text style={styles.accMeta} numberOfLines={1}>
                  {acc.role === 'trainer' ? 'Entrenador' : acc.role === 'athlete' ? 'Atleta' : 'Alumno'}{' '}
                  · {acc.email}
                </Text>
              </View>
              <Pressable onPress={() => removeAccount(acc)} hitSlop={10} style={styles.accRemove}>
                <Ionicons name="close" size={16} color={colors.textFaint} />
              </Pressable>
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              setEmail('');
              setPassword('');
              setPicking(false);
            }}
            style={styles.otherAcc}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.otherAccText}>Usar otra cuenta</Text>
          </Pressable>
        </Card>
      ) : (
        <Card accent style={styles.formCard}>
          {accounts.length > 0 ? (
            <Pressable onPress={() => setPicking(true)} style={styles.backToAccounts} hitSlop={6}>
              <Ionicons name="chevron-back" size={16} color={colors.primary} />
              <Text style={styles.otherAccText}>Cuentas guardadas</Text>
            </Pressable>
          ) : null}
          <TextField
            label="Correo electrónico"
            {...emailFieldProps}
            value={email}
            onChangeText={setEmail}
            placeholder="tucorreo@ejemplo.com"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextField
            ref={passwordRef}
            label="Contraseña"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
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
      )}

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
  pickTitle: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  accRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  accMeta: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  accRemove: { padding: 6 },
  otherAcc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  otherAccText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  backToAccounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: spacing.md,
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
