import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { Logo } from './Logo';
import { ScreenContainer } from './ScreenContainer';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { colors, fonts, spacing, typography } from '../lib/theme';

/**
 * Bloquea la app hasta que el usuario verifica su correo. Firebase envía un
 * enlace de verificación; al abrirlo, `emailVerified` pasa a true. Aquí se
 * comprueba (manual o automáticamente) y se reenvía el correo si hace falta.
 */
export function VerifyEmailScreen() {
  const { profile, reloadUser, resendVerification, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  // Comprueba en segundo plano por si verifica en otra pestaña/dispositivo.
  const reloadRef = useRef(reloadUser);
  reloadRef.current = reloadUser;
  useEffect(() => {
    const id = setInterval(() => {
      reloadRef.current().catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const ok = await reloadUser();
      if (!ok) {
        showToast('Aún no aparece verificado. Revisa tu correo (y spam).');
      }
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification();
      showToast('Correo de verificación reenviado');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo reenviar');
    } finally {
      setResending(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Logo compact />
      </View>

      <Card accent style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-unread-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>Verifica tu correo</Text>
        <Text style={styles.subtitle}>
          Te hemos enviado un enlace de verificación a:
        </Text>
        <Text style={styles.email}>{profile?.email}</Text>
        <Text style={styles.subtitle}>
          Ábrelo para activar tu cuenta y entrar. Si no lo ves, revisa la
          carpeta de spam o promociones.
        </Text>

        <Button
          title="Ya lo he verificado"
          onPress={handleCheck}
          loading={checking}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          title="Reenviar correo"
          variant="secondary"
          onPress={handleResend}
          loading={resending}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      <Pressable onPress={signOut} style={styles.signOut} hitSlop={8}>
        <Text style={styles.signOutText}>Usar otra cuenta</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  card: { padding: spacing.lg, alignItems: 'center' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 21,
  },
  email: {
    ...typography.body,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  signOut: { alignSelf: 'center', marginTop: spacing.xl, padding: spacing.sm },
  signOutText: { ...typography.small, color: colors.textFaint, textDecorationLine: 'underline' },
});
