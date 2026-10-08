import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

type DottyAvatarProps = {
  size?: number;
  /** Dibuja el círculo de fondo con el color de marca. */
  withBackground?: boolean;
};

/**
 * Cara de Dotty: un perrito de orejas caídas con su "punto" en la frente.
 * Se usa en el botón flotante y en el encabezado del chat.
 */
export function DottyAvatar({ size = 40, withBackground = true }: DottyAvatarProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {withBackground && <Circle cx={32} cy={32} r={32} fill="#2D6A6F" />}
      <G transform="translate(32 33) scale(1.16) translate(-32 -33)">
      {/* Orejas */}
      <Path d="M21 19 C12 19 8.5 30 10.5 41 C11.5 46.5 17.5 46.5 19.5 41 L23.5 27 Z" fill="#B7793F" />
      <Path d="M43 19 C52 19 55.5 30 53.5 41 C52.5 46.5 46.5 46.5 44.5 41 L40.5 27 Z" fill="#B7793F" />
      {/* Cabeza y hocico */}
      <Circle cx={32} cy={34} r={16.5} fill="#FFF4E3" />
      <Ellipse cx={32} cy={41} rx={8.5} ry={6.2} fill="#FFFFFF" />
      {/* El punto de Dotty */}
      <Circle cx={32} cy={23.5} r={2.6} fill="#FBBF24" />
      {/* Ojos */}
      <Circle cx={26} cy={32} r={2.5} fill="#1F2937" />
      <Circle cx={38} cy={32} r={2.5} fill="#1F2937" />
      <Circle cx={26.9} cy={31.1} r={0.8} fill="#FFFFFF" />
      <Circle cx={38.9} cy={31.1} r={0.8} fill="#FFFFFF" />
      {/* Mejillas */}
      <Circle cx={22.5} cy={38} r={2.1} fill="#F9A8A8" opacity={0.7} />
      <Circle cx={41.5} cy={38} r={2.1} fill="#F9A8A8" opacity={0.7} />
      {/* Nariz y sonrisa */}
      <Ellipse cx={32} cy={38.2} rx={3.1} ry={2.2} fill="#1F2937" />
      <Path
        d="M32 40.2 V42 M28.4 42.4 Q32 45.6 35.6 42.4"
        stroke="#1F2937"
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      </G>
    </Svg>
  );
}

export default DottyAvatar;
