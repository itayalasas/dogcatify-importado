import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  StyleProp,
  TextInputProps,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, radius, spacing, typography, hitSlop, maxFontScale } from '../../constants/theme';

interface InputProps extends Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText?: (text: string) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  isPasswordVisible?: boolean;
  onTogglePasswordVisibility?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  error?: string;
  /** Texto de ayuda bajo el campo cuando no hay error. */
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  leftIcon,
  rightIcon,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  style,
  containerStyle,
  secureTextEntry = false,
  showPasswordToggle = false,
  isPasswordVisible = false,
  onTogglePasswordVisibility,
  onFocus,
  onBlur,
  error,
  helperText,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const inputStyle: StyleProp<TextStyle> = [
    styles.input,
    leftIcon ? styles.inputWithLeftIcon : null,
    rightIcon || showPasswordToggle ? styles.inputWithRightIcon : null,
    multiline ? styles.multilineInput : null,
    focused ? styles.focusedInput : null,
    !editable ? styles.disabledInput : null,
    error ? styles.errorInput : null,
    style,
  ];

  return (
    <View style={[styles.container, !editable && styles.disabledContainer, containerStyle]}>
      {label ? (
        <Text style={styles.label} maxFontSizeMultiplier={maxFontScale.default}>
          {label}
        </Text>
      ) : null}
      <View style={styles.inputContainer}>
        {leftIcon ? <View style={styles.leftIconContainer}>{leftIcon}</View> : null}

        <TextInput
          {...rest}
          style={inputStyle}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          value={value}
          onChangeText={onChangeText || (() => {})}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          secureTextEntry={secureTextEntry}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? placeholder}
          accessibilityHint={error || rest.accessibilityHint}
          maxFontSizeMultiplier={maxFontScale.default}
          selectionColor={colors.primary}
        />

        {showPasswordToggle ? (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={onTogglePasswordVisibility}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color={colors.icon} />
            ) : (
              <Eye size={20} color={colors.icon} />
            )}
          </TouchableOpacity>
        ) : null}

        {rightIcon && !showPasswordToggle ? (
          <View style={styles.rightIconContainer}>{rightIcon}</View>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  helperText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    ...typography.body,
    lineHeight: undefined,
    color: colors.text,
    minHeight: 50,
  },
  focusedInput: {
    borderColor: colors.primary,
  },
  errorInput: {
    borderColor: colors.danger,
  },
  inputWithLeftIcon: {
    paddingLeft: 48,
  },
  inputWithRightIcon: {
    paddingRight: 48,
  },
  multilineInput: {
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  disabledInput: {
    backgroundColor: colors.background,
    color: colors.textTertiary,
  },
  leftIconContainer: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 1,
  },
  rightIconContainer: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 1,
  },
});
