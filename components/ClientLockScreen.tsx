import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { Card } from './Card';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { createCoachCheckoutUrl } from '../lib/connect';
import { getUserProfile, reportClientPayment } from '../lib/firestore/users';
import { notifyUser } from '../lib/notifications';
import { colors, fonts, radius, shadows, spacing, tabularNums, typography } from '../lib/theme';

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>Tu acceso está en pausa</Text>
        <Text style={styles.subtitle}>
          {trainerName
            ? `Tienes pendiente la cuota con ${trainerName}. En cuanto se resuelva, sigues justo donde lo dejaste.`
            : 'Tienes la cuota pendiente. En cuanto se resuelva, sigues justo donde lo dejaste.'}
        </Text>

        <Card accent style={styles.card}>
          <Text style={styles.amountLabel}>CUOTA PENDIENTE</Text>
          <Text style={styles.amount}>{cuota}</Text>
          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={15} color={colors.success} />
            <Text style={styles.noteText}>
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
          <Text style={styles.hint}>
            Si has pagado por otra vía, avisa a tu entrenador y recuperas el acceso mientras
            lo confirma.
          </Text>
        </Card>

        <Button title="Cerrar sesión" variant="ghost" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.glowGold,
  },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 420,
  },
  card: { width: '100%', maxWidth: 420, marginTop: spacing.lg, alignItems: 'stretch' },
  amountLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  amount: {
    ...typography.h1,
    ...tabularNums,
    color: colors.primaryBright,
    textAlign: 'center',
    marginTop: 2,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.successMuted,
  },
  noteText: { ...typography.small, color: colors.text, flex: 1 },
  hint: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontFamily: fonts.body,
  },
});
