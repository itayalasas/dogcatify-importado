import { Tabs } from 'expo-router';
import { ChartBar as BarChart3, Building, ShoppingBag, Calendar, User, CreditCard } from 'lucide-react-native';
import { MessageCircle } from 'lucide-react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { TouchableOpacity, View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabaseClient } from '../../lib/supabase';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { canAccessPartnerModule, resolvePartnerAccountSubscription, resolvePartnerPlanTier } from '../../utils/partnerPlans';
import { getAvailableRoles, getStoredActivePartnerBusinessId, setStoredActivePartnerBusinessId, shouldShowOnboarding } from '../../utils/onboarding';

export default function PartnerTabLayout() {
  const { t } = useLanguage();
  const { currentUser, authInitialized, activeRole, isPostLoginFlowPending } = useAuth();
  const { businessId } = useLocalSearchParams<{ businessId?: string }>();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [partnerProfile, setPartnerProfile] = useState<any | null>(null);
  const [partnerRows, setPartnerRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActiveSchedule, setHasActiveSchedule] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const availableRoles = getAvailableRoles(currentUser);
  const hasMultipleRoles = availableRoles.length > 1;
  const isAdminUser = currentUser?.isAdmin === true;
  const isOwnerOnly = !!currentUser?.isOwner && !currentUser?.isPartner && !isAdminUser;
  const isAdminOnly = isAdminUser && !currentUser?.isOwner && !currentUser?.isPartner;
  const activeBusinessId = businessId || selectedBusinessId || null;
  const hasSelectedBusiness = Boolean(activeBusinessId);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);

  useEffect(() => {
    if (authInitialized && !currentUser) {
      if (pathname !== '/auth/login') {
        router.replace('/auth/login');
      }
    }
  }, [currentUser, authInitialized, pathname]);

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
    if (!authInitialized || !currentUser || isPostLoginFlowPending || !onboardingChecked || onboardingRequired) return;

    if (activeRole === 'owner' || isOwnerOnly) {
      router.replace('/(tabs)');
      return;
    }

    if (activeRole === 'admin' || isAdminOnly) {
      router.replace('/(admin-tabs)/analytics');
      return;
    }

    if (!activeRole && hasMultipleRoles) {
      router.replace('/auth/select-role');
    }
  }, [authInitialized, currentUser?.id, currentUser?.isOwner, currentUser?.isPartner, currentUser?.isAdmin, activeRole, hasMultipleRoles, isPostLoginFlowPending, onboardingChecked, onboardingRequired]);

  useEffect(() => {
    if (!authInitialized) return;

    if (!currentUser?.id) {
      setSelectedBusinessId(null);
      setPartnerRows([]);
      return;
    }

    const resolveSelectedBusiness = async () => {
      if (businessId) {
        setSelectedBusinessId(businessId);
        await setStoredActivePartnerBusinessId(currentUser.id, businessId);
        return;
      }

      const storedBusinessId = await getStoredActivePartnerBusinessId(currentUser.id);
      setSelectedBusinessId(storedBusinessId);
    };

    void resolveSelectedBusiness();
  }, [businessId, currentUser?.id, authInitialized]);

  useEffect(() => {
    if (!authInitialized) return;

    if (activeBusinessId && currentUser) {
      setLoading(true);
      setAccessDenied(false);
      fetchPartnerProfile(activeBusinessId);
    } else {
      setPartnerProfile(null);
      setHasActiveSchedule(false);
      setAccessDenied(false);
      setLoading(false);
    }
  }, [activeBusinessId, currentUser?.id, authInitialized]);

  const fetchPartnerProfile = async (businessId: string) => {
    try {
      if (!currentUser) {
        setAccessDenied(true);
        return;
      }

      // Fetch partner profile
      const { data: partnerDoc, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', businessId)
        .single();
      
      if (error) {
        return;
      }
      
      if (partnerDoc) {
        const isAdmin = currentUser.isAdmin === true;
        const isOwner = partnerDoc.user_id === currentUser.id;

        if (!isOwner && !isAdmin) {
          setPartnerProfile(null);
          setHasActiveSchedule(false);
          setAccessDenied(true);
          return;
        }

        const profileData = {
          id: partnerDoc.id,
          ...partnerDoc
        };
        setPartnerProfile(profileData);
        const { data: accountPartnerRows, error: accountPartnersError } = await supabaseClient
          .from('partners')
          .select('subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at')
          .eq('user_id', currentUser.id)
          .eq('is_verified', true);

        if (accountPartnersError) {
          throw accountPartnersError;
        }

        setPartnerRows((accountPartnerRows || []) as any[]);
        
        // Check if this business has active schedule
        await checkActiveSchedule(businessId);
      } else {
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const checkActiveSchedule = async (businessId: string) => {
    try {
      
      const { data: scheduleData, error } = await supabaseClient
        .from('business_schedule')
        .select('*')
        .eq('partner_id', businessId)
        .eq('is_active', true);
      
      if (error) {
        setHasActiveSchedule(false);
        return;
      }
      
      const hasSchedule = scheduleData && scheduleData.length > 0;
      setHasActiveSchedule(hasSchedule);
    } catch (error) {
      setHasActiveSchedule(false);
    }
  };

  if (isPostLoginFlowPending) {
    return <LoadingScreen message="Preparando tu inicio..." />;
  }

  if (authInitialized && currentUser && (!onboardingChecked || onboardingRequired)) {
    return <LoadingScreen message="Preparando onboarding..." />;
  }
  
  if (!authInitialized) {
    return <LoadingScreen message="Cargando perfil de negocio..." />;
  }
  
  // Don't render if not authenticated
  if (authInitialized && !currentUser) {
    return <LoadingScreen message="Cerrando sesión..." />;
  }

  if (
    authInitialized &&
    currentUser &&
    (
      activeRole === 'owner' ||
      activeRole === 'admin' ||
      isOwnerOnly ||
      isAdminOnly ||
      (!activeRole && hasMultipleRoles)
    )
  ) {
    return null;
  }

  // Determinar qué características están habilitadas
  if (accessDenied) {
    return (
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#F8FAFC',
      }}>
        <Text style={{
          fontSize: 22,
          fontFamily: 'Inter-Bold',
          color: '#111827',
          textAlign: 'center',
          marginBottom: 8,
        }}>
          Acceso no autorizado
        </Text>
        <Text style={{
          fontSize: 15,
          fontFamily: 'Inter-Regular',
          color: '#6B7280',
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 20,
        }}>
          Este negocio no está asociado a tu cuenta.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(partner-tabs)/business-selector')}
          style={{
            backgroundColor: '#2D6A6F',
            borderRadius: 14,
            paddingHorizontal: 18,
            paddingVertical: 12,
          }}
        >
          <Text style={{
            color: '#FFFFFF',
            fontFamily: 'Inter-SemiBold',
            fontSize: 15,
          }}>
            Seleccionar negocio
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const businessType = partnerProfile?.business_type || '';
  const features = partnerProfile?.features || {};
  const agendaFeatureEnabled = features.agenda !== false;
  const accountSubscription = resolvePartnerAccountSubscription(partnerRows);
  const effectivePartnerTier = accountSubscription?.subscriptionPlanTier || resolvePartnerPlanTier(
    partnerProfile?.subscription_plan_tier,
    partnerProfile?.subscription_plan_status,
    partnerProfile?.subscription_plan_expires_at,
  );
  const canAccessAdoptions = canAccessPartnerModule(
    accountSubscription?.subscriptionPlanTier || effectivePartnerTier,
    'adoptions',
    businessType,
    accountSubscription?.subscriptionPlanStatus || partnerProfile?.subscription_plan_status,
    accountSubscription?.subscriptionPlanExpiresAt || partnerProfile?.subscription_plan_expires_at,
  );
  const canShowBookingsTab = businessType !== 'shop' && agendaFeatureEnabled && hasActiveSchedule;
  
  const hasProductsEnabled = features.products || businessType === 'shop';
  

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
          paddingBottom: Math.max(insets.bottom, 5),
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
          tabBarButton: (props: any) => {
            const { children, style, ...rest } = props;

            return (
              <TouchableOpacity
                {...rest}
                onPress={() => {
                  if (!hasSelectedBusiness) {
                    return;
                  }

                  router.replace({
                    pathname: '/(partner-tabs)/dashboard',
                    params: { businessId: activeBusinessId as string },
                  });
                }}
                disabled={!hasSelectedBusiness}
                style={[
                  style,
                  {
                    opacity: hasSelectedBusiness ? 1 : 0.35,
                  },
                ]}
              >
                {children}
              </TouchableOpacity>
            );
          },
          tabBarIcon: ({ size, color }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mercado-pago"
        options={{
          title: 'Mercado Pago',
          tabBarIcon: ({ size, color }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Reservas',
          href: canShowBookingsTab && partnerProfile && activeBusinessId
            ? { pathname: '/bookings', params: { businessId: activeBusinessId } }
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
          href: (businessType === 'shop' || hasProductsEnabled) && partnerProfile && activeBusinessId
            ? { pathname: '/products', params: { businessId: activeBusinessId } }
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
          href: partnerProfile?.business_type === 'shelter' && canAccessAdoptions && partnerProfile && activeBusinessId
            ? { pathname: '/chat-contacts', params: { businessId: activeBusinessId } }
            : null,
          tabBarIcon: ({ size, color }) => (
            <MessageCircle size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
