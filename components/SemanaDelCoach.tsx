import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Card } from './Card';
import { PressableScale } from './PressableScale';
import {
  diaDeLaTarea,
  eventosPorDia,
  ICONO_DEL_EVENTO,
  TONO_DEL_EVENTO,
} from '../lib/calendarioCoach';
import { diaLargo, diaMes, inicioDeLaSemana, inicioDelDia, masDias, mesCorto } from '../lib/fechas';
import { frase, t } from '../lib/idioma';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { CoachTask, TrainingCycle, UserProfile } from '../lib/types';
import type { Llamada } from '../lib/llamadas';
import type { LlamadaGrupal } from '../lib/llamadaGrupal';

const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * CUÁNTAS SEMANAS A LA VISTA: de 1 a 4, las elige Luis.
 *
 * Una sola semana se queda corta para ver venir lo de las siguientes —el fin
 * de un coaching el día 3 del mes que viene, una llamada grupal la semana
 * próxima—, y el mes entero ("Ver mes") es otra pantalla. Con esto el inicio
 * enseña lo que él quiera, y se acuerda: lo que eligió es lo que ve al volver.
 */
export const SEMANAS_A_LA_VISTA = [1, 2, 3, 4] as const;
const CLAVE_SEMANAS = 'calico.semanasDelCalendario';

/** Lo guardado, si es una de las opciones; si no, una semana. */
export function semanasValidas(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : v;
  return SEMANAS_A_LA_VISTA.includes(n as 1) ? (n as number) : 1;
}

/**
 * LA SEMANA, EN EL INICIO DEL ENTRENADOR.
 *
 * El calendario vivía en otra pantalla, detrás de un botón: lo que tocaba hoy
 * —una tarea, un alumno al que se le acaba el coaching, un ciclo que empieza—
 * había que ir a buscarlo, y lo que hay que ir a buscar se olvida. Aquí se ven
 * de una a cuatro semanas de un vistazo (las que elija), con un punto por
 * cada cosa que pasa, y el
 * día que se toca se abre debajo: las tareas se tachan desde aquí y se apunta
 * una nueva sin salir del inicio.
 *
 * El mes entero sigue en el calendario de siempre ("Ver mes"), con los mismos
 * eventos (lib/calendarioCoach.ts).
 */
export function SemanaDelCoach({
  clients,
  cycles,
  tasks,
  onToggleTask,
  onAddTask,
  onOpen,
  onVerMes,
  llamadas = [],
  grupales = [],
}: {
  clients: UserProfile[];
  cycles: TrainingCycle[];
  tasks: CoachTask[];
  /** Las llamadas 1:1 reservadas (lib/llamadas.ts). */
  llamadas?: Llamada[];
  /** Las llamadas grupales que ha programado (lib/llamadaGrupal.ts). */
  grupales?: LlamadaGrupal[];
  onToggleTask: (t: CoachTask) => void;
  onAddTask: (titulo: string, dia: number) => void;
  onOpen: (ruta: string) => void;
  onVerMes: () => void;
}) {
  const hoy = inicioDelDia(Date.now());
  const [lunes, setLunes] = useState(() => inicioDeLaSemana(hoy));
  const [dia, setDia] = useState(hoy);
  const [nueva, setNueva] = useState('');
  const [semanas, setSemanas] = useState(1);

  // Lo que eligió la última vez. Sin nada guardado (o sin poder leerlo), una.
  useEffect(() => {
    AsyncStorage.getItem(CLAVE_SEMANAS)
      .then((v) => setSemanas(semanasValidas(v)))
      .catch(() => {});
  }, []);

  /** El día elegido, si sigue a la vista; si no, hoy o el primero que se vea. */
  const diaAVista = (desde: number, n: number, preferido: number) => {
    const fin = masDias(desde, 7 * n);
    if (preferido >= desde && preferido < fin) return preferido;
    return hoy >= desde && hoy < fin ? hoy : desde;
  };

  const elegirSemanas = (n: number) => {
    setSemanas(n);
    setDia((d) => diaAVista(lunes, n, d));
    AsyncStorage.setItem(CLAVE_SEMANAS, String(n)).catch(() => {});
  };

  const eventos = useMemo(
    () => eventosPorDia(clients, cycles, tasks, Date.now(), llamadas, grupales),
    [clients, cycles, tasks, llamadas, grupales]
  );
  const filas = Array.from({ length: semanas }, (_, f) =>
    Array.from({ length: 7 }, (_, i) => masDias(lunes, f * 7 + i))
  );
  const esLaDeHoy = lunes === inicioDeLaSemana(hoy);
  const titulo =
    semanas === 1
      ? esLaDeHoy
        ? t('Esta semana')
        : t('Semana')
      : // Corto a propósito: en el móvil comparte fila con las flechas y "Ver
        // mes", y "Próximas 4 semanas" se cortaba con puntos suspensivos.
        frase`${semanas} semanas`;

  const delDia = eventos.get(dia) ?? [];
  /*
   * Las tareas del día, sin terminar y también las tachadas hoy: verlas
   * desaparecer al tocarlas, sin saber si se ha guardado, da desconfianza.
   *
   * Y HOY ARRASTRA LAS ATRASADAS: una tarea de ayer sin hacer no se queda
   * escondida en ayer, sale hoy con su fecha al lado. Si no, bastaría con no
   * mirar la semana pasada para olvidarla.
   */
  const atrasada = (x: CoachTask) => !x.done && diaDeLaTarea(x) < hoy;
  const tareas = tasks
    .filter(
      (x) =>
        x.scope === 'day' &&
        (diaDeLaTarea(x) === dia || (dia === hoy && atrasada(x))) &&
        (!x.done || (x.doneAt ?? 0) >= hoy)
    )
    .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.flagged ?? false) - Number(a.flagged ?? false));
  const otros = delDia.filter((e) => e.type !== 'task');

  // Las flechas pasan tantas semanas como se ven: con cuatro a la vista,
  // avanzar de una en una sería ver tres veces lo mismo.
  const moverSemana = (n: number) => {
    const nuevoLunes = masDias(lunes, 7 * n * semanas);
    setLunes(nuevoLunes);
    // Hoy si vuelve a estar a la vista; si no, el primer día.
    setDia(diaAVista(nuevoLunes, semanas, -1));
  };

  const apuntar = () => {
    const titulo = nueva.trim();
    if (!titulo) return;
    onAddTask(titulo, dia);
    setNueva('');
  };

  return (
    <Card style={styles.card}>
      <View style={styles.cabecera}>
        <Ionicons name="calendar-outline" size={16} color={colors.primary} />
        <Text style={styles.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        <Pressable onPress={() => moverSemana(-1)} hitSlop={8} style={styles.flecha}>
          <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => moverSemana(1)} hitSlop={8} style={styles.flecha}>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={onVerMes} hitSlop={8}>
          <Text style={styles.verMes}>Ver mes</Text>
        </Pressable>
      </View>

      {/* Cuántas semanas a la vista: 1, 2, 3 o 4. */}
      <View style={styles.selector} accessibilityRole="radiogroup">
        {SEMANAS_A_LA_VISTA.map((n) => {
          const activo = n === semanas;
          return (
            <Pressable
              key={n}
              onPress={() => elegirSemanas(n)}
              style={[styles.opcion, activo && styles.opcionActiva]}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={n === 1 ? t('1 semana') : frase`${n} semanas`}
            >
              <Text style={[styles.opcionTexto, activo && styles.opcionTextoActiva]}>
                {n === 1 ? t('1 sem') : frase`${n} sem`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tira}>
        {LETRAS.map((l, i) => (
          <View key={l} style={styles.celda}>
            <Text style={[styles.letra, filas[0][i] === hoy && styles.letraHoy]}>{l}</Text>
          </View>
        ))}
      </View>
      {filas.map((fila, f) => {
        // Cuando empieza un mes dentro de lo que se ve, su nombre encima del 1:
        // con cuatro semanas, sin eso no se sabe de qué mes es cada número.
        const unoDeMes = fila.findIndex((d) => new Date(d).getDate() === 1);
        return (
          <View key={fila[0]}>
            {unoDeMes >= 0 && (f > 0 || semanas > 1) ? (
              <View style={styles.tira}>
                {fila.map((d, i) => (
                  <View key={d} style={styles.celda}>
                    <Text style={styles.mes}>{i === unoDeMes ? mesCorto(d) : ''}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.tira}>
              {fila.map((d) => {
                const tipos = [...new Set((eventos.get(d) ?? []).map((e) => e.type))].slice(0, 3);
                const sel = d === dia;
                const esHoy = d === hoy;
                return (
                  <Pressable key={d} onPress={() => setDia(d)} style={styles.celda} hitSlop={2}>
                    <View style={[styles.num, esHoy && !sel && styles.numHoy, sel && styles.numSel]}>
                      <Text style={[styles.numTexto, sel && styles.numTextoSel, d < hoy && !sel && styles.numPasado]}>
                        {new Date(d).getDate()}
                      </Text>
                    </View>
                    <View style={styles.puntos}>
                      {tipos.map((tp) => (
                        <View key={tp} style={[styles.punto, { backgroundColor: TONO_DEL_EVENTO[tp] }]} />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      <Text style={styles.diaElegido}>
        {dia === hoy ? `${t('Hoy')} · ${diaLargo(dia)}` : diaLargo(dia)}
      </Text>

      {tareas.length === 0 && otros.length === 0 ? (
        <Text style={styles.vacio}>Nada para este día.</Text>
      ) : null}

      {tareas.map((x) => (
        <PressableScale key={x.id} haptic style={styles.fila} onPress={() => onToggleTask(x)}>
          <View style={[styles.check, x.done && styles.checkHecho]}>
            {x.done ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
          </View>
          {/* Dos líneas: el título lo escribe el entrenador y suele ser una
              frase entera, y lo que queda cortado es justo el final. */}
          <View style={{ flex: 1 }}>
            <Text style={[styles.filaTexto, x.done && styles.filaHecha]} numberOfLines={2}>
              {x.title}
            </Text>
            {dia === hoy && atrasada(x) ? (
              <Text style={styles.atrasada}>{frase`Del ${diaMes(diaDeLaTarea(x))}`}</Text>
            ) : null}
          </View>
          {x.flagged ? <Ionicons name="flag" size={13} color={colors.primary} /> : null}
        </PressableScale>
      ))}

      {otros.map((e, i) => (
        <Pressable
          key={`${e.type}-${i}`}
          style={styles.fila}
          onPress={() => (e.ruta ? onOpen(e.ruta) : undefined)}
        >
          <Ionicons name={ICONO_DEL_EVENTO[e.type]} size={16} color={TONO_DEL_EVENTO[e.type]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.filaTexto} numberOfLines={1}>
              {e.title}
            </Text>
            {e.subtitle ? <Text style={styles.filaSub}>{e.subtitle}</Text> : null}
          </View>
          {e.ruta ? <Ionicons name="chevron-forward" size={15} color={colors.textFaint} /> : null}
        </Pressable>
      ))}

      {/* Apuntar algo para el día elegido, sin salir del inicio. */}
      <View style={styles.apuntar}>
        <TextInput
          value={nueva}
          onChangeText={setNueva}
          onSubmitEditing={apuntar}
          returnKeyType="done"
          placeholder={dia === hoy ? t('Apuntar algo para hoy') : t('Apuntar algo para este día')}
          placeholderTextColor={colors.textFaint}
          style={styles.apuntarCampo}
        />
        <Pressable
          onPress={apuntar}
          disabled={!nueva.trim()}
          style={[styles.apuntarBtn, !nueva.trim() && { opacity: 0.4 }]}
          hitSlop={6}
        >
          <Ionicons name="add" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  titulo: { ...typography.h3, color: colors.text, flex: 1, marginLeft: 2 },
  flecha: { paddingHorizontal: 4 },
  verMes: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, marginLeft: spacing.xs },
  selector: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  opcion: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  opcionActiva: { backgroundColor: colors.primary, borderColor: colors.primary },
  opcionTexto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  opcionTextoActiva: { color: colors.onPrimary },
  tira: { flexDirection: 'row', marginBottom: 2 },
  celda: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  letra: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textFaint, marginBottom: 2 },
  mes: { fontSize: 10, fontFamily: fonts.semiBold, color: colors.primary, textTransform: 'uppercase', height: 13 },
  letraHoy: { color: colors.primary },
  num: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  numHoy: { borderColor: colors.primary },
  numSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  numTexto: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  numTextoSel: { color: colors.onPrimary },
  numPasado: { color: colors.textFaint },
  puntos: { flexDirection: 'row', gap: 3, height: 5, marginTop: 4 },
  punto: { width: 5, height: 5, borderRadius: 2.5 },
  diaElegido: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  vacio: { ...typography.small, color: colors.textFaint, marginBottom: spacing.xs },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  check: {
    width: 19,
    height: 19,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkHecho: { backgroundColor: colors.success, borderColor: colors.success },
  filaTexto: { ...typography.body, color: colors.text, flex: 1 },
  filaHecha: { color: colors.textFaint, textDecorationLine: 'line-through' },
  filaSub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  atrasada: { ...typography.small, color: colors.warning, marginTop: 1 },
  apuntar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  apuntarCampo: {
    flex: 1,
    // Sin esto, en la web el campo no encoge por debajo de su ancho propio y
    // empujaba el botón "+" fuera de la tarjeta.
    minWidth: 0,
    minHeight: 42,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  apuntarBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
