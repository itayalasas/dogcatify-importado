import React from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';
import { colors, typography, maxFontScale } from '../../constants/theme';

type Variant = keyof typeof typography;
type ColorToken = keyof typeof colors;

interface AppTextProps extends TextProps {
  /** Estilo de la escala tipográfica del tema. */
  variant?: Variant;
  /** Color del tema (por nombre) o un color directo. */
  color?: ColorToken | (string & {});
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}

/** Texto con la escala tipográfica y los colores del tema. */
export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  color = 'text',
  align,
  style,
  maxFontSizeMultiplier = maxFontScale.default,
  ...rest
}) => {
  const resolved = (colors as Record<string, string>)[color] ?? color;
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[typography[variant], { color: resolved }, align ? { textAlign: align } : null, style]}
    />
  );
};
