import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { ArrowLeft, Building, Settings, Calendar, Package, Users, Heart, Check } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { router } from 'expo-router';

interface Business {
  id: string;
  businessName: string;
  businessType: 'veterinary' | 'grooming' | 'walking' | 'boarding' | 'shop' | 'shelter';
  isVerified: boolean;
  isActive: boolean;
  features: {
    agenda?: boolean;
    products?: boolean;
    adoptions?: boolean;
  };
}

export default function BusinessSelector() {
  const { currentUser } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

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

  const getBusinessTypeConfig = (type: string) => {
    switch (type) {
      case 'veterinary':
        return {
          name: 'Veterinaria',
          icon: '🏥',
          description: 'Servicios médicos para mascotas',
          availableFeatures: [
            { key: 'agenda', name: 'Agenda de Citas', description: 'Gestionar consultas y citas médicas' },
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario de productos' }
          ]
        };
      case 'grooming':
        return {
          name: 'Peluquería',
          icon: '✂️',
          description: 'Servicios de estética y cuidado',
          availableFeatures: [
            { key: 'agenda', name: 'Agenda de Citas', description: 'Gestionar citas de peluquería' },
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario de productos' }
          ]
        };
      case 'walking':
        return {
          name: 'Paseador',
          icon: '🚶',
          description: 'Servicios de paseo y ejercicio',
          availableFeatures: [
            { key: 'agenda', name: 'Agenda de Paseos', description: 'Gestionar horarios de paseos' },
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario de productos' }
          ]
        };
      case 'boarding':
        return {
          name: 'Pensión',
          icon: '🏠',
          description: 'Hospedaje temporal para mascotas',
          availableFeatures: [
            { key: 'agenda', name: 'Reservas de Hospedaje', description: 'Gestionar reservas de estadía' },
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario de productos' }
          ]
        };
      case 'shop':
        return {
          name: 'Tienda',
          icon: '🛍️',
          description: 'Venta de productos para mascotas',
          availableFeatures: [
            { key: 'products', name: 'Gestión de Productos', description: 'Administrar inventario y ventas' },
            { key: 'agenda', name: 'Agenda de Citas', description: 'Gestionar citas con clientes' }
          ]
        };
      case 'shelter':
        return {
          name: 'Refugio',
          icon: '🐾',
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
          icon: '🏢',
          description: 'Negocio general',
          availableFeatures: []
        };
    }
  };

  const handleSelectBusiness = (business: Business) => {
    // Navegar al dashboard específico del negocio
    router.push({
      pathname: '/(partner-tabs)/dashboard', 
      params: {  
        businessId: business.id, 
        businessType: business.businessType 
      }
    });
  };

  const handleConfigureBusiness = (business: Business) => {
    // Mostrar menú de opciones de configuración
    Alert.alert(
      'Configurar Negocio',
      'Selecciona una opción:',
      [
        {
          text: 'Editar Información',
          onPress: () => router.push({
            pathname: '/partner/edit-business',
            params: { businessId: business.id }
          })
        },
        {
          text: 'Configurar Funcionalidades',
          onPress: () => router.push({
            pathname: '/partner/configure-business',
            params: { businessId: business.id }
          })
        },
        {
          text: 'Cancelar',
          style: 'cancel'
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
      // Show confirmation dialog
      Alert.alert(
        `${currentValue ? 'Desactivar' : 'Activar'} ${featureType}`,
        `¿Estás seguro de que quieres ${currentValue ? 'desactivar' : 'activar'} esta funcionalidad?${currentValue ? ' Esto ocultará las opciones relacionadas en el dashboard.' : ' Esto habilitará nuevas opciones en el dashboard.'}`,
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

      Alert.alert(
        'Funcionalidad actualizada',
        `${featureType} ha sido ${!currentValue ? 'activada' : 'desactivada'} correctamente. ${!currentValue ? 'Ahora verás nuevas opciones en el dashboard.' : 'Las opciones relacionadas se han ocultado del dashboard.'}`
      );

    } catch (error) {
      console.error('Error updating feature:', error);
      Alert.alert('Error', 'No se pudo actualizar la funcionalidad');
    }
  };

  const getFeatureIcon = (featureKey: string) => {
    switch (featureKey) {
      case 'agenda': return <Calendar size={20} color="#3B82F6" />;
      case 'products': return <Package size={20} color="#10B981" />;
      case 'adoptions': return <Heart size={20} color="#EF4444" />;
      default: return <Settings size={20} color="#6B7280" />;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando negocios...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (businesses.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Mis Negocios</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.emptyContainer}>
          <Building size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No tienes negocios verificados</Text>
          <Text style={styles.emptySubtitle}>
            Registra un negocio y espera la verificación del administrador
          </Text>
          <Button
            title="Registrar Negocio"
            onPress={() => router.push('/partner-register')}
            size="large"
          />
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
        <Text style={styles.title}>Seleccionar Negocio</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Selecciona el negocio que deseas gestionar y configura sus funcionalidades
        </Text>

        {businesses.map((business) => {
          const config = getBusinessTypeConfig(business.businessType);
          
          return (
            <Card key={business.id} style={styles.businessCard}>
              <View style={styles.businessHeader}>
                <View style={styles.businessInfo}>
                  <Text style={styles.businessIcon}>{config.icon}</Text>
                  <View style={styles.businessDetails}>
                    <Text style={styles.businessName}>{business.businessName}</Text>
                    <Text style={styles.businessType}>{config.name}</Text>
                    <Text style={styles.businessDescription}>{config.description}</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.configButton}
                  onPress={() => handleConfigureBusiness(business)}
                >
                  <Settings size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.featuresSection}>
                <Text style={styles.featuresTitle}>Funcionalidades Disponibles:</Text>
                
                {config.availableFeatures.map((feature) => (
                  <View key={feature.key} style={styles.featureItem}>
                    <View style={styles.featureInfo}>
                      {getFeatureIcon(feature.key)}
                      <View style={styles.featureDetails}>
                        <Text style={[styles.featureName, business.features[feature.key as keyof typeof business.features] && styles.featureNameActive]}>
                          {feature.name}
                        </Text>
                        <Text style={styles.featureDescription}>{feature.description}</Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity
                      style={[
                        styles.featureToggle,
                        business.features[feature.key as keyof typeof business.features] && styles.featureToggleActive
                      ]}
                      onPress={() => handleToggleFeature(business.id, feature.key, business.features[feature.key as keyof typeof business.features] || false, feature.name)}
                    >
                      <Text style={business.features[feature.key as keyof typeof business.features] ? styles.featureToggleTextActive : styles.featureToggleText}>
                        {business.features[feature.key as keyof typeof business.features] ? 'Activo' : 'Inactivo'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <Button
                title="Gestionar Negocio"
                onPress={() => handleSelectBusiness(business)}
                size="large"
              />
            </Card>
          );
        })}

        <Card style={styles.addBusinessCard}>
          <View style={styles.addBusinessContent}>
            <Building size={32} color="#9CA3AF" />
            <Text style={styles.addBusinessTitle}>¿Tienes otro negocio?</Text>
            <Text style={styles.addBusinessSubtitle}>
              Puedes registrar múltiples negocios con la misma cuenta
            </Text>
            <Button
              title="Registrar Otro Negocio"
              onPress={() => router.push('/partner-register')}
              variant="outline"
              size="medium"
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
    backgroundColor: '#F9FAFB',
    paddingTop: 50, // Añadir padding superior para mejorar la visualización
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
    padding: 6,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  businessCard: {
    marginBottom: 16,
  },
  businessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  businessInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  businessIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  businessType: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 4,
  },
  businessDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  configButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  featuresSection: {
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  featureDetails: {
    marginLeft: 12,
    flex: 1,
  },
  featureName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 2,
  },
  featureNameActive: {
    color: '#3B82F6',
  },
  featureDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 16,
  },
  featureToggle: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    opacity: 0.9,
  },
  featureToggleActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  featureToggleText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  featureToggleTextActive: {
    color: '#FFFFFF', 
  },
  addBusinessCard: {
    marginTop: 8,
  },
  addBusinessContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  addBusinessTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
  },
  addBusinessSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
});