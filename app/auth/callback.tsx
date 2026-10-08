import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePostLoginRoute } from '../../utils/onboarding';
import { colors, typography, spacing } from '../../constants/theme';

export default function AuthCallback() {
  const { currentUser } = useAuth();

  useEffect(() => {
    // Handle OAuth callback
    const handleCallback = async () => {
      try {
        // Wait a moment for auth state to update
        setTimeout(() => {
          if (currentUser) {
            resolvePostLoginRoute(currentUser.id, undefined, currentUser)
              .then((nextRoute) => router.replace(nextRoute as any))
              .catch(() => router.replace('/(tabs)'));
          } else {
            // If no user, redirect to login
            router.replace('/auth/login');
          }
        }, 2000);
      } catch (error) {
        console.error('Error handling auth callback:', error);
        router.replace('/auth/login');
      }
    };

    handleCallback();
  }, [currentUser]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text} accessibilityLiveRegion="polite">Ingresando a tu cuenta...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
