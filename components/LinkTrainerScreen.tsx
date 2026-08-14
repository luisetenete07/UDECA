import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Text } from './Texto';
import { Button } from './Button';
import { GateScreen } from './GateScreen';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { getTrainerIdForInviteCode } from '../lib/firestore/users';
import {
  deleteJoinRequest,
  getMyJoinRequests,
  sendJoinRequest,
} from '../lib/firestore/joinRequests';
import { colors, spacing, typography } from '../lib/theme';
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

  // Las dos caras de la misma puerta: mandar el código o esperar la respuesta.
  // Comparten marco a propósito —quien envía la solicitud vuelve aquí a los
  // dos minutos a ver si le han aceptado, y encontrarse otra pantalla haría
  // dudar de si la envió bien.
  return pending ? (
    <GateScreen
      icono="hourglass-outline"
      titulo="Solicitud enviada"
      texto="Tu entrenador tiene que aceptarte en su grupo. Cuando lo haga, entrarás automáticamente. Pulsa “Ya me han aceptado” para comprobarlo."
      onSalir={signOut}
    >
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
    </GateScreen>
  ) : (
    <GateScreen
      icono="person-add-outline"
      titulo="Vincúlate con tu entrenador"
      texto="Introduce el código que te ha dado tu entrenador. Le llegará una solicitud con tu nombre y foto para aceptarte."
      onSalir={signOut}
    >
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
    </GateScreen>
  );
}

const styles = StyleSheet.create({
  error: {
    ...typography.small,
    color: colors.danger,
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
  },
});
