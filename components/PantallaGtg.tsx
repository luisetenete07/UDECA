import React, { useState } from 'react';
import { frase } from '../lib/idioma';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { ProgressRing } from './ProgressRing';
import { TextField } from './TextField';
import { progresoGtg, textoDelDia } from '../lib/gtg';
import { isHoldMeasure } from '../lib/types';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { Routine, RoutineDay, WorkoutLog } from '../lib/types';

/**
 * La pantalla de grease the groove.
 *
 * No se parece a la de entrenar y no debe parecerse. Aquí no se empieza una
 * sesión: se entra, se apunta UNA serie y se sale, ocho veces al día. Todo lo
 * que hace falta cabe sin desplazarse, porque a la octava vez cualquier paso
 * de más se nota ocho veces.
 *
 * Lo que se enseña primero es cuántas van, no el ejercicio: el ejercicio ya se
 * lo sabe —es el mismo todo el día— y lo que viene a mirar es si le toca otra.
 */
export function PantallaGtg({
  routine,
  dia,
  entrenoDeHoy,
  guardando,
  onAnadirSerie,
  onDeshacer,
}: {
  routine: Routine;
  /** El día que se entrena: el primero de la rutina, o el elegido en Sensaciones. */
  dia: RoutineDay | null;
  entrenoDeHoy: WorkoutLog | null;
  guardando?: boolean;
  onAnadirSerie: (exerciseId: string, nombre: string, marca: string) => void;
  onDeshacer: () => void;
}) {
  const ejercicios = dia?.exercises ?? [];
  const [elegido, setElegido] = useState(ejercicios[0]?.exerciseId ?? '');
  const [marca, setMarca] = useState('');

  const p = progresoGtg(routine, entrenoDeHoy, dia);
  const ejercicio = ejercicios.find((e) => e.exerciseId === elegido) ?? ejercicios[0];
  const enSegundos = isHoldMeasure(ejercicio?.measure);

  const anadir = () => {
    if (!ejercicio || !marca.trim()) return;
    onAnadirSerie(ejercicio.exerciseId, ejercicio.name, marca.trim());
    setMarca('');
  };

  return (
    <>
      <Card accent style={styles.tarjeta}>
        <View style={styles.cabecera}>
          <ProgressRing
            size={92}
            thickness={7}
            progress={p.ratio}
            value={`${p.hechas}`}
            label={frase`de ${p.objetivo}`}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Series de hoy</Text>
            <Text style={styles.texto}>{textoDelDia(p)}</Text>
          </View>
        </View>

        {/* Los puntos: de un vistazo se ve lo hecho y lo que queda, sin contar.
            Es la misma idea que las plazas del entrenador. */}
        <View style={styles.puntos}>
          {Array.from({ length: p.objetivo }, (_, i) => (
            <View key={i} style={[styles.punto, i < p.hechas && styles.puntoHecho]} />
          ))}
          {/* Las de más, si se ha pasado, en otro tono: se ven, pero no se
              celebran. */}
          {Array.from({ length: Math.max(0, p.hechas - p.objetivo) }, (_, i) => (
            <View key={`extra-${i}`} style={[styles.punto, styles.puntoExtra]} />
          ))}
        </View>
      </Card>

      {ejercicios.length === 0 ? (
        <Card style={styles.tarjeta}>
          <Text style={styles.texto}>
            Esta rutina no tiene ningún ejercicio todavía.
          </Text>
        </Card>
      ) : (
        <Card style={styles.tarjeta}>
          {/* Con un solo ejercicio no se elige nada: es el caso normal del
              método y una fila de un botón solo sería ruido. */}
          {ejercicios.length > 1 ? (
            <View style={styles.fila}>
              {ejercicios.map((e) => {
                const on = e.exerciseId === (ejercicio?.exerciseId ?? '');
                return (
                  <Pressable
                    key={e.exerciseId}
                    onPress={() => setElegido(e.exerciseId)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipTexto, on && styles.chipTextoOn]} numberOfLines={1}>
                      {e.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.nombreEjercicio}>{ejercicio?.name}</Text>
          )}

          <View style={styles.filaMarca}>
            <TextField
              value={marca}
              onChangeText={setMarca}
              keyboardType="number-pad"
              placeholder={enSegundos ? 'Segundos' : 'Reps'}
              containerStyle={styles.campo}
              onSubmitEditing={anadir}
              returnKeyType="done"
            />
            <Button
              title="Apuntar serie"
              onPress={anadir}
              loading={guardando}
              disabled={!marca.trim()}
              style={{ flex: 1 }}
            />
          </View>

          {ejercicio?.reps ? (
            <Text style={styles.objetivo}>
              Objetivo por serie: {ejercicio.reps}
              {enSegundos ? ' s' : ''} · nunca al fallo
            </Text>
          ) : (
            <Text style={styles.objetivo}>
              Que salga fácil: si la última cuesta, has hecho de más.
            </Text>
          )}

          {p.hechas > 0 ? (
            <Pressable onPress={onDeshacer} hitSlop={8} style={styles.deshacer}>
              <Ionicons name="arrow-undo-outline" size={14} color={colors.textFaint} />
              <Text style={styles.deshacerTexto}>Quitar la última</Text>
            </Pressable>
          ) : null}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titulo: { ...typography.h3, color: colors.text },
  texto: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  puntos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  punto: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  puntoHecho: { backgroundColor: colors.primary, borderColor: colors.primary },
  puntoExtra: { backgroundColor: colors.textFaint, borderColor: colors.textFaint },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTexto: { ...typography.small, color: colors.textMuted },
  chipTextoOn: { color: colors.onPrimary, fontFamily: fonts.semiBold },
  nombreEjercicio: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  filaMarca: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  campo: { width: 96, marginBottom: 0 },
  objetivo: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm },
  deshacer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  deshacerTexto: { ...typography.small, color: colors.textFaint },
});
