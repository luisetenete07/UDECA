import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from './Texto';
import { Card } from './Card';
import { Button } from './Button';
import { Chip, ChipRow } from './Chip';
import { showToast } from './Toast';
import { t } from '../lib/idioma';
import { CLAVE, conPaso, etiquetaDeTiempo, leerTiempo, MAXIMO, MINIMO, mmss, PRESETS, tiempoGuardado } from '../lib/cronoLibre';
import { startRest, useActiveRest } from '../lib/restTimerStore';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/**
 * EL TEMPORIZADOR DE DESCANSO SUELTO (lib/cronoLibre.ts).
 *
 * Para el alumno sin rutina en la app: elige cuánto descansar —de un toque,
 * de 15 en 15 o escribiéndolo— y lo lanza. La cuenta atrás es la del entreno:
 * sigue aunque cambie de pantalla, suena y vibra al acabar. El último tiempo
 * se recuerda en el móvil, que casi siempre es el mismo serie tras serie.
 */
export function CronoDeDescanso() {
  const [segundos, setSegundos] = useState<number>(tiempoGuardado(null));
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const corriendo = useActiveRest();

  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((v) => v && setSegundos(tiempoGuardado(v)))
      .catch(() => {});
  }, []);

  const elegir = (s: number) => {
    setSegundos(s);
    AsyncStorage.setItem(CLAVE, String(s)).catch(() => {});
  };

  const terminarDeEscribir = () => {
    if (escribiendo === null) return;
    const leido = leerTiempo(escribiendo);
    if (leido === null) showToast('Escribe el tiempo así: 1:30, o en segundos: 90');
    else elegir(leido);
    setEscribiendo(null);
  };

  return (
    <Card style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <View style={styles.icono}>
          <Ionicons name="hourglass-outline" size={18} color={colors.primaryBright} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Temporizador de descanso</Text>
          <Text style={styles.subtitulo}>
            Elige cuánto quieres descansar entre series. Suena al terminar, aunque cambies de pantalla.
          </Text>
        </View>
      </View>

      <View style={styles.reloj}>
        <Pressable
          onPress={() => elegir(conPaso(segundos, -1))}
          disabled={segundos <= MINIMO}
          style={styles.paso}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('Quitar 15 segundos')}
        >
          <Ionicons name="remove" size={24} color={segundos <= MINIMO ? colors.textFaint : colors.text} />
        </Pressable>
        <TextInput
          value={escribiendo ?? mmss(segundos)}
          onFocus={() => setEscribiendo(mmss(segundos))}
          onChangeText={setEscribiendo}
          onBlur={terminarDeEscribir}
          onSubmitEditing={terminarDeEscribir}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={5}
          style={styles.tiempo}
          accessibilityLabel={t('Tiempo de descanso')}
        />
        <Pressable
          onPress={() => elegir(conPaso(segundos, 1))}
          disabled={segundos >= MAXIMO}
          style={styles.paso}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('Añadir 15 segundos')}
        >
          <Ionicons name="add" size={24} color={segundos >= MAXIMO ? colors.textFaint : colors.text} />
        </Pressable>
      </View>
      <Text style={styles.ayuda}>Toca el tiempo para escribirlo (ej. 1:20)</Text>

      <ChipRow>
        {PRESETS.map((s) => (
          <Chip key={s} texto={etiquetaDeTiempo(s)} compacto activo={segundos === s} onPress={() => elegir(s)} />
        ))}
      </ChipRow>

      <Button
        title={corriendo ? 'Volver a empezar' : 'Empezar descanso'}
        onPress={() => startRest(segundos)}
        style={styles.empezar}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2 },
  icono: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  subtitulo: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  reloj: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  paso: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  tiempo: {
    minWidth: 132,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    textAlign: 'center',
    color: colors.text,
    fontSize: 48,
    fontFamily: fonts.heading,
    ...tabularNums,
  },
  ayuda: { ...typography.small, color: colors.textFaint, textAlign: 'center', fontSize: 12, marginTop: 2, marginBottom: spacing.md },
  empezar: { marginTop: spacing.md },
});
