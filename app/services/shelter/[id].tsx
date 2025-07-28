import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Phone, MessageCircle, Heart, MapPin, Calendar, Scale, Star } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '../../../lib/supabase';

export default function ShelterAdoptions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [shelter, setShelter] = useState<any>(null);
  const [adoptionPets, setAdoptionPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShelterData();
    fetchAdoptionPets();
  }, [id]);

  const fetchShelterData = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', id)
        .eq('business_type', 'shelter')
        .single();
      
      if (error) throw error;
      
      if (data) {
        setShelter({
          id: data.id,
          businessName: data.business_name,
          address: data.address,
          phone: data.phone,
          email: data.email,
          logo: data.logo,
          description: data.description,
        });
      }
    } catch (error) {
      console.error('Error fetching shelter data:', error);
    }
  };

  const fetchAdoptionPets = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('adoption_pets')
        .select('*')
        .eq('partner_id', id)
        .eq('is_available', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setAdoptionPets(data || []);
    } catch (error) {
      console.error('Error fetching adoption pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCallShelter = async () => {
    if (!shelter?.phone) {
      Alert.alert('Error', 'No hay número de teléfono disponible');
      return;
    }

    try {
      const phoneUrl = `tel:${shelter.phone}`;
      const canOpen = await Linking.canOpenURL(phoneUrl);
      
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'No se puede abrir la aplicación de llamadas');
      }
    } catch (error) {
      console.error('Error opening phone app:', error);
      Alert.alert('Error', 'No se pudo realizar la llamada');
    }
  };

  const handleStartAdoptionChat = async (pet: any) => {
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Debes iniciar sesión para contactar sobre adopciones');
      return;
    }

    try {
      // Check if conversation already exists
      const { data: existingConversation, error: checkError } = await supabaseClient
        .from('chat_conversations')
        .select('id')
        .eq('adoption_pet_id', pet.id)
        .eq('user_id', currentUser.id)
        .single();

      let conversationId;

      if (checkError && checkError.code === 'PGRST116') {
        // No existing conversation, create new one
        const { data: newConversation, error: createError } = await supabaseClient
          .from('chat_conversations')
          .insert({
            adoption_pet_id: pet.id,
            partner_id: id,
            user_id: currentUser.id,
            status: 'active'
          })
          .select('id')
          .single();

        if (createError) throw createError;
        conversationId = newConversation.id;

        // Send initial system message
        await supabaseClient
          .from('chat_messages')
          .insert({
            conversation_id: conversationId,
            sender_id: currentUser.id,
            message: `Hola! Estoy interesado/a en adoptar a ${pet.name}. ¿Podrían darme más información?`,
            message_type: 'text'
          });
      } else if (existingConversation) {
        conversationId = existingConversation.id;
      } else {
        throw checkError;
      }

      // Navigate to chat
      router.push(`/chat/${conversationId}?petName=${pet.name}`);
    } catch (error) {
      console.error('Error starting adoption chat:', error);
      Alert.alert('Error', 'No se pudo iniciar la conversación');
    }
  };

  const formatAge = (age: number, unit: string) => {
    if (unit === 'years') {
      return `${age} ${age === 1 ? 'año' : 'años'}`;
    } else {
      return `${age} ${age === 1 ? 'mes' : 'meses'}`;
    }
  };

  const getSizeLabel = (size: string) => {
    const sizes = {
      small: 'Pequeño',
      medium: 'Mediano',
      large: 'Grande'
    };
    return sizes[size as keyof typeof sizes] || size;
  };

  const getTemperamentText = (temperament: string[]) => {
    if (!temperament || temperament.length === 0) return 'Temperamento por evaluar';
    return temperament.slice(0, 3).join(', ') + (temperament.length > 3 ? '...' : '');
  };

  const renderPetCard = (pet: any) => (
    <Card key={pet.id} style={styles.petCard}>
      {/* Pet Image */}
      {pet.images && pet.images.length > 0 ? (
        <Image source={{ uri: pet.images[0] }} style={styles.petImage} />
      ) : (
        <View style={styles.petImagePlaceholder}>
          <Text style={styles.petImagePlaceholderText}>
            {pet.species === 'dog' ? '🐶' : pet.species === 'cat' ? '🐱' : '🐾'}
          </Text>
        </View>
      )}

      {/* Pet Info */}
      <View style={styles.petInfo}>
        <View style={styles.petHeader}>
          <Text style={styles.petName}>
            {pet.species === 'dog' ? '🐶' : '🐱'} Nombre: {pet.name}
          </Text>
          <View style={styles.genderBadge}>
            <Text style={styles.genderText}>
              {pet.gender === 'male' ? '♂️' : '♀️'}
            </Text>
          </View>
        </View>

        <Text style={styles.petBasicInfo}>
          Edad: {formatAge(pet.age, pet.age_unit)} | Tamaño: {getSizeLabel(pet.size)} | Raza: {pet.breed}
        </Text>

        {/* Health Status */}
        <View style={styles.healthStatus}>
          {pet.is_vaccinated && (
            <View style={styles.healthBadge}>
              <Text style={styles.healthBadgeText}>Vacunado</Text>
            </View>
          )}
          {pet.is_neutered && (
            <View style={styles.healthBadge}>
              <Text style={styles.healthBadgeText}>Castrado</Text>
            </View>
          )}
          {pet.is_dewormed && (
            <View style={styles.healthBadge}>
              <Text style={styles.healthBadgeText}>Desparasitado</Text>
            </View>
          )}
        </View>

        <Text style={styles.petDescription} numberOfLines={3}>
          {pet.description}
        </Text>

        {/* Temperament */}
        <Text style={styles.temperamentText}>
          {getTemperamentText(pet.temperament)}
        </Text>

        {/* Adoption Requirements */}
        {pet.adoption_requirements && pet.adoption_requirements.length > 0 && (
          <View style={styles.requirementsSection}>
            <Text style={styles.requirementsTitle}>🏡 {pet.adoption_requirements.slice(0, 2).join(', ')}</Text>
            {pet.adoption_requirements.length > 2 && (
              <Text style={styles.requirementsMore}>+{pet.adoption_requirements.length - 2} más</Text>
            )}
          </View>
        )}

        {/* Location */}
        <View style={styles.locationSection}>
          <MapPin size={14} color="#6B7280" />
          <Text style={styles.locationText}>
            {pet.adoption_zones || 'Consultar zona de adopción'}
          </Text>
        </View>

        {/* Contact Info */}
        <View style={styles.contactSection}>
          <Text style={styles.contactText}>
            📞 Contacto: {pet.contact_info || shelter?.email || 'Contactar refugio'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.callButton}
            onPress={handleCallShelter}
          >
            <Phone size={16} color="#FFFFFF" />
            <Text style={styles.callButtonText}>Llamar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.adoptButton}
            onPress={() => handleStartAdoptionChat(pet)}
          >
            <MessageCircle size={16} color="#FFFFFF" />
            <Text style={styles.adoptButtonText}>Adopción</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando mascotas en adopción...</Text>
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
        <Text style={styles.title}>Adopciones</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Shelter Info */}
        <Card style={styles.shelterCard}>
          <View style={styles.shelterHeader}>
            {shelter?.logo ? (
              <Image source={{ uri: shelter.logo }} style={styles.shelterLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>🐾</Text>
              </View>
            )}
            
            <View style={styles.shelterInfo}>
              <Text style={styles.shelterName}>{shelter?.businessName || 'Refugio'}</Text>
              <View style={styles.shelterDetail}>
                <MapPin size={14} color="#6B7280" />
                <Text style={styles.shelterDetailText}>
                  {shelter?.address || 'Ubicación no disponible'}
                </Text>
              </View>
              <View style={styles.shelterDetail}>
                <Phone size={14} color="#6B7280" />
                <Text style={styles.shelterDetailText}>
                  {shelter?.phone || 'Teléfono no disponible'}
                </Text>
              </View>
            </View>
          </View>
          
          {shelter?.description && (
            <Text style={styles.shelterDescription}>{shelter.description}</Text>
          )}
        </Card>

        {/* Adoption Pets */}
        <View style={styles.petsSection}>
          <Text style={styles.sectionTitle}>
            🐾 Mascotas en Adopción ({adoptionPets.length})
          </Text>
          
          {adoptionPets.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Heart size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No hay mascotas disponibles</Text>
              <Text style={styles.emptySubtitle}>
                Este refugio no tiene mascotas en adopción en este momento
              </Text>
            </Card>
          ) : (
            adoptionPets.map(renderPetCard)
          )}
        </View>
      </ScrollView>
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
  shelterCard: {
    marginBottom: 16,
  },
  shelterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shelterLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoPlaceholderText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  shelterInfo: {
    flex: 1,
  },
  shelterName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  shelterDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  shelterDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  shelterDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  petsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  petCard: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  petImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  petImagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  petImagePlaceholderText: {
    fontSize: 48,
  },
  petInfo: {
    padding: 16,
  },
  petHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  petName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    flex: 1,
  },
  genderBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  genderText: {
    fontSize: 16,
  },
  petBasicInfo: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 12,
  },
  healthStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  healthBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  healthBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#065F46',
  },
  petDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  temperamentText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 12,
  },
  requirementsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requirementsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
  },
  requirementsMore: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  contactSection: {
    marginBottom: 16,
  },
  contactText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  callButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  adoptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  adoptButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
});