import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { supabaseClient } from '../lib/supabase';

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

  // Check if notifications are enabled on mount
  useEffect(() => {
    if (isExpoGo || Platform.OS === 'web' || !Notifications) {
      console.log('Notifications not available in this environment');
      return;
    }

    // Check stored notification preference
    if (currentUser) {
      checkNotificationStatus();
    }
  }, [currentUser]);

  const checkNotificationStatus = async () => {
    try {
      const { data } = await supabaseClient
        .from('profiles')
        .select('push_token, fcm_token, notification_preferences')
        .eq('id', currentUser!.id)
        .single();

      if (data?.push_token) {
        setExpoPushToken(data.push_token);
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

        // Get FCM token for Android (native token for FCM v1 API)
        let fcmToken: string | null = null;
        if (Platform.OS === 'android') {
          try {
            console.log('Getting native FCM token for Android...');
            const devicePushToken = await Notifications.getDevicePushTokenAsync();
            fcmToken = devicePushToken.data;
            console.log('✅ FCM token obtained:', fcmToken ? fcmToken.substring(0, 30) + '...' : 'null');
          } catch (fcmError) {
            console.warn('⚠️ Could not get FCM token:', fcmError);
          }
        }

        // Store tokens in user profile if user is logged in
        if (currentUser && tokenData.data) {
          console.log('Storing push tokens in user profile...');
          console.log('- Expo Push Token:', tokenData.data.substring(0, 30) + '...');
          if (fcmToken) {
            console.log('- FCM Token:', fcmToken.substring(0, 30) + '...');
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
            console.error('Error updating push tokens:', updateError);
            throw new Error('No se pudo guardar el token de notificación.');
          }

          console.log('✅ Push tokens saved successfully');
          if (fcmToken) {
            console.log('✅ FCM v1 API ready for Android');
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
      // Check if target user has notifications enabled
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('push_token, notification_preferences')
        .eq('id', userId)
        .single();

      if (!profile?.push_token) {
        console.log('❌ User does not have push notifications enabled');
        return;
      }

      const preferences = profile.notification_preferences || {};
      if (preferences.push === false) {
        console.log('❌ User has disabled push notifications');
        return;
      }

      console.log('🚀 Sending push notification via Edge Function...');
      console.log('Target user ID:', userId);
      console.log('Title:', title);
      console.log('Body:', body);
      
      // Call our secure Edge Function
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          userId,
          title,
          body,
          data: data || {}
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Edge Function error:', response.status, errorText);
        throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Push notification sent via Edge Function:', result);
      
      if (!result.success) {
        console.warn('⚠️ Edge Function returned success=false:', result.error);
      }
    } catch (error) {
      console.error('❌ Error sending push notification via Edge Function:', error);
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
      
      // Use Edge Function for admin notifications too
      await sendNotificationToUser('admin@dogcatify.com', title, body, data);
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
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
