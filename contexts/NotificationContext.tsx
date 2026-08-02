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
    }
  } catch (apnsError) {
  }

  if (!FCMTokenModule?.getFCMToken) {
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
        return null;
      }

      return upsertedChat?.id || null;
    } catch (error) {
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
        return null;
      }

      return orderData?.id || null;
    } catch (error) {
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
    }
  };

  // Check and validate tokens when user logs in
  useEffect(() => {
    if (isExpoGo || Platform.OS === 'web' || !Notifications) {
      if (isExpoGo) {
      } else if (Platform.OS === 'web') {
      } else {
      }
      return;
    }

    if (currentUser) {
      // Ejecutar validación y actualización de tokens de forma asíncrona
      (async () => {
        try {
          await validateAndUpdateTokens();
        } catch (error) {
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

    setPendingNotificationData(null);
  }, [pendingNotificationData, authInitialized, currentUser?.id]);

  useEffect(() => {
    if (isExpoGo || Platform.OS === 'web' || !Notifications) {
      return;
    }

    // Set up notification listeners
    const notificationListener = Notifications.addNotificationReceivedListener((notification: any) => {
      setNotification(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
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
        });
    }

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  const registerForPushNotifications = async (): Promise<string | null> => {
    try {

      // Check environment
      if (isExpoGo) {
        throw new Error('Las notificaciones no están disponibles en Expo Go. Necesitas una build de desarrollo o producción.');
      }

      if (Platform.OS === 'web') {
        throw new Error('Las notificaciones push no están disponibles en la web.');
      }

      if (!Notifications || !Device) {
        throw new Error('Los módulos de notificación no están disponibles.');
      }

      // Check if device supports push notifications
      if (!Device.isDevice) {
        throw new Error('Las notificaciones solo funcionan en dispositivos físicos, no en simuladores.');
      }


      // Get current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      let finalStatus = existingStatus;
      
      // Request permissions if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        return null;
      }


      // Get the push token
      try {
        // Use the exact project ID
        const projectId = '0618d9ae-6714-46bb-adce-f4ee57fff324';
        
        
        
        // Try with explicit project ID first
        let tokenData;
        try {
          tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          });
        } catch (explicitError) {
          const explicitMessage = explicitError instanceof Error ? explicitError.message : String(explicitError);
          
          try {
            tokenData = await Notifications.getExpoPushTokenAsync();
          } catch (fallbackError) {
            const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
            throw fallbackError;
          }
        }


        // Configure Android notification channel
        if (Platform.OS === 'android') {
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
          } catch (channelError) {
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
          } catch (chatChannelError) {
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
          } catch (bookingsChannelError) {
          }
        }

        // Get the real FCM token used by Firebase v1 on both Android and iOS.
        // IMPORTANTE: se guarda en fcm_token para priorizar envío v1
        let fcmToken: string | null = null;
        try {
          fcmToken = await getNativeFcmToken();

          const tokenType = 'FCM';

          if (!fcmToken) {
            throw new Error('No se pudo obtener el token FCM. Las notificaciones podrían no funcionar.');
          }
        } catch (fcmError: any) {
          throw new Error('Error al obtener token FCM: ' + fcmError.message);
        }

        // Store tokens in user profile if user is logged in
        if (currentUser) {

          // iOS y Android necesitan un FCM token real para usar el sender v1.
          if (!fcmToken) {
            throw new Error('No se pudo obtener el token FCM requerido para notificaciones.');
          }

          const fcmTokenToStore = fcmToken;

          if (fcmTokenToStore) {
          } else if (fcmToken && Platform.OS === 'ios') {
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
            throw new Error('No se pudo guardar el token de notificación.');
          }

          if (fcmTokenToStore) {
          } else {
          }
        }

        setExpoPushToken(tokenData.data);
        setNotificationsEnabled(true);
        return tokenData.data;
      } catch (tokenError: any) {
        throw tokenError;
      }
    } catch (error: any) {
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
        return;
      }

      const preferences = profile.notification_preferences || {};
      if (preferences.push === false) {
        return;
      }


      // Call FCM v1 Edge Function
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      const anonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

      if (!supabaseUrl || !anonKey) {
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
        throw new Error(`FCM v1 Edge Function error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
      }
    } catch (error) {
      // Don't throw error to avoid breaking the chat flow
    }
  };


  const sendNotificationToAdmin = async (
    title: string, 
    body: string, 
    data?: any
  ): Promise<void> => {
    try {

      const { data: adminProfile, error: adminError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('is_admin', true)
        .limit(1)
        .maybeSingle();

      if (adminError || !adminProfile?.id) {
        return;
      }

      await sendNotificationToUser(adminProfile.id, title, body, data);
    } catch (error) {
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
    } catch (error) {
      throw error;
    }
  };

  const validateAndUpdateTokens = async (): Promise<void> => {
    if (isExpoGo || Platform.OS === 'web' || !Notifications || !Device) {
      return;
    }

    if (!currentUser) {
      return;
    }

    try {

      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('push_token, fcm_token, notification_preferences')
        .eq('id', currentUser.id)
        .single();

      if (profileError) {
        return;
      }

      const storedPushToken = profile?.push_token;
      const storedFcmToken = profile?.fcm_token;


      let needsUpdate = false;
      let currentExpoToken: string | null = null;
      let currentFcmToken: string | null = null;

      if (!Device.isDevice) {
        return;
      }

      const { status } = await Notifications.getPermissionsAsync();

      if (status !== 'granted') {

        // Si el usuario tiene tokens almacenados, los limpiamos porque los permisos fueron revocados
        if (storedPushToken || storedFcmToken) {
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
          try {
            await registerForPushNotifications();
            return; // Salir porque registerForPushNotifications ya actualiza la DB
          } catch (registerError) {
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

        if (currentExpoToken !== storedPushToken) {
          needsUpdate = true;
        }
      } catch (tokenError) {
      }

      try {
        currentFcmToken = await getNativeFcmToken();

        const tokenType = 'FCM';

        if (currentFcmToken !== storedFcmToken) {
          needsUpdate = true;
        }
      } catch (fcmError) {
      }

      // IMPORTANTE: Si el usuario no tiene tokens, intentamos obtenerlos
      if (!storedPushToken && !storedFcmToken && (currentExpoToken || currentFcmToken)) {
        needsUpdate = true;
      }

      // Si el usuario NO tiene tokens almacenados y NO pudimos obtener tokens actuales,
      // intentamos registrar las notificaciones por primera vez
      if (!storedPushToken && !storedFcmToken && !currentExpoToken && !currentFcmToken) {
        try {
          // Intentar registro completo (esto pedirá permisos si no están otorgados)
          await registerForPushNotifications();
          return; // Salir porque registerForPushNotifications ya actualiza la DB
        } catch (registerError) {
          return;
        }
      }

      if (needsUpdate) {

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
        } else {
          setExpoPushToken(currentExpoToken);
          setNotificationsEnabled(true);

          if (currentFcmToken) {
          }
        }
      } else {
        setExpoPushToken(storedPushToken);
        setNotificationsEnabled(true);
      }

    } catch (error) {
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
