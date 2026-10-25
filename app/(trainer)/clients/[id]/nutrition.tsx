import React, { useEffect, useState } from 'react';
import { frase } from '../../../../lib/idioma';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../../../components/Texto';
import { Button } from '../../../../components/Button';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { MacroSum } from '../../../../components/MacroSum';
import { Opciones } from '../../../../components/Opciones';
import { ScreenHeader } from '../../../../components/ScreenHeader';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { Segmented } from '../../../../components/Segmented';
import { TextField } from '../../../../components/TextField';
import { useAuth } from '../../../../lib/auth-context';
import { diaMes } from '../../../../lib/fechas';
import {
  createNutritionPlan,
  getActiveNutritionPlanForClient,
  setActiveNutritionPlan,
  updateNutritionPlan,
} from '../../../../lib/firestore/nutrition';
import { getUserProfile } from '../../../../lib/firestore/users';
import { getWeightLogsForClient } from '../../../../lib/firestore/weightLogs';
import {
  CARBOS_POR_OBJETIVO,
  OBJETIVOS,
  POR_DEFECTO,
  calcularPorKg,
  leerRango,
  pesoValido,
  textoDeGramos,
  textoDeRango,
  type MacrosPorKg,
  type ObjetivoNutricional,
} from '../../../../lib/macrosPorKg';
import { notifyUser } from '../../../../lib/notifications';
import { colors, fonts, radius, spacing, typography } from '../../../../lib/theme';

type Modo = 'kg' | 'gramos';

/*
 * EL PLAN NUTRICIONAL DE UN ALUMNO.
 *
 * Dos formas de ponerlo, y la de por defecto es la que usan los entrenadores:
 *
 *  - Por kg de peso: proteína, grasas y creatina en g/kg (un valor o un rango)
 *    y los carbohidratos según el objetivo. Los gramos y las calorías salen
 *    solos con el peso del alumno (lib/macrosPorKg.ts).
 *  - En gramos: las cifras a mano, como antes.
 */
export default function NutritionEditorScreen() {
  const { id: clientId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [eraPorKg, setEraPorKg] = useState(false);
  const [modo, setModo] = useState<Modo>('kg');
  const [name, setName] = useState('Plan nutricional');
  const [notes, setNotes] = useState('');
  const [clientName, setClientName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // En gramos.
  const [calories, setCalories] = useState('2000');
  const [protein, setProtein] = useState('150');
  const [carbs, setCarbs] = useState('200');
  const [fat, setFat] = useState('60');

  // Por kg: lo que se escribe, tal cual ("1,6-2,2").
  const [peso, setPeso] = useState('');
  const [ultimoPeso, setUltimoPeso] = useState<{ kg: number; date: number } | null>(null);
  const [objetivo, setObjetivo] = useState<ObjetivoNutricional>(POR_DEFECTO.objetivo);
  const [proteinaKg, setProteinaKg] = useState(textoDeRango(POR_DEFECTO.proteina));
  const [grasasKg, setGrasasKg] = useState(textoDeRango(POR_DEFECTO.grasas));
  const [carbosKg, setCarbosKg] = useState(textoDeRango(POR_DEFECTO.carbos));
  const [creatinaKg, setCreatinaKg] = useState(textoDeRango(POR_DEFECTO.creatina));

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const [existing, clientProfile, pesos] = await Promise.all([
        getActiveNutritionPlanForClient(clientId, profile?.uid),
        getUserProfile(clientId).catch(() => null),
        getWeightLogsForClient(clientId, profile?.uid).catch(() => []),
      ]);
      setClientName(clientProfile?.name ?? '');
      // El peso con el que calcular: el último que ha apuntado el alumno.
      const ultimo = pesos[pesos.length - 1];
      if (ultimo) {
        setUltimoPeso({ kg: ultimo.weightKg, date: ultimo.date });
        setPeso(String(ultimo.weightKg).replace('.', ','));
      }
      if (existing) {
        setPlanId(existing.id);
        setName(existing.name);
        setNotes(existing.notes ?? '');
        setCalories(String(existing.dailyCalories));
        setProtein(String(existing.proteinG));
        setCarbs(String(existing.carbsG));
        setFat(String(existing.fatG));
        if (existing.porKg) {
          const m = existing.porKg;
          setEraPorKg(true);
          setModo('kg');
          setObjetivo(m.objetivo);
          setProteinaKg(textoDeRango(m.proteina));
          setGrasasKg(textoDeRango(m.grasas));
          setCarbosKg(textoDeRango(m.carbos));
          setCreatinaKg(textoDeRango(m.creatina));
          // Sin un peso más nuevo apuntado, el de cuando se hizo el plan.
          if (!ultimo) setPeso(String(m.pesoKg).replace('.', ','));
        } else {
          // Un plan que ya estaba en gramos se abre en gramos: no se le
          // cambia la forma a lo que el entrenador escribió.
          setModo('gramos');
        }
      } else {
        // Sin plan del coach: se precarga lo que el alumno calculó en la
        // bienvenida, para verlo (y ajustarlo si hace falta).
        const t = clientProfile?.nutritionTargets;
        if (t) {
          setCalories(String(t.dailyCalories));
          setProtein(String(t.proteinG));
          setCarbs(String(t.carbsG));
          setFat(String(t.fatG));
        }
      }
      setLoading(false);
    })();
  }, [clientId]);

  const pesoKg = Number(peso.replace(',', '.'));
  const rangos = {
    proteina: leerRango(proteinaKg),
    grasas: leerRango(grasasKg),
    carbos: leerRango(carbosKg),
    // Vacía, sin creatina; escrita mal, error.
    creatina: creatinaKg.trim() ? leerRango(creatinaKg) : undefined,
  };
  const porKg: MacrosPorKg | null =
    pesoValido(pesoKg) && rangos.proteina && rangos.grasas && rangos.carbos && rangos.creatina !== null
      ? {
          pesoKg,
          objetivo,
          proteina: rangos.proteina,
          grasas: rangos.grasas,
          carbos: rangos.carbos,
          ...(rangos.creatina ? { creatina: rangos.creatina } : {}),
        }
      : null;
  const calculo = porKg ? calcularPorKg(porKg) : null;

  const elegirObjetivo = (o: ObjetivoNutricional | undefined) => {
    if (!o) return;
    setObjetivo(o);
    // Los carbohidratos van con el objetivo: se proponen los suyos.
    setCarbosKg(textoDeRango(CARBOS_POR_OBJETIVO[o]));
  };

  const handleSave = async () => {
    if (!profile || !clientId) return;
    let data;
    if (modo === 'kg') {
      if (!pesoValido(pesoKg)) {
        setError('Indica el peso del alumno en kg.');
        return;
      }
      if (!porKg || !calculo) {
        setError('Revisa los g/kg: un número (1,8) o un rango (1,6-2,2).');
        return;
      }
      data = {
        name: name.trim() || 'Plan nutricional',
        dailyCalories: calculo.dailyCalories,
        proteinG: calculo.proteinG,
        carbsG: calculo.carbsG,
        fatG: calculo.fatG,
        porKg,
        ...(calculo.creatinaG !== undefined ? { creatinaG: calculo.creatinaG } : {}),
        notes: notes.trim() || undefined,
      };
    } else {
      const dailyCalories = Number(calories);
      if (!dailyCalories) {
        setError('Indica las calorías diarias objetivo.');
        return;
      }
      data = {
        name: name.trim() || 'Plan nutricional',
        dailyCalories,
        proteinG: Number(protein) || 0,
        carbsG: Number(carbs) || 0,
        fatG: Number(fat) || 0,
        notes: notes.trim() || undefined,
      };
    }
    setError(null);
    setSaving(true);
    try {
      if (planId) {
        // Lo que ya no vale se borra: si pasa a gramos, lo de por kilo; si se
        // quita la creatina, la creatina. El alumno no puede ver un criterio
        // que el entrenador ya ha cambiado.
        await updateNutritionPlan(
          planId,
          data,
          modo === 'gramos' ? (eraPorKg ? ['porKg', 'creatinaG'] : []) : 'creatinaG' in data ? [] : ['creatinaG']
        );
        await setActiveNutritionPlan(clientId, planId, profile.uid);
      } else {
        const newId = await createNutritionPlan({
          trainerId: profile.uid,
          clientId,
          active: true,
          ...data,
        });
        await setActiveNutritionPlan(clientId, newId, profile.uid);
      }
      notifyUser(
        clientId,
        planId ? 'Plan nutricional actualizado' : 'Nuevo plan nutricional',
        frase`Tu entrenador ha actualizado tu plan: ${data.name}`
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el plan.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Plan nutricional"
        subtitle={clientName ? frase`Para ${clientName}` : undefined}
      />

      <Segmented<Modo>
        opciones={[
          { valor: 'kg', texto: 'Por kg de peso' },
          { valor: 'gramos', texto: 'En gramos' },
        ]}
        valor={modo}
        onChange={setModo}
      />

      {modo === 'kg' ? (
        <>
          <TextField
            label="Peso del alumno (kg)"
            keyboardType="decimal-pad"
            value={peso}
            onChangeText={setPeso}
            placeholder="Ej. 72,5"
            containerStyle={{ marginTop: spacing.md }}
          />
          {ultimoPeso ? (
            <Text style={styles.pista}>
              {frase`Su último registro: ${String(ultimoPeso.kg).replace('.', ',')} kg (${diaMes(ultimoPeso.date)}).`}
            </Text>
          ) : (
            <Text style={styles.pista}>Aún no ha apuntado su peso: escríbelo tú.</Text>
          )}

          <Text style={styles.etiqueta}>Objetivo</Text>
          <Opciones opciones={OBJETIVOS} valor={objetivo} onChange={elegirObjetivo} />

          {/* Cada macro en una fila: lo que escribe el entrenador (g/kg) y lo
              que sale en gramos con el peso de arriba. Un número o un rango. */}
          <Text style={styles.etiqueta}>Gramos por kg · un número (1,8) o un rango (1,6-2,2)</Text>
          <FilaMacro nombre="Proteína" valor={proteinaKg} onChange={setProteinaKg} rango={rangos.proteina} pesoKg={pesoKg} />
          <FilaMacro nombre="Grasas" valor={grasasKg} onChange={setGrasasKg} rango={rangos.grasas} pesoKg={pesoKg} />
          <FilaMacro
            nombre="Carbohidratos"
            valor={carbosKg}
            onChange={setCarbosKg}
            rango={rangos.carbos}
            pesoKg={pesoKg}
            nota="Según el objetivo"
          />
          <FilaMacro
            nombre="Creatina"
            valor={creatinaKg}
            onChange={setCreatinaKg}
            rango={rangos.creatina ?? null}
            pesoKg={pesoKg}
            nota="Opcional"
            unidad="g/día"
          />

          {calculo ? (
            <View style={styles.resumen}>
              <Text style={styles.resumenKcal}>{frase`${calculo.dailyCalories} kcal al día`}</Text>
              {calculo.kcalMax !== calculo.kcalMin ? (
                <Text style={styles.resumenRango}>{frase`Entre ${calculo.kcalMin} y ${calculo.kcalMax} kcal`}</Text>
              ) : null}
              <Text style={styles.resumenMacros}>
                {frase`P ${calculo.proteinG} g · C ${calculo.carbsG} g · G ${calculo.fatG} g`}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <TextField
            label="Calorías diarias (kcal)"
            keyboardType="numeric"
            value={calories}
            onChangeText={setCalories}
            containerStyle={{ marginTop: spacing.md }}
          />
          <View style={styles.row}>
            <TextField label="Proteína (g)" keyboardType="numeric" value={protein} onChangeText={setProtein} containerStyle={styles.smallField} />
            <TextField label="Carbs (g)" keyboardType="numeric" value={carbs} onChangeText={setCarbs} containerStyle={styles.smallField} />
            <TextField label="Grasas (g)" keyboardType="numeric" value={fat} onChangeText={setFat} containerStyle={styles.smallField} />
          </View>
          <MacroSum
            calorias={Number(calories) || 0}
            proteina={Number(protein) || 0}
            carbos={Number(carbs) || 0}
            grasas={Number(fat) || 0}
          />
        </>
      )}

      <TextField label="Nombre del plan" value={name} onChangeText={setName} containerStyle={{ marginTop: spacing.md }} />
      <TextField
        label="Notas (opcional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        style={styles.textarea}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Guardar plan" onPress={handleSave} loading={saving} style={{ marginBottom: spacing.xl }} />
    </ScreenContainer>
  );
}

function FilaMacro({
  nombre,
  valor,
  onChange,
  rango,
  pesoKg,
  nota,
  unidad = 'g',
}: {
  nombre: string;
  valor: string;
  onChange: (v: string) => void;
  rango: ReturnType<typeof leerRango>;
  pesoKg: number;
  nota?: string;
  unidad?: string;
}) {
  const malEscrito = valor.trim() !== '' && !rango;
  return (
    <View style={styles.fila}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.filaNombre}>{nombre}</Text>
        {nota ? <Text style={styles.filaNota}>{nota}</Text> : null}
      </View>
      <TextField
        value={valor}
        onChangeText={onChange}
        keyboardType="numbers-and-punctuation"
        placeholder="g/kg"
        containerStyle={styles.filaCampo}
      />
      <Text style={[styles.filaGramos, malEscrito && { color: colors.danger }]} numberOfLines={1}>
        {malEscrito ? 'Revisa' : rango && pesoValido(pesoKg) ? textoDeGramos(rango, pesoKg, unidad) : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  smallField: { flex: 1, minWidth: 0 },
  textarea: { height: 100, textAlignVertical: 'top' },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  pista: { ...typography.small, color: colors.textFaint, marginTop: -spacing.xs, marginBottom: spacing.sm },
  etiqueta: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineFaint,
  },
  filaNombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  filaNota: { ...typography.small, color: colors.textFaint, fontSize: 12 },
  filaCampo: { width: 96, marginBottom: 0 },
  filaGramos: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold, width: 92, textAlign: 'right' },
  resumen: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
  },
  resumenKcal: { ...typography.h2, color: colors.primaryBright },
  resumenRango: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  resumenMacros: { ...typography.small, color: colors.text, marginTop: spacing.xs, fontFamily: fonts.semiBold },
});
