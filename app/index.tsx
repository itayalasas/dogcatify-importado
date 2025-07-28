import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

export default function Index() {
  const { currentUser, authInitialized, loading } = useAuth();
  const [isMounted, setIsMounted] = React.useState(false);

  // Asegurar que el componente esté montado
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 100); // Pequeño delay para asegurar que el layout esté listo
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Solo proceder cuando TANTO la autenticación esté inicializada COMO el componente esté montado
    if (!authInitialized || !isMounted) {
      console.log('Not ready yet:', { authInitialized, isMounted });
      return;
    }

    console.log('Auth ready, checking user:', currentUser?.email || 'No user');

    if (!currentUser) {
      console.log('No user found, redirecting to login');
      // Usar setTimeout para asegurar que la navegación ocurra después del render
      setTimeout(() => {
        router.replace('/auth/login');
      }, 50);
    } else {
      console.log('User found, checking admin status');
      const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
      
      if (isAdmin) {
        console.log('Admin user detected, redirecting to admin panel');
        setTimeout(() => {
          router.replace('/(admin-tabs)/requests');
        }, 50);
      } else {
        console.log('Regular user detected, redirecting to main tabs');
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 50);
      }
    }
  }, [currentUser, authInitialized, isMounted]);

  // Mostrar loading mientras se inicializa la autenticación o el componente se monta
  if (!authInitialized || !isMounted) {
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