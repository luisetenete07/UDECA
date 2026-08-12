import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { TextField } from './TextField';
import { WeightChart } from './WeightChart';
import { showToast } from './Toast';
import { confirmar } from '../lib/confirmar';
import { fechaNumerica } from '../lib/fechas';
import { createWeightLog, deleteWeightLog } from '../lib/firestore/weightLogs';
import { conSigno, kgCorto, pesoDeTexto, resumenDePeso, textoDelObjetivo } from '../lib/peso';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';
import type { UserProfile, WeightLog } from '../lib/types';

/**
 * El peso: cuánto pesa, cómo va y apuntar el de hoy.
 *
 * Vive aquí y no dentro de una pantalla porque se enseña en dos sitios —en
 * Nutrición, que es donde el peso significa algo, y en Progreso, que es donde
 * se va a mirar la evolución— y un formulario copiado en dos sitios acaba
 * siendo dos formularios distintos.
 *
 * Lo primero que se ve es la cifra grande con lo que ha cambiado esta semana y
 * este mes. Eso es lo que alguien viene a mirar; la gráfica y el historial son
 * para después.
 */
export function BloqueDePeso({
  profile,
  logs,
  onCambio,
  /** En Progreso el título sobra: ya lo dice la pestaña. */
  conTitulo = true,
}: {
  profile: UserProfile | null | undefined;
  logs: WeightLog[];
  /** Se llama tras guardar o borrar, para que el padre recargue lo suyo. */
  onCambio: () => void | Promise<void>;
  conTitulo?: boolean;
}) {
  const [peso, setPeso] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [verTodo, setVerTodo] = useState(false);

  const resumen = resumenDePeso(logs, profile?.targetWeightKg);
  const delObjetivo = textoDelObjetivo(resumen, profile?.targetWeightKg);

  const guardar = async () => {
    if (!profile) return;
    const kg = pesoDeTexto(peso);
    if (kg === undefined) {
      setError('Escribe tu peso en kg (por ejemplo, 66,4).');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await createWeightLog({
        trainerId: profile.trainerId ?? '',
        clientId: profile.uid,
        date: Date.now(),
        weightKg: kg,
        notes: notas.trim() || undefined,
      });
      setPeso('');
      setNotas('');
      await onCambio();
      showToast('Peso guardado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (id: string) => {
    if (!(await confirmar('¿Borrar este registro de peso?'))) return;
    try {
      await deleteWeightLog(id);
      await onCambio();
      showToast('Registro borrado');
    } catch {
      showToast('No se pudo borrar');
    }
  };

  // El historial entero, del revés (lo último arriba). Se enseñan unos pocos:
  // con un año apuntándose, la lista completa empuja todo lo demás fuera de
  // la pantalla y nadie baja hasta el final.
  const historial = [...logs].sort((a, b) => b.date - a.date);
  const visibles = verTodo ? historial : historial.slice(0, 6);

  return (
    <>
      <Card style={styles.tarjeta}>
        {conTitulo ? <Text style={styles.titulo}>Mi peso</Text> : null}

        {resumen.actual === undefined ? (
          <EmptyState
            icon="scale-outline"
            title="Todavía no has apuntado tu peso"
            subtitle="Pésate a la misma hora, mejor en ayunas. Lo que importa no es el número de hoy: es hacia dónde va."
          />
        ) : (
          <>
            <View style={styles.cifraFila}>
              <Text style={styles.cifra}>{kgCorto(resumen.actual)}</Text>
              <Text style={styles.unidad}>kg</Text>
            </View>
            <View style={styles.cambios}>
              <Cambio etiqueta="Esta semana" kg={resumen.semana} />
              <Cambio etiqueta="Este mes" kg={resumen.mes} />
            </View>
            {delObjetivo ? (
              <View style={styles.objetivo}>
                <Ionicons
                  name={resumen.enObjetivo ? 'checkmark-circle' : 'flag-outline'}
                  size={15}
                  color={resumen.enObjetivo ? colors.success : colors.primaryBright}
                />
                <Text style={styles.objetivoTexto}>{delObjetivo}</Text>
              </View>
            ) : null}
          </>
        )}

        <View style={styles.apuntar}>
          <TextField
            placeholder="Peso en kg (ej. 66,4)"
            keyboardType="decimal-pad"
            value={peso}
            onChangeText={setPeso}
            containerStyle={{ flex: 1 }}
            style={{ marginBottom: 0 }}
          />
          <Button title="Apuntar" onPress={guardar} loading={guardando} style={styles.boton} />
        </View>
        <TextField
          placeholder="Notas (opcional)"
          value={notas}
          onChangeText={setNotas}
          style={{ marginBottom: 0 }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {logs.length > 1 ? (
        <Card style={styles.tarjeta}>
          <Text style={styles.subtitulo}>Evolución</Text>
          <WeightChart logs={logs} />
        </Card>
      ) : null}

      {historial.length > 0 ? (
        <Card style={styles.tarjeta}>
          <Text style={styles.subtitulo}>Historial</Text>
          {visibles.map((log) => (
            <View key={log.id} style={styles.fila}>
              <Text style={styles.filaPeso}>{kgCorto(log.weightKg)} kg</Text>
              <Text style={styles.filaFecha}>{fechaNumerica(log.date)}</Text>
              <Pressable onPress={() => borrar(log.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
              </Pressable>
            </View>
          ))}
          {historial.length > visibles.length ? (
            <Pressable onPress={() => setVerTodo(true)} style={styles.mas} hitSlop={6}>
              <Text style={styles.masTexto}>Ver los {historial.length} registros</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

/**
 * Un cambio de peso. Sin dato no se pinta un cero: quien lleva dos días
 * apuntándose no ha ganado ni perdido nada este mes, es que no hay mes.
 */
function Cambio({ etiqueta, kg }: { etiqueta: string; kg?: number }) {
  return (
    <View style={styles.cambio}>
      <Text style={styles.cambioEtiqueta}>{etiqueta}</Text>
      <Text style={styles.cambioValor}>{kg === undefined ? '—' : conSigno(kg)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  titulo: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  subtitulo: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  cifraFila: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  cifra: { ...typography.h1, color: colors.text, fontSize: 40, ...tabularNums },
  unidad: { ...typography.body, color: colors.textMuted },
  cambios: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  cambio: { gap: 2 },
  cambioEtiqueta: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
  },
  cambioValor: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, ...tabularNums },
  objetivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  objetivoTexto: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 18 },
  apuntar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  boton: { minWidth: 104 },
  error: { ...typography.small, color: colors.danger, marginTop: spacing.sm },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  filaPeso: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, ...tabularNums },
  filaFecha: { ...typography.small, color: colors.textMuted, flex: 1 },
  mas: { paddingTop: spacing.md, alignItems: 'center' },
  masTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
