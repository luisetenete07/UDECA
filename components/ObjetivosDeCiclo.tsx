import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from './ProgressBar';
import { nuevoId } from '../lib/ids';
import {
  metaDeTexto,
  ordenados,
  progresoDeObjetivo,
  resumen,
  textoDeObjetivo,
  unidad,
  type MedidaDeObjetivo,
} from '../lib/objetivosDeCiclo';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { ObjetivoDeCiclo, WorkoutLog } from '../lib/types';

/**
 * Lo que se persigue en este ciclo, y cuánto falta.
 *
 * LA MISMA PIEZA PARA LOS DOS LADOS
 *
 * Con `onCambiar` se puede editar —el entrenador desde la ficha del alumno, el
 * atleta desde su propio plan—. Sin él es solo de lectura, que es como lo ve el
 * alumno. Una sola pieza porque lo que se lee tiene que ser LO MISMO que se
 * escribió: dos componentes distintos acaban enseñando cosas distintas.
 *
 * POR QUÉ NO HAY UN PORCENTAJE QUE MOVER A MANO
 *
 * Porque nadie lo mueve. El progreso sale de la mejor marca ya apuntada del
 * ejercicio, así que está al día sin que nadie lo toque; un objetivo que hay
 * que mantener deja de estar mantenido la segunda semana y entonces miente.
 *
 * Y CUANDO SE CONSIGUE
 *
 * Se dice y se queda a la vista, abajo del todo. No se esconde —ver lo que ya
 * has hecho es media gracia de tener objetivos— pero no puede tapar lo que
 * queda. Al entrenador se le avisa de que toca subir el listón, que es la
 * decisión que sigue, y esa la toma una persona y no la app.
 */
export function ObjetivosDeCiclo({
  objetivos,
  logs,
  onCambiar,
  ejerciciosDelPlan,
  paraMi = false,
}: {
  objetivos: ObjetivoDeCiclo[];
  /** El historial del que salen las marcas. */
  logs: WorkoutLog[];
  /** Si viene, se puede editar. Si no, es solo de lectura. */
  onCambiar?: (objetivos: ObjetivoDeCiclo[]) => void;
  /** De dónde se eligen los ejercicios al añadir uno. */
  ejerciciosDelPlan?: { id: string; name: string }[];
  /** Cómo se le habla a quien lo mira. */
  paraMi?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const [elegido, setElegido] = useState<{ id: string; name: string } | null>(null);
  const [meta, setMeta] = useState('');
  const [medida, setMedida] = useState<MedidaDeObjetivo>('reps');

  const lista = useMemo(() => ordenados(objetivos ?? [], logs), [objetivos, logs]);
  const cuenta = resumen(objetivos ?? [], logs);
  const editable = typeof onCambiar === 'function';

  /*
   * Los ejercicios que se ofrecen son los del PLAN, no la biblioteca entera.
   * Un objetivo sobre algo que no se entrena no se va a cumplir nunca, y una
   * lista de doscientos ejercicios convierte añadir uno en una búsqueda.
   */
  const candidatos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const yaPuestos = new Set((objetivos ?? []).map((o) => o.ejercicioId));
    return (ejerciciosDelPlan ?? [])
      .filter((e) => !yaPuestos.has(e.id))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [ejerciciosDelPlan, busca, objetivos]);

  const anadir = () => {
    const n = metaDeTexto(meta);
    if (!elegido || !n || !onCambiar) return;
    onCambiar([
      ...(objetivos ?? []),
      { id: nuevoId(), ejercicioId: elegido.id, nombre: elegido.name, medida, meta: n },
    ]);
    setElegido(null);
    setMeta('');
    setBusca('');
  };

  const quitar = (id: string) => {
    if (!onCambiar) return;
    onCambiar((objetivos ?? []).filter((o) => o.id !== id));
  };

  if (!editable && lista.length === 0) return null;

  return (
    <View>
      <View style={styles.cabecera}>
        <Ionicons name="flag-outline" size={16} color={colors.primary} />
        <Text style={styles.titulo}>Objetivos del ciclo</Text>
        {cuenta.total > 0 ? (
          <Text style={styles.cuenta}>
            {cuenta.hechos}/{cuenta.total}
          </Text>
        ) : null}
      </View>

      {lista.length === 0 ? (
        <Text style={styles.vacio}>
          {paraMi
            ? 'Ponte uno o dos: un ejercicio y un número. La app te dirá cuánto te falta.'
            : 'Ponle uno o dos: un ejercicio y un número. Verá cuánto le falta sin preguntarte.'}
        </Text>
      ) : null}

      {lista.map((o) => {
        const p = progresoDeObjetivo(o, logs);
        return (
          <View key={o.id} style={[styles.fila, p.logrado && styles.filaHecha]}>
            <View style={styles.filaCabecera}>
              {p.logrado ? (
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              ) : null}
              <Text style={styles.nombre} numberOfLines={2}>
                {o.nombre}
              </Text>
              <Text style={styles.metaTexto}>{unidad(o.meta, o.medida)}</Text>
              {editable ? (
                <Pressable onPress={() => quitar(o.id)} hitSlop={10}>
                  <Ionicons name="close" size={16} color={colors.textFaint} />
                </Pressable>
              ) : null}
            </View>
            <ProgressBar progress={p.ratio} height={6} />
            <Text style={[styles.detalle, p.logrado && styles.detalleHecho]}>
              {textoDeObjetivo(p, o.medida)}
            </Text>
            {/* Conseguido: lo siguiente lo decide una persona, no la app. */}
            {p.logrado && editable ? (
              <Text style={styles.subeElListón}>
                {paraMi
                  ? 'Conseguido. Súbete el listón o cámbialo por el siguiente.'
                  : 'Conseguido. Súbele el listón o cámbialo por el siguiente.'}
              </Text>
            ) : null}
          </View>
        );
      })}

      {editable ? (
        <View style={styles.anadir}>
          <TextInput
            style={styles.campo}
            value={elegido ? elegido.name : busca}
            onChangeText={(t) => {
              setElegido(null);
              setBusca(t);
            }}
            placeholder="Ejercicio del plan"
            placeholderTextColor={colors.textFaint}
          />
          {!elegido && candidatos.length > 0 ? (
            <View style={styles.sugerencias}>
              {candidatos.map((e) => (
                <Pressable key={e.id} onPress={() => setElegido(e)} style={styles.sugerencia}>
                  <Text style={styles.sugerenciaTexto} numberOfLines={1}>
                    {e.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.filaMeta}>
            <TextInput
              style={[styles.campo, styles.campoMeta]}
              value={meta}
              onChangeText={setMeta}
              placeholder="Meta"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
            />
            {/* Qué se mide. Sin esto, "20" en una plancha son veinte
                repeticiones imposibles en vez de veinte segundos. */}
            {(['reps', 'seg', 'kg'] as MedidaDeObjetivo[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMedida(m)}
                style={[styles.medida, medida === m && styles.medidaOn]}
              >
                <Text style={[styles.medidaTexto, medida === m && styles.medidaTextoOn]}>
                  {m === 'reps' ? 'reps' : m === 'seg' ? 'seg' : 'kg'}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={anadir}
              disabled={!elegido || !metaDeTexto(meta)}
              style={[styles.boton, (!elegido || !metaDeTexto(meta)) && styles.botonApagado]}
            >
              <Text style={styles.botonTexto}>Añadir</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titulo: { ...typography.h3, color: colors.text, flex: 1, minWidth: 0 },
  cuenta: { ...typography.body, color: colors.primaryBright, fontFamily: fonts.semiBold },
  vacio: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 18 },
  fila: { marginTop: spacing.md, gap: spacing.xs },
  // Conseguido: se atenúa, pero sigue leyéndose. Es media gracia de la función.
  filaHecha: { opacity: 0.7 },
  filaCabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flex: 1, minWidth: 0 },
  metaTexto: { ...typography.small, color: colors.textMuted, flexShrink: 0 },
  detalle: { ...typography.small, color: colors.textMuted },
  detalleHecho: { color: colors.primary },
  subeElListón: { ...typography.small, color: colors.textFaint, fontStyle: 'italic' },
  anadir: { marginTop: spacing.md, gap: spacing.sm },
  campo: {
    ...typography.small,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surfaceAlt,
  },
  sugerencias: { gap: 2 },
  sugerencia: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  sugerenciaTexto: { ...typography.small, color: colors.primary },
  // Cinco cosas en una fila no caben en un móvil estrecho: que bajen en vez de
  // encogerse hasta que la meta se quede sin sitio.
  filaMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  campoMeta: { width: 76, flexGrow: 0, flexShrink: 0 },
  medida: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  medidaOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  medidaTexto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  medidaTextoOn: { color: colors.onPrimary },
  boton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  botonApagado: { opacity: 0.4 },
  botonTexto: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold },
});
