import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { BiometricProvider } from '../contexts/BiometricContext';
import { CartProvider } from '../contexts/CartContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ConfigProvider } from '../contexts/ConfigContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { Platform, Alert, View, Text, ActivityIndicator, TouchableOpacity, Animated, Image, Dimensions } from 'react-native';
import { supabaseClient, initializeSupabase, setupAuthListeners } from '@/lib/supabase';
import { envConfig } from '@/utils/envConfig';
import { clearConfigCache } from '@/utils/appConfig';
import { SafeAppWrapper } from '../components/SafeAppWrapper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FloatingVoiceBot } from '../components/FloatingVoiceBot';

const { width } = Dimensions.get('window');
const SYSTEM_CONFIG_KEY = 'system_config';
const APP_DEEP_LINK_SCHEME = 'dogcatify';

type RuntimeSystemConfig = {
  maintenanceMode: boolean;
  allowGuestAccess: boolean;
  enableAnalytics: boolean;
  pushNotifications: boolean;
  autoApprovePartners: boolean;
};

const DEFAULT_SYSTEM_CONFIG: RuntimeSystemConfig = {
  maintenanceMode: false,
  allowGuestAccess: true,
  enableAnalytics: true,
  pushNotifications: true,
  autoApprovePartners: false,
};

const normalizeDeepLinkPath = ({
  scheme,
  hostname,
  path,
}: {
  scheme?: string | null;
  hostname?: string | null;
  path?: string | null;
}) => {
  const cleanPath = (path || '').replace(/^\/+/, '');

  if (scheme === APP_DEEP_LINK_SCHEME && hostname) {
    return [hostname, cleanPath].filter(Boolean).join('/');
  }

  return cleanPath;
};

const buildRouteWithQuery = (routePath: string, queryParams?: Record<string, any> | null) => {
  const searchParams = new URLSearchParams();

  Object.entries(queryParams || {}).forEach(([key, value]) => {
    if (value == null) return;

    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      if (item != null && String(item).length > 0) {
        searchParams.append(key, String(item));
      }
    });
  });

  const queryString = searchParams.toString();
  return `/${routePath}${queryString ? `?${queryString}` : ''}`;
};

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
    (originalUnhandled as any)(event);
  }
};

function RootLayout() {
  useFrameworkReady();
  const [configReady, setConfigReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const logoScale = new Animated.Value(0.8);
  const logoOpacity = new Animated.Value(0);
  const pulseAnim = new Animated.Value(1);

  // Logo animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Initialize environment configuration and Supabase
  useEffect(() => {
    let mounted = true;

    const initializeApp = async () => {
      try {
        console.log('[App] 🚀 Initializing application...');

        // 1. Inicializar configuración de entorno
        console.log('[App] 📦 Loading environment configuration...');
        // En cada arranque forzamos refresco para no reutilizar credenciales viejas de AsyncStorage.
        await envConfig.initialize(true);
        clearConfigCache();

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
          if (event !== 'INITIAL_SESSION' && session?.user) {
            console.log('Auth event captured at root layout:', event);
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
        const { hostname, path, queryParams, scheme } = Linking.parse(url);
        const routePath = normalizeDeepLinkPath({ scheme, hostname, path });
        console.log('Parsed URL:', { hostname, path, queryParams, scheme, routePath });

        if (routePath.startsWith('album/')) {
          const albumId = routePath.replace('album/', '');
          console.log('Navigating to album:', albumId);

          setTimeout(() => {
            const router = require('expo-router').router;
            router.push(`/pets/albums/${albumId}`);
          }, 500);
        }
        else if (routePath.startsWith('post/')) {
          const postId = routePath.replace('post/', '');
          console.log('Navigating to post:', postId);

          setTimeout(() => {
            const router = require('expo-router').router;
            router.push('/(tabs)');
          }, 500);
        }
        else if (routePath.startsWith('pet-share/')) {
          const shareId = routePath.replace('pet-share/', '');
          console.log('Navigating to pet share invitation:', shareId);

          setTimeout(() => {
            const router = require('expo-router').router;
            router.push(`/pet-share/${shareId}`);
          }, 500);
        }
        else if (routePath.startsWith('pets/')) {
          const petId = routePath.replace('pets/', '');
          console.log('Navigating to pet details:', petId);

          setTimeout(() => {
            const router = require('expo-router').router;
            router.push(`/pets/${petId}`);
          }, 500);
        }
        else if (routePath.startsWith('payment/success')) {
          console.log('Payment success deep link detected');

          setTimeout(() => {
            const router = require('expo-router').router;
            router.replace(buildRouteWithQuery('payment/success', queryParams));
          }, 500);
        }
        else if (routePath.startsWith('payment/failure')) {
          console.log('Payment failure deep link detected');

          setTimeout(() => {
            const router = require('expo-router').router;
            router.replace(buildRouteWithQuery('payment/failure', queryParams));
          }, 500);
        }
        else if (routePath.startsWith('payment/pending')) {
          console.log('Payment pending deep link detected');

          setTimeout(() => {
            const router = require('expo-router').router;
            router.replace(buildRouteWithQuery('payment/pending', queryParams));
          }, 500);
        }
        else if (routePath.startsWith('partner/subscription')) {
          console.log('Partner subscription deep link detected');

          setTimeout(() => {
            const router = require('expo-router').router;
            router.replace(buildRouteWithQuery('partner/subscription', queryParams));
          }, 500);
        }
        else if (routePath.startsWith('profile/subscription')) {
          console.log('Subscription deep link detected');

          setTimeout(() => {
            const router = require('expo-router').router;
            router.replace(buildRouteWithQuery('profile/subscription', queryParams));
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

  const AppContent = ({ initialRouteName }: { initialRouteName: string }) => {
    const { currentUser } = useAuth();
    const [systemConfig, setSystemConfig] = useState<RuntimeSystemConfig>(DEFAULT_SYSTEM_CONFIG);
    const [loadingSystemConfig, setLoadingSystemConfig] = useState(true);
    const [adminAccessRequested, setAdminAccessRequested] = useState(false);

    const isAdminUser = currentUser?.isAdmin === true;

    const loadRuntimeSystemConfig = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('admin_settings')
          .select('value')
          .eq('key', SYSTEM_CONFIG_KEY)
          .maybeSingle();

        if (error) throw error;

        const config = data?.value || {};
        setSystemConfig({
          maintenanceMode: Boolean(config.maintenance_mode),
          allowGuestAccess: config.allow_guest_access ?? true,
          enableAnalytics: config.advanced_analytics_enabled ?? true,
          pushNotifications: config.push_notifications_enabled ?? true,
          autoApprovePartners: config.auto_approve_partners ?? false,
        });
      } catch (error) {
        console.error('Error loading runtime system config:', error);
      } finally {
        setLoadingSystemConfig(false);
      }
    };

    useEffect(() => {
      loadRuntimeSystemConfig();

      const interval = setInterval(() => {
        loadRuntimeSystemConfig();
      }, 60000);

      return () => clearInterval(interval);
    }, []);

    useEffect(() => {
      if (currentUser && !isAdminUser) {
        setAdminAccessRequested(false);
      }
    }, [currentUser?.id, isAdminUser]);

    if (loadingSystemConfig) {
      return (
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#F9FAFB',
        }}>
          <ActivityIndicator size="large" color="#2D6A6F" />
          <Text style={{ marginTop: 12, color: '#6B7280', fontSize: 14 }}>
            Verificando estado de la plataforma...
          </Text>
        </View>
      );
    }

    if (systemConfig.maintenanceMode && !isAdminUser && !adminAccessRequested) {
      return (
        <View style={{
          flex: 1,
          backgroundColor: '#0F172A',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}>
          <View style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: '#FFFFFF',
            borderRadius: 28,
            padding: 28,
            alignItems: 'center',
          }}>
            <Image
              source={require('../assets/images/logo-transp.png')}
              style={{ width: 96, height: 96, marginBottom: 20 }}
              resizeMode="contain"
            />
            <Text style={{
              color: '#111827',
              fontSize: 26,
              fontWeight: '700',
              marginBottom: 10,
              textAlign: 'center',
            }}>
              Estamos en mantenimiento
            </Text>
            <Text style={{
              color: '#6B7280',
              fontSize: 15,
              lineHeight: 22,
              textAlign: 'center',
              marginBottom: 24,
            }}>
              Estamos realizando ajustes para mejorar DogCatiFy. Vuelve a intentarlo en unos minutos.
            </Text>
            <TouchableOpacity
              onPress={loadRuntimeSystemConfig}
              style={{
                width: '100%',
                backgroundColor: '#2D6A6F',
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
                Reintentar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAdminAccessRequested(true)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ color: '#2D6A6F', fontSize: 14, fontWeight: '600' }}>
                Acceso administrador
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
	      <Stack screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(admin-tabs)" />
        <Stack.Screen name="(partner-tabs)" />
        <Stack.Screen name="web-info" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/become-partner" />
        <Stack.Screen name="auth/select-role" />
        <Stack.Screen name="auth/forgot-password" />
        <Stack.Screen name="auth/confirm" />
        <Stack.Screen name="auth/biometric-setup" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth/mercadopago/callback" />
        <Stack.Screen name="promotion-approval" />
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
        <Stack.Screen name="delivery-register" />
        <Stack.Screen name="delivery/orders" />
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
        <Stack.Screen name="subscription/return" />
        <Stack.Screen name="test-adoption" />
        <Stack.Screen name="medical-history/[id]" />
        <Stack.Screen name="pets/medical-history-preview" />
        <Stack.Screen name="pets/share-medical-history" />
        <Stack.Screen name="pets/share-pet" />
        <Stack.Screen name="pets/mating/[id]" />
        <Stack.Screen name="pets/mating/chat/[id]" />
        <Stack.Screen name="pet-share/[id]" options={{ title: 'Invitación' }} />
        <Stack.Screen name="+not-found" />
	      </Stack>
    );
  };

  // Retry function
  const retryConfiguration = async () => {
    setConfigError(null);
    setConfigReady(false);

    try {
      console.log('[App] 🔄 Retrying configuration...');
      await envConfig.reload();
      clearConfigCache();
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
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#2D6A6F',
        padding: 20,
      }}>
        <Animated.View
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 32,
            maxWidth: 400,
            width: '90%',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#FEF3CD',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <Text style={{ fontSize: 40 }}>⚠️</Text>
          </View>

          <Text style={{
            color: '#1F2937',
            fontSize: 22,
            fontWeight: '700',
            marginBottom: 12,
            textAlign: 'center',
          }}>
            Error de Conexión
          </Text>

          <Text style={{
            color: '#6B7280',
            fontSize: 15,
            textAlign: 'center',
            marginBottom: 28,
            lineHeight: 22,
          }}>
            {configError}
          </Text>

          <TouchableOpacity
            onPress={retryConfiguration}
            style={{
              backgroundColor: '#2D6A6F',
              paddingVertical: 16,
              paddingHorizontal: 32,
              borderRadius: 12,
              width: '100%',
              alignItems: 'center',
              shadowColor: '#2D6A6F',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <Text style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: '600',
              letterSpacing: 0.5,
            }}>
              Reintentar Conexión
            </Text>
          </TouchableOpacity>

          <View style={{
            marginTop: 24,
            paddingTop: 20,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            width: '100%',
          }}>
            <Text style={{
              color: '#9CA3AF',
              fontSize: 13,
              textAlign: 'center',
              lineHeight: 18,
            }}>
              Asegúrate de tener una conexión estable a internet
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  // Show loading screen while configuration is being loaded - only render providers after config is ready
  if (!configReady) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#2D6A6F',
      }}>
        <Animated.View
          style={{
            alignItems: 'center',
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
              marginBottom: 40,
            }}
          >
            <Image
              source={require('../assets/images/logo-transp.png')}
              style={{
                width: Math.min(width * 0.5, 200),
                height: Math.min(width * 0.5, 200),
              }}
              resizeMode="contain"
            />
          </Animated.View>

          <View style={{
            alignItems: 'center',
            paddingHorizontal: 40,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 12 }} />
              <Text style={{
                color: '#fff',
                fontSize: 18,
                fontWeight: '600',
                letterSpacing: 0.5,
              }}>
                Iniciando DogCatiFy
              </Text>
            </View>

            <View style={{
              height: 4,
              width: 200,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 2,
              overflow: 'hidden',
              marginBottom: 20,
            }}>
              <Animated.View
                style={{
                  height: '100%',
                  width: '70%',
                  backgroundColor: '#fff',
                  borderRadius: 2,
                }}
              />
            </View>

            <Text style={{
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: 15,
              textAlign: 'center',
              marginBottom: 8,
              fontWeight: '500',
            }}>
              Conectando con el servidor
            </Text>

            <Text style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: 13,
              textAlign: 'center',
              lineHeight: 18,
            }}>
              Cargando tu experiencia personalizada
            </Text>
          </View>
        </Animated.View>

        <View style={{
          position: 'absolute',
          bottom: 40,
          alignItems: 'center',
        }}>
          <Text style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: 11,
            textAlign: 'center',
            fontWeight: '500',
          }}>
            Powered by FlowBridge API
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
	                      <AppContent initialRouteName={initialRouteName} />{false && (<Stack screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(admin-tabs)" />
                  <Stack.Screen name="(partner-tabs)" />
                  <Stack.Screen name="web-info" />
                  <Stack.Screen name="auth/login" />
                  <Stack.Screen name="auth/register" />
                  <Stack.Screen name="auth/become-partner" />
                  <Stack.Screen name="auth/forgot-password" />
                  <Stack.Screen name="auth/confirm" />
                  <Stack.Screen name="auth/biometric-setup" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="auth/mercadopago/callback" />
                  <Stack.Screen name="promotion-approval" />
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
                  <Stack.Screen name="delivery-register" />
                  <Stack.Screen name="delivery/orders" />
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
                  <Stack.Screen name="subscription/return" />
                  <Stack.Screen name="test-adoption" />
                  <Stack.Screen name="medical-history/[id]" />
                  <Stack.Screen name="pets/medical-history-preview" />
                  <Stack.Screen name="pets/share-medical-history" />
                  <Stack.Screen name="pets/share-pet" />
                  <Stack.Screen name="pets/mating/[id]" />
                  <Stack.Screen name="pets/mating/chat/[id]" />
                  <Stack.Screen name="pet-share/[id]" options={{ title: 'Invitación' }} />
                  <Stack.Screen name="+not-found" />
	                </Stack>)}
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
