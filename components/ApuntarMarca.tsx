import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { TextField } from './TextField';
import { Chip, ChipRow } from './Chip';
import { showToast } from './Toast';
import { frase, t } from '../lib/idioma';
import { conMarca, ejercicioDeLaMarca, marcaValida, queSePide, registroDeHoy, type Marca } from '../lib/apuntarMarca';
import { createWorkoutLog, updateWorkoutLog } from '../lib/firestore/workoutLogs';
import { lastPerformanceByExercise } from '../lib/stats';
import { resolveLoad, type ExerciseMeasure, type Routine, type RoutineExercise, type UserProfile, type WorkoutLog } from '../lib/types';
import { colors, spacing, typography } from '../lib/theme';

/**
 * APUNTAR UNA MARCA, cuando el alumno quiera (lib/apuntarMarca.ts).
 *
 * Un ejercicio del día, la cifra (repeticiones, o segundos si es isométrico),
 * el lastre si lo lleva y una nota si quiere. Nada más: no hay series que
 * rellenar ni entreno que cerrar.
 */
export function ApuntarMarca({
  visible,
  onClose,
  profile,
  routine,
  dayName,
  ejercicios,
  medidaDe,
  inicial,
  logs,
  onGuardada,
}: {
  visible: boolean;
  onClose: () => void;
  profile: UserProfile;
  routine: Routine;
  /** El día de la rutina que está mirando: la marca va con ese día. */
  dayName: string;
  ejercicios: RoutineExercise[];
  medidaDe: (ex: RoutineExercise) => ExerciseMeasure | undefined;
  /** El ejercicio con el que se abre, si se tocó uno. */
  inicial?: string;
  logs: WorkoutLog[];
  onGuardada: (logs: WorkoutLog[]) => void;
}) {
  // Un ejercicio que sale dos veces en el día es un solo ejercicio que apuntar.
  const unicos = useMemo(() => {
    const vistos = new Set<string>();
    return ejercicios.filter((e) => (vistos.has(e.exerciseId) ? false : (vistos.add(e.exerciseId), true)));
  }, [ejercicios]);
  const [elegido, setElegido] = useState<string | undefined>(inicial ?? unicos[0]?.exerciseId);
  const [valor, setValor] = useState('');
  const [kg, setKg] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Cada vez que se abre, limpio y en el ejercicio que toca.
  useEffect(() => {
    if (!visible) return;
    setElegido(inicial ?? unicos[0]?.exerciseId);
    setValor('');
    setKg('');
    setNota('');
  }, [visible, inicial, unicos]);

  const ex = unicos.find((e) => e.exerciseId === elegido);
  const medida = ex ? medidaDe(ex) : undefined;
  const pide = queSePide(medida);
  const carga = ex ? resolveLoad(ex) : undefined;
  const ultima = useMemo(() => (ex ? lastPerformanceByExercise(logs)[ex.exerciseId] : undefined), [logs, ex]);

  const marca: Marca | null = ex
    ? {
        exerciseId: ex.exerciseId,
        name: ex.name,
        measure: medida,
        load: carga,
        valor,
        kg: carga === 'weighted' || carga === 'assisted' ? kg : undefined,
        nota,
      }
    : null;

  const guardar = async () => {
    if (!marca || !marcaValida(marca)) return;
    setGuardando(true);
    try {
      const hoy = registroDeHoy(logs, routine.id, dayName);
      let nuevos: WorkoutLog[];
      if (hoy) {
        const exercises = conMarca(hoy.exercises, marca);
        await updateWorkoutLog(hoy.id, { exercises });
        nuevos = logs.map((l) => (l.id === hoy.id ? { ...l, exercises } : l));
      } else {
        const datos = {
          trainerId: profile.trainerId ?? '',
          clientId: profile.uid,
          routineId: routine.id,
          routineName: routine.name,
          dayName,
          date: Date.now(),
          exercises: [ejercicioDeLaMarca(marca)],
        };
        const id = await createWorkoutLog(datos);
        nuevos = [{ ...datos, id, createdAt: Date.now() }, ...logs];
      }
      onGuardada(nuevos);
      showToast('Marca apuntada. La verás en Progreso.');
      onClose();
    } catch {
      showToast('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      titulo={t('Apuntar una marca')}
      descripcion={t('Lo que quieras guardar para ver tu progreso. No hace falta apuntarlo todo.')}
    >
      <ChipRow scroll>
        {unicos.map((e) => (
          <Chip key={e.exerciseId} texto={e.name} activo={e.exerciseId === elegido} onPress={() => setElegido(e.exerciseId)} />
        ))}
      </ChipRow>

      {ultima?.reps ? (
        <Text style={styles.ultima}>
          {ultima.weight
            ? frase`La última: ${ultima.reps} ${pide === 'segundos' ? 's' : 'reps'} con ${ultima.weight} kg`
            : frase`La última: ${ultima.reps} ${pide === 'segundos' ? 's' : 'reps'}`}
        </Text>
      ) : null}

      <View style={styles.fila}>
        <TextField
          label={pide === 'segundos' ? t('Segundos') : t('Repeticiones')}
          value={valor}
          onChangeText={setValor}
          keyboardType="decimal-pad"
          placeholder={pide === 'segundos' ? '30' : '10'}
          containerStyle={{ flex: 1 }}
          autoFocus
        />
        {carga === 'weighted' || carga === 'assisted' ? (
          <TextField
            label={carga === 'weighted' ? t('Lastre (kg)') : t('Goma (kg)')}
            value={kg}
            onChangeText={setKg}
            keyboardType="decimal-pad"
            placeholder="0"
            containerStyle={{ flex: 1 }}
          />
        ) : null}
      </View>
      <TextField
        label={t('Nota (opcional)')}
        value={nota}
        onChangeText={setNota}
        placeholder={t('Cómo te ha ido')}
        maxLength={300}
      />
      <Button
        title="Guardar marca"
        onPress={guardar}
        loading={guardando}
        disabled={!marca || !marcaValida(marca)}
        style={{ marginTop: spacing.sm }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  ultima: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
});
