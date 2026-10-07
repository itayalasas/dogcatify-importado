import React, { ReactNode } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { colors, radius, spacing, typography, maxFontScale } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title?: string;
  onPress: () => void;
  /**
   * primary: acción principal (una por pantalla).
   * secondary: acción secundaria con fondo suave de marca.
   * outline: alternativa con borde. ghost: acción terciaria, solo texto.
   * danger: acciones destructivas (eliminar, cancelar pedido).
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Ocupa todo el ancho disponible (por defecto, como antes). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const textColorFor: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  secondary: colors.primary,
  outline: colors.primary,
  ghost: colors.primary,
  danger: colors.white,
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  textStyle,
  children,
  icon,
  iconPosition = 'left',
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const isDisabled = disabled || loading;

  const buttonStyle = [
    styles.button,
    fullWidth && styles.fullWidth,
    styles[variant],
    styles[size],
    isDisabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.text,
    size === 'small' ? styles.smallText : size === 'large' ? styles.largeText : styles.mediumText,
    { color: textColorFor[variant] },
    textStyle,
  ];

  const renderChildren = () =>
    React.Children.toArray(children).map((child, index) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return (
          <Text key={`button-text-${index}`} style={labelStyle} maxFontSizeMultiplier={maxFontScale.compact}>
            {child}
          </Text>
        );
      }
      return child;
    });

  const hasChildren = children !== null && children !== undefined && children !== false;
  const label =
    accessibilityLabel ?? title ?? (typeof children === 'string' ? children : undefined);

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      hitSlop={size === 'small' ? { top: 4, bottom: 4 } : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={textColorFor[variant]} />
      ) : hasChildren ? (
        renderChildren()
      ) : (
        <>
          {icon && iconPosition === 'left' ? <View style={styles.iconLeft}>{icon}</View> : null}
          {title ? (
            <Text style={labelStyle} numberOfLines={1} maxFontSizeMultiplier={maxFontScale.compact}>
              {title}
            </Text>
          ) : null}
          {icon && iconPosition === 'right' ? <View style={styles.iconRight}>{icon}</View> : null}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger,
  },
  small: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
  },
  medium: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  large: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.bodyStrong,
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
    lineHeight: 18,
  },
  mediumText: {
    fontSize: 15,
    lineHeight: 20,
  },
  largeText: {
    fontSize: 16,
    lineHeight: 22,
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});
