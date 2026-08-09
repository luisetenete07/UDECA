import { diaMes, inicioDeLaSemana } from '../lib/fechas';
import React, { useCallback, useMemo, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { showToast } from './Toast';
import {
  clearProgressTracker,
  getProgressTracker,
  saveProgressTracker,
} from '../lib/firestore/progressTrackers';
import { weeklyExerciseMatrix, type MatrixCell } from '../lib/stats';
import { moveItem, useDragReorder } from '../lib/useDragReorder';
import { Dialogo } from './Dialogo';
import { fonts, colors, radius, spacing, typography } from '../lib/theme';
import type { WorkoutLog } from '../lib/types';

const NAME_W = 132;
const CELL_W = 74;
const HEADER_H = 46;
const ROW_H = 52;

interface ProgressMatrixProps {
  logs: WorkoutLog[];
  /** Alumno al que pertenece la tabla (id del documento de seguimiento). */
  clientId: string;
  /**
   * Quién manda sobre la selección de ejercicios. En el alumno vinculado a un
   * coach es el uid del coach; en el atleta, su propio uid (es su propio
   * entrenador). Sin esto no se puede guardar y la tabla queda de solo lectura.
   */
  ownerId?: string;
  /**
   * Si puede elegir qué ejercicios se muestran. El entrenador y el atleta sí;
   * el alumno de un coach, no: su tabla la decide quien le entrena.
   */
  editable?: boolean;
  /** Ejercicios del plan activo, para poder añadir los que aún no ha hecho. */
  planExercises?: { id: string; name: string }[];
  /**
   * Avisa de QUÉ se está viendo: cuántas semanas y qué ejercicios, en su orden.
   * Lo usa el informe en PDF para salir exactamente igual que la pantalla.
   */
  onViewChange?: (view: { weeks: number; exerciseIds: string[] }) => void;
}

/**
 * Tabla de progreso por ejercicio: la mejor serie de cada uno, semana a semana.
 *
 * Es la MISMA vista para el entrenador y para quien entrena. Vive aquí y no en
 * una pantalla porque hasta ahora el alumno veía un resumen distinto del de su
 * coach, y hablar del progreso mirando dos tablas diferentes no lleva a ningún
 * sitio. Lo único que cambia entre unos y otros es si se puede editar qué filas
 * salen.
 */
export function ProgressMatrix({
  logs,
  clientId,
  ownerId,
  editable = false,
  planExercises = [],
  onViewChange,
}: ProgressMatrixProps) {
  const [range, setRange] = useState<4 | 8 | 12 | 'total'>(8);
  // Selección guardada de ejercicios. null = todos (comportamiento por defecto).
  const [tracked, setTracked] = useState<string[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  React.useEffect(() => {
    let vivo = true;
    getProgressTracker(clientId)
      .then((ids) => {
        if (vivo) setTracked(ids);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [clientId]);

  // Semanas desde el primer registro, para la opción "Desde el inicio".
  const totalWeeks = useMemo(() => {
    if (logs.length === 0) return 4;
    const earliest = Math.min(...logs.map((l) => l.date));
    const w =
      Math.floor((inicioDeLaSemana(Date.now()) - inicioDeLaSemana(earliest)) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, w);
  }, [logs]);

  const weeks = range === 'total' ? totalWeeks : range;
  const matrixCompleta = useMemo(() => weeklyExerciseMatrix(logs, weeks), [logs, weeks]);

  /**
   * Filas que se pintan. Sin selección, todas. Con selección manda su orden, y
   * un ejercicio elegido que aún no se haya hecho sale igualmente con la fila
   * vacía: saber que NO se está haciendo es tan informativo como ver marcas.
   */
  const matrix = useMemo(() => {
    if (!tracked) return matrixCompleta;
    const porId = new Map(matrixCompleta.rows.map((r) => [r.exerciseId, r]));
    const nombres = new Map(planExercises.map((e) => [e.id, e.name]));
    const rows = tracked
      .map((exId) => {
        const conDatos = porId.get(exId);
        if (conDatos) return conDatos;
        // Sin registros: se muestra la fila vacía SOLO si sabemos cómo se llama
        // (está en el plan). Si no lo sabemos, es un ejercicio que ya no existe
        // y pintarlo como "Ejercicio" con la fila en blanco no informa de nada.
        const name = nombres.get(exId);
        if (!name) return null;
        return {
          exerciseId: exId,
          name,
          measure: 'reps' as const,
          weeksActive: 0,
          cells: matrixCompleta.weekStarts.map(() => null),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    return { weekStarts: matrixCompleta.weekStarts, rows };
  }, [matrixCompleta, tracked, planExercises]);

  /**
   * Avisa a la pantalla de lo que hay en la tabla. Se compara con lo anunciado
   * la última vez —y el callback se guarda en una ref— porque si no, un padre
   * que pase una función anónima entraría en un bucle de repintados.
   */
  const vistaRef = React.useRef('');
  const onViewChangeRef = React.useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  React.useEffect(() => {
    const ids = matrix.rows.map((r) => r.exerciseId);
    const clave = `${weeks}|${ids.join(',')}`;
    if (vistaRef.current === clave) return;
    vistaRef.current = clave;
    onViewChangeRef.current?.({ weeks, exerciseIds: ids });
  }, [weeks, matrix]);

  const seleccionActual = useCallback(
    () => tracked ?? matrixCompleta.rows.map((r) => r.exerciseId),
    [tracked, matrixCompleta]
  );

  const guardar = async (ids: string[]) => {
    if (!ownerId) return;
    setTracked(ids);
    try {
      await saveProgressTracker(ownerId, clientId, ids);
    } catch {
      showToast('No se pudo guardar la selección');
    }
  };
  const quitarEjercicio = (exId: string) =>
    guardar(seleccionActual().filter((x) => x !== exId));
  const anadirEjercicio = (exId: string) => {
    setPickerOpen(false);
    const actual = seleccionActual();
    if (actual.includes(exId)) return;
    guardar([...actual, exId]);
  };
  const restaurarTodos = async () => {
    if (!ownerId) return;
    setTracked(null);
    try {
      await clearProgressTracker(ownerId, clientId);
    } catch {
      showToast('No se pudo restaurar');
    }
  };

  const puedeEditar = editable && Boolean(ownerId);

  /**
   * Reordenar filas arrastrando.
   *
   * La tabla son DOS columnas: los nombres, fijos a la izquierda, y las
   * semanas, que se desplazan en horizontal. Al mover una fila hay que
   * desplazar las dos a la vez o el nombre se separaría de sus datos, así que
   * el mismo gesto alimenta ambas.
   *
   * Al soltar se guarda el orden: si no había selección previa, se parte de lo
   * que la tabla muestra ahora, que es justo lo que el entrenador está viendo.
   */
  const reordenar = (from: number, to: number) => {
    const orden = moveItem(
      matrix.rows.map((r) => r.exerciseId),
      from,
      to
    );
    guardar(orden);
  };
  const drag = useDragReorder(matrix.rows.length, reordenar, puedeEditar);

  /** Estilo de desplazamiento de una fila, igual en las dos columnas. */
  const filaStyle = (index: number) =>
    drag.isDragging(index)
      ? { transform: [{ translateY: drag.pan }], zIndex: 10 }
      : { transform: [{ translateY: drag.shiftFor(index) }] };

  const OPTIONS: { v: 4 | 8 | 12 | 'total'; label: string }[] = [
    { v: 4, label: '4 sem' },
    { v: 8, label: '8 sem' },
    { v: 12, label: '12 sem' },
    { v: 'total', label: 'Desde el inicio' },
  ];

  return (
    <View>
      <View style={styles.weekToggle}>
        {OPTIONS.map((o) => (
          <Pressable
            key={String(o.v)}
            onPress={() => setRange(o.v)}
            style={[styles.weekBtn, range === o.v && styles.weekBtnOn]}
          >
            <Text style={[styles.weekBtnText, range === o.v && styles.weekBtnTextOn]}>
              {o.label}
              {o.v === 'total' ? ` (${totalWeeks})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {matrix.rows.length === 0 ? (
        <Card style={{ marginTop: spacing.md }}>
          <EmptyState
            icon="grid-outline"
            title="Sin datos todavía"
            subtitle="Cuando se registren entrenamientos, aquí aparecerá el progreso por ejercicio."
          />
        </Card>
      ) : (
        <Card style={styles.tableCard}>
          <View style={styles.tableRow}>
            {/* Columna fija: nombres de ejercicio */}
            <View style={styles.nameCol}>
              <View style={[styles.headerCell, styles.nameHeader]}>
                <Text style={styles.headerText}>Ejercicio</Text>
              </View>
              {matrix.rows.map((r, index) => (
                <Animated.View
                  key={r.exerciseId}
                  onLayout={drag.onLayoutFor(index)}
                  {...drag.handlersFor(index)}
                  style={[
                    styles.nameCell,
                    filaStyle(index),
                    drag.isDragging(index) && styles.rowLifted,
                  ]}
                >
                  {/* Asa de arrastre. Se arrastra desde toda la fila, pero sin
                      un icono que lo insinúe el gesto es invisible: aquí no hay
                      nada más que pulsar, así que nadie prueba a mantener el
                      dedo. Es el mismo ≡ que en el resto de la app. */}
                  {puedeEditar ? (
                    <Ionicons
                      name="reorder-three"
                      size={15}
                      color={colors.textFaint}
                      style={styles.rowHandle}
                    />
                  ) : null}
                  <Text
                    style={[styles.nameText, puedeEditar && styles.nameTextEditable]}
                    numberOfLines={2}
                  >
                    {r.name}
                  </Text>
                  {puedeEditar ? (
                    <Pressable
                      onPress={() => quitarEjercicio(r.exerciseId)}
                      hitSlop={8}
                      style={styles.rowRemove}
                    >
                      <Ionicons name="close" size={13} color={colors.textFaint} />
                    </Pressable>
                  ) : null}
                </Animated.View>
              ))}
            </View>

            {/* Columnas de semanas: scroll horizontal */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.headerRow}>
                  {matrix.weekStarts.map((w, i) => (
                    <View key={w} style={styles.headerCell}>
                      <Text
                        style={[
                          styles.weekHeadText,
                          i === matrix.weekStarts.length - 1 && styles.weekHeadNow,
                        ]}
                      >
                        {diaMes(w)}
                      </Text>
                    </View>
                  ))}
                </View>
                {matrix.rows.map((r, index) => (
                  <Animated.View
                    key={r.exerciseId}
                    style={[
                      styles.dataRow,
                      filaStyle(index),
                      drag.isDragging(index) && styles.rowLifted,
                    ]}
                  >
                    {r.cells.map((cell, i) => {
                      const prev = prevFilled(r.cells, i);
                      return (
                        <View key={i} style={styles.dataCell}>
                          {cell ? (
                            <View style={styles.cellInner}>
                              <View style={styles.cellLine}>
                                <Text style={styles.cellValue}>{cell.label}</Text>
                                <Trend current={cell} prev={prev} />
                              </View>
                              {cell.alt ? (
                                <View style={styles.cellLine}>
                                  <Text style={styles.cellAlt}>{cell.alt}</Text>
                                  <View style={styles.markBadge}>
                                    <Ionicons name="star" size={8} color={colors.primary} />
                                    <Text style={styles.markText}>+1</Text>
                                  </View>
                                </View>
                              ) : null}
                            </View>
                          ) : (
                            <Text style={styles.cellEmpty}>·</Text>
                          )}
                        </View>
                      );
                    })}
                  </Animated.View>
                ))}
              </View>
            </ScrollView>
          </View>
        </Card>
      )}

      {/* Elegir qué se sigue. Con meses de historial la tabla acumula filas que
          ya no interesan, y lo que hace útil esta pantalla es mirar pocas cosas
          y las correctas. */}
      {puedeEditar ? (
        <View style={styles.trackBar}>
          <Pressable onPress={() => setPickerOpen(true)} style={styles.trackBtn}>
            <Ionicons name="add-circle-outline" size={15} color={colors.primary} />
            <Text style={styles.trackBtnText}>Añadir ejercicio</Text>
          </Pressable>
          {tracked ? (
            <Pressable onPress={restaurarTodos} style={styles.trackBtn}>
              <Ionicons name="refresh-outline" size={15} color={colors.textMuted} />
              <Text style={[styles.trackBtnText, { color: colors.textMuted }]}>
                Mostrar todos
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Dialogo
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        titulo="Añadir al seguimiento"
        texto="Ejercicios del plan activo."
        cancelar="Cerrar"
      >
            <ScrollView style={{ maxHeight: 320 }}>
              {planExercises.filter((e) => !seleccionActual().includes(e.id)).length === 0 ? (
                <Text style={styles.pickerEmpty}>Ya están todos los del plan.</Text>
              ) : (
                planExercises
                  .filter((e) => !seleccionActual().includes(e.id))
                  .map((e) => (
                    <Pressable
                      key={e.id}
                      onPress={() => anadirEjercicio(e.id)}
                      style={styles.pickerRow}
                    >
                      <Ionicons name="add" size={16} color={colors.primary} />
                      <Text style={styles.pickerRowText}>{e.name}</Text>
                    </Pressable>
                  ))
              )}
            </ScrollView>
      </Dialogo>

      {matrix.rows.length > 0 ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Ionicons name="arrow-up" size={13} color={colors.success} />
            <Text style={styles.legendText}>Mejora</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="arrow-down" size={13} color={colors.danger} />
            <Text style={styles.legendText}>Baja</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="remove" size={13} color={colors.textFaint} />
            <Text style={styles.legendText}>Igual</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.markBadge}>
              <Ionicons name="star" size={8} color={colors.primary} />
              <Text style={styles.markText}>+1</Text>
            </View>
            <Text style={styles.legendText}>Marca: más peso y más reps en series distintas</Text>
          </View>
          <Text style={styles.legendNote}>Serie real: reps · reps×lastre · segundos</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Celda rellena anterior a la posición `i` (para comparar tendencia). */
function prevFilled(cells: (MatrixCell | null)[], i: number): MatrixCell | null {
  for (let k = i - 1; k >= 0; k--) {
    if (cells[k]) return cells[k];
  }
  return null;
}

function Trend({ current, prev }: { current: MatrixCell; prev: MatrixCell | null }) {
  if (!prev) return <View style={styles.trendSpace} />;
  if (current.score > prev.score) {
    return <Ionicons name="arrow-up" size={12} color={colors.success} />;
  }
  if (current.score < prev.score) {
    return <Ionicons name="arrow-down" size={12} color={colors.danger} />;
  }
  return <Ionicons name="remove" size={12} color={colors.textFaint} />;
}

const styles = StyleSheet.create({
  // Centrada como el asa: pegada arriba parecía colgar de la fila de encima.
  rowRemove: { position: 'absolute', right: 4, top: '50%', marginTop: -9, padding: 2 },
  rowHandle: { position: 'absolute', left: 2, top: '50%', marginTop: -8 },
  // Deja sitio al asa para que no se solape con el nombre.
  nameTextEditable: { paddingLeft: spacing.sm },
  // La fila que se arrastra se levanta del resto para que se vea cuál es.
  rowLifted: { backgroundColor: colors.surfaceAlt, opacity: 0.97 },
  trackBar: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  trackBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  picker: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  pickerEmpty: { ...typography.small, color: colors.textFaint, paddingVertical: spacing.md },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerRowText: { ...typography.body, color: colors.text, flex: 1 },
  weekToggle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: 4,
  },
  weekBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  weekBtnOn: { backgroundColor: colors.primary },
  weekBtnText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  weekBtnTextOn: { color: colors.onPrimary },
  tableCard: { padding: 0, overflow: 'hidden' },
  tableRow: { flexDirection: 'row' },
  nameCol: { width: NAME_W, borderRightWidth: 1, borderRightColor: colors.border },
  nameHeader: { alignItems: 'flex-start', paddingLeft: spacing.md },
  headerRow: { flexDirection: 'row' },
  headerCell: {
    width: CELL_W,
    height: HEADER_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  weekHeadText: {
    ...typography.small,
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.medium,
  },
  weekHeadNow: { color: colors.primaryBright, fontFamily: fonts.semiBold },
  nameCell: {
    // Sin esto, arrastrar en el navegador selecciona el texto de las filas y
    // el gesto compite con la selección del sistema.
    userSelect: 'none',
    width: NAME_W,
    height: ROW_H,
    justifyContent: 'center',
    paddingRight: spacing.sm,
    paddingLeft: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nameText: { ...typography.small, color: colors.text, fontFamily: fonts.medium, fontSize: 12 },
  dataRow: { flexDirection: 'row' },
  dataCell: {
    width: CELL_W,
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cellInner: { alignItems: 'center', justifyContent: 'center', gap: 1 },
  cellLine: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cellValue: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, fontSize: 13 },
  cellAlt: { ...typography.small, color: colors.textMuted, fontSize: 11 },
  markBadge: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  markText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, fontSize: 9 },
  cellEmpty: { ...typography.small, color: colors.textFaint },
  trendSpace: { width: 12 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  legendNote: { ...typography.small, color: colors.textFaint, fontSize: 11, marginLeft: 'auto' },
});
