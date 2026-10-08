import { Tabs, usePathname, useSegments, router } from 'expo-router';
import { House, PawPrint, Compass, ShoppingBag, User } from 'lucide-react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { getAvailableRoles, shouldShowOnboarding } from '../../utils/onboarding';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { colors, fonts, shadows } from '../../constants/theme';

export default function TabLayout() {
  const { t } = useLanguage();
  const { currentUser, authInitialized, activeRole, isPostLoginFlowPending } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();
  // Expo Router keeps this layout mounted in the background after navigating
  // away from it (e.g. to /auth/login), so its effects below would otherwise
  // keep firing on every app-wide pathname change and hijack navigation with
  // a stale router.replace('/auth/login') even while the user is on a
  // completely different, focused screen (e.g. tapping "Registrarme" from
  // login). Only act on these effects while this (tabs) group is the one
  // actually being navigated.
  const isFocusedGroup = segments[0] === '(tabs)';
  const insets = useSafeAreaInsets();
  const availableRoles = getAvailableRoles(currentUser);
  const hasMultipleRoles = availableRoles.length > 1;
  const isAdminUser = currentUser?.isAdmin === true;
  const isPartnerOnly = !!currentUser?.isPartner && !currentUser?.isOwner && !isAdminUser;
  const isAdminOnly = isAdminUser && !currentUser?.isOwner && !currentUser?.isPartner;
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);

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
        console.warn('Error checking onboarding before tabs route:', error);
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarAllowFontScaling: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 60 + Math.max(insets.bottom, 0),
          ...shadows.lg,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: fonts.medium,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarAccessibilityLabel: 'Inicio',
          tabBarIcon: ({ size, color }) => <House size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          title: 'Mascotas',
          tabBarAccessibilityLabel: 'Mis mascotas',
          tabBarIcon: ({ size, color }) => <PawPrint size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorar',
          tabBarAccessibilityLabel: 'Explorar servicios y lugares',
          tabBarIcon: ({ size, color }) => <Compass size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: t('shop'),
          tabBarIcon: ({ size, color }) => <ShoppingBag size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
      {/* Rutas viejas: redirigen a Explorar y no se muestran en la barra. */}
      <Tabs.Screen name="services" options={{ href: null }} />
      <Tabs.Screen name="places" options={{ href: null }} />
      <Tabs.Screen
        name="partner-register"
        options={{
          href: null, // Hide this tab
        }}
      />
    </Tabs>
  );
}
