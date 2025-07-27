import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { currentUser, authInitialized } = useAuth();

  useEffect(() => {
    if (!authInitialized) return;

    if (!currentUser) {
      // No user logged in, go to login
      router.replace('/auth/login');
    } else {
      // User is logged in, check if admin
      const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
      
      if (isAdmin) {
        // Admin user, go to admin panel
        router.replace('/(admin-tabs)/requests');
      } else {
        // Regular user, go to main tabs
        router.replace('/(tabs)');
      }
    }
  }, [currentUser, authInitialized]);

  // Show loading while checking authentication
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2D6A6F" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});