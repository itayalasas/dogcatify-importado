import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Plus, Bell, Check, X, User, PawPrint } from 'lucide-react-native';
import { PetListCard, PetListCardSkeleton } from '../../components/pets/PetListCard';
import { EmptyState, IconButton, Badge, toast } from '../../components/ui';
import { colors, radius, spacing, typography, shadows } from '../../constants/theme';
import { OneTimeTooltip } from '../../components/ui/OneTimeTooltip';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getPets, supabaseClient, deletePet } from '../../lib/supabase';
import { Pet } from '../../types';

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

const getFirstRecord = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const normalizePetRecord = (pet: any, options: { isShared?: boolean; permissionLevel?: string } = {}) => {
  if (!pet) return null;

  return {
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
    isShared: options.isShared ?? false,
    ...(options.permissionLevel ? { permissionLevel: options.permissionLevel } : {}),
  };
};

const normalizeInvitation = (inv: any): PetShareInvitation | null => {
  const pet = getFirstRecord(inv?.pets);
  const owner = getFirstRecord(inv?.profiles);

  if (!pet || !owner) {
    return null;
  }

  return {
    id: inv.id,
    pet_id: inv.pet_id,
    owner_id: inv.owner_id,
    relationship_type: inv.relationship_type,
    permission_level: inv.permission_level,
    created_at: inv.created_at,
    pet: {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      photo_url: pet.photo_url ?? null,
    },
    owner: {
      id: owner.id,
      display_name: owner.display_name,
    },
  };
};

export default function Pets() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PetShareInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchPetsRef = useRef<(() => Promise<void>) | null>(null);
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
          const formattedInvitations = ((pendingData as any[] | null) || [])
            .map(normalizeInvitation)
            .filter(Boolean) as PetShareInvitation[];

          setPendingInvitations(formattedInvitations);
        }

        const { data: sharedPetsData, error: sharedError } = await supabaseClient
          .from('pet_shares')
          .select(`
            pet_id,
            permission_level,
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

        const ownPets = ((petsData as any[] | null) || [])
          .map((pet) => normalizePetRecord(pet, { isShared: false }))
          .filter(Boolean);

        const sharedPets = ((sharedPetsData as any[] | null) || [])
          .map((share) => {
            const pet = getFirstRecord(share?.pets);
            return normalizePetRecord(pet, {
              isShared: true,
              permissionLevel: share?.permission_level,
            });
          })
          .filter(Boolean);

        setPets([...(ownPets as Pet[]), ...(sharedPets as Pet[])]);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching pets:', error);
        setLoading(false);
      }
    };

    fetchPetsRef.current = fetchPets;
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

  const handleRefresh = useCallback(async () => {
    if (!fetchPetsRef.current) return;
    setRefreshing(true);
    try {
      await fetchPetsRef.current();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handlePetPress = (petId: string, permissionLevel?: string) => {
    if (permissionLevel) {
      router.push(`/pets/${petId}?permissionLevel=${permissionLevel}`);
    } else {
      router.push(`/pets/${petId}`);
    }
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

      toast.success('¡Invitación aceptada!');
      // Refresh pets list
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      // Reload pets to show the newly shared pet
      if (currentUser) {
        const petsData = await getPets(currentUser.id);
        const { data: sharedPetsData } = await supabaseClient
          .from('pet_shares')
          .select(`
            pet_id,
            permission_level,
            pets!inner (
              id, name, species, breed, breed_info, age, age_display,
              gender, weight, weight_display, is_neutered, has_chip,
              chip_number, photo_url, owner_id, personality, medical_notes, created_at
            )
          `)
          .eq('shared_with_user_id', currentUser.id)
          .eq('status', 'accepted');

        const transformedPets = ((petsData as any[] | null) || [])
          .map((pet) => normalizePetRecord(pet, { isShared: false }))
          .filter(Boolean);

        const transformedSharedPets = ((sharedPetsData as any[] | null) || [])
          .map((share) => {
            const pet = getFirstRecord(share?.pets);
            return normalizePetRecord(pet, {
              isShared: true,
              permissionLevel: share?.permission_level,
            });
          })
          .filter(Boolean);

        setPets([...(transformedPets as Pet[]), ...(transformedSharedPets as Pet[])]);
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Ocurrió un error al aceptar la invitación');
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    Alert.alert(
      'Rechazar invitación',
      '¿Seguro que querés rechazar esta invitación?',
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
              toast.success('Invitación rechazada');
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
          'Tu sesión expiró. Iniciá sesión de nuevo.',
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
      'Eliminar mascota',
      `¿Seguro que querés eliminar a ${petToDelete.name}? Esta acción eliminará toda la información relacionada (registros de salud, álbumes, publicaciones) y no se puede deshacer.`,
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
                Alert.alert('Error', 'Tu sesión expiró. Iniciá sesión de nuevo.');
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
                  Alert.alert('Sesión expirada', 'Iniciá sesión de nuevo.');
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
                      Alert.alert('Sesión expirada', 'Iniciá sesión de nuevo.');
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
                    Alert.alert('Sesión expirada', 'Iniciá sesión de nuevo.');
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
                  Alert.alert('Sesión expirada', 'Iniciá sesión de nuevo.');
                  router.replace('/auth/login');
                  return;
                }
                Alert.alert('Error', `No se pudo eliminar la mascota: ${petError.message}`);
                return;
              }
              
              console.log('Pet deleted successfully');
              
              // Update local state to remove the deleted pet
              setPets(prevPets => prevPets.filter(pet => pet.id !== petId));
              
              toast.success(`${petToDelete.name} se eliminó correctamente`);
            } catch (error) {
              console.error('Error deleting pet:', error);
              
              // Handle JWT expiration specifically
              if ((error instanceof Error ? error.message : String(error || '')).includes('JWT expired')) {
                Alert.alert(
                  'Sesión expirada',
                  'Tu sesión expiró. Iniciá sesión de nuevo.',
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
              if (error instanceof Error) {
                errorMessage = `Error: ${error.message}`;
              }
              
              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };


  const header = (
    <View style={styles.headerContainer}>
      <View style={styles.headerTextBlock}>
        <Text style={styles.headerTitle} accessibilityRole="header">{t('myPets')}</Text>
        {!loading && pets.length > 0 ? (
          <Text style={styles.headerSubtitle}>
            {pets.length === 1 ? '1 mascota' : `${pets.length} mascotas`}
          </Text>
        ) : null}
      </View>
      <OneTimeTooltip
        hintKey="pets_add_button_v3"
        userId={currentUser?.id}
        text="Tip: tocá + para agregar tu mascota"
        placement="bottom"
      >
        <IconButton
          variant="filled"
          icon={<Plus size={22} color={colors.onPrimary} />}
          onPress={handleAddPet}
          accessibilityLabel="Agregar mascota"
          style={styles.addButton}
        />
      </OneTimeTooltip>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        <View style={styles.content} accessibilityLabel="Cargando mascotas">
          <View style={styles.petsContainer}>
            <PetListCardSkeleton />
            <PetListCardSkeleton />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {header}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {pendingInvitations.length > 0 && (
          <View style={styles.invitationsSection}>
            <View style={styles.invitationsHeader}>
              <Bell size={20} color={colors.primary} />
              <Text style={styles.invitationsTitle}>Invitaciones pendientes</Text>
              <Badge label={String(pendingInvitations.length)} tone="primary" size="small" />
            </View>
            {pendingInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.invitationCard}>
                <View style={styles.invitationInfo}>
                  <View style={styles.invitationPetInfo}>
                    {invitation.pet.photo_url ? (
                      <Image
                        source={{ uri: invitation.pet.photo_url }}
                        style={styles.invitationPetImage}
                        resizeMode="cover"
                      />
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
                        <User size={14} color={colors.textSecondary} />
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
                    accessibilityRole="button"
                    accessibilityLabel={`Aceptar invitación de ${invitation.pet.name}`}
                  >
                    <Check size={18} color={colors.onPrimary} />
                    <Text style={styles.acceptButtonText}>Aceptar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleRejectInvitation(invitation.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Rechazar invitación de ${invitation.pet.name}`}
                  >
                    <X size={18} color={colors.danger} />
                    <Text style={styles.rejectButtonText}>Rechazar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={styles.petsContainer}>
          {pets.length === 0 ? (
            <EmptyState
              icon={<PawPrint size={32} color={colors.primary} />}
              title="Agregá tu primera mascota"
              description={t('createPetProfile')}
              actionLabel={t('addPet')}
              onAction={handleAddPet}
            />
          ) : (
            <>
              {pets.map((pet) => (
                <PetListCard
                  key={pet.id}
                  pet={pet}
                  onPress={() => handlePetPress(pet.id, pet.permissionLevel)}
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
    backgroundColor: colors.background,
    paddingTop: 30, // Add padding at the top to show status bar
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  addButton: {
    ...shadows.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  petsContainer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  invitationsSection: {
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  invitationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  invitationsTitle: {
    ...typography.heading,
    color: colors.text,
  },
  invitationCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.sm,
  },
  invitationInfo: {
    marginBottom: spacing.md,
  },
  invitationPetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invitationPetImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  invitationPetEmoji: {
    fontSize: 28,
  },
  invitationTextInfo: {
    flex: 1,
  },
  invitationPetName: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  invitationOwnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  invitationOwnerName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  invitationRelationship: {
    ...typography.caption,
    color: colors.primary,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    minHeight: 44,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  acceptButtonText: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.onPrimary,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: spacing.xs,
  },
  rejectButtonText: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.danger,
  },
});
