import React from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { Card } from './Card';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { track, trackOnce } from '../lib/analytics';
import {
  CAN_SELL_IN_APP,
  CONTACT_EMAIL,
  ENTRY_PRICE_EUR,
  FREE_CLIENT_LIMIT,
  entryCheckoutUrl,
} from '../lib/subscription';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Alta de la cuenta: un euro, una vez.
 *
 * No está aquí para hacer caja —un euro no financia nada— sino para que entrar
 * cueste algo identificable. Al pagar con tarjeta queda una huella que es la
 * misma para la misma tarjeta en cualquier cuenta, y eso es lo que impide que un
 * entrenador se reparta en cuentas de cinco alumnos para no pagar la cuota
 * anual. El que va de frente no nota nada: mete la tarjeta una vez y entra.
 *
 * EN iOS NO SE VENDE NADA. Las normas de la App Store prohíben cobrar por fuera
 * lo que se usa dentro, e incluso enlazar a la web para pagarlo; un muro con
 * precio y botón a Stripe es rechazo directo. Así que en iPhone esta pantalla
 * solo dice que la cuenta está sin activar, sin precio y sin enlace, igual que
 * hacen los servicios multiplataforma. La solución definitiva ahí son las
 * compras integradas de Apple, que son otro proyecto.
 */
export function EntryWall() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [comprobando, setComprobando] = React.useState(false);
  const esAtleta = profile?.role === 'athlete';
  const url = entryCheckoutUrl(profile);
  // iOS: ni precio ni enlace de pago (ver comentario de arriba).
  const puedeCobrarAqui = CAN_SELL_IN_APP;

  /**
   * Al pagar. Si aún no hay enlace de Stripe configurado, en vez de dejar al
   * usuario en un callejón sin salida se abre un correo: alguien que quiere
   * pagar y no puede es el peor sitio donde tener un hueco.
   */
  const pagar = () => {
    void track('checkout_start');
    const destino =
      url ??
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Alta en UDECA')}&body=${encodeURIComponent(
        `Hola, quiero activar mi cuenta de UDECA. Mi correo es: ${profile?.email ?? ''}`
      )}`;
    Linking.openURL(destino).catch(() => {});
  };

  React.useEffect(() => {
    void trackOnce('entry_wall_view');
  }, []);

  // Evita comprobaciones solapadas (sondeo + volver a la app + botón a la vez).
  const ocupado = React.useRef(false);

  /**
   * Vuelve a leer el perfil: si el pago ha entrado, el webhook ya habrá escrito
   * `entryPaidAt` y la puerta del layout deja pasar sola en el siguiente render.
   */
  const comprobar = React.useCallback(
    async (silencioso: boolean) => {
      if (ocupado.current) return false;
      ocupado.current = true;
      if (!silencioso) setComprobando(true);
      try {
        const fresco = await refreshProfile();
        if (fresco?.entryPaidAt) return true;
        if (!silencioso) {
          showToast('Todavía no nos consta el pago. Dale un momento y vuelve a intentarlo.');
        }
      } catch {
        if (!silencioso) showToast('No se pudo comprobar. Inténtalo otra vez.');
      } finally {
        ocupado.current = false;
        if (!silencioso) setComprobando(false);
      }
      return false;
    },
    [refreshProfile]
  );

  // Al volver a la app desde el navegador de Stripe, se comprueba solo: nadie
  // debería tener que pulsar "ya he pagado" después de haber pagado.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void comprobar(true);
    });
    return () => sub.remove();
  }, [comprobar]);

  // Red de seguridad: el webhook de Stripe tarda unos segundos en escribir el
  // alta, y en web volver de la pestaña de pago no siempre dispara AppState.
  React.useEffect(() => {
    const id = setInterval(() => void comprobar(true), 5000);
    return () => clearInterval(id);
  }, [comprobar]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Card style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="key-outline" size={26} color={colors.primary} />
          </View>

          <Text style={styles.eyebrow}>Último paso</Text>
          <Text style={styles.title}>
            {puedeCobrarAqui ? 'Activa tu cuenta' : 'Tu cuenta está sin activar'}
          </Text>

          {puedeCobrarAqui ? (
            <>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{ENTRY_PRICE_EUR} €</Text>
                <Text style={styles.priceNote}>pago único</Text>
              </View>
              <Text style={styles.text}>
                {esAtleta
                  ? 'Con el alta empiezan tus 14 días con todo abierto. Después decides si sigues.'
                  : `El alta incluye ${FREE_CLIENT_LIMIT} alumnos con su propia cuenta. Si tu grupo crece, entonces hablamos de la cuota anual.`}
              </Text>
              <Button
                title={url ? `Activar por ${ENTRY_PRICE_EUR} €` : 'Contactar para activar'}
                onPress={pagar}
                style={{ marginTop: spacing.lg }}
              />
              <Button
                title="Ya he pagado"
                variant="secondary"
                onPress={() => comprobar(false)}
                loading={comprobando}
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : (
            <>
              <Text style={styles.text}>
                Esta cuenta todavía no está activa. Puedes activarla desde tu cuenta de
                UDECA y volver aquí: al entrar de nuevo, la app la reconoce sola.
              </Text>
              <Button
                title="Ya está activa"
                onPress={() => comprobar(false)}
                loading={comprobando}
                style={{ marginTop: spacing.lg }}
              />
            </>
          )}

          <Text style={styles.help}>
            ¿Algún problema? Escríbenos a {CONTACT_EMAIL}
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
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  card: { padding: spacing.xl },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.small,
    color: colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: fonts.semiBold,
  },
  title: { ...typography.h1, color: colors.text, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: spacing.md },
  price: { ...typography.h1, color: colors.primaryBright, fontSize: 40 },
  priceNote: { ...typography.small, color: colors.textMuted },
  text: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 },
  help: {
    ...typography.small,
    color: colors.textFaint,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
