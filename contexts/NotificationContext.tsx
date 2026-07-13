import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAuth } from './AuthContext';
import { supabaseClient } from '../lib/supabase';
import { envConfig } from '@/utils/envConfig';

// Only import and configure notifications if not in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications: any = null;
let Device: any = null;

type IOSFCMTokenModule = {
  getFCMToken: () => Promise<string>;
};

const { FCMTokenModule } = NativeModules as {
  FCMTokenModule?: IOSFCMTokenModule;
};

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

const getNativeFcmToken = async (): Promise<string | null> => {
  if (!Notifications) {
    return null;
  }

  if (Platform.OS === 'android') {
    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    return devicePushToken?.data || null;
  }

  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    const apnsToken = devicePushToken?.data || null;

    if (apnsToken) {
      console.log('Apple APNs token obtained for Firebase:', apnsToken.substring(0, 30) + '...');
    }
  } catch (apnsError) {
    console.warn('Could not obtain APNs token before requesting Firebase token:', apnsError);
  }

  if (!FCMTokenModule?.getFCMToken) {
    console.warn('FCMTokenModule is not available on iOS.');
    return null;
  }

  const fcmToken = await FCMTokenModule.getFCMToken();
  return fcmToken || null;
};

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

type NotificationNavigationPayload = {
  data?: any;
  title?: string | null;
  body?: string | null;
};

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
  const { currentUser, authInitialized } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pendingNotificationData, setPendingNotificationData] = useState<NotificationNavigationPayload | null>(null);
  const authStateRef = useRef({ authInitialized: false, hasUser: false });

  useEffect(() => {
    authStateRef.current = {
      authInitialized,
      hasUser: Boolean(currentUser?.id),
    };
  }, [authInitialized, currentUser?.id]);

  const extractNotificationValue = (value: any): string => {
    if (Array.isArray(value)) {
      return extractNotificationValue(value[0]);
    }

    if (value == null) {
      return '';
    }

    return String(value).trim();
  };

  const normalizeNotificationKey = (value: any) =>
    extractNotificationValue(value).toLowerCase().replace(/[^a-z0-9]+/g, '');

  const buildOrderNotificationParams = (payload: NotificationNavigationPayload, data: any) => {
    const notificationTitle = extractNotificationValue(payload?.title || data?.notification_title || data?.title);
    const notificationBody = extractNotificationValue(payload?.body || data?.notification_body || data?.body);
    const notificationStatus = extractNotificationValue(data?.status);
    const notificationFulfillmentMode = extractNotificationValue(data?.fulfillment_mode);
    const notificationOrderNumber = extractNotificationValue(data?.order_number);
    const notificationRecipientRole = extractNotificationValue(data?.recipient_role);

    return {
      ...(notificationTitle ? { notification_title: notificationTitle } : {}),
      ...(notificationBody ? { notification_body: notificationBody } : {}),
      ...(notificationStatus ? { notification_status: notificationStatus } : {}),
      ...(notificationFulfillmentMode ? { notification_fulfillment_mode: notificationFulfillmentMode } : {}),
      ...(notificationOrderNumber ? { notification_order_number: notificationOrderNumber } : {}),
      ...(notificationRecipientRole ? { notification_recipient_role: notificationRecipientRole } : {}),
    };
  };

  const openOrderDetails = (orderId: string, payload: NotificationNavigationPayload) => {
    const data = payload?.data || {};

    router.push({
      pathname: '/orders/[id]',
      params: {
        id: orderId,
        ...buildOrderNotificationParams(payload, data),
      },
    });
  };

  const openPartnerOrders = (
    partnerId: string,
    payload: NotificationNavigationPayload,
    orderId?: string | null,
    activeTab?: string | null,
  ) => {
    const data = payload?.data || {};

    router.push({
      pathname: '/partner/orders',
      params: {
        partnerId,
        ...(orderId ? { openOrderId: orderId } : {}),
        ...(activeTab ? { activeTab } : {}),
        ...buildOrderNotificationParams(payload, data),
      },
    });
  };

  const openChatConversation = (conversationId: string, petName?: string | null) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: conversationId,
        ...(petName ? { petName } : {}),
      },
    });
  };

  const openAdoptionChat = (
    petId: string,
    partnerId: string,
    petName?: string | null,
    partnerName?: string | null,
  ) => {
    router.push({
      pathname: '/chat/adoption',
      params: {
        petId,
        partnerId,
        ...(petName ? { petName } : {}),
        ...(partnerName ? { partnerName } : {}),
      },
    });
  };

  const openPetShareInvitation = (shareId: string) => {
    router.push({
      pathname: '/pet-share/[id]',
      params: {
        id: shareId,
      },
    });
  };

  const openPetCareHub = (petId: string, alertId?: string | null, alertType?: string | null) => {
    router.push({
      pathname: '/pets/care/[id]',
      params: {
        id: petId,
        ...(alertId ? { alertId } : {}),
        ...(alertType ? { alertType } : {}),
      },
    });
  };

  const openPetDetailsHealthTab = (petId: string, alertId?: string | null) => {
    router.push({
      pathname: '/pets/[id]',
      params: {
        id: petId,
        activeTab: 'health',
        ...(alertId ? { alertId } : {}),
      },
    });
  };

  const openPetMatchChat = (chatId: string, petName?: string | null) => {
    router.push({
      pathname: '/pets/mating/chat/[id]',
      params: {
        id: chatId,
        ...(petName ? { petName } : {}),
      },
    });
  };

  const openPetMatchingScreen = (petId: string, petName?: string | null) => {
    router.push({
      pathname: '/pets/mating/[id]',
      params: {
        id: petId,
        ...(petName ? { petName } : {}),
      },
    });
  };

  const resolvePetMatchChatId = async (matchId: string) => {
    try {
      const { data: existingChat, error: existingChatError } = await supabaseClient
        .from('pet_match_chats')
        .select('id')
        .eq('match_id', matchId)
        .maybeSingle();

      if (existingChatError) {
        console.warn('Error looking up pet match chat:', existingChatError);
      }

      if (existingChat?.id) {
        return existingChat.id as string;
      }

      const { data: matchData, error: matchError } = await supabaseClient
        .from('pet_matches')
        .select('id, owner_a_id, owner_b_id')
        .eq('id', matchId)
        .maybeSingle();

      if (matchError) {
        console.warn('Error looking up pet match for notification:', matchError);
        return null;
      }

      if (!matchData?.id) {
        return null;
      }

      const { data: upsertedChat, error: upsertError } = await supabaseClient
        .from('pet_match_chats')
        .upsert(
          {
            match_id: matchData.id,
            owner_a_id: matchData.owner_a_id,
            owner_b_id: matchData.owner_b_id,
            status: 'active',
          },
          { onConflict: 'match_id' }
        )
        .select('id')
        .single();

      if (upsertError) {
        console.warn('Error creating pet match chat from notification:', upsertError);
        return null;
      }

      return upsertedChat?.id || null;
    } catch (error) {
      console.warn('Unexpected error resolving pet match chat:', error);
      return null;
    }
  };

  const resolveOrderIdFromBooking = async (bookingId: string) => {
    try {
      const { data: orderData, error: orderError } = await supabaseClient
        .from('orders')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (orderError) {
        console.warn('Error resolving booking order from notification:', orderError);
        return null;
      }

      return orderData?.id || null;
    } catch (error) {
      console.warn('Unexpected error resolving booking order:', error);
      return null;
    }
  };

  const navigateFromNotification = (payload: NotificationNavigationPayload) => {
    const data = payload?.data || {};
    const notificationKey = normalizeNotificationKey(
      data?.screen || data?.type || data?.notification_type
    );
    const orderId = extractNotificationValue(
      data?.order_id || data?.orderId || data?.reference_id
    );
    const bookingId = extractNotificationValue(data?.booking_id || data?.bookingId);
    const conversationId = extractNotificationValue(
      data?.conversationId || data?.conversation_id || data?.chatId
    );
    const chatId = extractNotificationValue(data?.chat_id || data?.chatId);
    const matchId = extractNotificationValue(
      data?.match_id || data?.matchId || data?.reference_id
    );
    const petId = extractNotificationValue(data?.pet_id || data?.petId);
    const petName = extractNotificationValue(data?.pet_name || data?.petName);
    const partnerId = extractNotificationValue(
      data?.partner_id || data?.partnerId || data?.business_id || data?.businessId
    );
    const partnerName = extractNotificationValue(
      data?.partner_name || data?.partnerName || data?.business_name
    );
    const activeTab = extractNotificationValue(data?.active_tab || data?.activeTab);
    const alertId = extractNotificationValue(data?.alert_id || data?.alertId || data?.medical_alert_id);
    const alertType = extractNotificationValue(data?.alert_type || data?.alertType);

    if (
      notificationKey === 'orderdetails' ||
      notificationKey === 'orderstatuschange' ||
      notificationKey === 'order' ||
      (!notificationKey && orderId)
    ) {
      if (orderId) {
        openOrderDetails(orderId, payload);
        return true;
      }
    }

    if (
      notificationKey === 'petdetails' ||
      notificationKey === 'pethealth' ||
      notificationKey === 'vaccinereminder7days' ||
      notificationKey === 'vaccinereminder24hours'
    ) {
      if (petId) {
        openPetDetailsHealthTab(petId, alertId || null);
        return true;
      }
    }

    if (
      notificationKey === 'petcare' ||
      notificationKey === 'medicalreminder'
    ) {
      if (petId) {
        if (alertType === 'vaccine') {
          openPetDetailsHealthTab(petId, alertId || null);
        } else {
          openPetCareHub(petId, alertId || null, alertType || null);
        }
        return true;
      }
    }

    if (notificationKey === 'partnerorders' || notificationKey === 'partnerorderspage') {
      if (partnerId) {
        openPartnerOrders(partnerId, payload, orderId || null, activeTab || null);
        return true;
      }
    }

    if (
      notificationKey === 'chatmessage' ||
      notificationKey === 'chat' ||
      notificationKey === 'conversation'
    ) {
      if (conversationId) {
        openChatConversation(conversationId, petName || null);
        return true;
      }
    }

    if (notificationKey === 'adoptionchat') {
      if (petId && partnerId) {
        openAdoptionChat(petId, partnerId, petName || null, partnerName || null);
        return true;
      }
    }

    if (
      notificationKey === 'petmatchchat' ||
      notificationKey === 'petmatchmessage'
    ) {
      if (chatId) {
        openPetMatchChat(chatId, petName || null);
        return true;
      }

      if (matchId || petId) {
        void (async () => {
          const resolvedChatId = matchId ? await resolvePetMatchChatId(matchId) : null;

          if (resolvedChatId) {
            openPetMatchChat(resolvedChatId, petName || null);
            return;
          }

          if (petId) {
            openPetMatchingScreen(petId, petName || null);
          }
        })();

        return true;
      }
    }

    if (
      notificationKey === 'petmatching' ||
      notificationKey === 'petmatchcreated'
    ) {
      if (chatId) {
        openPetMatchChat(chatId, petName || null);
        return true;
      }

      if (matchId || petId) {
        void (async () => {
          const resolvedChatId = matchId ? await resolvePetMatchChatId(matchId) : null;

          if (resolvedChatId) {
            openPetMatchChat(resolvedChatId, petName || null);
            return;
          }

          if (petId) {
            openPetMatchingScreen(petId, petName || null);
          }
        })();

        return true;
      }
    }

    if (
      notificationKey === 'petshare' ||
      notificationKey === 'petsharerequest' ||
      notificationKey === 'petshareinvitation' ||
      notificationKey === 'petshareaccepted' ||
      notificationKey === 'petsharerejected'
    ) {
      const shareId = extractNotificationValue(
        data?.shareId || data?.share_id || data?.pet_share_id || data?.id || data?.reference_id
      );

      if (shareId) {
        openPetShareInvitation(shareId);
        return true;
      }
    }

    if (notificationKey === 'broadcast') {
      router.push('/(tabs)');
      return true;
    }

    if (
      notificationKey === 'bookingdetails' ||
      notificationKey === 'bookingreminder' ||
      notificationKey === 'bookingconfirmation'
    ) {
      if (orderId) {
        openOrderDetails(orderId, payload);
        return true;
      }

      if (bookingId) {
        void (async () => {
          const resolvedOrderId = await resolveOrderIdFromBooking(bookingId);

          if (resolvedOrderId) {
            openOrderDetails(resolvedOrderId, payload);
            return;
          }

          router.push('/orders');
        })();

        return true;
      }
    }

    return false;
  };

  const queueNotificationNavigation = (payload: NotificationNavigationPayload) => {
    if (!payload) {
      return;
    }

    const authReady = authStateRef.current.authInitialized && authStateRef.current.hasUser;

    if (!authReady) {
      setPendingNotificationData(payload);
      return;
    }

    if (!navigateFromNotification(payload)) {
      console.log('Notification tap ignored: unsupported data payload', payload);
    }
  };

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
    if (!pendingNotificationData) {
      return;
    }

    if (!authStateRef.current.authInitialized) {
      return;
    }

    if (!authStateRef.current.hasUser) {
      setPendingNotificationData(null);
      return;
    }

    if (navigateFromNotification(pendingNotificationData)) {
      setPendingNotificationData(null);
      return;
    }

    console.log('Notification tap ignored: unsupported data payload', pendingNotificationData);
    setPendingNotificationData(null);
  }, [pendingNotificationData, authInitialized, currentUser?.id]);

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
      const content = response?.notification?.request?.content || {};
      queueNotificationNavigation({
        data: content?.data,
        title: content?.title,
        body: content?.body,
      });
    });

    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
      void Notifications.getLastNotificationResponseAsync()
        .then((lastResponse: any) => {
          const content = lastResponse?.notification?.request?.content || {};
          if (content?.data || content?.title || content?.body) {
            queueNotificationNavigation({
              data: content?.data,
              title: content?.title,
              body: content?.body,
            });
          }
        })
        .catch((error: any) => {
          console.warn('Error reading last notification response:', error);
        });
    }

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
          const explicitMessage = explicitError instanceof Error ? explicitError.message : String(explicitError);
          console.log('❌ Failed with explicit project ID:', explicitMessage);
          console.log('Attempting without project ID...');
          
          try {
            tokenData = await Notifications.getExpoPushTokenAsync();
            console.log('✅ Token obtained without project ID');
          } catch (fallbackError) {
            const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
            console.log('❌ Failed without project ID:', fallbackMessage);
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

        // Get the real FCM token used by Firebase v1 on both Android and iOS.
        // IMPORTANTE: se guarda en fcm_token para priorizar envío v1
        let fcmToken: string | null = null;
        try {
          console.log('🔑 Getting Firebase Cloud Messaging token...');
          fcmToken = await getNativeFcmToken();

          const tokenType = 'FCM';
          console.log(`✅ ${tokenType} token obtained:`, fcmToken ? fcmToken.substring(0, 30) + '...' : 'null');

          if (!fcmToken) {
            console.error('❌ CRÍTICO: No se pudo obtener un FCM token');
            throw new Error('No se pudo obtener el token FCM. Las notificaciones podrían no funcionar.');
          }
        } catch (fcmError: any) {
          console.error('❌ Error obteniendo token FCM:', fcmError);
          throw new Error('Error al obtener token FCM: ' + fcmError.message);
        }

        // Store tokens in user profile if user is logged in
        if (currentUser) {
          console.log('💾 Storing push tokens in user profile...');

          // iOS y Android necesitan un FCM token real para usar el sender v1.
          if (!fcmToken) {
            console.error('❌ CRÍTICO: No se puede registrar notificaciones sin FCM token');
            throw new Error('No se pudo obtener el token FCM requerido para notificaciones.');
          }

          const fcmTokenToStore = fcmToken;

          console.log('- Expo Push Token (legacy):', tokenData.data ? tokenData.data.substring(0, 30) + '...' : 'null');
          if (fcmTokenToStore) {
            console.log('- FCM Token (PRIORITARIO):', fcmToken.substring(0, 30) + '...');
          } else if (fcmToken && Platform.OS === 'ios') {
            console.log('- APNs Token detectado en iOS:', fcmToken.substring(0, 30) + '...');
          }

          const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({
              push_token: tokenData.data,
              fcm_token: fcmTokenToStore,
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
          if (fcmTokenToStore) {
            console.log('✅ FCM v1 API ready on', Platform.OS);
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
        .select('push_token, fcm_token, notification_preferences')
        .eq('id', userId)
        .single();

      if (!profile?.fcm_token && !profile?.push_token) {
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
          token: profile.fcm_token || profile.push_token,
          expoPushToken: profile.push_token || undefined,
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
        console.log('✅ Expo token actual:', currentExpoToken ? currentExpoToken.substring(0, 30) + '...' : 'null');

        if (currentExpoToken !== storedPushToken) {
          console.log('🔄 Expo token cambió, necesita actualización');
          needsUpdate = true;
        }
      } catch (tokenError) {
        console.warn('⚠️ No se pudo obtener Expo token:', tokenError);
      }

      try {
        currentFcmToken = await getNativeFcmToken();

        const tokenType = 'FCM';
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
