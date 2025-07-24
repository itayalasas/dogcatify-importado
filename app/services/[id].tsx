import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Modal, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Clock, Phone, Calendar, Star } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [service, setService] = useState<any>(null);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [userPets, setUserPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [loadingPets, setLoadingPets] = useState(false);

  useEffect(() => {
    fetchServiceDetails();
    if (currentUser) {
      fetchUserPets();
    }
  }, [id, currentUser]);

  const fetchServiceDetails = async () => {
    try {
      const { data: serviceData, error } = await supabaseClient
        .from('partner_services')
        .select('*')
        .eq('id', id)
        .single();
      
      if (serviceData && !error) {
        setService({
          id: serviceData.id,
          name: serviceData.name,
          description: serviceData.description,
          price: serviceData.price,
          duration: serviceData.duration,
          category: serviceData.category,
          images: serviceData.images,
          partnerId: serviceData.partner_id,
          createdAt: new Date(serviceData.created_at),
        });
        
        // Fetch partner info
        if (serviceData.partner_id) {
          const { data: partnerData, error: partnerError } = await supabaseClient
            .from('partners')
            .select('*')
            .eq('id', serviceData.partner_id)
            .single();
            
          if (partnerData && !partnerError) {
            setPartnerInfo({
              id: partnerData.id,
              businessName: partnerData.business_name,
              businessType: partnerData.business_type,
              address: partnerData.address,
              phone: partnerData.phone,
              logo: partnerData.logo,
              rating: partnerData.rating,
              reviewsCount: partnerData.reviews_count,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching service details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPets = async () => {
    setLoadingPets(true);
    try {
      const { data: petsData, error } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('owner_id', currentUser!.id);
      
      if (petsData && !error) {
        setUserPets(petsData);
      }
    } catch (error) {
      console.error('Error fetching user pets:', error);
    } finally {
      setLoadingPets(false);
    }
  };

  const handleBookService = () => {
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Debes iniciar sesión para reservar servicios');
      return;
    }
    
    setShowBookingModal(true);
  };

  const handleSelectPet = (petId: string) => {
    setSelectedPet(petId);
    // Navigate to booking screen with service and pet info
    router.push({
      pathname: '/services/booking',
      params: { 
        serviceId: id,
        partnerId: service.partnerId,
        petId: petId
      }
    });
    setShowBookingModal(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando detalles del servicio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontró el servicio</Text>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace(`/services/partner/${service.partnerId}`)} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Detalle del Servicio</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Partner Profile Card */}
        <Card style={styles.partnerCard}>
          <View style={styles.partnerHeader}>
            {partnerInfo?.logo ? (
              <Image source={{ uri: partnerInfo.logo }} style={styles.partnerLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {partnerInfo?.businessType === 'veterinary' ? '🏥' : 
                   partnerInfo?.businessType === 'grooming' ? '✂️' : 
                   partnerInfo?.businessType === 'walking' ? '🚶' : 
                   partnerInfo?.businessType === 'boarding' ? '🏠' : 
                   partnerInfo?.businessType === 'shop' ? '🛍️' : '🏢'}
                </Text>
              </View>
            )}
            
            <View style={styles.partnerInfo}>
              <Text style={styles.partnerName}>{partnerInfo?.businessName || 'Negocio'}</Text>
              
              <View style={styles.partnerDetails}>
                <View style={styles.partnerDetail}>
                  <MapPin size={14} color="#6B7280" />
                  <Text style={styles.partnerDetailText} numberOfLines={1}>
                    {partnerInfo?.address || 'Ubicación no disponible'}
                  </Text>
                </View>
                
                <View style={styles.partnerDetail}>
                  <Phone size={14} color="#6B7280" />
                  <Text style={styles.partnerDetailText}>
                    {partnerInfo?.phone || 'Teléfono no disponible'}
                  </Text>
                </View>
              </View>
              
              {partnerInfo?.rating !== undefined && (
                <View style={styles.ratingContainer}>
                  <Star size={16} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.ratingText}>{partnerInfo.rating}</Text>
                  <Text style={styles.reviewsText}>
                    ({partnerInfo.reviewsCount || 0} reseñas)
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* Service Details */}
        <Card style={styles.serviceCard}>
          <Text style={styles.sectionTitle}>Detalles del Servicio</Text>
          
          <Text style={styles.serviceName}>{service.name}</Text>
          
          <View style={styles.serviceDetails}>
            <View style={styles.serviceDetail}>
              <Clock size={16} color="#6B7280" />
              <Text style={styles.serviceDetailText}>
                {service.duration || 60} minutos
              </Text>
            </View>
            
            <Text style={styles.servicePrice}>
              {formatPrice(service.price)}
            </Text>
          </View>
          
          <Text style={styles.descriptionTitle}>Descripción</Text>
          <Text style={styles.descriptionText}>
            {service.description || 'No hay descripción disponible para este servicio.'}
          </Text>
          
          {service.images && service.images.length > 0 && (
            <View style={styles.imagesContainer}>
              <Text style={styles.imagesTitle}>Imágenes</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {service.images.map((imageUrl: string, index: number) => (
                  <Image 
                    key={index} 
                    source={{ uri: imageUrl }} 
                    style={styles.serviceImage} 
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </Card>
        
        <View style={styles.bookingButtonContainer}>
          <Button
            title="Reservar Servicio"
            onPress={handleBookService}
            size="large"
          />
        </View>
      </ScrollView>
      
      {/* Pet Selection Modal */}
      <Modal
        visible={showBookingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBookingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecciona tu mascota</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowBookingModal(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {loadingPets ? (
              <View style={styles.loadingPetsContainer}>
                <Text style={styles.loadingPetsText}>Cargando tus mascotas...</Text>
              </View>
            ) : userPets.length === 0 ? (
              <View style={styles.noPetsContainer}>
                <Text style={styles.noPetsTitle}>No tienes mascotas registradas</Text>
                <Text style={styles.noPetsText}>
                  Agrega una mascota para poder reservar servicios
                </Text>
                <Button
                  title="Agregar Mascota"
                  onPress={() => {
                    setShowBookingModal(false);
                    router.push('/pets/add');
                  }}
                  size="medium"
                />
              </View>
            ) : (
              <View style={styles.petsList}>
                {userPets.map((pet) => (
                  <TouchableOpacity
                    key={pet.id}
                    style={styles.petItem}
                    onPress={() => handleSelectPet(pet.id)}
                  >
                    <Image 
                      source={{ uri: pet.photo_url || pet.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100' }} 
                      style={styles.petImage} 
                    />
                    <View style={styles.petInfo}>
                      <Text style={styles.petName}>{pet.name}</Text>
                      <Text style={styles.petBreed}>{pet.breed}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
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
    padding: 8,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  partnerCard: {
    marginBottom: 16,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  logoPlaceholderText: {
    fontSize: 32,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  partnerDetails: {
    marginBottom: 8,
  },
  partnerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  serviceCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 12,
  },
  serviceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  serviceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 4,
  },
  servicePrice: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  descriptionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  imagesContainer: {
    marginBottom: 16,
  },
  imagesTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  serviceImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
  },
  bookingButtonContainer: {
    marginBottom: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
  },
  loadingPetsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingPetsText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  noPetsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noPetsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  noPetsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  petsList: {
    maxHeight: 400,
  },
  petItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  petImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  petBreed: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
});