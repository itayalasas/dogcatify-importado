import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Clock, DollarSign, X } from 'lucide-react-native';
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
      const { data, error } = await supabaseClient
        .from('partner_services')
        .select('*')
        .eq('partner_id', partnerId);
      
      if (error) throw error;
      
      const activitiesData = data.map(activity => ({
        id: activity.id,
        name: activity.name,
        description: activity.description || '',
        duration: activity.duration || 0,
        price: activity.price || 0,
        isActive: activity.is_active
      })) as Activity[];
      
      setActivities(activitiesData);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('activities-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'partner_services',
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
    if (!activityName.trim() || !activityDuration || !activityPrice) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      const serviceData = {
        partner_id: partnerId,
        name: activityName.trim(),
        description: activityDescription.trim() || '',
        duration: parseInt(activityDuration),
        price: parseFloat(activityPrice),
        is_active: true,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('partner_services')
        .insert(serviceData);
      
      if (error) throw error;
      
      // Reset form
      setActivityName('');
      setActivityDescription('');
      setActivityDuration('');
      setActivityPrice('');
      setShowAddModal(false);
      
      Alert.alert('Éxito', 'Actividad agregada correctamente');
    } catch (error) {
      console.error('Error adding activity:', error);
      Alert.alert('Error', 'No se pudo agregar la actividad');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActivity = async (activityId: string, isActive: boolean) => {
    try {
      const { error } = await supabaseClient
        .from('partner_services')
        .update({
          is_active: !isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', activityId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error toggling activity:', error);
      Alert.alert('Error', 'No se pudo actualizar la actividad');
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    Alert.alert(
      'Eliminar Actividad',
      '¿Estás seguro de que quieres eliminar esta actividad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('partner_services')
                .delete()
                .eq('id', activityId);
              
              if (error) throw error;
              
              Alert.alert('Éxito', 'Actividad eliminada correctamente');
            } catch (error) {
              console.error('Error deleting activity:', error);
              Alert.alert('Error', 'No se pudo eliminar la actividad');
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
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>{config.title}</Text>
          <Text style={styles.infoDescription}>
            Define las actividades que ofreces para que los clientes puedan hacer reservas
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
              onPress={() => setShowAddModal(true)}
              size="medium"
            />
          </Card>
        ) : (
          <View style={styles.activitiesList}>
            {activities.map((activity) => (
              <Card key={activity.id} style={styles.activityCard}>
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

                <View style={styles.activityActions}>
                  <Button
                    title={activity.isActive ? 'Desactivar' : 'Activar'}
                    onPress={() => handleToggleActivity(activity.id, activity.isActive)}
                    variant={activity.isActive ? 'outline' : 'primary'}
                    size="small"
                  />
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteActivity(activity.id)}
                  >
                    <X size={16} color="#EF4444" />
                  </TouchableOpacity>
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
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityInfo: {
    flex: 1,
    marginRight: 12,
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
  },
  activityStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  activityDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
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