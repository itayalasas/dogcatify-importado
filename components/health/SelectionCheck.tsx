import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '../../constants/theme';

/** Círculo de selección de los selectores: vacío o con tilde. */
export const SelectionCheck: React.FC<{ selected: boolean }> = ({ selected }) => (
  <View
    style={[styles.circle, selected ? styles.on : styles.off]}
    importantForAccessibility="no-hide-descendants"
  >
    {selected ? <Check size={14} color={colors.onPrimary} strokeWidth={3} /> : null}
  </View>
);

const styles = StyleSheet.create({
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.primary },
  off: { borderWidth: 1.5, borderColor: colors.borderStrong },
});

/** Estilos compartidos de las tarjetas de selector: contenido a la izquierda, tilde a la derecha. */
export const selectorCardStyles = StyleSheet.create({
  card: { marginBottom: 12 },
  selected: { borderWidth: 2, borderColor: colors.primary },
  touchable: { minHeight: 44 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  body: { flex: 1 },
  check: { paddingTop: 2 },
});
