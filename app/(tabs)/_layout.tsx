// Polyfill for navigator object in Node.js environment
if (typeof navigator === 'undefined') {
  global.navigator = {
    userAgent: 'node',
    platform: 'node'
  };
}

import { Tabs } from 'expo-router';
import { Chrome as Home, PawPrint, ShoppingBag, Briefcase, User, MapPin } from 'lucide-react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext'; 
import { router, usePathname } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';

export default function TabLayout() {
  const { t } = useLanguage();
  const { currentUser, authInitialized } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (authInitialized && !currentUser) {
      console.log('User not authenticated in tabs layout, redirecting to login');
      router.replace('/auth/login');
    }
  }, [currentUser, authInitialized]);

  // Show loading while checking user
  if (!authInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 30 }}>
        <ActivityIndicator size="large" color="#2D6A6F" />
        <Text style={{ marginTop: 10, fontFamily: 'Inter-Regular' }}>Cargando...</Text>
      </View>
    );
  }
  
  // Don't render if not authenticated
  if (!currentUser) {
    return null;
  }

  // Don't render regular tabs for admin users
  if (currentUser.email === 'admin@dogcatify.com') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 30 }}>
        <ActivityIndicator size="large" color="#2D6A6F" />
        <Text style={{ marginTop: 10, fontFamily: 'Inter-Regular' }}>Redirigiendo al panel de administración...</Text>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2D6A6F',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF', 
          borderTopWidth: 0,
          paddingTop: 5,
          paddingBottom: 5,
          height: 60,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Inter-Medium',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          title: 'Mascotas',
          tabBarIcon: ({ size, color }) => (
            <PawPrint size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: t('shop'),
          tabBarIcon: ({ size, color }) => (
            <ShoppingBag size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: t('services'),
          tabBarIcon: ({ size, color }) => (
            <Briefcase size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: 'Lugares',
          tabBarIcon: ({ size, color }) => (
            <MapPin size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="partner-register"
        options={{
          href: null, // This hides the route from the tab bar
        }}
      />
    </Tabs>
  );
}