import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Mask,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/**
 * La tarjeta: una cifra tuya, puesta donde se mire.
 *
 * Un carné con seis datos del mismo tamaño no se enseña a nadie. Este solo
 * tiene UNO cada vez, enorme, y va cambiando: el número de fundador, los
 * entrenos, la racha, el puesto. Cada cifra tiene su turno para ser la
 * protagonista, que es la única forma de que alguna lo sea.
 *
 * Se puede inclinar con el dedo. No sirve para nada y es justo el motivo: un
 * objeto que responde al tacto se siente objeto, no pantalla, y a un carné que
 * quieres enseñar eso le importa más que cualquier dato de más. El foco de luz
 * barre la cara al girarla, como haría con una tarjeta de verdad.
 *
 * La cifra vive DEBAJO de la tarjeta y no dentro: dentro competiría con el
 * foco y con la marca, y acabaría siendo un dato más en una caja. Fuera, sola
 * y en oro sobre negro, no compite con nada.
 */

export interface DatoTarjeta {
  /** Lo pequeño de arriba: qué es esta cifra. */
  etiqueta: string;
  /** La cifra. Corta: es lo único que se lee de lejos. */
  valor: string;
}

const CADENCIA_MS = 3800;
/** Cuánto se inclina como mucho, en grados. Más que esto ya es un juguete. */
const TOPE = 16;

export function ProgressCard({
  datos,
  nombre,
  rol,
  desde,
  verificado = false,
}: {
  /** Las cifras que se van turnando. Con una sola, no rota. */
  datos: DatoTarjeta[];
  nombre: string;
  /** "Entrenador", "Atleta", "Alumno". */
  rol: string;
  /** "mayo de 2026". */
  desde?: string;
  /** Marca de fundador: el visto bueno junto al nombre. */
  verificado?: boolean;
}) {
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  const giroX = useRef(new Animated.Value(0)).current;
  const giroY = useRef(new Animated.Value(0)).current;
  const entrada = useRef(new Animated.Value(0)).current;
  const tocando = useRef(false);

  const dato = datos[i % Math.max(1, datos.length)] ?? { etiqueta: '', valor: '' };

  // Turno de cada cifra. Se para mientras se está tocando: cambiar el dato
  // justo cuando alguien la está girando para enseñarla es lo contrario de lo
  // que quiere.
  useEffect(() => {
    if (datos.length < 2) return;
    const t = setInterval(() => {
      if (!tocando.current) setI((n) => n + 1);
    }, CADENCIA_MS);
    return () => clearInterval(t);
  }, [datos.length]);

  // La cifra no aparece: entra desde abajo, con su etiqueta.
  useEffect(() => {
    entrada.setValue(0);
    const a = Animated.timing(entrada, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [i, entrada]);

  const volver = () => {
    tocando.current = false;
    Animated.parallel([
      Animated.spring(giroX, { toValue: 0, useNativeDriver: true, friction: 6, tension: 60 }),
      Animated.spring(giroY, { toValue: 0, useNativeDriver: true, friction: 6, tension: 60 }),
    ]).start();
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
        onPanResponderGrant: () => {
          tocando.current = true;
        },
        onPanResponderMove: (_e, g) => {
          // 140 px de arrastre = tope de inclinación. Con menos recorrido la
          // tarjeta se va a los topes al primer roce y parece rota.
          giroY.setValue(Math.max(-1, Math.min(1, g.dx / 140)));
          giroX.setValue(Math.max(-1, Math.min(1, -g.dy / 140)));
        },
        onPanResponderRelease: volver,
        onPanResponderTerminate: volver,
      }),
    // Los Animated.Value no cambian de identidad; el responder se crea una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const grados = (v: Animated.Value, signo = 1) =>
    v.interpolate({
      inputRange: [-1, 1],
      outputRange: [`${-TOPE * signo}deg`, `${TOPE * signo}deg`],
    });

  /** La luz barre la cara al girarla, como en una tarjeta de verdad. */
  const focoX = giroY.interpolate({ inputRange: [-1, 1], outputRange: [46, -46] });
  const focoOpacidad = giroX.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.55, 1, 0.8],
  });

  const escena = {
    transform: [
      { perspective: 900 },
      { rotateX: grados(giroX) },
      { rotateY: grados(giroY) },
    ],
  };
  // La placa se mueve algo más que la tarjeta: es lo que da la sensación de
  // que hay hueco entre las dos y no son un dibujo plano.
  const placa = {
    transform: [
      { perspective: 900 },
      { rotateX: grados(giroX, 1.25) },
      { rotateY: grados(giroY, 1.25) },
    ],
  };

  return (
    <View style={styles.todo} {...pan.panHandlers}>
      <Animated.View
        style={[styles.tarjeta, escena]}
        onLayout={(e) =>
          setCaja({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
      >
        {/* El foco se dibuja en píxeles y no en porcentajes: en SVG un radio en
            porcentaje se calcula sobre la diagonal, así que el mismo número
            daba un halo distinto en cada tamaño de pantalla. */}
        {caja.w > 0 ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: focoOpacidad, transform: [{ translateX: focoX }] },
            ]}
            pointerEvents="none"
          >
            <Svg width={caja.w} height={caja.h}>
              <Defs>
                {/* El haz: sale estrecho del canto de arriba y se abre al
                    bajar. Un degradado radial daba una cúpula, que se lee
                    como un reflejo; un cono se lee como un foco apuntando a
                    la tarjeta, que es lo que la convierte en un escenario. */}
                <LinearGradient id="haz" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primaryBright} stopOpacity="0.55" />
                  <Stop offset="0.45" stopColor={colors.primaryBright} stopOpacity="0.22" />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
                </LinearGradient>
                {/* Los cantos del haz se difuminan a los lados. Sin esto, el
                    polígono se ve como un triángulo dibujado y no como luz:
                    la luz no tiene bordes rectos. */}
                <LinearGradient id="cantos" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#000" />
                  <Stop offset="0.22" stopColor="#888" />
                  <Stop offset="0.5" stopColor="#fff" />
                  <Stop offset="0.78" stopColor="#888" />
                  <Stop offset="1" stopColor="#000" />
                </LinearGradient>
                <Mask id="suave">
                  <Rect x="0" y="0" width={caja.w} height={caja.h} fill="url(#cantos)" />
                </Mask>
                {/* Y el núcleo, donde la luz nace. */}
                <RadialGradient
                  id="nucleo"
                  gradientUnits="userSpaceOnUse"
                  cx={caja.w / 2}
                  cy={0}
                  rx={caja.w * 0.42}
                  ry={caja.h * 0.58}
                >
                  <Stop offset="0" stopColor={colors.primaryBright} stopOpacity="0.8" />
                  <Stop offset="0.45" stopColor={colors.primaryBright} stopOpacity="0.26" />
                  <Stop offset="1" stopColor={colors.primaryBright} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Polygon
                points={[
                  `${caja.w * 0.42},0`,
                  `${caja.w * 0.58},0`,
                  `${caja.w * 1.06},${caja.h}`,
                  `${-caja.w * 0.06},${caja.h}`,
                ].join(' ')}
                fill="url(#haz)"
                mask="url(#suave)"
              />
              <Ellipse
                cx={caja.w / 2}
                cy={0}
                rx={caja.w * 0.42}
                ry={caja.h * 0.58}
                fill="url(#nucleo)"
              />
            </Svg>
          </Animated.View>
        ) : null}

        <Text style={styles.marca}>UDECA</Text>
      </Animated.View>

      {/* La cifra, sola y fuera de la caja. Se toca para pasar a la siguiente:
          quien la está enseñando no quiere esperar tres segundos. */}
      <Pressable
        onPress={() => {
          if (datos.length < 2) return;
          if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
          setI((n) => n + 1);
        }}
        style={styles.datoZona}
      >
        <Animated.View
          style={{
            opacity: entrada,
            transform: [
              { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            ],
          }}
        >
          <Text style={styles.etiqueta}>{dato.etiqueta}</Text>
          <Text style={styles.valor} numberOfLines={1} adjustsFontSizeToFit>
            {dato.valor}
          </Text>
        </Animated.View>

        {datos.length > 1 ? (
          <View style={styles.puntos}>
            {datos.map((d, n) => (
              <View
                key={d.etiqueta}
                style={[styles.punto, n === i % datos.length && styles.puntoOn]}
              />
            ))}
          </View>
        ) : null}
      </Pressable>

      <Animated.View style={[styles.placa, placa]}>
        <Text style={styles.placaNombre} numberOfLines={1}>
          {nombre.toUpperCase()}
        </Text>
        {verificado ? (
          <Ionicons name="checkmark-circle" size={14} color={colors.primaryBright} />
        ) : null}
        <View style={{ flex: 1 }} />
        <Text style={styles.placaDesde} numberOfLines={1}>
          {desde ? `Desde ${desde}` : rol}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  todo: { alignItems: 'stretch' },
  tarjeta: {
    width: '100%',
    aspectRatio: 1.42,
    borderRadius: 22,
    backgroundColor: '#0B0B0B',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  marca: {
    fontSize: 15,
    fontFamily: fonts.display,
    letterSpacing: 2.4,
    color: colors.text,
  },
  datoZona: { marginTop: spacing.xl, minHeight: 96 },
  etiqueta: { ...typography.body, color: colors.textMuted },
  valor: {
    fontSize: 46,
    lineHeight: 56,
    fontFamily: fonts.display,
    letterSpacing: -1.4,
    color: colors.primaryBright,
    ...tabularNums,
  },
  puntos: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  punto: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  puntoOn: { backgroundColor: colors.primary, width: 16 },
  placa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: '#0B0B0B',
    borderWidth: 1,
    borderColor: colors.border,
  },
  placaNombre: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    letterSpacing: 1.1,
    flexShrink: 1,
  },
  placaDesde: {
    fontSize: 10,
    color: colors.textFaint,
    fontFamily: fonts.medium,
  },
});
