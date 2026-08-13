import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Segmented } from '../../components/Segmented';
import { CollapsibleCard } from '../../components/CollapsibleCard';
import { MemberCard } from '../../components/MemberCard';
import { SelectorDeIdioma } from '../../components/SelectorDeIdioma';
import { RateApp } from '../../components/RateApp';
import { UpgradeCard } from '../../components/UpgradeCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import {
  deleteCoachAccount,
  getAllAthletes,
  getAllCoaches,
  normalizeInviteCode,
  setCoachSubscription,
  setTrainerInviteCode,
  updateUserProfile,
} from '../../lib/firestore/users';
import { pickAvatar } from '../../lib/image';
import {
  DAY_MS,
  accesoIlimitado,
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
  // Qué cuentas se están gestionando. Los atletas pagan igual que los coaches
  // —al mes en vez de al año— y hasta ahora no salían en ninguna pantalla:
  // a un atleta con la prueba caducada había que arreglárselo a mano en la
  // base de datos.
  const [rolAdmin, setRolAdmin] = useState<'trainer' | 'athlete'>('trainer');
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

  const openAdmin = async (rol: 'trainer' | 'athlete' = rolAdmin) => {
    setAdminOpen(true);
    setRolAdmin(rol);
    setLoadingCoaches(true);
    setCoaches([]);
    try {
      setCoaches(rol === 'athlete' ? await getAllAthletes() : await getAllCoaches());
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setLoadingCoaches(false);
    }
  };

  /** El plan que le toca a esa cuenta: el coach paga al año, el atleta al mes. */
  const planDe = (c: UserProfile): 'annual' | 'monthly' =>
    c.role === 'athlete' ? 'monthly' : 'annual';

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
      await setCoachSubscription(coach.uid, 0, planDe(coach));
      setCoaches((prev) =>
        prev.map((c) =>
          c.uid === coach.uid
            ? { ...c, subscriptionUntil: 0, subscriptionPlan: planDe(coach) }
            : c
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
      await setCoachSubscription(coach.uid, until, planDe(coach));
      setCoaches((prev) =>
        prev.map((c) =>
          c.uid === coach.uid
            ? { ...c, subscriptionUntil: until, subscriptionPlan: planDe(coach) }
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

      <SelectorDeIdioma />

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
              : // El estado de la cuenta, sin precio (ver lib/subscription.ts).
                `Plan activo hasta ${
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
            <Text style={styles.sectionTitle}>Admin UDECA · cuentas</Text>
            <Pressable onPress={adminOpen ? () => setAdminOpen(false) : () => openAdmin()} hitSlop={8}>
              <Ionicons
                name={adminOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
          {!adminOpen ? (
            <Text style={styles.helperText}>
              Gestiona las suscripciones de quien paga: entrenadores y atletas.
            </Text>
          ) : (
            <>
              <Segmented<'trainer' | 'athlete'>
                opciones={[
                  { valor: 'trainer', texto: 'Entrenadores' },
                  { valor: 'athlete', texto: 'Atletas' },
                ]}
                valor={rolAdmin}
                onChange={openAdmin}
              />
              {loadingCoaches ? (
                <Text style={styles.helperText}>Cargando…</Text>
              ) : coaches.length === 0 ? (
                <Text style={styles.helperText}>
                  {rolAdmin === 'athlete'
                    ? 'Todavía no hay ningún atleta registrado.'
                    : 'Todavía no hay ningún entrenador registrado.'}
                </Text>
              ) : (
            coaches.map((c) => {
              const s = subscriptionState(c);
              // "De prueba" se dice aparte de "Activo": las dos dejan entrar,
              // pero una es alguien que paga y la otra alguien a quien se le
              // acaba el plazo. Confundirlas es no saber a quién hay que
              // llamar esta semana.
              const label = isAdmin(c)
                ? 'Admin'
                : accesoIlimitado(c)
                  ? 'Cuenta de la casa'
                  : s.legacy
                  ? 'Fundador'
                  : s.active
                    ? `${s.trial ? 'De prueba' : 'Activo'} · hasta ${c.subscriptionUntil ? fechaCorta(c.subscriptionUntil) : '—'}`
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
                          title={c.role === 'athlete' ? '+1 mes' : '+1 año'}
                          variant="secondary"
                          onPress={() => extendCoach(c, c.role === 'athlete' ? 30 : 365)}
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
            </>
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
