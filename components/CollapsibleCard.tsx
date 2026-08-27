import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Card } from './Card';
import { colors, fonts, spacing, typography } from '../lib/theme';

/**
 * Tarjeta que se pliega, y que se acuerda de cómo la dejaste.
 *
 * Un panel es de quien lo usa: hay entrenadores que miran los cobros a diario y
 * otros que no los tocan en un mes, y obligar a los dos a bajar por lo mismo es
 * diseñar para un usuario que no existe. Plegado ocupa una línea; abierto, todo.
 *
 * Se guarda en el dispositivo y no en la cuenta a propósito: es una preferencia
 * de cómo miras ESTA pantalla en ESTE móvil, no un ajuste de tu perfil. Que se
 * sincronizara haría que plegar algo en el ordenador te cambiara el móvil.
 */
const CLAVE = (id: string) => `panel-plegado-${id}`;

export function CollapsibleCard({
  id,
  icon,
  title,
  hint,
  children,
  defaultOpen = true,
  style,
}: {
  /** Identificador estable: es la clave con la que se recuerda. */
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  /** Resumen de una línea que se ve incluso plegado. */
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Para separarla de lo que venga después (o del final de la pantalla). */
  style?: StyleProp<ViewStyle>;
}) {
  const [abierto, setAbierto] = useState(defaultOpen);
  const [listo, setListo] = useState(false);
  const giro = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  useEffect(() => {
    AsyncStorage.getItem(CLAVE(id))
      .then((v) => {
        if (v === '0' || v === '1') {
          const ab = v === '1';
          setAbierto(ab);
          giro.setValue(ab ? 1 : 0);
        }
      })
      .catch(() => {})
      .finally(() => setListo(true));
  }, [id, giro]);

  const alternar = () => {
    const nuevo = !abierto;
    setAbierto(nuevo);
    AsyncStorage.setItem(CLAVE(id), nuevo ? '1' : '0').catch(() => {});
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.timing(giro, {
      toValue: nuevo ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Hasta saber cómo lo dejó, se pinta como esté por defecto: parpadear de
  // abierto a cerrado al arrancar es peor que tardar un instante en acertar.
  const visible = listo ? abierto : defaultOpen;

  return (
    <Card style={style}>
      <Pressable onPress={alternar} style={styles.cabecera} hitSlop={6}>
        <Ionicons name={icon} size={16} color={colors.primary} />
        {/* El título arriba y la pista DEBAJO, no al lado.
            Compitiendo por el mismo renglón perdían los dos. Al lado, con la
            pista quieta, el título se cortaba: "Actividad (12 sema…". Y al
            revés, con el título quieto, era el "Código de invitación" —justo el
            dato que el entrenador va a copiar y mandar— el que se quedaba en
            una raya. No hay reparto bueno de 177 píxeles entre dos textos.
            Uno debajo del otro caben enteros los dos, en cualquier móvil. */}
        <View style={styles.textos}>
          <Text style={styles.titulo} numberOfLines={2}>
            {title}
          </Text>
          {!visible && hint ? (
            <Text style={styles.hint} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        <Animated.View
          style={{
            transform: [
              {
                rotate: giro.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-90deg', '0deg'],
                }),
              },
            ],
          }}
        >
          <Ionicons name="chevron-down" size={17} color={colors.textFaint} />
        </Animated.View>
      </Pressable>
      {visible ? <View style={styles.cuerpo}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // `minWidth: 0` para que la columna pueda encogerse de verdad: sin eso, en la
  // web un hijo flexible se planta en su ancho mínimo de contenido y empuja la
  // flecha fuera de la tarjeta.
  textos: { flex: 1, minWidth: 0 },
  titulo: { ...typography.h3, color: colors.text },
  hint: {
    ...typography.small,
    // Un punto menos que el cuerpo: la pista acompaña al título, no compite
    // con él.
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 1,
    fontFamily: fonts.medium,
  },
  cuerpo: { marginTop: spacing.md },
});
