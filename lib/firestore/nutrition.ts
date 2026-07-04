import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { MealLog, NutritionPlan } from '../types';

const plansRef = () => collection(db, 'nutritionPlans');
const mealsRef = () => collection(db, 'mealLogs');

export async function getNutritionPlansForClient(clientId: string): Promise<NutritionPlan[]> {
  const q = query(plansRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as NutritionPlan)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getActiveNutritionPlanForClient(
  clientId: string
): Promise<NutritionPlan | null> {
  const plans = await getNutritionPlansForClient(clientId);
  return plans.find((p) => p.active) ?? null;
}

export async function createNutritionPlan(
  data: Omit<NutritionPlan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(plansRef(), { ...data, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function updateNutritionPlan(id: string, data: Partial<NutritionPlan>) {
  await updateDoc(doc(db, 'nutritionPlans', id), { ...data, updatedAt: Date.now() });
}

/** Marca este plan como activo y desactiva los demás planes del cliente. */
export async function setActiveNutritionPlan(clientId: string, planId: string) {
  const plans = await getNutritionPlansForClient(clientId);
  await Promise.all(
    plans.map((p) => updateDoc(doc(db, 'nutritionPlans', p.id), { active: p.id === planId }))
  );
}

export async function getMealLogsForClient(clientId: string): Promise<MealLog[]> {
  const q = query(mealsRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as MealLog)
    .sort((a, b) => b.date - a.date);
}

export async function createMealLog(data: Omit<MealLog, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(mealsRef(), { ...data, createdAt: Date.now() });
  return ref.id;
}
