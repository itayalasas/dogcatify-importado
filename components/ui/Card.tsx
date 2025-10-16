import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: boolean;
}

const Card: React.FC<CardProps> = ({ 
  children, 
  style, 
  padding = true 
}) => {
  return (
    <View style={[styles.card, padding && styles.padding, style]}>
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