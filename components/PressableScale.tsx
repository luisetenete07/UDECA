import React, { useRef } from 'react';
import { Animated, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Todo lo que se toca, responde.
 *
 * Se hunde un poco al pulsar y vuelve con muelle al soltar. Parece un detalle
 * tonto y es de las cosas que más separan una app cara de una barata: sin
 * respuesta al tacto, cada pulsación deja medio segundo de duda —"¿lo he
 * pulsado?"— y esa duda es la que se recuerda como "va lenta", aunque los datos
 * lleguen igual de rápido.
 *
 * La escala es pequeña a propósito (0,97). Un botón que se encoge de verdad
 * parece un juguete; este solo confirma.
 *
 * UNA SOLA CAJA, NO DOS
 *
 * Antes esto eran dos: el `Pressable` por fuera y una vista dentro con el
 * estilo y la animación. El estilo caía en la de dentro, así que un `flex: 1`
 * puesto por quien lo usa se aplicaba al hijo y NO al pulsable — que seguía
 * midiendo lo que midieran sus contenidos.
 *
 * En una fila eso hace daño de verdad: en la lista de cuentas de la pantalla de
 * entrar, la columna del nombre pedía su sitio con `flex: 1` dentro de un
 * pulsable que no se había estirado, y se quedaba en cero. Se veía la foto, la
 * flecha y la equis, y en medio nada: ni el nombre ni el tipo de cuenta. La
 * cuenta era imposible de distinguir de la de al lado.
 *
 * Con `createAnimatedComponent` el pulsable ES la caja animada: el estilo va
 * donde quien lo escribe cree que va, y no hay una segunda caja en medio que se
 * quede con lo que no le toca.
 */
const PulsableAnimado = Animated.createAnimatedComponent(Pressable);
export function PressableScale({
  children,
  style,
  haptic = false,
  scaleTo = 0.97,
  ...rest
}: PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Vibración corta al pulsar. Para acciones, no para navegar. */
  haptic?: boolean;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const anima = (hacia: number, muelle: boolean) => {
    Animated.spring(scale, {
      toValue: hacia,
      useNativeDriver: true,
      friction: muelle ? 5 : 9,
      tension: muelle ? 140 : 220,
    }).start();
  };

  return (
    <PulsableAnimado
      onPressIn={(e) => {
        anima(scaleTo, false);
        if (haptic && Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        anima(1, true);
        rest.onPressOut?.(e);
      }}
      {...rest}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </PulsableAnimado>
  );
}
