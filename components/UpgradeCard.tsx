import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from './Card';
import { useAuth } from '../lib/auth-context';
import { track } from '../lib/analytics';
import {
  ANNUAL_PRICE_EUR,
  ATHLETE_MONTHLY_EUR,
  CAN_SELL_IN_APP,
  isAdmin,
  subscriptionCheckoutUrl,
  subscriptionState,
} from '../lib/subscription';
import type { UserProfile } from '../lib/types';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * ¿Le queda plan por delante a esta cuenta?
 *
 * Sí mientras no tenga una suscripción de pago: el atleta durante su prueba y
 * el entrenador con el alta pagada pero sin cuota anual. En cuanto pagan, esto
 * desaparece de toda la app: seguir enseñando "hazte de pago" a quien ya paga
 * es la forma más rápida de parecer una máquina tragaperras.
 */
export function canUpgrade(profile: UserProfile | null): boolean {
  if (!profile || !CAN_SELL_IN_APP) return false;
  if (profile.role !== 'trainer' && profile.role !== 'athlete') return false;
  if (isAdmin(profile)) return false;
  const estado = subscriptionState(profile);
  if (estado.legacy) return false; // cuenta fundadora: acceso completo de por vida
  return !estado.active || estado.trial;
}

interface Props {
  /**
   * 'recordatorio' es la versión breve de los primeros días (se puede cerrar);
   * 'completa' es la del perfil, que se queda hasta que dan el paso.
   */
  variante?: 'recordatorio' | 'completa';
  /** Clave para recordar que ya se cerró (solo en la versión breve). */
  onClose?: () => void;
}

/**
 * "Puedes pasar al plan completo cuando quieras."
 *
 * Existe por una razón concreta: hay gente que paga el euro del alta y ya viene
 * decidida a pagar el plano completo, pero no encuentra dónde. Sin esto, su
 * única forma de suscribirse era esperar a que caducara la prueba y toparse con
 * el muro, que es hacerle esperar para cobrarle.
 *
 * No aparece en iPhone (ver CAN_SELL_IN_APP): allí no se puede enseñar un
 * precio ni enlazar a pagar fuera.
 */
export function UpgradeCard({ variante = 'completa', onClose }: Props) {
  const { profile } = useAuth();
  if (!canUpgrade(profile)) return null;

  const esAtleta = profile?.role === 'athlete';
  const estado = subscriptionState(profile);
  const url = subscriptionCheckoutUrl(profile);
  const diasRestantes = estado.trial ? estado.daysLeft : null;

  const precio = esAtleta ? `${ATHLETE_MONTHLY_EUR} €` : `${ANNUAL_PRICE_EUR} €`;
  const unidad = esAtleta ? '/ mes' : '/ año';
  const ventajas = esAtleta
    ? [
        'Tus rutinas y tu progreso, sin límite de tiempo',
        'Nutrición, macros y libreta de comidas',
        'Informes en PDF y récords guardados para siempre',
      ]
    : [
        'Alumnos ilimitados, sin tope de grupo',
        'Cobros, avisos de impago y control de cuotas',
        'Informes de progreso con tu marca',
      ];

  const abrir = () => {
    void track('checkout_start');
    if (url) Linking.openURL(url).catch(() => {});
  };

  if (variante === 'recordatorio') {
    return (
      <Card style={styles.breve}>
        <View style={styles.breveFila}>
          <View style={styles.icono}>
            <Ionicons name="rocket-outline" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.breveTitulo}>
              {esAtleta ? 'Cuando quieras, sin esperar' : 'Cuando tu grupo crezca'}
            </Text>
            <Text style={styles.breveTexto}>
              {esAtleta
                ? diasRestantes !== null
                  ? `Te quedan ${diasRestantes} días de prueba. Si ya lo tienes claro, pasa al plan completo por ${precio}${unidad} y olvídate del contador.`
                  : `Pasa al plan completo por ${precio}${unidad} cuando quieras.`
                : `Tu alta incluye alumnos suficientes para empezar. El plan anual (${precio}${unidad}) los quita del todo.`}
            </Text>
          </View>
          {onClose ? (
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
        {url ? (
          <Pressable onPress={abrir} style={styles.enlace} hitSlop={6}>
            <Text style={styles.enlaceTexto}>Ver el plan completo</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </Card>
    );
  }

  return (
    <Card accent style={styles.card}>
      <View style={styles.cabecera}>
        <Text style={styles.eyebrow}>{esAtleta ? 'UDECA ATLETA' : 'UDECA PRO'}</Text>
        {diasRestantes !== null ? (
          <View style={styles.pill}>
            <Text style={styles.pillTexto}>
              {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'} de prueba
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.precioFila}>
        <Text style={styles.precio}>{precio}</Text>
        <Text style={styles.precioUnidad}>{unidad}</Text>
      </View>
      <Text style={styles.pie}>
        {esAtleta ? 'Sin permanencia. Se cancela cuando quieras.' : 'Un único pago al año.'}
      </Text>

      {ventajas.map((v) => (
        <View key={v} style={styles.ventaja}>
          <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
          <Text style={styles.ventajaTexto}>{v}</Text>
        </View>
      ))}

      {url ? (
        <Pressable onPress={abrir} style={styles.boton}>
          <Text style={styles.botonTexto}>
            {esAtleta ? 'Pasar al plan completo' : 'Activar el plan anual'}
          </Text>
        </Pressable>
      ) : null}
      <Text style={styles.nota}>
        {esAtleta
          ? 'Si prefieres esperar, no pasa nada: te avisaremos antes de que termine la prueba.'
          : 'Mientras no lo actives no se te cobra nada, y tus alumnos actuales siguen igual.'}
      </Text>
    </Card>
  );
}

/**
 * Versión breve para el inicio, que se puede cerrar y no vuelve.
 *
 * Se recuerda por dispositivo y por cuenta: un recordatorio que reaparece
 * después de cerrarlo dos veces deja de ser un recordatorio y pasa a ser un
 * anuncio.
 */
export function UpgradeReminder() {
  const { profile } = useAuth();
  const [cerrado, setCerrado] = React.useState(true);
  const clave = profile ? `udeca-upgrade-${profile.uid}` : null;

  React.useEffect(() => {
    if (!clave) return;
    AsyncStorage.getItem(clave)
      .then((v) => setCerrado(v === '1'))
      .catch(() => setCerrado(true));
  }, [clave]);

  if (cerrado) return null;
  return (
    <UpgradeCard
      variante="recordatorio"
      onClose={() => {
        setCerrado(true);
        if (clave) AsyncStorage.setItem(clave, '1').catch(() => {});
      }}
    />
  );
}

const styles = StyleSheet.create({
  breve: { marginBottom: spacing.md },
  breveFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  icono: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breveTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  breveTexto: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  enlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    marginLeft: 34 + spacing.sm,
  },
  enlaceTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },

  card: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: {
    ...typography.small,
    color: colors.primaryBright,
    letterSpacing: 1.5,
    fontFamily: fonts.semiBold,
  },
  pill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pillTexto: { ...typography.small, color: colors.textMuted, fontSize: 11 },
  precioFila: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: spacing.sm },
  precio: { fontSize: 38, lineHeight: 42, color: colors.text, fontFamily: fonts.heading },
  precioUnidad: { ...typography.body, color: colors.textMuted },
  pie: { ...typography.small, color: colors.textFaint, marginBottom: spacing.md },
  ventaja: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  ventajaTexto: { ...typography.small, color: colors.text, flex: 1 },
  boton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  botonTexto: { ...typography.body, color: colors.onPrimary, fontFamily: fonts.semiBold },
  nota: {
    ...typography.small,
    color: colors.textFaint,
    marginTop: spacing.sm,
    lineHeight: 17,
    textAlign: 'center',
  },
});
