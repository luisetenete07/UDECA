import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatTile } from '../../components/StatTile';
import { TextField } from '../../components/TextField';
import { DeleteAccountButton } from '../../components/DeleteAccountButton';
import { useAuth } from '../../lib/auth-context';
import { updateUserProfile } from '../../lib/firestore/users';
import { getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { pickAvatar } from '../../lib/image';
import { cancelWorkoutReminder, scheduleWorkoutReminder } from '../../lib/notifications';
import {
  activeWeeks,
  computeAchievements,
  currentStreak,
  type Achievement,
} from '../../lib/stats';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import { EXPERIENCE_LEVELS, type ExperienceLevel } from '../../lib/types';

const REMINDER_TIMES = [7, 9, 12, 18, 20];

export default function ClientProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [goal, setGoal] = useState(profile?.goal ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [level, setLevel] = useState<ExperienceLevel | undefined>(profile?.level);
  const [targetWeight, setTargetWeight] = useState(
    profile?.targetWeightKg ? String(profile.targetWeightKg) : ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [reminderHour, setReminderHour] = useState<number | null>(
    profile?.reminderEnabled ? profile.reminderHour ?? 18 : null
  );

  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weeks, setWeeks] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const [workoutLogs, weightLogs] = await Promise.all([
      getWorkoutLogsForClient(profile.uid),
      getWeightLogsForClient(profile.uid),
    ]);
    setTotalWorkouts(workoutLogs.length);
    setStreak(currentStreak(workoutLogs));
    setWeeks(activeWeeks(workoutLogs));
    setAchievements(computeAchievements(workoutLogs, weightLogs));
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
      if (Platform.OS === 'web') {
        setSaved(false);
      } else {
        Alert.alert('Foto de perfil', message);
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateUserProfile(profile.uid, {
        goal: goal.trim(),
        bio: bio.trim(),
        level,
        targetWeightKg: targetWeight ? Number(targetWeight.replace(',', '.')) : undefined,
      });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleReminder = async (hour: number) => {
    if (!profile) return;
    // Si tocas la hora ya activa, se desactiva.
    if (reminderHour === hour) {
      setReminderHour(null);
      await cancelWorkoutReminder();
      await updateUserProfile(profile.uid, { reminderEnabled: false });
      await refreshProfile();
      return;
    }
    setReminderHour(hour);
    const ok = await scheduleWorkoutReminder(hour, 0);
    await updateUserProfile(profile.uid, { reminderEnabled: ok, reminderHour: hour });
    await refreshProfile();
    if (!ok && Platform.OS === 'web') {
      // En web las notificaciones no están soportadas; guardamos la preferencia igual.
    }
  };

  if (loading) return <LoadingScreen />;

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : '';
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

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
        {profile?.level ? (
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>{profile.level}</Text>
          </View>
        ) : null}
        {memberSince ? (
          <Text style={styles.memberSince}>Miembro desde {memberSince}</Text>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <StatTile icon="flame" value={String(streak)} label="Racha (días)" highlight={streak > 0} />
        <StatTile icon="barbell" value={String(totalWorkouts)} label="Entrenos" />
        <StatTile icon="calendar" value={String(weeks)} label="Semanas activo" />
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Logros</Text>
        <Text style={styles.sectionSub}>
          {unlockedCount} de {achievements.length} desbloqueados
        </Text>
        <View style={styles.badgeGrid}>
          {achievements.map((a) => (
            <View key={a.id} style={styles.badge}>
              <View
                style={[styles.badgeIcon, a.unlocked ? styles.badgeIconOn : styles.badgeIconOff]}
              >
                <Ionicons
                  name={a.icon as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={a.unlocked ? colors.primary : colors.textFaint}
                />
              </View>
              <Text style={[styles.badgeTitle, !a.unlocked && styles.badgeTitleOff]}>
                {a.title}
              </Text>
              <Text style={styles.badgeDesc}>{a.description}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Sobre mí</Text>
        <TextField
          label="Objetivo principal"
          value={goal}
          onChangeText={setGoal}
          placeholder="Ej. Conseguir mi primera dominada"
        />
        <TextField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Cuéntale a tu entrenador sobre ti..."
          multiline
          numberOfLines={3}
          style={styles.textarea}
        />
        <TextField
          label="Peso objetivo (kg)"
          value={targetWeight}
          onChangeText={setTargetWeight}
          placeholder="Ej. 72"
          keyboardType="numeric"
        />

        <Text style={styles.fieldLabel}>Nivel de experiencia</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {EXPERIENCE_LEVELS.map((lvl) => (
            <Pressable
              key={lvl}
              onPress={() => setLevel(lvl)}
              style={[styles.chip, level === lvl && styles.chipSelected]}
            >
              <Text style={[styles.chipText, level === lvl && styles.chipTextSelected]}>{lvl}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {saved ? <Text style={styles.savedText}>Cambios guardados</Text> : null}
        <Button title="Guardar cambios" onPress={handleSave} loading={saving} />
      </Card>

      <Card style={styles.section}>
        <View style={styles.reminderHeader}>
          <Ionicons name="alarm-outline" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Recordatorio de entreno</Text>
        </View>
        <Text style={styles.reminderHint}>
          Elige una hora y te avisaremos cada día para entrenar.
          {Platform.OS === 'web' ? ' (Disponible en la app de móvil.)' : ''}
        </Text>
        <View style={styles.timeRow}>
          {REMINDER_TIMES.map((h) => (
            <Pressable
              key={h}
              onPress={() => handleToggleReminder(h)}
              style={[styles.timeChip, reminderHour === h && styles.timeChipActive]}
            >
              <Text style={[styles.timeText, reminderHour === h && styles.timeTextActive]}>
                {String(h).padStart(2, '0')}:00
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Button title="Cerrar sesión" variant="danger" onPress={signOut} style={styles.signOut} />
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
  levelBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  levelBadgeText: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  memberSince: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text },
  sectionSub: { ...typography.small, color: colors.textMuted, marginBottom: spacing.md },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: '30%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  badgeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 1,
  },
  badgeIconOn: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  badgeIconOff: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  badgeTitle: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
  badgeTitleOff: { color: colors.textFaint },
  badgeDesc: { ...typography.small, color: colors.textFaint, textAlign: 'center', fontSize: 11 },
  textarea: { height: 78, textAlignVertical: 'top' },
  fieldLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  chips: { marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  chipTextSelected: { color: colors.onPrimary },
  savedText: { ...typography.small, color: colors.primary, marginBottom: spacing.sm },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reminderHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  timeTextActive: { color: colors.onPrimary },
  signOut: { marginTop: spacing.sm, marginBottom: spacing.xl },
});
