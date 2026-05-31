import { Tabs, usePathname } from 'expo-router';
import { ChartBar as BarChart3, Users, Volume2, Settings, MapPin, FileText, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { View, Text, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getAvailableRoles, shouldShowOnboarding } from '../../utils/onboarding';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

export default function AdminTabLayout() {
  const { currentUser, activeRole, authInitialized, isPostLoginFlowPending } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const availableRoles = getAvailableRoles(currentUser);
  const hasMultipleRoles = availableRoles.length > 1;

  // Check if user is admin
  const isAdmin = currentUser?.isAdmin === true;
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);

  useEffect(() => {
    console.log('🔍 [AdminTabLayout] Debugging info:');
    console.log('  - currentUser:', currentUser);
    console.log('  - isAdmin:', isAdmin);
    console.log('  - Available routes should include: analytics, promotions, partners, places, settings, requests');
  }, [currentUser, isAdmin]);

  useEffect(() => {
    let mounted = true;

    const checkOnboarding = async () => {
      if (!authInitialized || !currentUser || isPostLoginFlowPending) {
        if (mounted) {
          setOnboardingChecked(true);
          setOnboardingRequired(false);
        }
        return;
      }

      try {
        const shouldShow = await shouldShowOnboarding(currentUser.id);
        if (!mounted) return;

        setOnboardingChecked(true);
        setOnboardingRequired(shouldShow);

        if (shouldShow && pathname !== '/onboarding') {
          router.replace('/onboarding');
        }
      } catch (error) {
        console.warn('Error checking onboarding before admin tabs route:', error);
        if (mounted) {
          setOnboardingChecked(true);
          setOnboardingRequired(false);
        }
      }
    };

    void checkOnboarding();

    return () => {
      mounted = false;
    };
  }, [authInitialized, currentUser?.id, isPostLoginFlowPending, pathname]);

  useEffect(() => {
    if (!authInitialized || isPostLoginFlowPending || !onboardingChecked || onboardingRequired) return;

    if (!currentUser) {
      if (pathname !== '/auth/login') {
        router.replace('/auth/login');
      }
      return;
    }

    if (activeRole === 'owner' || (currentUser.isOwner && !currentUser.isPartner && !currentUser.isAdmin)) {
      router.replace('/(tabs)');
      return;
    }

    if (activeRole === 'partner' || (currentUser.isPartner && !currentUser.isOwner && !currentUser.isAdmin)) {
      router.replace('/(partner-tabs)/business-selector');
      return;
    }

    if (!activeRole && hasMultipleRoles) {
      router.replace('/auth/select-role');
    }
  }, [authInitialized, currentUser?.id, currentUser?.isOwner, currentUser?.isPartner, currentUser?.isAdmin, activeRole, hasMultipleRoles, isPostLoginFlowPending, pathname, onboardingChecked, onboardingRequired]);
  
  if (isPostLoginFlowPending) {
    return <LoadingScreen message="Preparando tu inicio..." />;
  }
  
  if (authInitialized && !currentUser) {
    return <LoadingScreen message="Cerrando sesión..." />;
  }

  if (authInitialized && currentUser && (!onboardingChecked || onboardingRequired)) {
    return <LoadingScreen message="Preparando onboarding..." />;
  }

  if (
    authInitialized &&
    currentUser &&
    (
      activeRole === 'owner' ||
      activeRole === 'partner' ||
      (currentUser.isOwner && !currentUser.isPartner && !currentUser.isAdmin) ||
      (currentUser.isPartner && !currentUser.isOwner && !currentUser.isAdmin) ||
      (!activeRole && hasMultipleRoles)
    )
  ) {
    return null;
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
  
  console.log('✅ [AdminTabLayout] Rendering Tabs component now...');

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
          paddingBottom: Math.max(insets.bottom, 5),
          paddingTop: 5,
          height: Platform.OS === 'ios' ? 85 : 60 + Math.max(insets.bottom, 0),
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
          tabBarIcon: ({ size, color }) => {
            console.log('📊 [Tab Icon] analytics rendering');
            return <BarChart3 size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: 'Promociones',
          tabBarIcon: ({ size, color }) => {
            console.log('📢 [Tab Icon] promotions rendering');
            return <Volume2 size={size} color={color} />;
          },
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
      <Tabs.Screen
        name="subscription-plans"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
