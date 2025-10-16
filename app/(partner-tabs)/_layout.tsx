import { Tabs } from 'expo-router';
import { ChartBar as BarChart3, ArrowLeft, Building, ShoppingBag, Calendar } from 'lucide-react-native';
import { MessageCircle } from 'lucide-react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { TouchableOpacity, View, Text, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabaseClient } from '../../lib/supabase';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

export default function PartnerTabLayout() {
  const { t } = useLanguage();
  const { currentUser, authInitialized } = useAuth();
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [partnerProfile, setPartnerProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveSchedule, setHasActiveSchedule] = useState(false);

  useEffect(() => {
    if (authInitialized && !currentUser) {
      console.log('User not authenticated in partner tabs, redirecting to login');
      router.replace('/auth/login');
    }
  }, [currentUser, authInitialized]);

  const handleBackToUser = () => {
    router.replace('/(tabs)');
  };

  useEffect(() => {
    if (businessId) {
      fetchPartnerProfile(businessId as string);
      console.log('PartnerTabLayout - Fetching profile for business ID:', businessId);
    } else {
      setLoading(false);
      console.log('PartnerTabLayout - No business ID provided');
    }
  }, [businessId]);

  const fetchPartnerProfile = async (businessId: string) => {
    try {
      // Fetch partner profile
      const { data: partnerDoc, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', businessId)
        .single();
      
      if (error) {
        console.error('PartnerTabLayout - Error fetching partner profile:', error);
        return;
      }
      
      if (partnerDoc) {
        const profileData = {
          id: partnerDoc.id,
          ...partnerDoc
        };
        setPartnerProfile(profileData);
        console.log('PartnerTabLayout - Profile loaded:', profileData.business_name);
        console.log('PartnerTabLayout - Business type:', profileData.business_type);
        
        // Check if this business has active schedule
        await checkActiveSchedule(businessId);
      } else {
        console.log('PartnerTabLayout - No partner document found for ID:', businessId);
      }
    } catch (error) {
      console.error('PartnerTabLayout - Error fetching partner profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkActiveSchedule = async (businessId: string) => {
    try {
      console.log('Checking active schedule for business:', businessId);
      
      const { data: scheduleData, error } = await supabaseClient
        .from('business_schedule')
        .select('*')
        .eq('partner_id', businessId)
        .eq('is_active', true);
      
      if (error) {
        console.error('Error checking schedule:', error);
        setHasActiveSchedule(false);
        return;
      }
      
      const hasSchedule = scheduleData && scheduleData.length > 0;
      console.log('Active schedule found:', hasSchedule, 'Count:', scheduleData?.length || 0);
      setHasActiveSchedule(hasSchedule);
    } catch (error) {
      console.error('Error checking active schedule:', error);
      setHasActiveSchedule(false);
    }
  };

  if (loading || !authInitialized) {
    return <LoadingScreen message="Cargando perfil de negocio..." />;
  }
  
  // Don't render if not authenticated
  if (!currentUser) {
    return null;
  }

  // Determinar qué características están habilitadas
  const businessType = partnerProfile?.business_type || '';
  const features = partnerProfile?.features || {};
  
  const hasProductsEnabled = features.products || businessType === 'shop';
  
  console.log('PartnerTabLayout - Tab visibility:', {
    businessType,
    hasProductsEnabled,
    hasActiveSchedule,
    shouldShowReservas: hasActiveSchedule
  });

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
        name="business-selector"
        options={{
          title: 'Negocios',
          tabBarIcon: ({ size, color }) => (
            <Building size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ size, color }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Reservas',
          href: hasActiveSchedule && partnerProfile
            ? { pathname: '/bookings', params: { businessId } }
            : null,
          tabBarIcon: ({ size, color }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Productos', 
          href: (businessType === 'shop' || hasProductsEnabled) && partnerProfile
            ? { pathname: '/products', params: { businessId } }
            : null,
          tabBarIcon: ({ size, color }) => (
            <ShoppingBag size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat-contacts"
        options={{
          title: 'Contactos',
          href: partnerProfile?.business_type === 'shelter' && partnerProfile
            ? { pathname: '/chat-contacts', params: { businessId } }
            : null,
          tabBarIcon: ({ size, color }) => (
            <MessageCircle size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="back-to-user"
        options={{
          title: 'Volver',
          tabBarIcon: ({ size, color }) => (
            <ArrowLeft size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            handleBackToUser();
          },
        }}
      />
    </Tabs>
  );
}