import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Shield, Users, Settings, TrendingUp, Megaphone } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { supabaseClient } from '../../lib/supabase';

// Función para añadir logs detallados
const logDebug = (message: string, data?: any) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[DEBUG AdminLayout ${timestamp}] ${message}`, data || '');
};

export default function AdminTabLayout() {
  const { currentUser, loading: authLoading, authInitialized } = useAuth();
  const [loading, setLoading] = useState(true);

  // Función para verificar si hay solicitudes pendientes
  const checkPendingRequests = async () => {
    try {
      logDebug('Checking for pending partner requests...');
      const { count, error } = await supabaseClient
        .from('partners')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', false);
      
      if (error) {
        logDebug('Error checking pending requests:', error);
      } else {
        logDebug(`Found ${count || 0} pending partner requests`);
      }
    } catch (err) {
      logDebug('Error in checkPendingRequests:', err);
    }
  };

  useEffect(() => {
    // Set a short timeout to ensure auth state is properly loaded
    const timer = setTimeout(async () => {
      logDebug('Auth state loaded check:', currentUser?.email || 'No user email');
      if (authInitialized) {
        if (!currentUser) {
          logDebug('No current user, will redirect to login');
        } else {
          logDebug('Current user found:', currentUser.email);
        }
        
        if (currentUser?.email?.toLowerCase() === 'admin@dogcatify.com') {
          checkPendingRequests();
        }
        
        setLoading(false);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [authLoading, currentUser, authInitialized]);

  useEffect(() => {
    if (loading) return; // Don't navigate while loading
    
    if (!currentUser || !currentUser.email) {
      logDebug('No current user or email, redirecting to login');
      router.replace('/auth/login');
    } else if (currentUser.email?.toLowerCase() !== 'admin@dogcatify.com') {
      logDebug('Not admin user, redirecting to regular tabs. Email:', currentUser.email);
      router.replace('/(tabs)');
      return;
    } else {
      logDebug('Confirmed admin user:', currentUser.email);
    }
  }, [currentUser, loading]);
  
  // Show loading while auth is loading
  if (loading) {
    logDebug('Showing loading screen');
    return ( 
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 30 }}>
        <ActivityIndicator size="large" color="#2D6A6F" />
        <Text style={{ marginTop: 10, fontFamily: 'Inter-Regular' }}>Cargando panel de administración...</Text>
      </View>
    );
  }

  // Show loading while checking user
  if (!currentUser) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingTop: 30,
        backgroundColor: '#f5f5f5'
      }}>
        <ActivityIndicator size="large" color="#2D6A6F" />
        <Text style={{
          fontSize: 16,
          fontFamily: 'Inter-Medium',
          color: '#374151',
          marginTop: 10
        }}>Redirigiendo al login...</Text>
      </View>
    );
  }

  // Don't render admin tabs for non-admin users
  if (!currentUser || currentUser.email !== 'admin@dogcatify.com') {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingTop: 30,
        backgroundColor: '#f5f5f5'
      }}>
        <Text style={{
          fontSize: 18,
          fontFamily: 'Inter-Medium',
          color: '#374151',
          marginBottom: 10
        }}>
          Acceso restringido
        </Text>
        <Text style={{
          fontSize: 14,
          fontFamily: 'Inter-Regular',
          color: '#6B7280',
          textAlign: 'center',
          paddingHorizontal: 20
        }}>
          Esta sección es solo para administradores.
          {'\n'}Redirigiendo...
        </Text>
      </View>
    );
  }

  console.log('AdminTabLayout - rendering admin tabs for:', currentUser.email);

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
          height: 60, // Further reduced height for better fit
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
        name="requests"
        options={{
          title: 'Solicitudes',
          tabBarIcon: ({ size, color }) => (
            <Shield size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="partners"
        options={{
          title: 'Aliados',
          tabBarIcon: ({ size, color }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: 'Promociones',
          tabBarIcon: ({ size, color }) => (
            <Megaphone size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analíticas',
          tabBarIcon: ({ size, color }) => (
            <TrendingUp size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Configuración',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}