import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { currentUser, authInitialized, loading } = useAuth();

  useEffect(() => {
    // Solo proceder cuando la autenticación esté completamente inicializada
    if (!authInitialized || loading) {
      console.log('Auth not ready yet:', { authInitialized, loading });
      return;
    }

    console.log('Auth ready, checking user:', currentUser?.email || 'No user');

    if (!currentUser) {
      console.log('No user found, redirecting to login');
      router.replace('/auth/login');
    } else {
      console.log('User found, checking admin status');
      const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
      
      if (isAdmin) {
        console.log('Admin user detected, redirecting to admin panel');
        router.replace('/(admin-tabs)/requests');
      } else {
        console.log('Regular user detected, redirecting to main tabs');
        router.replace('/(tabs)');
      }
    }
  }, [currentUser, authInitialized, loading]);

  // Mostrar loading mientras se inicializa la autenticación
  if (!authInitialized || loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2D6A6F" />
      </View>
    );
  }

  // Fallback loading (no debería llegar aquí normalmente)
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