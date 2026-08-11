import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, type StyleProp, type TextStyle } from 'react-native';
import { conMiles } from '../lib/texto';

/**
 * Una cifra que sube hasta su valor al entrar en pantalla.
 *
 * No es un adorno: un número que aparece ya puesto se lee: uno que sube se
 * MIRA. Es medio segundo de atención sobre el dato que más importa de la
 * pantalla, y es la diferencia entre un panel que se consulta y uno que se
 * disfruta abriendo.
 *
 * Dura poco a propósito. Una animación que se hace esperar deja de ser un
 * premio a la tercera vez que abres la app.
 */
export function CountUp({
  value,
  duration = 700,
  decimals = 0,
  suffix = '',
  prefix = '',
  style,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  style?: StyleProp<TextStyle>;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(value);
  const anterior = useRef(0);

  useEffect(() => {
    const desde = anterior.current;
    anterior.current = value;
    // Sin recorrido no hay nada que animar: se pinta y ya.
    if (desde === value) {
      setVisible(value);
      return;
    }
    anim.setValue(0);
    const id = anim.addListener(({ value: t }) => {
      setVisible(desde + (value - desde) * t);
    });
    const a = Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      // El valor se lee en JS para poder formatearlo como texto.
      useNativeDriver: false,
    });
    a.start(() => setVisible(value));
    return () => {
      a.stop();
      anim.removeListener(id);
    };
  }, [anim, value, duration]);

  /*
   * El formato se escribe a mano y no con `toLocaleString`: esa función
   * depende de los datos de idioma que traiga el motor, y en un Android con
   * ICU recortado devuelve "8000" donde un iPhone devuelve "8.000". La misma
   * pantalla no puede verse distinta según el móvil.
   */
  const texto =
    decimals > 0
      ? `${conMiles(Math.trunc(visible))},${Math.abs(visible % 1)
          .toFixed(decimals)
          .slice(2)}`
      : conMiles(visible);

  return (
    <Text style={style}>
      {prefix}
      {texto}
      {suffix}
    </Text>
  );
}
