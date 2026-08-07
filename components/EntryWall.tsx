import React from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { GateScreen, GateText } from './GateScreen';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { track, trackOnce } from '../lib/analytics';
import {
  CAN_SELL_IN_APP,
  CONTACT_EMAIL,
  ENTRY_PRICE_EUR,
  FREE_CLIENT_LIMIT,
  claimEntryNow,
  entryCheckoutUrl,
} from '../lib/subscription';
import { colors, fonts, spacing, typography } from '../lib/theme';

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
  const { firebaseUser, profile, signOut, refreshProfile } = useAuth();
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
        // Puede haber pagado en la WEB, antes de tener cuenta: entonces el euro
        // está apuntado a su correo y hay que ir a recogerlo. Es el camino
        // normal de quien llega por udeca.app, no un caso raro.
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken();
          const reclamado = await claimEntryNow(token);
          if (reclamado.activa) {
            await refreshProfile();
            return true;
          }
          if (!silencioso) {
            showToast(
              reclamado.motivo ??
                'Todavía no nos consta el pago. Dale un momento y vuelve a intentarlo.'
            );
            return false;
          }
        }
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
    [firebaseUser, refreshProfile]
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
    <GateScreen
      icono="key-outline"
      titulo={puedeCobrarAqui ? 'Activa tu cuenta' : 'Tu cuenta está sin activar'}
      nota={`¿Algún problema? Escríbenos a ${CONTACT_EMAIL}`}
      onSalir={signOut}
    >
      {puedeCobrarAqui ? (
        <>
          <View style={styles.precioFila}>
            <Text style={styles.precio}>{ENTRY_PRICE_EUR} €</Text>
            <Text style={styles.precioNota}>pago único</Text>
          </View>
          <GateText>
            {esAtleta
              ? 'Con el alta empiezan tus 14 días con todo abierto. Después decides si sigues.'
              : `El alta incluye ${FREE_CLIENT_LIMIT} alumnos con su propia cuenta. Si tu grupo crece, entonces hablamos de la cuota anual.`}
          </GateText>
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
          <GateText>
            Esta cuenta todavía no está activa. Puedes activarla desde tu cuenta de UDECA y volver
            aquí: al entrar de nuevo, la app la reconoce sola.
          </GateText>
          <Button
            title="Ya está activa"
            onPress={() => comprobar(false)}
            loading={comprobando}
            style={{ marginTop: spacing.lg }}
          />
        </>
      )}
    </GateScreen>
  );
}

const styles = StyleSheet.create({
  precioFila: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  precio: { ...typography.h1, color: colors.primaryBright, fontSize: 40, fontFamily: fonts.heading },
  precioNota: { ...typography.small, color: colors.textMuted },
});
