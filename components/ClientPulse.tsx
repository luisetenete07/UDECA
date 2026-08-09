import { inicioDelDia } from '../lib/fechas';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { PressableScale } from './PressableScale';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { UserProfile, WorkoutLog } from '../lib/types';

/**
 * Quién ha entrenado y quién no, de un vistazo.
 *
 * Es la pregunta que un entrenador se hace al abrir la app, y hasta ahora la
 * respuesta estaba repartida entre una cifra ("2 inactivos"), una lista de
 * actividad reciente y la ficha de cada alumno. Tres sitios para una pregunta
 * de tres segundos.
 *
 * Se lee por FORMA y COLOR, no por texto: el aro lleno es quien entrenó hoy, el
 * medio aro quien entrenó esta semana, el aro apagado quien lleva días sin
 * aparecer y el punto rojo quien además debe dinero. Nadie tiene que leer nada
 * para saber a quién escribirle.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

export type EstadoAlumno = 'hoy' | 'semana' | 'parado' | 'nunca';

export interface PulsoAlumno {
  uid: string;
  name: string;
  photoURL?: string | null;
  estado: EstadoAlumno;
  /** Días desde el último entreno; null si no ha entrenado nunca. */
  dias: number | null;
  debe: boolean;
}

/** Clasifica a cada alumno por cuándo entrenó por última vez. */
export function pulsoDeAlumnos(
  clients: UserProfile[],
  logs: WorkoutLog[],
  now = Date.now()
): PulsoAlumno[] {
  const ultimo = new Map<string, number>();
  for (const l of logs) {
    const previo = ultimo.get(l.clientId) ?? 0;
    if (l.date > previo) ultimo.set(l.clientId, l.date);
  }

  const hoy = new Date(inicioDelDia(now));

  return clients
    .map((c) => {
      const fecha = ultimo.get(c.uid);
      const dias = fecha == null ? null : Math.floor((now - fecha) / DIA_MS);
      const estado: EstadoAlumno =
        fecha == null
          ? 'nunca'
          : fecha >= hoy.getTime()
            ? 'hoy'
            : now - fecha < 7 * DIA_MS
              ? 'semana'
              : 'parado';
      return {
        uid: c.uid,
        name: c.name,
        photoURL: c.photoURL,
        estado,
        dias,
        debe: c.paymentStatus === 'overdue' || c.paymentStatus === 'pending',
      };
    })
    // Primero quien necesita algo: el que lleva más tiempo parado arriba.
    .sort((a, b) => orden(a) - orden(b) || (b.dias ?? 999) - (a.dias ?? 999));
}

const PESO: Record<EstadoAlumno, number> = { nunca: 0, parado: 1, semana: 2, hoy: 3 };
const orden = (p: PulsoAlumno) => PESO[p.estado];

const ARO: Record<EstadoAlumno, { color: string; ancho: number }> = {
  hoy: { color: colors.primaryBright, ancho: 2.5 },
  semana: { color: colors.primary, ancho: 2 },
  parado: { color: colors.border, ancho: 2 },
  nunca: { color: colors.border, ancho: 1 },
};

export function ClientPulse({
  alumnos,
  onPress,
}: {
  alumnos: PulsoAlumno[];
  onPress: (uid: string) => void;
}) {
  if (alumnos.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.fila}
    >
      {alumnos.map((a) => {
        const aro = ARO[a.estado];
        return (
          <PressableScale key={a.uid} onPress={() => onPress(a.uid)} style={styles.item}>
            <View
              style={[styles.aro, { borderColor: aro.color, borderWidth: aro.ancho }]}
            >
              <Avatar name={a.name} photoURL={a.photoURL} size={52} />
              {a.debe ? <View style={styles.deuda} /> : null}
            </View>
            <Text style={styles.nombre} numberOfLines={1}>
              {a.name.split(' ')[0]}
            </Text>
            <Text style={[styles.dias, a.estado === 'hoy' && styles.diasHoy]}>
              {a.estado === 'hoy'
                ? 'hoy'
                : a.dias == null
                  ? 'nunca'
                  : a.dias === 1
                    ? 'ayer'
                    : `${a.dias} d`}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fila: { gap: spacing.md, paddingVertical: spacing.xs, paddingRight: spacing.md },
  item: { alignItems: 'center', width: 66 },
  aro: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deuda: {
    position: 'absolute',
    right: 1,
    top: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  nombre: {
    ...typography.small,
    color: colors.text,
    fontSize: 12,
    marginTop: spacing.xs,
    maxWidth: 66,
  },
  dias: { fontSize: 10, color: colors.textFaint, fontFamily: fonts.medium },
  diasHoy: { color: colors.primaryBright, fontFamily: fonts.semiBold },
});
