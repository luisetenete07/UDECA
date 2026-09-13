import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Text } from './Texto';
import { frase } from '../lib/idioma';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from './ProgressBar';
import { VisorDeVideo } from './VisorDeVideo';
import {
  getDiaDeRutinaDiaria,
  getRutinaDiaria,
  setDiaDeRutinaDiaria,
} from '../lib/firestore/rutinaDiaria';
import {
  conMarca,
  hayRutinaDiaria,
  hechosDeHoy,
  marcaDeSerie,
  NOMBRE_POR_DEFECTO,
  progresoDiario,
  seriesDe,
  textoDelEjercicio,
  textoDiario,
} from '../lib/rutinaDiaria';
import { colors, fonts, gradients, radius, spacing, typography } from '../lib/theme';
import type { DiaDeRutinaDiaria, RutinaDiaria, UserProfile } from '../lib/types';

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
      setDia((prev) => ({
        id: prev?.id ?? '',
        clientId: uid,
        date: Date.now(),
        hechos: siguiente,
        updatedAt: Date.now(),
      }));
      setDiaDeRutinaDiaria(uid, siguiente, rutina.trainerId).catch(() => {});
    },
    [uid, rutina, dia]
  );

  if (!hayRutinaDiaria(rutina) || !rutina) return null;

  const hechos = hechosDeHoy(dia);
  const p = progresoDiario(rutina, dia);

  return (
    /*
     * NO ES UNA TARJETA MÁS, Y TIENE QUE NOTARSE.
     *
     * Era una `Card` igual que las otras cinco del inicio —mismo fondo, mismo
     * borde, mismo todo— y se perdía entre ellas. El problema no es que
     * estuviera fea: es que esto se hace TODOS los días, y lo que se hace
     * todos los días es justo lo que se olvida cuando no se ve.
     *
     * Lleva el mismo tratamiento que la tarjeta de la sesión de hoy: el
     * degradado dorado y el filo del sistema. Las dos responden a la misma
     * pregunta —"¿qué hago hoy?"— y ahora se parecen entre sí y no al resto.
     */
    <LinearGradient
      colors={gradients.goldSubtle}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
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

      {/* Una línea entre el titular y la lista. Sin ella, con tres ejercicios y
          sus series, la cabecera se leía como una fila más de la lista y el
          número grande perdía todo el trabajo que hace. */}
      <View style={styles.raya} />

      {rutina.ejercicios.map((e) => {
        const series = seriesDe(e);
        /*
         * Con series, una casilla por serie; sin ellas, una sola para todo el
         * ejercicio. Es la diferencia entre poder decir "llevo dos de cinco" a
         * lo largo del día y tener que esperar a terminarlas todas para marcar
         * algo, que en el grease the groove es justo lo que no encaja.
         */
        const conSeries = typeof e.series === 'number' && e.series > 0 && series > 1;
        const marcas = conSeries
          ? Array.from({ length: series }, (_, i) => marcaDeSerie(e.id, i + 1))
          : [e.id];
        const hechasAqui = marcas.filter((m) => hechos.includes(m)).length;
        const entero = hechasAqui === marcas.length;
        const detalle = textoDelEjercicio(e);

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
                    {conSeries ? frase`${hechasAqui} de ${detalle}` : detalle}
                  </Text>
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
    borderColor: colors.hairline,
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
});
