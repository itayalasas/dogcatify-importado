import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Phone, MessageCircle, Heart, MapPin, Calendar, Scale, Star } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { LoadingScreen } from '../../../components/ui/LoadingScreen';
import { ScreenHeader, Badge, EmptyState } from '../../../components/ui';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '../../../lib/supabase';

export default function ShelterAdoptions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [shelter, setShelter] = useState<any>(null);
  const [adoptionPets, setAdoptionPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/services');
  };

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
      Alert.alert('Iniciar sesión', 'Tenés que iniciar sesión para consultar sobre adopciones.');
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
            {pet.species === 'dog' ? '🐶' : pet.species === 'cat' ? '🐱' : '🐾'} {pet.name}
          </Text>
          <Badge label={pet.gender === 'male' ? 'Macho' : 'Hembra'} tone="neutral" size="small" />
        </View>

        <Text style={styles.petBasicInfo}>
          {formatAge(pet.age, pet.age_unit)} · {getSizeLabel(pet.size)} · {pet.breed}
        </Text>

        {/* Health Status */}
        <View style={styles.healthStatus}>
          {pet.is_vaccinated && (
            <Badge label="Vacunado" tone="success" size="small" />
          )}
          {pet.is_neutered && (
            <Badge label="Castrado" tone="success" size="small" />
          )}
          {pet.is_dewormed && (
            <Badge label="Desparasitado" tone="success" size="small" />
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
          <MapPin size={14} color={colors.textTertiary} />
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
          <Button
            title="Llamar"
            variant="outline"
            fullWidth={false}
            style={styles.actionButton}
            icon={<Phone size={16} color={colors.primary} />}
            onPress={handleCallShelter}
            accessibilityLabel={`Llamar al refugio por ${pet.name}`}
          />

          <Button
            title="Quiero adoptar"
            variant="primary"
            fullWidth={false}
            style={styles.actionButton}
            icon={<MessageCircle size={16} color={colors.onPrimary} />}
            onPress={() => handleStartAdoptionChat(pet)}
            accessibilityLabel={`Iniciar adopción de ${pet.name}`}
          />
        </View>
      </View>
    </Card>
  );

  if (loading) {
    return <LoadingScreen message="Cargando mascotas en adopción..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Adopciones" onBack={handleBackPress} />

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
                <MapPin size={14} color={colors.textTertiary} />
                <Text style={styles.shelterDetailText}>
                  {shelter?.address || 'Ubicación no disponible'}
                </Text>
              </View>
              <View style={styles.shelterDetail}>
                <Phone size={14} color={colors.textTertiary} />
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
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Mascotas en adopción ({adoptionPets.length})
          </Text>
          
          {adoptionPets.length === 0 ? (
            <EmptyState
              icon={<Heart size={32} color={colors.primary} />}
              title="No hay mascotas disponibles"
              description="Este refugio no tiene mascotas en adopción en este momento."
            />
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
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
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
    color: colors.textSecondary,
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
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoPlaceholderText: {
    fontSize: 24,
    color: colors.white,
  },
  shelterInfo: {
    flex: 1,
  },
  shelterName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
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
    color: colors.textSecondary,
    marginLeft: 4,
  },
  shelterDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  petsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
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
    backgroundColor: colors.surfaceAlt,
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
    color: colors.text,
    flex: 1,
  },
  genderBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  genderText: {
    fontSize: 16,
  },
  petBasicInfo: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
    marginBottom: 12,
  },
  healthStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  healthBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  healthBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#065F46',
  },
  petDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  temperamentText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
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
    color: colors.text,
    flex: 1,
  },
  requirementsMore: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  contactSection: {
    marginBottom: 16,
  },
  contactText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.sm,
    gap: 6,
  },
  callButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.white,
  },
  adoptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingVertical: 12,
    borderRadius: radius.sm,
    gap: 6,
  },
  adoptButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.white,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionButton: {
    flex: 1,
  },
});