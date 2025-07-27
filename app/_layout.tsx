import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { BiometricProvider } from '../contexts/BiometricContext'; 
import { CartProvider } from '../contexts/CartContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <LanguageProvider>
      <AuthProvider>
        <NotificationProvider>
          <CartProvider>
            <BiometricProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="auth/login" />
                <Stack.Screen name="auth/register" />
                <Stack.Screen name="index" />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
            </BiometricProvider>
          </CartProvider>
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}