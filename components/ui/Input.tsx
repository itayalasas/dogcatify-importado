import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  style,
  ...props
}) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, error && styles.error]}>
        {leftIcon && <View style={styles.icon}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, leftIcon && styles.inputWithLeftIcon, style]}
          placeholderTextColor="#9CA3AF"
          {...props}
        />
        {rightIcon && <View style={styles.icon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  icon: {
    paddingHorizontal: 10,
  },
  error: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 3,
    fontFamily: 'Inter-Regular',
  },
});