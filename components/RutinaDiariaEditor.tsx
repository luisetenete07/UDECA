import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { showToast } from './Toast';
import { getRutinaDiaria, setRutinaDiaria } from '../lib/firestore/rutinaDiaria';
import { nuevoId } from '../lib/ids';
import { NOMBRE_POR_DEFECTO } from '../lib/rutinaDiaria';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { EjercicioDiario } from '../lib/types';

/**
 * Lo que este alumno hace TODOS los días, aparte de su plan.
 *
 * QUÉ ES
 *
 * El pino, la movilidad de cadera, los estiramientos. Cosas cortas que no son
 * "el entreno del martes" sino algo que se repite a diario y que, justo por
 * repetirse, es lo que más cambia a alguien en seis meses.
 *
 * POR QUÉ ES UNA LISTA Y NO UN PLAN
 *
 * Aquí no hay series, descansos ni progresión: hay un nombre y un objetivo en
 * una línea ("3 series de 30 s", "2 min por lado"). Con los campos del editor
 * de rutinas —series, repeticiones, descanso, medida— poner "movilidad de
 * cadera, un par de minutos" obliga a inventarse números que nadie va a
 * cumplir ni mirar.
 *
 * Y por eso el objetivo es TEXTO LIBRE: cabe un aguante, unos minutos o "hasta
 * que deje de tirar", que es como se explican de verdad estas cosas.
 *
 * SE APAGA SIN PERDER NADA
 *
 * El interruptor deja de enseñársela al alumno pero no borra los ejercicios:
 * una rutina diaria se quita en una semana de mucha carga y se vuelve a poner
 * después, y volver a escribirla entera cada vez es lo que hace que no se
 * vuelva a poner.
 */
export function RutinaDiariaEditor({
  trainerId,
  clientId,
  /** Cómo se llama a esta persona en los textos. */
  paraMi = false,
}: {
  trainerId: string;
  clientId: string;
  paraMi?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [activa, setActiva] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ejercicios, setEjercicios] = useState<EjercicioDiario[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoObjetivo, setNuevoObjetivo] = useState('');

  useEffect(() => {
    let vivo = true;
    getRutinaDiaria(clientId)
      .then((r) => {
        if (!vivo) return;
        if (r) {
          setActiva(r.activa);
          setNombre(r.nombre ?? '');
          setEjercicios(r.ejercicios ?? []);
          // Si ya tiene una puesta, se abre: es lo que se viene a mirar.
          setAbierto(r.activa && r.ejercicios.length > 0);
        }
        setCargando(false);
      })
      .catch(() => setCargando(false));
    return () => {
      vivo = false;
    };
  }, [clientId]);

  /**
   * Guarda entero, siempre.
   *
   * Se guarda en cada cambio y no con un botón de "Guardar": esto es una lista
   * de cuatro cosas, y un botón aparte solo sirve para que un día se salga de
   * la pantalla sin pulsarlo y se pierda lo escrito.
   */
  const guardar = async (
    cambios: Partial<{ activa: boolean; nombre: string; ejercicios: EjercicioDiario[] }>
  ) => {
    const siguiente = {
      activa: cambios.activa ?? activa,
      nombre: cambios.nombre ?? nombre,
      ejercicios: cambios.ejercicios ?? ejercicios,
    };
    try {
      await setRutinaDiaria({
        trainerId,
        clientId,
        activa: siguiente.activa,
        nombre: siguiente.nombre.trim() || NOMBRE_POR_DEFECTO,
        ejercicios: siguiente.ejercicios,
      });
    } catch {
      showToast('No se ha podido guardar');
    }
  };

  const anadir = () => {
    const n = nuevoNombre.trim();
    if (!n) return;
    const lista = [
      ...ejercicios,
      { id: nuevoId(), nombre: n, objetivo: nuevoObjetivo.trim() },
    ];
    setEjercicios(lista);
    setNuevoNombre('');
    setNuevoObjetivo('');
    // El primero que se añade la enciende: nadie escribe una lista para dejarla
    // apagada, y obligar a buscar el interruptor después es un paso de más.
    const encender = !activa && lista.length === 1;
    if (encender) setActiva(true);
    void guardar({ ejercicios: lista, activa: encender ? true : activa });
  };

  const quitar = (id: string) => {
    const lista = ejercicios.filter((e) => e.id !== id);
    setEjercicios(lista);
    void guardar({ ejercicios: lista });
  };

  const alternar = () => {
    const v = !activa;
    setActiva(v);
    void guardar({ activa: v });
  };

  if (cargando) return null;

  const resumen = !activa
    ? 'apagada'
    : ejercicios.length === 0
      ? 'sin ejercicios'
      : `${ejercicios.length} ${ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}`;

  return (
    <Card style={styles.tarjeta}>
      <Pressable style={styles.cabecera} onPress={() => setAbierto((v) => !v)} hitSlop={6}>
        <Ionicons name="repeat-outline" size={16} color={colors.primary} />
        <Text style={styles.titulo}>Rutina diaria</Text>
        <Text style={styles.pista}>{resumen}</Text>
        <Ionicons
          name={abierto ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textFaint}
        />
      </Pressable>

      {abierto ? (
        <>
          <Text style={styles.explica}>
            {paraMi
              ? 'Lo que harás todos los días aparte de tu plan: pino, movilidad, lo que se repite. Corto y a diario.'
              : 'Lo que hará todos los días aparte de su plan: pino, movilidad, lo que se repite. Corto y a diario.'}
          </Text>

          <Pressable style={styles.interruptor} onPress={alternar} hitSlop={6}>
            <View style={[styles.casilla, activa && styles.casillaOn]}>
              {activa ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
            </View>
            <Text style={styles.interruptorTexto}>
              {activa
                ? paraMi
                  ? 'Activa: la ves en tu Entreno'
                  : 'Activa: la ve en su Entreno'
                : 'Apagada. Los ejercicios se guardan igual.'}
            </Text>
          </Pressable>

          <TextInput
            style={styles.campoNombre}
            value={nombre}
            onChangeText={setNombre}
            onBlur={() => guardar({ nombre })}
            placeholder={NOMBRE_POR_DEFECTO}
            placeholderTextColor={colors.textFaint}
          />

          {ejercicios.map((e) => (
            <View key={e.id} style={styles.fila}>
              <View style={{ flex: 1 }}>
                <Text style={styles.filaNombre}>{e.nombre}</Text>
                {e.objetivo ? <Text style={styles.filaObjetivo}>{e.objetivo}</Text> : null}
              </View>
              <Pressable onPress={() => quitar(e.id)} hitSlop={10}>
                <Ionicons name="close" size={16} color={colors.textFaint} />
              </Pressable>
            </View>
          ))}

          <View style={styles.anadir}>
            <TextInput
              style={styles.campoEjercicio}
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
              placeholder="Ejercicio (p. ej. Pino contra pared)"
              placeholderTextColor={colors.textFaint}
              returnKeyType="next"
            />
            <View style={styles.filaObjetivoNuevo}>
              <TextInput
                style={[styles.campoEjercicio, { flex: 1 }]}
                value={nuevoObjetivo}
                onChangeText={setNuevoObjetivo}
                placeholder="Objetivo (p. ej. 3 series de 30 s)"
                placeholderTextColor={colors.textFaint}
                onSubmitEditing={anadir}
                returnKeyType="done"
              />
              <Pressable
                onPress={anadir}
                style={[styles.botonAnadir, !nuevoNombre.trim() && styles.botonApagado]}
                disabled={!nuevoNombre.trim()}
              >
                <Text style={styles.botonAnadirTexto}>Añadir</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titulo: { ...typography.h3, color: colors.text, flexShrink: 1, flexGrow: 1 },
  pista: { ...typography.small, color: colors.textFaint, flexShrink: 0 },
  explica: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  interruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  interruptorTexto: { ...typography.small, color: colors.text, flex: 1 },
  campoNombre: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filaNombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  filaObjetivo: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  anadir: { marginTop: spacing.md, gap: spacing.sm },
  campoEjercicio: {
    ...typography.small,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surfaceAlt,
  },
  filaObjetivoNuevo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  botonAnadir: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  botonApagado: { opacity: 0.4 },
  botonAnadirTexto: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold },
});
