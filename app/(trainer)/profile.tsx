import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { DeleteAccountButton } from '../../components/DeleteAccountButton';
import { useAuth } from '../../lib/auth-context';
import {
  deleteCoachAccount,
  getAllCoaches,
  normalizeInviteCode,
  setCoachSubscription,
  setTrainerInviteCode,
  updateUserProfile,
} from '../../lib/firestore/users';
import { pickAvatar } from '../../lib/image';
import {
  ANNUAL_PRICE_EUR,
  DAY_MS,
  isAdmin,
  subscriptionState,
} from '../../lib/subscription';
import { deleteSocialStats, getSocialLeaderboard } from '../../lib/firestore/social';
import { isOnline } from '../../lib/presence';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import type { SocialStats, UserProfile } from '../../lib/types';

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

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
  // Panel admin UDECA (solo cuentas administradoras).
  const [adminOpen, setAdminOpen] = useState(false);
  const [coaches, setCoaches] = useState<UserProfile[]>([]);
  // Clasificación y presencia del grupo (socialStats de sus alumnos).
  const [leaderboard, setLeaderboard] = useState<SocialStats[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SocialStats | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      getSocialLeaderboard(profile.uid)
        .then(setLeaderboard)
        .catch(() => {});
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
      showToast('No se pudo eliminar');
      if (profile) getSocialLeaderboard(profile.uid).then(setLeaderboard).catch(() => {});
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
      showToast(`${coach.name.split(' ')[0]}: activo hasta ${fmtDate(until)}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setUpdatingCoach(null);
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
      await updateUserProfile(profile.uid, { paymentLink: url || undefined });
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
      `1) Entra en www.udeca.app (o busca "UDECA" en Google Play).\n` +
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
        <Text style={styles.name}>{profile?.name}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>Entrenador</Text>
        </View>
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Código de invitación</Text>
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
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Cobros</Text>
        <Text style={styles.helperText}>
          Pega tu enlace de pago (Stripe, Bizum, PayPal.me, Revolut…). Tus alumnos verán un botón
          "Pagar ahora" en su aviso de cobro y podrán pagarte de un toque.
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
      </Card>

      <Card style={styles.section}>
        <View style={styles.groupHeadRow}>
          <Text style={styles.sectionTitle}>Clasificación del grupo</Text>
          {onlineCount > 0 ? (
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlinePillText}>{onlineCount} en línea</Text>
            </View>
          ) : null}
        </View>
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
      </Card>

      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>¿Quitar de la clasificación?</Text>
            <Text style={styles.confirmText}>
              Se eliminará a {deleteTarget?.name} de la tabla. Sus entrenos e historial no se tocan.
              Si sigue usando la app y entrena, volverá a aparecer.
            </Text>
            <View style={styles.confirmActions}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setDeleteTarget(null)}
                style={{ flex: 1 }}
              />
              <Button
                title="Eliminar"
                variant="danger"
                onPress={confirmDeleteEntry}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Card style={styles.section}>
        <View style={styles.subHeader}>
          <Text style={styles.sectionTitle}>Suscripción</Text>
          <View style={[styles.subBadge, !sub.active && styles.subBadgeOff]}>
            <Text style={styles.subBadgeText}>
              {admin ? 'ADMIN' : sub.legacy ? 'FUNDADOR' : 'PRO'}
            </Text>
          </View>
        </View>
        <Text style={styles.helperText}>
          {admin
            ? 'Cuenta administradora de UDECA: acceso completo sin caducidad.'
            : sub.legacy
              ? 'Cuenta fundadora: acceso completo a UDECA Pro.'
              : `Plan anual (${ANNUAL_PRICE_EUR} €/año) · activo hasta ${
                  profile?.subscriptionUntil ? fmtDate(profile.subscriptionUntil) : '—'
                }.`}
        </Text>
      </Card>

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
                    ? `Activo · hasta ${c.subscriptionUntil ? fmtDate(c.subscriptionUntil) : '—'}`
                    : c.subscriptionUntil
                      ? `CADUCADO · desde ${fmtDate(c.subscriptionUntil)}`
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

      <Button title="Cerrar sesión" variant="danger" onPress={signOut} style={{ marginTop: spacing.lg }} />
      <DeleteAccountButton />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  name: { ...typography.h1, color: colors.text, textAlign: 'center' },
  email: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  roleBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  roleBadgeText: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  groupHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(46,125,91,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46,125,91,0.45)',
  },
  onlinePillText: { ...typography.small, color: '#4CAF7D', fontFamily: fonts.semiBold, fontSize: 12 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF7D' },
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
  confirmBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: spacing.lg,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  confirmTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  confirmText: { ...typography.small, color: colors.textMuted, lineHeight: 19 },
  confirmActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  subBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  subBadgeOff: { borderColor: colors.danger, backgroundColor: colors.dangerMuted },
  subBadgeText: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1,
  },
  coachCard: { borderTopWidth: 1, borderTopColor: colors.border },
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
