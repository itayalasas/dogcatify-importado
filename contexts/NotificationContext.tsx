import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { supabaseClient } from '../lib/supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  registerForPushNotifications: () => Promise<string | null>;
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
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const { currentUser } = useAuth();

  // Auto-register push token when user is authenticated
  useEffect(() => {
    // Don't auto-register in Expo Go only
    const isExpoGo = Constants.appOwnership === 'expo';
    if (currentUser && !expoPushToken && !isExpoGo) {
      console.log('User authenticated, auto-registering push notifications...');
      registerForPushNotifications();
    } else if (isExpoGo) {
      console.log('Skipping auto-registration in Expo Go - notifications not supported');
    }
  }, [currentUser]);
  useEffect(() => {
    // Set up notification listeners
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      setNotification(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
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
      console.log('=== DETAILED PUSH NOTIFICATION REGISTRATION DEBUG ===');
      console.log('Starting push notification registration...');
      console.log('App ownership:', Constants.appOwnership);
      console.log('Is device:', Device.isDevice);
      console.log('Platform:', Platform.OS);
      console.log('Constants.platform:', Constants.platform);
      console.log('Constants.expoConfig:', Constants.expoConfig);
      console.log('EAS Project ID:', Constants.expoConfig?.extra?.eas?.projectId);
      
      // Only skip in Expo Go, not in development builds
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        console.log('Running in Expo Go - push notifications not supported');
        return null;
      }
      
      // For web, skip push notifications
      if (Platform.OS === 'web') {
        console.log('Web platform - push notifications not supported');
        return null;
      }

      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.log('❌ Must use physical device for Push Notifications');
        console.log('Device info:', {
          isDevice: Device.isDevice,
          deviceType: Device.deviceType,
          modelName: Device.modelName,
          osName: Device.osName,
          osVersion: Device.osVersion
        });
        return null;
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
            });
            console.log('✅ Android notification channel configured');
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
              description: 'Notificaciones de reservas y confirmaciones',
            });
            console.log('✅ Bookings notification channel configured');
          } catch (bookingsChannelError) {
            console.error('❌ Error setting up bookings channel:', bookingsChannelError);
          }
        }

        // Store token in user profile if user is logged in
        if (currentUser && tokenData.data) {
          console.log('Storing push token in user profile...');
          try {
            // First check if user already has a different token
            const { data: existingProfile, error: fetchError } = await supabaseClient
              .from('profiles')
              .select('push_token')
              .eq('id', currentUser.id);
            
            if (fetchError) {
              console.error('Error fetching existing profile:', fetchError);
            } else {
              const currentToken = existingProfile?.[0]?.push_token;
              console.log('Current stored token exists:', !!currentToken);
              console.log('New token exists:', !!tokenData.data);
              console.log('Tokens are different:', currentToken !== tokenData.data);
              
              if (currentToken !== tokenData.data) {
                console.log('Token changed, updating in database...');
                const { error: updateError } = await supabaseClient
                  .from('profiles')
                  .update({ 
                    push_token: tokenData.data,
                    notification_preferences: {
                      push: true,
                      email: true
                    },
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', currentUser.id);
                
                if (updateError) {
                  console.error('Error updating push token:', updateError);
                } else {
                  console.log('Push token updated successfully in profile');
                }
              } else {
                console.log('Token unchanged, no update needed');
              }
            }
          } catch (dbError) {
            console.error('Database error managing push token:', dbError);
            // Don't fail registration if database update fails
            console.log('Continuing with token registration despite database error');
          }
        }

        setExpoPushToken(tokenData.data);
        console.log('✅ Push notification registration completed successfully!');
        console.log('=== END DETAILED PUSH NOTIFICATION REGISTRATION DEBUG ===');
        return tokenData.data;
      } catch (tokenError) {
        console.error('❌ Error getting push token:', tokenError);
        console.error('Token error details:', JSON.stringify(tokenError, null, 2));
        console.log('=== END DETAILED PUSH NOTIFICATION REGISTRATION DEBUG ===');
        return null;
      }
    } catch (error) {
      console.error('❌ Error in registerForPushNotifications:', error);
      console.error('Registration error details:', JSON.stringify(error, null, 2));
      console.log('=== END DETAILED PUSH NOTIFICATION REGISTRATION DEBUG ===');
      return null;
    }
  };

  const sendNotificationToUser = async (
    userId: string, 
    title: string, 
    body: string, 
    data?: any
  ): Promise<void> => {
    try {
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

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        registerForPushNotifications,
        sendNotificationToUser,
        sendNotificationToAdmin,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};