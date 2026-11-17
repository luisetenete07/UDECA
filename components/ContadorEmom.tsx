import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Text } from './Texto';
import { Card } from './Card';
import { frase, t } from '../lib/idioma';
import { playBeep, playTick, primeAudio } from '../lib/sound';
import { programarAvisosDelEmom, quitarAvisosDelEmom, TOPE_AVISOS_EMOM } from '../lib/notifications';
import {
  arrancarEmom,
  avisoAlPasar,
  CLAVE_EMOM,
  cuantoDe,
  emomParado,
  enMarcha,
  intervaloDelDia,
  leerEmom,
  mmss,
  momentoDelEmom,
  pausarEmom,
  PREVIA_MS,
  proximasRondas,
  resumenDelEmom,
  rondasDelEmom,
  SEGUNDOS_DE_AVISO,
  segundosQueSeVen,
  transcurridoEmom,
  type EstadoEmom,
  type Momento,
} from '../lib/emom';
import type { ExerciseMeasure, RoutineDay, RoutineExercise } from '../lib/types';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/** Mientras corre, la pantalla no se apaga: el móvil suele estar en el suelo. */
function PantallaEncendida() {
  useKeepAwake('emom', { suppressDeactivateWarnings: true });
  return null;
}

/**
 * EL CONTADOR DEL EMOM (lib/emom.ts), en los días que el entrenador marca así.
 *
 * Grande lo que se mira desde lejos: cuánto queda de la ronda y en cuál va.
 * Debajo, qué toca ahora y qué viene después. Suena al empezar cada ronda y en
 * los tres últimos segundos; en el móvil, cada ronda es además un aviso del
 * sistema, que suena aunque esté bloqueado.
 */
export function ContadorEmom({
  day,
  medidaDe,
}: {
  day: RoutineDay;
  medidaDe: (ex: RoutineExercise) => ExerciseMeasure | undefined;
}) {
  const intervalo = intervaloDelDia(day);
  const rondas = useMemo(() => rondasDelEmom(day.exercises), [day.exercises]);
  const total = rondas.length;
  const [estado, setEstado] = useState<EstadoEmom>(() => emomParado(day.id));
  const [ahora, setAhora] = useState(() => Date.now());
  const anterior = useRef<Momento | null>(null);

  useEffect(() => {
    setEstado(emomParado(day.id));
    anterior.current = null;
    AsyncStorage.getItem(CLAVE_EMOM)
      .then((v) => setEstado(leerEmom(v, day.id)))
      .catch(() => {});
  }, [day.id]);

  const corriendo = enMarcha(estado);
  useEffect(() => {
    if (!corriendo) return;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 200);
    // Al volver de segundo plano, a la ronda en la que de verdad se está, sin
    // pitar por todas las que pasaron.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        anterior.current = null;
        setAhora(Date.now());
      }
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [corriendo]);

  const ms = transcurridoEmom(estado, corriendo ? ahora : Date.now());
  const momento = momentoDelEmom(ms, intervalo, total);

  // Los avisos al pasar de un segundo a otro: el de empezar ronda, la cuenta
  // de los últimos segundos y el final.
  useEffect(() => {
    if (!corriendo) {
      anterior.current = null;
      return;
    }
    const aviso = avisoAlPasar(anterior.current, momento);
    anterior.current = momento;
    if (aviso === 'ronda' || aviso === 'fin') {
      if (Platform.OS === 'web') playBeep();
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (aviso === 'cuenta') {
      if (Platform.OS === 'web') playTick();
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (momento.fase === 'fin') guardar(pausarEmom(estado, Date.now()));
  });

  const nombreDe = (i: number) => {
    const ex = day.exercises[i];
    const cuanto = cuantoDe(ex, medidaDe(ex));
    return cuanto ? `${ex.name} · ${cuanto}` : ex.name;
  };

  const guardar = (nuevo: EstadoEmom) => {
    setEstado(nuevo);
    setAhora(Date.now());
    AsyncStorage.setItem(CLAVE_EMOM, JSON.stringify(nuevo)).catch(() => {});
  };

  const textoDeRonda = (r: number) =>
    intervalo === 60 ? frase`Minuto ${r + 1} de ${total}` : frase`Ronda ${r + 1} de ${total}`;

  // Los avisos del sistema, de aquí al final: cada ronda que empieza, y el fin.
  const programar = (desdeMs: number) => {
    const avisos = proximasRondas(desdeMs, intervalo, total, TOPE_AVISOS_EMOM).map(({ ronda, enMs }) =>
      ronda >= total
        ? { enMs, titulo: t('EMOM terminado') }
        : { enMs, titulo: textoDeRonda(ronda), cuerpo: rondas[ronda].map(nombreDe).join(' + ') }
    );
    programarAvisosDelEmom(avisos);
  };

  const empezar = () => {
    primeAudio();
    const base = momento.fase === 'fin' ? emomParado(day.id) : estado;
    const nuevo = arrancarEmom(base, Date.now());
    anterior.current = null;
    guardar(nuevo);
    programar(transcurridoEmom(nuevo, Date.now()));
  };

  const pausar = () => {
    quitarAvisosDelEmom();
    guardar(pausarEmom(estado, Date.now()));
  };

  const reiniciar = () => {
    quitarAvisosDelEmom();
    guardar(emomParado(day.id));
  };

  if (total === 0) return null;

  const sinEmpezar = !corriendo && ms === 0;
  const terminado = momento.fase === 'fin';
  const segundos = sinEmpezar ? intervalo : segundosQueSeVen(momento);
  const ultimos = corriendo && momento.fase !== 'fin' && segundos <= SEGUNDOS_DE_AVISO;
  const actual = momento.fase === 'ronda' ? momento.ronda : 0;
  const siguiente = actual + 1;

  const donde = momento.fase === 'ronda' ? textoDeRonda(momento.ronda) : t('Prepárate');
  const rotulo = terminado
    ? t('EMOM terminado')
    : sinEmpezar
      ? t('Listo para empezar')
      : corriendo
        ? donde
        : frase`${donde} · en pausa`;
  // En la ronda, lo que queda es lo que se descansa al acabar las repeticiones.
  const progreso = terminado ? 1 : momento.fase === 'ronda' ? (momento.ronda + 1 - momento.quedanMs / (intervalo * 1000)) / total : 0;

  return (
    <Card accent style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <Ionicons name="timer-outline" size={18} color={colors.primaryBright} />
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>EMOM</Text>
          <Text style={styles.subtitulo}>
            {frase`${resumenDelEmom(total, intervalo)} · ${mmss(total * intervalo)} en total`}
          </Text>
        </View>
      </View>

      <Text
        style={[styles.tiempo, ultimos && styles.tiempoUltimos, (sinEmpezar || terminado) && styles.tiempoQuieto]}
        accessibilityLabel={t('Tiempo de la ronda')}
      >
        {terminado ? mmss(total * intervalo) : mmss(segundos)}
      </Text>
      <Text style={[styles.rotulo, terminado && { color: colors.success }]}>{rotulo}</Text>

      <View style={styles.pista}>
        <View style={[styles.relleno, { width: `${Math.max(0, Math.min(1, progreso)) * 100}%` }]} />
      </View>

      {terminado ? (
        <Text style={styles.hecho}>{frase`${total} rondas hechas. Buen trabajo.`}</Text>
      ) : (
        <View style={styles.ahora}>
          <Text style={styles.ahoraRotulo}>
            {momento.fase === 'ronda' ? t('Esta ronda') : t('Empiezas con')}
          </Text>
          {rondas[actual].map((i) => (
            <Text key={i} style={styles.ahoraTexto}>
              {nombreDe(i)}
            </Text>
          ))}
          {momento.fase === 'ronda' && siguiente < total ? (
            <Text style={styles.despues}>
              {frase`Después: ${rondas[siguiente].map(nombreDe).join(' + ')}`}
            </Text>
          ) : momento.fase === 'ronda' ? (
            <Text style={styles.despues}>Es la última</Text>
          ) : null}
          {momento.fase === 'ronda' ? (
            <Text style={styles.ayuda}>Lo que sobre del tiempo es tu descanso.</Text>
          ) : null}
        </View>
      )}

      <View style={styles.botones}>
        {!corriendo && !sinEmpezar ? (
          <Pressable onPress={reiniciar} style={styles.secundario} accessibilityRole="button">
            <Ionicons name="refresh" size={17} color={colors.text} />
            <Text style={styles.secundarioTexto}>Reiniciar</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={corriendo ? pausar : empezar}
          style={[styles.principal, corriendo && styles.principalPausa]}
          accessibilityRole="button"
        >
          <Ionicons name={corriendo ? 'pause' : 'play'} size={18} color={corriendo ? colors.text : colors.onPrimary} />
          <Text style={[styles.principalTexto, corriendo && { color: colors.text }]}>
            {corriendo
              ? t('Pausar')
              : terminado
                ? t('Volver a empezar')
                : sinEmpezar
                  ? t('Empezar EMOM')
                  : t('Seguir')}
          </Text>
        </Pressable>
      </View>
      {sinEmpezar ? (
        <Text style={styles.nota}>{frase`Tienes ${PREVIA_MS / 1000} segundos para colocarte antes de la primera ronda.`}</Text>
      ) : null}

      {corriendo ? <PantallaEncendida /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  subtitulo: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  tiempo: {
    textAlign: 'center',
    color: colors.primaryBright,
    fontSize: 72,
    lineHeight: 80,
    fontFamily: fonts.heading,
    marginTop: spacing.md,
    ...tabularNums,
  },
  tiempoUltimos: { color: colors.warning },
  tiempoQuieto: { color: colors.text },
  rotulo: { ...typography.label, color: colors.textMuted, textAlign: 'center', textTransform: 'uppercase' },
  pista: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden', marginTop: spacing.md },
  relleno: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
  ahora: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  ahoraRotulo: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2 },
  ahoraTexto: { ...typography.h3, color: colors.text },
  despues: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  ayuda: { ...typography.small, color: colors.textFaint, fontSize: 12, marginTop: 2 },
  hecho: { ...typography.body, color: colors.text, textAlign: 'center', marginTop: spacing.md },
  botones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secundario: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  secundarioTexto: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  principal: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  principalPausa: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  principalTexto: { ...typography.body, color: colors.onPrimary, fontFamily: fonts.semiBold },
  nota: { ...typography.small, color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
});
