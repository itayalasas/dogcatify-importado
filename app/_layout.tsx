import { useEffect } from 'react';
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
import { Platform, Alert } from 'react-native';
import { supabaseClient } from '@/lib/supabase';

export default function RootLayout() {
  useFrameworkReady();

  // Add navigation state logging
  useEffect(() => {
    console.log('=== RootLayout Mount ===');
    console.log('Available routes being registered...');
  }, []);

  // Prevent Supabase from showing automatic modals
  useEffect(() => {
    try {
      const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
        (event, session) => {
          console.log('Auth event intercepted:', event);

          // Only block SIGNED_UP to prevent the confirmation modal
          if (event === 'SIGNED_UP') {
            console.log('Blocking SIGNED_UP event to prevent modal');
            setTimeout(() => {
              supabaseClient.auth.signOut().catch(err => {
                console.log('Error signing out:', err.message);
              });
            }, 100);
          }
        }
      );

      return () => {
        subscription?.unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up auth listener:', error);
    }
  }, []);

  // Handle deep links and universal links
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log('Deep link received:', url);

      try {
        // Parse the URL
        const { hostname, path, queryParams } = Linking.parse(url);

        console.log('Parsed URL:', { hostname, path, queryParams });

        // Handle album links: dogcatify://album/[id] or https://dogcatify.app/album/[id]
        if (path?.startsWith('album/')) {
          const albumId = path.replace('album/', '');
          console.log('Navigating to album:', albumId);

          // Use setTimeout to ensure navigation happens after app is ready
          setTimeout(() => {
            // Navigate to album view
            const router = require('expo-router').router;
            router.push(`/pets/albums/${albumId}`);
          }, 500);
        }
        // Handle post links: dogcatify://post/[id] or https://dogcatify.app/post/[id]
        else if (path?.startsWith('post/')) {
          const postId = path.replace('post/', '');
          console.log('Navigating to post:', postId);

          setTimeout(() => {
            // Navigate to feed (posts are shown in the main feed)
            const router = require('expo-router').router;
            router.push('/(tabs)');
            // You could add logic here to scroll to specific post
          }, 500);
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };

    // Get initial URL (if app was opened from a link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL:', url);
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  // Determine initial route based on platform
  const initialRouteName = Platform.OS === 'web' ? 'web-info' : '(tabs)';

  return (
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
                  <Stack.Screen name="payment/success" />
                  <Stack.Screen name="payment/failure" />
                  <Stack.Screen name="payment/pending" />
                  <Stack.Screen name="test-adoption" />
                  <Stack.Screen name="medical-history/[id]" />
                  <Stack.Screen name="pets/medical-history-preview" />
                  <Stack.Screen name="pets/share-medical-history" />
                  <Stack.Screen name="+not-found" />
                </Stack>
                </ErrorBoundary>
                <StatusBar style="auto" />
              </CartProvider>
            </NotificationProvider>
          </BiometricProvider>
        </AuthProvider>
      </LanguageProvider>
    </ConfigProvider>
  );
}