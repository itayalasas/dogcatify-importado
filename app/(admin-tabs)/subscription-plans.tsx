import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, Switch, ActivityIndicator } from 'react-native';
import { ArrowLeft, Check, Crown, Edit, Link as LinkIcon, Lock, RefreshCw, Shield, Sparkles, Star } from 'lucide-react-native';
import { router } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

type PlanTier = 'free' | 'standard' | 'premium';
type EntitlementKey =
  | 'pet_profiles'
  | 'shop_services'
  | 'orders_bookings_history'
  | 'basic_notifications'
  | 'medical_reminders'
  | 'appointment_reminders'
  | 'promo_personalization'
  | 'priority_support'
  | 'multi_pet_advanced'
  | 'advanced_health_reports'
  | 'medical_history_sharing'
  | 'early_access';

interface Entitlement {
  key: EntitlementKey;
  title: string;
  description: string;
  category: 'Mascotas' | 'Salud' | 'Compras' | 'Soporte' | 'Plataforma';
  target: string;
}

interface SubscriptionPlan {
  id: string;
  tier: PlanTier;
  name: string;
  label: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  entitlementKeys: EntitlementKey[];
  audience: string;
  is_active: boolean;
  is_default?: boolean;
  is_recommended?: boolean;
  mercadopago_monthly_plan_id?: string | null;
  mercadopago_yearly_plan_id?: string | null;
  mercadopago_monthly_init_point?: string | null;
  mercadopago_yearly_init_point?: string | null;
  mercadopago_monthly_status?: string | null;
  mercadopago_yearly_status?: string | null;
  mercadopago_last_sync_at?: string | null;
  mercadopago_sync_error?: string | null;
  mercadopago_metadata?: Record<string, any> | null;
  sort_order?: number;
}

const ENTITLEMENTS: Entitlement[] = [
  {
    key: 'pet_profiles',
    title: 'Perfiles de mascotas',
    description: 'Crear y gestionar fichas basicas de mascotas.',
    category: 'Mascotas',
    target: 'app/(tabs)/pets.tsx, app/pets/add.tsx',
  },
  {
    key: 'shop_services',
    title: 'Tienda y servicios',
    description: 'Comprar productos y reservar servicios activos.',
    category: 'Compras',
    target: 'app/(tabs)/shop.tsx, app/services/booking.tsx',
  },
  {
    key: 'orders_bookings_history',
    title: 'Historial basico',
    description: 'Ver pedidos, reservas y estado de transacciones.',
    category: 'Compras',
    target: 'app/orders/index.tsx, app/orders/[id].tsx',
  },
  {
    key: 'basic_notifications',
    title: 'Notificaciones esenciales',
    description: 'Avisos operativos de reservas, pedidos y cuenta.',
    category: 'Plataforma',
    target: 'contexts/NotificationContext.tsx',
  },
  {
    key: 'medical_reminders',
    title: 'Recordatorios medicos',
    description: 'Alertas de vacunas, desparasitacion, alergias y tratamientos.',
    category: 'Salud',
    target: 'app/pets/health/*, medical_alerts',
  },
  {
    key: 'appointment_reminders',
    title: 'Recordatorios de citas',
    description: 'Seguimiento de agenda y proximas reservas.',
    category: 'Salud',
    target: 'app/pets/appointments/[id].tsx, app/services/booking/[serviceId].tsx',
  },
  {
    key: 'promo_personalization',
    title: 'Promociones personalizadas',
    description: 'Mayor visibilidad de promociones segun actividad y mascotas.',
    category: 'Compras',
    target: 'app/(tabs)/index.tsx, app/(admin-tabs)/promotions.tsx',
  },
  {
    key: 'priority_support',
    title: 'Soporte prioritario',
    description: 'Prioridad en flujos de ayuda y atencion digital.',
    category: 'Soporte',
    target: 'app/profile/help-support.tsx',
  },
  {
    key: 'multi_pet_advanced',
    title: 'Gestion multipet avanzada',
    description: 'Herramientas ampliadas para usuarios con varias mascotas.',
    category: 'Mascotas',
    target: 'app/(tabs)/pets.tsx, components/PetCard.tsx',
  },
  {
    key: 'advanced_health_reports',
    title: 'Reportes de salud',
    description: 'Tendencias, PDFs e historial medico enriquecido.',
    category: 'Salud',
    target: 'utils/medicalHistoryPDF.ts, app/medical-history/[id].tsx',
  },
  {
    key: 'medical_history_sharing',
    title: 'Compartir historial medico',
    description: 'Links temporales y vista externa del historial de una mascota.',
    category: 'Salud',
    target: 'app/pets/share-medical-history.tsx, utils/medicalHistoryTokens.ts',
  },
  {
    key: 'early_access',
    title: 'Acceso anticipado',
    description: 'Habilita funciones nuevas antes del despliegue general.',
    category: 'Plataforma',
    target: 'feature_flags / remote config',
  },
];

const TIER_STYLES: Record<PlanTier, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  free: {
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    icon: <Shield size={22} color="#2563EB" />,
  },
  standard: {
    color: '#047857',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: <Star size={22} color="#047857" />,
  },
  premium: {
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    icon: <Crown size={22} color="#7C3AED" />,
  },
};

const ENTITLEMENT_KEYS = ENTITLEMENTS.map((entitlement) => entitlement.key);
const SYNC_TIMEOUT_MS = 35000;

const createSyncTraceId = (planId: string) =>
  `plan-sync-${planId.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const withTimeout = (promise: Promise<any>, timeoutMs: number, traceId: string) =>
  new Promise<any>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`SYNC_TIMEOUT:${traceId}`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

const isEntitlementKey = (value: unknown): value is EntitlementKey =>
  typeof value === 'string' && ENTITLEMENT_KEYS.includes(value as EntitlementKey);

const getEntitlementsForPlan = (plan: SubscriptionPlan) =>
  ENTITLEMENTS.filter((entitlement) => plan.entitlementKeys.includes(entitlement.key));

const getFeatureTitles = (keys: EntitlementKey[]) =>
  ENTITLEMENTS
    .filter((entitlement) => keys.includes(entitlement.key))
    .map((entitlement) => entitlement.title);

const getMpSyncStatus = (plan: SubscriptionPlan) => {
  const lastStatus = String(plan.mercadopago_metadata?.last_sync_status || '').toLowerCase();
  const requiresMp = plan.price_monthly > 0 || plan.price_yearly > 0;
  const hasAnyMpPlan = !!plan.mercadopago_monthly_plan_id || !!plan.mercadopago_yearly_plan_id;

  if (!requiresMp) {
    return { label: 'No requiere MP', bg: '#E0F2FE', color: '#075985' };
  }

  if (plan.mercadopago_sync_error || lastStatus === 'failed') {
    return { label: 'Error de sync', bg: '#FEE2E2', color: '#991B1B' };
  }

  if (lastStatus === 'pending_local_changes') {
    return { label: 'Pendiente sync', bg: '#FEF3C7', color: '#92400E' };
  }

  if (lastStatus === 'synced' || plan.mercadopago_metadata?.last_sync_success === true || plan.mercadopago_last_sync_at) {
    return { label: 'Sincronizado', bg: '#D1FAE5', color: '#065F46' };
  }

  if (hasAnyMpPlan) {
    return { label: 'Pendiente sync', bg: '#FEF3C7', color: '#92400E' };
  }

  return { label: 'Sin conectar', bg: '#F3F4F6', color: '#4B5563' };
};

const inferTier = (row: any): PlanTier => {
  const rawTier = String(row?.tier || '').toLowerCase();
  if (rawTier === 'free' || rawTier === 'standard' || rawTier === 'premium') {
    return rawTier;
  }

  const name = String(row?.name || '').toLowerCase();
  if (name.includes('free')) return 'free';
  if (name.includes('premium') || name.includes('pro')) return 'premium';
  return 'standard';
};

const normalizePlan = (row: any): SubscriptionPlan => {
  const tier = inferTier(row);
  const entitlementKeys = Array.isArray(row?.entitlement_keys)
    ? row.entitlement_keys.filter(isEntitlementKey)
    : [];

  return {
    id: row.id,
    tier,
    name: row.name || '',
    label: row.label || (tier === 'free' ? 'Por defecto' : tier === 'premium' ? 'Avanzado' : 'Intermedio'),
    description: row.description || '',
    price_monthly: Number(row.price_monthly || 0),
    price_yearly: Number(row.price_yearly || 0),
    currency: row.currency || 'UYU',
    entitlementKeys,
    audience: row.audience || '',
    is_active: row.is_active !== false,
    is_default: row.is_default === true || tier === 'free',
    is_recommended: row.is_recommended === true,
    mercadopago_monthly_plan_id: row.mercadopago_monthly_plan_id || null,
    mercadopago_yearly_plan_id: row.mercadopago_yearly_plan_id || null,
    mercadopago_monthly_init_point: row.mercadopago_monthly_init_point || null,
    mercadopago_yearly_init_point: row.mercadopago_yearly_init_point || null,
    mercadopago_monthly_status: row.mercadopago_monthly_status || null,
    mercadopago_yearly_status: row.mercadopago_yearly_status || null,
    mercadopago_last_sync_at: row.mercadopago_last_sync_at || null,
    mercadopago_sync_error: row.mercadopago_sync_error || null,
    mercadopago_metadata: row.mercadopago_metadata || null,
    sort_order: Number(row.sort_order || 0),
  };
};

export default function SubscriptionPlans() {
  const { currentUser } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingPlanId, setSyncingPlanId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    currency: 'UYU',
    entitlementKeys: [] as EntitlementKey[],
    audience: '',
    is_active: true,
    mercadopago_monthly_plan_id: '',
    mercadopago_yearly_plan_id: '',
  });

  const isAdmin = currentUser?.isAdmin || currentUser?.email?.toLowerCase() === 'admin@dogcatify.com';

  useEffect(() => {
    if (isAdmin) {
      loadPlans();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadPlans = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabaseClient
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setPlans((data || []).map(normalizePlan));
    } catch (error) {
      console.error('Error loading subscription plans:', error);
      Alert.alert('Error', 'No se pudieron cargar los planes.');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (plan: SubscriptionPlan, cadence: 'monthly' | 'yearly') => {
    const value = cadence === 'monthly' ? plan.price_monthly : plan.price_yearly;
    return value === 0 ? 'Gratis' : `$${value.toFixed(2)} ${plan.currency}`;
  };

  const getMpStatusLabel = (status?: string | null) => {
    if (!status) return 'Sin conectar';
    if (status === 'active') return 'Activo en MP';
    if (status === 'cancelled' || status === 'canceled') return 'Cancelado en MP';
    return status;
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      label: plan.label,
      description: plan.description,
      price_monthly: plan.price_monthly.toString(),
      price_yearly: plan.price_yearly.toString(),
      currency: plan.currency,
      entitlementKeys: plan.entitlementKeys,
      audience: plan.audience,
      is_active: plan.is_active,
      mercadopago_monthly_plan_id: plan.mercadopago_monthly_plan_id || '',
      mercadopago_yearly_plan_id: plan.mercadopago_yearly_plan_id || '',
    });
    setShowEditModal(true);
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;

    if (!formData.name.trim() || !formData.description.trim()) {
      Alert.alert('Error', 'Completa al menos el nombre y la descripcion del plan');
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();
      const mpRelevantChanged =
        editingPlan.price_monthly !== (Number(formData.price_monthly) || 0) ||
        editingPlan.price_yearly !== (Number(formData.price_yearly) || 0) ||
        editingPlan.currency !== (formData.currency.trim().toUpperCase() || 'UYU') ||
        (editingPlan.mercadopago_monthly_plan_id || '') !== formData.mercadopago_monthly_plan_id.trim() ||
        (editingPlan.mercadopago_yearly_plan_id || '') !== formData.mercadopago_yearly_plan_id.trim();

      const updatePayload = {
        name: formData.name.trim(),
        label: formData.label.trim() || editingPlan.label,
        description: formData.description.trim(),
        price_monthly: Number(formData.price_monthly) || 0,
        price_yearly: Number(formData.price_yearly) || 0,
        currency: formData.currency.trim().toUpperCase() || 'UYU',
        audience: formData.audience.trim(),
        entitlement_keys: formData.entitlementKeys,
        features: getFeatureTitles(formData.entitlementKeys),
        is_active: editingPlan.is_default ? true : formData.is_active,
        mercadopago_monthly_plan_id: formData.mercadopago_monthly_plan_id.trim() || null,
        mercadopago_yearly_plan_id: formData.mercadopago_yearly_plan_id.trim() || null,
        ...(mpRelevantChanged ? {
          mercadopago_sync_error: null,
          mercadopago_metadata: {
            ...(editingPlan.mercadopago_metadata || {}),
            last_sync_status: 'pending_local_changes',
            last_sync_success: false,
            last_local_mp_edit_at: now,
          },
        } : {}),
        updated_at: now,
      };

      const { data, error } = await supabaseClient
        .from('subscription_plans')
        .update(updatePayload)
        .eq('id', editingPlan.id)
        .select('*')
        .single();

      if (error) throw error;

      const nextPlan = normalizePlan(data);
      setPlans((current) => current.map((plan) => (plan.id === editingPlan.id ? nextPlan : plan)));
      setShowEditModal(false);
      Alert.alert('Plan guardado', 'Los permisos quedaron guardados. Si cambiaste IDs de Mercado Pago, sincroniza el plan.');
    } catch (error) {
      console.error('Error saving subscription plan:', error);
      Alert.alert('Error', 'No se pudo guardar el plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    if (plan.is_default) {
      Alert.alert('Plan por defecto', 'Free queda siempre activo porque es el plan base de todos los usuarios.');
      return;
    }

    const nextActive = !plan.is_active;
    const previousPlans = plans;

    setPlans((current) =>
      current.map((item) =>
        item.id === plan.id ? { ...item, is_active: nextActive } : item
      )
    );

    try {
      const { error } = await supabaseClient
        .from('subscription_plans')
        .update({
          is_active: nextActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plan.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling subscription plan:', error);
      setPlans(previousPlans);
      Alert.alert('Error', 'No se pudo actualizar la visibilidad del plan.');
    }
  };

  const handleSyncPlan = async (plan: SubscriptionPlan) => {
    const traceId = createSyncTraceId(plan.id);
    const startedAt = Date.now();

    try {
      setSyncingPlanId(plan.id);

      console.log(`[SubscriptionPlans][${traceId}] Starting Mercado Pago sync`, {
        planId: plan.id,
        planName: plan.name,
        monthlyMpPlanId: plan.mercadopago_monthly_plan_id,
        yearlyMpPlanId: plan.mercadopago_yearly_plan_id,
        priceMonthly: plan.price_monthly,
        priceYearly: plan.price_yearly,
        currency: plan.currency,
        timeoutMs: SYNC_TIMEOUT_MS,
      });

      const invokePromise = supabaseClient.functions.invoke('sync-subscription-plan', {
        headers: {
          'x-dogcatify-trace-id': traceId,
        },
        body: {
          planId: plan.id,
          mode: 'import',
          traceId,
        },
      });

      const { data, error } = await withTimeout(invokePromise, SYNC_TIMEOUT_MS, traceId);

      console.log(`[SubscriptionPlans][${traceId}] Sync function response`, {
        durationMs: Date.now() - startedAt,
        hasError: !!error,
        error,
        data,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'SYNC_FAILED');

      const syncedPlan = normalizePlan(data.plan);
      setPlans((current) => current.map((item) => (item.id === plan.id ? syncedPlan : item)));

      Alert.alert(
        'Mercado Pago sincronizado',
        `El plan local quedo conectado con los datos actuales de Mercado Pago.\n\nTrace: ${data.traceId || traceId}`
      );
    } catch (error: any) {
      const message = error?.message || 'No se pudo sincronizar el plan con Mercado Pago.';
      const timedOut = String(message).startsWith('SYNC_TIMEOUT');

      console.error(`[SubscriptionPlans][${traceId}] Error syncing plan with Mercado Pago`, {
        durationMs: Date.now() - startedAt,
        timedOut,
        error,
      });

      await loadPlans();

      Alert.alert(
        timedOut ? 'Sin respuesta de sincronizacion' : 'Error de sincronizacion',
        timedOut
          ? `La sincronizacion supero ${Math.round(SYNC_TIMEOUT_MS / 1000)} segundos. Revisa los logs de la Edge Function con este trace:\n\n${traceId}`
          : `${message}\n\nTrace: ${traceId}`
      );
    } finally {
      console.log(`[SubscriptionPlans][${traceId}] Sync finished, clearing loading state`, {
        durationMs: Date.now() - startedAt,
      });
      setSyncingPlanId(null);
    }
  };

  const handleToggleEntitlement = (key: EntitlementKey) => {
    setFormData((current) => {
      const exists = current.entitlementKeys.includes(key);
      return {
        ...current,
        entitlementKeys: exists
          ? current.entitlementKeys.filter((item) => item !== key)
          : [...current.entitlementKeys, key],
      };
    });
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedTitle}>Acceso Denegado</Text>
          <Text style={styles.accessDeniedText}>No tienes permisos para acceder a esta seccion</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Gestion de Planes</Text>
        <TouchableOpacity onPress={loadPlans} style={styles.iconButton} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#2D6A6F" /> : <RefreshCw size={21} color="#111827" />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryBand}>
          <View style={styles.summaryIcon}>
            <Sparkles size={22} color="#2D6A6F" />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>Planes conectados a Mercado Pago</Text>
            <Text style={styles.summaryText}>
              DogCatiFy guarda permisos y visibilidad; Mercado Pago mantiene el plan recurrente, precio, link de checkout y estado de cobro.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2D6A6F" />
            <Text style={styles.loadingText}>Cargando planes...</Text>
          </View>
        ) : plans.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay planes configurados</Text>
            <Text style={styles.emptyText}>Aplica la migracion de planes o crea los planes base en Supabase.</Text>
          </Card>
        ) : (
          plans.map((plan) => {
            const tier = TIER_STYLES[plan.tier];
            const entitlements = getEntitlementsForPlan(plan);
            const syncing = syncingPlanId === plan.id;
            const mpSyncStatus = getMpSyncStatus(plan);

            return (
              <Card key={plan.id} style={[styles.planCard, { borderColor: tier.border }, !plan.is_active && styles.inactivePlanCard] as any}>
                <View style={styles.planHeader}>
                  <View style={[styles.planIcon, { backgroundColor: tier.bg }]}>
                    {tier.icon}
                  </View>

                  <View style={styles.planMain}>
                    <View style={styles.planNameRow}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      {plan.is_recommended && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedBadgeText}>Recomendado</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.planDescription}>{plan.description}</Text>
                  </View>
                </View>

                <View style={styles.planMetaRow}>
                  <View style={[styles.planLabelBadge, { backgroundColor: tier.bg }]}>
                    <Text style={[styles.planLabelText, { color: tier.color }]}>{plan.label}</Text>
                  </View>
                  <View style={plan.is_active ? styles.activeBadge : styles.inactiveBadge}>
                    <Text style={plan.is_active ? styles.activeBadgeText : styles.inactiveBadgeText}>
                      {plan.is_active ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
                </View>

                <View style={styles.audienceBox}>
                  <Text style={styles.audienceLabel}>Enfocado en</Text>
                  <Text style={styles.audienceText}>{plan.audience || 'Sin audiencia definida'}</Text>
                </View>

                <View style={styles.priceSection}>
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>Mensual</Text>
                    <Text style={styles.priceValue}>{formatPrice(plan, 'monthly')}</Text>
                  </View>
                  <View style={styles.priceDivider} />
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>Anual</Text>
                    <Text style={styles.priceValue}>{formatPrice(plan, 'yearly')}</Text>
                  </View>
                </View>

                <View style={styles.mpSection}>
                  <View style={styles.mpSectionHeader}>
                    <LinkIcon size={16} color="#2D6A6F" />
                    <Text style={styles.mpSectionTitle}>Mercado Pago</Text>
                    <View style={[styles.mpSyncBadge, { backgroundColor: mpSyncStatus.bg }]}>
                      <Text style={[styles.mpSyncBadgeText, { color: mpSyncStatus.color }]}>
                        {mpSyncStatus.label}
                      </Text>
                    </View>
                    {plan.mercadopago_last_sync_at && (
                      <Text style={styles.mpSyncDate}>
                        {new Date(plan.mercadopago_last_sync_at).toLocaleString()}
                      </Text>
                    )}
                  </View>

                  <View style={styles.mpRows}>
                    <View style={styles.mpRow}>
                      <Text style={styles.mpRowLabel}>Mensual</Text>
                      <Text style={styles.mpRowValue} numberOfLines={1}>
                        {plan.mercadopago_monthly_plan_id || 'Sin plan'}
                      </Text>
                      <Text style={styles.mpStatusText}>{getMpStatusLabel(plan.mercadopago_monthly_status)}</Text>
                    </View>
                    <View style={styles.mpRow}>
                      <Text style={styles.mpRowLabel}>Anual</Text>
                      <Text style={styles.mpRowValue} numberOfLines={1}>
                        {plan.mercadopago_yearly_plan_id || 'Sin plan'}
                      </Text>
                      <Text style={styles.mpStatusText}>{getMpStatusLabel(plan.mercadopago_yearly_status)}</Text>
                    </View>
                  </View>

                  {plan.mercadopago_sync_error && (
                    <Text style={styles.mpErrorText}>{plan.mercadopago_sync_error}</Text>
                  )}
                  {plan.mercadopago_metadata?.last_sync_trace_id && (
                    <Text style={styles.mpTraceText} numberOfLines={1}>
                      Trace: {plan.mercadopago_metadata.last_sync_trace_id}
                    </Text>
                  )}
                </View>

                <View style={styles.featuresSection}>
                  <Text style={styles.featuresTitle}>Funcionalidades habilitadas</Text>
                  {entitlements.map((entitlement) => (
                    <View key={entitlement.key} style={styles.entitlementRow}>
                      <View style={[styles.entitlementIcon, { backgroundColor: tier.bg }]}>
                        <Check size={15} color={tier.color} />
                      </View>
                      <View style={styles.entitlementCopy}>
                        <View style={styles.entitlementTitleRow}>
                          <Text style={styles.entitlementTitle}>{entitlement.title}</Text>
                          <Text style={[styles.entitlementCategory, { color: tier.color }]}>{entitlement.category}</Text>
                        </View>
                        <Text style={styles.entitlementDescription}>{entitlement.description}</Text>
                        <Text style={styles.entitlementTarget}>{entitlement.target}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.lockHint}>
                  <Lock size={14} color="#6B7280" />
                  <Text style={styles.lockHintText}>
                    Las funcionalidades no incluidas se bloquearian con upgrade prompt.
                  </Text>
                </View>

                <View style={styles.actionsContainer}>
                  <TouchableOpacity style={styles.secondaryAction} onPress={() => handleEditPlan(plan)}>
                    <Edit size={16} color="#2D6A6F" />
                    <Text style={styles.secondaryActionText}>Editar permisos</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryAction, syncing && styles.disabledAction]}
                    onPress={() => handleSyncPlan(plan)}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color="#2D6A6F" />
                    ) : (
                      <RefreshCw size={16} color="#2D6A6F" />
                    )}
                    <Text style={styles.secondaryActionText}>{syncing ? 'Sincronizando...' : 'Sincronizar MP'}</Text>
                  </TouchableOpacity>

                  <View style={styles.toggleAction}>
                    <Text style={styles.toggleLabel}>{plan.is_default ? 'Siempre activo' : 'Visible'}</Text>
                    <Switch
                      value={plan.is_active}
                      onValueChange={() => handleToggleActive(plan)}
                      disabled={plan.is_default}
                      trackColor={{ false: '#E5E7EB', true: tier.border }}
                      thumbColor={plan.is_active ? tier.color : '#FFFFFF'}
                    />
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Editar permisos: {editingPlan?.name}</Text>

              <Input
                label="Nombre del plan"
                value={formData.name}
                onChangeText={(value) => setFormData({ ...formData, name: value })}
                placeholder="Ej: STANDARD / PLUS"
              />

              <Input
                label="Etiqueta"
                value={formData.label}
                onChangeText={(value) => setFormData({ ...formData, label: value })}
                placeholder="Ej: Intermedio"
              />

              <Input
                label="Descripcion"
                value={formData.description}
                onChangeText={(value) => setFormData({ ...formData, description: value })}
                placeholder="Descripcion del plan"
                multiline
                numberOfLines={2}
              />

              <Input
                label="Enfocado en"
                value={formData.audience}
                onChangeText={(value) => setFormData({ ...formData, audience: value })}
                placeholder="Ej: Usuarios frecuentes"
              />

              <View style={styles.priceInputsRow}>
                <Input
                  label="Mensual"
                  value={formData.price_monthly}
                  onChangeText={(value) => setFormData({ ...formData, price_monthly: value })}
                  placeholder="299"
                  keyboardType="numeric"
                  style={styles.priceInput}
                />
                <Input
                  label="Anual"
                  value={formData.price_yearly}
                  onChangeText={(value) => setFormData({ ...formData, price_yearly: value })}
                  placeholder="2990"
                  keyboardType="numeric"
                  style={styles.priceInput}
                />
                <Input
                  label="Moneda"
                  value={formData.currency}
                  onChangeText={(value) => setFormData({ ...formData, currency: value })}
                  placeholder="UYU"
                  autoCapitalize="characters"
                  style={styles.currencyInput}
                />
              </View>

              <View style={styles.mpModalBox}>
                <Text style={styles.inputLabel}>Planes registrados en Mercado Pago</Text>
                <Text style={styles.mpModalText}>
                  Si ya existen en Mercado Pago, pega los IDs y luego usa Sincronizar MP para importar precio, link y estado. Si los dejas vacios, la sincronizacion creara los planes pagos.
                </Text>
                <Input
                  label="ID Mercado Pago mensual"
                  value={formData.mercadopago_monthly_plan_id}
                  onChangeText={(value) => setFormData({ ...formData, mercadopago_monthly_plan_id: value })}
                  placeholder="2c938084..."
                  autoCapitalize="none"
                />
                <Input
                  label="ID Mercado Pago anual"
                  value={formData.mercadopago_yearly_plan_id}
                  onChangeText={(value) => setFormData({ ...formData, mercadopago_yearly_plan_id: value })}
                  placeholder="2c938084..."
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Permisos de funcionalidad</Text>
                {ENTITLEMENTS.map((entitlement) => {
                  const enabled = formData.entitlementKeys.includes(entitlement.key);
                  return (
                    <TouchableOpacity
                      key={entitlement.key}
                      style={[styles.permissionOption, enabled && styles.permissionOptionSelected]}
                      onPress={() => handleToggleEntitlement(entitlement.key)}
                    >
                      <View style={enabled ? styles.permissionCheckOn : styles.permissionCheckOff}>
                        {enabled && <Check size={13} color="#FFFFFF" />}
                      </View>
                      <View style={styles.permissionCopy}>
                        <Text style={styles.permissionTitle}>{entitlement.title}</Text>
                        <Text style={styles.permissionDescription}>{entitlement.description}</Text>
                        <Text style={styles.permissionTarget}>{entitlement.target}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!editingPlan?.is_default && (
                <View style={styles.modalSwitchRow}>
                  <Text style={styles.modalSwitchLabel}>Plan visible para usuarios</Text>
                  <Switch
                    value={formData.is_active}
                    onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                    trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
                    thumbColor={formData.is_active ? '#047857' : '#FFFFFF'}
                  />
                </View>
              )}

              <View style={styles.modalActions}>
                <Button
                  title="Cancelar"
                  onPress={() => setShowEditModal(false)}
                  variant="outline"
                  size="medium"
                  style={styles.modalButton}
                  disabled={saving}
                />
                <Button
                  title="Guardar cambios"
                  onPress={handleSavePlan}
                  variant="primary"
                  size="medium"
                  style={styles.modalButton}
                  loading={saving}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  iconButton: {
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
  content: {
    flex: 1,
    padding: 16,
  },
  summaryBand: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCE6E7',
    padding: 16,
    marginBottom: 16,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E6F2F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 19,
  },
  loadingBox: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 12,
  },
  emptyCard: {
    padding: 18,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 19,
  },
  planCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  inactivePlanCard: {
    opacity: 0.68,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  planMain: {
    flex: 1,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  planName: {
    fontSize: 19,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  recommendedBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recommendedBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
  },
  planDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 19,
  },
  planMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  planLabelBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planLabelText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#065F46',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inactiveBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#991B1B',
  },
  audienceBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  audienceLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  audienceText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    marginBottom: 14,
  },
  priceItem: {
    flex: 1,
    alignItems: 'center',
  },
  priceDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  mpSection: {
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    padding: 12,
    marginBottom: 14,
  },
  mpSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 7,
  },
  mpSectionTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#134E4A',
  },
  mpSyncBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mpSyncBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
  },
  mpSyncDate: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#0F766E',
  },
  mpRows: {
    gap: 8,
  },
  mpRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
  },
  mpRowLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#0F766E',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  mpRowValue: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginBottom: 3,
  },
  mpStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
  },
  mpErrorText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#991B1B',
    marginTop: 8,
  },
  mpTraceText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#0F766E',
    marginTop: 6,
  },
  featuresSection: {
    marginBottom: 12,
  },
  featuresTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 10,
  },
  entitlementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  entitlementIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  entitlementCopy: {
    flex: 1,
  },
  entitlementTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  entitlementTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  entitlementCategory: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
  },
  entitlementDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 17,
    marginTop: 3,
  },
  entitlementTarget: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  lockHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  lockHintText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    marginLeft: 8,
    lineHeight: 17,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D6A6F',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexGrow: 1,
    flexBasis: 140,
  },
  disabledAction: {
    opacity: 0.65,
  },
  secondaryActionText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
    marginLeft: 6,
  },
  toggleAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#DC2626',
    marginBottom: 12,
  },
  accessDeniedText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 20,
  },
  priceInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInput: {
    flex: 1,
  },
  currencyInput: {
    width: 76,
  },
  mpModalBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  mpModalText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#0F766E',
    lineHeight: 18,
    marginBottom: 12,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  permissionOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  permissionOptionSelected: {
    borderColor: '#2D6A6F',
    backgroundColor: '#F0FDFA',
  },
  permissionCheckOn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2D6A6F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  permissionCheckOff: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginRight: 10,
    marginTop: 2,
  },
  permissionCopy: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  permissionDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 17,
    marginTop: 3,
  },
  permissionTarget: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  modalSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  modalSwitchLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
  },
});
