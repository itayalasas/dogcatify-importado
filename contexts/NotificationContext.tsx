import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert, Linking, __DEV__ } from 'react-native';
import { supabaseClient } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { router } from 'expo-router';

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
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [currentUser]);

  const registerForPushNotifications = async (): Promise<string | null> => {
    let token = null;

    // Check if we're in Expo Go (which doesn't support push notifications in SDK 53+)
    const isExpoGo = Constants.appOwnership === 'expo';
    
    if (isExpoGo && __DEV__) {
      console.warn('Push notifications are not supported in Expo Go. Use a development build for full functionality.');
      return null;
    }

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
        if (!isExpoGo) {
          Alert.alert(
            'Permisos de notificaciones',
            'Para recibir notificaciones importantes, habilita los permisos en la configuración de la app.'
          );
        }
        return null;
      }
      
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
          console.warn('Project ID not found for push notifications');
          return null;
        }
        
        token = (await Notifications.getExpoPushTokenAsync({
          projectId,
        })).data;
        
        console.log('Expo push token:', token);
      } catch (error) {
        console.error('Error getting push token:', error);
        if (!isExpoGo) {
          Alert.alert('Error', 'No se pudo registrar para notificaciones push');
        }
      }
    } else {
      if (!isExpoGo) {
        Alert.alert('Error', 'Las notificaciones push solo funcionan en dispositivos físicos');
      }
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
    
    console.log('Notification tapped with data:', data);
    
    // Verificar si el usuario está autenticado
    if (!currentUser) {
      console.log('User not authenticated, redirecting to login');
      // Si no está autenticado, redirigir al login con deep link
      if (data?.deepLink) {
        // Guardar el deep link para después del login
        router.push({
          pathname: '/auth/login',
          params: { redirectTo: data.deepLink }
        });
      } else {
        router.push('/auth/login');
      }
      return;
    }
    
    // Usuario autenticado, manejar navegación según el tipo
    if (data?.deepLink) {
      console.log('Navigating to deep link:', data.deepLink);
      handleDeepLink(data.deepLink);
    } else if (data?.type) {
      // Fallback para tipos específicos sin deep link
      handleNotificationTypeNavigation(data.type, data);
    }
  };

  const handleDeepLink = (deepLink: string) => {
    try {
      // Limpiar y formatear el path correctamente
      let path = deepLink.replace('dogcatify://', '');
      
      // Asegurar que empiece con /
      if (!path.startsWith('/')) {
        path = '/' + path;
      }
      
      console.log('Cleaned path for navigation:', path);
      
      // Navegar usando expo-router
      if (path.startsWith('/(admin-tabs)')) {
        router.push(path as any);
      } else if (path.startsWith('/(tabs)')) {
        router.push(path as any);
      } else {
        // Para rutas que no empiecen con grupos, agregar /
        router.push(path as any);
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
      // Fallback a la pantalla principal
      if (currentUser?.email?.toLowerCase() === 'admin@dogcatify.com') {
        router.push('/(admin-tabs)/requests');
      } else {
        router.push('/(tabs)');
      }
    }
  };

  const handleNotificationTypeNavigation = (type: string, data: any) => {
    switch (type) {
      case 'partner_request':
        // Verificar si es admin
        if (currentUser?.email?.toLowerCase() === 'admin@dogcatify.com') {
          router.push('/(admin-tabs)/requests');
        } else {
          router.push('/(tabs)/profile');
        }
        break;
      case 'partner_approved':
        router.push('/(tabs)/profile');
        break;
      case 'booking_confirmation':
        router.push('/(tabs)/services');
        break;
      case 'order_update':
        router.push('/orders');
        break;
      default:
        router.push('/(tabs)');
    }
  };

  const sendNotification = async (title: string, body: string, data?: any) => {
    if (!expoPushToken) {
      console.log('No push token available - notifications may not be supported in current environment');
      return;
    }

    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data: data || {},
      // Agregar logo de DogCatiFy
      icon: 'https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/system/logo-notification.png',
      image: 'https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/system/logo-notification.png',
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
      // Check if we're in a supported environment
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo && __DEV__) {
        console.log('Skipping notification in Expo Go environment');
        return;
      }

      // Obtener el token del usuario
      const { data: userData, error } = await supabaseClient
        .from('profiles')
        .select('push_token')
        .eq('id', userId)
        .single();

      if (error || !userData?.push_token) {
        console.log('User push token not found or notifications not supported');
        return;
      }

      const message = {
        to: userData.push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
        // Agregar logo de DogCatiFy
        icon: 'https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/system/logo-notification.png',
        image: 'https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/system/logo-notification.png',
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
      // Check if we're in a supported environment
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo && __DEV__) {
        console.log('Skipping admin notification in Expo Go environment');
        return;
      }

      // Obtener el token del admin
      const { data: adminData, error } = await supabaseClient
        .from('profiles')
        .select('push_token')
        .eq('email', 'admin@dogcatify.com')
        .single();

      if (error || !adminData?.push_token) {
        console.log('Admin push token not found or notifications not supported');
        return;
      }

      const message = {
        to: adminData.push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
        // Agregar logo de DogCatiFy
        icon: 'https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/system/logo-notification.jpg',
        image: 'https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/system/logo-notification.jpg',
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