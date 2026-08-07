import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { GateScreen } from './GateScreen';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { createCoachCheckoutUrl } from '../lib/connect';
import { getUserProfile, reportClientPayment } from '../lib/firestore/users';
import { notifyUser } from '../lib/notifications';
import { colors, spacing, typography } from '../lib/theme';

/**
 * Bloqueo del alumno por impago.
 *
 * Aparece cuando se le ha pasado la cuota más de los días de margen (ver
 * `clientIsLocked`). Se sale de aquí de dos maneras: pagando, o diciendo que ya
 * se ha pagado para que el coach lo confirme. Nunca se pierde nada: el plan, el
 * historial y las marcas siguen ahí y vuelven en cuanto se resuelve.
 *
 * El tono es el de un recordatorio entre dos personas que se conocen, no el de
 * una máquina cortando el suministro: quien está al otro lado es el alumno de
 * alguien, no un moroso anónimo.
 */
export function ClientLockScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [paying, setPaying] = React.useState(false);
  const [reporting, setReporting] = React.useState(false);
  const [trainerName, setTrainerName] = React.useState<string | null>(null);
  const [payLink, setPayLink] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profile?.trainerId) return;
    let vivo = true;
    getUserProfile(profile.trainerId)
      .then((t) => {
        if (!vivo || !t) return;
        setTrainerName(t.name?.split(' ')[0] ?? null);
        setPayLink(t.paymentLink ?? null);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [profile?.trainerId]);

  const cuota = profile?.monthlyFeeEur ? `${profile.monthlyFeeEur} €` : 'tu cuota';

  const pagar = async () => {
    if (!profile?.trainerId || !profile.monthlyFeeEur) return;
    setPaying(true);
    try {
      const r = await createCoachCheckoutUrl(profile.trainerId, profile.uid, profile.monthlyFeeEur);
      if (r.ok && r.url) {
        await Linking.openURL(r.url);
        return;
      }
      // Si la pasarela falla, el enlace propio del coach es la salida: pagar
      // nunca debe quedarse sin camino, y menos desde una pantalla de bloqueo.
      if (payLink) {
        await Linking.openURL(payLink);
        return;
      }
      showToast('No se pudo abrir el pago. Avisa a tu entrenador.');
    } catch {
      showToast('No se pudo abrir el pago. Reinténtalo.');
    } finally {
      setPaying(false);
    }
  };

  const yaHePagado = async () => {
    if (!profile) return;
    setReporting(true);
    try {
      await reportClientPayment(profile.uid);
      if (profile.trainerId) {
        notifyUser(
          profile.trainerId,
          'Pago declarado',
          `${profile.name?.split(' ')[0] ?? 'Un alumno'} dice que ya ha pagado su cuota. Revísalo y confírmalo.`
        ).catch(() => {});
      }
      await refreshProfile();
      showToast('Avisado. Recuperas el acceso mientras tu entrenador lo confirma.');
    } catch {
      showToast('No se pudo enviar el aviso');
    } finally {
      setReporting(false);
    }
  };

  return (
    <GateScreen
      icono="lock-closed-outline"
      titulo="Tu acceso está en pausa"
      texto={
        trainerName
          ? `Tienes pendiente la cuota con ${trainerName}. En cuanto se resuelva, sigues justo donde lo dejaste.`
          : 'Tienes la cuota pendiente. En cuanto se resuelva, sigues justo donde lo dejaste.'
      }
      nota="Si has pagado por otra vía, avisa a tu entrenador y recuperas el acceso mientras lo confirma."
      onSalir={signOut}
    >
      <Text style={styles.cuotaEtiqueta}>CUOTA PENDIENTE</Text>
      <Text style={styles.cuota}>{cuota}</Text>
      <View style={styles.aviso}>
        <Ionicons name="shield-checkmark-outline" size={15} color={colors.success} />
        <Text style={styles.avisoTexto}>
          No pierdes nada: tu plan, tu historial y tus marcas siguen guardados.
        </Text>
      </View>
      <Button
        title={paying ? 'Abriendo...' : 'Pagar ahora'}
        onPress={pagar}
        loading={paying}
        style={{ marginTop: spacing.md }}
      />
      <Button
        title={reporting ? 'Avisando...' : 'Ya he pagado'}
        variant="secondary"
        onPress={yaHePagado}
        loading={reporting}
        style={{ marginTop: spacing.sm }}
      />
    </GateScreen>
  );
}

const styles = StyleSheet.create({
  cuotaEtiqueta: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  cuota: { ...typography.h1, color: colors.primaryBright, textAlign: 'center', marginTop: 2 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  avisoTexto: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 17 },
});
