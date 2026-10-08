import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing } from '../../constants/theme';
import { AppText } from '../ui/AppText';

interface AdminDetailRowProps {
  /** Componente de ícono de lucide, por ejemplo MapPin. */
  icon: React.ComponentType<{ size?: number; color?: string }>;
  text?: string | number | null;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fila de dato con ícono (dirección, teléfono, fecha...). No se muestra si no hay texto. */
export const AdminDetailRow: React.FC<AdminDetailRowProps> = ({ icon: Icon, text, numberOfLines = 1, style }) => {
  if (text === undefined || text === null || text === '') return null;
  return (
    <View style={[styles.row, style]}>
      <Icon size={14} color={colors.textTertiary} />
      <AppText variant="bodySmall" color="textSecondary" numberOfLines={numberOfLines} style={styles.text}>
        {String(text)}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  text: {
    flex: 1,
    marginLeft: spacing.sm,
  },
});
