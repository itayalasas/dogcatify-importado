import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert } from 'react-native';
import { Plus, DollarSign, Percent, Calendar, Package, Search } from 'lucide-react-native';
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

interface Subscription {
  id: string;
  name: string;
  price: number;
  duration: number; // days
  features: string[];
  commission: number; // percentage
  isActive: boolean;
}

export default function AdminPartners() {
  const { currentUser } = useAuth();
  const [partners, setPartners] = useState<any[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [selectedPlanTier, setSelectedPlanTier] = useState<'starter' | 'growth' | 'pro'>('starter');
  
  // Subscription form
  const [subName, setSubName] = useState('');
  const [subPrice, setSubPrice] = useState('');
  const [subDuration, setSubDuration] = useState('');
  const [subFeatures, setSubFeatures] = useState('');
  const [subCommission, setSubCommission] = useState('');
  
  // Commission form
  const [newCommission, setNewCommission] = useState('');
  
  const [loading, setLoading] = useState(false);

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
          commission_percentage, 
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
          commissionPercentage: partner.commission_percentage || 5.0,
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
    }
  };

  const handleUpdateCommission = async () => {
    if (!selectedPartner || !newCommission) {
      Alert.alert('Error', 'Por favor especifica la comisión');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabaseClient
        .from('partners')
        .update({
          commission_percentage: parseFloat(newCommission),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPartner.id);

      if (error) throw error;

      // Update local state immediately
      setPartners(prevPartners => 
        prevPartners.map(partner => 
          partner.id === selectedPartner.id 
            ? { ...partner, commissionPercentage: parseFloat(newCommission) }
            : partner
        )
      );

      setNewCommission('');
      setSelectedPartner(null);
      setShowCommissionModal(false);
      
      Alert.alert('Éxito', 'Comisión actualizada correctamente');
    } catch (error) {
      console.error('Error updating commission:', error);
      Alert.alert('Error', 'No se pudo actualizar la comisión');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubscriptionPlan = async () => {
    if (!selectedPartner || !selectedPlanTier) {
      Alert.alert('Error', 'Por favor selecciona un plan');
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
      Alert.alert('Éxito', 'Plan actualizado correctamente');
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      Alert.alert('Error', 'No se pudo actualizar el plan');
    } finally {
      setLoading(false);
    }
  };

  const getBusinessTypeIcon = (type: string) => {
    switch (type) {
      case 'veterinary': return '🏥';
      case 'grooming': return '✂️';
      case 'walking': return '🚶';
      case 'boarding': return '🏠';
      case 'shop': return '🛍️';
      case 'shelter': return '🐾';
      default: return '🏢';
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
          <Text style={styles.accessDeniedTitle}>Acceso Denegado</Text>
          <Text style={styles.accessDeniedText}>
            No tienes permisos para acceder a esta sección
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>👥 Gestión de Aliados</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Buscar aliados por nombre o tipo..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={20} color="#9CA3AF" />}
          />
        </View>

        {/* Partners Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤝 Aliados Activos ({filteredPartners.length})</Text>
          
          {filteredPartners.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No se encontraron aliados' : 'No hay aliados activos'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Los aliados verificados aparecerán aquí'
                }
              </Text>
            </Card>
          ) : (
            filteredPartners.map((partner) => (
            <Card key={partner.id} style={styles.partnerCard}>
              <View style={styles.partnerHeader}>
                <View style={styles.partnerInfo}>
                  <Text style={styles.partnerIcon}>
                    {getBusinessTypeIcon(partner.businessType)}
                  </Text>
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

                  <TouchableOpacity
                    style={styles.commissionButton}
                    onPress={() => {
                      setSelectedPartner(partner);
                      setNewCommission(partner.commissionPercentage?.toString() || '5.0');
                      setShowCommissionModal(true);
                    }}
                  >
                    <Percent size={16} color="#3B82F6" />
                    <Text style={styles.commissionButtonText}>
                      {partner.commissionPercentage || 5.0}%
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.partnerStats}>
                <View style={styles.partnerStat}>
                  <Package size={16} color="#6B7280" />
                  <Text style={styles.partnerStatText}>
                    {partner.servicesCount || 0} servicio{partner.servicesCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.partnerStat}>
                  <Calendar size={16} color="#6B7280" />
                  <Text style={styles.partnerStatText}>
                    Desde {partner.createdAt.toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.partnerStat}>
                  <Text style={styles.partnerPlanStatus}>
                    Estado: {partner.subscriptionPlanStatus === 'active' ? 'Activo' : partner.subscriptionPlanStatus}
                  </Text>
                </View>
              </View>
            </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Commission Modal */}
      <Modal
        visible={showCommissionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommissionModal(false)}
      >
        <View style={styles.commissionModalOverlay}>
          <View style={styles.commissionModalContent}>
            <Text style={styles.modalTitle}>
              Actualizar Comisión - {selectedPartner?.businessName}
            </Text>
            
            <View style={styles.commissionInfo}>
              <Text style={styles.commissionInfoText}>
                Comisión actual: {selectedPartner?.commissionPercentage || 5.0}%
              </Text>
            </View>
            
            <Input
              label="Nueva comisión (%)"
              placeholder="5.0"
              value={newCommission}
              onChangeText={setNewCommission}
              keyboardType="numeric"
              leftIcon={<Percent size={20} color="#6B7280" />}
            />
            
            <View style={styles.commissionModalActions}>
              <Button
                title="Cancelar"
                onPress={() => {
                  setShowCommissionModal(false);
                  setNewCommission('');
                  setSelectedPartner(null);
                }}
                variant="outline"
                size="large"
              />
              <Button
                title="Actualizar"
                onPress={handleUpdateCommission}
                loading={loading}
                size="large"
              />
            </View>
          </View>
        </View>
      </Modal>

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
              Selecciona el plan comercial para este aliado
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
                        backgroundColor: isSelected ? plan.surface : '#FFFFFF',
                        borderColor: isSelected ? plan.border : '#E5E7EB',
                      },
                    ]}
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
              />
              <Button
                title="Guardar plan"
                onPress={handleUpdateSubscriptionPlan}
                loading={loading}
                size="large"
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#DC2626',
    padding: 8,
    borderRadius: 20,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  subscriptionCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  subscriptionPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  subscriptionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subscriptionCommission: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  subscriptionFeatures: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  partnerCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  partnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  partnerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  partnerDetails: {
    flex: 1,
  },
  partnerName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  partnerType: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  commissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  partnerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planButton: {
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  planButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  commissionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
    marginLeft: 4,
  },
  partnerStats: {
    flexDirection: 'row',
    gap: 16,
  },
  partnerStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerStatText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  partnerPlanStatus: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#7C3AED',
    marginLeft: 4,
  },
  emptyCard: {
    marginHorizontal: 16,
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  commissionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  commissionModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
  },
  commissionInfo: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  commissionInfoText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  planModalSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  planList: {
    gap: 12,
  },
  planOption: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  planOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planOptionName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  planOptionSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  planOptionPrice: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  planOptionDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 18,
    marginBottom: 8,
  },
  planOptionFeatures: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  commissionModalActions: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 20,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
});
