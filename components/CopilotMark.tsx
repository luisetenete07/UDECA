import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../lib/theme';

/**
 * Símbolo del Copiloto UDECA: anilla con aguja de brújula (el copiloto que
 * marca el rumbo del grupo). Trazo monocromo en el dorado de la marca, sin
 * emojis: profesional y consistente con la iconografía de la app.
 */
export function CopilotMark({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Anilla exterior */}
      <Circle cx="12" cy="12" r="9.2" stroke={color} strokeWidth="1.8" />
      {/* Aguja de brújula: mitad rellena (norte) y mitad hueca (sur) */}
      <Path d="M15.8 8.2 L13.4 13.4 L10.6 10.6 Z" fill={color} />
      <Path
        d="M8.2 15.8 L10.6 10.6 L13.4 13.4 Z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
