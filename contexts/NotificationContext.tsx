import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { supabaseClient } from '../lib/supabase';
import { envConfig } from '@/utils/envConfig';

// Only import and configure notifications if not in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications: any = null;
let Device: any = null;

if (!isExpoGo && Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  Device = require('expo-device');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

interface NotificationContextType {
  expoPushToken: string | null;
  notification: any;
  notificationsEnabled: boolean;
  registerForPushNotifications: () => Promise<string | null>;
  disableNotifications: () => Promise<void>;
  sendNotificationToUser: (userId: string, title: string, body: string, data?: any) => Promise<void>;
  sendNotificationToAdmin: (title: string, body: string, data?: any) => Promise<void>;
  validateAndUpdateTokens: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any>(null);
  const { currentUser } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Check and validate tokens when user logs in
  useEffect(() => {
    if (isExpoGo || Platform.OS === 'web' || !Notifications) {
      if (isExpoGo) {
        console.log('⚠️ Running in Expo Go - Notifications require native build');
        console.log('💡 Run: eas build --platform android --profile preview');
        console.log('');
        console.log('📱 PARA PROBAR NOTIFICACIONES:');
        console.log('   1. Crear development build: eas build --profile development --platform android');
        console.log('   2. Instalar la APK en tu dispositivo');
        console.log('   3. Los FCM tokens se generarán automáticamente al iniciar sesión');
        console.log('');
      } else if (Platform.OS === 'web') {
        console.log('⚠️ Running on web - Notifications not available');
      } else {
        console.log('⚠️ Notifications module not loaded');
      }
      return;
    }

    if (currentUser) {
      console.log('✅ Usuario logueado, validando y registrando tokens FCM...');
      // Ejecutar validación y actualización de tokens de forma asíncrona
      (async () => {
        try {
          await validateAndUpdateTokens();
        } catch (error) {
          console.error('Error al validar tokens:', error);
        }
      })();
    }
  }, [currentUser]);

  const checkNotificationStatus = async () => {
    try {
      const { data } = await supabaseClient
        .from('profiles')
        .select('push_token, fcm_token, notification_preferences')
        .eq('id', currentUser!.id)
        .single();

      if (data?.push_token || data?.fcm_token) {
        setExpoPushToken(data.push_token || null);
        setNotificationsEnabled(true);
      }
    } catch (error) {
      console.log('Error checking notification status:', error);
    }
  };
  useEffect(() => {
    if (isExpoGo || Platform.OS === 'web' || !Notifications) {
      return;
    }

    // Set up notification listeners
    const notificationListener = Notifications.addNotificationReceivedListener((notification: any) => {
      console.log('Notification received:', notification);
      setNotification(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
      console.log('Notification response:', response);
      // Handle notification tap here
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  const registerForPushNotifications = async (): Promise<string | null> => {
    try {
      console.log('=== PUSH NOTIFICATION REGISTRATION ===');

      // Check environment
      if (isExpoGo) {
        console.log('❌ Running in Expo Go - notifications not supported');
        throw new Error('Las notificaciones no están disponibles en Expo Go. Necesitas una build de desarrollo o producción.');
      }

      if (Platform.OS === 'web') {
        console.log('❌ Web platform - notifications not supported');
        throw new Error('Las notificaciones push no están disponibles en la web.');
      }

      if (!Notifications || !Device) {
        console.log('❌ Notification modules not available');
        throw new Error('Los módulos de notificación no están disponibles.');
      }

      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.log('❌ Must use physical device for Push Notifications');
        throw new Error('Las notificaciones solo funcionan en dispositivos físicos, no en simuladores.');
      }

      console.log('Device check passed, requesting permissions...');

      // Get current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('Current permission status:', existingStatus);
      
      let finalStatus = existingStatus;
      
      // Request permissions if not already granted
      if (existingStatus !== 'granted') {
        console.log('Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('Permission request result:', status);
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Push notification permissions not granted. Final status:', finalStatus);
        console.log('Permission details:', {
          existingStatus,
          finalStatus,
          canAskAgain: finalStatus === 'denied' ? 'No' : 'Sí'
        });
        return null;
      }

      console.log('Permissions granted, getting push token...');

      // Get the push token
      try {
        // Use the exact project ID
        const projectId = '0618d9ae-6714-46bb-adce-f4ee57fff324';
        
        console.log('📋 Using project ID:', projectId);
        console.log('📋 Constants project ID:', Constants.expoConfig?.extra?.eas?.projectId);
        console.log('📋 Project IDs match:', projectId === Constants.expoConfig?.extra?.eas?.projectId);
        
        console.log('Requesting Expo push token...');
        
        // Try with explicit project ID first
        let tokenData;
        try {
          console.log('Attempting with explicit project ID...');
          tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          });
          console.log('✅ Token obtained with explicit project ID');
        } catch (explicitError) {
          console.log('❌ Failed with explicit project ID:', explicitError.message);
          console.log('Attempting without project ID...');
          
          try {
            tokenData = await Notifications.getExpoPushTokenAsync();
            console.log('✅ Token obtained without project ID');
          } catch (fallbackError) {
            console.log('❌ Failed without project ID:', fallbackError.message);
            throw fallbackError;
          }
        }

        console.log('=== TOKEN GENERATION RESULT ===');
        console.log('Success:', !!tokenData.data);
        console.log('Token type:', typeof tokenData.data);
        console.log('Token length:', tokenData.data ? tokenData.data.length : 0);
        console.log('Token preview:', tokenData.data ? tokenData.data.substring(0, 50) + '...' : 'NULL');
        console.log('Token starts with ExponentPushToken:', tokenData.data ? tokenData.data.startsWith('ExponentPushToken[') : false);
        console.log('Token ends with ]:', tokenData.data ? tokenData.data.endsWith(']') : false);

        // Configure Android notification channel
        if (Platform.OS === 'android') {
          console.log('Setting up Android notification channel...');
          try {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'DogCatiFy Notifications',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#2D6A6F',
              sound: 'default',
              enableVibrate: true,
              enableLights: true,
              lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
              bypassDnd: false,
              description: 'Notificaciones generales de DogCatiFy',
            });
            console.log('✅ Android notification channel configured with custom icon');
          } catch (channelError) {
            console.error('❌ Error setting up notification channel:', channelError);
            // Don't fail registration if channel setup fails
          }

          // Add additional channels for different notification types
          try {
            await Notifications.setNotificationChannelAsync('chat', {
              name: 'Mensajes de Chat',
              importance: Notifications.AndroidImportance.HIGH,
              vibrationPattern: [0, 250, 250, 250],
              sound: 'default',
              lightColor: '#2D6A6F',
              description: 'Notificaciones de mensajes de chat y adopción',
            });
            console.log('✅ Chat notification channel configured');
          } catch (chatChannelError) {
            console.error('❌ Error setting up chat channel:', chatChannelError);
          }

          try {
            await Notifications.setNotificationChannelAsync('bookings', {
              name: 'Reservas y Citas',
              importance: Notifications.AndroidImportance.HIGH,
              vibrationPattern: [0, 500, 250, 500],
              sound: 'default',
              lightColor: '#2D6A6F',
              description: 'Notificaciones de reservas y confirmaciones',
            });
            console.log('✅ Bookings notification channel configured');
          } catch (bookingsChannelError) {
            console.error('❌ Error setting up bookings channel:', bookingsChannelError);
          }
        }

        // Get native device token (FCM en Android / APNs en iOS)
        // IMPORTANTE: se guarda en fcm_token para priorizar envío v1
        let fcmToken: string | null = null;
        try {
          console.log('🔑 Getting native device push token (PRIORITARIO)...');
          const devicePushToken = await Notifications.getDevicePushTokenAsync();
          fcmToken = devicePushToken?.data || null;

          const tokenType = Platform.OS === 'android' ? 'FCM' : 'APNs';
          console.log(`✅ ${tokenType} token obtained:`, fcmToken ? fcmToken.substring(0, 30) + '...' : 'null');

          if (!fcmToken && Platform.OS === 'android') {
            console.error('❌ CRÍTICO: No se pudo obtener FCM token en Android');
            throw new Error('No se pudo obtener el token FCM. Las notificaciones podrían no funcionar.');
          }
        } catch (fcmError: any) {
          console.error('❌ Error obteniendo token nativo del dispositivo:', fcmError);
          if (Platform.OS === 'android') {
            throw new Error('Error al obtener token FCM: ' + fcmError.message);
          }
        }

        // Store tokens in user profile if user is logged in
        if (currentUser) {
          console.log('💾 Storing push tokens in user profile...');

          // En Android, fcm_token es OBLIGATORIO
          if (Platform.OS === 'android' && !fcmToken) {
            console.error('❌ CRÍTICO: No se puede registrar notificaciones sin FCM token en Android');
            throw new Error('No se pudo obtener el token FCM requerido para notificaciones.');
          }

          console.log('- Expo Push Token (legacy):', tokenData.data ? tokenData.data.substring(0, 30) + '...' : 'null');
          if (fcmToken) {
            console.log('- FCM Token (PRIORITARIO):', fcmToken.substring(0, 30) + '...');
          }

          const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({
              push_token: tokenData.data,
              fcm_token: fcmToken,
              notification_preferences: {
                push: true,
                email: true
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

          if (updateError) {
            console.error('❌ Error updating push tokens:', updateError);
            throw new Error('No se pudo guardar el token de notificación.');
          }

          console.log('✅ Push tokens saved successfully');
          if (fcmToken) {
            console.log('✅ FCM v1 API ready for Android (método preferido)');
          } else {
            console.warn('⚠️ Sin FCM token - usando Expo legacy API (descontinuada)');
          }
        }

        setExpoPushToken(tokenData.data);
        setNotificationsEnabled(true);
        console.log('✅ Push notification registration completed!');
        return tokenData.data;
      } catch (tokenError: any) {
        console.error('❌ Error getting push token:', tokenError);
        throw tokenError;
      }
    } catch (error: any) {
      console.error('❌ Error in registerForPushNotifications:', error);
      throw error;
    }
  };

  const sendNotificationToUser = async (
    userId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> => {
    try {
      // Check if target user has notifications enabled and get FCM token
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('fcm_token, notification_preferences')
        .eq('id', userId)
        .single();

      if (!profile?.fcm_token) {
        console.log('❌ User does not have FCM token');
        return;
      }

      const preferences = profile.notification_preferences || {};
      if (preferences.push === false) {
        console.log('❌ User has disabled push notifications');
        return;
      }

      console.log('🚀 Sending push notification via FCM v1 Edge Function...');
      console.log('Target user ID:', userId);
      console.log('Title:', title);
      console.log('Body:', body);

      // Call FCM v1 Edge Function
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      const anonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

      if (!supabaseUrl || !anonKey) {
        console.error('❌ Missing Supabase configuration');
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-fcm-v1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          token: profile.fcm_token,
          title,
          body,
          data: data || {}
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ FCM v1 Edge Function error:', response.status, errorText);
        throw new Error(`FCM v1 Edge Function error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Push notification sent via FCM v1:', result);

      if (!result.success) {
        console.warn('⚠️ FCM v1 Edge Function returned success=false:', result.error);
      }
    } catch (error) {
      console.error('❌ Error sending push notification via FCM v1:', error);
      // Don't throw error to avoid breaking the chat flow
    }
  };


  const sendNotificationToAdmin = async (
    title: string, 
    body: string, 
    data?: any
  ): Promise<void> => {
    try {
      console.log('🚀 Sending notification to admin via Edge Function...');

      const { data: adminProfile, error: adminError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('is_admin', true)
        .limit(1)
        .maybeSingle();

      if (adminError || !adminProfile?.id) {
        console.error('❌ Admin profile not found for push notification:', adminError);
        return;
      }

      await sendNotificationToUser(adminProfile.id, title, body, data);
    } catch (error) {
      console.error('❌ Error sending notification to admin:', error);
    }
  };

  const disableNotifications = async (): Promise<void> => {
    try {
      if (currentUser) {
        await supabaseClient
          .from('profiles')
          .update({
            push_token: null,
            fcm_token: null,
            notification_preferences: {
              push: false,
              email: true
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', currentUser.id);
      }

      setExpoPushToken(null);
      setNotificationsEnabled(false);
      console.log('✅ Notifications disabled successfully');
    } catch (error) {
      console.error('Error disabling notifications:', error);
      throw error;
    }
  };

  const validateAndUpdateTokens = async (): Promise<void> => {
    if (isExpoGo || Platform.OS === 'web' || !Notifications || !Device) {
      return;
    }

    if (!currentUser) {
      console.log('No current user, skipping token validation');
      return;
    }

    try {
      console.log('=== VALIDANDO TOKENS AL INICIAR SESIÓN ===');

      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('push_token, fcm_token, notification_preferences')
        .eq('id', currentUser.id)
        .single();

      if (profileError) {
        console.warn('Error obteniendo perfil:', profileError);
        return;
      }

      const storedPushToken = profile?.push_token;
      const storedFcmToken = profile?.fcm_token;

      console.log('Tokens almacenados:');
      console.log('- Expo Token:', storedPushToken ? storedPushToken.substring(0, 30) + '...' : 'null');
      console.log('- FCM Token:', storedFcmToken ? storedFcmToken.substring(0, 30) + '...' : 'null');

      let needsUpdate = false;
      let currentExpoToken: string | null = null;
      let currentFcmToken: string | null = null;

      if (!Device.isDevice) {
        console.log('⚠️ Ejecutando en simulador, tokens no disponibles');
        return;
      }

      const { status } = await Notifications.getPermissionsAsync();

      if (status !== 'granted') {
        console.log('⚠️ Permisos de notificación no otorgados');

        // Si el usuario tiene tokens almacenados, los limpiamos porque los permisos fueron revocados
        if (storedPushToken || storedFcmToken) {
          console.log('Limpiando tokens almacenados (permisos revocados)');
          await supabaseClient
            .from('profiles')
            .update({
              push_token: null,
              fcm_token: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

          setExpoPushToken(null);
          setNotificationsEnabled(false);
        } else {
          // Si el usuario NO tiene tokens almacenados, significa que nunca se registraron notificaciones
          // Intentamos registrarlas automáticamente (esto pedirá permisos)
          console.log('📱 Usuario sin tokens. Intentando registro automático de notificaciones...');
          try {
            await registerForPushNotifications();
            console.log('✅ Registro automático de notificaciones completado');
            return; // Salir porque registerForPushNotifications ya actualiza la DB
          } catch (registerError) {
            console.log('⚠️ Usuario rechazó permisos o error en registro:', registerError);
            // No es crítico, el usuario puede activar notificaciones después desde configuración
          }
        }
        return;
      }

      try {
        const projectId = '0618d9ae-6714-46bb-adce-f4ee57fff324';
        let tokenData;

        try {
          tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        } catch {
          tokenData = await Notifications.getExpoPushTokenAsync();
        }

        currentExpoToken = tokenData.data;
        console.log('✅ Expo token actual:', currentExpoToken.substring(0, 30) + '...');

        if (currentExpoToken !== storedPushToken) {
          console.log('🔄 Expo token cambió, necesita actualización');
          needsUpdate = true;
        }
      } catch (tokenError) {
        console.warn('⚠️ No se pudo obtener Expo token:', tokenError);
      }

      try {
        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        currentFcmToken = devicePushToken?.data || null;

        const tokenType = Platform.OS === 'android' ? 'FCM' : 'APNs';
        console.log(`✅ ${tokenType} token actual:`, currentFcmToken ? currentFcmToken.substring(0, 30) + '...' : 'null');

        if (currentFcmToken !== storedFcmToken) {
          console.log('🔄 Token nativo cambió, necesita actualización');
          needsUpdate = true;
        }
      } catch (fcmError) {
        console.warn('⚠️ No se pudo obtener token nativo del dispositivo:', fcmError);
      }

      // IMPORTANTE: Si el usuario no tiene tokens, intentamos obtenerlos
      if (!storedPushToken && !storedFcmToken && (currentExpoToken || currentFcmToken)) {
        console.log('📝 Usuario no tiene tokens registrados, actualizando...');
        needsUpdate = true;
      }

      // Si el usuario NO tiene tokens almacenados y NO pudimos obtener tokens actuales,
      // intentamos registrar las notificaciones por primera vez
      if (!storedPushToken && !storedFcmToken && !currentExpoToken && !currentFcmToken) {
        console.log('⚠️ Usuario sin tokens. Intentando registro completo de notificaciones...');
        try {
          // Intentar registro completo (esto pedirá permisos si no están otorgados)
          await registerForPushNotifications();
          return; // Salir porque registerForPushNotifications ya actualiza la DB
        } catch (registerError) {
          console.error('❌ No se pudo registrar notificaciones:', registerError);
          return;
        }
      }

      if (needsUpdate) {
        console.log('💾 Actualizando tokens en base de datos...');

        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({
            push_token: currentExpoToken,
            fcm_token: currentFcmToken,
            notification_preferences: {
              push: true,
              email: true
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', currentUser.id);

        if (updateError) {
          console.error('❌ Error actualizando tokens:', updateError);
        } else {
          console.log('✅ Tokens actualizados exitosamente');
          setExpoPushToken(currentExpoToken);
          setNotificationsEnabled(true);

          if (currentFcmToken) {
            console.log('✅ FCM v1 API listo para Android');
          }
        }
      } else {
        console.log('✅ Tokens válidos, no se requiere actualización');
        setExpoPushToken(storedPushToken);
        setNotificationsEnabled(true);
      }

      console.log('=== VALIDACIÓN DE TOKENS COMPLETADA ===');
    } catch (error) {
      console.error('❌ Error en validación de tokens:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        notificationsEnabled,
        registerForPushNotifications,
        disableNotifications,
        sendNotificationToUser,
        sendNotificationToAdmin,
        validateAndUpdateTokens,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
