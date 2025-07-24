import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { PetCard } from '../../components/PetCard'; 
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getPets, supabaseClient } from '../../lib/supabase';

export default function Pets() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  
  useEffect(() => {
    if (!currentUser) return;

    const fetchPets = async () => {
      try {
        const petsData = await getPets(currentUser.id);

        // Transform data to match the expected format
        const transformedPets = petsData?.map(pet => ({
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          breedInfo: pet.breed_info,
          age: pet.age,
          ageDisplay: pet.age_display,
          gender: pet.gender,
          weight: pet.weight,
          weightDisplay: pet.weight_display,
          isNeutered: pet.is_neutered,
          hasChip: pet.has_chip,
          chipNumber: pet.chip_number,
          photoURL: pet.photo_url,
          ownerId: pet.owner_id,
          personality: pet.personality || [],
          medicalNotes: pet.medical_notes,
          createdAt: new Date(pet.created_at),
          photo_url: pet.photo_url, // Añadir el campo photo_url directamente
        }));

        setPets(transformedPets || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching pets:', error);
        setLoading(false);
      }
    };

    fetchPets();

    // Set up real-time subscription for pets
    const subscription = supabaseClient
      .channel('pets-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'pets',
          filter: `owner_id=eq.${currentUser.id}`
        }, 
        () => {
          fetchPets();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser]);

  const handlePetPress = (petId: string) => {
    router.push(`/pets/${petId}`);
  };

  const handleAddPet = () => {
    router.push('/pets/add');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>        
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Mis Mascotas</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddPet}>
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Cargando mascotas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Mis Mascotas</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddPet}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.petsContainer}>
          {pets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>¡Agrega tu primera mascota! 🐾</Text>
              <Text style={styles.emptySubtitle}>
                Comienza creando el perfil de tu compañero peludo
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddPet}>
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Agregar Mascota</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {pets.map((pet) => (
                <PetCard
                  key={pet.id}
                  pet={pet}
                  onPress={() => handlePetPress(pet.id)}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 30, // Add padding at the top to show status bar
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
  },
  addButton: {
    backgroundColor: '#10B981',
    padding: 8,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  petsContainer: {
    padding: 5,
    paddingTop: 16,
    position: 'relative',
    minHeight: 500,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 100,
    height: 500,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D6A6F',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minHeight: 44,
  },
  emptyButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginLeft: 6,
  },
});