import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import {
  createMealLog,
  getActiveNutritionPlanForClient,
  getMealLogsForClient,
} from '../../lib/firestore/nutrition';
import {
  createProgressPhoto,
  deleteProgressPhoto,
  getProgressPhotosForClient,
} from '../../lib/firestore/progressPhotos';
import { getMealBooksForTrainer } from '../../lib/firestore/mealBooks';
import { pickProgressPhoto } from '../../lib/image';
import { fonts, colors, radius, spacing, typography } from '../../lib/theme';
import {
  PHOTO_POSES,
  type MealBook,
  type MealLog,
  type NutritionPlan,
  type PhotoPose,
  type ProgressPhoto,
} from '../../lib/types';

function isToday(timestamp: number) {
  const d = new Date(timestamp);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function NutritionScreen() {
  const { profile } = useAuth();
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [books, setBooks] = useState<MealBook[]>([]);
  const [loading, setLoading] = useState(true);

  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPose, setUploadingPose] = useState<PhotoPose | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [planData, mealData, photoData, bookData] = await Promise.all([
      getActiveNutritionPlanForClient(profile.uid),
      getMealLogsForClient(profile.uid),
      getProgressPhotosForClient(profile.uid),
      profile.trainerId ? getMealBooksForTrainer(profile.trainerId).catch(() => []) : Promise.resolve([]),
    ]);
    setPlan(planData);
    setMeals(mealData);
    setPhotos(photoData);
    setBooks(bookData);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const todayMeals = useMemo(() => meals.filter((m) => isToday(m.date)), [meals]);
  const totals = todayMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  const handleAddMeal = async () => {
    if (!profile || !plan) return;
    const cal = Number(calories) || 0;
    if (!mealName.trim() || cal <= 0) {
      setError('Indica un nombre y las calorías de la comida.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createMealLog({
        trainerId: plan.trainerId,
        clientId: profile.uid,
        date: Date.now(),
        name: mealName.trim(),
        calories: cal,
        proteinG: Number(protein) || 0,
        carbsG: Number(carbs) || 0,
        fatG: Number(fat) || 0,
      });
      setMealName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoto = async (pose: PhotoPose) => {
    if (!profile) return;
    setUploadingPose(pose);
    try {
      const imageURL = await pickProgressPhoto();
      if (imageURL) {
        await createProgressPhoto({
          trainerId: profile.trainerId ?? '',
          clientId: profile.uid,
          pose,
          imageURL,
          date: Date.now(),
        });
        await load();
        showToast('Foto subida');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo subir la foto.';
      if (Platform.OS !== 'web') Alert.alert('Foto de progreso', message);
      else showToast(message);
    } finally {
      setUploadingPose(null);
    }
  };

  const confirmDelete = (message: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      return Promise.resolve(window.confirm(message));
    }
    return new Promise((resolve) => {
      Alert.alert('Borrar', message, [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Borrar', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  };

  const handleDeletePhoto = async (id: string) => {
    if (!(await confirmDelete('¿Borrar esta foto de progreso?'))) return;
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    try {
      await deleteProgressPhoto(id);
      showToast('Foto borrada');
    } catch (e) {
      await load();
      showToast(e instanceof Error ? e.message : 'No se pudo borrar');
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <Text style={styles.title}>Mi nutrición</Text>

      {!plan ? (
        <EmptyState
          icon="restaurant-outline"
          title="Sin plan nutricional"
          subtitle="Tu entrenador todavía no te ha asignado un plan de nutrición."
        />
      ) : (
        <>
          <Card accent style={styles.section}>
            <View style={styles.hoyHeader}>
              <Text style={styles.sectionTitle}>Hoy</Text>
              {plan.name ? <Text style={styles.planName}>{plan.name}</Text> : null}
            </View>

            <View style={styles.calSummary}>
              <Text style={styles.calBig}>{Math.max(0, plan.dailyCalories - totals.calories)}</Text>
              <Text style={styles.calUnit}>
                {totals.calories > plan.dailyCalories ? 'kcal de más' : 'kcal restantes'}
              </Text>
              <Text style={styles.calSub}>
                {totals.calories} / {plan.dailyCalories} kcal consumidas
              </Text>
            </View>

            {/* Macros en rejilla 2x2: nunca se recortan en móvil. */}
            <View style={styles.macroGrid}>
              <MacroTile label="Calorías" consumed={totals.calories} target={plan.dailyCalories} unit="kcal" />
              <MacroTile label="Proteína" consumed={totals.proteinG} target={plan.proteinG} unit="g" />
              <MacroTile label="Carbohidratos" consumed={totals.carbsG} target={plan.carbsG} unit="g" />
              <MacroTile label="Grasas" consumed={totals.fatG} target={plan.fatG} unit="g" />
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Registrar comida</Text>
            <TextField placeholder="Ej. Desayuno" value={mealName} onChangeText={setMealName} />
            <View style={styles.row}>
              <TextField
                placeholder="Kcal"
                keyboardType="numeric"
                value={calories}
                onChangeText={setCalories}
                style={styles.smallField}
              />
              <TextField
                placeholder="Proteína (g)"
                keyboardType="numeric"
                value={protein}
                onChangeText={setProtein}
                style={styles.smallField}
              />
            </View>
            <View style={styles.row}>
              <TextField
                placeholder="Carbos (g)"
                keyboardType="numeric"
                value={carbs}
                onChangeText={setCarbs}
                style={styles.smallField}
              />
              <TextField
                placeholder="Grasas (g)"
                keyboardType="numeric"
                value={fat}
                onChangeText={setFat}
                style={styles.smallField}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Añadir comida" onPress={handleAddMeal} loading={saving} />
          </Card>

          <Card style={styles.section}>
            <View style={styles.hoyHeader}>
              <Text style={styles.sectionTitle}>Comidas de hoy</Text>
              {todayMeals.length > 0 ? (
                <Text style={styles.mealCount}>
                  {todayMeals.length} · {totals.calories} kcal
                </Text>
              ) : null}
            </View>
            {todayMeals.length === 0 ? (
              <Text style={styles.mutedText}>Todavía no has registrado comidas hoy.</Text>
            ) : (
              todayMeals.map((meal) => (
                <View key={meal.id} style={styles.mealRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    <Text style={styles.mealMacros}>
                      P{meal.proteinG} · C{meal.carbsG} · G{meal.fatG}
                    </Text>
                  </View>
                  <Text style={styles.mealKcal}>{meal.calories} kcal</Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}

      {/* Libretas de comida del coach: recetas y platos por foto, dentro de la app. */}
      {books.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Libretas de tu coach</Text>
          <Text style={styles.hint}>Recetas y ejemplos de platos que ha preparado tu entrenador.</Text>
          {books.map((book) => (
            <View key={book.id} style={styles.bookBlock}>
              <Text style={styles.bookTitle}>{book.title}</Text>
              {book.photos.length === 0 ? (
                <Text style={styles.mutedText}>Sin fotos todavía.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {book.photos.map((p) => (
                    <View key={p.id} style={styles.bookPhotoWrap}>
                      <Image source={{ uri: p.imageURL }} style={styles.bookPhoto} resizeMode="cover" />
                      {p.caption ? <Text style={styles.bookCaption}>{p.caption}</Text> : null}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          ))}
        </Card>
      ) : null}

      {/* Fotos de progreso (antes en la pestaña Progreso). */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Fotos de progreso</Text>
        <Text style={styles.hint}>
          Sube fotos de frente, perfil y espalda. Solo tú y tu entrenador las veréis.
        </Text>
        <View style={styles.poseRow}>
          {PHOTO_POSES.map((pose) => (
            <Button
              key={pose.key}
              title={pose.label}
              variant="secondary"
              onPress={() => handleAddPhoto(pose.key)}
              loading={uploadingPose === pose.key}
              style={styles.poseBtn}
            />
          ))}
        </View>
        {photos.length === 0 ? (
          <Text style={styles.mutedText}>Todavía no has subido fotos de progreso.</Text>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((p) => (
              <Pressable
                key={p.id}
                style={styles.photoCard}
                onLongPress={() => handleDeletePhoto(p.id)}
                delayLongPress={350}
              >
                <Image source={{ uri: p.imageURL }} style={styles.photo} resizeMode="cover" />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoPose}>
                    {PHOTO_POSES.find((x) => x.key === p.pose)?.label ?? p.pose}
                  </Text>
                  <Text style={styles.photoDate}>
                    {new Date(p.date).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        {photos.length > 0 ? (
          <Text style={styles.deleteHint}>Mantén pulsada una foto para borrarla.</Text>
        ) : null}
      </Card>
    </ScreenContainer>
  );
}

/** Casilla de macro para la rejilla 2x2, con mini barra de progreso. */
function MacroTile({
  label,
  consumed,
  target,
  unit,
}: {
  label: string;
  consumed: number;
  target: number;
  unit: string;
}) {
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const over = target > 0 && consumed > target;
  return (
    <View style={styles.macroTile}>
      <Text style={styles.macroLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.macroValue}>
        <Text style={[styles.macroConsumed, over && { color: colors.danger }]}>
          {Math.round(consumed)}
        </Text>
        <Text style={styles.macroTarget}>
          {' '}/ {Math.round(target)} {unit}
        </Text>
      </Text>
      <View style={styles.macroTrack}>
        <View
          style={[
            styles.macroFill,
            { width: `${ratio * 100}%`, backgroundColor: over ? colors.danger : colors.primary },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  hint: { ...typography.small, color: colors.textFaint, marginBottom: spacing.sm, lineHeight: 18 },
  hoyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  planName: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  calSummary: { alignItems: 'center', marginBottom: spacing.md },
  calBig: { ...typography.h1, color: colors.primaryBright, fontFamily: fonts.heading, fontSize: 44, lineHeight: 48 },
  calUnit: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  calSub: { ...typography.small, color: colors.textFaint, marginTop: 4 },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  macroTile: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 130,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  macroLabel: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  macroValue: { marginTop: 2, marginBottom: spacing.xs },
  macroConsumed: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  macroTarget: { ...typography.small, color: colors.textFaint },
  macroTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  macroFill: { height: '100%', borderRadius: radius.full },
  row: { flexDirection: 'row', gap: spacing.sm },
  smallField: { flex: 1 },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  mutedText: { ...typography.small, color: colors.textFaint },
  mealCount: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mealName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  mealMacros: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  mealKcal: { ...typography.body, color: colors.primary, fontFamily: fonts.semiBold },
  bookBlock: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  bookTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, marginBottom: spacing.sm },
  bookPhotoWrap: { marginRight: spacing.sm, width: 130 },
  bookPhoto: { width: 130, height: 165, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  bookCaption: { ...typography.small, color: colors.textMuted, marginTop: 4, fontSize: 11 },
  poseRow: { flexDirection: 'row', gap: spacing.sm },
  poseBtn: { flex: 1, paddingHorizontal: spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  photoCard: { width: '31%' },
  photo: { width: '100%', aspectRatio: 0.8, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  photoInfo: { marginTop: 4 },
  photoPose: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, fontSize: 11 },
  photoDate: { ...typography.small, color: colors.textFaint, fontSize: 10 },
  deleteHint: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm, textAlign: 'center' },
});
