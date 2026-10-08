import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, ActivityIndicator, Switch, Platform } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, ShoppingBag, ShoppingCart, LogOut, Pencil as Edit, Bell, CircleHelp as HelpCircle, Building, Fingerprint, ChevronRight, Trash2, Crown, Sparkles, RefreshCw, Bot } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { toast } from '../../components/ui/Toast';
import { SettingsRow, SettingsGroup } from '../../components/account/SettingsRow';
import { colors, typography, spacing, radius, shadows } from '../../constants/theme';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SubscriptionReturnBanner } from '../../components/SubscriptionReturnBanner';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useBiometric } from '../../contexts/BiometricContext';
import { supabaseClient, updateUserProfile } from '../../lib/supabase';
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
  const { currentUser, logout, activeRole, updateCurrentUser } = useAuth();
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
  const [isRoleUpgradeLoading, setIsRoleUpgradeLoading] = useState(false);
  const skipInitialFocusRefreshRef = React.useRef(true);
  const pendingSyncRef = React.useRef(false);
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
          id,
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

        // A "pending" row may just be waiting for Mercado Pago's confirmation
        // (e.g. the user paid and came straight back to the profile). Ask for
        // the real status in the background — one quick attempt per visit —
        // and refresh this row if it changed.
        if (data.status === 'pending' && data.id && !pendingSyncRef.current) {
          pendingSyncRef.current = true;
          supabaseClient.functions
            .invoke('create-user-subscription', {
              body: { action: 'sync-status', subscriptionId: data.id, quick: true },
            })
            .then(({ data: syncData }) => {
              const syncedStatus = syncData?.subscription?.status;
              if (syncedStatus && syncedStatus !== 'pending') {
                void fetchUserSubscription();
              }
            })
            .catch((syncError) => {
              console.warn('Could not sync pending subscription from profile:', syncError);
            })
            .finally(() => {
              pendingSyncRef.current = false;
            });
        }
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
        .from('profiles_public')
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
    router.replace({
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

  const handleEnableOwnerRole = async () => {
    if (!currentUser?.id || currentUser.isOwner || isRoleUpgradeLoading) {
      return;
    }

    try {
      setIsRoleUpgradeLoading(true);

      await updateUserProfile(currentUser.id, {
        email: currentUser.email,
        is_owner: true,
      });

      updateCurrentUser({
        ...currentUser,
        isOwner: true,
      });

      toast.success(
        'Perfil de dueño activado',
        'Ya podés usar "Cambiar rol" para alternar entre aliado y dueño.'
      );
    } catch (error) {
      console.error('Error enabling owner role:', error);
      Alert.alert(
        'No pudimos activar el perfil de dueño',
        'Intentá de nuevo en unos segundos.'
      );
    } finally {
      setIsRoleUpgradeLoading(false);
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
          'Desactivar ingreso biométrico',
          '¿Querés desactivar el ingreso biométrico? Solo vas a poder volver a activarlo desde la pantalla de ingreso.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Desactivar',
              style: 'destructive',
              onPress: async () => {
                try {
                  await disableBiometric();
                  toast.success(
                    'Ingreso biométrico desactivado',
                    'Podés volver a activarlo desde la pantalla de ingreso.'
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
          'Tu plan actual no incluye el asistente Dotty. Mejorá tu suscripción para activarlo.'
        );
        return;
      }

      const userId = currentUser.id;

      if (isDottyEnabled) {
        Alert.alert(
          'Ocultar asistente Dotty',
          'Podés arrastrar a Dotty hacia la parte inferior de la pantalla para ocultarlo, o hacerlo desde acá. ¿Querés ocultarlo?',
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
          'Mostrar asistente Dotty',
          '¿Querés volver a mostrar a Dotty, tu asistente personal?',
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
          'Desactivar notificaciones',
          '¿Querés desactivar las notificaciones push? Ya no vas a recibir avisos sobre reservas, pedidos y mensajes.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Desactivar',
              style: 'destructive',
              onPress: async () => {
                try {
                  await disableNotifications();
                  toast.success('Notificaciones desactivadas');
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
      Alert.alert('Error', error?.message || 'No se pudo cerrar sesión. Intentá de nuevo.');
    }
  };

  const handleLogout = () => {
    if (isLoggingOut) return;

    Alert.alert(
      'Cerrar sesión',
      '¿Querés cerrar sesión en este dispositivo?',
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

  const displayName = currentUser.displayName || 'Usuario';
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part.charAt(0).toUpperCase())
    .join('') || 'U';
  const iconColor = colors.primary;

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? spacing.sm : insets.top + spacing.md }]}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {isPartnerView ? 'Perfil de aliado' : t('profile')}
        </Text>
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
          <TouchableOpacity
            style={styles.profileHeader}
            onPress={handleEditProfile}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${displayName}, ${currentUser.email}. Editar perfil`}
          >
            {currentUser.photoURL ? (
              <Image source={{ uri: currentUser.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{currentUser.email}</Text>
              {isPartnerView && partnerProfile?.businessName ? (
                <View style={styles.roleBadge}>
                  <Building size={12} color={colors.primary} />
                  <Text style={styles.roleBadgeText} numberOfLines={1}>
                    {partnerProfile.businessName}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.editChip}>
              <Edit size={16} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {currentUser.bio ? (
            <Text style={styles.profileBio}>{currentUser.bio}</Text>
          ) : null}

          {!isPartnerView && (
            <View style={styles.statsContainer}>
              {[
                { value: userStats.petsCount, label: t('pets') },
                { value: userStats.postsCount, label: t('posts') },
                { value: userStats.followersCount, label: t('followers') },
                { value: userStats.followingCount, label: t('following') },
              ].map((stat, index) => (
                <View
                  key={stat.label}
                  style={[styles.statItem, index > 0 && styles.statItemDivider]}
                  accessible
                  accessibilityLabel={`${stat.value} ${stat.label}`}
                >
                  <Text style={styles.statNumber}>{stat.value}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {!isPartnerView && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/pets/care')}
            accessibilityRole="button"
            accessibilityLabel="Cuidado inteligente. Abrir centro"
          >
            <Card style={styles.smartCareCard}>
              <View style={styles.smartCareHeader}>
                <View style={styles.smartCareIcon}>
                  <Sparkles size={22} color={colors.primary} />
                </View>
                <View style={styles.smartCareCopy}>
                  <Text style={styles.smartCareTitle}>Cuidado inteligente</Text>
                  <Text style={styles.smartCareSubtitle}>
                    Vacunas, peso, conducta, alergias, modo emergencia y la historia clínica de tus mascotas.
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.primary} />
              </View>
            </Card>
          </TouchableOpacity>
        )}

        {/* Premium Subscription Card */}
        {subscriptionsEnabled && !isPartnerView && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/profile/subscription')}
            accessibilityRole="button"
            accessibilityLabel="Suscripción de mascota"
          >
            <Card style={styles.subscriptionCard}>
              <View style={styles.subscriptionRow}>
                <View style={styles.subscriptionIcon}>
                  <Crown size={22} color={colors.onAccent} />
                </View>
                <View style={styles.subscriptionCopy}>
                  <Text style={styles.subscriptionTitle}>
                    {userSubscription ? 'Mi suscripción de mascota' : 'Suscripción de mascota'}
                  </Text>
                  <Text style={styles.subscriptionSubtitle}>
                    {userSubscription
                      ? `Plan ${userSubscription.subscription_plans?.name || 'Premium'} · ${personalSubscriptionStatusLabel}`
                      : 'Plan Free · Activo'}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.text} />
              </View>
              <Text style={styles.subscriptionDescription}>
                {userSubscription
                  ? userSubscription.status === 'pending'
                    ? 'Tu suscripción personal está pendiente de confirmación en Mercado Pago.'
                    : 'Tu suscripción personal se aplica a tu perfil y a tus mascotas.'
                  : 'Desbloqueá funciones para tu perfil personal y tus mascotas.'}
              </Text>
            </Card>
          </TouchableOpacity>
        )}

        {subscriptionsEnabled && isPartnerView && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePartnerSubscription}
            accessibilityRole="button"
            accessibilityLabel="Suscripción de aliado"
          >
            <Card style={styles.subscriptionCard}>
              <View style={styles.subscriptionRow}>
                <View style={styles.subscriptionIcon}>
                  <Crown size={22} color={colors.onAccent} />
                </View>
                <View style={styles.subscriptionCopy}>
                  <Text style={styles.subscriptionTitle}>
                    {partnerPlan ? 'Mi suscripción de aliado' : 'Suscripción de aliado'}
                  </Text>
                  <Text style={styles.subscriptionSubtitle}>
                    {partnerPlan
                      ? `Plan ${partnerPlan.name} · ${partnerPlanStatusLabel || 'Activa'}`
                      : partnerProfile
                        ? 'Sin plan activo'
                        : 'Seleccioná un negocio para ver tu suscripción'}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.text} />
              </View>
              <Text style={styles.subscriptionDescription}>
                {partnerProfile
                  ? `${partnerLinkedBusinessesLabel || '0 negocios vinculados'}. Tu suscripción de aliado se aplica a tus negocios verificados.`
                  : 'Tenés que registrar o seleccionar un negocio para gestionar la suscripción de aliado.'}
              </Text>
            </Card>
          </TouchableOpacity>
        )}

        {/* Menu Options */}
        <SettingsGroup title="Cuenta">
          <SettingsRow
            icon={<Edit size={20} color={iconColor} />}
            label="Editar perfil"
            onPress={handleEditProfile}
          />

          {availableRoles.length > 1 && (
            <SettingsRow
              icon={<RefreshCw size={20} color={iconColor} />}
              label="Cambiar rol"
              onPress={handleChangeRole}
            />
          )}

          {!currentUser.isPartner && (
            <SettingsRow
              icon={<Building size={20} color={iconColor} />}
              label="Convertirme en aliado"
              description="Ofrecé tus servicios o productos en DogCatiFy"
              onPress={handlePartnerMode}
            />
          )}

          {isPartnerView && !currentUser.isOwner && (
            <SettingsRow
              icon={<User size={20} color={iconColor} />}
              label={isRoleUpgradeLoading ? 'Activando perfil de dueño...' : 'Habilitar perfil de dueño'}
              onPress={handleEnableOwnerRole}
              loading={isRoleUpgradeLoading}
            />
          )}

          {!isPartnerView && (
            <>
              <SettingsRow
                icon={<ShoppingBag size={20} color={iconColor} />}
                label={t('myOrders')}
                onPress={handleMyOrders}
              />
              <SettingsRow
                icon={<ShoppingCart size={20} color={iconColor} />}
                label="Mi carrito"
                onPress={() => router.push('/cart')}
              />
            </>
          )}
        </SettingsGroup>

        {/* Settings */}
        <SettingsGroup title="Preferencias">
          {/* Biometric Authentication - Solo mostrar cuando está habilitada */}
          {isBiometricSupported && isBiometricEnabled && (
            <SettingsRow
              icon={<Fingerprint size={20} color={iconColor} />}
              label={`Ingreso con ${biometricType || 'biometría'}`}
              description="Activado: ingresás sin escribir tu contraseña"
              right={
                <Switch
                  value
                  onValueChange={() => handleToggleBiometric()}
                  trackColor={{ false: colors.borderStrong, true: colors.primary }}
                  thumbColor={colors.white}
                  accessibilityLabel={`Ingreso con ${biometricType || 'biometría'}`}
                />
              }
            />
          )}

          {/* Notificaciones Push - Solo mostrar toggle para deshabilitarlas cuando están habilitadas */}
          {notificationsEnabled && (
            <SettingsRow
              icon={<Bell size={20} color={iconColor} />}
              label="Notificaciones push"
              value="Activadas"
              onPress={handleToggleNotifications}
            />
          )}

          <SettingsRow
            icon={<Bot size={20} color={iconColor} />}
            label="Asistente Dotty"
            value={isDottyEnabled ? 'Visible' : 'Oculto'}
            description={!dottyPlanEnabled ? 'Dotty no está incluido en tu plan actual.' : undefined}
            onPress={handleToggleDottyAssistant}
          />

          <SettingsRow
            icon={<HelpCircle size={20} color={iconColor} />}
            label={t('helpSupport')}
            onPress={() => router.push('/profile/help-support')}
            isLast
          />
        </SettingsGroup>

        {/* Zona de cuidado: cerrar sesión y eliminar cuenta */}
        <SettingsGroup style={styles.dangerGroup}>
          <SettingsRow
            icon={<LogOut size={20} color={colors.danger} />}
            label={isLoggingOut ? 'Cerrando sesión...' : t('signOut')}
            onPress={handleLogout}
            loading={isLoggingOut}
            tone="danger"
            right={null}
          />
          <SettingsRow
            icon={<Trash2 size={20} color={colors.danger} />}
            label="Eliminar cuenta"
            onPress={() => router.push('/profile/delete-account')}
            tone="danger"
            isLast
          />
        </SettingsGroup>
      </ScrollView>

      {isLoggingOut && (
        <View style={styles.logoutOverlay} accessibilityViewIsModal>
          <View style={styles.logoutOverlayCard}>
            <ActivityIndicator size="large" color={colors.primary} />
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
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  headerTitle: {
    ...typography.display,
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    marginBottom: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  avatarFallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...typography.title,
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    ...typography.heading,
    color: colors.text,
  },
  profileEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    maxWidth: '100%',
  },
  roleBadgeText: {
    ...typography.captionStrong,
    color: colors.primary,
    flexShrink: 1,
  },
  editChip: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBio: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  statNumber: {
    ...typography.heading,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  smartCareCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryMuted,
  },
  smartCareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  smartCareIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartCareCopy: {
    flex: 1,
  },
  smartCareTitle: {
    ...typography.bodyStrong,
    color: colors.primaryStrong,
  },
  smartCareSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  subscriptionCard: {
    marginBottom: spacing.xl,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subscriptionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionCopy: {
    flex: 1,
  },
  subscriptionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  subscriptionSubtitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  subscriptionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  dangerGroup: {
    marginTop: spacing.sm,
  },
  logoutOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  logoutOverlayCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    ...shadows.lg,
  },
  logoutOverlayTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  logoutOverlayText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
