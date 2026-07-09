import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { Logo } from './Logo';
import { ScreenContainer } from './ScreenContainer';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { getTrainerIdForInviteCode } from '../lib/firestore/users';
import {
  deleteJoinRequest,
  getMyJoinRequests,
  sendJoinRequest,
} from '../lib/firestore/joinRequests';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { JoinRequest } from '../lib/types';

/**
 * Pantalla que ve un alumno todavía sin entrenador: introduce el código para
 * ENVIAR una solicitud, o espera a que el entrenador la apruebe. En cuanto el
 * coach acepta (le pone el trainerId), al comprobar entra en la app.
 */
export function LinkTrainerScreen() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [pending, setPending] = useState<JoinRequest | null>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profile) return;
    const reqs = await getMyJoinRequests(profile.uid);
    setPending(reqs[0] ?? null);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleSend = async () => {
    if (!profile) return;
    setError(null);
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setError('Introduce el código de tu entrenador.');
      return;
    }
    setSending(true);
    try {
      const trainerId = await getTrainerIdForInviteCode(clean);
      if (!trainerId) {
        setError('Ese código no es válido. Revísalo con tu entrenador.');
        return;
      }
      await sendJoinRequest(trainerId, profile);
      setCode('');
      await reload();
      showToast('Solicitud enviada');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSending(false);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      await refreshProfile(); // si ya está aprobado, el layout abre la app
      await reload();
    } finally {
      setChecking(false);
    }
  };

  const handleCancel = async () => {
    if (!profile || !pending) return;
    await deleteJoinRequest(profile.uid, pending.trainerId);
    setPending(null);
    showToast('Solicitud cancelada');
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Logo compact />
      </View>

      {pending ? (
        <Card accent style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="hourglass-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Solicitud enviada</Text>
          <Text style={styles.subtitle}>
            Tu entrenador tiene que aceptarte en su grupo. Cuando lo haga,
            entrarás automáticamente. Pulsa “Ya me han aceptado” para comprobarlo.
          </Text>
          <Button
            title="Ya me han aceptado"
            onPress={handleCheck}
            loading={checking}
            style={{ marginTop: spacing.lg }}
          />
          <Button
            title="Cancelar solicitud"
            variant="ghost"
            onPress={handleCancel}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      ) : (
        <Card accent style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="person-add-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>Vincúlate con tu entrenador</Text>
          <Text style={styles.subtitle}>
            Introduce el código que te ha dado tu entrenador. Le llegará una
            solicitud con tu nombre y foto para aceptarte.
          </Text>
          <TextField
            label="Código del entrenador"
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
            placeholder="Ej. LUISTENA"
            style={{ marginTop: spacing.md }}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title="Enviar solicitud"
            onPress={handleSend}
            loading={sending}
            disabled={!code.trim()}
          />
        </Card>
      )}

      <Pressable onPress={signOut} style={styles.signOut} hitSlop={8}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
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
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm, alignSelf: 'stretch' },
  signOut: { alignSelf: 'center', marginTop: spacing.xl, padding: spacing.sm },
  signOutText: { ...typography.small, color: colors.textFaint, textDecorationLine: 'underline' },
});
