import { Tabs, usePathname } from 'expo-router';
import { Chrome as Home, Heart, ShoppingBag, Briefcase, MapPin, User } from 'lucide-react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { getAvailableRoles } from '../../utils/onboarding';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

export default function TabLayout() {
  const { t } = useLanguage();
  const { currentUser, authInitialized, activeRole, isPostLoginFlowPending } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const availableRoles = getAvailableRoles(currentUser);
  const hasMultipleRoles = availableRoles.length > 1;
  const isAdminUser = currentUser?.isAdmin === true;
  const isPartnerOnly = !!currentUser?.isPartner && !currentUser?.isOwner && !isAdminUser;
  const isAdminOnly = isAdminUser && !currentUser?.isOwner && !currentUser?.isPartner;

  useEffect(() => {
    if (!authInitialized || isPostLoginFlowPending) return;

    if (!currentUser) {
      if (pathname !== '/auth/login') {
        router.replace('/auth/login');
      }
      return;
    }

    if (activeRole === 'partner' || isPartnerOnly) {
      router.replace('/(partner-tabs)/business-selector');
      return;
    }

    if (activeRole === 'admin' || isAdminOnly) {
      router.replace('/(admin-tabs)/analytics');
      return;
    }

    if (!activeRole && hasMultipleRoles) {
      router.replace('/auth/select-role');
    }
  }, [authInitialized, currentUser?.id, currentUser?.isOwner, currentUser?.isPartner, currentUser?.isAdmin, activeRole, hasMultipleRoles, isPostLoginFlowPending, pathname]);

  if (isPostLoginFlowPending) {
    return <LoadingScreen message="Preparando tu inicio..." />;
  }

  if (authInitialized && !currentUser) {
    return <LoadingScreen message="Cerrando sesión..." />;
  }

  if (
    authInitialized &&
      currentUser &&
      (
        activeRole === 'partner' ||
        activeRole === 'admin' ||
        isPartnerOnly ||
        isAdminOnly ||
        (!activeRole && hasMultipleRoles)
      )
  ) {
    return null;
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
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          height: Platform.OS === 'ios' ? 85 : 60 + Math.max(insets.bottom, 0),
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
          title: t('myPets'),
          tabBarIcon: ({ size, color }) => (
            <Heart size={size} color={color} />
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
          href: null, // Hide this tab
        }}
      />
    </Tabs>
  );
}
