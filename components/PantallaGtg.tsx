import React, { useState } from 'react';
import { frase } from '../lib/idioma';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { ProgressRing } from './ProgressRing';
import { TextField } from './TextField';
import { MAX_OBJETIVO, objetivoDelDia, progresoGtg, textoDelDia } from '../lib/gtg';
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
  ajusteObjetivo,
  onCambiarObjetivo,
}: {
  routine: Routine;
  /** El día que se entrena: el primero de la rutina, o el elegido en Sensaciones. */
  dia: RoutineDay | null;
  entrenoDeHoy: WorkoutLog | null;
  guardando?: boolean;
  onAnadirSerie: (exerciseId: string, nombre: string, marca: string) => void;
  onDeshacer: () => void;
  /** Las series de hoy que puso el alumno antes de apuntar ninguna (aún sin guardar). */
  ajusteObjetivo?: number | null;
  /** El alumno sube o baja las series de hoy. */
  onCambiarObjetivo?: (series: number) => void;
}) {
  const ejercicios = dia?.exercises ?? [];
  const [elegido, setElegido] = useState(ejercicios[0]?.exerciseId ?? '');
  const [marca, setMarca] = useState('');
  const [indicacionesAbiertas, setIndicacionesAbiertas] = useState(false);

  const p = progresoGtg(routine, entrenoDeHoy, dia, ajusteObjetivo);
  // Lo que puso el entrenador, para decirlo cuando el alumno lo ha cambiado.
  const delPlan = objetivoDelDia(routine, dia);
  const ejercicio = ejercicios.find((e) => e.exerciseId === elegido) ?? ejercicios[0];
  const enSegundos = isHoldMeasure(ejercicio?.measure);
  const indicaciones = dia?.gtgIndicaciones?.trim() ?? '';
  const indicacionesLargas = indicaciones.length > 140 || indicaciones.includes('\n');

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

        {/*
          AÑADIR O QUITAR SERIES PARA HOY. Hay días de hacer una más y días de
          quedarse en cuatro, y en un método que vive de no apretar eso es lo
          sano. Cambia solo hoy; mañana vuelven las del entrenador, y si no son
          las suyas se dice.
        */}
        {onCambiarObjetivo ? (
          <View style={styles.ajuste}>
            <Pressable
              onPress={() => onCambiarObjetivo(p.objetivo - 1)}
              disabled={p.objetivo <= 1}
              hitSlop={8}
              style={[styles.ajusteBtn, p.objetivo <= 1 && styles.ajusteApagado]}
            >
              <Ionicons name="remove" size={14} color={colors.textMuted} />
              <Text style={styles.ajusteTexto}>Quitar serie</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => onCambiarObjetivo(p.objetivo + 1)}
              disabled={p.objetivo >= MAX_OBJETIVO}
              hitSlop={8}
              style={[styles.ajusteBtn, p.objetivo >= MAX_OBJETIVO && styles.ajusteApagado]}
            >
              <Ionicons name="add" size={14} color={colors.primary} />
              <Text style={[styles.ajusteTexto, { color: colors.primary }]}>Añadir serie</Text>
            </Pressable>
          </View>
        ) : null}
        {onCambiarObjetivo && p.objetivo !== delPlan && delPlan > 0 ? (
          <Text style={styles.ajusteNota}>{frase`Hoy ${p.objetivo} · tu entrenador puso ${delPlan}`}</Text>
        ) : null}
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

          {/* Las indicaciones de ESTE ejercicio (las que el entrenador escribe
              en cada uno al montar el día). Antes se escribían y aquí no salían. */}
          {ejercicio?.notes?.trim() ? (
            <Text style={styles.notaEjercicio}>{ejercicio.notes.trim()}</Text>
          ) : null}

          {p.hechas > 0 ? (
            <Pressable onPress={onDeshacer} hitSlop={8} style={styles.deshacer}>
              <Ionicons name="arrow-undo-outline" size={14} color={colors.textFaint} />
              <Text style={styles.deshacerTexto}>Quitar la última</Text>
            </Pressable>
          ) : null}
        </Card>
      )}

      {/*
       * LAS INDICACIONES DEL DÍA, DEBAJO.
       *
       * Se leen una vez y la pantalla se abre ocho: arriba empujarían el campo
       * de apuntar fuera de la vista justo en las siete veces que ya se saben.
       * Largas, en tres líneas y "Ver más".
       */}
      {indicaciones ? (
        <Card style={styles.tarjeta}>
          <View style={styles.indicacionesCab}>
            <Ionicons name="document-text-outline" size={15} color={colors.primary} />
            <Text style={styles.indicacionesTitulo}>Indicaciones de tu entrenador</Text>
          </View>
          <Text style={styles.indicacionesTexto} numberOfLines={indicacionesAbiertas || !indicacionesLargas ? undefined : 3}>
            {indicaciones}
          </Text>
          {indicacionesLargas ? (
            <Pressable onPress={() => setIndicacionesAbiertas((v) => !v)} hitSlop={8}>
              <Text style={styles.verMas}>{indicacionesAbiertas ? 'Ver menos' : 'Ver más'}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}
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
  ajuste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ajusteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  ajusteApagado: { opacity: 0.35 },
  ajusteTexto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  ajusteNota: { ...typography.small, fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 2 },
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
  notaEjercicio: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs, fontStyle: 'italic', lineHeight: 18 },
  indicacionesCab: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  indicacionesTitulo: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  indicacionesTexto: { ...typography.body, color: colors.text, lineHeight: 22 },
  verMas: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, marginTop: spacing.xs },
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
