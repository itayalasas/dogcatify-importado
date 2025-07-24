import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { currentUser, authInitialized } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (authInitialized && currentUser !== undefined) {
      setTimeout(() => {
        if (!currentUser) {
          router.replace('/auth/login');
        } else {
          router.replace('/(tabs)');
        }
      }, 500);
    }
  }, [authInitialized, currentUser]);

  if (!authInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D6A6F" />
          <Text style={styles.loadingText}>Iniciando DogCatiFy...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2D6A6F" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 10,
  },
});