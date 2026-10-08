import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, RefreshControl } from 'react-native';
import { Plus, Calendar, Package, Search, Stethoscope, Scissors, Footprints, House, ShoppingBag, PawPrint, Building2, Users } from 'lucide-react-native';
import { Badge, EmptyState, SkeletonList, toast } from '../../components/ui';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import {
  PARTNER_PLAN_ORDER,
  getPartnerPlan,
  getPartnerPlanDisplayPrice,
  normalizePartnerPlanTier,
  resolvePartnerAccountSubscription,
} from '../../utils/partnerPlans';
import { colors, radius, spacing, typography } from '../../constants/theme';


export default function AdminPartners() {
  const { currentUser } = useAuth();
  const [partners, setPartners] = useState<any[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [selectedPlanTier, setSelectedPlanTier] = useState<'starter' | 'growth' | 'pro'>('starter');
  
  // Subscription form
  const [subName, setSubName] = useState('');
  const [subPrice, setSubPrice] = useState('');
  const [subDuration, setSubDuration] = useState('');
  const [subFeatures, setSubFeatures] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      console.log('No user logged in');
      return;
    }

    console.log('Current user email:', currentUser.email);
    const isAdmin = currentUser?.isAdmin === true;
    if (!isAdmin) {
      console.log('User is not admin');
      return;
    }

    console.log('Fetching admin partners data...');
    fetchPartners();
  }, [currentUser]);

  useEffect(() => {
    // Filter partners based on search query
    if (searchQuery.trim()) {
      setFilteredPartners(
        partners.filter(partner => 
          partner.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          partner.businessType.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredPartners(partners);
    }
  }, [searchQuery, partners]);

  const fetchPartners = async () => {
    try {
      console.log('Fetching partners...');
      const { data, error } = await supabaseClient
        .from('partners')
        .select(`
          id, 
          user_id, 
          business_name, 
          business_type, 
          subscription_plan_tier,
          subscription_plan_status,
          subscription_plan_expires_at,
          is_verified, 
          is_active, 
          created_at, 
          updated_at
        `)
        .eq('is_verified', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching partners:', error);
        throw error;
      }

      console.log('Partners data:', data?.length || 0, 'records found');
      
      // Fetch services count for each partner
      const partnersWithServices = await Promise.all(
        (data || []).map(async (partner) => {
          try {
            // Count services for this partner
            const { count: servicesCount, error: servicesError } = await supabaseClient
              .from('partner_services')
              .select('*', { count: 'exact', head: true })
              .eq('partner_id', partner.id)
              .eq('is_active', true);
            
            if (servicesError) {
              console.error(`Error counting services for partner ${partner.id}:`, servicesError);
            }
            
            return {
              ...partner,
              servicesCount: servicesCount || 0
            };
          } catch (error) {
            console.error(`Error processing partner ${partner.id}:`, error);
            return {
              ...partner,
              servicesCount: 0
            };
          }
        })
      );
      
      const partnersByUser = partnersWithServices.reduce((acc, partner) => {
        const key = String(partner.user_id || partner.id);
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(partner);
        return acc;
      }, {} as Record<string, typeof partnersWithServices>);

      const partnersData = partnersWithServices.map(partner => {
        const accountSubscription = resolvePartnerAccountSubscription(partnersByUser[String(partner.user_id || partner.id)] || []);

        return {
          ...partner,
          isVerified: partner.is_verified,
          businessName: partner.business_name,
          businessType: partner.business_type,
          subscriptionPlanTier: accountSubscription?.subscriptionPlanTier || normalizePartnerPlanTier(partner.subscription_plan_tier),
          subscriptionPlanStatus: accountSubscription?.subscriptionPlanStatus || partner.subscription_plan_status || 'active',
          subscriptionPlanExpiresAt: accountSubscription?.subscriptionPlanExpiresAt || partner.subscription_plan_expires_at || null,
          servicesCount: partner.servicesCount || 0,
          createdAt: new Date(partner.created_at),
          updatedAt: partner.updated_at ? new Date(partner.updated_at) : null,
        };
      });

      setPartners(partnersData);
      setFilteredPartners(partnersData);

      // Set up real-time subscription
      const channel = supabaseClient
        .channel('partners-changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'partners' }, 
          async () => {
            // Re-fetch data when changes occur
            fetchPartners();
          }
        )
        .subscribe();

      return () => {
        supabaseClient.removeChannel(channel);
      };
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPartners();
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateSubscriptionPlan = async () => {
    if (!selectedPartner || !selectedPlanTier) {
      Alert.alert('Error', 'Seleccioná un plan');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabaseClient
        .from('partners')
        .update({
          subscription_plan_tier: selectedPlanTier,
          subscription_plan_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', selectedPartner.user_id);

      if (error) throw error;

      setPartners(prevPartners =>
        prevPartners.map(partner =>
          partner.user_id === selectedPartner.user_id
            ? {
                ...partner,
                subscriptionPlanTier: selectedPlanTier,
                subscriptionPlanStatus: 'active',
              }
            : partner
        )
      );

      setSelectedPartner(null);
      setShowSubscriptionModal(false);
      toast.success('Plan actualizado correctamente');
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      Alert.alert('Error', 'No se pudo actualizar el plan');
    } finally {
      setLoading(false);
    }
  };

  const getBusinessTypeIcon = (type: string) => {
    const iconProps = { size: 20, color: colors.primary };
    switch (type) {
      case 'veterinary': return <Stethoscope {...iconProps} />;
      case 'grooming': return <Scissors {...iconProps} />;
      case 'walking': return <Footprints {...iconProps} />;
      case 'boarding': return <House {...iconProps} />;
      case 'shop': return <ShoppingBag {...iconProps} />;
      case 'shelter': return <PawPrint {...iconProps} />;
      default: return <Building2 {...iconProps} />;
    }
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

  const isAdmin = currentUser?.isAdmin === true;
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedTitle}>Acceso denegado</Text>
          <Text style={styles.accessDeniedText}>
            No tenés permisos para acceder a esta sección
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Gestión de aliados</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Buscar aliados por nombre o tipo..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={20} color={colors.textTertiary} />}
          />
        </View>

        {/* Partners Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Aliados activos ({filteredPartners.length})</Text>
          
          {initialLoading ? (
            <SkeletonList kind="list" count={5} />
          ) : filteredPartners.length === 0 ? (
            <EmptyState
              icon={<Users size={32} color={colors.primary} />}
              title={searchQuery ? 'No se encontraron aliados' : 'No hay aliados activos'}
              description={searchQuery ? 'Probá con otros términos de búsqueda' : 'Los aliados verificados aparecerán acá'}
              actionLabel={searchQuery ? 'Limpiar búsqueda' : undefined}
              onAction={searchQuery ? () => setSearchQuery('') : undefined}
            />
          ) : (
            filteredPartners.map((partner) => (
            <Card key={partner.id} style={styles.partnerCard}>
              <View style={styles.partnerHeader}>
                <View style={styles.partnerInfo}>
                  <View style={styles.partnerIcon}>
                    {getBusinessTypeIcon(partner.businessType)}
                  </View>
                  <View style={styles.partnerDetails}>
                    <Text style={styles.partnerName}>{partner.businessName}</Text>
                    <Text style={styles.partnerType}>
                      {getBusinessTypeName(partner.businessType)}
                    </Text>
                  </View>
                </View>
                <View style={styles.partnerActions}>
                  <TouchableOpacity
                    style={styles.planButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Cambiar plan de ${partner.businessName}. Plan actual: ${getPartnerPlan(partner.subscriptionPlanTier).name}`}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => {
                      setSelectedPartner(partner);
                      setSelectedPlanTier(normalizePartnerPlanTier(partner.subscriptionPlanTier));
                      setShowSubscriptionModal(true);
                    }}
                  >
                    <Text style={styles.planButtonText}>
                      {getPartnerPlan(partner.subscriptionPlanTier).name}
                    </Text>
                  </TouchableOpacity>

                </View>
              </View>
              
              <View style={styles.partnerStats}>
                <View style={styles.partnerStat}>
                  <Package size={16} color={colors.textTertiary} />
                  <Text style={styles.partnerStatText}>
                    {partner.servicesCount || 0} servicio{partner.servicesCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.partnerStat}>
                  <Calendar size={16} color={colors.textTertiary} />
                  <Text style={styles.partnerStatText}>
                    Desde {partner.createdAt.toLocaleDateString()}
                  </Text>
                </View>
                <Badge
                  size="small"
                  tone={partner.subscriptionPlanStatus === 'active' ? 'success' : 'warning'}
                  label={partner.subscriptionPlanStatus === 'active' ? 'Activo' : String(partner.subscriptionPlanStatus)}
                />
              </View>
            </Card>
            ))
          )}
        </View>
      </ScrollView>


      <Modal
        visible={showSubscriptionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubscriptionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Cambiar plan - {selectedPartner?.businessName}
            </Text>

            <Text style={styles.planModalSubtitle}>
              Seleccioná el plan comercial para este aliado
            </Text>

            <View style={styles.planList}>
              {PARTNER_PLAN_ORDER.map((tier) => {
                const plan = getPartnerPlan(tier);
                const isSelected = selectedPlanTier === tier;

                return (
                  <TouchableOpacity
                    key={tier}
                    style={[
                      styles.planOption,
                      {
                        backgroundColor: isSelected ? plan.surface : colors.surface,
                        borderColor: isSelected ? plan.border : colors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Plan ${plan.name}, ${getPartnerPlanDisplayPrice(tier)}`}
                    onPress={() => setSelectedPlanTier(tier)}
                  >
                    <View style={styles.planOptionHeader}>
                      <View>
                        <Text style={styles.planOptionName}>{plan.name}</Text>
                        <Text style={styles.planOptionSubtitle}>{plan.subtitle}</Text>
                      </View>
                      <Text style={[styles.planOptionPrice, { color: plan.accent }]}>
                        {getPartnerPlanDisplayPrice(tier)}
                      </Text>
                    </View>
                    <Text style={styles.planOptionDescription}>{plan.description}</Text>
                    <Text style={[styles.planOptionFeatures, { color: plan.accent }]}>
                      {plan.features.length} beneficios activos
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={() => {
                  setShowSubscriptionModal(false);
                  setSelectedPartner(null);
                }}
                variant="outline"
                size="large"
                fullWidth={false}
                style={{ flex: 1 }}
              />
              <Button
                title="Guardar plan"
                onPress={handleUpdateSubscriptionPlan}
                loading={loading}
                size="large"
                fullWidth={false}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: radius.pill,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  subscriptionCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  subscriptionName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  subscriptionPrice: {
    ...typography.bodyStrong,
    color: colors.success,
  },
  subscriptionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subscriptionCommission: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  subscriptionFeatures: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  partnerCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  partnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  partnerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  partnerDetails: {
    flex: 1,
  },
  partnerName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  partnerType: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  commissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  partnerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planButton: {
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  planButtonText: {
    ...typography.captionStrong,
    color: colors.primary,
  },
  commissionButtonText: {
    ...typography.label,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  partnerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
  },
  partnerStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerStatText: {
    ...typography.bodySmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  partnerPlanStatus: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  commissionModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 60,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  commissionModalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
  },
  commissionInfo: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  commissionInfoText: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  planModalSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  planList: {
    gap: spacing.md,
  },
  planOption: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
  },
  planOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  planOptionName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  planOptionSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  planOptionPrice: {
    ...typography.label,
  },
  planOptionDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  planOptionFeatures: {
    ...typography.captionStrong,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  commissionModalActions: {
    flexDirection: 'column',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  accessDeniedTitle: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 32,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  accessDeniedText: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
  },
});
