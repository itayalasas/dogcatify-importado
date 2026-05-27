import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: boolean;
}

const Card: React.FC<CardProps> = ({ 
  children, 
  style, 
  padding = true,
  ...rest
}) => {
  return (
    <View {...rest} style={[styles.card, padding && styles.padding, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  padding: {
    padding: 16,
  },
});

export { Card };
