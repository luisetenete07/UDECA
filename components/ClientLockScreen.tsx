import React from 'react';
import { t, frase } from '../lib/idioma';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { GateScreen } from './GateScreen';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { diaYMes } from '../lib/fechas';
import { getUserProfile, reportClientPayment } from '../lib/firestore/users';
import { notifyUser } from '../lib/notifications';
import { colors, spacing, typography } from '../lib/theme';

/**
 * La app en pausa porque se acabó el periodo de coaching.
 *
 * Aparece cuando han pasado más de los días de margen desde el final del
 * periodo que puso su entrenador (ver `clientIsLocked` y lib/coaching.ts). Se
 * sale cuando el entrenador lo renueva. Desde aquí, lo único que el alumno
 * puede hacer es decírselo: pedirlo no abre la app, porque si la abriera
 * bastaría con pulsar el botón para no renovar nunca.
 *
 * Sin euros: lo que se paga es cosa suya y de su entrenador, fuera de UDECA.
 * Y nunca se pierde nada: el plan, el historial y las marcas siguen ahí.
 */
export function ClientLockScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [pidiendo, setPidiendo] = React.useState(false);
  const [trainerName, setTrainerName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profile?.trainerId) return;
    let vivo = true;
    getUserProfile(profile.trainerId)
      .then((tr) => {
        if (!vivo || !tr) return;
        setTrainerName(tr.name?.split(' ')[0] ?? null);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [profile?.trainerId]);

  const pedirRenovar = async () => {
    if (!profile) return;
    setPidiendo(true);
    try {
      await reportClientPayment(profile.uid);
      if (profile.trainerId) {
        notifyUser(
          profile.trainerId,
          'Quiere renovar',
          frase`${profile.name?.split(' ')[0] ?? t('Un alumno')} quiere renovar su periodo de coaching.`
        ).catch(() => {});
      }
      await refreshProfile();
      showToast('Se lo hemos dicho a tu entrenador');
    } catch {
      showToast('No se pudo enviar el aviso');
    } finally {
      setPidiendo(false);
    }
  };

  const pedido = !!profile?.paymentReportedAt;

  return (
    <GateScreen
      icono="pause-circle-outline"
      titulo="Tu coaching ha terminado"
      texto={
        trainerName && profile?.nextPaymentDate
          ? frase`Tu periodo con ${trainerName} terminó el ${diaYMes(profile.nextPaymentDate)}. En cuanto lo renueve, sigues justo donde lo dejaste.`
          : 'Tu periodo de coaching ha terminado. En cuanto tu entrenador lo renueve, sigues justo donde lo dejaste.'
      }
      onSalir={signOut}
    >
      <View style={styles.aviso}>
        <Ionicons name="shield-checkmark-outline" size={15} color={colors.success} />
        <Text style={styles.avisoTexto}>
          No pierdes nada: tu plan, tu historial y tus marcas siguen guardados.
        </Text>
      </View>
      <Button
        title={pedido ? 'Tu entrenador ya lo sabe' : 'Quiero renovar'}
        onPress={pedirRenovar}
        loading={pidiendo}
        disabled={pedido}
        style={{ marginTop: spacing.md }}
      />
      <Button
        title="Ya lo ha renovado · Actualizar"
        variant="secondary"
        onPress={() => {
          refreshProfile().catch(() => {});
        }}
        style={{ marginTop: spacing.sm }}
      />
    </GateScreen>
  );
}

const styles = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  avisoTexto: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 17 },
});
