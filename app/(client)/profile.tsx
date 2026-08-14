import React, { useCallback, useEffect, useState } from 'react';
import { frase } from '../../lib/idioma';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LoadingScreen } from '../../components/LoadingScreen';
import { CollapsibleCard } from '../../components/CollapsibleCard';
import { MemberCard } from '../../components/MemberCard';
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
  cancelWorkoutReminder,
} from '../../lib/notifications';
import {
  MAX_OBJETIVO,
  objetivosDe,
  objetivosParaGuardar,
  PLAZOS,
  type Objetivos,
} from '../../lib/objetivos';
import {
  computeAchievements,
  type Achievement,
} from '../../lib/stats';
import { Chip, ChipRow } from '../../components/Chip';
import { colors, fieldLabel, fonts, radius, spacing, tabularNums, typography } from '../../lib/theme';
import { EXPERIENCE_LEVELS, type ExperienceLevel } from '../../lib/types';

const two = (n: number) => String(n).padStart(2, '0');
/**
 * A qué hora empiezan los avisos de "se te ha olvidado".
 *
 * Antes salía del reloj del recordatorio diario, que ya no existe. Se respeta
 * la hora que cada uno tuviera puesta —quien la eligió en su día la sigue
 * teniendo— y para el resto, las seis de la tarde: ni tan pronto que avise a
 * quien entrena por la mañana antes de entrenar, ni tan tarde que solo sirva
 * para dar la noche.
 */
const HORA_POR_DEFECTO = 18;

export default function ClientProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  // Esta pantalla la comparten el alumno de un coach y el atleta autoentrenado.
  const isAthlete = profile?.role === 'athlete';
  const [name, setName] = useState(profile?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  // Los tres objetivos (ver lib/objetivos.ts). El antiguo, si lo había, entra
  // ya colocado en el de corto plazo.
  const [objetivos, setObjetivos] = useState<Objetivos>(() => objetivosDe(profile));
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [level, setLevel] = useState<ExperienceLevel | undefined>(profile?.level);
  const [targetWeight, setTargetWeight] = useState(
    profile?.targetWeightKg ? String(profile.targetWeightKg) : ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const reminderHour = profile?.reminderHour ?? HORA_POR_DEFECTO;
  const reminderMinute = profile?.reminderMinute ?? 0;

  const [missedOn, setMissedOn] = useState(Boolean(profile?.missedWorkoutRemindersEnabled));

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


  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  // El aviso diario a hora fija se ha quitado del producto. Quien lo tuviera
  // programado en su móvil seguiría oyéndolo cada día sin ningún interruptor
  // en la app para callarlo, así que se cancela al abrir el perfil.
  useEffect(() => {
    if (!profile?.reminderEnabled) return;
    (async () => {
      await cancelWorkoutReminder().catch(() => {});
      await updateUserProfile(profile.uid, { reminderEnabled: false }).catch(() => {});
    })();
  }, [profile?.reminderEnabled, profile?.uid]);

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
        ...objetivosParaGuardar(objetivos),
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
        hint={frase`${unlockedCount} de ${achievements.length}`}
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
        {/* Tres líneas, no tres párrafos: cada plazo cabe de un vistazo y se
            ve de golpe si el de largo tiene algo que ver con el de esta
            semana. */}
        <Text style={styles.fieldLabel}>Mis objetivos</Text>
        {PLAZOS.map((p) => (
          <TextField
            key={p.clave}
            label={p.etiqueta}
            value={objetivos[p.clave]}
            onChangeText={(v) =>
              setObjetivos((prev) => ({ ...prev, [p.clave]: v.slice(0, MAX_OBJETIVO) }))
            }
            placeholder={p.ejemplo}
            maxLength={MAX_OBJETIVO}
          />
        ))}
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

      {/* El único aviso que queda. El "recordatorio de entreno" a una hora
          fija se ha ido: avisaba todos los días a la misma hora entrenara uno
          o no, y quien ya había entrenado a las siete recibía a las siete y
          media un aviso para hacer lo que acababa de hacer. Este solo suena
          los días que TOCA entrenar y aún no hay sesión, y calla en cuanto la
          hay. */}
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
  signOut: { marginTop: spacing.sm, marginBottom: spacing.xl },
});
