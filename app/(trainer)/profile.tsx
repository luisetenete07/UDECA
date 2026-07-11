import React, { useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
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
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import type { UserProfile } from '../../lib/types';

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

export default function TrainerProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  // Panel admin UDECA (solo cuentas administradoras).
  const [adminOpen, setAdminOpen] = useState(false);
  const [coaches, setCoaches] = useState<UserProfile[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [updatingCoach, setUpdatingCoach] = useState<string | null>(null);

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
    const message = `Únete a mis entrenamientos en UDECA. Descarga la app y regístrate como cliente usando este código: ${profile.inviteCode}`;
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(profile.inviteCode);
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
        <View style={styles.subHeader}>
          <Text style={styles.sectionTitle}>Suscripción</Text>
          <View style={[styles.subBadge, !sub.active && styles.subBadgeOff]}>
            <Text style={styles.subBadgeText}>
              {admin
                ? 'ADMIN'
                : sub.legacy
                  ? 'FUNDADOR'
                  : sub.onTrial
                    ? 'PRUEBA'
                    : 'PRO'}
            </Text>
          </View>
        </View>
        <Text style={styles.helperText}>
          {admin
            ? 'Cuenta administradora de UDECA: acceso completo sin caducidad.'
            : sub.legacy
              ? 'Cuenta fundadora: acceso completo a UDECA Pro.'
              : sub.onTrial
                ? `Prueba gratuita: te quedan ${sub.daysLeft} día(s). Después, UDECA Pro por ${ANNUAL_PRICE_EUR} €/año.`
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
                  : `${s.active ? (s.onTrial ? 'Prueba' : 'Activo') : 'CADUCADO'}${
                      c.subscriptionUntil ? ` · hasta ${fmtDate(c.subscriptionUntil)}` : ''
                    }`;
              return (
                <View key={c.uid} style={styles.coachRow}>
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
                    <Button
                      title="+1 año"
                      variant="secondary"
                      onPress={() => extendCoach(c, 365)}
                      loading={updatingCoach === c.uid}
                      style={styles.coachBtn}
                    />
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
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  coachName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  coachEmail: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  coachSub: { ...typography.small, color: colors.primaryBright, fontSize: 11, marginTop: 2 },
  coachBtn: { paddingHorizontal: spacing.md },
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
