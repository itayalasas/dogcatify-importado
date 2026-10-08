import React, { ReactNode } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../ui/ScreenHeader';
import { spacing } from '../../constants/theme';

interface HealthHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: ReactNode;
}

/**
 * ScreenHeader para las pantallas de salud, con el margen superior de la barra de estado
 * (antes cada pantalla ponía paddingTop: 50 fijo). En iOS el SafeAreaView de la pantalla
 * ya deja ese margen, así que solo se suma en Android.
 */
export const HealthHeader: React.FC<HealthHeaderProps> = (props) => {
  const insets = useSafeAreaInsets();
  return <ScreenHeader {...props} style={{ paddingTop: (Platform.OS === 'ios' ? 0 : insets.top) + spacing.sm }} />;
};
