import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { BiometricProvider } from '../contexts/BiometricContext'; 
import { CartProvider } from '../contexts/CartContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { Platform } from 'react-native';

export default function RootLayout() {
  useFrameworkReady();

  // Determine initial route based on platform
  const initialRouteName = Platform.OS === 'web' ? 'web-info' : '(tabs)';

  return (
    <LanguageProvider>
      <AuthProvider>
        <BiometricProvider>
          <NotificationProvider>
            <CartProvider>
              <Stack screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(admin-tabs)" />
                <Stack.Screen name="(partner-tabs)" />
                <Stack.Screen name="web-info" />
                <Stack.Screen name="auth/login" />
                <Stack.Screen name="auth/register" />
                <Stack.Screen name="auth/forgot-password" />
                <Stack.Screen name="auth/confirm" />
                <Stack.Screen name="auth/mercadopago/callback" />
                <Stack.Screen name="pets/add" />
                <Stack.Screen name="pets/breed-selector" />
                <Stack.Screen name="pets/[id]" />
                <Stack.Screen name="pets/albums/add/[id]" />
                <Stack.Screen name="pets/albums/[id]" />
                <Stack.Screen name="pets/behavior/[id]" />
                <Stack.Screen name="pets/appointments/[id]" />
                <Stack.Screen name="pets/health/vaccines/[id]" />
                <Stack.Screen name="pets/health/illness/[id]" />
                <Stack.Screen name="pets/health/allergies/[id]" />
                <Stack.Screen name="pets/health/deworming/[id]" />
                <Stack.Screen name="pets/health/weight/[id]" />
                <Stack.Screen name="services/[id]" />
                <Stack.Screen name="services/partner/[id]" />
                <Stack.Screen name="services/shelter/[id]" />
                <Stack.Screen name="services/booking" />
                <Stack.Screen name="products/[id]" />
                <Stack.Screen name="cart/index" />
                <Stack.Screen name="orders/index" />
                <Stack.Screen name="orders/[id]" />
                <Stack.Screen name="places/add" />
                <Stack.Screen name="chat/[id]" />
                <Stack.Screen name="chat/adoption" />
                <Stack.Screen name="partner-register" />
                <Stack.Screen name="partner/add-service" />
                <Stack.Screen name="partner/add-adoption-pet" />
                <Stack.Screen name="partner/edit-service" />
                <Stack.Screen name="partner/edit-product" />
                <Stack.Screen name="partner/configure-business" />
                <Stack.Screen name="partner/configure-activities" />
                <Stack.Screen name="partner/configure-activities-page" />
                <Stack.Screen name="partner/configure-schedule" />
                <Stack.Screen name="partner/configure-schedule-page" />
                <Stack.Screen name="partner/agenda" />
                <Stack.Screen name="partner/bookings" />
                <Stack.Screen name="partner/orders" />
                <Stack.Screen name="partner/clients" />
                <Stack.Screen name="partner/manage-products" />
                <Stack.Screen name="partner/business-insights" />
                <Stack.Screen name="partner/edit-business" />
                <Stack.Screen name="profile/edit" />
                <Stack.Screen name="profile/mercadopago-config" />
                <Stack.Screen name="payment/success" />
                <Stack.Screen name="payment/failure" />
                <Stack.Screen name="payment/pending" />
                <Stack.Screen name="test-adoption" />
                <Stack.Screen name="index" />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
            </CartProvider>
          </NotificationProvider>
        </BiometricProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}