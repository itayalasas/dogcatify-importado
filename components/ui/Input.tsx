import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  style?: ViewStyle;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  isPasswordVisible?: boolean;
  onTogglePasswordVisibility?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
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
  secureTextEntry = false,
  showPasswordToggle = false,
  isPasswordVisible = false,
  onTogglePasswordVisibility,
  onFocus,
  onBlur,
}) => {
  const inputStyle: TextStyle[] = [
    styles.input,
    leftIcon && styles.inputWithLeftIcon,
    (rightIcon || showPasswordToggle) && styles.inputWithRightIcon,
    multiline && styles.multilineInput,
    !editable && styles.disabledInput,
    style,
  ];

  const containerStyle: ViewStyle[] = [
    styles.container,
    !editable && styles.disabledContainer,
  ];

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputContainer}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          style={inputStyle}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          secureTextEntry={secureTextEntry}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        
        {showPasswordToggle && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={onTogglePasswordVisibility}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color="#6B7280" />
            ) : (
              <Eye size={20} color="#6B7280" />
            )}
          </TouchableOpacity>
        )}
        
        {rightIcon && !showPasswordToggle && (
          <View style={styles.rightIconContainer}>
            {rightIcon}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 6,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    minHeight: 50,
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
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  leftIconContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  rightIconContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
  },
});