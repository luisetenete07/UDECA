import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Text } from './Texto';
import { frase } from '../lib/idioma';
import { esMismoDia } from '../lib/fechas';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from './ProgressBar';
import { VisorDeVideo } from './VisorDeVideo';
import { cancelarAvisosGtg, programarAvisosGtg } from '../lib/notifications';
import {
  getDiaDeRutinaDiaria,
  getRutinaDiaria,
  setDiaDeRutinaDiaria,
} from '../lib/firestore/rutinaDiaria';
import {
  conMarca,
  conMinutosDeHoy,
  conSeriesDeHoy,
  cronoVigente,
  cuentaSeries,
  cuentaTiempo,
  hayRutinaDiaria,
  hechosDeHoy,
  marcaDeSerie,
  minutosDeHoy,
  minutosDelCrono,
  minutosEnteros,
  NOMBRE_POR_DEFECTO,
  MAX_SERIES,
  progresoDiario,
  seriesDe,
  seriesDelDia,
  textoDeMinutos,
  textoDelCrono,
  textoDelEjercicio,
  textoDiario,
} from '../lib/rutinaDiaria';
import { colors, fonts, gradients, radius, spacing, tabularNums, typography } from '../lib/theme';
import type { CronoDiario } from '../lib/rutinaDiaria';
import type { DiaDeRutinaDiaria, RutinaDiaria, UserProfile } from '../lib/types';

/** Dónde se guarda el crono que está corriendo, para que sobreviva a cerrar la app. */
const CLAVE_CRONO = 'calico-crono-gtg';

/** Mientras corre el crono, la pantalla no se apaga (el móvil suele estar en el suelo). */
function PantallaEncendida() {
  useKeepAwake('crono-gtg', { suppressDeactivateWarnings: true });
  return null;
}

/**
 * Lo que toca hacer HOY aparte del entreno, y marcarlo.
 *
 * POR QUÉ VA EN EL INICIO
 *
 * Porque no se hace los días de entrenar: se hace TODOS. Estuvo en Entreno, que
 * parecía lo lógico —es entrenamiento—, y ahí solo lo veía quien iba a entrenar;
 * justo los días de descanso, que son en los que más falta hace acordarse del
 * pino, no aparecía por ningún lado.
 *
 * Y en el inicio va arriba, con la sesión del día y no debajo del resumen de la
 * semana: las dos contestan a "¿qué hago hoy?", y esa pregunta se responde
 * antes de mirar cómo va el mes.
 *
 * POR QUÉ NO SE PARECE A UNA SESIÓN
 *
 * No tiene botón de empezar ni de terminar, ni cuenta series. Son cuatro cosas
 * cortas repartidas por el día: se marca lo que se va haciendo y ya. Ponerle la
 * ceremonia de una sesión —abrir, completar, cerrar— es lo que haría que nadie
 * la hiciera "porque ahora no tengo tiempo de ponerme".
 *
 * Y EL DÍA A MEDIAS NO ES UN FALLO
 *
 * Dos de tres es un día bueno en algo que se repite a diario. La barra sube y
 * el texto lo dice; no hay nada en rojo. Tratar el día incompleto como un
 * fracaso es lo que enseña a abandonar en cuanto se rompe la racha.
 */
export function RutinaDiariaDelDia({ profile }: { profile: UserProfile | null }) {
  const [rutina, setRutina] = useState<RutinaDiaria | null>(null);
  const [dia, setDia] = useState<DiaDeRutinaDiaria | null>(null);
  const [video, setVideo] = useState<{ url: string; titulo: string } | null>(null);
  // El crono de lo que va por tiempo, y el "ahora" con el que se pinta.
  const [crono, setCrono] = useState<CronoDiario | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [indicacionesAbiertas, setIndicacionesAbiertas] = useState(false);
  const uid = profile?.uid;

  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    Promise.all([getRutinaDiaria(uid).catch(() => null), getDiaDeRutinaDiaria(uid).catch(() => null)])
      .then(([r, d]) => {
        if (!vivo) return;
        setRutina(r);
        setDia(d);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [uid]);

  const marcar = useCallback(
    (marca: string) => {
      if (!uid || !rutina) return;
      const hechos = hechosDeHoy(dia);
      const siguiente = conMarca(hechos, marca, !hechos.includes(marca));
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // Se pinta ya y se guarda detrás: marcar una casilla no puede esperar a
      // que conteste la red.
      const nuevo: DiaDeRutinaDiaria = {
        id: dia?.id ?? '',
        clientId: uid,
        date: Date.now(),
        hechos: siguiente,
        // Las series y los minutos de hoy siguen; los de otro día, no.
        ...(dia?.series && esMismoDia(dia.date, Date.now()) ? { series: dia.series } : {}),
        ...(dia?.minutos && esMismoDia(dia.date, Date.now()) ? { minutos: dia.minutos } : {}),
        updatedAt: Date.now(),
      };
      setDia(nuevo);
      setDiaDeRutinaDiaria(uid, siguiente, rutina.trainerId, Date.now(), {
        ...(nuevo.series ? { series: nuevo.series } : {}),
        ...(nuevo.minutos ? { minutos: nuevo.minutos } : {}),
        total: progresoDiario(rutina, nuevo).total,
      }).catch(() => {});
    },
    [uid, rutina, dia]
  );

  /*
   * AÑADIR O QUITAR SERIES, SOLO PARA HOY.
   *
   * Hay días de hacer una más del pino y días de quedarse en tres. Cambia solo
   * hoy: mañana vuelven las del entrenador. Lo ya marcado se respeta.
   */
  const cambiarSeries = useCallback(
    (ejercicioId: string, series: number) => {
      if (!uid || !rutina) return;
      const r = conSeriesDeHoy(rutina, dia, ejercicioId, series);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const nuevo: DiaDeRutinaDiaria = {
        id: dia?.id ?? '',
        clientId: uid,
        date: Date.now(),
        hechos: r.hechos,
        series: r.series,
        ...(dia?.minutos && esMismoDia(dia.date, Date.now()) ? { minutos: dia.minutos } : {}),
        updatedAt: Date.now(),
      };
      setDia(nuevo);
      setDiaDeRutinaDiaria(uid, r.hechos, rutina.trainerId, Date.now(), {
        series: r.series,
        total: progresoDiario(rutina, nuevo).total,
      }).catch(() => {});
    },
    [uid, rutina, dia]
  );

  /*
   * SUMAR MINUTOS, EN LO QUE VA POR TIEMPO ("20-30 min de pino").
   *
   * De cinco en cinco o de diez en diez, que es como se cuenta un rato de
   * práctica; y "−5" para corregir un toque de más. Al llegar al mínimo se
   * marca solo (lib/rutinaDiaria.ts, conMinutosDeHoy).
   */
  const sumarMinutos = useCallback(
    (ejercicioId: string, minutos: number) => {
      if (!uid || !rutina) return;
      const r = conMinutosDeHoy(rutina, dia, ejercicioId, minutos);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const nuevo: DiaDeRutinaDiaria = {
        id: dia?.id ?? '',
        clientId: uid,
        date: Date.now(),
        hechos: r.hechos,
        ...(dia?.series && esMismoDia(dia.date, Date.now()) ? { series: dia.series } : {}),
        minutos: r.minutos,
        updatedAt: Date.now(),
      };
      setDia(nuevo);
      setDiaDeRutinaDiaria(uid, r.hechos, rutina.trainerId, Date.now(), {
        minutos: r.minutos,
        total: progresoDiario(rutina, nuevo).total,
      }).catch(() => {});
    },
    [uid, rutina, dia]
  );

  /*
   * EL CRONO: "EMPEZAR" Y "PARAR".
   *
   * Lo que va por tiempo ("20-30 min de pino") se mide con el crono: Empezar,
   * practicar, Parar, y ese rato se suma a lo de hoy. Se guarda cuándo empezó,
   * no cuánto lleva: así cuadra aunque el móvil se bloquee o la app se cierre
   * y se vuelva a abrir. Uno de ayer no se suma a hoy (cronoVigente).
   */
  useEffect(() => {
    if (!uid || !rutina) return;
    AsyncStorage.getItem(CLAVE_CRONO)
      .then((txt) => {
        const guardado = txt ? (JSON.parse(txt) as CronoDiario) : null;
        const vale = cronoVigente(guardado, uid, rutina);
        if (vale) setCrono(vale);
        else if (guardado) AsyncStorage.removeItem(CLAVE_CRONO).catch(() => {});
      })
      .catch(() => {});
  }, [uid, rutina]);

  // Corriendo, se repinta cada segundo (y al volver a la app, al momento).
  useEffect(() => {
    if (!crono) return;
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') setAhora(Date.now());
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [crono]);

  /** Para el crono y suma el rato a lo de hoy. */
  const parar = useCallback(() => {
    if (!crono || !rutina) return;
    setCrono(null);
    AsyncStorage.removeItem(CLAVE_CRONO).catch(() => {});
    const e = rutina.ejercicios.find((x) => x.id === crono.id);
    const tanda = minutosDelCrono(crono.desde);
    if (!e || tanda <= 0) return;
    sumarMinutos(crono.id, minutosDeHoy(e, dia) + tanda);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [crono, rutina, dia, sumarMinutos]);

  /** Empieza el crono de un ejercicio (si corría el de otro, se guarda antes). */
  const empezar = useCallback(
    (ejercicioId: string) => {
      if (!uid) return;
      if (crono) parar();
      const nuevo: CronoDiario = { uid, id: ejercicioId, desde: Date.now() };
      setCrono(nuevo);
      setAhora(nuevo.desde);
      AsyncStorage.setItem(CLAVE_CRONO, JSON.stringify(nuevo)).catch(() => {});
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },
    [uid, crono, parar]
  );

  /*
   * LOS AVISOS DEL DÍA (lib/avisosDiarios.ts). Se rehacen al abrir y cada vez
   * que se marca algo, con lo que de verdad queda; un momento después y no al
   * instante, para que marcar tres casillas seguidas no los rehaga tres veces.
   * Sin rutina, o con los avisos apagados en el perfil, se quitan.
   */
  const avisosOn = profile?.dailyRoutineRemindersEnabled !== false;
  useEffect(() => {
    if (!uid) return;
    if (!rutina || !hayRutinaDiaria(rutina) || !avisosOn) {
      cancelarAvisosGtg().catch(() => {});
      return;
    }
    const pr = progresoDiario(rutina, dia);
    const t = setTimeout(() => {
      programarAvisosGtg(rutina.nombre || NOMBRE_POR_DEFECTO, pr.total - pr.hechos, pr.total).catch(
        () => {}
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [uid, rutina, dia, avisosOn]);

  if (!hayRutinaDiaria(rutina) || !rutina) return null;

  const hechos = hechosDeHoy(dia);
  const p = progresoDiario(rutina, dia);
  const indicaciones = rutina.indicaciones?.trim() ?? '';
  // Larga: dos líneas y "Ver más". La tarjeta se mira varias veces al día y
  // el texto se lee una; entero cada vez empujaría la lista hacia abajo.
  const indicacionesLargas = indicaciones.length > 110 || indicaciones.includes('\n');

  return (
    /*
     * NO ES UNA TARJETA MÁS, Y TIENE QUE NOTARSE.
     *
     * Era una `Card` igual que las otras cinco del inicio —mismo fondo, mismo
     * borde, mismo todo— y se perdía entre ellas. El problema no es que
     * estuviera fea: es que esto se hace TODOS los días, y lo que se hace
     * todos los días es justo lo que se olvida cuando no se ve.
     *
     * Lleva degradado propio, pero NO el de la sesión de hoy. Con el mismo
     * dorado en diagonal las dos tarjetas se leían como una sola, y no lo son:
     * una es la sesión y esta lo que se reparte por el día. Plata, desde la
     * esquina contraria, y el oro solo en lo que se marca.
     */
    <LinearGradient
      colors={gradients.diario}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.tarjeta}
    >
      <View style={styles.cabecera}>
        <View style={[styles.icono, p.completa && styles.iconoHecho]}>
          <Ionicons
            name={p.completa ? 'checkmark' : 'repeat'}
            size={19}
            color={p.completa ? colors.onPrimary : colors.primaryBright}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* El rótulo dice QUÉ ES esto antes de decir cómo se llama. El nombre
              lo pone el entrenador y puede ser cualquier cosa ("KFOU2", "Mi
              rutina"); sin esta línea, quien abre la app por primera vez no
              tiene forma de saber que es lo de cada día. */}
          <Text style={styles.rotulo}>Cada día</Text>
          {/* Dos líneas, no una: el nombre lo escribe el entrenador y en un
              móvil de 320, con el marcador al lado, "Grease the groove" se
              quedaba en "Grease the ...". Un nombre a medias no identifica
              nada. */}
          <Text style={styles.titulo} numberOfLines={2}>
            {rutina.nombre || NOMBRE_POR_DEFECTO}
          </Text>
        </View>
        {/* La cuenta, grande. Es el dato que hace volver: cuánto llevas hoy. */}
        <View style={styles.marcador}>
          <Text style={styles.cuenta}>{p.hechos}</Text>
          <Text style={styles.deTotal}>/{p.total}</Text>
        </View>
      </View>

      <ProgressBar progress={p.ratio} height={8} />
      <Text style={styles.texto}>{textoDiario(p)}</Text>

      {indicaciones ? (
        <Pressable
          onPress={indicacionesLargas ? () => setIndicacionesAbiertas((v) => !v) : undefined}
          style={styles.indicaciones}
          hitSlop={4}
        >
          <Ionicons name="document-text-outline" size={15} color={colors.primary} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.indicacionesTexto} numberOfLines={indicacionesAbiertas ? undefined : 2}>
              {indicaciones}
            </Text>
            {indicacionesLargas ? (
              <Text style={styles.verMas}>{indicacionesAbiertas ? 'Ver menos' : 'Ver más'}</Text>
            ) : null}
          </View>
        </Pressable>
      ) : null}

      {/* Una línea entre el titular y la lista. Sin ella, con tres ejercicios y
          sus series, la cabecera se leía como una fila más de la lista y el
          número grande perdía todo el trabajo que hace. */}
      <View style={styles.raya} />

      {rutina.ejercicios.map((e) => {
        // Las de HOY: las del entrenador o las que haya puesto para hoy.
        const series = seriesDelDia(e, dia);
        /*
         * Con series, una casilla por serie; sin ellas, una sola para todo el
         * ejercicio. Es la diferencia entre poder decir "llevo dos de cinco" a
         * lo largo del día y tener que esperar a terminarlas todas para marcar
         * algo, que en el grease the groove es justo lo que no encaja.
         */
        const conSeries = cuentaSeries(e) && series > 1;
        const marcas = conSeries
          ? Array.from({ length: series }, (_, i) => marcaDeSerie(e.id, i + 1))
          : [e.id];
        const hechasAqui = marcas.filter((m) => hechos.includes(m)).length;
        const entero = hechasAqui === marcas.length;
        const detalle = textoDelEjercicio({ ...e, ...(cuentaSeries(e) ? { series } : {}) });
        // Por tiempo: lo que lleva hoy frente al margen ("12 de 20-30 min").
        const porTiempo = cuentaTiempo(e) ? e.minutos : null;
        const llevaMin = porTiempo ? minutosDeHoy(e, dia) : 0;
        // Con el crono en marcha, lo de hoy más lo que lleva esta tanda.
        const corriendo = !!porTiempo && crono?.id === e.id;
        const tanda = corriendo && crono ? minutosDelCrono(crono.desde, ahora) : 0;
        const totalMin = llevaMin + tanda;

        return (
          <View key={e.id} style={styles.fila}>
            {/* El hueco de la casilla se reserva SIEMPRE, lleve casilla o no:
                si no, los ejercicios con series empiezan pegados al borde y los
                de casilla más adentro, y la lista queda dentada. */}
            {conSeries ? (
              <View style={styles.huecoCasilla} />
            ) : (
              <Pressable
                onPress={() => marcar(e.id)}
                hitSlop={6}
                style={[styles.casilla, entero && styles.casillaOn]}
              >
                {entero ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
              </Pressable>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Pressable onPress={conSeries ? undefined : () => marcar(e.id)} hitSlop={4}>
                <Text style={[styles.filaNombre, entero && styles.filaHecha]} numberOfLines={2}>
                  {e.nombre}
                </Text>
                {detalle ? (
                  <Text style={styles.filaObjetivo} numberOfLines={2}>
                    {conSeries
                      ? frase`${hechasAqui} de ${detalle}`
                      : porTiempo && totalMin >= 1
                        ? frase`${minutosEnteros(totalMin)} de ${detalle}`
                        : detalle}
                  </Text>
                ) : null}
                {/* Cómo hacerlo, si el entrenador lo dejó escrito. Entero: es
                    corto y es justo lo que hay que tener delante al hacerlo. */}
                {e.indicaciones?.trim() ? (
                  <Text style={styles.filaIndicaciones}>{e.indicaciones.trim()}</Text>
                ) : null}
              </Pressable>

              {conSeries ? (
                <View style={styles.series}>
                  {marcas.map((m, i) => {
                    const hecha = hechos.includes(m);
                    return (
                      <Pressable
                        key={m}
                        onPress={() => marcar(m)}
                        hitSlop={4}
                        style={[styles.serie, hecha && styles.serieOn]}
                      >
                        <Text style={[styles.serieTexto, hecha && styles.serieTextoOn]}>
                          {i + 1}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/*
                POR TIEMPO: EL CRONO. Empezar y Parar, grandes: es lo que se toca
                con las manos sucias de magnesio. Mientras corre, el tiempo en
                grande y la barra subiendo; al parar, el rato se suma solo.
                "+5" y "−5", pequeños, para corregir o apuntar algo hecho sin
                el móvil. Pasarse del máximo se dice, sin celebrarlo.
              */}
              {porTiempo ? (
                <>
                  <View style={styles.minutosBarra}>
                    <View
                      style={[
                        styles.minutosRelleno,
                        { width: `${Math.min(100, (totalMin / porTiempo.min) * 100)}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.cronoFila}>
                    {corriendo ? (
                      <>
                        <Text style={styles.cronoTiempo} accessibilityLiveRegion="polite">
                          {textoDelCrono(tanda)}
                        </Text>
                        <Pressable
                          onPress={parar}
                          hitSlop={6}
                          style={[styles.cronoBtn, styles.cronoBtnParar]}
                          accessibilityLabel="Parar el crono y sumar el tiempo"
                        >
                          <Ionicons name="stop" size={16} color={colors.onPrimary} />
                          <Text style={styles.cronoBtnTexto}>Parar</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable
                          onPress={() => empezar(e.id)}
                          hitSlop={6}
                          style={styles.cronoBtn}
                          accessibilityLabel="Empezar el crono"
                        >
                          <Ionicons name="play" size={16} color={colors.onPrimary} />
                          <Text style={styles.cronoBtnTexto}>Empezar</Text>
                        </Pressable>
                        <View style={{ flex: 1 }} />
                        <Pressable
                          onPress={() => sumarMinutos(e.id, llevaMin - 5)}
                          disabled={llevaMin <= 0}
                          hitSlop={4}
                          style={[styles.minutoBtn, llevaMin <= 0 && styles.ajusteApagado]}
                          accessibilityLabel="Quitar 5 minutos"
                        >
                          <Text style={styles.minutoBtnTexto}>−5</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => sumarMinutos(e.id, llevaMin + 5)}
                          hitSlop={4}
                          style={styles.minutoBtn}
                          accessibilityLabel="Añadir 5 minutos"
                        >
                          <Text style={styles.minutoBtnTexto}>+5</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                  {corriendo && llevaMin < porTiempo.min && totalMin >= porTiempo.min ? (
                    <Text style={styles.cronoNota}>Ya llegas al mínimo: para cuando quieras.</Text>
                  ) : null}
                  {porTiempo.max && totalMin > porTiempo.max ? (
                    <Text style={styles.ajusteNota}>
                      {frase`Más de lo que puso tu entrenador (${textoDeMinutos(porTiempo)})`}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {/* Una más o una menos, para hoy. Solo en los que cuentan series. */}
              {cuentaSeries(e) ? (
                <View style={styles.ajuste}>
                  <Pressable
                    onPress={() => cambiarSeries(e.id, series - 1)}
                    disabled={series <= 1}
                    hitSlop={6}
                    style={[styles.ajusteBtn, series <= 1 && styles.ajusteApagado]}
                    accessibilityLabel="Quitar una serie hoy"
                  >
                    <Ionicons name="remove" size={13} color={colors.textMuted} />
                    <Text style={styles.ajusteTexto}>Quitar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => cambiarSeries(e.id, series + 1)}
                    disabled={series >= MAX_SERIES}
                    hitSlop={6}
                    style={[styles.ajusteBtn, series >= MAX_SERIES && styles.ajusteApagado]}
                    accessibilityLabel="Añadir una serie hoy"
                  >
                    <Ionicons name="add" size={13} color={colors.primary} />
                    <Text style={[styles.ajusteTexto, { color: colors.primary }]}>Añadir</Text>
                  </Pressable>
                  {series !== seriesDe(e) ? (
                    <Text style={styles.ajusteNota}>{frase`Hoy ${series} · tu entrenador puso ${seriesDe(e)}`}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* El vídeo de la técnica, si lo puso el entrenador. Un pino mal
                  hecho cien días seguidos son cien días haciéndolo mal. */}
              {e.video?.trim() ? (
                <Pressable
                  onPress={() => setVideo({ url: e.video!.trim(), titulo: e.nombre })}
                  style={styles.verVideo}
                  hitSlop={4}
                >
                  <Ionicons name="play-circle-outline" size={15} color={colors.primary} />
                  <Text style={styles.verVideoTexto}>Ver técnica</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      {crono ? <PantallaEncendida /> : null}

      <VisorDeVideo
        visible={video !== null}
        url={video?.url}
        titulo={video?.titulo}
        profile={profile}
        onCerrar={() => setVideo(null)}
        protegido={false}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineSilver,
    padding: spacing.lg,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Completo: el círculo se rellena. Es la recompensa del día, y es lo único
  // de la tarjeta que cambia de color entero.
  iconoHecho: { backgroundColor: colors.primary, borderColor: colors.primary },
  rotulo: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  titulo: { ...typography.h3, color: colors.text, marginTop: 2 },
  texto: { ...typography.small, color: colors.textMuted },
  // La cuenta, en dos tamaños: lo hecho manda y el total acompaña. Alineados
  // por la base para que no bailen entre sí.
  marcador: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 0 },
  cuenta: {
    ...typography.h1,
    color: colors.primaryBright,
  },
  raya: { height: 1, backgroundColor: colors.border, marginTop: spacing.xs },
  deTotal: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
  },
  fila: {
    flexDirection: 'row',
    // Arriba y no al centro: con las series debajo, la casilla centrada quedaba
    // flotando a media altura, lejos del nombre al que pertenece.
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  // Separación corta a propósito: con la de siempre, cinco series no cabían por
  // seis píxeles en un móvil de 320 y la quinta caía sola a la línea de abajo.
  series: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  serie: {
    /*
     * 32 de lado, y con `hitSlop` alrededor son 40 los que responden al dedo.
     * Más pequeñas se falla, y fallar aquí es marcar la serie de al lado. Menos
     * de esto no se baja aunque haya que envolver a partir de seis.
     */
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serieOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  serieTexto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  serieTextoOn: { color: colors.onPrimary },
  verVideo: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  // Por tiempo: la barra fina hasta el mínimo y los botones de minutos.
  minutosBarra: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  minutosRelleno: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  // El crono: Empezar / Parar grandes, y el tiempo en grande mientras corre.
  cronoFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  cronoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  cronoBtnParar: { marginLeft: 'auto' },
  cronoBtnTexto: { ...typography.body, color: colors.onPrimary, fontFamily: fonts.semiBold },
  cronoTiempo: { ...typography.h1, color: colors.primaryBright, ...tabularNums },
  cronoNota: { ...typography.small, fontSize: 12, color: colors.primaryBright },
  minutoBtn: {
    minWidth: 48,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minutoBtnTexto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  ajuste: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  ajusteBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ajusteApagado: { opacity: 0.35 },
  ajusteTexto: { ...typography.small, fontSize: 12, color: colors.textMuted, fontFamily: fonts.semiBold },
  ajusteNota: { ...typography.small, fontSize: 11, color: colors.textFaint },
  verVideoTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  casilla: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  huecoCasilla: { width: 24 },
  filaNombre: { ...typography.body, color: colors.text },
  // Hecho: se atenúa y se tacha. Sigue a la vista para poder desmarcarlo.
  filaHecha: { color: colors.textFaint, textDecorationLine: 'line-through' },
  filaObjetivo: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  filaIndicaciones: { ...typography.small, color: colors.textMuted, marginTop: 4, fontStyle: 'italic', lineHeight: 18 },
  indicaciones: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  indicacionesTexto: { ...typography.small, color: colors.text, lineHeight: 19 },
  verMas: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, marginTop: 2 },
});
