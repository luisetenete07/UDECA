import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { EMBLEMA_D, EMBLEMA_VIEWBOX, LOGOTIPO_D, LOGOTIPO_VIEWBOX } from '../lib/marcaCalico';

/** El emblema de CALICO (la C), al alto que se pida. Blanco, como la marca. */
export function Emblema({ alto, color = '#FFFFFF' }: { alto: number; color?: string }) {
  const { ancho: w, alto: h } = EMBLEMA_VIEWBOX;
  return (
    <Svg width={(alto * w) / h} height={alto} viewBox={`0 0 ${w} ${h}`}>
      <Path d={EMBLEMA_D} fill={color} />
    </Svg>
  );
}

/** El logotipo entero, "CALICO" con su C, al ancho que se pida. */
export function Logotipo({ ancho, color = '#FFFFFF' }: { ancho: number; color?: string }) {
  const { ancho: w, alto: h } = LOGOTIPO_VIEWBOX;
  return (
    <Svg width={ancho} height={(ancho * h) / w} viewBox={`0 0 ${w} ${h}`}>
      <Path d={LOGOTIPO_D} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
