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
    shouldSetBadge: false,
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
      console.log('Starting push notification registration...');
      
      // Check if running in Expo Go
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        console.log('Running in Expo Go - push notifications not supported in SDK 53+');
        return null;
      }

      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
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
        console.log('Push notification permissions not granted. Final status:', finalStatus);
        return null;
      }

      console.log('Permissions granted, getting push token...');

      // Get the push token
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_PROJECT_ID;
        console.log('Using project ID:', projectId);
        
        if (!projectId) {
          console.error('No project ID found for push notifications');
          return null;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        });

        console.log('Push token obtained:', tokenData.data);

        // Configure Android notification channel
        if (Platform.OS === 'android') {
          console.log('Setting up Android notification channel...');
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        // Store token in user profile if user is logged in
        if (currentUser && tokenData.data) {
          console.log('Storing push token in user profile...');
          try {
            const { error } = await supabaseClient
              .from('profiles')
              .update({ push_token: tokenData.data })
              .eq('id', currentUser.id);
            
            if (error) {
              console.error('Error storing push token:', error);
            } else {
              console.log('Push token stored successfully in profile');
            }
          } catch (dbError) {
            console.error('Database error storing push token:', dbError);
          }
        }

        setExpoPushToken(tokenData.data);
        return tokenData.data;
      } catch (tokenError) {
        console.error('Error getting push token:', tokenError);
        return null;
      }
    } catch (error) {
      console.error('Error in registerForPushNotifications:', error);
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
      console.log('Sending notification to user:', userId);
      
      // Get user's push token
      const { data: userData, error } = await supabaseClient
        .from('profiles')
        .select('push_token')
        .eq('id', userId)
        .single();

      if (error || !userData?.push_token) {
        console.log('User does not have a push token or error fetching:', error);
        return;
      }

      console.log('Sending push notification to token:', userData.push_token);

      // Send push notification
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: userData.push_token,
          title,
          body,
          data,
          sound: 'default',
          priority: 'high',
        }),
      });

      const result = await response.json();
      console.log('Push notification result:', result);
    } catch (error) {
      console.error('Error sending notification to user:', error);
    }
  };

  const sendNotificationToAdmin = async (
    title: string, 
    body: string, 
    data?: any
  ): Promise<void> => {
    try {
      console.log('Sending notification to admin');
      
      // Get admin users (you can define admin criteria)
      const { data: adminUsers, error } = await supabaseClient
        .from('profiles')
        .select('push_token')
        .eq('email', 'admin@dogcatify.com'); // Or however you identify admins

      if (error || !adminUsers?.length) {
        console.log('No admin users found or error:', error);
        return;
      }

      // Send to all admin users
      const notifications = adminUsers
        .filter(admin => admin.push_token)
        .map(admin => ({
          to: admin.push_token,
          title,
          body,
          data,
          sound: 'default',
          priority: 'high',
        }));

      if (notifications.length > 0) {
        console.log('Sending notifications to', notifications.length, 'admin users');
        
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notifications),
        });

        const result = await response.json();
        console.log('Admin push notification result:', result);
      }
    } catch (error) {
      console.error('Error sending notification to admin:', error);
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