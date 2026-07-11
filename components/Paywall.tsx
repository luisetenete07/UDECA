import React from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { Card } from './Card';
import { useAuth } from '../lib/auth-context';
import {
  ANNUAL_PRICE_EUR,
  CONTACT_EMAIL,
  PAYMENT_LINK_URL,
} from '../lib/subscription';
import { colors, fonts, radius, shadows, spacing, typography } from '../lib/theme';

const BENEFITS = [
  'Alumnos ilimitados con tu código de coach',
  'Rutinas, plantillas y Método REIN TENA',
  'Gestión de cobros y pagos de tus alumnos',
  'Progreso, estadísticas y informes PDF',
  'Tus cursos y vídeos de técnica propios',
];

/**
 * Muro de suscripción del coach: aparece cuando su prueba o plan caduca.
 * Los datos no se tocan nunca; solo se bloquea el acceso hasta renovar.
 */
export function Paywall() {
  const { profile, signOut } = useAuth();

  const handlePay = () => {
    if (PAYMENT_LINK_URL) {
      Linking.openURL(PAYMENT_LINK_URL).catch(() => {});
    } else {
      Linking.openURL(
        `mailto:${CONTACT_EMAIL}?subject=Suscripción UDECA Pro&body=Hola, quiero activar mi suscripción anual de UDECA. Mi correo de coach es: ${profile?.email ?? ''}`
      ).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Tu prueba ha terminado</Text>
        <Text style={styles.subtitle}>
          Sigue entrenando a tus alumnos con UDECA Pro. Tus datos están a salvo
          y te esperan tal y como los dejaste.
        </Text>

        <Card accent style={styles.planCard}>
          <Text style={styles.planName}>UDECA PRO · ANUAL</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{ANNUAL_PRICE_EUR} €</Text>
            <Text style={styles.priceUnit}>/ año</Text>
          </View>
          <Text style={styles.priceHint}>Equivale a {(ANNUAL_PRICE_EUR / 12).toFixed(0)} € al mes</Text>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
          <Button
            title={PAYMENT_LINK_URL ? 'Activar suscripción' : 'Contactar para activar'}
            onPress={handlePay}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Text style={styles.footNote}>
          ¿Ya has pagado? La activación se aplica en cuanto la confirmamos:
          cierra sesión y vuelve a entrar.
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
