import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert } from 'react-native';
import { Plus, DollarSign, Percent, Calendar, Package } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

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
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  
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
    const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
    if (!isAdmin) {
      console.log('User is not admin');
      return;
    }

    console.log('Fetching admin partners data...');
    fetchPartners();
    fetchSubscriptions();
  }, [currentUser]);

  const fetchPartners = async () => {
    try {
      console.log('Fetching partners...');
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('is_verified', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching partners:', error);
        throw error;
      }

      console.log('Partners data:', data?.length || 0, 'records found');
      const partnersData = data?.map(partner => ({
        ...partner,
        isVerified: partner.is_verified,
        businessName: partner.business_name,
        businessType: partner.business_type,
        createdAt: new Date(partner.created_at),
        updatedAt: partner.updated_at ? new Date(partner.updated_at) : null,
      })) || [];

      setPartners(partnersData);

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

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const subscriptionsData = data?.map(sub => ({
        ...sub,
        isActive: sub.is_active,
        createdAt: new Date(sub.created_at),
      })) as Subscription[] || [];

      setSubscriptions(subscriptionsData);

      // Set up real-time subscription
      const channel = supabaseClient
        .channel('subscriptions-changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'subscriptions' }, 
          async () => {
            // Re-fetch data when changes occur
            fetchSubscriptions();
          }
        )
        .subscribe();

      return () => {
        supabaseClient.removeChannel(channel);
      };
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    }
  };

  const handleCreateSubscription = async () => {
    if (!subName || !subPrice || !subDuration || !subCommission) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const subscriptionData = {
        name: subName.trim(),
        price: parseFloat(subPrice),
        duration: parseInt(subDuration),
        features: subFeatures.split('\n').filter(f => f.trim()),
        commission: parseFloat(subCommission),
        is_active: true,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('subscriptions')
        .insert([subscriptionData]);

      if (error) throw error;
      
      // Reset form
      setSubName('');
      setSubPrice('');
      setSubDuration('');
      setSubFeatures('');
      setSubCommission('');
      setShowSubscriptionModal(false);
      
      Alert.alert('Éxito', 'Suscripción creada correctamente');
    } catch (error) {
      console.error('Error creating subscription:', error);
      Alert.alert('Error', 'No se pudo crear la suscripción');
    } finally {
      setLoading(false);
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
        commission: parseFloat(newCommission),
        updated_at: new Date().toISOString(),
      })
        .eq('id', selectedPartner.id);

      if (error) throw error;

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

  const isAdmin = currentUser?.email?.toLowerCase() === 'admin@dogcatify.com';
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
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowSubscriptionModal(true)}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Subscriptions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 Planes de Suscripción</Text>
          
          {subscriptions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No hay planes creados</Text>
              <Text style={styles.emptySubtitle}>
                Crea planes de suscripción para tus aliados
              </Text>
            </Card>
          ) : (
            subscriptions.map((subscription) => (
              <Card key={subscription.id} style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Text style={styles.subscriptionName}>{subscription.name}</Text>
                  <Text style={styles.subscriptionPrice}>
                    ${subscription.price.toLocaleString()}/{subscription.duration}d
                  </Text>
                </View>
                
                <View style={styles.subscriptionDetails}>
                  <Text style={styles.subscriptionCommission}>
                    Comisión: {subscription.commission}%
                  </Text>
                  <Text style={styles.subscriptionFeatures}>
                    {subscription.features.length} características incluidas
                  </Text>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Partners Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤝 Aliados Activos ({partners.length})</Text>
          
          {partners.map((partner) => (
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
                
                <TouchableOpacity
                  style={styles.commissionButton}
                  onPress={() => {
                    setSelectedPartner(partner);
                    setNewCommission(partner.commission?.toString() || '');
                    setShowCommissionModal(true);
                  }}
                >
                  <Percent size={16} color="#3B82F6" />
                  <Text style={styles.commissionButtonText}>
                    {partner.commission || 0}%
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.partnerStats}>
                <View style={styles.partnerStat}>
                  <Package size={16} color="#6B7280" />
                  <Text style={styles.partnerStatText}>
                    {partner.servicesCount || 0} servicios
                  </Text>
                </View>
                <View style={styles.partnerStat}>
                  <Calendar size={16} color="#6B7280" />
                  <Text style={styles.partnerStatText}>
                    Desde {partner.createdAt.toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Subscription Modal */}
      <Modal
        visible={showSubscriptionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubscriptionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear Plan de Suscripción</Text>
            
            <Input
              label="Nombre del plan"
              placeholder="Ej: Plan Básico, Plan Premium"
              value={subName}
              onChangeText={setSubName}
            />
            
            <Input
              label="Precio"
              placeholder="0.00"
              value={subPrice}
              onChangeText={setSubPrice}
              keyboardType="numeric"
              leftIcon={<DollarSign size={20} color="#6B7280" />}
            />
            
            <Input
              label="Duración (días)"
              placeholder="30"
              value={subDuration}
              onChangeText={setSubDuration}
              keyboardType="numeric"
              leftIcon={<Calendar size={20} color="#6B7280" />}
            />
            
            <Input
              label="Comisión (%)"
              placeholder="5.0"
              value={subCommission}
              onChangeText={setSubCommission}
              keyboardType="numeric"
              leftIcon={<Percent size={20} color="#6B7280" />}
            />
            
            <Input
              label="Características (una por línea)"
              placeholder="Publicaciones ilimitadas&#10;Soporte prioritario&#10;Estadísticas avanzadas"
              value={subFeatures}
              onChangeText={setSubFeatures}
              multiline
              numberOfLines={4}
            />
            
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={() => setShowSubscriptionModal(false)}
                variant="outline"
                size="medium"
              />
              <Button
                title="Crear Plan"
                onPress={handleCreateSubscription}
                loading={loading}
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Commission Modal */}
      <Modal
        visible={showCommissionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommissionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Actualizar Comisión - {selectedPartner?.businessName}
            </Text>
            
            <Input
              label="Nueva comisión (%)"
              placeholder="5.0"
              value={newCommission}
              onChangeText={setNewCommission}
              keyboardType="numeric"
              leftIcon={<Percent size={20} color="#6B7280" />}
            />
            
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={() => setShowCommissionModal(false)}
                variant="outline"
                size="medium"
              />
              <Button
                title="Actualizar"
                onPress={handleUpdateCommission}
                loading={loading}
                size="medium"
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
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
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
});