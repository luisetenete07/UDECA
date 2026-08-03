import React from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from './Card';
import { useAuth } from '../lib/auth-context';
import { track } from '../lib/analytics';
import {
  ANNUAL_PRICE_EUR,
  ATHLETE_MONTHLY_EUR,
  COACH_MONTHLY_EQUIV_EUR,
  CAN_SELL_IN_APP,
  clientSlotsOf,
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

  // Los dos planes se enseñan al MES, que es como se piensa el gasto. Lo que
  // cambia es cómo se cobra, y eso se dice justo debajo en los dos casos.
  const precio = esAtleta ? `${ATHLETE_MONTHLY_EUR} €` : `${COACH_MONTHLY_EQUIV_EUR} €`;
  const unidad = '/ mes';
  /** La letra pequeña que nunca puede faltar: cómo se cobra de verdad. */
  const facturacion = esAtleta
    ? 'Sin permanencia. Se cancela cuando quieras.'
    : `${ANNUAL_PRICE_EUR} € facturados una vez al año.`;

  /**
   * Las plazas del entrenador, con nombre y apellidos.
   *
   * Decir "tu alta incluye 5 alumnos y llevas 3" hace dos cosas a la vez: es la
   * verdad completa —lo que compró, sin letra pequeña— y es lo que de verdad
   * mueve a dar el paso, porque enseña dónde está el techo antes de chocar con
   * él. Un mensaje que solo dice "hazte Pro" no informa de nada.
   */
  const plazas = clientSlotsOf(profile);
  const usados = profile?.clientCount ?? 0;
  const lleno = usados >= plazas;

  const ventajas = esAtleta
    ? [
        'Tus rutinas y tu progreso, sin límite de tiempo',
        'Nutrición, macros y libreta de comidas',
        'Informes en PDF y récords guardados para siempre',
      ]
    : [
        `Alumnos ilimitados (tu alta incluye ${plazas})`,
        'Cobros, avisos de impago y control de cuotas',
        'Informes de progreso con tu marca',
      ];

  /** El titular del recordatorio para el entrenador, según dónde esté. */
  const tituloCoach = lleno
    ? plazas === 0
      ? 'Esta cuenta no incluye alumnos'
      : `Has llenado tus ${plazas} plazas`
    : `Tu alta incluye ${plazas} alumnos`;
  /**
   * El texto dice DOS cosas que no pueden faltar: lo que ya tiene pagado para
   * siempre, y que a partir de la plaza siguiente el plan deja de ser opcional.
   * Descubrir el tope el día que llega el alumno nuevo, y no antes, es lo que
   * convierte una cuota razonable en una encerrona.
   */
  const textoCoach = lleno
    ? plazas === 0
      ? `El alta de tu tarjeta ya se usó en otra cuenta de entrenador, así que esta entra sin plazas. Con el plan tienes alumnos ilimitados: ${precio}${unidad}, ${ANNUAL_PRICE_EUR} € facturados una vez al año.`
      : `Para aceptar al alumno ${plazas + 1} hace falta el plan: ${precio}${unidad}, ${ANNUAL_PRICE_EUR} € facturados una vez al año. Los ${plazas} que ya tienes siguen contigo pagues o no.`
    : `Ya llevas ${usados} de ${plazas}, y son tuyos para siempre. Del alumno ${plazas + 1} en adelante hace falta el plan: ${precio}${unidad}, ${ANNUAL_PRICE_EUR} € facturados una vez al año, y el grupo deja de tener tope.`;

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
              {esAtleta ? 'Cuando quieras, sin esperar' : tituloCoach}
            </Text>
            <Text style={styles.breveTexto}>
              {esAtleta
                ? diasRestantes !== null
                  ? `Te quedan ${diasRestantes} días de prueba. Si ya lo tienes claro, pasa al plan completo por ${precio}${unidad} y olvídate del contador.`
                  : `Pasa al plan completo por ${precio}${unidad} cuando quieras.`
                : textoCoach}
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

      {/* Lo primero que ve el entrenador es lo que YA tiene, no lo que le
          falta: el euro que pagó incluye plazas de verdad y son suyas para
          siempre. Enseñar el contador es a la vez lo más honesto y lo más
          persuasivo — el que va por 4 de 5 sabe exactamente qué está a punto
          de necesitar. */}
      {!esAtleta ? (
        <View style={styles.plazas}>
          <View style={styles.plazasFila}>
            <Text style={styles.plazasTitulo}>
              {plazas === 0
                ? 'Tu alta no incluye alumnos'
                : `Tu alta incluye ${plazas} alumnos`}
            </Text>
            {plazas > 0 ? (
              <Text style={[styles.plazasCuenta, lleno && { color: colors.warning }]}>
                {usados} / {plazas}
              </Text>
            ) : null}
          </View>
          {plazas > 0 ? (
            <View style={styles.plazasPuntos}>
              {Array.from({ length: plazas }, (_, i) => (
                <View
                  key={i}
                  style={[styles.plaza, i < usados && styles.plazaOcupada]}
                />
              ))}
            </View>
          ) : null}
          <Text style={styles.plazasPie}>
            {plazas === 0
              ? 'El alta de tu tarjeta ya se usó en otra cuenta de entrenador.'
              : lleno
                ? `Están todas ocupadas. Los ${plazas} que ya tienes siguen contigo pagues o no; para aceptar al ${plazas + 1} hace falta el plan.`
                : `Son tuyas para siempre, sin caducidad. Del alumno ${plazas + 1} en adelante hace falta el plan.`}
          </Text>
        </View>
      ) : null}

      <View style={styles.precioFila}>
        <Text style={styles.precio}>{precio}</Text>
        <Text style={styles.precioUnidad}>{unidad}</Text>
      </View>
      <Text style={styles.pie}>{facturacion}</Text>

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

/**
 * Cada cuánto vuelve a saltar el aviso a pantalla completa: una semana.
 *
 * Ni una vez y nunca más —el que hoy tiene dos alumnos puede tener seis en un
 * mes y necesita enterarse— ni cada vez que abre la app, que es como se
 * consigue que alguien desinstale. Una vez por semana es un recordatorio; cada
 * día es acoso.
 */
const CADA_CUANTO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Aviso a pantalla completa del plan, para el ENTRENADOR.
 *
 * Va a pantalla completa a propósito: el tope de alumnos no es un detalle de
 * letra pequeña, es la condición que le va a afectar el día que le entre gente
 * — y enterarse ese día, y no antes, es lo que hace que un precio justo parezca
 * una encerrona. Se cierra con un toque y no vuelve en una semana.
 *
 * Al atleta no le sale: acaba de pagar el alta y tiene sus 14 días por delante;
 * plantarle una pantalla de venta encima sería cobrarle dos veces la atención.
 */
export function UpgradePopup() {
  const { profile } = useAuth();
  const [visible, setVisible] = React.useState(false);
  const clave = profile ? `udeca-plan-popup-${profile.uid}` : null;
  const esEntrenador = profile?.role === 'trainer';

  React.useEffect(() => {
    if (!clave || !esEntrenador || !canUpgrade(profile)) return;
    AsyncStorage.getItem(clave)
      .then((v) => {
        const ultimoCierre = Number(v ?? 0);
        const nunca = !Number.isFinite(ultimoCierre) || ultimoCierre <= 0;
        setVisible(nunca || Date.now() - ultimoCierre > CADA_CUANTO_MS);
      })
      .catch(() => {});
    // `profile` cambia en cada refresco; la clave (el uid) es lo que de verdad
    // decide si hay que volver a mirarlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, esEntrenador]);

  const cerrar = () => {
    setVisible(false);
    if (clave) AsyncStorage.setItem(clave, String(Date.now())).catch(() => {});
  };

  if (!visible || !esEntrenador || !canUpgrade(profile)) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={cerrar}>
      <SafeAreaView style={styles.popup} edges={['top', 'bottom']}>
        <View style={styles.popupBarra}>
          <Pressable onPress={cerrar} hitSlop={12} style={styles.popupCerrar}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.popupCuerpo}>
          <View style={styles.popupIcono}>
            <Ionicons name="people" size={26} color={colors.primary} />
          </View>
          <Text style={styles.popupEyebrow}>Tu plan de entrenador</Text>
          <Text style={styles.popupTitulo}>Así funciona tu grupo</Text>
          <UpgradeCard />
          <Pressable onPress={cerrar} style={styles.popupAhoraNo} hitSlop={8}>
            <Text style={styles.popupAhoraNoTexto}>Ahora no, gracias</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  popup: { flex: 1, backgroundColor: colors.background },
  popupBarra: { alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  popupCerrar: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupCuerpo: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  popupIcono: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  popupEyebrow: {
    ...typography.small,
    color: colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: fonts.semiBold,
  },
  popupTitulo: { ...typography.h1, color: colors.text, marginTop: 2, marginBottom: spacing.lg },
  popupAhoraNo: { alignSelf: 'center', paddingVertical: spacing.md },
  popupAhoraNoTexto: { ...typography.body, color: colors.textMuted },

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
  plazas: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  plazasFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plazasTitulo: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  plazasCuenta: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  plazasPuntos: { flexDirection: 'row', gap: 5, marginTop: spacing.sm },
  plaza: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  plazaOcupada: { backgroundColor: colors.primary },
  plazasPie: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
  precioFila: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: spacing.md },
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
