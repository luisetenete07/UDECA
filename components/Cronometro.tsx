import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { Text } from './Texto';
import { frase, t } from '../lib/idioma';
import {
  arrancar,
  CLAVE_CRONOMETRO,
  conVuelta,
  corriendo,
  leerCronometro,
  parciales,
  PARADO,
  pausar,
  textoDelCronometro,
  transcurrido,
  type EstadoCronometro,
} from '../lib/cronometro';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/** Mientras corre, la pantalla no se apaga: el móvil suele estar en el suelo. */
function PantallaEncendida() {
  useKeepAwake('cronometro', { suppressDeactivateWarnings: true });
  return null;
}

/**
 * EL CRONÓMETRO (lib/cronometro.ts): cuenta hacia arriba, con vueltas.
 *
 * Sigue corriendo aunque se cambie de pestaña o se cierre la app: lo que se
 * guarda es la hora a la que arrancó, no lo que lleva.
 */
export function Cronometro() {
  const [estado, setEstado] = useState<EstadoCronometro>(PARADO);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_CRONOMETRO)
      .then((v) => setEstado(leerCronometro(v)))
      .catch(() => {});
  }, []);

  // Solo se repinta mientras corre: parado no hay nada que mover.
  const enMarcha = corriendo(estado);
  useEffect(() => {
    if (!enMarcha) return;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 100);
    return () => clearInterval(id);
  }, [enMarcha]);

  const cambiar = (nuevo: EstadoCronometro) => {
    setEstado(nuevo);
    setAhora(Date.now());
    AsyncStorage.setItem(CLAVE_CRONOMETRO, JSON.stringify(nuevo)).catch(() => {});
  };

  const ms = transcurrido(estado, enMarcha ? ahora : Date.now());
  const vueltas = parciales(estado);
  const hayAlgo = ms > 0 || estado.vueltas.length > 0;

  return (
    <View>
      <Text style={styles.tiempo} accessibilityLabel={t('Tiempo del cronómetro')}>
        {textoDelCronometro(ms)}
      </Text>

      <View style={styles.botones}>
        {/* A la izquierda, lo secundario: vuelta mientras corre, reiniciar
            parado. A la derecha, el grande: empezar, pausar o seguir. */}
        {enMarcha ? (
          <Pressable
            onPress={() => cambiar(conVuelta(estado, Date.now()))}
            style={styles.secundario}
            accessibilityRole="button"
          >
            <Ionicons name="flag-outline" size={17} color={colors.text} />
            <Text style={styles.secundarioTexto}>Vuelta</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => cambiar(PARADO)}
            disabled={!hayAlgo}
            style={[styles.secundario, !hayAlgo && styles.apagado]}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={17} color={colors.text} />
            <Text style={styles.secundarioTexto}>Reiniciar</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => cambiar(enMarcha ? pausar(estado, Date.now()) : arrancar(estado, Date.now()))}
          style={styles.principal}
          accessibilityRole="button"
        >
          <Ionicons name={enMarcha ? 'pause' : 'play'} size={18} color={colors.onPrimary} />
          <Text style={styles.principalTexto}>
            {enMarcha ? t('Pausar') : ms > 0 ? t('Seguir') : t('Empezar')}
          </Text>
        </Pressable>
      </View>

      {vueltas.length > 0 ? (
        <View style={styles.vueltas}>
          {/* La última arriba: es la que se acaba de marcar. */}
          {vueltas
            .map((v, i) => ({ v, i, total: estado.vueltas[i] }))
            .reverse()
            .slice(0, 6)
            .map(({ v, i, total }) => (
              <View key={i} style={styles.vuelta}>
                <Text style={styles.vueltaNum}>{frase`Vuelta ${i + 1}`}</Text>
                <Text style={styles.vueltaTiempo}>{textoDelCronometro(v)}</Text>
                <Text style={styles.vueltaTotal}>{textoDelCronometro(total)}</Text>
              </View>
            ))}
          {vueltas.length > 6 ? (
            <Text style={styles.vueltasMas}>{frase`y ${vueltas.length - 6} más`}</Text>
          ) : null}
        </View>
      ) : null}

      {enMarcha ? <PantallaEncendida /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tiempo: {
    textAlign: 'center',
    color: colors.text,
    fontSize: 48,
    fontFamily: fonts.heading,
    marginTop: spacing.md,
    ...tabularNums,
  },
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
  apagado: { opacity: 0.4 },
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
  principalTexto: { ...typography.body, color: colors.onPrimary, fontFamily: fonts.semiBold },
  vueltas: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  vuelta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineFaint,
  },
  vueltaNum: { ...typography.small, color: colors.textMuted, flex: 1 },
  vueltaTiempo: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, width: 80, textAlign: 'right', ...tabularNums },
  vueltaTotal: { ...typography.small, color: colors.textFaint, width: 80, textAlign: 'right', ...tabularNums },
  vueltasMas: { ...typography.small, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xs },
});
