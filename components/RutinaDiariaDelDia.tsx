import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import {
  getDiaDeRutinaDiaria,
  getRutinaDiaria,
  setDiaDeRutinaDiaria,
} from '../lib/firestore/rutinaDiaria';
import {
  conEjercicioMarcado,
  hayRutinaDiaria,
  hechosDeHoy,
  NOMBRE_POR_DEFECTO,
  progresoDiario,
  textoDiario,
} from '../lib/rutinaDiaria';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { DiaDeRutinaDiaria, RutinaDiaria, UserProfile } from '../lib/types';

/**
 * Lo que toca hacer HOY aparte del entreno, y marcarlo.
 *
 * POR QUÉ VA EN ENTRENO Y NO EN EL INICIO
 *
 * Porque es entrenamiento, y porque el inicio ya tiene la racha, los avisos y
 * el resumen: una cosa más ahí se pierde. En Entreno está donde se está cuando
 * se entrena, que es cuando se acuerda uno del pino.
 *
 * POR QUÉ NO SE PARECE A UNA SESIÓN
 *
 * No tiene botón de empezar ni de terminar, ni cuenta series. Son cuatro cosas
 * cortas repartidas por el día: se marca lo que se va haciendo y ya. Ponerle la
 * ceremonia de una sesión —abrir, completar, cerrar— es lo que haría que nadie
 * la hiciera "porque ahora no tengo tiempo de ponerme".
 *
 * Y EL DÍA A MEDIAS NO ES UN FALLO
 *
 * Dos de tres es un día bueno en algo que se repite a diario. La barra sube y
 * el texto lo dice; no hay nada en rojo. Tratar el día incompleto como un
 * fracaso es lo que enseña a abandonar en cuanto se rompe la racha.
 */
export function RutinaDiariaDelDia({ profile }: { profile: UserProfile | null }) {
  const [rutina, setRutina] = useState<RutinaDiaria | null>(null);
  const [dia, setDia] = useState<DiaDeRutinaDiaria | null>(null);
  const uid = profile?.uid;

  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    Promise.all([getRutinaDiaria(uid).catch(() => null), getDiaDeRutinaDiaria(uid).catch(() => null)])
      .then(([r, d]) => {
        if (!vivo) return;
        setRutina(r);
        setDia(d);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [uid]);

  const marcar = useCallback(
    (id: string) => {
      if (!uid || !rutina) return;
      const hechos = hechosDeHoy(dia);
      const siguiente = conEjercicioMarcado(hechos, id, !hechos.includes(id));
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // Se pinta ya y se guarda detrás: marcar una casilla no puede esperar a
      // que conteste la red.
      setDia((prev) => ({
        id: prev?.id ?? '',
        clientId: uid,
        date: Date.now(),
        hechos: siguiente,
        updatedAt: Date.now(),
      }));
      setDiaDeRutinaDiaria(uid, siguiente, rutina.trainerId).catch(() => {});
    },
    [uid, rutina, dia]
  );

  if (!hayRutinaDiaria(rutina) || !rutina) return null;

  const hechos = hechosDeHoy(dia);
  const p = progresoDiario(rutina, dia);

  return (
    <Card style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <View style={styles.icono}>
          <Ionicons
            name={p.completa ? 'checkmark-circle' : 'repeat-outline'}
            size={17}
            color={colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo} numberOfLines={1}>
            {rutina.nombre || NOMBRE_POR_DEFECTO}
          </Text>
          <Text style={styles.texto}>{textoDiario(p)}</Text>
        </View>
        <Text style={styles.cuenta}>
          {p.hechos}/{p.total}
        </Text>
      </View>

      <ProgressBar progress={p.ratio} height={6} />

      {rutina.ejercicios.map((e) => {
        const hecho = hechos.includes(e.id);
        return (
          <Pressable key={e.id} style={styles.fila} onPress={() => marcar(e.id)} hitSlop={4}>
            <View style={[styles.casilla, hecho && styles.casillaOn]}>
              {hecho ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.filaNombre, hecho && styles.filaHecha]} numberOfLines={2}>
                {e.nombre}
              </Text>
              {e.objetivo ? (
                <Text style={styles.filaObjetivo} numberOfLines={1}>
                  {e.objetivo}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md, gap: spacing.sm },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  icono: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  texto: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  cuenta: {
    ...typography.body,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    flexShrink: 0,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  casilla: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  filaNombre: { ...typography.body, color: colors.text },
  // Hecho: se atenúa y se tacha. Sigue a la vista para poder desmarcarlo.
  filaHecha: { color: colors.textFaint, textDecorationLine: 'line-through' },
  filaObjetivo: { ...typography.small, color: colors.textMuted, marginTop: 1 },
});
