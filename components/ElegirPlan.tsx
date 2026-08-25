import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { frase } from '../lib/idioma';
import { track } from '../lib/analytics';
import {
  AHORRO_ANUAL_PCT,
  CAN_LINK_TO_PAYMENT,
  subscriptionCheckoutUrl,
} from '../lib/subscription';
import type { UserProfile } from '../lib/types';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Las dos formas que tiene un atleta de pagar: el año o mes a mes.
 *
 * POR QUÉ ES UN COMPONENTE Y NO DOS BOTONES SUELTOS
 *
 * Esta elección sale en dos sitios —el muro de cuando se acaba la prueba y la
 * tarjeta del plan en el perfil— y son los dos únicos momentos en los que se le
 * pide dinero a un atleta. Duplicar los textos era garantizar que un día se
 * mejorara uno y el otro se quedara diciendo otra cosa.
 *
 * POR QUÉ NO HAY NINGÚN PRECIO AQUÍ
 *
 * La app no dice precios en ninguna plataforma; el porqué está entero en
 * lib/subscription.ts. El importe se ve en la página de pago, que es donde
 * está al día siempre.
 *
 * La única cifra es el AHORRO, en porcentaje, y no es una excepción a esa
 * regla: un precio se queda viejo en la versión que el usuario no actualiza,
 * pero una proporción entre los dos precios sigue siendo verdad mientras los
 * dos se muevan juntos. Y va calculada (`AHORRO_ANUAL_PCT`), no escrita.
 *
 * POR QUÉ EL ANUAL VA PRIMERO Y MARCADO
 *
 * Porque es el que le conviene a las dos partes, y eso se puede decir sin
 * trampa: el atleta paga menos por el mismo año, y a UDECA le entra por
 * delante lo que de otro modo dependería de doce cobros que pueden fallar.
 * Lo que NO se hace es esconder el mensual ni ponerlo feo: quien no quiera
 * comprometerse a un año tiene su opción a la vista y con las mismas letras.
 */

interface Props {
  profile: UserProfile | null;
  /**
   * Texto del pie. `null` lo quita: en el muro, la propia pantalla ya dice
   * abajo qué pasa al pagar, y repetirlo dos veces en el mismo scroll queda
   * como un formulario mal montado.
   */
  nota?: string | null;
}

export function ElegirPlan({ profile, nota }: Props) {
  /*
   * La comprobación de iOS va AQUÍ DENTRO, no en quien lo usa.
   *
   * Los dos sitios actuales ya la hacían por su cuenta, así que esto no cambia
   * nada hoy. Pero este componente es justo el que alguien reutilizará en una
   * pantalla nueva, y ahí es donde se olvidaría: en el navegador y en Android
   * se vería perfecto, y el botón solo aparecería en el iPhone del revisor de
   * Apple. Rechazo por la norma 3.1.1, cuarenta minutos de compilación y una
   * semana de espera después.
   *
   * Con la guarda dentro, el componente es seguro se use donde se use.
   */
  const anual = CAN_LINK_TO_PAYMENT ? subscriptionCheckoutUrl(profile, 'annual') : null;
  const mensual = CAN_LINK_TO_PAYMENT ? subscriptionCheckoutUrl(profile, 'monthly') : null;

  // Sin enlaces configurados no se enseña nada: un botón de pagar que no lleva
  // a ninguna parte es peor que no tener botón.
  if (!anual && !mensual) return null;

  const abrir = (url: string | null, plan: 'annual' | 'monthly') => {
    if (!url) return;
    void track(plan === 'annual' ? 'checkout_start_anual' : 'checkout_start');
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.caja}>
      {anual ? (
        <Pressable style={[styles.opcion, styles.destacada]} onPress={() => abrir(anual, 'annual')}>
          <View style={styles.insignia}>
            <Text style={styles.insigniaTexto}>
              {frase`Ahorras un ${AHORRO_ANUAL_PCT}%`}
            </Text>
          </View>
          <View style={styles.fila}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>Un año por delante</Text>
              <Text style={styles.detalle}>
                Lo pagas una vez y te olvidas del contador hasta el año que viene.
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </View>
        </Pressable>
      ) : null}

      {mensual ? (
        <Pressable style={styles.opcion} onPress={() => abrir(mensual, 'monthly')}>
          <View style={styles.fila}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>Mes a mes</Text>
              <Text style={styles.detalle}>
                Sin permanencia. Lo dejas el mes que quieras, sin dar explicaciones.
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>
      ) : null}

      {nota !== null ? (
        <Text style={styles.pie}>
          {nota ?? 'Se abre la web para completarlo. Al volver, tu cuenta se enciende sola.'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { marginTop: spacing.md, gap: spacing.sm },
  opcion: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  // La destacada se distingue por el borde y la insignia, no por un color de
  // fondo chillón: el resto de la app es negra y sobria, y un bloque de color
  // aquí se leería como publicidad metida con calzador.
  destacada: { borderColor: colors.primary },
  insignia: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  insigniaTexto: {
    ...typography.label,
    color: colors.background,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  pie: { ...typography.small, color: colors.textFaint, marginTop: spacing.xs },
});
