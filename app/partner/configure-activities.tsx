import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Clock, DollarSign, X, Edit, Package } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

interface Activity {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  price: number;
  isActive: boolean;
  category?: string;
  images?: string[];
  stock?: number; // Para productos
  brand?: string; // Para productos
}

export default function ConfigureActivities() {
  const { partnerId, businessType } = useLocalSearchParams<{ partnerId: string; businessType: string }>();
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [activityName, setActivityName] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityDuration, setActivityDuration] = useState('');
  const [activityPrice, setActivityPrice] = useState('');

  useEffect(() => {
    if (!partnerId) return;
    
    // Fetch partner profile using Supabase
    const fetchPartnerProfile = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('id', partnerId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setPartnerProfile({
            id: data.id,
            businessName: data.business_name,
            businessType: data.business_type,
            ...data
          });
        }
        
        fetchActivities();
      } catch (error) {
        console.error('Error fetching partner profile:', error);
      }
    };
    
    fetchPartnerProfile();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('partner-profile-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'partners',
          filter: `id=eq.${partnerId}`
        }, 
        () => {
          fetchPartnerProfile();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [partnerId]);

  const fetchActivities = async () => {
    try {
      console.log('Fetching activities for partner:', partnerId);
      console.log('Business type:', businessType);

      // Para tiendas, buscar en partner_products; para otros, en partner_services
      const tableName = businessType === 'shop' ? 'partner_products' : 'partner_services';

      const { data, error } = await supabaseClient
        .from(tableName)
        .select('*')
        .eq('partner_id', partnerId);

      if (error) throw error;

      console.log('Activities/Products fetched:', data?.length || 0);

      // Mapear datos según el tipo de tabla
      const activitiesData = data.map(item => {
        if (businessType === 'shop') {
          // Mapeo para productos
          return {
            id: item.id,
            name: item.name,
            description: item.description || '',
            duration: 0, // Los productos no tienen duración
            price: item.price || 0,
            isActive: item.is_active,
            category: item.category || '',
            images: item.images || [],
            stock: item.stock || 0, // Agregar stock para productos
            brand: item.brand || '',
          };
        } else {
          // Mapeo para servicios
          return {
            id: item.id,
            name: item.name,
            description: item.description || '',
            duration: item.duration || 0,
            price: item.price || 0,
            isActive: item.is_active,
            category: item.category || '',
            images: item.images || []
          };
        }
      }) as Activity[];

      setActivities(activitiesData);
      console.log('Activities/Products state updated with:', activitiesData.length, 'items');
    } catch (error) {
      console.error('Error fetching activities:', error);
    }

    // Set up real-time subscription
    const tableName = businessType === 'shop' ? 'partner_products' : 'partner_services';
    const subscription = supabaseClient
      .channel('activities-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `partner_id=eq.${partnerId}`
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const getBusinessTypeConfig = (type: string) => {
    switch (type) {
      case 'veterinary':
        return {
          title: 'Servicios Veterinarios',
          suggestions: [
            { name: 'Consulta General', duration: 30, price: 5000 },
            { name: 'Vacunación', duration: 15, price: 3000 },
            { name: 'Cirugía Menor', duration: 60, price: 15000 },
            { name: 'Emergencia', duration: 45, price: 8000 },
            { name: 'Control de Salud', duration: 20, price: 4000 },
          ]
        };
      case 'grooming':
        return {
          title: 'Servicios de Peluquería',
          suggestions: [
            { name: 'Baño Completo', duration: 45, price: 4000 },
            { name: 'Corte de Pelo', duration: 60, price: 6000 },
            { name: 'Corte de Uñas', duration: 15, price: 1500 },
            { name: 'Limpieza de Oídos', duration: 10, price: 1000 },
            { name: 'Desenredado', duration: 30, price: 3000 },
          ]
        };
      case 'walking':
        return {
          title: 'Servicios de Paseo',
          suggestions: [
            { name: 'Paseo Corto (30min)', duration: 30, price: 2000 },
            { name: 'Paseo Largo (60min)', duration: 60, price: 3500 },
            { name: 'Ejercicio en Parque', duration: 45, price: 3000 },
            { name: 'Cuidado por Horas', duration: 120, price: 6000 },
            { name: 'Socialización', duration: 90, price: 4500 },
          ]
        };
      case 'boarding':
        return {
          title: 'Servicios de Pensión',
          suggestions: [
            { name: 'Hospedaje Diario', duration: 1440, price: 8000 }, // 24 hours
            { name: 'Hospedaje Nocturno', duration: 720, price: 5000 }, // 12 hours
            { name: 'Fin de Semana', duration: 2880, price: 15000 }, // 48 hours
            { name: 'Hospedaje Semanal', duration: 10080, price: 50000 }, // 7 days
          ]
        };
      default:
        return {
          title: 'Actividades del Negocio',
          suggestions: []
        };
    }
  };

  const handleAddActivity = async () => {
    if (partnerProfile && partnerProfile.id) {
      // Si es un refugio, redirigir al formulario de adopción
      if (partnerProfile.businessType === 'shelter') {
        console.log('Redirecting to adoption form for shelter');
        router.push({
          pathname: '/partner/add-adoption-pet',
          params: {
            partnerId: partnerProfile.id
          }
        });
      } else {
        // Para otros tipos de negocio, usar el formulario normal
        console.log('Redirecting to service form for business type:', partnerProfile.businessType);
        router.push({
          pathname: '/partner/add-service',
          params: {
            partnerId: partnerProfile.id,
            businessType: partnerProfile.businessType
          }
        });
      }
    } else {
      Alert.alert('Error', 'No se pudo obtener la información del negocio');
    }
  };

  const handleToggleActivity = async (activityId: string, isActive: boolean) => {
    try {
      const tableName = businessType === 'shop' ? 'partner_products' : 'partner_services';
      const { error } = await supabaseClient
        .from(tableName)
        .update({
          is_active: !isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', activityId);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling activity:', error);
      Alert.alert('Error', `No se pudo actualizar ${businessType === 'shop' ? 'el producto' : 'la actividad'}`);
    }
  };

  const handleEditActivity = (activityId: string) => {
    if (businessType === 'shop') {
      router.push({
        pathname: '/partner/edit-product',
        params: {
          productId: activityId
        }
      });
    } else {
      router.push({
        pathname: '/partner/edit-service',
        params: {
          serviceId: activityId,
          partnerId: partnerId || '',
          businessType: businessType || ''
        }
      });
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    const isProduct = businessType === 'shop';
    Alert.alert(
      `Eliminar ${isProduct ? 'Producto' : 'Actividad'}`,
      `¿Estás seguro de que quieres eliminar ${isProduct ? 'este producto' : 'esta actividad'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const tableName = businessType === 'shop' ? 'partner_products' : 'partner_services';
              const { error } = await supabaseClient
                .from(tableName)
                .delete()
                .eq('id', activityId);

              if (error) throw error;

              Alert.alert('Éxito', `${isProduct ? 'Producto' : 'Actividad'} eliminado correctamente`);
            } catch (error) {
              console.error('Error deleting activity:', error);
              Alert.alert('Error', `No se pudo eliminar ${isProduct ? 'el producto' : 'la actividad'}`);
            }
          }
        }
      ]
    );
  };

  const handleUseSuggestion = (suggestion: any) => {
    setActivityName(suggestion.name);
    setActivityDescription(`Servicio de ${suggestion.name.toLowerCase()}`);
    setActivityDuration(suggestion.duration.toString());
    setActivityPrice(suggestion.price.toString());
  };

  const config = getBusinessTypeConfig(businessType || '');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.businessInfo}>
            {partnerProfile?.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {businessType === 'veterinary' ? '🏥' : 
                   businessType === 'grooming' ? '✂️' : 
                   businessType === 'walking' ? '🚶' : 
                   businessType === 'boarding' ? '🏠' : 
                   businessType === 'shop' ? '🛍️' : '⚙️'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.title}>Configurar Actividades</Text>
              <Text style={styles.businessName}>{partnerProfile?.businessName}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddActivity}>
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>{config.title}</Text>
          <Text style={styles.infoDescription}>
            {businessType === 'shelter' 
              ? 'Publica mascotas disponibles para adopción y encuentra hogares responsables'
              : businessType === 'shop'
              ? 'Administra los productos de tu tienda para que los clientes puedan comprar'
              : 'Define las actividades que ofreces para que los clientes puedan hacer reservas'
            }
          </Text>
        </Card>

        {activities.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay actividades configuradas</Text>
            <Text style={styles.emptySubtitle}>
              Agrega tu primera actividad para comenzar a recibir reservas
            </Text>
            <Button
              title="Agregar Actividad"
             onPress={handleAddActivity}
              size="medium"
            />
          </Card>
        ) : (
          <View style={styles.activitiesList}>
            {activities.map((activity) => (
              <Card key={activity.id} style={styles.activityCard}>
                {/* Service Image Background */}
                {activity.images && activity.images.length > 0 && (
                  <View style={styles.activityImageContainer}>
                    <Image 
                      source={{ uri: activity.images[0] }} 
                      style={styles.activityImage}
                      resizeMode="cover"
                    />
                    <View style={styles.activityImageOverlay} />
                  </View>
                )}
                
                <View style={styles.activityHeader}>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>{activity.name}</Text>
                    {activity.description && (
                      <Text style={styles.activityDescription}>{activity.description}</Text>
                    )}
                  </View>
                  <View style={[
                    styles.activityStatus,
                    { backgroundColor: activity.isActive ? '#D1FAE5' : '#FEE2E2' }
                  ]}>
                    <Text style={[
                      styles.activityStatusText,
                      { color: activity.isActive ? '#065F46' : '#991B1B' }
                    ]}>
                      {activity.isActive ? 'Activa' : 'Inactiva'}
                    </Text>
                  </View>
                </View>

                {/* Mostrar duración y precio para servicios, stock y precio para productos */}
                {businessType === 'shop' ? (
                  <View style={styles.activityDetails}>
                    <View style={styles.activityDetail}>
                      <Package size={16} color="#6B7280" />
                      <Text style={styles.activityDetailText}>
                        Stock: {activity.stock || 0}
                      </Text>
                    </View>
                    <View style={styles.activityDetail}>
                      <DollarSign size={16} color="#10B981" />
                      <Text style={styles.activityDetailText}>
                        ${activity.price.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ) : businessType !== 'boarding' && (
                  <View style={styles.activityDetails}>
                    <View style={styles.activityDetail}>
                      <Clock size={16} color="#6B7280" />
                      <Text style={styles.activityDetailText}>
                        {activity.duration} min
                      </Text>
                    </View>
                    <View style={styles.activityDetail}>
                      <DollarSign size={16} color="#10B981" />
                      <Text style={styles.activityDetailText}>
                        ${activity.price.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Mostrar info de capacidad para Pensión */}
                {businessType === 'boarding' && activity.category === 'Pensión' && (
                  <View style={styles.boardingInfo}>
                    <Text style={styles.boardingInfoText}>🏠 Hotel para mascotas</Text>
                    <Text style={styles.boardingInfoSubtext}>Capacidad configurada por categoría</Text>
                  </View>
                )}

                <View style={styles.activityActions}>
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditActivity(activity.id)}
                    >
                      <Edit size={16} color="#3B82F6" />
                    </TouchableOpacity>
                    <View style={{ flex: 2 }}>
                      <Button
                        title={activity.isActive ? 'Desactivar' : 'Activar'}
                        onPress={() => handleToggleActivity(activity.id, activity.isActive)}
                        variant={activity.isActive ? 'outline' : 'primary'}
                        size="medium"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteActivity(activity.id)}
                    >
                      <X size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Activity Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Nueva Actividad</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              {config.suggestions && config.suggestions.length > 0 && (
                <View style={styles.suggestionsSection}>
                  <Text style={styles.suggestionsTitle}>Sugerencias:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {config.suggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionCard}
                        onPress={() => handleUseSuggestion(suggestion)}
                      >
                        <Text style={styles.suggestionName}>{suggestion.name}</Text>
                        <Text style={styles.suggestionDetails}>
                          {suggestion.duration}min • ${suggestion.price.toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Input
                label="Nombre de la actividad *"
                placeholder="Ej: Consulta general, Baño completo..."
                value={activityName}
                onChangeText={setActivityName}
              />

              <Input
                label="Descripción"
                placeholder="Describe brevemente la actividad..."
                value={activityDescription}
                onChangeText={setActivityDescription}
                multiline
                numberOfLines={2}
              />

              <Input
                label="Duración (minutos) *"
                placeholder="30"
                value={activityDuration}
                onChangeText={setActivityDuration}
                keyboardType="numeric"
                leftIcon={<Clock size={20} color="#6B7280" />}
              />

              <Input
                label="Precio *"
                placeholder="5000"
                value={activityPrice}
                onChangeText={setActivityPrice}
                keyboardType="numeric"
                leftIcon={<DollarSign size={20} color="#6B7280" />}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={() => setShowAddModal(false)}
                variant="outline"
                size="medium"
              />
              <Button
                title="Agregar"
                onPress={handleAddActivity}
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
    padding: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginRight: 12,
  },
  logoPlaceholderText: {
    fontSize: 20,
  },
  businessName: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#10B981',
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  activitiesList: {
    justifyContent: 'space-between',
    marginTop: 16,
  },
  activityCard: {
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  activityImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  activityImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  activityImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    zIndex: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    position: 'relative',
    zIndex: 3,
  },
  activityInfo: {
    flex: 1,
    marginRight: 12,
    position: 'relative',
    zIndex: 3,
  },
  activityName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  activityStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    position: 'relative',
    zIndex: 3,
  },
  activityStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  activityDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    position: 'relative',
    zIndex: 3,
  },
  activityDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginLeft: 4,
  },
  activityActions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
    position: 'relative',
    zIndex: 3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#EBF8FF',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  boardingInfo: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  boardingInfoText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#065F46',
    marginBottom: 2,
  },
  boardingInfoSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#047857',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  modalForm: {
    flex: 1,
    marginBottom: 16,
  },
  suggestionsSection: {
    marginVertical: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  suggestionCard: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 120,
  },
  suggestionName: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  suggestionDetails: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
});