import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Un selector de unas pocas opciones, y el mismo en toda la app.
 *
 * Había tres versiones distintas de esto —la agenda, la rutina, el plan del
 * atleta— con paletas parecidas y medidas que no coincidían: mismo control,
 * distinta altura y distinta letra según en qué pantalla estuvieras. Eso es lo
 * que hace que una app se sienta cosida a mano aunque cada pantalla, por
 * separado, esté bien.
 *
 * La pastilla se DESLIZA de una opción a otra en vez de aparecer en la nueva.
 * Cuesta lo mismo de programar y cambia lo que se entiende: apareciendo, son
 * dos botones que se encienden; deslizándose, es una sola cosa que se mueve, y
 * el ojo sigue el movimiento sin tener que releer nada.
 */

export interface OpcionSegmento<T extends string> {
  valor: T;
  texto: string;
  icono?: React.ComponentProps<typeof Ionicons>['name'];
  /** Cifra pequeña a la derecha (p. ej. tareas pendientes). */
  contador?: number;
}

/** Dónde ha quedado un segmento, medido por el propio sistema de diseño. */
interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export function Segmented<T extends string>({
  opciones,
  valor,
  onChange,
  compacto = false,
}: {
  opciones: OpcionSegmento<T>[];
  valor: T;
  onChange: (v: T) => void;
  /** Letra y altura menores, para cabeceras densas. */
  compacto?: boolean;
}) {
  const [ancho, setAncho] = useState(0);
  const indice = Math.max(0, opciones.findIndex((o) => o.valor === valor));

  /*
   * DÓNDE SE PINTA LA PASTILLA: DONDE ESTÁ EL SEGMENTO, NO DONDE DEBERÍA ESTAR
   *
   * Antes la posición se CALCULABA: fila = índice / 2, columna = índice % 2,
   * multiplicado por el ancho y el alto teóricos. Esa cuenta y el reparto real
   * que hace flexbox son dos verdades distintas sobre lo mismo, y el día que no
   * coinciden pasa lo que se vio en un móvil: los cuatro segmentos en UNA fila
   * y la pastilla dibujada en la segunda, fuera de su caja y encima del texto
   * de abajo.
   *
   * Basta con que el ancho medido llegue tarde o llegue distinto —una animación
   * de entrada, una rotación, una letra del sistema más grande— para que la
   * cuenta y la realidad se separen. Y como la cuenta no sabe que se ha
   * separado, no hay forma de que se corrija sola.
   *
   * Ahora cada segmento dice dónde ha quedado (`onLayout`, en coordenadas de su
   * propio contenedor) y la pastilla se pone AHÍ. Se reparta como se reparta
   * —una fila, dos, tres— la pastilla no puede estar en otro sitio que encima
   * del segmento elegido.
   */
  const [cajas, setCajas] = useState<Record<number, Caja>>({});
  const cajaActiva = cajas[indice];

  const mide = (i: number, c: Caja) => {
    setCajas((prev) => {
      const v = prev[i];
      // Solo si ha cambiado de verdad: `onLayout` se dispara en cada pasada y
      // guardar un objeto nuevo idéntico volvería a pintar sin fin.
      if (v && v.x === c.x && v.y === c.y && v.ancho === c.ancho && v.alto === c.alto) return prev;
      return { ...prev, [i]: c };
    });
  };

  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const primera = useRef(true);

  useEffect(() => {
    if (!cajaActiva) return;
    // La primera vez se coloca sin animar: verla venir desde la esquina cada
    // vez que se abre la pantalla parece un fallo, no un detalle.
    if (primera.current) {
      primera.current = false;
      x.setValue(cajaActiva.x);
      y.setValue(cajaActiva.y);
      return;
    }
    const a = Animated.parallel([
      Animated.timing(x, {
        toValue: cajaActiva.x,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: cajaActiva.y,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    a.start();
    return () => a.stop();
  }, [cajaActiva, x, y]);

  /*
   * A partir de cuatro opciones se parte en dos filas. En una sola, cada
   * segmento se queda con menos de la mitad del ancho del móvil y los textos
   * empiezan a cortarse: "Días sueltos" pasa a "Días sue…", que es justo la
   * palabra por la que se distinguen las opciones.
   */
  const partido = opciones.length > 3;
  const porFila = partido ? Math.ceil(opciones.length / 2) : opciones.length;
  const alto = compacto ? ALTO_COMPACTO : ALTO;
  // Los segmentos reparten el ancho a partes iguales, así que la pastilla se
  // calcula y no hace falta medir uno por uno. Partiendo en filas se redondea a
  // la baja: con decimales, dos segmentos de media caja suman una micra de más
  // y el navegador los manda a líneas distintas, uno por fila.
  // El ancho medido incluye el borde y el relleno de la caja: si no se
  // descuentan, cada segmento sale un pelo más ancho de lo que cabe y, al
  // partir en filas, no entran dos por fila.
  const util = ancho - PADDING * 2 - BORDE * 2;
  const bruto = porFila > 0 ? util / porFila : 0;
  const anchoSeg = partido ? Math.floor(bruto) : bruto;

  return (
    <View style={styles.caja} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      {cajaActiva && opciones.length > 1 ? (
        <Animated.View
          style={[
            styles.pastilla,
            {
              // El tamaño se toma tal cual del segmento medido, sin animarlo:
              // solo cambia cuando cambia el reparto (girar el móvil, otra
              // letra del sistema), y animarlo ahí sería animar un
              // redimensionado, que se ve como un tirón.
              width: cajaActiva.ancho,
              height: cajaActiva.alto,
              transform: [{ translateX: x }, { translateY: y }],
            },
          ]}
          pointerEvents="none"
        />
      ) : null}

      {opciones.map((o, i) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onLayout={(e) => {
              const { x: ex, y: ey, width, height } = e.nativeEvent.layout;
              mide(i, { x: ex, y: ey, ancho: width, alto: height });
            }}
            onPress={() => {
              if (o.valor === valor) return;
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              onChange(o.valor);
            }}
            style={[
              styles.segmento,
              // `minHeight` y no `height`: con la letra grande del sistema, una
              // altura fija recorta el texto por la mitad en vez de dejar que
              // el segmento crezca.
              { minHeight: alto },
              // En dos filas el ancho no puede salir de `flex: 1`, o la última
              // fila incompleta repartiría su hueco entre menos segmentos y no
              // cuadrarían con la pastilla. Se fija por `flexBasis` y no por
              // `width`: el `flexBasis: 0` que arrastra `flex: 1` gana al ancho
              // y dejaría los segmentos a cero (invisibles).
              anchoSeg > 0 && partido
                ? { flexGrow: 0, flexShrink: 0, flexBasis: anchoSeg }
                : null,
            ]}
          >
            {o.icono ? (
              <Ionicons
                name={o.icono}
                size={compacto ? 13 : 15}
                color={activo ? colors.onPrimary : colors.textMuted}
              />
            ) : null}
            {/* Dos líneas, no una.
                Con cuatro opciones y un móvil de 320 a cada segmento le tocan
                102 píxeles, y "Grease the groove" pide 106: en una sola línea
                se quedaba en "Grease the groo…". El nombre del método no se
                puede abreviar —es como se llama— así que baja de línea. La
                altura la marca el segmento más alto de la fila, y la pastilla
                se dibuja de lo que MIDE el segmento, así que le sigue sola. */}
            <Text
              style={[
                styles.texto,
                compacto && styles.textoCompacto,
                activo && styles.textoActivo,
              ]}
              numberOfLines={2}
            >
              {o.texto}
            </Text>
            {o.contador ? (
              <View style={[styles.contador, activo && styles.contadorActivo]}>
                <Text style={[styles.contadorTexto, activo && styles.contadorTextoActivo]}>
                  {o.contador}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const PADDING = 4;
const BORDE = 1;
const ALTO = 40;
const ALTO_COMPACTO = 34;

const styles = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: BORDE,
    borderColor: colors.border,
    padding: PADDING,
    marginBottom: spacing.md,
  },
  // Sin `top`/`left` propios: la posición entera viene de lo que mide el
  // segmento, y esas coordenadas ya cuentan el relleno de la caja. Sumarlo otra
  // vez aquí desplazaría la pastilla cuatro píxeles en diagonal.
  pastilla: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  segmento: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  texto: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    flexShrink: 1,
  },
  textoCompacto: { fontSize: 12 },
  textoActivo: { color: colors.onPrimary },
  contador: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorActivo: { backgroundColor: 'rgba(0,0,0,0.22)' },
  contadorTexto: { fontSize: 10, color: colors.textMuted, fontFamily: fonts.semiBold },
  contadorTextoActivo: { color: colors.onPrimary },
});
