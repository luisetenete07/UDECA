import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CollapsibleCard } from '../../components/CollapsibleCard';
import { MemberCard } from '../../components/MemberCard';
import { RateApp } from '../../components/RateApp';
import { UpgradeCard } from '../../components/UpgradeCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import {
  deleteCoachAccount,
  getAllCoaches,
  normalizeInviteCode,
  setCoachSubscription,
  setTrainerInviteCode,
  setTrainerPaymentLink,
  updateUserProfile,
} from '../../lib/firestore/users';
import { pickAvatar } from '../../lib/image';
import { disconnectCoachPayments, getConnectStatus, startCoachOnboarding } from '../../lib/connect';
import {
  ANNUAL_PRICE_EUR,
  CAN_SELL_IN_APP,
  COACH_MONTHLY_EQUIV_EUR,
  DAY_MS,
  isAdmin,
  subscriptionState,
} from '../../lib/subscription';
import { deleteSocialStats, subscribeSocialLeaderboard } from '../../lib/firestore/social';
import { getRecentErrorLogs, groupErrors, type ErrorGroup } from '../../lib/firestore/errorLogs';
import {
  buildFunnel,
  getDailyCounters,
  sumCounters,
  type FunnelStep,
} from '../../lib/firestore/analytics';
import { isOnline } from '../../lib/presence';
import { Chip, ChipRow } from '../../components/Chip';
import { fechaCorta } from '../../lib/fechas';
import { Dialogo } from '../../components/Dialogo';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import type { SocialStats, UserProfile } from '../../lib/types';

export default function TrainerProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  // Enlace de cobro (Stripe/Bizum/PayPal…) que verán los alumnos para pagar.
  const [payLink, setPayLink] = useState(profile?.paymentLink ?? '');
  const [savingPayLink, setSavingPayLink] = useState(false);
  const [payLinkSaved, setPayLinkSaved] = useState(false);
  // Stripe Connect (cobros directos sin comisión de UDECA).
  const [connecting, setConnecting] = useState(false);
  const [checkingConnect, setCheckingConnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const chargesEnabled = Boolean(profile?.stripeChargesEnabled);
  const hasConnectAccount = Boolean(profile?.stripeAccountId);
  // Panel admin UDECA (solo cuentas administradoras).
  const [adminOpen, setAdminOpen] = useState(false);
  // Errores reales de los usuarios (solo CEO).
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [errorGroups, setErrorGroups] = useState<ErrorGroup[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  // Embudo de ventas (solo CEO).
  const [funnelOpen, setFunnelOpen] = useState(false);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [funnelExtra, setFunnelExtra] = useState<Record<string, number>>({});
  const [funnelDays, setFunnelDays] = useState(30);
  const [loadingFunnel, setLoadingFunnel] = useState(false);
  const [coaches, setCoaches] = useState<UserProfile[]>([]);
  // Clasificación y presencia del grupo (socialStats de sus alumnos).
  const [leaderboard, setLeaderboard] = useState<SocialStats[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SocialStats | null>(null);
  // Clasificación en vivo: rachas, entrenos y presencia se refrescan solos, y
  // un alumno recién incorporado aparece al instante. Solo escucha mientras la
  // pantalla está delante: los alumnos refrescan su presencia cada pocos
  // minutos y no queremos recibir esos latidos en segundo plano.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      return subscribeSocialLeaderboard(profile.uid, setLeaderboard);
    }, [profile])
  );

  const confirmDeleteEntry = async () => {
    if (!deleteTarget) return;
    const uid = deleteTarget.uid;
    setLeaderboard((prev) => prev.filter((s) => s.uid !== uid));
    setDeleteTarget(null);
    try {
      await deleteSocialStats(uid);
      showToast('Perfil eliminado de la clasificación');
    } catch {
      // La suscripción en vivo devuelve la fila a su sitio por sí sola.
      showToast('No se pudo eliminar');
    }
  };
  const onlineCount = leaderboard.filter((s) => isOnline(s.lastSeen)).length;
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [updatingCoach, setUpdatingCoach] = useState<string | null>(null);
  const [daysInput, setDaysInput] = useState<Record<string, string>>({});

  const applyDays = async (coach: UserProfile, sign: 1 | -1) => {
    const n = Math.abs(parseInt(daysInput[coach.uid] ?? '', 10) || 0);
    if (n === 0) {
      showToast('Escribe cuántos días');
      return;
    }
    setDaysInput((p) => ({ ...p, [coach.uid]: '' }));
    await extendCoach(coach, sign * n);
  };

  const sub = subscriptionState(profile);
  const admin = isAdmin(profile);

  const openFunnel = async (days = funnelDays) => {
    setFunnelOpen(true);
    setFunnelDays(days);
    setLoadingFunnel(true);
    try {
      const totals = sumCounters(await getDailyCounters(), days);
      setFunnel(buildFunnel(totals));
      setFunnelExtra(totals);
    } catch {
      showToast('No se pudieron cargar las métricas');
    } finally {
      setLoadingFunnel(false);
    }
  };

  const openErrors = async () => {
    setErrorsOpen(true);
    setLoadingErrors(true);
    try {
      setErrorGroups(groupErrors(await getRecentErrorLogs()));
    } catch {
      showToast('No se pudieron cargar los errores');
    } finally {
      setLoadingErrors(false);
    }
  };

  const openAdmin = async () => {
    setAdminOpen(true);
    setLoadingCoaches(true);
    try {
      setCoaches(await getAllCoaches());
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setLoadingCoaches(false);
    }
  };

  // Confirmación multiplataforma para acciones destructivas del admin.
  const confirmAdmin = (message: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      return Promise.resolve(window.confirm(message));
    }
    return new Promise((resolve) => {
      Alert.alert('Admin UDECA', message, [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  };

  // Quita la suscripción de un coach (queda CADUCADO y ve el muro de pago).
  const revokeCoach = async (coach: UserProfile) => {
    if (
      !(await confirmAdmin(
        `¿Quitar la suscripción de ${coach.name}? Verá el muro de pago hasta reactivarla.`
      ))
    )
      return;
    setUpdatingCoach(coach.uid);
    try {
      await setCoachSubscription(coach.uid, 0);
      setCoaches((prev) =>
        prev.map((c) =>
          c.uid === coach.uid ? { ...c, subscriptionUntil: 0, subscriptionPlan: 'annual' } : c
        )
      );
      showToast('Suscripción retirada');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo retirar');
    } finally {
      setUpdatingCoach(null);
    }
  };

  // Elimina la cuenta (perfil) de un coach de la plataforma.
  const deleteCoach = async (coach: UserProfile) => {
    if (
      !(await confirmAdmin(
        `¿ELIMINAR la cuenta de ${coach.name} (${coach.email})? Perderá el acceso y desaparecerá de la plataforma. Esta acción no se puede deshacer.`
      ))
    )
      return;
    setUpdatingCoach(coach.uid);
    try {
      await deleteCoachAccount(coach.uid);
      setCoaches((prev) => prev.filter((c) => c.uid !== coach.uid));
      showToast('Cuenta eliminada');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setUpdatingCoach(null);
    }
  };

  // Extiende la suscripción de un coach: +365 días desde hoy o desde su fecha
  // futura (renovación anticipada no pierde días).
  const extendCoach = async (coach: UserProfile, days: number) => {
    setUpdatingCoach(coach.uid);
    try {
      const base =
        coach.subscriptionUntil && coach.subscriptionUntil > Date.now()
          ? coach.subscriptionUntil
          : Date.now();
      const until = base + days * DAY_MS;
      await setCoachSubscription(coach.uid, until);
      setCoaches((prev) =>
        prev.map((c) =>
          c.uid === coach.uid
            ? { ...c, subscriptionUntil: until, subscriptionPlan: 'annual' }
            : c
        )
      );
      showToast(`${coach.name.split(' ')[0]}: activo hasta ${fechaCorta(until)}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setUpdatingCoach(null);
    }
  };

  // Inicia el alta de Stripe Connect (abre el formulario de Stripe).
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const r = await startCoachOnboarding(profile);
      if (r.ok && r.url) {
        Linking.openURL(r.url).catch(() => {});
      } else {
        showToast(r.reason ? `No se pudo: ${r.reason}` : 'No se pudo abrir el alta');
      }
    } finally {
      setConnecting(false);
    }
  };

  // Comprueba si Stripe ya ha activado los cobros de la cuenta del coach.
  const handleRefreshConnect = async () => {
    setCheckingConnect(true);
    try {
      const s = await getConnectStatus(profile);
      await refreshProfile();
      if (s.chargesEnabled) showToast('¡Cobros activados! Ya puedes recibir pagos');
      else if (s.reason) showToast(`Aún no: ${s.reason}`);
      else showToast('Alta aún en revisión. Termina los datos en Stripe.');
    } finally {
      setCheckingConnect(false);
    }
  };

  // Desvincula la cuenta de cobros (la app olvida la cuenta de Stripe).
  const handleDisconnectPayments = async () => {
    const ok = await confirmAdmin(
      '¿Desvincular tu cuenta de cobros? Tus alumnos dejarán de poder pagarte por la app hasta que la vuelvas a conectar. Tu cuenta de Stripe y tus pagos anteriores no se borran.'
    );
    if (!ok) return;
    setDisconnecting(true);
    try {
      const r = await disconnectCoachPayments(profile);
      await refreshProfile();
      showToast(r.ok ? 'Cuenta de cobros desvinculada' : r.reason ? `No se pudo: ${r.reason}` : 'No se pudo desvincular');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSavePayLink = async () => {
    if (!profile) return;
    const url = payLink.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      showToast('El enlace debe empezar por https://');
      return;
    }
    setSavingPayLink(true);
    try {
      // Con enlace vacío BORRA el campo (si no, reaparecería el antiguo).
      await setTrainerPaymentLink(profile.uid, url);
      await refreshProfile();
      setPayLinkSaved(true);
      setTimeout(() => setPayLinkSaved(false), 2500);
    } catch {
      showToast('No se pudo guardar el enlace');
    } finally {
      setSavingPayLink(false);
    }
  };

  const handleSaveCode = async () => {
    if (!profile) return;
    setCodeError(null);
    setSavingCode(true);
    try {
      await setTrainerInviteCode(profile.uid, codeInput);
      await refreshProfile();
      setEditingCode(false);
      showToast('Código actualizado');
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : 'No se pudo guardar el código.');
    } finally {
      setSavingCode(false);
    }
  };

  const handleChangePhoto = async () => {
    if (!profile) return;
    setUploadingPhoto(true);
    try {
      const dataUrl = await pickAvatar();
      if (dataUrl) {
        await updateUserProfile(profile.uid, { photoURL: dataUrl });
        await refreshProfile();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo actualizar la foto.';
      if (Platform.OS !== 'web') Alert.alert('Foto de perfil', message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleShare = async () => {
    if (!profile?.inviteCode) return;
    const message =
      `Únete a mis entrenamientos en UDECA.\n\n` +
      // La app vive en app.udeca.app; www.udeca.app es la web de presentación.
      // Al alumno hay que mandarlo donde puede registrarse, no al escaparate.
      `1) Entra en app.udeca.app (o busca "UDECA" en Google Play).\n` +
      `2) Regístrate como alumno con mi código: ${profile.inviteCode}\n\n` +
      `¡Nos vemos dentro!`;
    if (Platform.OS === 'web') {
      // Usa el diálogo nativo de compartir del navegador si existe; si no, copia.
      const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
      if (nav.share) {
        try {
          await nav.share({ text: message });
          return;
        } catch {
          // cancelado o no soportado: caemos a copiar
        }
      }
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Silently ignore clipboard failures (e.g. insecure context).
      }
    } else {
      await Share.share({ message });
    }
  };

  return (
    <ScreenContainer>
      <Pressable
        onPress={() => router.push('/(trainer)/dashboard')}
        style={styles.backBtn}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>

      <View style={styles.hero}>
        <Pressable onPress={handleChangePhoto} style={styles.avatarWrap}>
          <Avatar name={profile?.name} photoURL={profile?.photoURL} size={104} />
          <View style={styles.cameraBadge}>
            <Ionicons
              name={uploadingPhoto ? 'hourglass' : 'camera'}
              size={15}
              color={colors.onPrimary}
            />
          </View>
        </Pressable>
        {/* Ni el nombre ni el distintivo de "Entrenador" salen aquí: los dos
            van impresos dentro de la tarjeta, dos centímetros más abajo. El
            nombre estaba escrito dos veces en la misma pantalla y a la misma
            altura de un dedo. Queda el correo, que es lo único que esto
            responde de verdad: en qué cuenta estoy. */}
        <Text style={styles.email}>{profile?.email}</Text>
      </View>

      {/* El carné: quién es dentro de UDECA, y su número si es fundador. */}
      <MemberCard />

      {/* De aquí abajo, todo son ajustes: cosas que se tocan una vez y no se
          vuelven a mirar. Plegadas, el perfil pasa de tres pantallas y media a
          una; y el dato que importa de cada una —el código, si los cobros
          están activos, hasta cuándo va la suscripción— se lee sin abrirlas.
          Se abre solo lo que pide acción. */}
      <CollapsibleCard
        id="coach-invitacion"
        icon="key-outline"
        title="Código de invitación"
        hint={profile?.inviteCode ?? undefined}
        defaultOpen={false}
      >
        <Text style={styles.helperText}>
          Comparte este código con tus clientes para que se registren y queden vinculados a ti
          automáticamente.
        </Text>
        <View style={styles.codeBox}>
          <Text style={styles.code}>{profile?.inviteCode}</Text>
        </View>

        {editingCode ? (
          <>
            <TextField
              label="Nuevo código (letras y números)"
              value={codeInput}
              onChangeText={(v) => setCodeInput(normalizeInviteCode(v))}
              placeholder="Ej. LUISTENA"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={16}
              error={codeError ?? undefined}
            />
            <Button
              title="Guardar código"
              onPress={handleSaveCode}
              loading={savingCode}
              disabled={codeInput.length < 3}
            />
            <Button
              title="Cancelar"
              variant="secondary"
              onPress={() => {
                setEditingCode(false);
                setCodeError(null);
              }}
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : (
          <>
            <Button
              title={copied ? 'Copiado' : Platform.OS === 'web' ? 'Copiar código' : 'Compartir código'}
              variant="secondary"
              onPress={handleShare}
            />
            <Button
              title="Personalizar mi código"
              variant="ghost"
              onPress={() => {
                setCodeInput(profile?.inviteCode ?? '');
                setEditingCode(true);
              }}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}
      </CollapsibleCard>

      {/* Sin cobros conectados hay trabajo pendiente, así que se abre sola.
          Conectada, no hay nada que hacer y se queda recogida. */}
      <CollapsibleCard
        id="coach-cobros"
        icon="card-outline"
        title="Cobra a tus alumnos"
        hint={chargesEnabled ? 'Activo' : 'Sin conectar'}
        defaultOpen={!chargesEnabled}
      >
        {chargesEnabled ? (
          <Text style={styles.helperText}>
            Tus cobros están activos. Cuando un alumno pague su cuota desde la app, el dinero irá
            directo a tu cuenta. UDECA no te cobra ninguna comisión: recibes el 100 %.
          </Text>
        ) : (
          <Text style={styles.helperText}>
            Conecta tu cuenta una vez y cobra a tus alumnos desde la app.{' '}
            <Text style={styles.connectStrong}>Sin comisiones de UDECA: recibes el 100 %.</Text> El
            alumno paga con tarjeta y el dinero llega directo a ti.
          </Text>
        )}
        {chargesEnabled ? (
          <Button
            title={checkingConnect ? 'Comprobando...' : 'Revisar mis datos de cobro'}
            variant="secondary"
            onPress={handleConnect}
            loading={connecting}
          />
        ) : (
          <>
            <Button
              title="Conectar mis cobros"
              onPress={handleConnect}
              loading={connecting}
            />
            <Button
              title={checkingConnect ? 'Comprobando...' : 'Ya lo he hecho · Actualizar'}
              variant="secondary"
              onPress={handleRefreshConnect}
              loading={checkingConnect}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}
        {hasConnectAccount ? (
          <Button
            title={disconnecting ? 'Desvinculando...' : 'Desvincular cuenta de cobros'}
            variant="ghost"
            onPress={handleDisconnectPayments}
            loading={disconnecting}
            style={{ marginTop: spacing.xs }}
          />
        ) : null}
      </CollapsibleCard>

      <CollapsibleCard
        id="coach-otro-cobro"
        icon="link-outline"
        title="Otro método de cobro"
        hint={payLink ? 'Puesto' : 'Sin poner'}
        defaultOpen={false}
      >
        <Text style={styles.helperText}>
          ¿Prefieres Bizum, PayPal.me, Revolut u otro enlace? Pégalo aquí y tus alumnos verán un
          botón "Pagar ahora" en su aviso de cobro.
        </Text>
        <TextField
          label="Enlace de pago"
          value={payLink}
          onChangeText={setPayLink}
          placeholder="https://buy.stripe.com/…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        {payLinkSaved ? <Text style={styles.savedText}>Enlace guardado</Text> : null}
        <Button
          title="Guardar enlace de pago"
          variant="secondary"
          onPress={handleSavePayLink}
          loading={savingPayLink}
          disabled={payLink.trim() === (profile?.paymentLink ?? '')}
        />
      </CollapsibleCard>

      <CollapsibleCard
        id="coach-clasificacion"
        icon="trophy-outline"
        title="Clasificación"
        hint={
          onlineCount > 0
            ? `${onlineCount} en línea`
            : leaderboard.length > 0
              ? `${leaderboard.length} ${leaderboard.length === 1 ? 'alumno' : 'alumnos'}`
              : undefined
        }
        defaultOpen={false}
      >
        {leaderboard.length === 0 ? (
          <Text style={styles.mutedSmall}>
            Aparecerá cuando tus alumnos empiecen a entrenar con la app.
          </Text>
        ) : (
          leaderboard.slice(0, 10).map((s, i) => (
            <View key={s.uid} style={styles.rankRow}>
              <Text style={styles.rankPos}>{i + 1}</Text>
              <Avatar name={s.name} photoURL={s.photoURL} size={34} />
              <View style={{ flex: 1 }}>
                <View style={styles.rankNameRow}>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  {isOnline(s.lastSeen) ? <View style={styles.onlineDot} /> : null}
                </View>
                <Text style={styles.rankMeta}>
                  {s.sessionsThisWeek} esta semana · {s.totalWorkouts} totales
                  {s.currentStreak > 1 ? ` · racha ${s.currentStreak}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => setDeleteTarget(s)}
                hitSlop={8}
                style={styles.rankDelete}
              >
                <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
              </Pressable>
            </View>
          ))
        )}
        {leaderboard.length > 0 ? (
          <Text style={styles.rankHint}>
            Mantén la lista limpia: elimina perfiles antiguos o de prueba con la papelera.
          </Text>
        ) : null}
      </CollapsibleCard>

      <Dialogo
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        icono="trash-outline"
        titulo="¿Quitar de la clasificación?"
        texto={`Se eliminará a ${deleteTarget?.name ?? ''} de la tabla. Sus entrenos e historial no se tocan. Si sigue usando la app y entrena, volverá a aparecer.`}
        accion="Eliminar"
        onAccion={confirmDeleteEntry}
      />

      <CollapsibleCard
        id="coach-suscripcion"
        icon="shield-checkmark-outline"
        title="Suscripción"
        hint={admin ? 'Admin' : sub.legacy ? 'Fundador' : sub.active ? 'Activa' : 'Caducada'}
        defaultOpen={false}
      >
        <Text style={styles.helperText}>
          {admin
            ? 'Cuenta administradora de UDECA: acceso completo sin caducidad.'
            : sub.legacy
              ? 'Cuenta fundadora: acceso completo a UDECA Pro.'
              : // En iOS, el estado sin precio (ver CAN_SELL_IN_APP).
                `Plan${CAN_SELL_IN_APP ? ` (${COACH_MONTHLY_EQUIV_EUR} €/mes, ${ANNUAL_PRICE_EUR} € al año)` : ''} · activo hasta ${
                  profile?.subscriptionUntil ? fechaCorta(profile.subscriptionUntil) : '—'
                }.`}
        </Text>
      </CollapsibleCard>

      {admin ? (
        <Card accent style={styles.section}>
          <View style={styles.subHeader}>
            <Text style={styles.sectionTitle}>Embudo de ventas</Text>
            <Pressable
              onPress={funnelOpen ? () => setFunnelOpen(false) : () => openFunnel()}
              hitSlop={8}
            >
              <Ionicons
                name={funnelOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
          {!funnelOpen ? (
            <Text style={styles.helperText}>
              Dónde se cae la gente entre abrir la app y crear la cuenta.
            </Text>
          ) : loadingFunnel ? (
            <Text style={styles.helperText}>Cargando métricas...</Text>
          ) : (
            <>
              <ChipRow>
                {[7, 30, 60].map((d) => (
                  <Chip
                    key={d}
                    texto={`${d} días`}
                    activo={funnelDays === d}
                    onPress={() => openFunnel(d)}
                  />
                ))}
              </ChipRow>
              {funnel.map((step, i) => (
                <View key={step.key} style={styles.funnelRow}>
                  <View style={styles.funnelHead}>
                    <Text style={styles.funnelLabel}>{step.label}</Text>
                    <Text style={styles.funnelValue}>{step.value}</Text>
                  </View>
                  {/* La barra es sobre el total inicial: se ve el desplome. */}
                  <View style={styles.funnelTrack}>
                    <View
                      style={[
                        styles.funnelFill,
                        { width: `${Math.max(2, step.pctOfTop)}%` },
                        // Menos de la mitad del paso anterior = fuga gorda.
                        i > 0 && step.pctOfPrev < 50 ? styles.funnelFillBad : null,
                      ]}
                    />
                  </View>
                  {i > 0 ? (
                    <Text
                      style={[
                        styles.funnelPct,
                        step.pctOfPrev < 50 ? { color: colors.danger } : null,
                      ]}
                    >
                      {step.pctOfPrev}% de los del paso anterior
                    </Text>
                  ) : null}
                </View>
              ))}
              <Text style={styles.funnelFoot}>
                Altas por tipo — coach {funnelExtra.register_ok_trainer ?? 0} · atleta{' '}
                {funnelExtra.register_ok_athlete ?? 0} · alumno{' '}
                {funnelExtra.register_ok_client ?? 0}
              </Text>
              <Text style={styles.funnelFoot}>
                Muro de pago visto {funnelExtra.paywall_view ?? 0} · pagos iniciados{' '}
                {funnelExtra.checkout_start ?? 0} · altas fallidas{' '}
                {funnelExtra.register_fail ?? 0}
              </Text>
            </>
          )}
        </Card>
      ) : null}

      {admin ? (
        <Card accent style={styles.section}>
          <View style={styles.subHeader}>
            <Text style={styles.sectionTitle}>Errores de usuarios</Text>
            <Pressable onPress={errorsOpen ? () => setErrorsOpen(false) : openErrors} hitSlop={8}>
              <Ionicons
                name={errorsOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
          {!errorsOpen ? (
            <Text style={styles.helperText}>
              Qué se ha roto de verdad en el móvil de la gente, agrupado por fallo.
            </Text>
          ) : loadingErrors ? (
            <Text style={styles.helperText}>Cargando errores...</Text>
          ) : errorGroups.length === 0 ? (
            <Text style={styles.helperText}>
              Ningún error registrado. Buena señal.
            </Text>
          ) : (
            errorGroups.map((g) => (
              <View key={g.message} style={styles.errCard}>
                <Text style={styles.errMsg}>{g.message}</Text>
                <Text style={styles.errMeta}>
                  {g.count}× · {g.affected} usuario(s) · {g.platforms.join(', ')}
                  {g.where ? ` · ${g.where}` : ''}
                </Text>
                <Text style={styles.errMeta}>
                  Última vez: {fechaCorta(g.lastAt)} · versión {g.sample.appVersion ?? '—'}
                </Text>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {admin ? (
        <Card accent style={styles.section}>
          <View style={styles.subHeader}>
            <Text style={styles.sectionTitle}>Admin UDECA · coaches</Text>
            <Pressable onPress={adminOpen ? () => setAdminOpen(false) : openAdmin} hitSlop={8}>
              <Ionicons
                name={adminOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
          {!adminOpen ? (
            <Text style={styles.helperText}>
              Gestiona las suscripciones de los coaches de la plataforma.
            </Text>
          ) : loadingCoaches ? (
            <Text style={styles.helperText}>Cargando coaches...</Text>
          ) : (
            coaches.map((c) => {
              const s = subscriptionState(c);
              const label = isAdmin(c)
                ? 'Admin'
                : s.legacy
                  ? 'Fundador'
                  : s.active
                    ? `Activo · hasta ${c.subscriptionUntil ? fechaCorta(c.subscriptionUntil) : '—'}`
                    : c.subscriptionUntil
                      ? `CADUCADO · desde ${fechaCorta(c.subscriptionUntil)}`
                      : 'SIN ACTIVAR';
              return (
                <View key={c.uid} style={styles.coachCard}>
                  <View style={styles.coachRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.coachName}>{c.name}</Text>
                      <Text style={styles.coachEmail} numberOfLines={1}>
                        {c.email}
                      </Text>
                      <Text style={[styles.coachSub, !s.active && { color: colors.danger }]}>
                        {label}
                      </Text>
                    </View>
                    {!isAdmin(c) ? (
                      <View style={styles.coachActions}>
                        <Button
                          title="+1 año"
                          variant="secondary"
                          onPress={() => extendCoach(c, 365)}
                          loading={updatingCoach === c.uid}
                          style={styles.coachBtn}
                        />
                        {s.active || s.legacy ? (
                          <Pressable
                            onPress={() => revokeCoach(c)}
                            disabled={updatingCoach === c.uid}
                            style={styles.coachIconBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="remove-circle-outline" size={18} color={colors.warning} />
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => deleteCoach(c)}
                          disabled={updatingCoach === c.uid}
                          style={[styles.coachIconBtn, styles.coachIconDanger]}
                          hitSlop={6}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                  {!isAdmin(c) ? (
                    <View style={styles.customDaysRow}>
                      <TextField
                        value={daysInput[c.uid] ?? ''}
                        onChangeText={(v) => setDaysInput((p) => ({ ...p, [c.uid]: v }))}
                        placeholder="Nº de días"
                        keyboardType="numeric"
                        containerStyle={styles.customDaysField}
                      />
                      <Pressable
                        onPress={() => applyDays(c, 1)}
                        disabled={updatingCoach === c.uid}
                        style={styles.daysBtn}
                        hitSlop={4}
                      >
                        <Ionicons name="add" size={15} color={colors.primary} />
                        <Text style={styles.daysBtnText}>Añadir</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => applyDays(c, -1)}
                        disabled={updatingCoach === c.uid}
                        style={styles.daysBtn}
                        hitSlop={4}
                      >
                        <Ionicons name="remove" size={15} color={colors.warning} />
                        <Text style={[styles.daysBtnText, { color: colors.warning }]}>Quitar</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </Card>
      ) : null}

      {/* El plan anual, hasta que lo active. */}
      <UpgradeCard />

      <RateApp />

      <Button title="Cerrar sesión" variant="danger" onPress={signOut} style={{ marginTop: spacing.lg }} />

      {/* Ver el comentario del mismo botón en el perfil del alumno. */}
      <Pressable onPress={() => router.push('/account-deletion')} style={styles.borrarCuenta}>
        <Text style={styles.borrarCuentaTexto}>Eliminar mi cuenta</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  borrarCuenta: { alignSelf: 'center', paddingVertical: spacing.lg },
  borrarCuentaTexto: { ...typography.small, color: colors.textFaint, textDecorationLine: 'underline' },
  backBtn: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  avatarWrap: { marginBottom: spacing.md },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  email: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  mutedSmall: { ...typography.small, color: colors.textFaint },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rankPos: { ...typography.h3, color: colors.primaryBright, width: 24, textAlign: 'center' },
  rankNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flexShrink: 1 },
  rankMeta: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  rankDelete: { padding: 6 },
  rankHint: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm, lineHeight: 17 },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  coachCard: { borderTopWidth: 1, borderTopColor: colors.border },
  funnelRow: { marginTop: spacing.md },
  funnelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  funnelLabel: { ...typography.small, color: colors.text },
  funnelValue: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  funnelTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: 4,
  },
  funnelFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  funnelFillBad: { backgroundColor: colors.danger },
  funnelPct: { ...typography.small, color: colors.textMuted, fontSize: 11, marginTop: 3 },
  funnelFoot: {
    ...typography.small,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.sm,
  },
  errCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  errMsg: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  errMeta: { ...typography.small, color: colors.textMuted, fontSize: 11, marginTop: 2 },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  customDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  customDaysField: { flex: 1, marginBottom: 0 },
  daysBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  daysBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  coachName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  coachEmail: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  coachSub: { ...typography.small, color: colors.primaryBright, fontSize: 11, marginTop: 2 },
  coachBtn: { paddingHorizontal: spacing.md },
  coachActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  coachIconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachIconDanger: { borderColor: colors.danger },
  helperText: { ...typography.small, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  connectStrong: { color: colors.text, fontFamily: fonts.semiBold },
  savedText: { ...typography.small, color: colors.primaryBright, marginBottom: spacing.sm },
  codeBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  code: {
    ...typography.h1,
    color: colors.primary,
    letterSpacing: 4,
    fontFamily: fonts.display,
  },
});
