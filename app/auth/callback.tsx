import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthCallback() {
  const { currentUser } = useAuth();

  useEffect(() => {
    // Handle OAuth callback
    const handleCallback = async () => {
      try {
        // Wait a moment for auth state to update
        setTimeout(() => {
          if (currentUser) {
            // Redirect based on user type
            const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
            if (isAdmin) {
              router.replace('/(admin-tabs)/requests');
            } else {
              router.replace('/(tabs)');
            }
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
      <ActivityIndicator size="large" color="#2D6A6F" />
      <Text style={styles.text}>Completando autenticación...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 16,
  },
});