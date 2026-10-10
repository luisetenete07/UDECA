import React, { useMemo, useState } from 'react';
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
import { diaLargo, diaMes, inicioDeLaSemana, inicioDelDia, masDias } from '../lib/fechas';
import { frase, t } from '../lib/idioma';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { CoachTask, TrainingCycle, UserProfile } from '../lib/types';

const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * LA SEMANA, EN EL INICIO DEL ENTRENADOR.
 *
 * El calendario vivía en otra pantalla, detrás de un botón: lo que tocaba hoy
 * —una tarea, un alumno al que se le acaba el coaching, un ciclo que empieza—
 * había que ir a buscarlo, y lo que hay que ir a buscar se olvida. Aquí se ve
 * la semana entera de un vistazo, con un punto por cada cosa que pasa, y el
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
}: {
  clients: UserProfile[];
  cycles: TrainingCycle[];
  tasks: CoachTask[];
  onToggleTask: (t: CoachTask) => void;
  onAddTask: (titulo: string, dia: number) => void;
  onOpen: (ruta: string) => void;
  onVerMes: () => void;
}) {
  const hoy = inicioDelDia(Date.now());
  const [lunes, setLunes] = useState(() => inicioDeLaSemana(hoy));
  const [dia, setDia] = useState(hoy);
  const [nueva, setNueva] = useState('');

  const eventos = useMemo(() => eventosPorDia(clients, cycles, tasks), [clients, cycles, tasks]);
  const dias = Array.from({ length: 7 }, (_, i) => masDias(lunes, i));

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

  const moverSemana = (n: number) => {
    const nuevoLunes = masDias(lunes, 7 * n);
    setLunes(nuevoLunes);
    // El día elegido se queda en la misma columna: hoy si se vuelve a la
    // semana de hoy, el lunes si no.
    setDia(inicioDeLaSemana(hoy) === nuevoLunes ? hoy : nuevoLunes);
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
        <Text style={styles.titulo}>{lunes === inicioDeLaSemana(hoy) ? 'Esta semana' : 'Semana'}</Text>
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

      <View style={styles.tira}>
        {dias.map((d, i) => {
          const tipos = [...new Set((eventos.get(d) ?? []).map((e) => e.type))].slice(0, 3);
          const sel = d === dia;
          const esHoy = d === hoy;
          return (
            <Pressable key={d} onPress={() => setDia(d)} style={styles.celda} hitSlop={2}>
              <Text style={[styles.letra, esHoy && styles.letraHoy]}>{LETRAS[i]}</Text>
              <View style={[styles.num, esHoy && !sel && styles.numHoy, sel && styles.numSel]}>
                <Text style={[styles.numTexto, sel && styles.numTextoSel]}>
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
  tira: { flexDirection: 'row', marginBottom: spacing.sm },
  celda: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  letra: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textFaint, marginBottom: 4 },
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
  puntos: { flexDirection: 'row', gap: 3, height: 5, marginTop: 4 },
  punto: { width: 5, height: 5, borderRadius: 2.5 },
  diaElegido: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    marginTop: spacing.xs,
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
