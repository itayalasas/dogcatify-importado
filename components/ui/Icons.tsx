import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Wrapper components for icons to avoid lucide-react-native compatibility issues
export const ArrowLeft = ({ size = 24, color = '#000' }) => (
  <Text style={[styles.icon, { fontSize: size, color }]}>←</Text>
);

export const ChevronDown = ({ size = 24, color = '#000' }) => (
  <Text style={[styles.icon, { fontSize: size, color }]}>▼</Text>
);

export const Check = ({ size = 24, color = '#000' }) => (
  <Text style={[styles.icon, { fontSize: size, color }]}>✓</Text>
);

export const Mars = ({ size = 24, color = '#000' }) => (
  <Text style={[styles.icon, { fontSize: size, color }]}>♂</Text>
);

export const Venus = ({ size = 24, color = '#000' }) => (
  <Text style={[styles.icon, { fontSize: size, color }]}>♀</Text>
);

export const Search = ({ size = 24, color = '#000' }) => (
  <Text style={[styles.icon, { fontSize: size, color }]}>🔍</Text>
);

const styles = StyleSheet.create({
  icon: {
    fontFamily: 'Inter-Regular',
  },
});
