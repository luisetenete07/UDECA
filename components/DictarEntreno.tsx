import React, { useEffect, useRef, useState } from 'react';
import { frase } from '../lib/idioma';
import { Animated, Easing, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { apuntarEntrenoDictado } from '../lib/apuntarEntreno';
import {
  cuantasSeries,
  hayDictado,
  resumenDelDictado,
  type Dictado,
  type EjercicioDelCatalogo,
} from '../lib/dictado';
import { escuchar, hayEscuchaEnNavegador, type Escucha } from '../lib/voz';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Contarle el entreno a la app en voz alta.
 *
 * "Ayer hice cuatro series de dominadas: ocho, siete, seis y cinco, y fondos
 * con diez kilos, tres de ocho." Eso, dicho, son diez segundos; escrito a mano
 * en la pantalla de registro son treinta toques. Y treinta toques, tres días
 * después de haber entrenado, es exactamente el motivo por el que ese entreno
 * no se apunta nunca.
 *
 * Cómo se oye: con el dictado que ya trae el aparato. En el ordenador, el del
 * navegador, que va escribiendo mientras hablas. En el móvil, el micrófono del
 * teclado, que es el que todo el mundo ya sabe usar y no obliga a instalar
 * nada. La IA no oye audio en ningún caso: lee el texto que sale de ahí.
 *
 * Y antes de tocar nada se enseña lo entendido. No es un paso de más: es el
 * único sitio donde se pilla que ha oído "quince" donde se dijo "cincuenta".
 * Leer tres líneas cuesta un segundo; deshacer un entreno mal apuntado, no.
 */
export function DictarEntreno({
  visible,
  onClose,
  catalogo,
  onAplicar,
}: {
  visible: boolean;
  onClose: () => void;
  catalogo: EjercicioDelCatalogo[];
  /** Rellenar la pantalla con lo dictado y, si se pide, registrarlo ya. */
  onAplicar: (dictado: Dictado, registrar: boolean) => void;
}) {
  const [texto, setTexto] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dictado, setDictado] = useState<Dictado | null>(null);
  const escucha = useRef<Escucha | null>(null);
  const campo = useRef<TextInput>(null);
  const pulso = useRef(new Animated.Value(0)).current;

  // En el navegador se escucha aquí; en el móvil, con el micro del teclado.
  const enNavegador = Platform.OS === 'web' && hayEscuchaEnNavegador();

  useEffect(() => {
    if (!escuchando) {
      pulso.setValue(0);
      return;
    }
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulso, {
          toValue: 0,
          duration: 700,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    bucle.start();
    return () => bucle.stop();
  }, [escuchando, pulso]);

  // Al cerrar el panel se corta la escucha y se borra todo. El micrófono,
  // porque abierto por olvido es lo peor que puede quedarse encendido. Y lo
  // dictado, porque volver a abrir es querer contar otra cosa: encontrarse el
  // resumen de la vez anterior invita a apuntar dos veces el mismo entreno.
  useEffect(() => {
    if (visible) return;
    escucha.current?.parar();
    escucha.current = null;
    setEscuchando(false);
    setDictado(null);
    setTexto('');
    setError(null);
  }, [visible]);

  const parar = () => {
    escucha.current?.parar();
    escucha.current = null;
    setEscuchando(false);
  };

  const alternarMicro = () => {
    if (escuchando) {
      parar();
      return;
    }
    setError(null);
    setDictado(null);
    if (!enNavegador) {
      // El teclado del móvil trae su propio micrófono: se abre el campo y se
      // señala dónde está, en vez de pedir permisos y montar otro grabador.
      campo.current?.focus();
      return;
    }
    const yaHabia = texto.trim();
    const nueva = escuchar({
      onTexto: (t) => setTexto(yaHabia ? `${yaHabia} ${t}` : t),
      onFin: (motivo) => {
        setEscuchando(false);
        escucha.current = null;
        if (motivo === 'not-allowed' || motivo === 'service-not-allowed') {
          setError('El navegador no me deja usar el micrófono. Puedes escribirlo abajo.');
        }
      },
    });
    if (!nueva) {
      setError('Este navegador no sabe escuchar. Escríbelo abajo y lo apunto igual.');
      return;
    }
    escucha.current = nueva;
    setEscuchando(true);
  };

  const interpretar = async () => {
    parar();
    const limpio = texto.trim();
    if (!limpio) {
      setError('Cuéntame primero qué hiciste.');
      return;
    }
    setError(null);
    setPensando(true);
    const { dictado: leido, error: fallo } = await apuntarEntrenoDictado(limpio, catalogo);
    setPensando(false);
    if (fallo || !leido) {
      setError(fallo ?? 'No he podido apuntarlo');
      return;
    }
    if (!hayDictado(leido)) {
      setError('No he sacado ninguna serie de ahí. Prueba a decir el ejercicio y las repeticiones.');
      setDictado(null);
      return;
    }
    setDictado(leido);
  };

  const deNuevo = () => {
    setDictado(null);
    setError(null);
    setTexto('');
  };

  const lineas = dictado ? resumenDelDictado(dictado, catalogo) : [];
  const series = dictado ? cuantasSeries(dictado) : 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      titulo="Cuéntamelo hablando"
      descripcion={
        enNavegador
          ? 'Dale al micro y dime qué hiciste: el ejercicio, las series y las marcas. Lo apunto yo.'
          : 'Toca el micrófono de tu teclado y dime qué hiciste: el ejercicio, las series y las marcas. Lo apunto yo.'
      }
    >
      {!dictado ? (
        <>
          <Pressable
            onPress={alternarMicro}
            style={[styles.micro, escuchando && styles.microActivo]}
            accessibilityLabel={escuchando ? 'Dejar de escuchar' : 'Hablar'}
          >
            <Animated.View
              style={[
                styles.aura,
                {
                  opacity: pulso.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
                  transform: [
                    { scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) },
                  ],
                },
              ]}
              pointerEvents="none"
            />
            <Ionicons
              name={escuchando ? 'stop' : 'mic'}
              size={30}
              color={escuchando ? colors.onPrimary : colors.primary}
            />
          </Pressable>
          <Text style={styles.estado}>
            {escuchando
              ? 'Te escucho. Toca otra vez cuando acabes.'
              : enNavegador
                ? 'Toca para hablar'
                : 'Toca aquí y luego el micro de tu teclado'}
          </Text>

          <Text style={styles.etiqueta}>Lo que has dicho</Text>
          <TextInput
            ref={campo}
            value={texto}
            onChangeText={setTexto}
            multiline
            placeholder="Cuatro series de dominadas: ocho, siete, seis y cinco. Fondos con diez kilos, tres de ocho. Duró unos cuarenta minutos."
            placeholderTextColor={colors.textFaint}
            style={styles.campo}
          />
          <Text style={styles.pista}>
            Puedes retocarlo antes de que lo apunte. Si te sale más fácil escribirlo, escríbelo.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title="Apuntar lo que he dicho"
            onPress={interpretar}
            loading={pensando}
            disabled={!texto.trim()}
          />
        </>
      ) : (
        <>
          <Text style={styles.etiqueta}>Esto es lo que he entendido</Text>
          <View style={styles.resumen}>
            {lineas.map((linea, i) => (
              <View key={i} style={styles.lineaFila}>
                <Ionicons name="checkmark" size={15} color={colors.primaryBright} />
                <Text style={styles.linea}>{linea}</Text>
              </View>
            ))}
          </View>

          {dictado.duracionMin ? (
            <Text style={styles.dato}>Duración: {dictado.duracionMin} min</Text>
          ) : null}
          {dictado.haceDias !== undefined ? (
            <Text style={styles.dato}>
              Día:{' '}
              {dictado.haceDias === 0
                ? 'hoy'
                : dictado.haceDias === 1
                  ? 'ayer'
                  : frase`hace ${dictado.haceDias} días`}
            </Text>
          ) : null}

          {/* Lo que no ha sabido colocar se dice. Callarlo sería dejar que
              alguien registre medio entreno creyendo que está entero. */}
          {dictado.sinIdentificar.length > 0 ? (
            <View style={styles.aviso}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
              <Text style={styles.avisoTexto}>
                Esto no lo he sabido colocar: {dictado.sinIdentificar.join(', ')}. Añádelo tú a mano
                si hace falta.
              </Text>
            </View>
          ) : null}

          <Text style={styles.pista}>
            {series === 1 ? '1 serie' : frase`${series} series`} en{' '}
            {dictado.ejercicios.length === 1
              ? '1 ejercicio'
              : `${dictado.ejercicios.length} ejercicios`}
            . Si algo no cuadra, repítelo y lo apunto otra vez.
          </Text>

          <Button title="Apuntarlo y registrar el entreno" onPress={() => onAplicar(dictado, true)} />
          <View style={styles.separacion} />
          <Button
            title="Solo rellenarlo, ya lo reviso"
            variant="secondary"
            onPress={() => onAplicar(dictado, false)}
          />
          <View style={styles.separacion} />
          <Button title="Repetirlo" variant="ghost" onPress={deNuevo} />
        </>
      )}
    </Sheet>
  );
}

const MICRO = 76;

const styles = StyleSheet.create({
  micro: {
    alignSelf: 'center',
    width: MICRO,
    height: MICRO,
    borderRadius: MICRO / 2,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  microActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  aura: {
    position: 'absolute',
    width: MICRO,
    height: MICRO,
    borderRadius: MICRO / 2,
    backgroundColor: colors.primaryBright,
  },
  estado: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  etiqueta: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  campo: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  pista: {
    ...typography.small,
    color: colors.textFaint,
    lineHeight: 18,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.md, lineHeight: 18 },
  resumen: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  lineaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  linea: { ...typography.small, color: colors.text, flex: 1, lineHeight: 19 },
  dato: { ...typography.small, color: colors.textMuted, marginBottom: 4 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  avisoTexto: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 18 },
  separacion: { height: spacing.sm },
});
