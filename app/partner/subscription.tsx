import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Linking, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Crown, DollarSign, RefreshCw, Shield, Sparkles } from 'lucide-react-native';
import { SubscriptionReturnBanner } from '@/components/SubscriptionReturnBanner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { IconButton } from '../../components/ui/IconButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { toast } from '../../components/ui/Toast';
import { supabaseClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPartnerPlan,
  getPartnerPlanDisplayPrice,
  getPartnerSubscriptionStatusLabel,
  resolvePartnerPlanTier,
} from '../../utils/partnerPlans';
import { getSingleParam } from '../../utils/subscriptionReturn';
import { buildPartnerLimitSummary, resolveSubscriptionPlanLimits } from '../../utils/subscriptionPlanLimits';
import { colors, radius, spacing, typography } from '../../constants/theme';

type BillingCycle = 'monthly' | 'yearly';
type AudienceTarget = 'users' | 'partners' | 'all';

interface PartnerPlanRow {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  trial_days: number;
  features: string[];
  limitations?: string[];
  limits?: Record<string, any> | null;
  audience_target?: AudienceTarget | null;
  is_active: boolean;
  is_default?: boolean;
  is_recommended?: boolean;
  tier?: string | null;
}

interface PartnerSubscriptionRow {
  id: string;
  partner_id: string;
  plan_id: string;
  status: string;
  billing_cycle: BillingCycle;
  trial_used?: boolean | null;
  trial_days?: number | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  expires_at?: string | null;
  canceled_at?: string | null;
  cancellation_reason?: string | null;
  payment_url?: string | null;
  mercadopago_preapproval_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const toSingle = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

interface PartnerRow {
  id: string;
  business_name: string;
  business_type: string;
  subscription_plan_tier?: string | null;
  subscription_plan_status?: string | null;
  subscription_plan_expires_at?: string | null;
  is_verified?: boolean | null;
  is_active?: boolean | null;
}

const isCurrentSubscription = (subscription?: PartnerSubscriptionRow | null) => {
  if (!subscription) return false;

  const status = String(subscription.status || '').toLowerCase();
  const expiresAt = subscription.expires_at || subscription.trial_ends_at || null;
  const expiresTimestamp = expiresAt ? new Date(expiresAt).getTime() : null;
  const hasFutureAccess = expiresTimestamp !== null && !Number.isNaN(expiresTimestamp) && expiresTimestamp > Date.now();

  return (
    status === 'pending' ||
    status === 'trialing' ||
    status === 'active' ||
    status === 'paused' ||
    (status === 'cancelled' && hasFutureAccess)
  );
};

const getPlanTierFromRow = (row?: PartnerPlanRow | null) => {
  if (!row) return 'starter';
  const rawTier = String(row.tier || row.name || '').toLowerCase();
  if (rawTier === 'free' || rawTier === 'starter') return 'starter';
  if (rawTier === 'standard' || rawTier === 'growth') return 'growth';
  if (rawTier === 'premium' || rawTier === 'pro') return 'pro';
  return 'starter';
};

const resolveAccountPlanFromPartners = (partners: PartnerRow[]) => {
  return (partners || []).reduce((best: any, row: PartnerRow) => {
    const resolvedTier = resolvePartnerPlanTier(
      row.subscription_plan_tier,
      row.subscription_plan_status,
      row.subscription_plan_expires_at,
    ) as 'starter' | 'growth' | 'pro';

    const bestTier = (best?.subscriptionPlanTier || 'starter') as 'starter' | 'growth' | 'pro';
    const bestIndex = ['starter', 'growth', 'pro'].indexOf(bestTier);
    const resolvedIndex = ['starter', 'growth', 'pro'].indexOf(resolvedTier);

    if (!best || resolvedIndex > bestIndex) {
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

export default function PartnerSubscriptionScreen() {
  const { currentUser } = useAuth();
  const params = useLocalSearchParams();
  const requestedPartnerId = toSingle(params.businessId || params.partnerId);
  const subscription_id = getSingleParam(params.subscription_id);
  const subscription_status = params.subscription_status;
  const subscription_message = params.subscription_message;
  const subscription_scope = params.subscription_scope || params.scope;

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PartnerPlanRow[]>([]);
  const [partner, setPartner] = useState<any>(null);
  const [partnerRows, setPartnerRows] = useState<PartnerRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<PartnerSubscriptionRow[]>([]);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('monthly');
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // See app/profile/subscription.tsx's handleGoBack comment: reaching this
  // screen with subscription_id means we just got deep-linked back from
  // Mercado Pago's checkout, where the navigation stack can carry leftover
  // entries from the app relaunching/resuming (e.g. a stray redirect to
  // /auth/login) that a plain router.back() would step into despite the
  // partner being logged in. Go straight to a known-good destination there
  // instead of trusting stack history.
  const cameFromPaymentReturn = Boolean(subscription_id);

  const handleGoBack = () => {
    if (cameFromPaymentReturn) {
      router.replace('/(tabs)');
      return;
    }

    router.back();
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id, requestedPartnerId, subscription_id]);

  const loadData = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: partnerData, error: partnerError } = await supabaseClient
        .from('partners')
        .select('id, business_name, business_type, subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at, subscription_plan_metadata, is_verified, is_active')
        .eq('user_id', currentUser.id)
        .eq('is_verified', true)
        .order('created_at', { ascending: false });

      if (partnerError) throw partnerError;

      const normalizedPartners = (partnerData || []) as PartnerRow[];
      const selectedPartner = requestedPartnerId
        ? normalizedPartners.find((row) => row.id === requestedPartnerId) || normalizedPartners[0] || null
        : normalizedPartners[0] || null;

      setPartnerRows(normalizedPartners);
      setPartner(selectedPartner);

      const { data: plansData, error: plansError } = await supabaseClient
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .in('audience_target', ['partners', 'all'])
        .order('sort_order', { ascending: true });

      if (plansError) throw plansError;

      setPlans((plansData || []) as PartnerPlanRow[]);

      const partnerIds = normalizedPartners.map((row) => row.id);
      if (partnerIds.length === 0) {
        setSubscriptions([]);
        return;
      }

      const { data: subscriptionsData, error: subscriptionsError } = await supabaseClient
        .from('partner_subscriptions')
        .select('*')
        .in('partner_id', partnerIds)
        .order('created_at', { ascending: false });

      if (subscriptionsError) throw subscriptionsError;

      setSubscriptions((subscriptionsData || []) as PartnerSubscriptionRow[]);
    } catch (error) {
      console.error('Error loading partner subscription data:', error);
      Alert.alert('Error', 'No se pudieron cargar los planes del aliado.');
    } finally {
      setLoading(false);
    }
  };

  const accountPlan = resolveAccountPlanFromPartners(partnerRows);
  const anchorPartnerId = partner?.id || partnerRows[0]?.id || requestedPartnerId || null;
  const scopedSubscriptions = anchorPartnerId
    ? subscriptions.filter((subscription) => subscription.partner_id === anchorPartnerId)
    : subscriptions;
  const currentSubscription =
    scopedSubscriptions.find(isCurrentSubscription) ||
    scopedSubscriptions[0] ||
    subscriptions.find(isCurrentSubscription) ||
    subscriptions[0] ||
    null;
  const currentAccessEndsAt = currentSubscription?.expires_at || currentSubscription?.trial_ends_at || null;
  const currentPlanTier = (accountPlan?.subscriptionPlanTier || resolvePartnerPlanTier(
    partner?.subscription_plan_tier,
    partner?.subscription_plan_status,
    partner?.subscription_plan_expires_at,
  )) as 'starter' | 'growth' | 'pro';
  const currentPlan = plans.find((plan) => getPlanTierFromRow(plan) === currentPlanTier) || null;
  const trialAlreadyUsed = subscriptions.some((subscription) => subscription.trial_used === true);
  const hasCurrentAccess = Boolean(currentSubscription && isCurrentSubscription(currentSubscription));
  const currentStatusLabel = currentSubscription
    ? getPartnerSubscriptionStatusLabel(currentSubscription.status, currentAccessEndsAt)
    : currentPlanTier === 'starter'
      ? 'Plan base gratuito'
      : 'Sin suscripción';
  const currentAccessLabel = currentAccessEndsAt
    ? new Date(currentAccessEndsAt).toLocaleDateString('es-UY')
    : currentPlanTier === 'starter'
      ? 'Siempre activo'
      : 'Sin fecha';

  const canStartNewPlan = !hasCurrentAccess;
  const actionPartnerId = anchorPartnerId;

  const getActionLabel = (plan: PartnerPlanRow) => {
    if (currentPlan && getPlanTierFromRow(plan) === getPlanTierFromRow(currentPlan)) {
      return 'Plan actual';
    }

    if (!canStartNewPlan) {
      return 'Cancela tu plan actual';
    }

    if (plan.price_monthly === 0 && plan.price_yearly === 0) {
      return 'Activar gratis';
    }

    if (plan.trial_days > 0 && !trialAlreadyUsed) {
      return `Probar ${plan.trial_days} días`;
    }

    return 'Contratar';
  };

  const handleStartPlan = (plan: PartnerPlanRow) => {
    if (!actionPartnerId) return;

    if (!canStartNewPlan && (!currentPlan || getPlanTierFromRow(plan) !== getPlanTierFromRow(currentPlan))) {
      Alert.alert(
        'Plan activo',
        'Primero cancelá tu plan actual o esperá a que venza para contratar otro.'
      );
      return;
    }

    const planPrice = selectedBillingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
    const trialLabel = plan.trial_days > 0 && !trialAlreadyUsed
      ? `Incluye ${plan.trial_days} días de prueba.`
      : plan.trial_days > 0
        ? 'Ya utilizaste tu prueba en otro plan; este se cobrará desde el inicio.'
        : 'Este plan se cobrará desde el inicio.';

    Alert.alert(
      planPrice === 0 ? 'Activar plan gratis' : `Contratar ${plan.name}`,
      `${trialLabel}\n\n¿Querés continuar con Mercado Pago?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => createPartnerSubscription(plan),
        },
      ]
    );
  };

  const createPartnerSubscription = async (plan: PartnerPlanRow) => {
    try {
      setSubscribingPlanId(plan.id);

      const { data, error } = await supabaseClient.functions.invoke('create-partner-subscription', {
        body: {
          partnerId: actionPartnerId,
          planId: plan.id,
          billingCycle: selectedBillingCycle,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'PARTNER_SUBSCRIPTION_CREATE_FAILED');

      if (data.paymentUrl) {
        const canOpen = await Linking.canOpenURL(data.paymentUrl);
        if (!canOpen) {
          throw new Error('No se pudo abrir Mercado Pago en este dispositivo.');
        }
        await Linking.openURL(data.paymentUrl);
      } else {
        toast.success('Plan activado', 'El plan quedó activo.');
      }

      await loadData();
    } catch (error) {
      console.error('Error creating partner subscription:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'No se pudo iniciar la suscripción del aliado.'
      );
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const handleCancelCurrentSubscription = () => {
    if (!currentSubscription || !actionPartnerId) {
      return;
    }

    Alert.alert(
      'Cancelar plan',
      'La baja mantiene el acceso hasta el vencimiento actual si ya tiene días activos. ¿Querés continuar?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);

              const { data, error } = await supabaseClient.functions.invoke('cancel-partner-subscription', {
                body: {
                  partnerId: actionPartnerId,
                  subscriptionId: currentSubscription.id,
                },
              });

              if (error) throw error;
              if (!data?.success) throw new Error(data?.error || 'PARTNER_SUBSCRIPTION_CANCEL_FAILED');

              toast.success('Plan cancelado', 'La suscripción quedó cancelada.');
              await loadData();
            } catch (error) {
              console.error('Error cancelling partner subscription:', error);
              Alert.alert('Error', 'No se pudo cancelar la suscripción.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleContinuePayment = async () => {
    if (!currentSubscription?.payment_url) return;

    try {
      const canOpen = await Linking.canOpenURL(currentSubscription.payment_url);
      if (!canOpen) {
        throw new Error('No se pudo abrir Mercado Pago en este dispositivo.');
      }
      await Linking.openURL(currentSubscription.payment_url);
    } catch (error) {
      console.error('Error opening payment URL:', error);
      Alert.alert('Error', 'No se pudo abrir Mercado Pago.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Planes del aliado" onBack={handleGoBack} />
        <View style={styles.skeletonWrap} accessibilityLabel="Cargando planes">
          <SkeletonCard imageHeight={80} style={styles.skeletonCard} />
          <SkeletonCard imageHeight={160} style={styles.skeletonCard} />
          <SkeletonCard imageHeight={160} style={styles.skeletonCard} />
        </View>
      </SafeAreaView>
    );
  }

  if ((!partnerRows || partnerRows.length === 0) && !partner) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Planes del aliado" onBack={handleGoBack} />
        <EmptyState
          icon={<Shield size={32} color={colors.primary} />}
          title="No se encontró tu cuenta de aliado"
          description="Necesitamos al menos un negocio verificado para mostrar y contratar planes de aliado."
          actionLabel="Volver"
          onAction={handleGoBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Planes del aliado"
        subtitle={partnerRows.length > 1
          ? `${partnerRows.length} negocios vinculados`
          : partner?.business_name || 'Suscripción de tu cuenta de aliado'}
        onBack={handleGoBack}
        right={
          <IconButton
            icon={<RefreshCw size={20} color={colors.primary} />}
            onPress={loadData}
            accessibilityLabel="Actualizar planes"
          />
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {(getSingleParam(subscription_status) || getSingleParam(subscription_message)) && (
          <SubscriptionReturnBanner
            scope={subscription_scope}
            status={subscription_status}
            message={subscription_message}
          />
        )}

        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusIcon}>
              <Shield size={18} color={colors.primary} />
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>Estado actual</Text>
              <Text style={styles.statusText}>{currentStatusLabel}</Text>
            </View>
          </View>

          <View style={styles.statusDetails}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>Plan actual</Text>
              <Text style={styles.statusPillValue}>{currentPlan?.name || getPartnerPlan(currentPlanTier).name}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>Acceso hasta</Text>
              <Text style={styles.statusPillValue}>{currentAccessLabel}</Text>
            </View>
          </View>

          <Text style={styles.accountScopeText}>
            Este plan se aplica a toda tu cuenta de aliado{partnerRows.length > 1 ? ` y a tus ${partnerRows.length} negocios verificados` : ''}.
          </Text>

          {trialAlreadyUsed && (
            <View style={styles.noticeBox}>
              <Sparkles size={16} color={colors.warning} />
              <Text style={styles.noticeText}>
                Ya utilizaste una prueba gratuita en un plan de aliado. Vas a poder contratar otros planes, pero no volver a probar gratis.
              </Text>
            </View>
          )}

          {currentSubscription?.status === 'pending' && currentSubscription.payment_url && (
            <Button
              title="Continuar con Mercado Pago"
              onPress={handleContinuePayment}
              variant="outline"
              size="medium"
            />
          )}

          {hasCurrentAccess && currentSubscription?.status !== 'cancelled' && (
            <Button
              title={cancelling ? 'Cancelando...' : 'Dar de baja'}
              onPress={handleCancelCurrentSubscription}
              variant="outline"
              size="medium"
            />
          )}
        </Card>

        <Text style={styles.sectionTitle}>Planes disponibles</Text>

        <SegmentedControl<BillingCycle>
          options={[
            { value: 'monthly', label: 'Mensual' },
            { value: 'yearly', label: 'Anual' },
          ]}
          value={selectedBillingCycle}
          onChange={setSelectedBillingCycle}
          style={styles.cycleSelector}
        />

        {plans.map((plan) => {
          const planTier = getPlanTierFromRow(plan);
          const isCurrentPlan = currentPlan ? getPlanTierFromRow(plan) === getPlanTierFromRow(currentPlan) : false;
          const planDefinition = getPartnerPlan(planTier);
          const price = getPartnerPlanDisplayPrice(planTier, selectedBillingCycle);
          const isTrialAvailable = plan.trial_days > 0 && !trialAlreadyUsed;
          const actionLabel = getActionLabel(plan);
          const isDisabled = isCurrentPlan || (!canStartNewPlan && !isCurrentPlan);

          return (
            <Card key={plan.id} style={[styles.planCard, isCurrentPlan && styles.currentPlanCard]}>
              <View style={styles.planHeader}>
                <View style={[styles.planIcon, { backgroundColor: planDefinition.surface, borderColor: planDefinition.border }]}>
                  {planTier === 'pro' ? (
                    <Crown size={20} color={planDefinition.accent} />
                  ) : (
                    <DollarSign size={20} color={planDefinition.accent} />
                  )}
                </View>
                <View style={styles.planHeaderCopy}>
                  <View style={styles.planNameRow}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    {plan.is_recommended && <Badge label="Recomendado" tone="accent" size="small" />}
                  </View>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                </View>
              </View>

              <View style={styles.planMetaRow}>
                <View style={[styles.planLabelBadge, { backgroundColor: planDefinition.surface }]}>
                  <Text style={[styles.planLabelText, { color: planDefinition.accent }]}>
                    {plan.audience_target === 'partners' ? 'Aliados' : plan.audience_target === 'all' ? 'Todos' : 'Usuarios'}
                  </Text>
                </View>
                {plan.trial_days > 0 && (
                  <View style={styles.trialBadge}>
                    <Text style={styles.trialBadgeText}>
                      {isTrialAvailable ? `${plan.trial_days} días de prueba` : 'Prueba ya utilizada'}
                    </Text>
                  </View>
                )}
                {isCurrentPlan && <Badge label="Tu plan actual" tone="primary" size="small" icon={<Check size={12} color={colors.primary} />} />}
              </View>

              <View style={styles.priceBox}>
                <Text style={styles.priceLabel}>
                  {selectedBillingCycle === 'monthly' ? 'Precio mensual' : 'Precio anual'}
                </Text>
                <Text style={styles.priceValue}>{price}</Text>
              </View>

              <View style={styles.featuresBox}>
                <Text style={styles.featuresTitle}>Incluye</Text>
                {Array.isArray(plan.features) && plan.features.length > 0 ? (
                  plan.features.map((feature, index) => (
                    <View key={`${plan.id}-feature-${index}`} style={styles.featureRow}>
                      <Check size={14} color={colors.success} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyFeatureText}>No hay funcionalidades configuradas.</Text>
                )}

                {Array.isArray(plan.limitations) && plan.limitations.length > 0 && (
                  <View style={styles.limitationsBox}>
                    {plan.limitations.map((limitation, index) => (
                      <Text key={`${plan.id}-limitation-${index}`} style={styles.limitationText}>
                        • {limitation}
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.planLimitsBox}>
                <Text style={styles.planLimitsTitle}>Límites del plan</Text>
                {buildPartnerLimitSummary(resolveSubscriptionPlanLimits(plan).partners).map((limit) => (
                  <View key={`${plan.id}-limit-${limit.label}`} style={styles.planLimitRow}>
                    <Text style={styles.planLimitLabel}>{limit.label}</Text>
                    <Text style={styles.planLimitValue}>{limit.value}</Text>
                  </View>
                ))}
              </View>

              <Button
                title={isCurrentPlan ? 'Ya tenés este plan' : actionLabel}
                onPress={() => handleStartPlan(plan)}
                variant={isCurrentPlan ? 'outline' : 'primary'}
                size="large"
                disabled={isDisabled || subscribingPlanId === plan.id}
              />
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    marginTop: 3,
    ...typography.captionStrong,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  statusCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  statusCopy: {
    flex: 1,
  },
  statusTitle: {
    ...typography.captionStrong,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  statusText: {
    marginTop: spacing.xs,
    ...typography.bodyStrong,
    color: colors.text,
  },
  statusDetails: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md,
  },
  accountScopeText: {
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  statusPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  statusPillLabel: {
    ...typography.captionStrong,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  statusPillValue: {
    marginTop: spacing.xs,
    ...typography.label,
    color: colors.text,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeText: {
    flex: 1,
    ...typography.label,
    color: colors.warning,
  },
  cycleSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cycleChip: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cycleChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cycleChipText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  cycleChipTextSelected: {
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.md,
  },
  planCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  currentPlanCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primarySoft,
  },
  skeletonWrap: {
    padding: spacing.lg,
  },
  skeletonCard: {
    marginBottom: spacing.lg,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: spacing.md,
  },
  planHeaderCopy: {
    flex: 1,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  planName: {
    ...typography.heading,
    color: colors.text,
  },
  recommendedBadge: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
  },
  recommendedBadgeText: {
    ...typography.captionStrong,
    color: colors.warning,
  },
  planDescription: {
    marginTop: spacing.xs,
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  planMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  planLabelBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planLabelText: {
    ...typography.captionStrong,
  },
  trialBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trialBadgeText: {
    ...typography.captionStrong,
    color: colors.primaryStrong,
  },
  currentBadge: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  currentBadgeText: {
    ...typography.captionStrong,
    color: colors.success,
  },
  priceBox: {
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    padding: 14,
    marginBottom: spacing.md,
  },
  priceLabel: {
    ...typography.captionStrong,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  priceValue: {
    marginTop: spacing.xs,
    ...typography.title,
    color: colors.text,
  },
  featuresBox: {
    marginBottom: 14,
  },
  featuresTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featureText: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyFeatureText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  limitationsBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  limitationText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  planLimitsBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  planLimitsTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  planLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  planLimitLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  planLimitValue: {
    ...typography.captionStrong,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  placeholder: {
    width: 38,
    height: 38,
  },
});
