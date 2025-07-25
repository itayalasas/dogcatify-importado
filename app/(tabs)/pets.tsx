import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { PetCard } from '../../components/PetCard'; 
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getPets, supabaseClient, deletePet } from '../../lib/supabase';

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

  const handleDeletePet = async (petId: string) => {
    const petToDelete = pets.find(p => p.id === petId);
    if (!petToDelete) return;

    // Check and refresh session before deletion
    try {
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session) {
        Alert.alert(
          'Sesión expirada',
          'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
          [
            { 
              text: 'OK', 
              onPress: () => router.replace('/auth/login')
            }
          ]
        );
        return;
      }
    } catch (error) {
      console.error('Error checking session:', error);
      Alert.alert('Error', 'No se pudo verificar la sesión');
      return;
    }

    Alert.alert(
      'Eliminar Mascota',
      `¿Estás seguro de que quieres eliminar a ${petToDelete.name}? Esta acción eliminará toda la información relacionada (registros de salud, álbumes, publicaciones) y no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Double-check session before proceeding
              const { data: { session } } = await supabaseClient.auth.getSession();
              if (!session) {
                Alert.alert('Error', 'Sesión expirada. Por favor inicia sesión nuevamente.');
                router.replace('/auth/login');
                return;
              }

              console.log('Starting pet deletion process for:', petToDelete.name);
              
              // Step 1: Check if pet has any posts
              console.log('Step 1: Checking for posts...');
              const { data: petPosts, error: getPostsError } = await supabaseClient
                .from('posts')
                .select('id', { count: 'exact' })
                .eq('pet_id', petId);
              
              if (getPostsError) {
                console.error('Error getting posts:', getPostsError);
                if (getPostsError.message?.includes('JWT expired')) {
                  Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente.');
                  router.replace('/auth/login');
                  return;
                }
              }
              
              console.log(`Found ${petPosts?.length || 0} posts for this pet`);
              
              // Step 2: Only delete comments if there are posts
              if (petPosts && petPosts.length > 0) {
                console.log(`Step 2: Deleting comments for ${petPosts.length} posts...`);
                
                for (const post of petPosts) {
                  const { data: allComments, error: getCommentsError } = await supabaseClient
                    .from('comments')
                    .select('id')
                    .eq('post_id', post.id);
                  
                  if (getCommentsError) {
                    console.error(`Error getting comments for post ${post.id}:`, getCommentsError);
                    if (getCommentsError.message?.includes('JWT expired')) {
                      Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente.');
                      router.replace('/auth/login');
                      return;
                    }
                    continue; // Skip this post if we can't get comments
                  }
                  
                  if (allComments && allComments.length > 0) {
                    console.log(`Deleting ${allComments.length} comments for post ${post.id}`);
                    for (const comment of allComments) {
                      const { error: deleteCommentError } = await supabaseClient
                        .from('comments')
                        .delete()
                        .eq('id', comment.id);
                      
                      if (deleteCommentError) {
                        console.error(`Error deleting comment ${comment.id}:`, deleteCommentError);
                        // Continue even if individual comment deletion fails
                      }
                    }
                  }
                }
                console.log('Comments deleted successfully');
              } else {
                console.log('No posts found, skipping comment deletion');
              }

              // Step 3: Only delete posts if there are any
              if (petPosts && petPosts.length > 0) {
                console.log('Step 3: Deleting posts...');
                const { error: postsError } = await supabaseClient
                  .from('posts')
                  .delete()
                  .eq('pet_id', petId);
                
                if (postsError) {
                  console.error('Error deleting posts:', postsError);
                  if (postsError.message?.includes('JWT expired')) {
                    Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente.');
                    router.replace('/auth/login');
                    return;
                  }
                  // Don't throw error, just log it and continue
                  console.log('Continuing despite posts deletion error...');
                } else {
                  console.log('Posts deleted successfully');
                }
              } else {
                console.log('No posts to delete');
              }

              console.log('Step 4: Deleting bookings...');
              const { error: bookingsError } = await supabaseClient
                .from('bookings')
                .delete()
                .eq('pet_id', petId);
              
              if (bookingsError) {
                console.error('Error deleting bookings:', bookingsError);
                console.log('Continuing despite bookings deletion error...');
              } else {
                console.log('Bookings deleted successfully');
              }

              console.log('Step 5: Deleting health records...');
              const { error: healthError } = await supabaseClient
                .from('pet_health')
                .delete()
                .eq('pet_id', petId);
              
              if (healthError) {
                console.error('Error deleting health records:', healthError);
                console.log('Continuing despite health records deletion error...');
              } else {
                console.log('Health records deleted successfully');
              }

              console.log('Step 6: Deleting albums...');
              const { error: albumsError } = await supabaseClient
                .from('pet_albums')
                .delete()
                .eq('pet_id', petId);
              
              if (albumsError) {
                console.error('Error deleting albums:', albumsError);
                console.log('Continuing despite albums deletion error...');
              } else {
                console.log('Albums deleted successfully');
              }

              console.log('Step 7: Deleting behavior records...');
              const { error: behaviorError } = await supabaseClient
                .from('pet_behavior')
                .delete()
                .eq('pet_id', petId);
              
              if (behaviorError) {
                console.error('Error deleting behavior records:', behaviorError);
                console.log('Continuing despite behavior records deletion error...');
              } else {
                console.log('Behavior records deleted successfully');
              }
              
              console.log('Step 8: Now deleting the pet...');
              const { error: petError } = await supabaseClient
                .from('pets')
                .delete()
                .eq('id', petId);
              
              if (petError) {
                console.error('Error deleting pet:', petError);
                if (petError.message?.includes('JWT expired')) {
                  Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente.');
                  router.replace('/auth/login');
                  return;
                }
                Alert.alert('Error', `No se pudo eliminar la mascota: ${petError.message}`);
                return;
              }
              
              console.log('Pet deleted successfully');
              
              // Update local state to remove the deleted pet
              setPets(prevPets => prevPets.filter(pet => pet.id !== petId));
              
              Alert.alert('Éxito', `${petToDelete.name} ha sido eliminado correctamente`);
            } catch (error) {
              console.error('Error deleting pet:', error);
              
              // Handle JWT expiration specifically
              if (error && typeof error === 'object' && 'message' in error && 
                  error.message.includes('JWT expired')) {
                Alert.alert(
                  'Sesión expirada',
                  'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
                  [
                    { 
                      text: 'OK', 
                      onPress: () => router.replace('/auth/login')
                    }
                  ]
                );
                return;
              }
              
              // Show more specific error message for other errors
              let errorMessage = 'No se pudo eliminar la mascota';
              if (error && typeof error === 'object' && 'message' in error) {
                errorMessage = `Error: ${error.message}`;
              }
              
              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>        
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>{t('myPets')}</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddPet}>
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>{t('loadingPets')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('myPets')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddPet}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.petsContainer}>
          {pets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{t('addFirstPet')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('createPetProfile')}
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddPet}>
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>{t('addPet')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {pets.map((pet) => (
                <PetCard
                  key={pet.id}
                  pet={pet}
                  onPress={() => handlePetPress(pet.id)}
                  onDelete={handleDeletePet}
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