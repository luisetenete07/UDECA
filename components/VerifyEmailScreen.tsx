import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from './Button';
import { GateScreen, GateText } from './GateScreen';
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
    <GateScreen
      icono="mail-unread-outline"
      titulo="Verifica tu correo"
      texto="Te hemos enviado un enlace de verificación a:"
      salida="Usar otra cuenta"
      onSalir={signOut}
    >
      <Text style={styles.email}>{profile?.email}</Text>
      <GateText>
        Ábrelo para activar tu cuenta y entrar. Si no lo ves, revisa la carpeta de spam o
        promociones.
      </GateText>

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
    </GateScreen>
  );
}

const styles = StyleSheet.create({
  email: {
    ...typography.body,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
