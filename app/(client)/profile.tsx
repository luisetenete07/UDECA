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
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatTile } from '../../components/StatTile';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { MARCA_POR_DEFECTO } from '../../lib/marcaPropia';
import { updateUserProfile } from '../../lib/firestore/users';
import { SelectorDeIdioma } from '../../components/SelectorDeIdioma';
import { getRutinaDiaria } from '../../lib/firestore/rutinaDiaria';
import { hayRutinaDiaria } from '../../lib/rutinaDiaria';
import { pickAvatar } from '../../lib/image';
import {
  cancelarAvisosGtg,
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
  const { profile, signOut, refreshProfile, marca, logo } = useAuth();
  const router = useRouter();
  // Esta pantalla la comparten el alumno de un coach y el atleta autoentrenado.
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
  // Los avisos de la rutina de cada día: encendidos salvo que se apaguen, y el
  // interruptor solo sale a quien tiene una (no se apaga lo que no existe).
  const [gtgOn, setGtgOn] = useState(profile?.dailyRoutineRemindersEnabled !== false);
  const [tieneRutinaDiaria, setTieneRutinaDiaria] = useState(false);
  const toggleGtg = async () => {
    if (!profile) return;
    const next = !gtgOn;
    setGtgOn(next);
    // Al apagarlos se quitan ya; al encenderlos los pone el inicio la próxima
    // vez que se abra, con lo que quede por hacer ese día.
    if (!next) await cancelarAvisosGtg();
    await updateUserProfile(profile.uid, { dailyRoutineRemindersEnabled: next });
    await refreshProfile();
  };

  // El resumen del domingo: encendido salvo que se apague.
  const [resumenOn, setResumenOn] = useState(profile?.weeklySummaryEnabled !== false);
  const toggleResumen = async () => {
    if (!profile) return;
    const next = !resumenOn;
    setResumenOn(next);
    await updateUserProfile(profile.uid, { weeklySummaryEnabled: next });
    await refreshProfile();
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
    // Ya no lee los entrenos: eran para los logros, que viven en Progreso.
    setLoading(false);
    getRutinaDiaria(profile.uid)
      .then((r) => setTieneRutinaDiaria(hayRutinaDiaria(r)))
      .catch(() => {});
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

      {/* El carné: quién es dentro de CALICO, y su número si es fundador. */}
      <MemberCard />

      <SelectorDeIdioma />

      {/* Aquí había tres cifras enormes —entrenos, racha, semanas— justo
          debajo de la tarjeta... que rota exactamente esas mismas tres. Las
          mismas cifras dos veces y a diez píxeles: la de arriba grande y
          animada, la de abajo repitiéndola. Se queda la tarjeta, que además
          las cuenta solas y no ocupa el doble. */}

      {/* Los logros se han ido a Progreso (components/LogrosDelAlumno.tsx):
          son progreso, y aquí, entre los ajustes, casi no se veían. */}

      {/* Tarjeta de cambio de nombre: solo visible si NO se ha consumido el
          límite de una vez cada 90 días. Al gastarlo, desaparece hasta que
          expire el plazo. */}
      {/* Plegado: se cambia una vez cada 90 días, y abierto ocupaba media
          pantalla con un campo, un aviso y un botón apagado. */}
      {canChangeName ? (
        <CollapsibleCard
          id="alumno-nombre"
          icon="create-outline"
          title="Tu nombre"
          hint={profile?.name}
          defaultOpen={false}
        >
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
        </CollapsibleCard>
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

        {tieneRutinaDiaria ? (
          <>
            <View style={[styles.reminderTopRow, styles.reminderSegunda]}>
              <Text style={styles.reminderSubtitulo}>Tu rutina de cada día</Text>
              <Pressable
                onPress={toggleGtg}
                style={[styles.switch, gtgOn && styles.switchOn]}
                hitSlop={6}
              >
                <View style={[styles.switchKnob, gtgOn && styles.switchKnobOn]} />
              </Pressable>
            </View>
            <Text style={styles.reminderHint}>
              Mientras te quede algo por marcar, te aviso a las 10, 13, 16 y 19 h.
              Cuando lo terminas, paran.
            </Text>
          </>
        ) : null}

        {/* El resumen del domingo lo manda el servidor (payments-webhook/api/
            _resumen.js): aquí solo se dice si se quiere. */}
        <View style={[styles.reminderTopRow, styles.reminderSegunda]}>
          <Text style={styles.reminderSubtitulo}>Resumen del domingo</Text>
          <Pressable
            onPress={toggleResumen}
            style={[styles.switch, resumenOn && styles.switchOn]}
            hitSlop={6}
          >
            <View style={[styles.switchKnob, resumenOn && styles.switchKnobOn]} />
          </Pressable>
        </View>
        <Text style={styles.reminderHint}>
          Los domingos, tus entrenos, series y pasos de la semana. Solo si has entrenado.
        </Text>
      </Card>

      {/* Cerrar sesión no borra nada: sin el rojo de lo peligroso, que se
          reserva para eliminar la cuenta. */}
      <Button title="Cerrar sesión" variant="secondary" onPress={signOut} style={styles.signOut} />
      {/* Con la marca de su entrenador, una firma pequeña: la app es suya,
          pero se sabe con qué está hecha. */}
      {marca !== MARCA_POR_DEFECTO || logo ? <Text style={styles.conCalico}>con CALICO</Text> : null}

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
  conCalico: { ...typography.small, color: colors.textFaint, textAlign: 'center', marginTop: spacing.md, fontSize: 11 },
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
  textarea: { height: 78, textAlignVertical: 'top' },
  fieldLabel: fieldLabel,
  savedText: { ...typography.small, color: colors.primary, marginBottom: spacing.sm },
  nameHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  nameHint: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 17 },
  reminderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reminderSegunda: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  reminderSubtitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
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
