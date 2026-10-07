import { Tabs, usePathname, useSegments, router } from 'expo-router';
import { ChartBar as BarChart3, Users, Volume2, Settings, MapPin, FileText, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { View, Text, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAvailableRoles, shouldShowOnboarding } from '../../utils/onboarding';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { colors, spacing, typography } from '../../constants/theme';

export default function AdminTabLayout() {
  const { currentUser, activeRole, authInitialized, isPostLoginFlowPending } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();
  // See app/(tabs)/_layout.tsx: this layout stays mounted in the background
  // after navigating away, so its redirect effects below must not act on
  // app-wide pathname changes while some other, focused screen is active.
  const isFocusedGroup = segments[0] === '(admin-tabs)';
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
      if (!isFocusedGroup || !authInitialized || !currentUser || isPostLoginFlowPending) {
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
  }, [isFocusedGroup, authInitialized, currentUser?.id, isPostLoginFlowPending, pathname]);

  useEffect(() => {
    if (!isFocusedGroup || !authInitialized || isPostLoginFlowPending || !onboardingChecked || onboardingRequired) return;

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
  }, [isFocusedGroup, authInitialized, currentUser?.id, currentUser?.isOwner, currentUser?.isPartner, currentUser?.isAdmin, activeRole, hasMultipleRoles, isPostLoginFlowPending, pathname, onboardingChecked, onboardingRequired]);
  
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.background }}>
        <Text accessibilityRole="header" style={{ ...typography.heading, color: colors.danger, marginBottom: spacing.sm }}>
          Acceso denegado
        </Text>
        <Text style={{ ...typography.bodySmall, textAlign: 'center', color: colors.textSecondary }}>
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 5),
          paddingTop: 5,
          height: Platform.OS === 'ios' ? 85 : 60 + Math.max(insets.bottom, 0),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter-Medium',
          fontWeight: '500',
        },
      }}>
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Estadísticas',
          tabBarAccessibilityLabel: 'Estadísticas',
          tabBarIcon: ({ size, color }) => <BarChart3 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: 'Promociones',
          tabBarAccessibilityLabel: 'Promociones',
          tabBarIcon: ({ size, color }) => <Volume2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="partners"
        options={{
          title: 'Aliados',
          tabBarAccessibilityLabel: 'Aliados',
          tabBarIcon: ({ size, color }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: 'Lugares',
          tabBarAccessibilityLabel: 'Lugares',
          tabBarIcon: ({ size, color }) => (
            <MapPin size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarAccessibilityLabel: 'Ajustes',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Solicitudes',
          tabBarAccessibilityLabel: 'Solicitudes',
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
