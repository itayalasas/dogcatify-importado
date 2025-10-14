import { Tabs } from 'expo-router';
import { ChartBar as BarChart3, Users, Volume2, Settings, MapPin, FileText, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { View, Text } from 'react-native';

export default function AdminTabLayout() {
  const { currentUser } = useAuth();
  
  // Check if user is admin
  const isAdmin = currentUser?.email?.toLowerCase() === 'admin@dogcatify.com';
  
  if (!currentUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Cargando...</Text>
      </View>
    );
  }
  
  if (!isAdmin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#EF4444', marginBottom: 8 }}>
          Acceso Denegado
        </Text>
        <Text style={{ textAlign: 'center', color: '#6B7280' }}>
          Solo los administradores pueden acceder a esta sección
        </Text>
      </View>
    );
  }
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#DC2626',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Inter-Medium',
        },
      }}>
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ size, color }) => (
            <BarChart3 size={size} color={color} />
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
          title: 'Promoc...',
          tabBarIcon: ({ size, color }) => (
            <Volume2 size={size} color={color} />
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
        name="settings"
        options={{
          title: 'Config...',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Solicitudes',
          tabBarIcon: ({ size, color }) => (
            <FileText size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}