import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors, spacing } from '../../constants/theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Si se pasa, muestra la flecha de volver. Por defecto vuelve atrás. */
  onBack?: () => void;
  showBack?: boolean;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Encabezado estándar de pantalla interna: volver, título y una acción opcional. */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  showBack = true,
  right,
  style,
}) => (
  <View style={[styles.header, style]}>
    {showBack ? (
      <IconButton
        icon={<ArrowLeft size={24} color={colors.text} />}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')))}
        accessibilityLabel="Volver"
      />
    ) : (
      <View style={styles.side} />
    )}
    <View style={styles.titleBox}>
      <AppText variant="heading" numberOfLines={1} accessibilityRole="header" align="center">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" color="textTertiary" numberOfLines={1} align="center">
          {subtitle}
        </AppText>
      ) : null}
    </View>
    <View style={styles.side}>{right}</View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 56,
  },
  side: { minWidth: 44, alignItems: 'flex-end' },
  titleBox: { flex: 1, paddingHorizontal: spacing.sm },
});
