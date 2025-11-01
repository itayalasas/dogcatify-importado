import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, Alert } from 'react-native';
import { router } from 'expo-router';
import { Plus, Bell, Check, X, User } from 'lucide-react-native';
import { PetCard } from '../../components/PetCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getPets, supabaseClient, deletePet } from '../../lib/supabase';

interface PetShareInvitation {
  id: string;
  pet_id: string;
  owner_id: string;
  relationship_type: string;
  permission_level: string;
  created_at: string;
  pet: {
    id: string;
    name: string;
    species: string;
    photo_url: string | null;
  };
  owner: {
    id: string;
    display_name: string;
  };
}

export default function Pets() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PetShareInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  
  useEffect(() => {
    if (!currentUser) return;

    const fetchPets = async () => {
      try {
        const petsData = await getPets(currentUser.id);

        // Fetch pending invitations
        const { data: pendingData, error: pendingError } = await supabaseClient
          .from('pet_shares')
          .select(`
            id,
            pet_id,
            owner_id,
            relationship_type,
            permission_level,
            created_at,
            pets!inner (
              id,
              name,
              species,
              photo_url
            ),
            profiles!pet_shares_owner_id_fkey (
              id,
              display_name
            )
          `)
          .eq('shared_with_user_id', currentUser.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (pendingError) {
          console.error('Error fetching pending invitations:', pendingError);
        } else {
          const formattedInvitations = pendingData?.map(inv => ({
            id: inv.id,
            pet_id: inv.pet_id,
            owner_id: inv.owner_id,
            relationship_type: inv.relationship_type,
            permission_level: inv.permission_level,
            created_at: inv.created_at,
            pet: inv.pets,
            owner: inv.profiles
          })) || [];
          setPendingInvitations(formattedInvitations);
        }

        const { data: sharedPetsData, error: sharedError } = await supabaseClient
          .from('pet_shares')
          .select(`
            pet_id,
            pets!inner (
              id,
              name,
              species,
              breed,
              breed_info,
              age,
              age_display,
              gender,
              weight,
              weight_display,
              is_neutered,
              has_chip,
              chip_number,
              photo_url,
              owner_id,
              personality,
              medical_notes,
              created_at
            )
          `)
          .eq('shared_with_user_id', currentUser.id)
          .eq('status', 'accepted');

        if (sharedError) {
          console.error('Error fetching shared pets:', sharedError);
        }

        const sharedPets = sharedPetsData?.map(share => share.pets).filter(Boolean) || [];

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
          photo_url: pet.photo_url,
          isShared: false,
        })) || [];

        const transformedSharedPets = sharedPets.map(pet => ({
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
          photo_url: pet.photo_url,
          isShared: true,
        }));

        setPets([...transformedPets, ...transformedSharedPets]);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching pets:', error);
        setLoading(false);
      }
    };

    fetchPets();

    // Set up real-time subscription for pets and pet_shares
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
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pet_shares',
          filter: `shared_with_user_id=eq.${currentUser.id}`
        },
        () => {
          fetchPets();
        }
      )
      .subscribe();
    
    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [currentUser]);

  const handlePetPress = (petId: string) => {
    router.push(`/pets/${petId}`);
  };

  const handleAddPet = () => {
    router.push('/pets/add');
  };

  const handleSharePet = (petId: string) => {
    router.push(`/pets/share-pet?petId=${petId}`);
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabaseClient
        .from('pet_shares')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (error) {
        console.error('Error accepting invitation:', error);
        Alert.alert('Error', 'No se pudo aceptar la invitación');
        return;
      }

      Alert.alert('Éxito', '¡Invitación aceptada!');
      // Refresh pets list
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      // Reload pets to show the newly shared pet
      if (currentUser) {
        const petsData = await getPets(currentUser.id);
        const { data: sharedPetsData } = await supabaseClient
          .from('pet_shares')
          .select(`
            pet_id,
            pets!inner (
              id, name, species, breed, breed_info, age, age_display,
              gender, weight, weight_display, is_neutered, has_chip,
              chip_number, photo_url, owner_id, personality, medical_notes, created_at
            )
          `)
          .eq('shared_with_user_id', currentUser.id)
          .eq('status', 'accepted');

        const sharedPets = sharedPetsData?.map(share => share.pets).filter(Boolean) || [];
        const transformedPets = petsData?.map(pet => ({
          id: pet.id, name: pet.name, species: pet.species, breed: pet.breed,
          breedInfo: pet.breed_info, age: pet.age, ageDisplay: pet.age_display,
          gender: pet.gender, weight: pet.weight, weightDisplay: pet.weight_display,
          isNeutered: pet.is_neutered, hasChip: pet.has_chip, chipNumber: pet.chip_number,
          photoURL: pet.photo_url, ownerId: pet.owner_id, personality: pet.personality || [],
          medicalNotes: pet.medical_notes, createdAt: new Date(pet.created_at),
          photo_url: pet.photo_url, isShared: false,
        })) || [];
        const transformedSharedPets = sharedPets.map(pet => ({
          id: pet.id, name: pet.name, species: pet.species, breed: pet.breed,
          breedInfo: pet.breed_info, age: pet.age, ageDisplay: pet.age_display,
          gender: pet.gender, weight: pet.weight, weightDisplay: pet.weight_display,
          isNeutered: pet.is_neutered, hasChip: pet.has_chip, chipNumber: pet.chip_number,
          photoURL: pet.photo_url, ownerId: pet.owner_id, personality: pet.personality || [],
          medicalNotes: pet.medical_notes, createdAt: new Date(pet.created_at),
          photo_url: pet.photo_url, isShared: true,
        }));
        setPets([...transformedPets, ...transformedSharedPets]);
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Ocurrió un error al aceptar la invitación');
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    Alert.alert(
      'Rechazar Invitación',
      '¿Estás seguro de que quieres rechazar esta invitación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('pet_shares')
                .update({ status: 'rejected' })
                .eq('id', invitationId);

              if (error) {
                console.error('Error rejecting invitation:', error);
                Alert.alert('Error', 'No se pudo rechazar la invitación');
                return;
              }

              setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
              Alert.alert('Rechazada', 'Invitación rechazada');
            } catch (error) {
              console.error('Error rejecting invitation:', error);
              Alert.alert('Error', 'Ocurrió un error al rechazar la invitación');
            }
          }
        }
      ]
    );
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
          <LoadingSpinner message="Cargando mascotas..." size="medium" />
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
        {pendingInvitations.length > 0 && (
          <View style={styles.invitationsSection}>
            <View style={styles.invitationsHeader}>
              <Bell size={20} color="#10B981" />
              <Text style={styles.invitationsTitle}>
                Invitaciones Pendientes ({pendingInvitations.length})
              </Text>
            </View>
            {pendingInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.invitationCard}>
                <View style={styles.invitationInfo}>
                  <View style={styles.invitationPetInfo}>
                    {invitation.pet.photo_url ? (
                      <View style={styles.invitationPetImage}>
                        <Text style={styles.invitationPetEmoji}>
                          {invitation.pet.species === 'dog' ? '🐕' : '🐈'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.invitationPetImage}>
                        <Text style={styles.invitationPetEmoji}>
                          {invitation.pet.species === 'dog' ? '🐕' : '🐈'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.invitationTextInfo}>
                      <Text style={styles.invitationPetName}>{invitation.pet.name}</Text>
                      <View style={styles.invitationOwnerInfo}>
                        <User size={14} color="#6B7280" />
                        <Text style={styles.invitationOwnerName}>
                          {invitation.owner.display_name || 'Usuario'}
                        </Text>
                      </View>
                      <Text style={styles.invitationRelationship}>
                        Como: {invitation.relationship_type === 'veterinarian' ? 'Veterinario' :
                              invitation.relationship_type === 'family' ? 'Familiar' :
                              invitation.relationship_type === 'friend' ? 'Amigo' :
                              invitation.relationship_type === 'caretaker' ? 'Cuidador' : 'Otro'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.invitationActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptInvitation(invitation.id)}
                  >
                    <Check size={18} color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>Aceptar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleRejectInvitation(invitation.id)}
                  >
                    <X size={18} color="#EF4444" />
                    <Text style={styles.rejectButtonText}>Rechazar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
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
                  onDelete={pet.ownerId === currentUser?.id ? handleDeletePet : undefined}
                  onShare={pet.ownerId === currentUser?.id ? handleSharePet : undefined}
                  isShared={pet.isShared}
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
  invitationsSection: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  invitationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  invitationsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    marginLeft: 8,
  },
  invitationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  invitationInfo: {
    marginBottom: 12,
  },
  invitationPetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invitationPetImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  invitationPetEmoji: {
    fontSize: 32,
  },
  invitationTextInfo: {
    flex: 1,
  },
  invitationPetName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  invitationOwnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  invitationOwnerName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  invitationRelationship: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#10B981',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  acceptButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
  },
});