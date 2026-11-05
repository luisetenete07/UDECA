import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Button } from './Button';
import { DateField } from './DateField';
import { Opciones } from './Opciones';
import { Sheet } from './Sheet';
import { showToast } from './Toast';
import { fechaLegible, inicioDelDia } from '../lib/fechas';
import { frase, t } from '../lib/idioma';
import { getAvisosParaElEntrenador } from '../lib/firestore/avisos';
import { getCyclesForClient } from '../lib/firestore/cycles';
import {
  inicioDelAlumno,
  informeDeCambios,
  TODO_EL_INFORME,
  type OpcionesDelInforme,
} from '../lib/informeDeCambios';
import { informeDeCambiosHtml } from '../lib/informeDeCambiosPdf';
import { printReportHtml } from '../lib/printReport';
import type { AvisoDelPlan } from '../lib/avisosDelPlan';
import { colors, fieldLabel, fonts, radius, spacing, typography } from '../lib/theme';
import type { Routine, TrainingCycle, UserProfile, WorkoutLog } from '../lib/types';

type Periodo = 'todo' | '3m' | '1m' | 'fechas';

const QUE_ENTRA: { clave: keyof OpcionesDelInforme; texto: string; pista: string }[] = [
  { clave: 'planes', texto: 'Planes y tipos de entreno', pista: 'Cada plan que ha tenido, sus días y cuántas veces entrenó cada uno.' },
  { clave: 'rutina', texto: 'Cambios de rutina', pista: 'Planes nuevos, días añadidos o quitados y ajustes del plan.' },
  { clave: 'ejercicios', texto: 'Ejercicios', pista: 'Los que entran, los que salen y los cambiados por otro.' },
  { clave: 'series', texto: 'Series y repeticiones', pista: '"3 × 8 → 4 × 8".' },
  { clave: 'detalles', texto: 'Otros detalles', pista: 'Descanso, notas, intensidad, agarre, carga…' },
  { clave: 'semanas', texto: 'Ciclos y semanas', pista: 'Los bloques y lo programado en cada semana.' },
];

const DIA = 86_400_000;

/**
 * EL INFORME DE CAMBIOS, DESDE LA FICHA DEL ALUMNO (lib/informeDeCambios.ts).
 *
 * El entrenador elige el periodo —desde que empezó, los últimos meses o unas
 * fechas— y qué entra, ve cuántos cambios salen, y lo saca en PDF.
 */
export function InformeDeCambiosSheet({
  visible,
  onClose,
  client,
  trainerId,
  coachName,
  routines,
  workoutLogs,
  measureByExercise,
}: {
  visible: boolean;
  onClose: () => void;
  client: UserProfile;
  trainerId: string;
  coachName?: string;
  routines: Routine[];
  workoutLogs: WorkoutLog[];
  measureByExercise: Record<string, string>;
}) {
  const [periodo, setPeriodo] = useState<Periodo>('todo');
  const inicio = useMemo(
    () => inicioDelAlumno([client.createdAt, ...routines.map((r) => r.createdAt), ...workoutLogs.map((l) => l.date)]),
    [client.createdAt, routines, workoutLogs]
  );
  const hoy = inicioDelDia(Date.now());
  const [desdeElegido, setDesdeElegido] = useState(inicio);
  const [hastaElegido, setHastaElegido] = useState(hoy);
  const [opciones, setOpciones] = useState<OpcionesDelInforme>(TODO_EL_INFORME);
  const [datos, setDatos] = useState<{ avisos: AvisoDelPlan[]; cycles: TrainingCycle[] } | null>(null);
  const [creando, setCreando] = useState(false);

  // Los cambios del plan y los ciclos se piden al abrirlo: la ficha no los necesita.
  useEffect(() => {
    if (!visible || datos) return;
    let vivo = true;
    Promise.all([
      getAvisosParaElEntrenador(trainerId, client.uid).catch(() => [] as AvisoDelPlan[]),
      getCyclesForClient(trainerId, client.uid).catch(() => [] as TrainingCycle[]),
    ]).then(([avisos, cycles]) => vivo && setDatos({ avisos, cycles }));
    return () => {
      vivo = false;
    };
  }, [visible, datos, trainerId, client.uid]);

  const { desde, hasta } = (() => {
    const fin = hoy + DIA - 1;
    if (periodo === 'fechas') {
      const a = Math.min(desdeElegido, hastaElegido);
      const b = Math.max(desdeElegido, hastaElegido);
      return { desde: a, hasta: b + DIA - 1 };
    }
    if (periodo === 'todo') return { desde: inicio, hasta: fin };
    const d = new Date(hoy);
    d.setMonth(d.getMonth() - (periodo === '3m' ? 3 : 1));
    return { desde: Math.max(inicio, d.getTime()), hasta: fin };
  })();

  const informe = useMemo(
    () =>
      datos
        ? informeDeCambios({
            desde,
            hasta,
            routines,
            avisos: datos.avisos,
            cycles: datos.cycles,
            logs: workoutLogs,
            medidas: measureByExercise,
            opciones,
          })
        : null,
    [datos, desde, hasta, routines, workoutLogs, measureByExercise, opciones]
  );

  const crear = async () => {
    if (!informe) return;
    setCreando(true);
    try {
      await printReportHtml(
        informeDeCambiosHtml(informe, {
          alumno: client.name,
          nivel: client.level,
          objetivo: client.goal,
          entrenador: coachName,
        }),
        frase`Cambios del entrenamiento · ${client.name}`
      );
    } catch {
      showToast('No se pudo crear el PDF');
    } finally {
      setCreando(false);
    }
  };

  const nada = !Object.values(opciones).some(Boolean);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      titulo="Informe de cambios"
      descripcion="Todo lo que has ido cambiando de su entrenamiento, ordenado por el día del cambio, en un PDF."
    >
      <Text style={styles.rotulo}>Periodo</Text>
      <Opciones
        opciones={[
          { valor: 'todo' as const, texto: 'Desde que empezó' },
          { valor: '3m' as const, texto: '3 meses' },
          { valor: '1m' as const, texto: '1 mes' },
          { valor: 'fechas' as const, texto: 'Fechas' },
        ]}
        valor={periodo}
        onChange={(v) => v && setPeriodo(v)}
        envuelve
      />
      {periodo === 'fechas' ? (
        <View style={styles.fechas}>
          <Text style={styles.fechaRotulo}>Desde</Text>
          <DateField value={desdeElegido} onChange={setDesdeElegido} showToday={false} />
          <Text style={styles.fechaRotulo}>Hasta</Text>
          <DateField value={hastaElegido} onChange={setHastaElegido} />
        </View>
      ) : (
        <Text style={styles.pista}>{frase`Del ${fechaLegible(desde)} al ${fechaLegible(hasta)}`}</Text>
      )}

      <Text style={styles.rotulo}>Qué incluir</Text>
      {QUE_ENTRA.map((q) => {
        const on = opciones[q.clave];
        return (
          <Pressable
            key={q.clave}
            style={styles.casillaFila}
            onPress={() => setOpciones((o) => ({ ...o, [q.clave]: !o[q.clave] }))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={t(q.texto)}
          >
            <View style={[styles.casilla, on && styles.casillaOn]}>
              {on ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.casillaTexto}>{q.texto}</Text>
              <Text style={styles.casillaPista}>{q.pista}</Text>
            </View>
          </Pressable>
        );
      })}

      <View style={styles.resumen}>
        <Ionicons name="document-text-outline" size={18} color={colors.primary} />
        <Text style={styles.resumenTexto}>
          {!informe
            ? t('Mirando sus cambios…')
            : informe.dias.length === 0
              ? t('No hay cambios en este periodo con lo que has elegido.')
              : frase`${informe.cambios} cambios en ${informe.dias.length} días · ${informe.sesiones} entrenos`}
        </Text>
      </View>

      <Button
        title="Crear PDF"
        onPress={crear}
        loading={creando}
        disabled={!informe || nada}
        style={{ marginTop: spacing.md }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rotulo: { ...fieldLabel, marginTop: spacing.md },
  pista: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  fechas: { gap: spacing.xs, marginTop: spacing.sm },
  fechaRotulo: { ...typography.small, color: colors.textMuted },
  casillaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2, paddingVertical: spacing.sm },
  casilla: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  casillaTexto: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  casillaPista: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  resumen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
  },
  resumenTexto: { ...typography.small, color: colors.text, flex: 1, lineHeight: 18 },
});
