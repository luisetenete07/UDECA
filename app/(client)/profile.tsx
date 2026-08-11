import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LoadingScreen } from '../../components/LoadingScreen';
import { CollapsibleCard } from '../../components/CollapsibleCard';
import { MemberCard } from '../../components/MemberCard';
import { PausaPlanSheet } from '../../components/PausaPlanSheet';
import { RateApp } from '../../components/RateApp';
import { UpgradeCard } from '../../components/UpgradeCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatTile } from '../../components/StatTile';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { updateUserProfile } from '../../lib/firestore/users';
import { SelectorDeIdioma } from '../../components/SelectorDeIdioma';
import { getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { pickAvatar } from '../../lib/image';
import {
  cancelarAvisosOlvido,
  cancelCheckinReminder,
  cancelWorkoutReminder,
  scheduleCheckinReminder,
  scheduleWorkoutReminder,
} from '../../lib/notifications';
import { diaLargo } from '../../lib/fechas';
import { pausaActiva, type PausaPlan } from '../../lib/pausa';
import {
  computeAchievements,
  type Achievement,
} from '../../lib/stats';
import { Chip, ChipRow } from '../../components/Chip';
import { colors, fieldLabel, fonts, radius, spacing, tabularNums, typography } from '../../lib/theme';
import { EXPERIENCE_LEVELS, type ExperienceLevel } from '../../lib/types';

const REMINDER_PRESETS = [
  { h: 7, m: 0 },
  { h: 9, m: 0 },
  { h: 18, m: 0 },
  { h: 20, m: 30 },
];
const clampHour = (h: number) => ((h % 24) + 24) % 24;
const clampMin = (m: number) => ((m % 60) + 60) % 60;
const two = (n: number) => String(n).padStart(2, '0');

export default function ClientProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  // Esta pantalla la comparten el alumno de un coach y el atleta autoentrenado.
  const isAthlete = profile?.role === 'athlete';
  const [name, setName] = useState(profile?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [goal, setGoal] = useState(profile?.goal ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [level, setLevel] = useState<ExperienceLevel | undefined>(profile?.level);
  const [targetWeight, setTargetWeight] = useState(
    profile?.targetWeightKg ? String(profile.targetWeightKg) : ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [reminderOn, setReminderOn] = useState(Boolean(profile?.reminderEnabled));
  const [reminderHour, setReminderHour] = useState(profile?.reminderHour ?? 18);
  const [reminderMinute, setReminderMinute] = useState(profile?.reminderMinute ?? 0);
  const [checkinOn, setCheckinOn] = useState(Boolean(profile?.checkinReminderEnabled));

  const [missedOn, setMissedOn] = useState(Boolean(profile?.missedWorkoutRemindersEnabled));

  const [pausaAbierta, setPausaAbierta] = useState(false);
  const [guardandoPausa, setGuardandoPausa] = useState(false);
  const enPausa = pausaActiva(profile?.planPauses);

  /**
   * El alumno se pausa el plan él mismo.
   *
   * No hace falta pedir permiso al entrenador: el que sabe que está malo o que
   * se va de viaje es él, y la alternativa —callarse y fallar días— es peor
   * para los dos. El coach lo ve en la ficha, y al terminarse la pausa quedan
   * los días guardados por si quiere hablarlo.
   */
  const guardarPausa = async (pausas: PausaPlan[]) => {
    if (!profile) return;
    setGuardandoPausa(true);
    try {
      await updateUserProfile(profile.uid, { planPauses: pausas });
      await refreshProfile();
      // Los avisos de olvido hablan de días que ahora pueden estar en pausa.
      // Se vuelven a poner enteros al abrir el panel, ya sin esos días.
      await cancelarAvisosOlvido();
      setPausaAbierta(false);
    } catch {
      showToast('No se ha podido guardar la pausa');
    } finally {
      setGuardandoPausa(false);
    }
  };

  /**
   * Insistir cada hora es mucho ruido, así que se pide expresamente y se puede
   * apagar de un toque. Al apagarlo se quitan los que ya estaban puestos: si
   * no, el alumno seguiría recibiendo avisos que acaba de desactivar y
   * pensaría —con razón— que el interruptor no hace nada.
   */
  const toggleMissedReminders = async () => {
    if (!profile) return;
    const next = !missedOn;
    setMissedOn(next);
    if (!next) await cancelarAvisosOlvido();
    await updateUserProfile(profile.uid, { missedWorkoutRemindersEnabled: next });
    await refreshProfile();
  };

  const toggleCheckinReminder = async () => {
    if (!profile) return;
    const next = !checkinOn;
    setCheckinOn(next);
    if (next) {
      const ok = await scheduleCheckinReminder();
      await updateUserProfile(profile.uid, {
        checkinReminderEnabled: Platform.OS === 'web' ? true : ok,
      });
    } else {
      await cancelCheckinReminder();
      await updateUserProfile(profile.uid, { checkinReminderEnabled: false });
    }
  };

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const [workoutLogs, weightLogs] = await Promise.all([
      getWorkoutLogsForClient(profile.uid),
      getWeightLogsForClient(profile.uid),
    ]);
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

  const handleSaveName = async () => {
    if (!profile) return;
    const clean = name.trim();
    if (!clean || clean === profile.name) return;
    setSavingName(true);
    try {
      await updateUserProfile(profile.uid, { name: clean, nameChangedAt: Date.now() });
      await refreshProfile();
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } finally {
      setSavingName(false);
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

  // Aplica el recordatorio: programa (o cancela) el aviso diario y guarda la
  // preferencia. Se llama al activar/desactivar o al cambiar la hora.
  const applyReminder = async (on: boolean, hour: number, minute: number) => {
    if (!profile) return;
    if (!on) {
      await cancelWorkoutReminder();
      await updateUserProfile(profile.uid, { reminderEnabled: false });
      return;
    }
    const ok = await scheduleWorkoutReminder(hour, minute);
    // En web la programación local no está soportada; guardamos la preferencia
    // igualmente para que quede reflejada y funcione en la app de móvil.
    await updateUserProfile(profile.uid, {
      reminderEnabled: Platform.OS === 'web' ? true : ok,
      reminderHour: hour,
      reminderMinute: minute,
    });
  };

  const toggleReminder = async () => {
    const next = !reminderOn;
    setReminderOn(next);
    await applyReminder(next, reminderHour, reminderMinute);
  };

  const changeHour = async (delta: number) => {
    const h = clampHour(reminderHour + delta);
    setReminderHour(h);
    if (reminderOn) await applyReminder(true, h, reminderMinute);
  };

  const changeMinute = async (delta: number) => {
    const m = clampMin(reminderMinute + delta);
    setReminderMinute(m);
    if (reminderOn) await applyReminder(true, reminderHour, m);
  };

  const setPreset = async (h: number, m: number) => {
    setReminderHour(h);
    setReminderMinute(m);
    setReminderOn(true);
    await applyReminder(true, h, m);
  };

  if (loading) return <LoadingScreen />;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  // Nombre: se puede cambiar como máximo una vez cada 90 días.
  const NAME_COOLDOWN = 90 * 24 * 60 * 60 * 1000;
  const msSinceNameChange = Date.now() - (profile?.nameChangedAt ?? 0);
  const canChangeName = !profile?.nameChangedAt || msSinceNameChange >= NAME_COOLDOWN;
  const nameChanged = name.trim() !== '' && name.trim() !== profile?.name;

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
        {/* El nombre no se repite aquí: va impreso dentro de la tarjeta, justo
            debajo. Estaba escrito dos veces en la misma pantalla, con la
            segunda a un dedo de la primera. "Miembro desde" lo mismo. Queda el
            correo —en qué cuenta estoy— y el nivel, que la tarjeta no dice. */}
        <Text style={styles.email}>{profile?.email}</Text>
        {profile?.level ? (
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>{profile.level}</Text>
          </View>
        ) : null}
      </View>

      {/* El carné: quién es dentro de UDECA, y su número si es fundador. */}
      <MemberCard />

      <SelectorDeIdioma />

      {/* Aquí había tres cifras enormes —entrenos, racha, semanas— justo
          debajo de la tarjeta... que rota exactamente esas mismas tres. Las
          mismas cifras dos veces y a diez píxeles: la de arriba grande y
          animada, la de abajo repitiéndola. Se queda la tarjeta, que además
          las cuenta solas y no ocupa el doble. */}

      {/* Trece logros en una parrilla ocupaban casi una pantalla entera, y once
          de ellos son los mismos para todo el mundo desde el primer día. Lo
          que de verdad se viene a mirar —cuántos llevas— se lee plegado. */}
      <CollapsibleCard
        id="alumno-logros"
        icon="ribbon-outline"
        title="Logros"
        hint={`${unlockedCount} de ${achievements.length}`}
        defaultOpen={false}
      >
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
      </CollapsibleCard>

      {/* Tarjeta de cambio de nombre: solo visible si NO se ha consumido el
          límite de una vez cada 90 días. Al gastarlo, desaparece hasta que
          expire el plazo. */}
      {canChangeName ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Tu nombre</Text>
          <TextField
            label="Nombre"
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
          />
          <View style={styles.nameHintRow}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.nameHint}>
              Solo puedes cambiar tu nombre una vez cada 90 días.
            </Text>
          </View>
          {nameSaved ? <Text style={styles.savedText}>Nombre actualizado</Text> : null}
          <Button
            title="Cambiar nombre"
            variant="secondary"
            onPress={handleSaveName}
            loading={savingName}
            disabled={!nameChanged}
          />
        </Card>
      ) : null}

      <CollapsibleCard
        id="alumno-sobre-mi"
        icon="person-outline"
        title="Sobre mí"
        hint={profile?.level ?? undefined}
        defaultOpen={false}
      >
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
        <ChipRow scroll>
          {EXPERIENCE_LEVELS.map((lvl) => (
            <Chip key={lvl} texto={lvl} activo={level === lvl} onPress={() => setLevel(lvl)} />
          ))}
        </ChipRow>

        {saved ? <Text style={styles.savedText}>Cambios guardados</Text> : null}
        <Button title="Guardar cambios" onPress={handleSave} loading={saving} />
      </CollapsibleCard>

      {/* Pausar el plan: unos días sin entrenar que no rompen la racha ni
          descolocan el ciclo. Va antes de los recordatorios porque cuando hace
          falta, hace falta ya. */}
      <Card style={styles.section}>
        <View style={styles.reminderTopRow}>
          <View style={styles.reminderHeader}>
            <Ionicons name="pause-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Pausar el plan</Text>
          </View>
          <Pressable onPress={() => setPausaAbierta(true)} hitSlop={6}>
            <Text style={styles.pausaAccion}>{enPausa ? 'Ver' : 'Elegir días'}</Text>
          </Pressable>
        </View>
        <Text style={styles.reminderHint}>
          {enPausa
            ? `En pausa hasta el ${diaLargo(enPausa.hasta)}${
                enPausa.porQuien === 'coach' ? ', puesta por tu entrenador' : ''
              }. Estos días no rompen tu racha y el plan te espera donde lo dejaste.`
            : 'Si te lesionas, te vas de viaje o tienes una semana imposible: marca los días y el plan se congela. Al volver sigue justo donde lo dejaste.'}
        </Text>
      </Card>

      <PausaPlanSheet
        visible={pausaAbierta}
        onClose={() => setPausaAbierta(false)}
        pausas={profile?.planPauses}
        activa={enPausa}
        porQuien="alumno"
        guardando={guardandoPausa}
        onGuardar={guardarPausa}
      />

      <Card style={styles.section}>
        <View style={styles.reminderTopRow}>
          <View style={styles.reminderHeader}>
            <Ionicons name="alarm-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Recordatorio de entreno</Text>
          </View>
          <Pressable
            onPress={toggleReminder}
            style={[styles.switch, reminderOn && styles.switchOn]}
            hitSlop={6}
          >
            <View style={[styles.switchKnob, reminderOn && styles.switchKnobOn]} />
          </Pressable>
        </View>
        <Text style={styles.reminderHint}>
          {reminderOn
            ? `Te avisaremos cada día a las ${two(reminderHour)}:${two(reminderMinute)}.`
            : 'Actívalo y elige la hora que quieras para tu aviso diario.'}
          {Platform.OS === 'web' ? ' (Los avisos suenan en la app de móvil.)' : ''}
        </Text>

        {reminderOn ? (
          <>
            <View style={styles.clockRow}>
              <View style={styles.clockGroup}>
                <Pressable onPress={() => changeHour(1)} style={styles.clockBtn} hitSlop={6}>
                  <Ionicons name="chevron-up" size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.clockValue}>{two(reminderHour)}</Text>
                <Pressable onPress={() => changeHour(-1)} style={styles.clockBtn} hitSlop={6}>
                  <Ionicons name="chevron-down" size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.clockUnit}>hora</Text>
              </View>
              <Text style={styles.clockColon}>:</Text>
              <View style={styles.clockGroup}>
                <Pressable onPress={() => changeMinute(5)} style={styles.clockBtn} hitSlop={6}>
                  <Ionicons name="chevron-up" size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.clockValue}>{two(reminderMinute)}</Text>
                <Pressable onPress={() => changeMinute(-5)} style={styles.clockBtn} hitSlop={6}>
                  <Ionicons name="chevron-down" size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.clockUnit}>min</Text>
              </View>
            </View>

            <Text style={styles.presetLabel}>Atajos</Text>
            <ChipRow>
              {REMINDER_PRESETS.map((p) => (
                <Chip
                  key={`${p.h}:${p.m}`}
                  texto={`${two(p.h)}:${two(p.m)}`}
                  activo={reminderHour === p.h && reminderMinute === p.m}
                  onPress={() => setPreset(p.h, p.m)}
                />
              ))}
            </ChipRow>
          </>
        ) : null}
      </Card>

      {/* Va justo debajo del recordatorio diario porque depende de él: el
          primer aviso sale a esa misma hora. */}
      <Card style={styles.section}>
        <View style={styles.reminderTopRow}>
          <View style={styles.reminderHeader}>
            <Ionicons name="alarm-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Insistir si se me olvida</Text>
          </View>
          <Pressable
            onPress={toggleMissedReminders}
            style={[styles.switch, missedOn && styles.switchOn]}
            hitSlop={6}
          >
            <View style={[styles.switchKnob, missedOn && styles.switchKnobOn]} />
          </Pressable>
        </View>
        <Text style={styles.reminderHint}>
          Los días que te toca entrenar y no has registrado la sesión, te aviso
          cada hora desde las {two(reminderHour)}:{two(reminderMinute)} hasta las
          22:00. En cuanto la registres, paran.
          {Platform.OS === 'web' ? ' (Suena en la app de móvil.)' : ''}
        </Text>
      </Card>

      <Card style={styles.section}>
        <View style={styles.reminderTopRow}>
          <View style={styles.reminderHeader}>
            <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Recordatorio de check-in</Text>
          </View>
          <Pressable
            onPress={toggleCheckinReminder}
            style={[styles.switch, checkinOn && styles.switchOn]}
            hitSlop={6}
          >
            <View style={[styles.switchKnob, checkinOn && styles.switchKnobOn]} />
          </Pressable>
        </View>
        <Text style={styles.reminderHint}>
          Aviso los domingos por la tarde para enviar tu check-in semanal.
          {Platform.OS === 'web' ? ' (Suena en la app de móvil.)' : ''}
        </Text>
      </Card>

      {/* El plan completo, hasta que den el paso (solo atleta, ver canUpgrade). */}
      <UpgradeCard />

      {/* Valorar la app: solo al atleta. El alumno de un coach no elige la
          herramienta —se la pone su entrenador—, así que pedirle a él la
          valoración es pedirla a quien no ha decidido nada. */}
      {isAthlete ? <RateApp /> : null}

      <Button title="Cerrar sesión" variant="danger" onPress={signOut} style={styles.signOut} />

      {/* Eliminar la cuenta: discreto, pero SIEMPRE presente. Las tiendas
          exigen que se pueda hacer desde dentro de la app, y el proceso en sí
          (cinco pasos) es el que evita los borrados por impulso. */}
      <Pressable onPress={() => router.push('/account-deletion')} style={styles.borrarCuenta}>
        <Text style={styles.borrarCuentaTexto}>Eliminar mi cuenta</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  borrarCuenta: { alignSelf: 'center', paddingVertical: spacing.lg },
  borrarCuentaTexto: { ...typography.small, color: colors.textFaint, textDecorationLine: 'underline' },
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
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text },
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
  fieldLabel: fieldLabel,
  savedText: { ...typography.small, color: colors.primary, marginBottom: spacing.sm },
  nameHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  nameHint: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 17 },
  reminderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reminderHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  pausaAccion: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textMuted,
    alignSelf: 'flex-start',
  },
  switchKnobOn: { backgroundColor: colors.onPrimary, alignSelf: 'flex-end' },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  clockGroup: { alignItems: 'center' },
  clockBtn: {
    width: 44,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockValue: {
    ...typography.h1,
    color: colors.text,
    fontFamily: fonts.heading,
    marginVertical: 6,
    minWidth: 52,
    textAlign: 'center',
  },
  clockUnit: { ...typography.small, color: colors.textFaint, fontSize: 11, marginTop: 2 },
  clockColon: { ...typography.h1, color: colors.textMuted, marginBottom: 18 },
  presetLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  signOut: { marginTop: spacing.sm, marginBottom: spacing.xl },
});
