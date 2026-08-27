import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
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
import { useBloqueoDeScroll } from '../lib/bloqueoDeScroll';
import { colors, fonts, spacing, tabularNums, typography } from '../lib/theme';

/**
 * La tarjeta: un carné con una sola cifra grande, y esa cifra va cambiando.
 *
 * Todo lo que la identifica vive DENTRO: la marca arriba, el nombre abajo y el
 * número de fundador impreso a su lado. Es un carné, y un carné no reparte su
 * identidad entre la tarjeta y lo que hay debajo de ella.
 *
 * Lo que rota es solo lo que cambia con el tiempo —alumnos, entrenos, racha,
 * puesto— porque un carné con seis datos del mismo tamaño no se enseña a
 * nadie. Cada cifra tiene su turno para ser la protagonista, que es la única
 * forma de que alguna lo sea.
 *
 * Proporción de tarjeta de verdad (1,586, la de una tarjeta bancaria). No es
 * un capricho: es la forma que el ojo ya reconoce como "carné", y cualquier
 * otra la deja a medio camino entre una tarjeta y un cartel.
 *
 * Se puede inclinar con el dedo y el foco barre la cara al girarla. No sirve
 * para nada y es justo el motivo: un objeto que responde al tacto se siente
 * objeto, no pantalla, y a algo que quieres enseñar eso le importa más que
 * cualquier dato de más.
 */

export interface DatoTarjeta {
  /** Lo pequeño de arriba: qué es esta cifra. */
  etiqueta: string;
  /** La cifra. Corta: es lo único que se lee de lejos. */
  valor: string;
}

const CADENCIA_MS = 3800;
/** Cuánto se inclina como mucho, en grados. Más que esto ya es un juguete. */
const TOPE = 14;
/** La de una tarjeta bancaria. */
const PROPORCION = 1.586;
/**
 * Un carné tiene un tamaño, no un porcentaje.
 *
 * Sin tope, en un monitor se estiraba hasta 520 px de ancho y dejaba de ser
 * una tarjeta para ser un cartel: lo que la hace creíble es justo que se
 * parezca a algo que cabe en una cartera. En el móvil el tope no llega a
 * aplicarse y ocupa el ancho de la columna, que es como se ve en unrespiro.
 */
const ANCHO_MAX = 360;

export function ProgressCard({
  datos,
  nombre,
  rol,
  desde,
  fundador,
}: {
  /** Las cifras que se van turnando. Con una sola, no rota. */
  datos: DatoTarjeta[];
  nombre: string;
  /** "Entrenador", "Atleta", "Alumno". */
  rol: string;
  /** "Mayo de 2026". */
  desde?: string;
  /**
   * "#0001", ya escrito. Se imprime fijo; no entra en la rotación.
   *
   * Aquí solo llega encendido: quien no tiene la cuenta al día no ve el
   * perfil, ve el muro de pago (ver components/Paywall.tsx, que es donde se le
   * recuerda que el número sigue siendo suyo).
   */
  fundador?: string;
}) {
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  const giroX = useRef(new Animated.Value(0)).current;
  const giroY = useRef(new Animated.Value(0)).current;
  const entrada = useRef(new Animated.Value(0)).current;
  /** 0 en su sitio, 1 cogida con la mano. */
  const alzada = useRef(new Animated.Value(0)).current;
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

  /*
   * AGARRAR LA TARJETA
   *
   * En el móvil, arrastrar la tarjeta y desplazar la pantalla son el mismo
   * gesto: apoyar el dedo y moverlo. Antes se repartían por el eje —horizontal
   * para la tarjeta, vertical para la pantalla—, y el resultado era que la
   * tarjeta apenas se dejaba mover: cualquier arrastre con algo de vertical se
   * lo llevaba la pantalla, y arrastrar recto es difícil.
   *
   * Ahora se puede AGARRAR: se apoya el dedo un momento sin moverlo y la
   * tarjeta se queda contigo. A partir de ahí la pantalla se queda quieta y la
   * tarjeta gira en cualquier dirección, que es lo que uno espera al coger un
   * objeto con la mano.
   *
   * El reparto por eje sigue estando para quien no espera: un arrastre
   * horizontal la gira al momento, sin tener que aprender nada. Y quien
   * empieza a bajar por el perfil desde encima de la tarjeta baja, como
   * siempre — porque el dedo se ha movido antes de que diera tiempo a agarrar.
   */
  const AGARRE_MS = 180;
  /** Cuánto se puede temblar sin que cuente como movimiento. */
  const QUIETO_PX = 8;

  const agarrada = useRef(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bloqueando = useRef(false);
  const { bloquear, soltar } = useBloqueoDeScroll();
  // En una ref porque el PanResponder se crea UNA vez y se quedaría con la
  // primera versión de estas funciones para siempre.
  const bloqueo = useRef({ bloquear, soltar });
  bloqueo.current = { bloquear, soltar };

  const quietaLaPantalla = () => {
    if (bloqueando.current) return;
    bloqueando.current = true;
    bloqueo.current.bloquear();
  };

  const devuelveLaPantalla = () => {
    if (!bloqueando.current) return;
    bloqueando.current = false;
    bloqueo.current.soltar();
  };

  // Si la tarjeta desaparece con el dedo encima —al cambiar de pantalla a
  // media vuelta—, la pantalla se quedaría quieta para siempre.
  useEffect(() => devuelveLaPantalla, []);

  const volver = () => {
    tocando.current = false;
    agarrada.current = false;
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
    devuelveLaPantalla();
    Animated.parallel([
      Animated.spring(giroX, { toValue: 0, useNativeDriver: true, friction: 6, tension: 60 }),
      Animated.spring(giroY, { toValue: 0, useNativeDriver: true, friction: 6, tension: 60 }),
      Animated.spring(alzada, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  };

  const pan = useMemo(
    () => {
      /** ¿El dedo va claramente en horizontal? Entonces es un giro. */
      const horizontal = (_e: unknown, g: { dx: number; dy: number }) =>
        Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 6;

      /** Ya agarrada, cualquier movimiento es suyo. */
      const mio = (e: unknown, g: { dx: number; dy: number }) =>
        agarrada.current || horizontal(e, g);

      return PanResponder.create({
        /*
         * Al apoyar el dedo NO se coge el gesto —si no, no se podría desplazar
         * la pantalla desde encima de la tarjeta, que ocupa media pantalla—,
         * pero se pone el reloj en marcha. Si el dedo sigue ahí y quieto
         * cuando salta, la tarjeta queda agarrada.
         */
        onStartShouldSetPanResponderCapture: () => {
          if (espera.current) clearTimeout(espera.current);
          espera.current = setTimeout(() => {
            agarrada.current = true;
            quietaLaPantalla();
            // Se levanta un poco: sin esto no hay forma de saber que ya la
            // tienes cogida, y se queda uno esperando a que pase algo.
            Animated.spring(alzada, {
              toValue: 1,
              useNativeDriver: true,
              friction: 7,
              tension: 90,
            }).start();
          }, AGARRE_MS);
          return false;
        },
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: mio,
        // Y en CAPTURA, que es lo que de verdad hace falta: el centro de la
        // tarjeta es pulsable (pasa de cifra), así que al arrastrar desde ahí
        // el hijo se quedaba el gesto y la tarjeta no giraba — justo desde la
        // zona más grande y más fácil de agarrar. Capturando, el padre se lo
        // quita.
        onMoveShouldSetPanResponderCapture: (e, g) => {
          // Un movimiento de verdad antes de tiempo cancela el agarre: quien
          // ha empezado a desplazar la pantalla quiere desplazarla.
          if (
            !agarrada.current &&
            espera.current &&
            Math.abs(g.dx) + Math.abs(g.dy) > QUIETO_PX
          ) {
            clearTimeout(espera.current);
            espera.current = null;
          }
          return mio(e, g);
        },
        onPanResponderGrant: () => {
          tocando.current = true;
          // Un arrastre horizontal la gira sin haberla agarrado antes; ahí la
          // pantalla también tiene que quedarse quieta, o el gesto se pelea
          // con ella a mitad de camino.
          quietaLaPantalla();
        },
        onPanResponderMove: (_e, g) => {
          // 140 px de arrastre = tope de inclinación. Con menos recorrido la
          // tarjeta se va a los topes al primer roce y parece rota.
          giroY.setValue(Math.max(-1, Math.min(1, g.dx / 140)));
          giroX.setValue(Math.max(-1, Math.min(1, -g.dy / 140)));
        },
        onPanResponderRelease: volver,
        onPanResponderTerminate: volver,
        // Agarrada, no se suelta: sin esto el `ScrollView` puede reclamar el
        // gesto a media vuelta y la tarjeta se cae de las manos.
        onPanResponderTerminationRequest: () => !agarrada.current,
      });
    },
    // Los Animated.Value no cambian de identidad; el responder se crea una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const grados = (v: Animated.Value) =>
    v.interpolate({
      inputRange: [-1, 1],
      outputRange: [`${-TOPE}deg`, `${TOPE}deg`],
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
      // Cogida, se acerca un poco. Es el único aviso de que ya la tienes: sin
      // él, el momento del agarre no se nota y parece que no ha pasado nada.
      { scale: alzada.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
    ],
  };

  return (
    <Animated.View
      style={[styles.tarjeta, escena]}
      onLayout={(e) =>
        setCaja({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
      {...pan.panHandlers}
    >
      {/* El foco se dibuja en píxeles y no en porcentajes: en SVG un radio en
          porcentaje se calcula sobre la diagonal, así que el mismo número daba
          un halo distinto en cada tamaño de pantalla. */}
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
              {/* El haz: sale estrecho del canto de arriba y se abre al bajar.
                  Un degradado radial daba una cúpula, que se lee como un
                  reflejo; un cono se lee como un foco apuntando a la tarjeta,
                  que es lo que la convierte en un escenario. */}
              <LinearGradient id="haz" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primaryBright} stopOpacity="0.55" />
                <Stop offset="0.45" stopColor={colors.primaryBright} stopOpacity="0.22" />
                <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
              </LinearGradient>
              {/* Los cantos del haz se difuminan a los lados. Sin esto, el
                  polígono se ve como un triángulo dibujado y no como luz: la
                  luz no tiene bordes rectos. */}
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

      <View style={styles.arriba}>
        <Text style={styles.marca}>UDECA</Text>
        <Text style={styles.rol}>{rol.toUpperCase()}</Text>
      </View>

      {/* La cifra del turno.
          Aquí había un Pressable para saltar a la siguiente cifra, y hubo que
          quitarlo: en React Native Web el hijo se queda el gesto desde que se
          toca, así que arrastrando desde el centro —la zona más grande y más
          fácil de agarrar— la tarjeta no giraba. Y para recuperar ese gesto
          había que atraparlo desde el principio, lo que dejaba el perfil sin
          poder desplazarse.
          Entre poder saltar una cifra que ya cambia sola cada cuatro segundos
          y poder bajar por tu propio perfil, no hay discusión. */}
      <View style={styles.centro}>
        <Animated.View
          style={{
            opacity: entrada,
            transform: [
              { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            ],
          }}
        >
          <Text style={styles.etiqueta} numberOfLines={1}>
            {dato.etiqueta}
          </Text>
          <Text style={styles.valor} numberOfLines={1} adjustsFontSizeToFit>
            {dato.valor}
          </Text>
        </Animated.View>

        {/* Debajo de la cifra y en horizontal. Pegados al canto derecho se
            leían como una raya suelta en mitad del foco, no como "hay más". */}
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
      </View>

      <View style={styles.abajo}>
        <View style={styles.identidad}>
          {/* Dos líneas. Es un carné: el nombre es lo que acredita, y
              "MARÍA DEL CARMEN FERNÁNDEZ RODRÍG…" no acredita a nadie. La
              tarjeta tiene proporción fija, así que la segunda línea se come
              alto de la parte de abajo, que es la que va holgada. */}
          <Text style={styles.nombre} numberOfLines={2}>
            {nombre.toUpperCase()}
          </Text>
          {desde ? (
            <Text style={styles.desde} numberOfLines={1}>
              {desde}
            </Text>
          ) : null}
        </View>
        {fundador ? (
          <View style={styles.fundador}>
            <Ionicons name="shield-checkmark" size={11} color={colors.primaryBright} />
            <Text style={styles.fundadorNumero}>{fundador}</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    // Sin esto, arrastrar por encima de la cifra iniciaba una SELECCIÓN de
    // texto y el navegador se quedaba el gesto: la tarjeta giraba desde los
    // bordes y no desde el centro, que es justo por donde se agarra. Un carné
    // no es un párrafo; aquí no hay nada que seleccionar.
    userSelect: 'none',
    width: '100%',
    maxWidth: ANCHO_MAX,
    alignSelf: 'center',
    aspectRatio: PROPORCION,
    borderRadius: 20,
    backgroundColor: '#0B0B0B',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  arriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  marca: {
    fontSize: 15,
    fontFamily: fonts.display,
    letterSpacing: 2.4,
    color: colors.text,
  },
  rol: {
    fontSize: 9,
    fontFamily: fonts.semiBold,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  centro: { flex: 1, justifyContent: 'center' },
  etiqueta: { ...typography.small, color: colors.textMuted },
  valor: {
    fontSize: 40,
    lineHeight: 48,
    fontFamily: fonts.display,
    letterSpacing: -1.2,
    color: colors.primaryBright,
    ...tabularNums,
  },
  abajo: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  identidad: { flexShrink: 1, minWidth: 0 },
  nombre: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    letterSpacing: 1.1,
  },
  desde: { fontSize: 10, color: colors.textFaint, fontFamily: fonts.medium, marginTop: 1 },
  fundador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineFaint,
    backgroundColor: colors.primaryMuted,
    flexShrink: 0,
  },
  fundadorNumero: {
    fontSize: 12,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    ...tabularNums,
  },
  puntos: { flexDirection: 'row', gap: 5, marginTop: spacing.sm },
  punto: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  puntoOn: { backgroundColor: colors.primary, width: 14 },
});
