import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { Building, Settings, Calendar, Package, Heart } from 'lucide-react-native';
import { Card, Button, AppText, Badge, IconButton, EmptyState, ScreenHeader, SkeletonList, toast } from '../../components/ui';
import { BusinessTypeAvatar } from '../../components/partner/BusinessTypeAvatar';
import { colors, radius, spacing, touchTarget } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { router } from 'expo-router';
import {
  canAccessPartnerModule,
  getPartnerLockedActionLabel,
  getPartnerPlan,
  getPartnerPlanBadgeText,
  getPartnerSubscriptionStatusLabel,
  normalizePartnerPlanTier,
  resolvePartnerPlanTier,
} from '../../utils/partnerPlans';
import { setStoredActivePartnerBusinessId } from '../../utils/onboarding';

interface Business {
  id: string;
  businessName: string;
  businessType: 'veterinary' | 'grooming' | 'walking' | 'boarding' | 'shop' | 'shelter';
  isVerified: boolean;
  isActive: boolean;
  subscriptionPlanTier: string;
  subscriptionPlanStatus: string;
  subscriptionPlanExpiresAt?: string | null;
  features: {
    agenda?: boolean;
    products?: boolean;
    adoptions?: boolean;
  };
}

type AccountSubscriptionSummary = {
  subscriptionPlanTier: string;
  subscriptionPlanStatus: string | null;
  subscriptionPlanExpiresAt: string | null;
};

const PARTNER_PLAN_ORDER: ('starter' | 'growth' | 'pro')[] = ['starter', 'growth', 'pro'];

const isCurrentPartnerSubscription = (status?: string | null, expiresAt?: string | null) => {
  const normalizedStatus = String(status || '').toLowerCase();
  const expiresTimestamp = expiresAt ? new Date(expiresAt).getTime() : null;
  const hasFutureAccess = expiresTimestamp !== null && !Number.isNaN(expiresTimestamp) && expiresTimestamp > Date.now();

  return (
    normalizedStatus === 'pending' ||
    normalizedStatus === 'trialing' ||
    normalizedStatus === 'active' ||
    normalizedStatus === 'paused' ||
    (normalizedStatus === 'cancelled' && hasFutureAccess)
  );
};

const resolveAccountSubscriptionFromBusinesses = (partners: Business[]): AccountSubscriptionSummary | null => {
  if (!partners.length) {
    return null;
  }

  const ranked = partners.map((row) => {
    const resolvedTier = resolvePartnerPlanTier(
      row.subscriptionPlanTier,
      row.subscriptionPlanStatus,
      row.subscriptionPlanExpiresAt,
    ) as 'starter' | 'growth' | 'pro';

    return {
      row,
      resolvedTier,
      resolvedIndex: PARTNER_PLAN_ORDER.indexOf(resolvedTier),
      isCurrent: isCurrentPartnerSubscription(row.subscriptionPlanStatus, row.subscriptionPlanExpiresAt),
    };
  });

  const currentRows = ranked.some((item) => item.isCurrent)
    ? ranked.filter((item) => item.isCurrent)
    : ranked;

  const best = currentRows.reduce((winner, item) => {
    if (!winner) return item;
    if (item.resolvedIndex > winner.resolvedIndex) return item;
    return winner;
  }, null as typeof ranked[number] | null);

  if (!best) {
    return null;
  }

  return {
    subscriptionPlanTier: best.resolvedTier,
    subscriptionPlanStatus: best.row.subscriptionPlanStatus || null,
    subscriptionPlanExpiresAt: best.row.subscriptionPlanExpiresAt || null,
  };
};

export default function BusinessSelector() {
  const { currentUser } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchBusinesses = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('is_verified', true);
        
        if (error) throw error;
        
        const businessData = data?.map(partner => ({
          id: partner.id,
          businessName: partner.business_name,
          businessType: partner.business_type,
          isVerified: partner.is_verified,
          isActive: partner.is_active,
          subscriptionPlanTier: partner.subscription_plan_tier || 'starter',
          subscriptionPlanStatus: partner.subscription_plan_status || 'active',
          subscriptionPlanExpiresAt: partner.subscription_plan_expires_at || null,
          features: partner.features || {}
        })) as Business[];
        
        setBusinesses(businessData);
      } catch (error) {
        console.error('Error fetching businesses:', error);
        Alert.alert('Error', 'No se pudieron cargar los negocios');
      } finally {
        setLoading(false);
      }
    };
    
    fetchBusinesses();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('partners-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'partners',
          filter: `user_id=eq.${currentUser.id}`
        }, 
        () => {
          fetchBusinesses();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser]);

  const accountSubscription = resolveAccountSubscriptionFromBusinesses(businesses);

  const getBusinessTypeConfig = (type: string) => {
    switch (type) {
      case 'veterinary':
        return {
          name: 'Veterinaria',
          description: 'Servicios médicos para mascotas',
          availableFeatures: [
            { key: 'agenda', name: 'Agenda de Citas', description: 'Gestionar consultas y citas médicas' },
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario de productos' }
          ]
        };
      case 'grooming':
        return {
          name: 'Peluquería',
          description: 'Servicios de estética y cuidado',
          availableFeatures: [
            { key: 'agenda', name: 'Agenda de Citas', description: 'Gestionar citas de peluquería' },
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario de productos' }
          ]
        };
      case 'walking':
        return {
          name: 'Paseador',
          description: 'Servicios de paseo y ejercicio',
          availableFeatures: [
            { key: 'agenda', name: 'Agenda de Paseos', description: 'Gestionar horarios de paseos' },
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario de productos' }
          ]
        };
      case 'boarding':
        return {
          name: 'Pensión',
          description: 'Hospedaje temporal para mascotas',
          availableFeatures: [
            { key: 'agenda', name: 'Reservas de Hospedaje', description: 'Gestionar reservas de estadía' },
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario de productos' }
          ]
        };
      case 'shop':
        return {
          name: 'Tienda',
          description: 'Venta de productos para mascotas',
          availableFeatures: [
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario y ventas' }
          ]
        };
      case 'shelter':
        return {
          name: 'Refugio',
          description: 'Adopción y rescate de mascotas',
          availableFeatures: [
            { key: 'adoptions', name: 'Gestión de Adopciones', description: 'Administrar mascotas en adopción' },
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario de productos' },
            { key: 'agenda', name: 'Agenda de Citas', description: 'Gestionar citas de adopción' }
          ]
        };
      default:
        return {
          name: 'Negocio',
          description: 'Negocio general',
          availableFeatures: []
        };
    }
  };

  const handleSelectBusiness = async (business: Business) => {
    // Navegar al dashboard específico del negocio
    if (currentUser?.id) {
      await setStoredActivePartnerBusinessId(currentUser.id, business.id);
    }

    router.replace({
      pathname: '/(partner-tabs)/dashboard', 
      params: {  
        businessId: business.id, 
        businessType: business.businessType 
      }
    });
  };

  const handleConfigureBusiness = (business: Business) => {
    Alert.alert(
      'Configurar negocio',
      'Elegí una opción:',
      [
        {
          text: 'Editar información',
          onPress: () => router.push({
            pathname: '/partner/edit-business',
            params: { businessId: business.id }
          })
        },
        {
          text: 'Configurar funcionalidades',
          onPress: () => router.push({
            pathname: '/partner/configure-business',
            params: { businessId: business.id }
          })
        },
        {
          text: 'Eliminar negocio',
          onPress: () => handleDeleteBusiness(business),
          style: 'destructive'
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
  };

  const handleDeleteBusiness = (business: Business) => {
    Alert.alert(
      'Eliminar negocio',
      `¿Seguro que querés eliminar "${business.businessName}"? Esta acción no se puede deshacer y eliminará:\n\n• Todos los servicios del negocio\n• Todos los productos\n• Todas las reservas\n• Toda la información del negocio`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('partners')
                .delete()
                .eq('id', business.id);

              if (error) throw error;

              setBusinesses(prev => prev.filter(b => b.id !== business.id));

              toast.success('Negocio eliminado');
            } catch (error) {
              console.error('Error deleting business:', error);
              Alert.alert('Error', 'No se pudo eliminar el negocio');
            }
          }
        }
      ]
    );
  };

  const handleEditBusiness = (business: Business) => {
    // Navegar directamente a la edición del negocio
    router.push({
      pathname: '/partner/edit-business',  
      params: {  
        businessId: business.id
      }
    });
  };

  const handleToggleFeature = async (businessId: string, featureKey: string, currentValue: boolean, featureType: string) => {
    try {
      const currentBusiness = businesses.find((business) => business.id === businessId);
      if (!currentBusiness) {
        throw new Error('Negocio no encontrado');
      }

      if (!currentValue && featureKey === 'adoptions') {
        const planTier = normalizePartnerPlanTier(
          accountSubscription?.subscriptionPlanTier || currentBusiness.subscriptionPlanTier,
        );
        if (!canAccessPartnerModule(
          planTier,
          'adoptions',
          currentBusiness.businessType,
          accountSubscription?.subscriptionPlanStatus || currentBusiness.subscriptionPlanStatus,
          accountSubscription?.subscriptionPlanExpiresAt || currentBusiness.subscriptionPlanExpiresAt,
        )) {
          Alert.alert(
            'Plan requerido',
            `${featureType} requiere el plan Pro para negocios tipo refugio.`,
            [{ text: 'OK' }]
          );
          return;
        }
      }

      // Show confirmation dialog
      Alert.alert(
        `${currentValue ? 'Desactivar' : 'Activar'} ${featureType}`,
        `¿Seguro que querés ${currentValue ? 'desactivar' : 'activar'} esta funcionalidad?${currentValue ? ' Esto ocultará las opciones relacionadas en el panel.' : ' Esto habilitará nuevas opciones en el panel.'}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: currentValue ? 'Desactivar' : 'Activar',
            style: currentValue ? 'destructive' : 'default',
            onPress: async () => {
              await updateFeature(businessId, featureKey, currentValue, featureType);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleToggleFeature:', error);
      Alert.alert('Error', 'No se pudo actualizar la funcionalidad');
    }
  };

  const updateFeature = async (businessId: string, featureKey: string, currentValue: boolean, featureType: string) => {
    try {
      // Get current business features
      const currentBusiness = businesses.find(b => b.id === businessId);
      if (!currentBusiness) {
        throw new Error('Negocio no encontrado');
      }

      if (!currentValue && featureKey === 'adoptions') {
        const planTier = normalizePartnerPlanTier(
          accountSubscription?.subscriptionPlanTier || currentBusiness.subscriptionPlanTier,
        );
        if (!canAccessPartnerModule(
          planTier,
          'adoptions',
          currentBusiness.businessType,
          accountSubscription?.subscriptionPlanStatus || currentBusiness.subscriptionPlanStatus,
          accountSubscription?.subscriptionPlanExpiresAt || currentBusiness.subscriptionPlanExpiresAt,
        )) {
          throw new Error('PLAN_REQUIRED:adoptions');
        }
      }

      const { error } = await supabaseClient
        .from('partners')
        .update({
          features: {
            ...currentBusiness.features,
            [featureKey]: !currentValue
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);
      
      if (error) throw error;
      
      // Update local state immediately
      setBusinesses(prev => prev.map(business => 
        business.id === businessId 
          ? {
              ...business,
              features: {
                ...business.features,
                [featureKey]: !currentValue
              }
            }
          : business
      ));

      toast.success(
        `${featureType}: ${!currentValue ? 'activada' : 'desactivada'}. ${!currentValue ? 'Vas a ver nuevas opciones en el panel.' : 'Ocultamos las opciones relacionadas del panel.'}`
      );

    } catch (error) {
      console.error('Error updating feature:', error);
      const errorMessage = String(error instanceof Error ? error.message : error || '');
      if (errorMessage.includes('PLAN_REQUIRED:adoptions')) {
        Alert.alert(
          'Plan requerido',
          'La gestión de adopciones está disponible solo para el plan Pro de refugios.'
        );
        return;
      }

      Alert.alert('Error', 'No se pudo actualizar la funcionalidad');
    }
  };

  const getFeatureIcon = (featureKey: string) => {
    switch (featureKey) {
      case 'agenda': return <Calendar size={18} color={colors.primary} />;
      case 'products': return <Package size={18} color={colors.primary} />;
      case 'adoptions': return <Heart size={18} color={colors.primary} />;
      default: return <Settings size={18} color={colors.primary} />;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Mis negocios" showBack={false} />
        <SkeletonList kind="cards" count={2} style={{ padding: spacing.lg }} />
      </SafeAreaView>
    );
  }

  if (businesses.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Mis negocios" showBack={false} />
        <View style={styles.emptyContainer}>
          <EmptyState
            icon={<Building size={32} color={colors.primary} />}
            title="No tenés negocios verificados"
            description="Registrá un negocio y esperá la verificación del administrador."
            actionLabel="Registrar negocio"
            onAction={() => router.push('/partner-register')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Elegí un negocio" showBack={false} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.subtitle}>
          Elegí el negocio que querés gestionar y configurá sus funcionalidades.
        </AppText>

        {businesses.map((business) => {
          const config = getBusinessTypeConfig(business.businessType);
          const subscriptionPlanTier = accountSubscription?.subscriptionPlanTier || business.subscriptionPlanTier;
          const subscriptionPlanStatus = accountSubscription?.subscriptionPlanStatus || business.subscriptionPlanStatus;
          const subscriptionPlanExpiresAt = accountSubscription?.subscriptionPlanExpiresAt || business.subscriptionPlanExpiresAt;
          const effectiveTier = resolvePartnerPlanTier(
            subscriptionPlanTier,
            subscriptionPlanStatus,
            subscriptionPlanExpiresAt,
          );
          const plan = getPartnerPlan(effectiveTier);
          const statusLabel = getPartnerSubscriptionStatusLabel(
            subscriptionPlanStatus,
            subscriptionPlanExpiresAt,
          );
          const canAccessAdoptions = canAccessPartnerModule(
            subscriptionPlanTier,
            'adoptions',
            business.businessType,
            subscriptionPlanStatus,
            subscriptionPlanExpiresAt,
          );

          return (
            <Card key={business.id} style={styles.businessCard}>
              <View style={styles.businessHeader}>
                <View style={styles.businessInfo}>
                  <BusinessTypeAvatar type={business.businessType} size={48} style={styles.businessAvatar} />
                  <View style={styles.businessDetails}>
                    <AppText variant="heading" numberOfLines={2}>{business.businessName}</AppText>
                    <AppText variant="label" color="primary" style={styles.businessType}>{config.name}</AppText>
                    <AppText variant="bodySmall" color="textSecondary">{config.description}</AppText>
                    <View style={[styles.planBadge, { backgroundColor: plan.surface, borderColor: plan.border }]}>
                      <AppText variant="captionStrong" style={{ color: plan.accent }}>
                        {plan.name} · {getPartnerPlanBadgeText(effectiveTier)}
                      </AppText>
                    </View>
                    <AppText variant="caption" color="textSecondary" style={styles.planStatusText}>{statusLabel}</AppText>
                  </View>
                </View>

                <IconButton
                  icon={<Settings size={20} color={colors.textSecondary} />}
                  onPress={() => handleConfigureBusiness(business)}
                  style={styles.configButton}
                  accessibilityLabel={`Configurar ${business.businessName}`}
                />
              </View>

              <View style={styles.featuresSection}>
                <AppText variant="bodyStrong" style={styles.featuresTitle}>Funcionalidades disponibles</AppText>

                {config.availableFeatures.map((feature) => {
                  const enabled = !!business.features[feature.key as keyof typeof business.features];
                  const locked = feature.key === 'adoptions' && !canAccessAdoptions;
                  return (
                    <View key={feature.key} style={styles.featureItem}>
                      <View style={styles.featureInfo}>
                        <View style={styles.featureIconCircle}>{getFeatureIcon(feature.key)}</View>
                        <View style={styles.featureDetails}>
                          <AppText variant="label" color={enabled ? 'primary' : 'text'}>
                            {feature.name}
                          </AppText>
                          <AppText variant="caption" color="textSecondary" style={styles.featureDescription}>
                            {feature.description}
                          </AppText>
                          {locked && (
                            <AppText variant="captionStrong" color="warning" style={styles.featureLockedText}>
                              {getPartnerLockedActionLabel('adoptions')}
                            </AppText>
                          )}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.featureToggle, locked ? styles.featureToggleLocked : null]}
                        onPress={() => handleToggleFeature(business.id, feature.key, business.features[feature.key as keyof typeof business.features] || false, feature.name)}
                        accessibilityRole="button"
                        accessibilityLabel={`${feature.name}: ${enabled ? 'activo' : 'inactivo'}`}
                        accessibilityHint={enabled ? 'Tocá para desactivar' : 'Tocá para activar'}
                      >
                        <Badge label={enabled ? 'Activo' : 'Inactivo'} tone={enabled ? 'success' : 'neutral'} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              <Button
                title="Gestionar negocio"
                onPress={() => handleSelectBusiness(business)}
                size="large"
              />
            </Card>
          );
        })}

        <Card variant="outlined" style={styles.addBusinessCard}>
          <View style={styles.addBusinessContent}>
            <BusinessTypeAvatar size={56} />
            <AppText variant="bodyStrong" align="center" style={styles.addBusinessTitle}>¿Tenés otro negocio?</AppText>
            <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.addBusinessSubtitle}>
              Podés registrar varios negocios con la misma cuenta.
            </AppText>
            <Button
              title="Registrar otro negocio"
              onPress={() => router.push('/partner-register')}
              variant="outline"
              size="medium"
              fullWidth={false}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50, // Añadir padding superior para mejorar la visualización
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  subtitle: {
    marginBottom: spacing.xxl,
  },
  businessCard: {
    marginBottom: spacing.lg,
  },
  businessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  businessInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  businessAvatar: {
    marginRight: spacing.md,
  },
  businessDetails: {
    flex: 1,
  },
  businessType: {
    marginTop: spacing.xxs,
    marginBottom: spacing.xs,
  },
  planBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  planStatusText: {
    marginTop: spacing.xs,
  },
  configButton: {
    backgroundColor: colors.surfaceAlt,
  },
  featuresSection: {
    marginBottom: spacing.xl,
  },
  featuresTitle: {
    marginBottom: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  featureDescription: {
    marginTop: spacing.xxs,
  },
  featureLockedText: {
    marginTop: spacing.xs,
  },
  featureToggle: {
    minHeight: touchTarget,
    minWidth: 80,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  featureToggleLocked: {
    opacity: 0.7,
  },
  addBusinessCard: {
    marginTop: spacing.sm,
  },
  addBusinessContent: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  addBusinessTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  addBusinessSubtitle: {
    marginBottom: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
});
