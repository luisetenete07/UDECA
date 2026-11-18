import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Text } from './Texto';
import { Button } from './Button';
import { GateScreen } from './GateScreen';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { idDelCoach } from '../lib/coachUnico';
import { getTrainerIdForInviteCode } from '../lib/firestore/users';
import {
  deleteJoinRequest,
  getMyJoinRequests,
  sendJoinRequest,
} from '../lib/firestore/joinRequests';
import { colors, spacing, typography } from '../lib/theme';
import type { JoinRequest } from '../lib/types';

/**
 * Lo que ve un alumno que todavía no está dentro: su solicitud, esperando a que
 * Luis la acepte. En cuanto la acepta (le pone el trainerId), al comprobar
 * entra en la app.
 *
 * Normalmente la solicitud ya salió al crear la cuenta. Esta pantalla cubre el
 * resto: quien la canceló y quiere volver a pedirla, o quien la creó sin red.
 *
 * El código del entrenador solo aparece si la app todavía no sabe quién es el
 * coach (`config/coach` sin apuntar, ver lib/coachUnico.ts). Es el camino de
 * antes, y se queda como red: mejor pedir un código que dejar a alguien sin
 * poder pedir entrar.
 */
export function LinkTrainerScreen() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [pending, setPending] = useState<JoinRequest | null>(null);
  // undefined = mirando; null = no se sabe quién es el coach (sale el código).
  const [coach, setCoach] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profile) return;
    const [reqs, id] = await Promise.all([
      getMyJoinRequests(profile.uid).catch(() => [] as JoinRequest[]),
      idDelCoach(),
    ]);
    setPending(reqs[0] ?? null);
    setCoach(id);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const enviar = async (trainerId: string) => {
    if (!profile) return;
    await sendJoinRequest(trainerId, profile);
    setCode('');
    await reload();
    showToast('Solicitud enviada');
  };

  const handleSend = async () => {
    if (!profile) return;
    setError(null);
    setSending(true);
    try {
      if (coach) {
        await enviar(coach);
        return;
      }
      const clean = code.trim().toUpperCase();
      if (!clean) {
        setError('Introduce el código de tu entrenador.');
        return;
      }
      const trainerId = await getTrainerIdForInviteCode(clean);
      if (!trainerId) {
        setError('Ese código no es válido. Revísalo con tu entrenador.');
        return;
      }
      await enviar(trainerId);
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

  // Las dos caras de la misma puerta: pedir entrar o esperar la respuesta.
  // Comparten marco a propósito —quien envía la solicitud vuelve aquí a los
  // dos minutos a ver si le han aceptado, y encontrarse otra pantalla haría
  // dudar de si la envió bien.
  if (pending) {
    return (
      <GateScreen
        icono="hourglass-outline"
        titulo="Solicitud enviada"
        texto="Luis tiene que aceptarte en el grupo. Cuando lo haga, entrarás automáticamente. Pulsa “Ya me han aceptado” para comprobarlo."
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
    );
  }

  if (coach === null) {
    return (
      <GateScreen
        icono="person-add-outline"
        titulo="Pide entrar en el grupo"
        texto="Introduce el código que te ha dado Luis. Le llegará una solicitud con tu nombre y foto para aceptarte."
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

  return (
    <GateScreen
      icono="person-add-outline"
      titulo="Pide entrar en el grupo"
      texto="Le llegará a Luis una solicitud con tu nombre y foto. Entras en cuanto te acepte."
      onSalir={signOut}
    >
      {error ? <Text style={[styles.error, { marginTop: spacing.md }]}>{error}</Text> : null}
      <Button
        title="Enviar mi solicitud"
        onPress={handleSend}
        loading={sending || coach === undefined}
        style={{ marginTop: spacing.lg }}
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
