import React from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from './Card';
import { useAuth } from '../lib/auth-context';
import { updateUserProfile } from '../lib/firestore/users';
import { track } from '../lib/analytics';
import {
  CAN_LINK_TO_PAYMENT,
  clientSlotsOf,
  isAdmin,
  subscriptionCheckoutUrl,
  subscriptionState,
  TRIAL_DAYS,
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
  if (!profile || !CAN_LINK_TO_PAYMENT) return false;
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
 * Solo aparece donde se puede enlazar a pagar (ver CAN_LINK_TO_PAYMENT): sin
 * precio ni enlazar a pagar fuera.
 */
export function UpgradeCard({ variante = 'completa', onClose }: Props) {
  const { profile } = useAuth();
  if (!canUpgrade(profile)) return null;

  const esAtleta = profile?.role === 'athlete';
  const estado = subscriptionState(profile);
  const url = subscriptionCheckoutUrl(profile);
  const diasRestantes = estado.trial ? estado.daysLeft : null;

  /*
   * Aquí no se dice ningún precio (ver lib/subscription.ts). Lo que sustituye
   * a la cifra no es un hueco: es lo que el entrenador de verdad necesita
   * saber para decidir —cuántas plazas tiene, cuántas le quedan y qué pasa
   * cuando se acaben—. Eso ya estaba escrito; lo único que se va es el número.
   */
  const facturacion = esAtleta
    ? 'Sin permanencia. Se cancela cuando quieras.'
    : 'Se cobra una vez al año.';

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
      ? 'El alta de tu tarjeta ya se usó en otra cuenta de entrenador, así que esta entra sin plazas. Con el plan tienes alumnos ilimitados.'
      : `Para aceptar al alumno ${plazas + 1} hace falta el plan. Los ${plazas} que ya tienes siguen contigo pagues o no.`
    : `Ya llevas ${usados} de ${plazas}, y son tuyos para siempre. Del alumno ${plazas + 1} en adelante hace falta el plan, y el grupo deja de tener tope.`;

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
                  ? `Te quedan ${diasRestantes} días de prueba. Si ya lo tienes claro, pasa al plan completo y olvídate del contador.`
                  : 'Pasa al plan completo cuando quieras.'
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

      {/* El atleta ve lo mismo que el entrenador, pero contado en días: lo que
          compró con el euro y cuánto le queda. Un contador a la vista evita la
          sorpresa del día 15, que es cuando se pierde a la gente. */}
      {esAtleta && diasRestantes !== null ? (
        <View style={styles.plazas}>
          <View style={styles.plazasFila}>
            <Text style={styles.plazasTitulo}>Tu alta incluye {TRIAL_DAYS} días</Text>
            <Text
              style={[styles.plazasCuenta, diasRestantes <= 3 && { color: colors.warning }]}
            >
              quedan {diasRestantes}
            </Text>
          </View>
          <View style={styles.plazasPuntos}>
            {Array.from({ length: TRIAL_DAYS }, (_, i) => (
              <View
                key={i}
                style={[styles.plaza, i < TRIAL_DAYS - diasRestantes && styles.plazaOcupada]}
              />
            ))}
          </View>
          <Text style={styles.plazasPie}>
            Con todo abierto, sin recortes. Cuando terminen, lo que has
            registrado te espera intacto.
          </Text>
        </View>
      ) : null}

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
 * Cada cuánto vuelve a saltar el aviso a pantalla completa: una semana.
 *
 * Ni una vez y nunca más —el que hoy tiene dos alumnos puede tener seis en un
 * mes y necesita enterarse— ni cada vez que abre la app, que es como se
 * consigue que alguien desinstale. Una vez por semana es un recordatorio; cada
 * día es acoso.
 */
const CADA_CUANTO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Aviso a pantalla completa del plan.
 *
 * Va a pantalla completa a propósito: lo que aquí se cuenta —el tope de
 * alumnos, los días de prueba— no es un detalle de letra pequeña, es la
 * condición que le va a afectar el día que le entre gente o se le acabe el
 * plazo. Enterarse ESE día, y no antes, es lo que hace que un precio justo
 * parezca una encerrona.
 *
 * Sale igual al entrenador y al atleta, con lo suyo cada uno: las plazas de
 * alumno o los días que le quedan. Se cierra con un toque y no vuelve en una
 * semana, y el descanso se guarda en la CUENTA: cerrarlo en el móvil y que
 * salte en el ordenador media hora después no es recordar, es perseguir.
 *
 * Cuando la prueba del atleta caduca ya no llega aquí: el muro de pago le sale
 * antes y bloquea la app entera, así que no se pisan.
 */
export function UpgradePopup() {
  const { profile, refreshProfile } = useAuth();
  const [cerradoAhora, setCerradoAhora] = React.useState(false);
  const esAtleta = profile?.role === 'athlete';

  const ultimoCierre = profile?.planPopupClosedAt ?? 0;
  const tocaEnseñarlo = Date.now() - ultimoCierre > CADA_CUANTO_MS;

  const cerrar = () => {
    setCerradoAhora(true);
    if (!profile) return;
    updateUserProfile(profile.uid, { planPopupClosedAt: Date.now() })
      .then(() => refreshProfile())
      .catch(() => {});
  };

  if (cerradoAhora || !tocaEnseñarlo || !canUpgrade(profile)) return null;

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
            <Ionicons name={esAtleta ? 'barbell' : 'people'} size={26} color={colors.primary} />
          </View>
          <Text style={styles.popupEyebrow}>
            {esAtleta ? 'Tu plan de atleta' : 'Tu plan de entrenador'}
          </Text>
          <Text style={styles.popupTitulo}>
            {esAtleta ? 'Así funciona tu prueba' : 'Así funciona tu grupo'}
          </Text>
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
