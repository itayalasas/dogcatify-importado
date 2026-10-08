import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { spacing } from '../../constants/theme';

interface Props {
  displayName?: string | null;
}

const greetingForHour = (hour: number) => {
  if (hour < 12) return 'Buen día';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

/** Saludo del inicio: "Buen día, Ana 👋" + la pregunta que guía la pantalla. */
export function HomeGreeting({ displayName }: Props) {
  const firstName = (displayName || '').trim().split(/\s+/)[0];
  const greeting = greetingForHour(new Date().getHours());

  return (
    <View style={styles.container}>
      <AppText variant="title" accessibilityRole="header">
        {firstName ? `${greeting}, ${firstName} 👋` : `${greeting} 👋`}
      </AppText>
      <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
        ¿Qué necesita tu mascota hoy?
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.xxs,
  },
});
