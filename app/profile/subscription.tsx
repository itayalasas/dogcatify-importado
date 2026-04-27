import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Clock, Crown, ExternalLink, RefreshCw } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

type BillingCycle = 'monthly' | 'yearly';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features?: string[];
  is_recommended?: boolean;
  is_default?: boolean;
  mercadopago_monthly_plan_id?: string | null;
  mercadopago_yearly_plan_id?: string | null;
  mercadopago_monthly_init_point?: string | null;
  mercadopago_yearly_init_point?: string | null;
}

const normalizePlan = (row: any): SubscriptionPlan => ({
  id: row.id,
  name: row.name || '',
  description: row.description || '',
  price_monthly: Number(row.price_monthly || 0),
  price_yearly: Number(row.price_yearly || 0),
  currency: row.currency || 'UYU',
  features: Array.isArray(row.features) ? row.features.map(String) : [],
  is_recommended: row.is_recommended === true,
  is_default: row.is_default === true,
  mercadopago_monthly_plan_id: row.mercadopago_monthly_plan_id || null,
  mercadopago_yearly_plan_id: row.mercadopago_yearly_plan_id || null,
  mercadopago_monthly_init_point: row.mercadopago_monthly_init_point || null,
  mercadopago_yearly_init_point: row.mercadopago_yearly_init_point || null,
});

const getPlanPrice = (plan: SubscriptionPlan, cycle: BillingCycle) =>
  cycle === 'monthly' ? plan.price_monthly : plan.price_yearly;

const getPlanMercadoPagoId = (plan: SubscriptionPlan, cycle: BillingCycle) =>
  cycle === 'monthly' ? plan.mercadopago_monthly_plan_id : plan.mercadopago_yearly_plan_id;

const getSingleParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const buildSubscriptionDeepLink = (subscriptionId?: string | string[]) => {
  const id = getSingleParam(subscriptionId);
  return `dogcatify://profile/subscription${id ? `?subscription_id=${encodeURIComponent(id)}` : ''}`;
};

const isMobileWebBrowser = () => {
  const userAgent = String((globalThis as any).navigator?.userAgent || '');
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
};

export default function Subscription() {
  const { currentUser } = useAuth();
  const { subscription_id } = useLocalSearchParams<{ subscription_id?: string }>();
  const [loading, setLoading] = useState(true);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [syncingSubscriptionId, setSyncingSubscriptionId] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    loadSubscriptionData();
  }, [currentUser?.id, subscription_id]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isMobileWebBrowser()) return;

    const timeoutId = setTimeout(() => {
      Linking.openURL(buildSubscriptionDeepLink(subscription_id)).catch((error) => {
        console.warn('Could not open subscription deep link from web:', error);
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [subscription_id]);

  const loadSubscriptionData = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await Promise.all([loadPlans(), loadUserSubscription()]);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setPlans((data || []).map(normalizePlan));
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Error', 'No se pudieron cargar los planes de suscripcion');
    }
  };

  const loadUserSubscription = async () => {
    if (!currentUser?.id) return;

    try {
      const selectedSubscriptionId = getSingleParam(subscription_id);
      let query = supabaseClient
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            name,
            description,
            features
          )
        `)
        .eq('user_id', currentUser.id)
        .in('status', ['active', 'pending', 'paused']);

      if (selectedSubscriptionId) {
        query = query.eq('id', selectedSubscriptionId);
      } else {
        query = query.order('created_at', { ascending: false }).limit(1);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (data && shouldSyncSubscriptionStatus(data)) {
        const syncedSubscription = await syncSubscriptionStatus(data.id);
        setUserSubscription(syncedSubscription || data);
        return;
      }

      setUserSubscription(data || null);
    } catch (error) {
      console.error('Error loading user subscription:', error);
    }
  };

  const shouldSyncSubscriptionStatus = (subscription: any) => {
    if (!subscription?.id) return false;
    if (String(subscription_id || '') === subscription.id) return true;
    return (
      subscription.status === 'pending' &&
      subscription.metadata?.source === 'mercadopago'
    );
  };

  const syncSubscriptionStatus = async (subscriptionId: string) => {
    try {
      setSyncingSubscriptionId(subscriptionId);

      const { data, error } = await supabaseClient.functions.invoke('create-user-subscription', {
        body: {
          action: 'sync-status',
          subscriptionId,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'SUBSCRIPTION_SYNC_FAILED');

      return data.subscription || null;
    } catch (error) {
      console.error('Error syncing subscription status:', error);
      return null;
    } finally {
      setSyncingSubscriptionId(null);
    }
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    const price = getPlanPrice(plan, selectedBillingCycle);
    const mpPlanId = getPlanMercadoPagoId(plan, selectedBillingCycle);

    if (price > 0 && !mpPlanId) {
      Alert.alert(
        'Plan no disponible',
        'Este plan todavia no esta conectado a Mercado Pago para el ciclo elegido.'
      );
      return;
    }

    Alert.alert(
      'Confirmar suscripcion',
      `Vas a gestionar el plan ${plan.name} por Mercado Pago. Deseas continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => createSubscription(plan),
        },
      ]
    );
  };

  const createSubscription = async (plan: SubscriptionPlan) => {
    try {
      setSubscribingPlanId(plan.id);

      const { data, error } = await supabaseClient.functions.invoke('create-user-subscription', {
        body: {
          planId: plan.id,
          billingCycle: selectedBillingCycle,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'SUBSCRIPTION_CREATE_FAILED');

      if (data.paymentUrl) {
        const canOpen = await Linking.canOpenURL(data.paymentUrl);
        if (!canOpen) {
          throw new Error('No se pudo abrir Mercado Pago en este dispositivo.');
        }
        await Linking.openURL(data.paymentUrl);
      } else if (data.status === 'active') {
        Alert.alert('Plan activado', 'Tu plan quedo activo correctamente.');
      }

      await loadUserSubscription();
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      Alert.alert(
        'Error',
        error?.message || 'No se pudo iniciar la suscripcion.'
      );
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const handleContinuePendingSubscription = async () => {
    const paymentUrl = userSubscription?.payment_url;

    if (!paymentUrl) {
      Alert.alert('Mercado Pago', 'No hay un link de pago disponible para esta suscripcion.');
      return;
    }

    try {
      await Linking.openURL(paymentUrl);
    } catch (error) {
      console.error('Error opening pending subscription URL:', error);
      Alert.alert('Error', 'No se pudo abrir Mercado Pago.');
    }
  };

  const formatPrice = (price: number, currency: string) => {
    if (price <= 0) return 'Gratis';
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: currency || 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const getYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
    if (monthlyPrice <= 0 || yearlyPrice <= 0) return null;
    const monthlyCost = monthlyPrice * 12;
    const savings = monthlyCost - yearlyPrice;
    if (savings <= 0) return null;
    const percentage = (savings / monthlyCost) * 100;
    return `Ahorra ${percentage.toFixed(0)}%`;
  };

  const getSubscriptionStatus = () => {
    const status = String(userSubscription?.status || '').toLowerCase();
    if (status === 'active') return 'Activa';
    if (status === 'pending') return 'Pendiente';
    if (status === 'paused') return 'Pausada';
    return status || 'Sin estado';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Cargando planes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Suscripcion Premium</Text>
        <TouchableOpacity onPress={loadSubscriptionData} style={styles.backButton}>
          <RefreshCw size={21} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {userSubscription && (
          <Card style={[
            styles.currentSubscriptionCard,
            userSubscription.status === 'pending' && styles.pendingSubscriptionCard,
          ] as any}>
            <View style={styles.currentSubscriptionHeader}>
              {userSubscription.status === 'pending' ? (
                <Clock size={32} color="#D97706" />
              ) : (
                <Crown size={32} color="#F59E0B" />
              )}
              <View style={styles.currentSubscriptionInfo}>
                <Text style={styles.currentSubscriptionTitle}>
                  {userSubscription.status === 'pending' ? 'Suscripcion Pendiente' : 'Suscripcion Activa'}
                </Text>
                <Text style={styles.currentSubscriptionPlan}>
                  {userSubscription.subscription_plans?.name || 'Premium'}
                </Text>
              </View>
            </View>
            <View style={styles.currentSubscriptionDetails}>
              <Text style={styles.subscriptionDetailText}>
                Estado: <Text style={styles.subscriptionDetailValue}>{getSubscriptionStatus()}</Text>
              </Text>
              {userSubscription.expires_at && (
                <Text style={styles.subscriptionDetailText}>
                  Renovacion: {' '}
                  <Text style={styles.subscriptionDetailValue}>
                    {new Date(userSubscription.expires_at).toLocaleDateString()}
                  </Text>
                </Text>
              )}
              <Text style={styles.subscriptionDetailText}>
                Ciclo: {' '}
                <Text style={styles.subscriptionDetailValue}>
                  {userSubscription.billing_cycle === 'yearly' ? 'Anual' : 'Mensual'}
                </Text>
              </Text>
              {userSubscription.mercadopago_preapproval_id && (
                <Text style={styles.subscriptionDetailText} numberOfLines={1}>
                  Mercado Pago: <Text style={styles.subscriptionDetailValue}>{userSubscription.mercadopago_preapproval_id}</Text>
                </Text>
              )}
            </View>
            <Button
              title={
                syncingSubscriptionId === userSubscription.id
                  ? 'Confirmando suscripcion...'
                  : userSubscription.status === 'pending'
                    ? 'Continuar en Mercado Pago'
                    : 'Gestionar en Mercado Pago'
              }
              onPress={
                userSubscription.status === 'pending'
                  ? handleContinuePendingSubscription
                  : () => Alert.alert('Mercado Pago', 'Las pausas, cancelaciones y cambios de medio de pago se gestionan desde Mercado Pago.')
              }
              variant="outline"
              size="medium"
              style={styles.manageButton}
              disabled={syncingSubscriptionId === userSubscription.id}
              loading={syncingSubscriptionId === userSubscription.id}
            />
          </Card>
        )}

        {!userSubscription && (
          <View style={styles.billingCycleContainer}>
            <TouchableOpacity
              style={[
                styles.billingCycleOption,
                selectedBillingCycle === 'monthly' && styles.billingCycleOptionActive
              ]}
              onPress={() => setSelectedBillingCycle('monthly')}
            >
              <Text
                style={[
                  styles.billingCycleText,
                  selectedBillingCycle === 'monthly' && styles.billingCycleTextActive
                ]}
              >
                Mensual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.billingCycleOption,
                selectedBillingCycle === 'yearly' && styles.billingCycleOptionActive
              ]}
              onPress={() => setSelectedBillingCycle('yearly')}
            >
              <Text
                style={[
                  styles.billingCycleText,
                  selectedBillingCycle === 'yearly' && styles.billingCycleTextActive
                ]}
              >
                Anual
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.plansContainer}>
          {plans.map((plan, index) => {
            const isCurrentPlan = userSubscription?.plan_id === plan.id;
            const price = getPlanPrice(plan, selectedBillingCycle);
            const mpPlanId = getPlanMercadoPagoId(plan, selectedBillingCycle);
            const features = plan.features || [];
            const savings = getYearlySavings(plan.price_monthly, plan.price_yearly);
            const isRecommended = plan.is_recommended || index === 1;
            const isSubscribing = subscribingPlanId === plan.id;
            const paidPlanWithoutMp = price > 0 && !mpPlanId;

            return (
              <Card
                key={plan.id}
                style={[
                  styles.planCard,
                  isCurrentPlan && styles.currentPlanCard,
                  isRecommended && styles.recommendedPlan
                ] as any}
              >
                {isRecommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>Recomendado</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                </View>

                <View style={styles.planPricing}>
                  <Text style={styles.planPrice}>
                    {formatPrice(price, plan.currency)}
                  </Text>
                  {price > 0 && (
                    <Text style={styles.planPricePeriod}>
                      / {selectedBillingCycle === 'monthly' ? 'mes' : 'ano'}
                    </Text>
                  )}
                </View>

                {selectedBillingCycle === 'yearly' && savings && (
                  <Text style={styles.savingsText}>{savings}</Text>
                )}

                <View style={styles.mpPlanRow}>
                  <ExternalLink size={14} color={paidPlanWithoutMp ? '#B45309' : '#0F766E'} />
                  <Text style={[styles.mpPlanText, paidPlanWithoutMp && styles.mpPlanWarning]}>
                    {price <= 0
                      ? 'No requiere Mercado Pago'
                      : paidPlanWithoutMp
                        ? 'Mercado Pago pendiente'
                        : 'Checkout recurrente conectado'}
                  </Text>
                </View>

                <View style={styles.featuresContainer}>
                  {features.map((feature: string, idx: number) => (
                    <View key={`${plan.id}-${idx}`} style={styles.featureItem}>
                      <Check size={16} color="#10B981" />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                {isCurrentPlan ? (
                  <View style={styles.currentPlanBadge}>
                    <Text style={styles.currentPlanBadgeText}>
                      {userSubscription?.status === 'pending' ? 'Pendiente' : 'Plan Actual'}
                    </Text>
                  </View>
                ) : (
                  <Button
                    title={
                      userSubscription
                        ? 'Cambiar Plan'
                        : plan.is_default
                          ? 'Usar Plan Free'
                          : 'Seleccionar Plan'
                    }
                    onPress={() => handleSelectPlan(plan)}
                    variant={isRecommended ? 'primary' : 'outline'}
                    size="medium"
                    style={styles.selectPlanButton}
                    disabled={paidPlanWithoutMp || isSubscribing}
                    loading={isSubscribing}
                  />
                )}
              </Card>
            );
          })}
        </View>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Informacion importante</Text>
          <Text style={styles.infoText}>
            Los planes pagos se autorizan y cobran desde Mercado Pago.{'\n'}
            DogCatiFy activa tus permisos cuando Mercado Pago confirma la suscripcion.{'\n'}
            Puedes pausar o cancelar la suscripcion desde tu cuenta de Mercado Pago.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
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
    marginTop: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  currentSubscriptionCard: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  pendingSubscriptionCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  currentSubscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentSubscriptionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  currentSubscriptionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
    marginBottom: 4,
  },
  currentSubscriptionPlan: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#92400E',
  },
  currentSubscriptionDetails: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#FED7AA',
  },
  subscriptionDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    marginBottom: 6,
  },
  subscriptionDetailValue: {
    fontFamily: 'Inter-SemiBold',
  },
  manageButton: {
    marginTop: 8,
  },
  billingCycleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  billingCycleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  billingCycleOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  billingCycleText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  billingCycleTextActive: {
    color: '#111827',
    fontFamily: 'Inter-SemiBold',
  },
  plansContainer: {
    marginBottom: 24,
  },
  planCard: {
    marginBottom: 16,
    padding: 20,
    position: 'relative',
  },
  currentPlanCard: {
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  recommendedPlan: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendedBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  planHeader: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 34,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  planPricePeriod: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  savingsText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
    marginBottom: 12,
  },
  mpPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  mpPlanText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#0F766E',
  },
  mpPlanWarning: {
    color: '#B45309',
  },
  featuresContainer: {
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  currentPlanBadge: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  currentPlanBadgeText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  selectPlanButton: {
    marginTop: 8,
  },
  infoCard: {
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 22,
  },
});
