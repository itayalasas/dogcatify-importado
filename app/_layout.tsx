import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { BiometricProvider } from '../contexts/BiometricContext';
import { CartProvider } from '../contexts/CartContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ConfigProvider } from '../contexts/ConfigContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { Platform, Alert, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabaseClient, initializeSupabase, setupAuthListeners } from '@/lib/supabase';
import { envConfig } from '@/utils/envConfig';
import { SafeAppWrapper } from '../components/SafeAppWrapper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FloatingVoiceBot } from '../components/FloatingVoiceBot';
// Global error handler test
if (typeof ErrorUtils !== 'undefined') {
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('=== GLOBAL ERROR ===');
    console.error('Fatal:', isFatal);
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('===================');


    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// Capture unhandled promise rejections
const originalUnhandled = global.onunhandledrejection;
global.onunhandledrejection = (event: any) => {
  console.error('=== UNHANDLED PROMISE REJECTION ===');
  console.error('Reason:', event.reason);
  console.error('Promise:', event.promise);
  console.error('===================================');

  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

  if (originalUnhandled) {
    originalUnhandled(event);
  }
};

function RootLayout() {
  useFrameworkReady();
  const [configReady, setConfigReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Initialize environment configuration and Supabase
  useEffect(() => {
    let mounted = true;

    const initializeApp = async () => {
      try {
        console.log('[App] 🚀 Initializing application...');

        // 1. Inicializar configuración de entorno
        console.log('[App] 📦 Loading environment configuration...');
        await envConfig.initialize();

        if (!mounted) return;

        // 2. Inicializar Supabase con la configuración cargada
        console.log('[App] 🔌 Initializing Supabase client...');
        await initializeSupabase();

        if (!mounted) return;

        // 3. Configurar listeners de auth
        console.log('[App] 🔐 Setting up auth listeners...');
        setupAuthListeners();

        if (!mounted) return;

        console.log('[App] ✅ Application initialized successfully');
        setConfigReady(true);
      } catch (error: any) {
        console.error('[App] ❌ Failed to initialize application:', error);
        if (mounted) {
          setConfigError(error.message || 'Failed to initialize application');
        }
      }
    };

    initializeApp();

    return () => {
      mounted = false;
    };
  }, []);

  // Prevent Supabase from showing automatic modals
  useEffect(() => {
    if (!configReady) return;

    try {
      const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
        (event, session) => {
          if (event === 'SIGNED_UP') {
            console.log('Blocking SIGNED_UP event to prevent modal');
          }
        }
      );

      return () => {
        subscription?.unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up auth listener:', error);
    }
  }, [configReady]);

  // Handle deep links and universal links
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log('Deep link received:', url);

      try {
        const { hostname, path, queryParams } = Linking.parse(url);
        console.log('Parsed URL:', { hostname, path, queryParams });

        if (path?.startsWith('album/')) {
          const albumId = path.replace('album/', '');
          console.log('Navigating to album:', albumId);

          setTimeout(() => {
            const router = require('expo-router').router;
            router.push(`/pets/albums/${albumId}`);
          }, 500);
        }
        else if (path?.startsWith('post/')) {
          const postId = path.replace('post/', '');
          console.log('Navigating to post:', postId);

          setTimeout(() => {
            const router = require('expo-router').router;
            router.push('/(tabs)');
          }, 500);
        }
        else if (path?.startsWith('pet-share/')) {
          const shareId = path.replace('pet-share/', '');
          console.log('Navigating to pet share invitation:', shareId);

          setTimeout(() => {
            const router = require('expo-router').router;
            router.push(`/pet-share/${shareId}`);
          }, 500);
        }
        else if (path?.startsWith('pets/')) {
          const petId = path.replace('pets/', '');
          console.log('Navigating to pet details:', petId);

          setTimeout(() => {
            const router = require('expo-router').router;
            router.push(`/pets/${petId}`);
          }, 500);
        }
        else if (path?.startsWith('payment/success')) {
          console.log('Payment success deep link detected');

          setTimeout(() => {
            const router = require('expo-router').router;
            // Usar replace para limpiar el stack y que no se pueda volver al carrito
            router.replace(url.replace('dogcatify://', '/'));
          }, 500);
        }
        else if (path?.startsWith('payment/failure')) {
          console.log('Payment failure deep link detected');

          setTimeout(() => {
            const router = require('expo-router').router;
            // Usar replace para limpiar el stack
            router.replace(url.replace('dogcatify://', '/'));
          }, 500);
        }
      } catch (error) {
        console.error('Error handling deep link:', error, url);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL detected:', url);
        handleDeepLink({ url });
      }
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  // Determine initial route based on platform
  const initialRouteName = Platform.OS === 'web' ? 'web-info' : '(tabs)';

  // Retry function
  const retryConfiguration = async () => {
    setConfigError(null);
    setConfigReady(false);

    try {
      console.log('[App] 🔄 Retrying configuration...');
      await envConfig.reload();
      setConfigReady(true);
      console.log('[App] ✅ Configuration retry successful');
    } catch (error: any) {
      console.error('[App] ❌ Configuration retry failed:', error);
      setConfigError(error.message || 'Failed to initialize application');
    }
  };

  // Show error screen if configuration failed
  if (configError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2D6A6F', padding: 20 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, marginBottom: 8 }}>⚠️</Text>
          <Text style={{ color: '#333', fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
            Error de Conexión
          </Text>
          <Text style={{ color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
            {configError}
          </Text>
          <View style={{ width: '100%', gap: 12 }}>
            <TouchableOpacity
              onPress={retryConfiguration}
              style={{
                backgroundColor: '#2D6A6F',
                paddingVertical: 14,
                paddingHorizontal: 24,
                borderRadius: 8,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                Reintentar
              </Text>
            </TouchableOpacity>
            <Text style={{ color: '#999', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              Asegúrate de tener una conexión estable a internet
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Show loading screen while configuration is being loaded - only render providers after config is ready
  if (!configReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2D6A6F', padding: 20 }}>
        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 16, padding: 32, alignItems: 'center', maxWidth: 300 }}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: 20, fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
            Cargando configuración...
          </Text>
          <Text style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: 12, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            Conectando con el servidor
          </Text>
          <Text style={{ color: 'rgba(255, 255, 255, 0.5)', marginTop: 16, fontSize: 12, textAlign: 'center' }}>
            Esto puede tardar hasta un minuto en conexiones lentas
          </Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAppWrapper>
        <ConfigProvider>
          <LanguageProvider>
            <AuthProvider>
              <BiometricProvider>
                <NotificationProvider>
                  <CartProvider>
                    <ErrorBoundary>
                <Stack screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(admin-tabs)" />
                  <Stack.Screen name="(partner-tabs)" />
                  <Stack.Screen name="web-info" />
                  <Stack.Screen name="auth/login" />
                  <Stack.Screen name="auth/register" />
                  <Stack.Screen name="auth/forgot-password" />
                  <Stack.Screen name="auth/confirm" />
                  <Stack.Screen name="auth/biometric-setup" />
                  <Stack.Screen name="auth/mercadopago/callback" />
                  <Stack.Screen name="legal/privacy-policy" />
                  <Stack.Screen name="legal/terms-of-service" />
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
                  <Stack.Screen name="pets/health/select-condition" />
                  <Stack.Screen name="pets/health/select-treatment" />
                  <Stack.Screen name="pets/health/select-veterinarian" />
                  <Stack.Screen name="pets/health/select-vaccine" />
                  <Stack.Screen name="pets/health/select-allergy" />
                  <Stack.Screen name="pets/health/select-dewormer" />
                  <Stack.Screen name="services/[id]" />
                  <Stack.Screen name="services/partner/[id]" />
                  <Stack.Screen name="services/shelter/[id]" />
                  <Stack.Screen 
                    name="services/booking/[serviceId]" 
                    options={{
                      title: 'Reservar Servicio',
                      headerShown: false 
                    }} 
                  />
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
                  <Stack.Screen name="partner/store-products/[id]" />
                  <Stack.Screen name="profile/edit" />
                  <Stack.Screen name="profile/mercadopago-config" />
                  <Stack.Screen name="profile/help-support" />
                  <Stack.Screen name="profile/delete-account" />
                  <Stack.Screen
                    name="payment/success"
                    options={{
                      gestureEnabled: false,
                      headerShown: false
                    }}
                  />
                  <Stack.Screen
                    name="payment/failure"
                    options={{
                      gestureEnabled: false,
                      headerShown: false
                    }}
                  />
                  <Stack.Screen name="payment/pending" />
                  <Stack.Screen name="test-adoption" />
                  <Stack.Screen name="medical-history/[id]" />
                  <Stack.Screen name="pets/medical-history-preview" />
                  <Stack.Screen name="pets/share-medical-history" />
                  <Stack.Screen name="pets/share-pet" />
                  <Stack.Screen name="pet-share/[id]" options={{ title: 'Invitación' }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
                  </ErrorBoundary>
                  <FloatingVoiceBot showWelcome={false} />
                  <StatusBar style="auto" />
                </CartProvider>
              </NotificationProvider>
            </BiometricProvider>
          </AuthProvider>
        </LanguageProvider>
      </ConfigProvider>
    </SafeAppWrapper>
    </GestureHandlerRootView>
  );
}

// Sentry disabled for now to avoid build issues
export default RootLayout;