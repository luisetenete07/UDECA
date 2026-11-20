import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { textoDeDescanso } from '../lib/combinarRutinas';
import { frase, t } from '../lib/idioma';
import { bloqueDe, esSuperserie, type Bloque } from '../lib/superserie';
import { cuantoDe } from '../lib/emom';
import { getRest, startRest, useActiveRest } from '../lib/restTimerStore';
import {
  clusterBlocks,
  GRIP_LABEL,
  isHoldMeasure,
  resolveLoad,
  type ExerciseMeasure,
  type RoutineDay,
  type RoutineExercise,
} from '../lib/types';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/** A partir de este ancho cabe la tabla clásica: el nombre a la izquierda y los números en columnas. */
const ANCHO_DE_TABLA = 560;

/**
 * EL ENTRENO EN TABLA: lo que el alumno mira con el móvil apoyado en el suelo,
 * entre serie y serie. Tiene que leerse de un vistazo y a un metro.
 *
 * Una fila por ejercicio y cada dato siempre en el mismo sitio: series,
 * repeticiones (o tiempo), descanso y, si el entrenador lo enseña, el objetivo
 * (RIR, o la variable del plan). Debajo del nombre, lo que no cabe en una
 * columna: lastre o goma, agarre, clúster, objetivo y las notas del entrenador.
 *
 * DOS FORMAS, SEGÚN EL SITIO
 *
 *  - En el móvil, una tarjeta por ejercicio: el nombre a todo lo ancho y,
 *    debajo, una franja con los números grandes, cada uno con su rótulo. Antes
 *    era la tabla del ordenador encogida: cuatro columnas de números dejaban al
 *    nombre y a las notas una tira de 100 px, y una nota de dos líneas se
 *    convertía en una columna de diez.
 *  - En una pantalla ancha, la tabla clásica, con su cabecera una sola vez.
 *
 * Las superseries van juntas en un mismo bloque, con su letra (A1, A2), una
 * raya dorada a la izquierda y una línea que dice cómo se encadenan. Dentro del
 * bloque, en vez del descanso se ve el cambio al siguiente; el descanso, al
 * final del bloque.
 *
 * EL DESCANSO ES UN BOTÓN (`conCuentaAtras`): el que puso el entrenador en ese
 * ejercicio, de un toque, sin elegir nada. La cuenta atrás es la de siempre
 * (lib/restTimerStore.ts): flota abajo, sigue al cambiar de pantalla y suena
 * al acabar. En un día EMOM o de grease the groove no hay descanso
 * (`sinDescansos`): allí lo marca el reloj del EMOM o el propio día.
 */
export function TablaDeEntreno({
  day,
  medidaDe,
  objetivoDe,
  videoDe,
  onVideo,
  conCuentaAtras = false,
  sinDescansos = false,
}: {
  day: RoutineDay;
  /** La medida de cada ejercicio (si no la trae el plan, la de la biblioteca). */
  medidaDe: (ex: RoutineExercise) => ExerciseMeasure | undefined;
  /** "RIR 1", "RPE 8"… o null si no se enseña o no lleva. */
  objetivoDe: (ex: RoutineExercise) => string | null;
  /** El vídeo de técnica de cada ejercicio, si el entrenador lo puso. */
  videoDe?: (ex: RoutineExercise) => string | undefined;
  /** Abrir ese vídeo (a pantalla completa, components/VisorDeVideo). */
  onVideo?: (url: string, titulo: string) => void;
  /** Tocar el descanso de un ejercicio lanza su cuenta atrás. */
  conCuentaAtras?: boolean;
  /** Sin la columna de descanso: un día EMOM o de grease the groove. */
  sinDescansos?: boolean;
}) {
  const ejercicios = day.exercises;
  const conObjetivo = ejercicios.some((ex) => !!objetivoDe(ex));
  const conDescanso = !sinDescansos;
  const [ancho, setAncho] = useState(0);
  const enTabla = ancho >= ANCHO_DE_TABLA;
  // En un móvil muy estrecho (320 px) el reloj del botón no cabe junto a "2:00".
  const estrecho = ancho > 0 && ancho < 300;
  // Qué descanso corre y de qué fila salió: ese botón se ve encendido.
  const enCurso = useActiveRest();
  const [lanzado, setLanzado] = useState<{ rest: number; fila: number } | null>(null);
  const filaEnCurso = enCurso && lanzado?.rest === enCurso.id ? lanzado.fila : -1;
  const hayDescansos = conCuentaAtras && conDescanso && ejercicios.some((ex) => (ex.restSeconds ?? 0) > 0);

  const descansar = (segundos: number, fila: number, nombre: string) => {
    startRest(segundos, frase`Después de ${nombre}`);
    const r = getRest();
    if (r) setLanzado({ rest: r.id, fila });
  };

  // Los bloques de la sesión: un ejercicio suelto, o los de una superserie.
  const bloques: Bloque[] = [];
  for (let k = 0; k < ejercicios.length; k = bloques[bloques.length - 1].fin + 1) {
    bloques.push(bloqueDe(ejercicios, k));
  }

  const fila = (ex: RoutineExercise, i: number) => {
    const b = bloqueDe(ejercicios, i);
    const enSuperserie = esSuperserie(b);
    const letra = enSuperserie ? `${String.fromCharCode(65 + bloqueIndice(ejercicios, i))}${i - b.inicio + 1}` : null;
    const medida = medidaDe(ex);
    const carga = resolveLoad(ex);
    // En una superserie el descanso va al final del bloque: en los demás
    // ejercicios del bloque se dice cómo se pasa al siguiente.
    const ultimoDelBloque = !enSuperserie || i === b.fin;
    const segundosDeDescanso = ultimoDelBloque ? ex.restSeconds ?? 0 : 0;
    const cambio = ejercicios[i + 1]?.transicionSegundos ?? 0;
    const datos: Dato[] = [
      { rotulo: t('Series'), valor: String(ex.sets || 1) },
      { rotulo: isHoldMeasure(medida) ? t('Tiempo') : t('Reps'), valor: cifra(ex, medida) },
    ];
    if (conDescanso) {
      datos.push(
        ultimoDelBloque
          ? { rotulo: t('Descanso'), valor: ex.restSeconds ? textoCorto(ex.restSeconds) : '—', descanso: true, columnaDeDescanso: true }
          : { rotulo: t('Cambio'), valor: cambio ? textoCorto(cambio) : '0 s', columnaDeDescanso: true }
      );
    }
    // En un móvil de 320 px "OBJETIVO" no cabe en su columna: abreviado.
    if (conObjetivo) datos.push({ rotulo: estrecho ? t('Obj.') : t('Objetivo'), valor: objetivoDe(ex) ?? '—' });

    const detalle = [
      carga === 'weighted' ? t('Lastrado') : carga === 'assisted' ? t('Con goma') : null,
      ex.grip ? frase`Agarre ${GRIP_LABEL[ex.grip].toLowerCase()}` : null,
      // El clúster cambia cómo se hace cada serie: tiene que verse.
      ex.cluster
        ? frase`En clúster: ${clusterBlocks(ex.cluster)} bloques, ${ex.cluster.restSeconds} s entre bloques`
        : null,
      ex.goal ? frase`Objetivo: ${ex.goal}` : null,
    ].filter((x): x is string => !!x);
    const video = videoDe?.(ex)?.trim();

    // El descanso, como botón cuando se puede lanzar; si no, la cifra tal cual.
    const celdaDeDescanso = (d: Dato) =>
      conCuentaAtras && segundosDeDescanso > 0 ? (
        <Pressable
          onPress={() => descansar(segundosDeDescanso, i, ex.name)}
          style={({ pressed }) => [
            styles.boton,
            filaEnCurso === i && styles.botonEnCurso,
            pressed && styles.botonPulsado,
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={frase`Empezar el descanso de ${ex.name}: ${textoDeDescanso(segundosDeDescanso)}`}
        >
          {estrecho ? null : (
            <Ionicons
              name={filaEnCurso === i ? 'hourglass' : 'timer-outline'}
              size={enTabla ? 15 : 16}
              color={filaEnCurso === i ? colors.onPrimary : colors.primaryBright}
            />
          )}
          <Text style={[styles.botonTexto, filaEnCurso === i && styles.botonTextoEnCurso]}>{d.valor}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.valor, enTabla && styles.valorEnTabla]} numberOfLines={2}>
          {d.valor}
        </Text>
      );

    const cabeza = (
      <View style={styles.cabeza}>
        {letra ? (
          <View style={styles.letra}>
            <Text style={styles.letraTexto}>{letra}</Text>
          </View>
        ) : null}
        <Text style={[styles.nombre, enTabla && styles.nombreEnTabla]}>{ex.name}</Text>
        {/* La técnica, junto a su ejercicio: es lo que se mira justo antes de
            hacerlo. Arriba a la derecha, donde el pulgar llega sin buscarla. */}
        {video && onVideo && !enTabla ? (
          <BotonDeTecnica onPress={() => onVideo(video, ex.name)} nombre={ex.name} />
        ) : null}
      </View>
    );

    const extras =
      detalle.length > 0 || ex.notes || (enTabla && video && onVideo) ? (
        <View style={styles.extras}>
          {detalle.length > 0 ? (
            <View style={styles.etiquetas}>
              {detalle.map((d) => (
                <View key={d} style={styles.etiqueta}>
                  <Text style={styles.etiquetaTexto}>{d}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {ex.notes ? (
            <View style={styles.notaFila}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} style={styles.notaIcono} />
              <Text style={styles.nota}>{ex.notes}</Text>
            </View>
          ) : null}
          {enTabla && video && onVideo ? (
            <BotonDeTecnica onPress={() => onVideo(video, ex.name)} nombre={ex.name} />
          ) : null}
        </View>
      ) : null;

    if (enTabla) {
      return (
        <View key={ex.id ?? i} style={[styles.filaTabla, i > b.inicio && styles.filaSeguida]}>
          <View style={styles.colNombre}>
            {cabeza}
            {extras}
          </View>
          {datos.map((d) => (
            <View key={d.rotulo} style={[styles.colDato, d.columnaDeDescanso && styles.colDescanso]}>
              {d.descanso ? celdaDeDescanso(d) : (
                <Text style={[styles.valor, styles.valorEnTabla]} numberOfLines={2}>
                  {d.valor}
                </Text>
              )}
            </View>
          ))}
        </View>
      );
    }

    return (
      <View key={ex.id ?? i} style={[styles.ejercicio, estrecho && styles.ejercicioEstrecho, i > b.inicio && styles.filaSeguida]}>
        {cabeza}
        {/* Los números, grandes y con su rótulo encima: se leen sin buscar la
            cabecera, que en el móvil se queda arriba del todo al desplazar. */}
        <View style={styles.franja}>
          {datos.map((d, k) => (
            <View
              key={d.rotulo}
              style={[styles.dato, d.columnaDeDescanso && styles.datoDescanso, k > 0 && styles.datoSeparado]}
            >
              <Text style={styles.rotulo} numberOfLines={1}>
                {d.rotulo}
              </Text>
              {d.descanso ? celdaDeDescanso(d) : (
                <Text style={[styles.valor, estrecho && styles.valorEstrecho]} numberOfLines={estrecho ? 1 : 2}>
                  {d.valor}
                </Text>
              )}
            </View>
          ))}
        </View>
        {extras}
      </View>
    );
  };

  return (
    <View
      onLayout={(e) => setAncho(Math.round(e.nativeEvent.layout.width))}
      style={enTabla ? styles.tabla : styles.lista}
    >
      {/* En la tabla, la cabecera: lo mismo en todas las filas, una sola vez. */}
      {enTabla ? (
        <View style={styles.cabecera}>
          <Text style={[styles.cab, styles.colNombre]}>Ejercicio</Text>
          <Text style={[styles.cab, styles.colDato]}>Series</Text>
          <Text style={[styles.cab, styles.colDato]}>Reps</Text>
          {conDescanso ? <Text style={[styles.cab, styles.colDato, styles.colDescanso]}>Descanso</Text> : null}
          {conObjetivo ? <Text style={[styles.cab, styles.colDato]}>Objetivo</Text> : null}
        </View>
      ) : null}

      {bloques.map((b) => {
        const enSuperserie = esSuperserie(b);
        const transicion = ejercicios[b.inicio + 1]?.transicionSegundos;
        return (
          <View
            key={ejercicios[b.inicio].id ?? b.inicio}
            style={enTabla ? styles.bloqueTabla : styles.bloque}
          >
            {/* La raya dorada de la superserie, encima del borde: como borde
                empujaba 3 px todo el bloque y las columnas no casaban. */}
            {enSuperserie ? <View style={styles.filaEnlazada} pointerEvents="none" /> : null}
            {enSuperserie ? (
              <View style={styles.superserie}>
                <Ionicons name="link" size={13} color={colors.primaryBright} />
                <Text style={styles.superserieTexto}>
                  {transicion
                    ? frase`Superserie · ${textoDeDescanso(transicion)} para cambiar`
                    : 'Superserie · sin descanso entre ellos'}
                </Text>
              </View>
            ) : null}
            {ejercicios.slice(b.inicio, b.fin + 1).map((ex, j) => fila(ex, b.inicio + j))}
          </View>
        );
      })}

      {hayDescansos ? (
        <View style={[styles.pie, enTabla && styles.pieEnTabla]}>
          <Ionicons name="timer-outline" size={14} color={colors.textMuted} />
          <Text style={styles.pieTexto}>Toca el descanso de un ejercicio y empieza la cuenta atrás.</Text>
        </View>
      ) : null}
    </View>
  );
}

interface Dato {
  rotulo: string;
  valor: string;
  /** La celda del descanso: botón de cuenta atrás si se puede. */
  descanso?: boolean;
  /**
   * La tercera columna, sea el descanso o el cambio dentro de una superserie.
   * Es más ancha (cabe el botón con su reloj) y tiene que serlo en todas las
   * filas: si no, las cifras de una superserie se descolocaban respecto a las
   * de los demás ejercicios.
   */
  columnaDeDescanso?: boolean;
}

function BotonDeTecnica({ onPress, nombre }: { onPress: () => void; nombre: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tecnica, pressed && styles.botonPulsado]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={frase`Técnica de ${nombre}`}
    >
      <Ionicons name="play" size={12} color={colors.onPrimary} />
      <Text style={styles.tecnicaTexto}>Técnica</Text>
    </Pressable>
  );
}

/**
 * Lo que se hace en cada serie: "8", "30 s", "8 + 8", "5 + 10 s" (un combo:
 * repeticiones y aguante).
 */
function cifra(ex: RoutineExercise, medida: ExerciseMeasure | undefined): string {
  return cuantoDe(ex, medida).replace(/ reps/g, '') || '—';
}

/** El número de bloque (A, B, C…) de cada superserie, contando solo superseries. */
function bloqueIndice(ejercicios: RoutineExercise[], i: number): number {
  let n = 0;
  let k = 0;
  while (k < ejercicios.length) {
    const b = bloqueDe(ejercicios, k);
    if (k <= i && i <= b.fin) return n;
    if (esSuperserie(b)) n++;
    k = b.fin + 1;
  }
  return n;
}

/** 90 → "1:30", 45 → "45 s". */
function textoCorto(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  /* ---- En el móvil: una tarjeta por ejercicio (o por superserie) ---- */
  lista: { gap: spacing.sm + 2, marginBottom: spacing.md },
  bloque: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  ejercicio: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md },
  ejercicioEstrecho: { paddingHorizontal: spacing.sm + 4 },
  // Dentro de una superserie, el segundo ejercicio va debajo del primero con
  // una línea fina: el mismo bloque, dos ejercicios.
  filaSeguida: { borderTopWidth: 1, borderTopColor: colors.hairlineFaint },
  cabeza: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  letra: {
    minWidth: 30,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  letraTexto: { fontSize: 12, fontFamily: fonts.heading, color: colors.primaryBright, letterSpacing: 0.3 },
  nombre: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 23,
    fontFamily: fonts.heading,
    color: colors.text,
    letterSpacing: -0.2,
  },
  nombreEnTabla: { fontSize: 16, lineHeight: 22 },
  franja: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.sm + 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  dato: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 3 },
  datoDescanso: { flex: 1.3 },
  datoSeparado: { borderLeftWidth: 1, borderLeftColor: colors.border },
  rotulo: {
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  valor: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: fonts.heading,
    color: colors.text,
    textAlign: 'center',
    ...tabularNums,
  },
  valorEnTabla: { fontSize: 18, lineHeight: 23 },
  valorEstrecho: { fontSize: 17, lineHeight: 22 },
  extras: { marginTop: spacing.sm + 2, gap: spacing.sm },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  etiqueta: {
    // Una etiqueta larga ("En clúster: 3 bloques, 15 s entre bloques") parte
    // en dos líneas en vez de salirse de la tarjeta.
    maxWidth: '100%',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
  },
  etiquetaTexto: { fontSize: 12.5, lineHeight: 17, fontFamily: fonts.semiBold, color: colors.primaryBright },
  notaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  notaIcono: { marginTop: 3 },
  nota: { ...typography.body, fontSize: 14.5, lineHeight: 21, color: colors.textMuted, flex: 1 },
  tecnica: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  tecnicaTexto: { fontSize: 13, lineHeight: 17, fontFamily: fonts.semiBold, color: colors.onPrimary },
  // El descanso, como botón: con su borde y su reloj se ve que se puede tocar.
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 9,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignSelf: 'center',
  },
  botonEnCurso: { backgroundColor: colors.primary },
  botonPulsado: { opacity: 0.7 },
  botonTexto: { fontSize: 16, lineHeight: 20, fontFamily: fonts.heading, color: colors.primaryBright, ...tabularNums },
  botonTextoEnCurso: { color: colors.onPrimary },
  superserie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: 2,
  },
  superserieTexto: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  // La superserie, con una raya a la izquierda: se ve que va junta.
  filaEnlazada: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.primary, zIndex: 1 },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  pieTexto: { ...typography.small, color: colors.textMuted, flex: 1 },

  /* ---- En pantalla ancha: la tabla clásica ---- */
  tabla: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surfaceAlt,
  },
  cab: {
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bloqueTabla: { borderTopWidth: 1, borderTopColor: colors.border },
  filaTabla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  colNombre: { flex: 1, minWidth: 0 },
  colDato: { width: 92, alignItems: 'center', textAlign: 'center' },
  colDescanso: { width: 108 },
  pieEnTabla: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
