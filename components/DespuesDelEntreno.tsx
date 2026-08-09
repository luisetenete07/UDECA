import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { Confetti } from './Confetti';
import { FadeIn, PopIn } from './FadeIn';
import { ScreenContainer } from './ScreenContainer';
import { StatTile } from './StatTile';
import type { Achievement } from '../lib/stats';
import type { PersonalRecord } from '../lib/stats';
import { colors, fonts, radius, shadows, spacing, typography } from '../lib/theme';

/**
 * Lo que se ve DESPUÉS de entrenar, que son dos pantallas y no una:
 *
 *  - `ResumenEntreno`: la de la primera vez, a pantalla completa, con confeti,
 *    los récords y los logros recién desbloqueados. Se ve una sola vez, justo
 *    al pulsar "Terminar", y es una celebración.
 *  - `TarjetaTerminado`: la del resto del día, dentro de la pantalla de
 *    entreno. Ya no celebra nada; solo recuerda lo que se hizo y ofrece
 *    salidas.
 *
 * Están juntas porque comparten las cifras y media hoja de estilos, y estaban
 * las dos metidas en app/(client)/workout.tsx, que ya pasaba de 2.700 líneas.
 * Separarlas de ahí no es solo cuestión de tamaño: son la parte que más se
 * toca cuando se quiere cambiar cómo se celebra un entreno, y ahí dentro había
 * que encontrarlas primero.
 *
 * Las dos ofrecen corregir el entreno: es donde se cae en la cuenta de que
 * faltaba una serie o de que el dedo se fue.
 */

export interface CifrasSesion {
  durationMin?: number;
  sets: number;
  reps: number;
  seconds: number;
  volumeKg: number;
}

/**
 * Las cifras de la sesión. Estaban escritas dos veces, una en cada pantalla, y
 * con los mismos cinco `if` para esconder las que no aplican: el volumen solo
 * si se ha levantado peso, el isométrico solo si se ha aguantado algo.
 */
function Cifras({ datos }: { datos: CifrasSesion }) {
  return (
    <>
      {datos.durationMin ? (
        <View style={styles.tileHalf}>
          <StatTile icon="time" value={`${datos.durationMin} min`} label="Duración" />
        </View>
      ) : null}
      <View style={styles.tileHalf}>
        <StatTile icon="layers" value={`${datos.sets}`} label="Series" />
      </View>
      <View style={styles.tileHalf}>
        <StatTile icon="repeat" value={`${datos.reps}`} label="Reps" />
      </View>
      {datos.seconds > 0 ? (
        <View style={styles.tileHalf}>
          <StatTile icon="hourglass" value={`${datos.seconds}s`} label="Isométrico" />
        </View>
      ) : null}
      {datos.volumeKg > 0 ? (
        <View style={styles.tileHalf}>
          <StatTile
            icon="barbell"
            value={`${datos.volumeKg.toLocaleString('es-ES')} kg`}
            label="Volumen"
          />
        </View>
      ) : null}
    </>
  );
}

/** El enlace discreto para arreglar un entreno mal terminado. */
function EnlaceCorregir({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.enlace} hitSlop={8}>
      <Ionicons name="create-outline" size={14} color={colors.textMuted} />
      <Text style={styles.enlaceTexto}>{texto}</Text>
    </Pressable>
  );
}

/** Los números de racha que la gente cuenta de verdad. */
const HITOS = [7, 14, 30, 50, 100, 200, 365];

function textoDeRacha(dias: number): string {
  const hito = HITOS.includes(dias) ? dias : null;
  if (hito === 7) return 'Una semana seguida entrenando.';
  if (hito === 30) return '¡Un mes entero de racha!';
  if (hito === 365) return 'Un año. Trescientos sesenta y cinco días.';
  if (hito) return `¡${hito} días de racha!`;
  return `Racha de ${dias} días. Sigue así.`;
}

export function ResumenEntreno({
  cifras,
  titulo,
  subtitulo,
  prs,
  logros,
  racha,
  onCompartir,
  onCompartirRecord,
  onIrAInicio,
  onCorregir,
}: {
  cifras: CifrasSesion;
  titulo: string;
  subtitulo: string;
  prs: PersonalRecord[];
  logros: Achievement[];
  racha: number;
  onCompartir: () => void;
  onCompartirRecord: () => void;
  onIrAInicio: () => void;
  onCorregir: () => void;
}) {
  // Los hitos se celebran aparte: una racha de 30 días no puede anunciarse con
  // la misma frase que una de 3.
  const hito = HITOS.includes(racha) ? racha : null;

  return (
    <ScreenContainer contentStyle={styles.resumenContenido}>
      <Confetti />
      <PopIn style={{ alignSelf: 'center' }}>
        <View style={styles.medallaGrande}>
          <Ionicons name="checkmark" size={44} color={colors.onPrimary} />
        </View>
      </PopIn>
      <FadeIn delay={150}>
        <Text style={styles.resumenTitulo}>{titulo}</Text>
        <Text style={styles.resumenSubtitulo}>{subtitulo}</Text>
      </FadeIn>

      <FadeIn delay={300} style={styles.cifras}>
        <Cifras datos={cifras} />
      </FadeIn>

      {prs.length > 0 ? (
        <FadeIn delay={450}>
          <Card accent style={styles.tarjetaLogro}>
            <View style={styles.cabeceraLogro}>
              <Ionicons name="trophy" size={18} color={colors.primary} />
              <Text style={styles.tituloLogro}>
                {prs.length === 1 ? 'Nuevo récord personal' : 'Nuevos récords personales'}
              </Text>
            </View>
            {prs.map((pr) => (
              <View key={pr.exerciseName} style={styles.filaLogro}>
                <Text style={styles.nombreLogro}>{pr.exerciseName}</Text>
                <Text style={styles.marcaLogro}>{pr.label}</Text>
              </View>
            ))}
            <Button
              title="Compartir récord"
              variant="secondary"
              onPress={onCompartirRecord}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </FadeIn>
      ) : null}

      {logros.length > 0 ? (
        <FadeIn delay={550}>
          <Card accent style={styles.tarjetaLogro}>
            <View style={styles.cabeceraLogro}>
              <Ionicons name="medal" size={18} color={colors.primary} />
              <Text style={styles.tituloLogro}>
                {logros.length === 1 ? 'Logro desbloqueado' : 'Logros desbloqueados'}
              </Text>
            </View>
            {logros.map((a) => (
              <View key={a.id} style={styles.filaLogro}>
                <View style={styles.filaIcono}>
                  <Ionicons
                    name={a.icon as keyof typeof Ionicons.glyphMap}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.nombreLogro}>{a.title}</Text>
                </View>
                <Text style={styles.descripcionLogro}>{a.description}</Text>
              </View>
            ))}
          </Card>
        </FadeIn>
      ) : null}

      {racha > 1 ? (
        <View style={[styles.filaRacha, hito ? styles.rachaHito : null]}>
          <Ionicons
            name="flame"
            size={hito ? 22 : 18}
            color={hito ? colors.primaryBright : colors.primary}
          />
          <Text style={[styles.textoRacha, hito ? styles.textoRachaGrande : null]}>
            {textoDeRacha(racha)}
          </Text>
        </View>
      ) : null}

      <Text style={styles.nota}>Guardado en tu progreso · pestaña Entrenos</Text>
      <Button title="Compartir mi sesión" onPress={onCompartir} style={{ marginTop: spacing.md }} />
      <Button title="Ir a inicio" onPress={onIrAInicio} style={{ marginTop: spacing.sm }} />
      {/* Aquí es donde se cae en la cuenta: la pantalla que sale justo después
          de pulsar "Terminar". Si el resumen dice menos series de las que se
          hicieron, la salida tiene que estar a la vista, no al día siguiente. */}
      <EnlaceCorregir texto="Me faltan series · corregirlo" onPress={onCorregir} />
    </ScreenContainer>
  );
}

export function TarjetaTerminado({
  cifras,
  titulo,
  onCompartir,
  onVerProgreso,
  onIrAInicio,
  onCorregir,
  onOtroEntreno,
}: {
  cifras: CifrasSesion;
  titulo: string;
  onCompartir: () => void;
  onVerProgreso: () => void;
  onIrAInicio: () => void;
  onCorregir: () => void;
  /** Solo en Sensaciones, donde se puede encadenar otra sesión el mismo día. */
  onOtroEntreno?: () => void;
}) {
  return (
    <FadeIn>
      <Card accent style={styles.tarjeta}>
        <PopIn style={{ alignSelf: 'center' }}>
          <View style={styles.medalla}>
            <Ionicons name="checkmark" size={38} color={colors.onPrimary} />
          </View>
        </PopIn>
        <Text style={styles.tarjetaTitulo}>Entrenamiento terminado</Text>
        <Text style={styles.tarjetaSubtitulo}>{titulo}</Text>
        <View style={styles.cifrasTarjeta}>
          <Cifras datos={cifras} />
        </View>
        <Text style={styles.nota}>
          Guardado en tu progreso · pestaña Entrenos. Vuelve mañana para tu próxima sesión.
        </Text>
        {/* Si se le fue el dedo o se dejó una serie sin apuntar, aquí se
            arregla. Discreto y debajo: es la salida de un error, no algo que
            haya que ofrecer al que ha terminado bien. */}
        <EnlaceCorregir texto="Corregir este entreno" onPress={onCorregir} />
        <Button title="Compartir sesión" onPress={onCompartir} style={{ marginTop: spacing.md }} />
        <Button
          title="Ver mi progreso"
          variant="secondary"
          onPress={onVerProgreso}
          style={{ marginTop: spacing.sm }}
        />
        <Button
          title="Ir a inicio"
          variant="ghost"
          onPress={onIrAInicio}
          style={{ marginTop: spacing.sm }}
        />
        {onOtroEntreno ? (
          <Pressable onPress={onOtroEntreno} style={styles.enlace} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.enlaceTexto}>Hacer otro entrenamiento hoy</Text>
          </Pressable>
        ) : null}
      </Card>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  // ----- Compartido por las dos -----
  tileHalf: { width: '48%' },
  nota: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  enlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  enlaceTexto: { ...typography.small, color: colors.textMuted, fontSize: 12 },

  // ----- Resumen a pantalla completa -----
  resumenContenido: { flexGrow: 1, justifyContent: 'center' },
  medallaGrande: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
    ...shadows.glowGold,
  },
  resumenTitulo: { ...typography.h1, color: colors.text, textAlign: 'center' },
  resumenSubtitulo: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  cifras: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    marginBottom: spacing.md,
  },
  tarjetaLogro: { marginBottom: spacing.md },
  cabeceraLogro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tituloLogro: { ...typography.h3, color: colors.primaryBright },
  filaLogro: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nombreLogro: { ...typography.body, color: colors.text },
  marcaLogro: { ...typography.body, color: colors.primary, fontFamily: fonts.semiBold },
  filaIcono: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  descripcionLogro: {
    ...typography.small,
    color: colors.textMuted,
    flexShrink: 1,
    textAlign: 'right',
  },
  filaRacha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  rachaHito: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  textoRacha: { ...typography.body, color: colors.textMuted },
  textoRachaGrande: { ...typography.h3, color: colors.primaryBright },

  // ----- Tarjeta dentro de la pantalla de entreno -----
  tarjeta: { alignItems: 'stretch', marginBottom: spacing.md },
  medalla: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.glowGold,
  },
  tarjetaTitulo: { ...typography.h2, color: colors.text, textAlign: 'center' },
  tarjetaSubtitulo: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  cifrasTarjeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
});
