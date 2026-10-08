import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Building, Footprints, House, PawPrint, Scissors, ShoppingBag, Stethoscope } from 'lucide-react-native';
import { colors } from '../../constants/theme';

/** Ícono de lucide según el tipo de negocio (reemplaza los emojis). */
export const getBusinessTypeIconComponent = (type?: string) => {
  switch (type) {
    case 'veterinary': return Stethoscope;
    case 'grooming': return Scissors;
    case 'walking': return Footprints;
    case 'boarding': return House;
    case 'shop': return ShoppingBag;
    case 'shelter': return PawPrint;
    default: return Building;
  }
};

interface BusinessTypeAvatarProps {
  type?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Círculo con fondo suave de marca y el ícono del tipo de negocio. */
export const BusinessTypeAvatar: React.FC<BusinessTypeAvatarProps> = ({ type, size = 48, style }) => {
  const Icon = getBusinessTypeIconComponent(type);
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon size={Math.round(size * 0.48)} color={colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
