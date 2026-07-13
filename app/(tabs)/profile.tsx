import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Settings, Heart, ShoppingBag, Calendar, LogOut, CreditCard as Edit, Bell, CircleHelp as HelpCircle, Building, Fingerprint, ChevronRight, ArrowRight, Trash2, Crown, Sparkles, RefreshCw } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SubscriptionReturnBanner } from '../../components/SubscriptionReturnBanner';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useBiometric } from '../../contexts/BiometricContext';
import { supabaseClient } from '../../lib/supabase';
import { getAvailableRoles } from '../../utils/onboarding';
import { getSingleParam } from '../../utils/subscriptionReturn';
import {
  getPartnerPlan,
  getPartnerSubscriptionStatusLabel,
  resolvePartnerPlanTier,
} from '../../utils/partnerPlans';
import { resolveSubscriptionPlanLimits } from '../../utils/subscriptionPlanLimits';

const partnerPlanOrder = ['starter', 'growth', 'pro'] as const;

const resolvePartnerAccountPlan = (partnerRows: any[]) => {
  return (partnerRows || []).reduce((best: any, row: any) => {
    const resolvedTier = resolvePartnerPlanTier(
      row.subscription_plan_tier,
      row.subscription_plan_status,
      row.subscription_plan_expires_at,
    ) as 'starter' | 'growth' | 'pro';

    if (!best) {
      return {
        id: row.id,
        businessName: row.business_name,
        businessType: row.business_type,
        subscriptionPlanTier: resolvedTier,
        subscriptionPlanStatus: row.subscription_plan_status,
        subscriptionPlanExpiresAt: row.subscription_plan_expires_at,
      };
    }

    const currentBestTier = best.subscriptionPlanTier || 'starter';
    const currentBestIndex = partnerPlanOrder.indexOf(currentBestTier);
    const resolvedIndex = partnerPlanOrder.indexOf(resolvedTier);

    if (resolvedIndex > currentBestIndex) {
      return {
        id: row.id,
        businessName: row.business_name,
        businessType: row.business_type,
        subscriptionPlanTier: resolvedTier,
        subscriptionPlanStatus: row.subscription_plan_status,
        subscriptionPlanExpiresAt: row.subscription_plan_expires_at,
      };
    }

    return best;
  }, null);
};

export default function Profile() {
  const { currentUser, logout, activeRole } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { expoPushToken, notificationsEnabled, registerForPushNotifications, disableNotifications } = useNotifications();
  const { 
    isBiometricSupported, 
    isBiometricEnabled, 
    biometricType, 
    disableBiometric,
    enableBiometric
  } = useBiometric();
  
  const [userStats, setUserStats] = useState({
    petsCount: 0,
    postsCount: 0,
    followersCount: 0,
    followingCount: 0
  });
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [deliveryProfile, setDeliveryProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [isDottyEnabled, setIsDottyEnabled] = useState(true);
  const [dottyPlanEnabled, setDottyPlanEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const skipInitialFocusRefreshRef = React.useRef(true);
  const subscriptionReturnParams = useLocalSearchParams();
  const availableRoles = getAvailableRoles(currentUser);
  const effectiveRole = activeRole ?? (availableRoles.length === 1 ? availableRoles[0] : null);
  const isPartnerView = effectiveRole === 'partner';
  const subscriptionReturnStatus = getSingleParam(subscriptionReturnParams.subscription_status);
  const subscriptionReturnMessage = getSingleParam(subscriptionReturnParams.subscription_message);
  const subscriptionReturnTarget = getSingleParam(subscriptionReturnParams.target);
  const subscriptionReturnScope = subscriptionReturnTarget?.includes('://partner/subscription')
    ? 'partner'
    : getSingleParam(
        subscriptionReturnParams.subscription_scope
        ?? subscriptionReturnParams.scope
        ?? subscriptionReturnParams.account_scope,
      ) || (isPartnerView ? 'partner' : 'user');
  const subscriptionReturnId = getSingleParam(subscriptionReturnParams.subscription_id);
  const subscriptionReturnReference = getSingleParam(subscriptionReturnParams.external_reference);
  const showSubscriptionReturnBanner = Boolean(
    subscriptionReturnStatus ||
    subscriptionReturnMessage ||
    subscriptionReturnId ||
    subscriptionReturnReference,
  );
  const personalSubscriptionStatusLabel = (() => {
    const status = String(userSubscription?.status || '').toLowerCase();

    if (status === 'active') return 'Activo';
    if (status === 'trialing') return 'En prueba';
    if (status === 'pending') return 'Pendiente';
    if (status === 'paused') return 'Pausado';
    return userSubscription ? 'Sin estado' : 'Activo';
  })();

  useEffect(() => {
    if (currentUser) {
      fetchUserStats();
      fetchPartnerProfile();
      checkSubscriptionSettings();
      fetchUserSubscription();
    }
  }, [currentUser?.id, currentUser?.displayName, currentUser?.photoURL]);

  useFocusEffect(
    React.useCallback(() => {
      if (!currentUser?.id) {
        return;
      }

      if (skipInitialFocusRefreshRef.current) {
        skipInitialFocusRefreshRef.current = false;
        return;
      }

      fetchPartnerProfile();
      fetchUserSubscription();
      checkSubscriptionSettings();
    }, [currentUser?.id])
  );

  const fetchDottyStatus = async () => {
    if (!currentUser?.id) {
      return;
    }

    const userId = currentUser.id;

    try {
      const { data: subscriptionData, error: subscriptionError } = await supabaseClient
        .from('user_subscriptions')
        .select(`
          status,
          subscription_plans (
            tier,
            audience_target,
            limits
          )
        `)
        .eq('user_id', userId)
        .in('status', ['active', 'trialing', 'pending', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscriptionError) {
        console.error('Error fetching Dotty subscription limits:', subscriptionError);
      }

      const userPlanLimits = resolveSubscriptionPlanLimits(subscriptionData?.subscription_plans || null);
      const planAllowsDotty = userPlanLimits.users.dottyEnabled;
      setDottyPlanEnabled(planAllowsDotty);

      const { data } = await supabaseClient
        .from('profiles')
        .select('dotty_enabled')
        .eq('id', userId)
        .single();

      if (data) {
        const shouldEnableDotty = data.dotty_enabled !== false;

        if (!planAllowsDotty && shouldEnableDotty) {
          await supabaseClient
            .from('profiles')
            .update({ dotty_enabled: false })
            .eq('id', userId);
          setIsDottyEnabled(false);
          return;
        }

        setIsDottyEnabled(shouldEnableDotty);
      }
    } catch (error) {
      console.error('Error fetching Dotty status:', error);
    }
  };

  const checkSubscriptionSettings = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('subscription_settings')
        .select('enabled')
        .maybeSingle();

      if (error) throw error;

      console.log('Subscription settings data:', data);

      if (data) {
        setSubscriptionsEnabled(data.enabled);
        console.log('Subscriptions enabled:', data.enabled);
      } else {
        console.log('No subscription settings found');
      }
    } catch (error) {
      console.error('Error checking subscription settings:', error);
    }
  };

      const fetchUserSubscription = async () => {
    if (!currentUser?.id) {
      return;
    }

    const userId = currentUser.id;

    try {
      const { data, error } = await supabaseClient
        .from('user_subscriptions')
        .select(`
          status,
          subscription_plans (
            tier,
            audience_target,
            limits
          )
        `)
        .eq('user_id', userId)
        .in('status', ['active', 'trialing', 'pending', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUserSubscription(data);
      } else {
        setUserSubscription(null);
      }

      const userPlanLimits = resolveSubscriptionPlanLimits(data?.subscription_plans || null);
      const planAllowsDotty = userPlanLimits.users.dottyEnabled;
      setDottyPlanEnabled(planAllowsDotty);

      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('dotty_enabled')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching Dotty profile flag:', profileError);
      }

      if (profileData) {
        const shouldEnableDotty = profileData.dotty_enabled !== false;

        if (!planAllowsDotty && shouldEnableDotty) {
          await supabaseClient
            .from('profiles')
            .update({ dotty_enabled: false })
            .eq('id', userId);
          setIsDottyEnabled(false);
          return;
        }

        setIsDottyEnabled(shouldEnableDotty);
      }
    } catch (error) {
      console.error('Error fetching user subscription:', error);
    }
  };

  // Set up real-time subscription for profile updates
  useEffect(() => {
    if (!currentUser) return;
    
    console.log('Setting up real-time subscriptions for user:', currentUser.id);
    
    // Subscribe to changes in the current user's profile
    const subscription = supabaseClient
      .channel('profile-updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`
        }, 
        (payload) => {
          console.log('=== REAL-TIME: Current user profile updated ===');
          console.log('Updated fields:', payload.new);
          fetchUserStats();
        }
      )
      // Also subscribe to ANY profile changes that might affect followers
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public', 
          table: 'profiles'
        },
        (payload) => {
          // Check if the updated profile's following array includes current user
          const updatedFollowing = payload.new?.following || [];
          const oldFollowing = payload.old?.following || [];
          
          const wasFollowing = oldFollowing.includes(currentUser.id);
          const isNowFollowing = updatedFollowing.includes(currentUser.id);
          
          // If someone started or stopped following current user, update stats
          if (wasFollowing !== isNowFollowing) {
            console.log('=== REAL-TIME: Follower status changed ===');
            console.log('User', payload.new?.display_name, isNowFollowing ? 'started following' : 'stopped following', 'current user');
            fetchUserStats();
          }
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          fetchUserSubscription();
        }
      )
      .subscribe();
    
    console.log('Real-time subscription established');
    
    return () => {
      console.log('Cleaning up real-time subscription');
      subscription.unsubscribe();
    };
  }, [currentUser]);
  
  const fetchUserStats = async () => {
    try {
      console.log('Fetching user stats for:', currentUser!.id);
      
      // Fetch pets count
      const { count: petsCount } = await supabaseClient
        .from('pets')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', currentUser!.id);

      // Fetch posts count
      const { count: postsCount } = await supabaseClient
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser!.id);

      // Fetch followers count - buscar usuarios que tienen a este usuario en su array 'following'
      console.log('=== FETCHING FOLLOWERS ===');
      console.log('Looking for users who have', currentUser!.id, 'in their following array');
      const { data: followersData, error: followersError } = await supabaseClient
        .from('profiles')
        .select('id, display_name')
        .contains('following', [currentUser!.id]);
      
      if (followersError) {
        console.error('Error fetching followers:', followersError);
      }
      
      const followersCount = followersData?.length || 0;
      console.log('Followers found:', followersData?.map(f => ({ id: f.id, name: f.display_name })) || []);
      console.log('Total followers count:', followersCount);
      
      // Fetch following count - obtener el array 'following' del usuario actual
      console.log('=== FETCHING FOLLOWING ===');
      console.log('Getting following array for user:', currentUser!.id);
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('following, followers')
        .eq('id', currentUser!.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile data:', profileError);
      }
      
      const followingArray = profileData?.following || [];
      const followersArray = profileData?.followers || [];
      
      // Validate and clean arrays
      const validFollowing = followingArray.filter((id: any) => id && typeof id === 'string' && id.trim() !== '');
      const validFollowers = followersArray.filter((id: any) => id && typeof id === 'string' && id.trim() !== '');
      
      const followingCount = validFollowing.length;
      const localFollowersCount = validFollowers.length;
      
      console.log('Following array from profile:', validFollowing);
      console.log('Followers array from profile:', validFollowers);
      console.log('Following count:', followingCount);
      console.log('Local followers count:', localFollowersCount);
      
      // Use the higher count between database query and local array
      // This handles cases where the arrays might be out of sync
      const finalFollowersCount = Math.max(followersCount, localFollowersCount);
      
      console.log('Updated stats:', {
        petsCount: petsCount || 0,
        postsCount: postsCount || 0,
        followersCount: finalFollowersCount,
        followingCount,
        followersFromQuery: followersData?.map(f => f.display_name) || [],
        followersFromProfile: validFollowers,
        followingArray: validFollowing,
        finalFollowersCount
      });
      
      setUserStats({
        petsCount: petsCount || 0,
        postsCount: postsCount || 0,
        followersCount: finalFollowersCount,
        followingCount
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Set default stats on error
      setUserStats({
        petsCount: 0,
        postsCount: 0,
        followersCount: 0,
        followingCount: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPartnerProfile = async () => {
    if (!currentUser?.id) {
      setPartnerProfile(null);
      return;
    }

    const userId = currentUser.id;

    try {
      console.log('Fetching partner profile for user:', userId);

      const { data, error } = await supabaseClient
        .from('partners')
        .select('id, business_name, business_type, subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at, is_verified, is_active')
        .eq('user_id', userId)
        .eq('is_verified', true)
        .order('created_at', { ascending: false });
      
      console.log('Partner query result:', { data, error });

      if (data && data.length > 0 && !error) {
        console.log('Partner profile found:', data[0]);
        const accountPlan = resolvePartnerAccountPlan(data as any[]);
        const primaryPartner = data[0];

        setPartnerProfile({
          id: primaryPartner.id,
          businessName: primaryPartner.business_name,
          businessType: primaryPartner.business_type,
          businessCount: data.length,
          subscriptionPlanTier: accountPlan?.subscriptionPlanTier || primaryPartner.subscription_plan_tier,
          subscriptionPlanStatus: accountPlan?.subscriptionPlanStatus || primaryPartner.subscription_plan_status,
          subscriptionPlanExpiresAt: accountPlan?.subscriptionPlanExpiresAt || primaryPartner.subscription_plan_expires_at,
          activeBusinessName: accountPlan?.businessName || primaryPartner.business_name,
          isVerified: primaryPartner.is_verified,
          isActive: primaryPartner.is_active
        });
      } else {
        console.log('No partner profile found or error:', error);
        setPartnerProfile(null);
      }
    } catch (error) {
      console.error('Error fetching partner profile:', error);
      setPartnerProfile(null);
    }
  };

  const fetchDeliveryProfile = async () => {
    if (!currentUser?.id) {
      setDeliveryProfile(null);
      return;
    }

    const userId = currentUser.id;

    try {
      const { data, error } = await supabaseClient
        .from('delivery_profiles')
        .select('id, delivery_mode, is_active, approval_status')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        const errorText = String(error.message || '').toLowerCase();
        const relationMissing = errorText.includes('delivery_profiles');
        if (!relationMissing) {
          throw error;
        }
      }

      setDeliveryProfile(data || null);
    } catch (error) {
      console.error('Error fetching delivery profile:', error);
      setDeliveryProfile(null);
    }
  };

  const handleEditProfile = () => {
    router.push('/profile/edit');
  };

  const handleChangeRole = () => {
    router.push({
      pathname: '/auth/select-role',
      params: { source: 'profile' },
    });
  };

  const handlePartnerMode = () => {
    if (partnerProfile) {
      router.push('/(partner-tabs)/business-selector');
    } else {
      router.push('/partner-register');
    }
  };

  const handlePartnerSubscription = () => {
    if (!partnerProfile?.id) {
      router.push('/partner-register');
      return;
    }

    router.push('/partner/subscription');
  };


  const handleMyOrders = () => {
    router.push('/orders');
  };

  const partnerPlanTier = partnerProfile
    ? resolvePartnerPlanTier(
        partnerProfile.subscriptionPlanTier,
        partnerProfile.subscriptionPlanStatus,
        partnerProfile.subscriptionPlanExpiresAt,
      )
    : null;
  const partnerPlan = partnerPlanTier ? getPartnerPlan(partnerPlanTier) : null;
  const partnerPlanStatusLabel = partnerProfile
    ? getPartnerSubscriptionStatusLabel(
        partnerProfile.subscriptionPlanStatus,
        partnerProfile.subscriptionPlanExpiresAt,
      )
    : null;
  const partnerLinkedBusinessesLabel = partnerProfile
    ? `${partnerProfile.businessCount || 0} negocio${(partnerProfile.businessCount || 0) === 1 ? '' : 's'} vinculados`
    : null;

  const handleToggleBiometric = async () => {
    try {
      // Solo permitir desactivar desde el perfil
      // La activación solo se puede hacer desde la pantalla de login
      if (isBiometricEnabled) {
        Alert.alert(
          'Desactivar autenticación biométrica',
          '¿Estás seguro de que quieres desactivar la autenticación biométrica? Solo podrás volver a habilitarla desde la pantalla de inicio de sesión.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Desactivar',
              style: 'destructive',
              onPress: async () => {
                try {
                  await disableBiometric();
                  Alert.alert(
                    'Desactivado',
                    'La autenticación biométrica ha sido desactivada. Puedes volver a habilitarla desde la pantalla de inicio de sesión.'
                  );
                } catch (error) {
                  Alert.alert('Error', 'No se pudo desactivar la autenticación biométrica');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error toggling biometric:', error);
    }
  };

  const handleToggleDottyAssistant = async () => {
    try {
      if (!currentUser?.id) {
        return;
      }

      if (!dottyPlanEnabled && !isDottyEnabled) {
        Alert.alert(
          'Dotty no incluido',
          'Tu plan actual no incluye el asistente Dotty. Actualiza tu suscripción para activarlo.'
        );
        return;
      }

      const userId = currentUser.id;

      if (isDottyEnabled) {
        Alert.alert(
          'Ocultar Asistente Dotty',
          'Puedes arrastrar a Dotty hacia la parte inferior de la pantalla para ocultarlo, o hacerlo desde aquí. ¿Deseas ocultarlo?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Ocultar',
              style: 'destructive',
              onPress: async () => {
                try {
                  console.log('[Profile] Updating dotty_enabled to false for user:', userId);
                  const { data, error } = await supabaseClient
                    .from('profiles')
                    .update({ dotty_enabled: false })
                    .eq('id', userId)
                    .select();

                  if (error) {
                    console.error('[Profile] Error updating dotty_enabled:', error);
                    Alert.alert('Error', 'No se pudo ocultar el asistente');
                    return;
                  }

                  console.log('[Profile] Successfully updated dotty_enabled to false:', data);
                  setIsDottyEnabled(false);
                } catch (error) {
                  console.error('[Profile] Exception updating dotty_enabled:', error);
                  Alert.alert('Error', 'No se pudo ocultar el asistente');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Mostrar Asistente Dotty',
          '¿Deseas volver a mostrar a Dotty, tu asistente personal?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Mostrar',
              onPress: async () => {
                try {
                  console.log('[Profile] Updating dotty_enabled to true for user:', userId);
                  const { data, error } = await supabaseClient
                    .from('profiles')
                    .update({ dotty_enabled: true })
                    .eq('id', userId)
                    .select();

                  if (error) {
                    console.error('[Profile] Error updating dotty_enabled:', error);
                    Alert.alert('Error', 'No se pudo mostrar el asistente');
                    return;
                  }

                  console.log('[Profile] Successfully updated dotty_enabled to true:', data);
                  setIsDottyEnabled(true);
                } catch (error) {
                  console.error('[Profile] Exception updating dotty_enabled:', error);
                  Alert.alert('Error', 'No se pudo mostrar el asistente');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error toggling Dotty:', error);
    }
  };

  const handleToggleNotifications = async () => {
    try {
      if (notificationsEnabled) {
        Alert.alert(
          'Deshabilitar Notificaciones',
          '¿Estás seguro de que quieres deshabilitar las notificaciones push? Ya no recibirás actualizaciones sobre reservas, pedidos y mensajes.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Deshabilitar',
              style: 'destructive',
              onPress: async () => {
                try {
                  await disableNotifications();
                  Alert.alert('Deshabilitadas', 'Las notificaciones push han sido deshabilitadas correctamente.');
                } catch (error: any) {
                  Alert.alert('Error', error.message || 'No se pudieron deshabilitar las notificaciones');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error in handleToggleNotifications:', error);
      Alert.alert('Error', 'Hubo un problema con la configuración de notificaciones');
    }
  };

  const performLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error: any) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
      Alert.alert('Error', error?.message || 'No se pudo cerrar sesión. Intenta nuevamente.');
    }
  };

  const handleLogout = () => {
    if (isLoggingOut) return;

    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar sesión', 
          style: 'destructive',
          onPress: performLogout
        }
      ]
    );
  };

  const getBusinessTypeName = (type: string) => {
    const types: Record<string, string> = {
      veterinary: 'Veterinaria',
      grooming: 'Peluquería',
      walking: 'Paseador',
      boarding: 'Pensión',
      shop: 'Tienda',
      shelter: 'Refugio'
    };
    return types[type] || type;
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner message="Cargando perfil..." size="medium" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isPartnerView ? 'Perfil de Aliado' : t('profile')}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showSubscriptionReturnBanner && (
          <SubscriptionReturnBanner
            scope={subscriptionReturnScope}
            status={subscriptionReturnStatus}
            message={subscriptionReturnMessage}
          />
        )}

        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image
              source={{ 
                uri: currentUser.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=200' 
              }}
              style={styles.avatar}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {currentUser.displayName || 'Usuario'}
              </Text>
              <Text style={styles.profileEmail}>{currentUser.email}</Text>
              {currentUser.bio && (
                <Text style={styles.profileBio}>{currentUser.bio}</Text>
              )}
            </View>
          </View>

          {!isPartnerView && (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{userStats.petsCount}</Text>
                <Text style={styles.statLabel}>{t('pets')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{userStats.postsCount}</Text>
                <Text style={styles.statLabel}>{t('posts')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{userStats.followersCount}</Text>
                <Text style={styles.statLabel}>{t('followers')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{userStats.followingCount}</Text>
                <Text style={styles.statLabel}>{t('following')}</Text>
              </View>
            </View>
          )}
        </Card>

        {!isPartnerView && (
          <Card style={styles.smartCareCard}>
            <View style={styles.smartCareHeader}>
              <View style={styles.smartCareIcon}>
                <Sparkles size={24} color="#2D6A6F" />
              </View>
              <View style={styles.smartCareCopy}>
                <Text style={styles.smartCareTitle}>Cuidado inteligente</Text>
                <Text style={styles.smartCareSubtitle}>
                  Recomendaciones personalizadas y modo emergencia
                </Text>
              </View>
            </View>

            <Text style={styles.smartCareBody}>
              Abre el centro para ver vacunas, peso, conducta, alergias y compartir la historia
              clínica de tus mascotas cuando lo necesites.
            </Text>

            <Button
              title="Abrir centro"
              onPress={() => router.push('/pets/care')}
              size="medium"
            />
          </Card>
        )}

        {/* Premium Subscription Card */}
        {subscriptionsEnabled && !isPartnerView && (
          <Card style={styles.partnerCard}>
            <View style={styles.partnerHeader}>
              <Crown size={24} color="#2D6A6F" />
              <Text style={styles.partnerTitle}>
                {userSubscription ? 'Mi suscripción de mascota' : 'Suscripción de mascota'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.partnerActive}
              onPress={() => router.push('/profile/subscription')}
              activeOpacity={0.85}
            >
              <View style={styles.partnerSubscriptionBox}>
                <View style={styles.partnerSubscriptionRow}>
                  <View style={styles.partnerSubscriptionCopy}>
                    <Text style={styles.partnerSubscriptionTitle}>Suscripción de Mascota</Text>
                    <Text style={styles.partnerSubscriptionSubtitle}>
                      {userSubscription
                        ? `Plan ${userSubscription.subscription_plans?.name || 'Premium'} · ${personalSubscriptionStatusLabel}`
                        : 'Plan Free · Activo'}
                    </Text>
                  </View>
                  <Crown size={22} color="#2D6A6F" />
                </View>
                <Text style={styles.partnerSubscriptionDescription}>
                  {userSubscription
                    ? userSubscription.status === 'pending'
                      ? 'Tu suscripción personal está pendiente de confirmación en Mercado Pago.'
                      : 'Tu suscripción personal se aplica a tu perfil y a tus mascotas.'
                    : 'Desbloquea funciones para el perfil personal y tus mascotas.'}
                </Text>
              </View>
            </TouchableOpacity>
          </Card>
        )}

        {subscriptionsEnabled && isPartnerView && (
          <Card style={styles.partnerCard}>
            <View style={styles.partnerHeader}>
              <Building size={24} color="#2D6A6F" />
              <Text style={styles.partnerTitle}>
                {partnerPlan ? 'Mi suscripción de aliado' : 'Suscripción de aliado'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.partnerActive}
              onPress={handlePartnerSubscription}
              activeOpacity={0.85}
            >
              <View style={styles.partnerSubscriptionBox}>
                <View style={styles.partnerSubscriptionRow}>
                  <View style={styles.partnerSubscriptionCopy}>
                    <Text style={styles.partnerSubscriptionTitle}>Suscripción de Aliado</Text>
                    <Text style={styles.partnerSubscriptionSubtitle}>
                      {partnerPlan
                        ? `Plan ${partnerPlan.name} · ${partnerPlanStatusLabel || 'Activa'}`
                        : partnerProfile
                          ? 'Sin plan activo'
                          : 'Selecciona un negocio para ver tu suscripción'}
                    </Text>
                  </View>
                  <Crown size={22} color="#2D6A6F" />
                </View>
                <Text style={styles.partnerSubscriptionDescription}>
                  {partnerProfile
                    ? `${partnerLinkedBusinessesLabel || '0 negocios vinculados'}. Tu suscripción de aliado aplica a tus negocios verificados.`
                    : 'Debes registrar o seleccionar un negocio para gestionar la suscripción de aliado.'}
                </Text>
              </View>
            </TouchableOpacity>
          </Card>
        )}

        {/* Menu Options */}
        <Card style={styles.menuCard}>
          <TouchableOpacity style={styles.menuOption} onPress={handleEditProfile}>
            <View style={styles.menuOptionLeft}>
              <Edit size={20} color="#6B7280" />
              <Text style={styles.menuOptionText}>Editar perfil</Text>
            </View>
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>

          {availableRoles.length > 1 && (
            <TouchableOpacity style={styles.menuOption} onPress={handleChangeRole}>
              <View style={styles.menuOptionLeft}>
                <RefreshCw size={20} color="#6B7280" />
                <Text style={styles.menuOptionText}>Cambiar rol</Text>
              </View>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>
          )}

          {!isPartnerView && (
            <>
              <TouchableOpacity style={styles.menuOption} onPress={handleMyOrders}>
                <View style={styles.menuOptionLeft}>
                  <ShoppingBag size={20} color="#6B7280" />
                  <Text style={styles.menuOptionText}>{t('myOrders')}</Text>
                </View>
                <ChevronRight size={16} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuOption} onPress={() => router.push('/cart')}>
                <View style={styles.menuOptionLeft}>
                  <ShoppingBag size={20} color="#6B7280" />
                  <Text style={styles.menuOptionText}>Mi Carrito</Text>
                </View>
                <ChevronRight size={16} color="#6B7280" />
              </TouchableOpacity>
            </>
          )}
        </Card>

        {/* Settings */}
        <Card style={styles.menuCard}>
          {/* Biometric Authentication - Solo mostrar cuando está habilitada */}
          {isBiometricSupported && isBiometricEnabled && (
            <View style={styles.biometricCard}>
              <View style={styles.biometricHeader}>
                <View style={styles.biometricIconContainer}>
                  <Fingerprint size={24} color="#2D6A6F" />
                </View>
                <View style={styles.biometricInfo}>
                  <Text style={styles.biometricTitle}>
                    Autenticación {biometricType || 'Biométrica'}
                  </Text>
                  <Text style={styles.biometricDescription}>
                    🔒 Habilitado para acceso instantáneo
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.biometricToggle,
                    styles.biometricToggleActive
                  ]}
                  onPress={handleToggleBiometric}
                >
                  <View style={[
                    styles.biometricToggleHandle,
                    styles.biometricToggleHandleActive
                  ]} />
                </TouchableOpacity>
              </View>

              <View style={styles.biometricBenefits}>
                <Text style={styles.benefitsTitle}>Beneficios:</Text>
                <Text style={styles.benefitItem}>• Acceso instantáneo sin contraseñas</Text>
                <Text style={styles.benefitItem}>• Máxima seguridad con tu {biometricType?.toLowerCase() || 'biometría'}</Text>
                <Text style={styles.benefitItem}>• Credenciales protegidas en tu dispositivo</Text>
              </View>
            </View>
          )}

          {/* Notificaciones Push - Solo mostrar toggle para deshabilitarlas cuando están habilitadas */}
          {notificationsEnabled && (
            <TouchableOpacity style={styles.menuOption} onPress={handleToggleNotifications}>
              <View style={styles.menuOptionLeft}>
                <Bell size={20} color="#6B7280" />
                <Text style={styles.menuOptionText}>Notificaciones Push</Text>
              </View>
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleStatus}>Habilitado</Text>
                <ChevronRight size={16} color="#6B7280" />
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.menuOption} onPress={handleToggleDottyAssistant}>
            <View style={styles.menuOptionLeft}>
              <HelpCircle size={20} color="#6B7280" />
              <Text style={styles.menuOptionText}>Asistente Dotty</Text>
            </View>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleStatus}>{isDottyEnabled ? 'Visible' : 'Oculto'}</Text>
              <ChevronRight size={16} color="#6B7280" />
            </View>
          </TouchableOpacity>
          {!dottyPlanEnabled && (
            <Text style={styles.planHintText}>Dotty no está incluido en tu plan actual.</Text>
          )}

          <TouchableOpacity 
            style={styles.menuOption} 
            onPress={() => router.push('/profile/help-support')}
          >
            <View style={styles.menuOptionLeft}>
              <HelpCircle size={20} color="#6B7280" />
              <Text style={styles.menuOptionText}>{t('helpSupport')}</Text>
            </View>
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>

        </Card>

        {/* Advanced Settings */}
        <Card style={styles.menuCard}>
          <TouchableOpacity 
            style={styles.menuOption} 
            onPress={() => router.push('/profile/delete-account')}
          >
            <View style={styles.menuOptionLeft}>
              <Trash2 size={20} color="#EF4444" />
              <Text style={[styles.menuOptionText, styles.dangerText]}>Eliminar cuenta</Text>
            </View>
            <ChevronRight size={16} color="#EF4444" />
          </TouchableOpacity>
        </Card>
        {/* Logout */}
        <Card style={styles.logoutCard}>
          <TouchableOpacity
            style={[styles.logoutOption, isLoggingOut ? styles.logoutOptionDisabled : null]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <LogOut size={20} color="#10B981" />
            )}
            <Text style={[styles.logoutText, styles.logoutTextGreen]}>
              {isLoggingOut ? 'Cerrando sesión...' : t('signOut')}
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {isLoggingOut && (
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutOverlayCard}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.logoutOverlayTitle}>Cerrando sesión</Text>
            <Text style={styles.logoutOverlayText}>Estamos cerrando tu cuenta de forma segura.</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
  },
  editButton: {
    padding: 8,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  profileCard: {
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  profileBio: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  smartCareCard: {
    marginBottom: 16,
  },
  smartCareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  smartCareIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  smartCareCopy: {
    flex: 1,
  },
  smartCareTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  smartCareSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  smartCareBody: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  partnerCard: {
    marginBottom: 16,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  partnerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
    marginLeft: 8,
  },
  partnerButtons: {
    gap: 12,
    width: '100%',
  },
  partnerButton: {
    width: '100%',
  },
  partnerActive: {
    alignItems: 'center',
  },
  partnerSubscriptionBox: {
    width: '100%',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  partnerSubscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  partnerSubscriptionCopy: {
    flex: 1,
  },
  partnerSubscriptionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#134E4A',
    marginBottom: 2,
  },
  partnerSubscriptionSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#0F766E',
  },
  partnerSubscriptionDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#155E75',
    lineHeight: 17,
  },
  partnerActiveText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#059669',
    textAlign: 'center',
    marginBottom: 12,
  },
  businessInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  verifiedBadge: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#10B981',
  },
  partnerInactive: {
    alignItems: 'center',
  },
  partnerInactiveText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  partnerDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  menuCard: {
    marginBottom: 16,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 12,
  },
  premiumMenuOption: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  premiumMenuText: {
    color: '#92400E',
    fontFamily: 'Inter-SemiBold',
  },
  subscriptionPlanBadge: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#F59E0B',
    marginTop: 2,
    marginLeft: 12,
  },
  premiumCard: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  premiumOption: {
    padding: 4,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  premiumIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E6FFFA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  premiumTextContainer: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#134E4A',
    marginBottom: 4,
  },
  premiumSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#0F766E',
  },
  languageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginRight: 8,
  },
  logoutCard: {
    marginBottom: 32,
  },
  logoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  logoutOptionDisabled: {
    opacity: 0.75,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
    marginLeft: 8,
  },
  logoutTextGreen: {
    color: '#10B981',
  },
  logoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoutOverlayCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  logoutOverlayTitle: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  logoutOverlayText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  dangerText: {
    color: '#EF4444',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleStatus: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#059669',
    marginRight: 8,
  },
  planHintText: {
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 40,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#B45309',
  },
  benefitsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0369A1',
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0369A1',
    marginBottom: 4,
    lineHeight: 18,
  },
  
  // Biometric Card Styles (consistente con notificaciones)
  biometricCard: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    borderRadius: 12,
  },
  biometricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  biometricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  biometricInfo: {
    flex: 1,
  },
  biometricTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  biometricDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  biometricToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    padding: 2,
  },
  biometricToggleActive: {
    backgroundColor: '#2D6A6F',
  },
  biometricToggleHandle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  biometricToggleHandleActive: {
    transform: [{ translateX: 20 }],
  },
  biometricBenefits: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
});





