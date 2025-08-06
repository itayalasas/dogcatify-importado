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

  // Auto-register push token when user is authenticated
  useEffect(() => {
    // Don't auto-register in Expo Go or if notifications are not supported
    const isExpoGo = Constants.appOwnership === 'expo' || __DEV__;
    if (currentUser && !expoPushToken && !isExpoGo) {
      console.log('User authenticated, auto-registering push notifications...');
      registerForPushNotifications();
    } else if (isExpoGo) {
      console.log('Skipping auto-registration in development/Expo Go - notifications not supported');
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
      console.log('Starting push notification registration...');
      
      // Check if running in Expo Go or development
      const isExpoGo = Constants.appOwnership === 'expo' || __DEV__;
      if (isExpoGo) {
        console.log('Running in development/Expo Go - push notifications not supported');
        return null;
      }
      
      // For web, skip push notifications
      if (Platform.OS === 'web') {
        console.log('Web platform - push notifications not supported');
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
            // First check if user already has a different token
            const { data: existingProfile, error: fetchError } = await supabaseClient
              .from('profiles')
              .select('push_token')
              .eq('id', currentUser.id);
            
            if (fetchError) {
              console.error('Error fetching existing profile:', fetchError);
            } else {
              const currentToken = existingProfile?.[0]?.push_token;
              console.log('Current stored token:', currentToken ? 'EXISTS' : 'NULL');
              console.log('New token:', tokenData.data);
              
              if (currentToken !== tokenData.data) {
                console.log('Token changed, updating in database...');
                const { error: updateError } = await supabaseClient
                  .from('profiles')
                  .update({ 
                    push_token: tokenData.data,
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
      console.log('=== SENDING PUSH NOTIFICATION ===');
      console.log('Target user ID:', userId);
      console.log('Notification title:', title);
      console.log('Notification body:', body);
      console.log('Additional data:', data);
      
      // First check if this is a partner_id that needs to be converted to user_id
      console.log('Fetching push token for user...');
      
      // Try to get user profile directly first
      const { data: userData, error } = await supabaseClient
        .from('profiles')
        .select('push_token, display_name')
        .eq('id', userId);
      
      console.log('Push token query result:', { 
        userData, 
        error: error?.message,
        userCount: userData?.length || 0
      });

      if (error || !userData || userData.length === 0) {
        console.log('No direct user profile found, checking if this is a partner_id...');
        
        // Try to find partner and get their user_id
        const { data: partnerData, error: partnerError } = await supabaseClient
          .from('partners')
          .select('user_id, business_name')
          .eq('id', userId);
        
        console.log('Partner lookup result:', {
          partnerData,
          error: partnerError?.message,
          partnerCount: partnerData?.length || 0
        });
        
        if (partnerError || !partnerData || partnerData.length === 0) {
          console.log('❌ No partner found with ID:', userId);
          return;
        }
        
        const partner = partnerData[0];
        if (!partner.user_id) {
          console.log('❌ Partner has no user_id:', partner);
          return;
        }
        
        console.log('✅ Found partner, getting user profile for user_id:', partner.user_id);
        
        // Now get the actual user profile
        const { data: partnerUserData, error: partnerUserError } = await supabaseClient
          .from('profiles')
          .select('push_token, display_name')
          .eq('id', partner.user_id);
        
        console.log('Partner user profile result:', {
          partnerUserData,
          error: partnerUserError?.message,
          userCount: partnerUserData?.length || 0
        });
        
        if (partnerUserError || !partnerUserData || partnerUserData.length === 0) {
          console.log('❌ No user profile found for partner user_id:', partner.user_id);
          return;
        }
        
        // Use partner user data
        const userProfile = partnerUserData[0];
        console.log('✅ Using partner user profile:', {
          displayName: userProfile.display_name,
          hasPushToken: !!userProfile.push_token,
          tokenPreview: userProfile.push_token ? userProfile.push_token.substring(0, 20) + '...' : 'NULL'
        });
        
        if (!userProfile.push_token) {
          console.log('❌ Partner user has no push token registered');
          return;
        }
        
        // Send notification using partner user's token
        await sendPushNotification(userProfile.push_token, title, body, data);
        return;
      }
      
      const userProfile = userData[0];
      console.log('User profile found:', {
        displayName: userProfile.display_name,
        hasPushToken: !!userProfile.push_token,
        tokenPreview: userProfile.push_token ? userProfile.push_token.substring(0, 20) + '...' : 'NULL'
      });
      
      if (!userProfile.push_token) {
        console.log('❌ User has no push token registered');
        return;
      }
      
      // Send notification using user's token
      await sendPushNotification(userProfile.push_token, title, body, data);
    } catch (error) {
      console.error('❌ Error in sendNotificationToUser:', error);
      // Don't throw error to avoid breaking the chat flow
    }
  };

  const sendPushNotification = async (
    pushToken: string,
    title: string,
    body: string,
    data?: any
  ) => {
    try {
      console.log('✅ User has push token, preparing notification...');

      // Validate token format
      if (!pushToken.startsWith('ExponentPushToken[')) {
        console.error('❌ Invalid push token format:', pushToken);
        return;
      }

      // Send push notification
      const notificationPayload = {
        to: pushToken,
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      };
      
      console.log('📤 Sending push notification with payload:', {
        to: pushToken.substring(0, 20) + '...',
        title,
        body,
        dataKeys: Object.keys(data || {})
      });
      
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationPayload),
      });

      console.log('📨 Push notification API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Push notification API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Push notification API error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('📨 Push notification API result:', result);
      
      // Check for errors in the result
      if (result.data && Array.isArray(result.data)) {
        const firstResult = result.data[0];
        if (firstResult && firstResult.status === 'error') {
          console.error('❌ Push notification error in result:', firstResult);
          throw new Error(`Push notification error: ${firstResult.message || firstResult.details}`);
        }
      }
      
      console.log('✅ Push notification sent successfully!');
      console.log('=== END PUSH NOTIFICATION ===');
    } catch (error) {
      console.error('❌ Error in sendPushNotification:', error);
      throw error;
    }
  };

  const sendNotificationToAdmin = async (
    title: string, 
    body: string, 
    data?: any
  ): Promise<void> => {
    try {
      console.log('Sending notification to admin');
      
      // Get admin users
      const { data: adminUsers, error } = await supabaseClient
        .from('profiles')
        .select('push_token')
        .eq('email', 'admin@dogcatify.com');

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