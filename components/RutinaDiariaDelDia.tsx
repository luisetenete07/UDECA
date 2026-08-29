import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from './Texto';
import { frase } from '../lib/idioma';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
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
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { DiaDeRutinaDiaria, RutinaDiaria, UserProfile } from '../lib/types';

/**
 * Lo que toca hacer HOY aparte del entreno, y marcarlo.
 *
 * POR QUÉ VA EN ENTRENO Y NO EN EL INICIO
 *
 * Porque es entrenamiento, y porque el inicio ya tiene la racha, los avisos y
 * el resumen: una cosa más ahí se pierde. En Entreno está donde se está cuando
 * se entrena, que es cuando se acuerda uno del pino.
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
    <Card style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <View style={styles.icono}>
          <Ionicons
            name={p.completa ? 'checkmark-circle' : 'repeat-outline'}
            size={17}
            color={colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo} numberOfLines={1}>
            {rutina.nombre || NOMBRE_POR_DEFECTO}
          </Text>
          <Text style={styles.texto}>{textoDiario(p)}</Text>
        </View>
        <Text style={styles.cuenta}>
          {p.hechos}/{p.total}
        </Text>
      </View>

      <ProgressBar progress={p.ratio} height={6} />

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
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md, gap: spacing.sm },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  icono: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  texto: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  cuenta: {
    ...typography.body,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    flexShrink: 0,
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
