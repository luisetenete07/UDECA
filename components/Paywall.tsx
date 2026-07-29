import React from 'react';
import { AppState, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { Card } from './Card';
import { useAuth } from '../lib/auth-context';
import { track, trackOnce } from '../lib/analytics';
import {
  ANNUAL_PRICE_EUR,
  ATHLETE_MONTHLY_EUR,
  CONTACT_EMAIL,
  subscriptionCheckoutUrl,
  verifySubscriptionNow,
} from '../lib/subscription';
import { showToast } from './Toast';
import { colors, fonts, radius, shadows, spacing, typography } from '../lib/theme';

const BENEFITS = [
  'Alumnos ilimitados con tu código de coach',
  'Rutinas, plantillas y programaciones a medida',
  'Gestión de cobros y pagos de tus alumnos',
  'Progreso, estadísticas y informes PDF',
  'Tus cursos y vídeos de técnica propios',
];

/**
 * Muro de suscripción del coach: aparece cuando su prueba o plan caduca.
 * Los datos no se tocan nunca; solo se bloquea el acceso hasta renovar.
 */
const ATHLETE_BENEFITS = [
  'Crea y edita tus propias rutinas',
  'Registra tus entrenos, series y récords',
  'Progreso, estadísticas y evolución por ejercicio',
  'Nutrición: tus macros y seguimiento',
  'Logros y racha para no fallar',
];

export function Paywall() {
  const { profile, signOut, refreshProfile } = useAuth();
  const isAthlete = profile?.role === 'athlete';
  // Cuánta gente llega al muro de pago frente a cuánta lo cruza.
  React.useEffect(() => {
    void trackOnce('paywall_view');
  }, []);
  const [checking, setChecking] = React.useState(false);
  // Evita comprobaciones solapadas (sondeo + volver a la app + botón a la vez).
  const busyRef = React.useRef(false);

  // Comprueba en Stripe si ya consta el pago y, si es así, activa la cuenta.
  // `silent`: en las comprobaciones automáticas no molestamos con avisos; solo
  // el botón manual informa del motivo cuando aún no consta.
  const checkNow = React.useCallback(
    async (silent: boolean): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = true;
      try {
        const result = await verifySubscriptionNow(profile);
        if (result.active) {
          // Al refrescar el perfil, la puerta del layout deja pasar sola.
          await refreshProfile();
          return true;
        }
        if (!silent) {
          showToast(result.reason ? `Aún no: ${result.reason}` : 'Aún no consta el pago');
        }
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [profile, refreshProfile]
  );

  // 1) Al volver a la app tras pagar en el navegador (AppState → active, que en
  //    web cubre también volver a la pestaña): comprueba solo, en silencio.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkNow(true);
    });
    return () => sub.remove();
  }, [checkNow]);

  // 2) Sondeo periódico mientras el muro está visible, como red de seguridad
  //    (por si el pago tarda en confirmarse o AppState no dispara).
  React.useEffect(() => {
    const id = setInterval(() => checkNow(true), 5000);
    return () => clearInterval(id);
  }, [checkNow]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await checkNow(false);
    } finally {
      setChecking(false);
    }
  };

  const checkoutUrl = subscriptionCheckoutUrl(profile);
  const handlePay = () => {
    void track('checkout_start');
    if (checkoutUrl) {
      // Stripe activa la cuenta sola tras pagar (webhook + client_reference_id).
      Linking.openURL(checkoutUrl).catch(() => {});
    } else {
      const plan = isAthlete ? 'Atleta (10 €/mes)' : 'Pro anual';
      Linking.openURL(
        `mailto:${CONTACT_EMAIL}?subject=Suscripción UDECA ${plan}&body=Hola, quiero activar mi suscripción de UDECA (${plan}). Mi correo es: ${profile?.email ?? ''}`
      ).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{isAthlete ? 'Activa UDECA Atleta' : 'Activa UDECA Pro'}</Text>
        <Text style={styles.subtitle}>
          {isAthlete
            ? 'Entrena por tu cuenta con todas las herramientas. Tus datos están a salvo y te esperan.'
            : 'Para entrenar a tus alumnos como coach necesitas la suscripción anual. Tus datos están a salvo y te esperan.'}
        </Text>

        <Card accent style={styles.planCard}>
          <Text style={styles.planName}>{isAthlete ? 'UDECA ATLETA · MENSUAL' : 'UDECA PRO · ANUAL'}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {isAthlete ? ATHLETE_MONTHLY_EUR : (ANNUAL_PRICE_EUR / 12).toFixed(0)} €
            </Text>
            <Text style={styles.priceUnit}>/ mes</Text>
          </View>
          <Text style={styles.priceHint}>
            {isAthlete
              ? 'Cuota mensual, sin permanencia.'
              : `Cuota anual: ${ANNUAL_PRICE_EUR} € / año (un único pago)`}
          </Text>
          {(isAthlete ? ATHLETE_BENEFITS : BENEFITS).map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
          <Button
            title={checkoutUrl ? 'Suscribirme ahora' : 'Contactar para activar'}
            onPress={handlePay}
            style={{ marginTop: spacing.md }}
          />
          <Button
            title={checking ? 'Comprobando...' : 'Ya he pagado · Actualizar'}
            variant="secondary"
            onPress={handleCheck}
            loading={checking}
            style={{ marginTop: spacing.sm }}
          />
        </Card>

        <Text style={styles.footNote}>
          Al terminar el pago y volver a la app, tu cuenta se activa sola en unos
          segundos. Si tardara, pulsa "Ya he pagado · Actualizar".
        </Text>
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
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: spacing.md, ...shadows.glowGold },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 21,
  },
  planCard: { alignSelf: 'stretch', marginBottom: spacing.md },
  planName: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  price: { fontSize: 44, lineHeight: 48, color: colors.text, fontFamily: fonts.heading },
  priceUnit: { ...typography.body, color: colors.textMuted },
  priceHint: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
  },
  benefitText: { ...typography.small, color: colors.text, flex: 1 },
  footNote: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
