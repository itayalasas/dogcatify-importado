import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stethoscope, Scissors, Footprints, House, ShoppingBag, PawPrint, Building2, MapPin } from 'lucide-react-native';
import { colors, radius } from '../../constants/theme';

interface BusinessTypeIconProps {
  /** Tipo de negocio (veterinary, grooming, walking, boarding, shop, shelter) o 'place' para lugares. */
  type?: string | null;
  size?: number;
}

/** Ícono del tipo de negocio dentro de un cuadrado suave de marca. Reemplaza a los emojis en el panel admin. */
export const BusinessTypeIcon: React.FC<BusinessTypeIconProps> = ({ type, size = 40 }) => {
  const iconProps = { size: Math.round(size / 2), color: colors.primary };
  let icon: React.ReactNode;
  switch (type) {
    case 'veterinary': icon = <Stethoscope {...iconProps} />; break;
    case 'grooming': icon = <Scissors {...iconProps} />; break;
    case 'walking': icon = <Footprints {...iconProps} />; break;
    case 'boarding': icon = <House {...iconProps} />; break;
    case 'shop': icon = <ShoppingBag {...iconProps} />; break;
    case 'shelter': icon = <PawPrint {...iconProps} />; break;
    case 'place': icon = <MapPin {...iconProps} />; break;
    default: icon = <Building2 {...iconProps} />;
  }
  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {icon}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
