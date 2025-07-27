import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { supabaseClient } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Configurar el comportamiento de las notificaciones
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
  sendNotification: (title: string, body: string, data?: any) => Promise<void>;
  sendNotificationToUser: (userId: string, title: string, body: string, data?: any) => Promise<void>;
  sendNotificationToAdmin: (title: string, body: string, data?: any) => Promise<void>;
  registerForPushNotifications: () => Promise<string | null>;
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
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const { currentUser } = useAuth();

  useEffect(() => {
    // Registrar para notificaciones push cuando el usuario se autentica
    if (currentUser) {
      registerForPushNotifications().then(token => {
        if (token) {
          setExpoPushToken(token);
          // Guardar el token en la base de datos
          saveTokenToDatabase(token);
        }
      });
    }

    // Listener para notificaciones recibidas
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      setNotification(notification);
    });

    // Listener para cuando el usuario toca una notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      handleNotificationResponse(response);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [currentUser]);

  const registerForPushNotifications = async (): Promise<string | null> => {
    let token = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permisos de notificaciones',
          'Para recibir notificaciones importantes, habilita los permisos en la configuración de la app.'
        );
        return null;
      }
      
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
          throw new Error('Project ID not found');
        }
        
        token = (await Notifications.getExpoPushTokenAsync({
          projectId,
        })).data;
        
        console.log('Expo push token:', token);
      } catch (error) {
        console.error('Error getting push token:', error);
        Alert.alert('Error', 'No se pudo registrar para notificaciones push');
      }
    } else {
      Alert.alert('Error', 'Las notificaciones push solo funcionan en dispositivos físicos');
    }

    return token;
  };

  const saveTokenToDatabase = async (token: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabaseClient
        .from('profiles')
        .update({
          push_token: token,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (error) throw error;
      console.log('Push token saved to database');
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;
    
    // Manejar diferentes tipos de notificaciones
    if (data?.type === 'partner_request') {
      // Navegar a la pantalla de solicitudes de aliados
      console.log('Navigate to partner requests');
    } else if (data?.type === 'booking_confirmation') {
      // Navegar a la pantalla de reservas
      console.log('Navigate to bookings');
    }
    // Agregar más tipos según sea necesario
  };

  const sendNotification = async (title: string, body: string, data?: any) => {
    if (!expoPushToken) {
      console.log('No push token available');
      return;
    }

    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data: data || {},
    };

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      console.log('Notification sent successfully');
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const sendNotificationToUser = async (userId: string, title: string, body: string, data?: any) => {
    try {
      // Obtener el token del usuario
      const { data: userData, error } = await supabaseClient
        .from('profiles')
        .select('push_token')
        .eq('id', userId)
        .single();

      if (error || !userData?.push_token) {
        console.log('User push token not found');
        return;
      }

      const message = {
        to: userData.push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      
      console.log('Notification sent to user:', userId);
    } catch (error) {
      console.error('Error sending notification to user:', error);
    }
  };

  const sendNotificationToAdmin = async (title: string, body: string, data?: any) => {
    try {
      // Obtener el token del admin
      const { data: adminData, error } = await supabaseClient
        .from('profiles')
        .select('push_token')
        .eq('email', 'admin@dogcatify.com')
        .single();

      if (error || !adminData?.push_token) {
        console.log('Admin push token not found');
        return;
      }

      const message = {
        to: adminData.push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      
      console.log('Notification sent to admin');
    } catch (error) {
      console.error('Error sending notification to admin:', error);
    }
  };

  const value = {
    expoPushToken,
    notification,
    sendNotification,
    sendNotificationToUser,
    sendNotificationToAdmin,
    registerForPushNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};