import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, X, Sparkles, MessageCircle } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '../../../lib/supabase';

export default function PetMatingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPet, setCurrentPet] = useState<any>(null);
  const [matingProfile, setMatingProfile] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<any[]>([]);

  const currentCandidate = useMemo(() => candidates[currentIndex] || null, [candidates, currentIndex]);

  useEffect(() => {
    if (!id || !currentUser) return;
    initialize();
  }, [id, currentUser]);

  const initialize = async () => {
    setLoading(true);
    try {
      const petData = await fetchCurrentPet();
      await Promise.all([fetchCandidates(petData), fetchMatches()]);
    } catch (error) {
      console.error('Error initializing pet matching:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPet = async () => {
    const { data, error } = await supabaseClient
      .from('pets')
      .select('id, name, species, breed, gender, age, is_neutered, photo_url, owner_id')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    setCurrentPet(data || null);

    const { data: profileData, error: profileError } = await supabaseClient
      .from('pet_mating_profiles')
      .select('*')
      .eq('pet_id', id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching mating profile:', profileError);
      setMatingProfile(null);
      return data || null;
    }

    setMatingProfile(profileData || null);
    return data || null;
  };

  const fetchCandidates = async (petOverride?: any) => {
    const sourcePet = petOverride || currentPet;
    if (!id || !sourcePet) return;

    try {
      const { data: swipesData, error: swipesError } = await supabaseClient
        .from('pet_swipes')
        .select('to_pet_id')
        .eq('from_pet_id', id);

      if (swipesError) throw swipesError;

      const alreadySwipedIds = new Set((swipesData || []).map(s => s.to_pet_id));

      const { data, error } = await supabaseClient
        .from('pet_mating_profiles')
        .select(`
          pet_id,
          bio,
          is_active,
          pets!inner(
            id,
            name,
            species,
            breed,
            gender,
            age,
            is_neutered,
            owner_id,
            photo_url
          )
        `)
        .eq('is_active', true)
        .neq('pet_id', id);

      if (error) throw error;

      const normalizedCurrentBreed = (sourcePet.breed || '').trim().toLowerCase();

      const baseCandidates = (data || [])
        .map((row: any) => ({
          id: row.pets.id,
          name: row.pets.name,
          species: row.pets.species,
          breed: row.pets.breed,
          gender: row.pets.gender,
          age: row.pets.age,
          ownerId: row.pets.owner_id,
          isNeutered: row.pets.is_neutered,
          photoURL: row.pets.photo_url,
          bio: row.bio,
        }))
        .filter((candidate: any) => {
          if (!candidate?.id) return false;
          if (alreadySwipedIds.has(candidate.id)) return false;
          if (candidate.ownerId === sourcePet.owner_id) return false;
          if (candidate.isNeutered) return false;
          if (candidate.species !== sourcePet.species) return false;
          if (candidate.gender && sourcePet.gender && candidate.gender === sourcePet.gender) return false;
          return true;
        });

      const sameBreedCandidates = baseCandidates.filter((candidate: any) =>
        (candidate.breed || '').trim().toLowerCase() === normalizedCurrentBreed
      );

      const fallbackCandidates = baseCandidates.filter((candidate: any) =>
        (candidate.breed || '').trim().toLowerCase() !== normalizedCurrentBreed
      );

      const filteredCandidates = [...sameBreedCandidates, ...fallbackCandidates];

      setCandidates(filteredCandidates);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }
  };

  const fetchMatches = async () => {
    if (!id) return;

    try {
      const { data: matchRows, error: matchError } = await supabaseClient
        .from('pet_matches')
        .select('*')
        .or(`pet_a_id.eq.${id},pet_b_id.eq.${id}`)
        .eq('status', 'active')
        .order('matched_at', { ascending: false });

      if (matchError) throw matchError;

      if (!matchRows || matchRows.length === 0) {
        setMatches([]);
        return;
      }

      const otherPetIds = matchRows.map((row: any) => row.pet_a_id === id ? row.pet_b_id : row.pet_a_id);

      const { data: petsData, error: petsError } = await supabaseClient
        .from('pets')
        .select('id, name, breed, age, gender, photo_url')
        .in('id', otherPetIds);

      if (petsError) throw petsError;

      const petsMap = new Map((petsData || []).map((pet: any) => [pet.id, pet]));
      const matchIds = matchRows.map((row: any) => row.id);

      const { data: chatsData, error: chatsError } = await supabaseClient
        .from('pet_match_chats')
        .select('id, match_id')
        .in('match_id', matchIds);

      if (chatsError) throw chatsError;

      const chatByMatchId = new Map((chatsData || []).map((chat: any) => [chat.match_id, chat]));
      const chatIds = (chatsData || []).map((chat: any) => chat.id);

      let unreadCountByChatId = new Map<string, number>();

      if (chatIds.length > 0 && currentUser?.id) {
        const { data: unreadRows, error: unreadError } = await supabaseClient
          .from('pet_match_messages')
          .select('chat_id')
          .in('chat_id', chatIds)
          .eq('is_read', false)
          .neq('sender_id', currentUser.id);

        if (unreadError) throw unreadError;

        unreadCountByChatId = (unreadRows || []).reduce((acc: Map<string, number>, row: any) => {
          acc.set(row.chat_id, (acc.get(row.chat_id) || 0) + 1);
          return acc;
        }, new Map<string, number>());
      }

      const enrichedMatches = matchRows.map((row: any) => {
        const otherPetId = row.pet_a_id === id ? row.pet_b_id : row.pet_a_id;
        const chat = chatByMatchId.get(row.id);
        return {
          id: row.id,
          matchedAt: row.matched_at,
          ownerAId: row.owner_a_id,
          ownerBId: row.owner_b_id,
          chatId: chat?.id || null,
          unreadCount: chat?.id ? unreadCountByChatId.get(chat.id) || 0 : 0,
          pet: petsMap.get(otherPetId),
        };
      }).filter((m: any) => !!m.pet);

      setMatches(enrichedMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const createMatchIfMutual = async (targetPet: any) => {
    const { data: reciprocal, error: reciprocalError } = await supabaseClient
      .from('pet_swipes')
      .select('id')
      .eq('from_pet_id', targetPet.id)
      .eq('to_pet_id', id)
      .eq('action', 'like')
      .maybeSingle();

    if (reciprocalError) {
      console.error('Error checking reciprocal like:', reciprocalError);
      return false;
    }

    if (!reciprocal) return false;

    const sortedPetIds = [id, targetPet.id].sort();
    const petAId = sortedPetIds[0];
    const petBId = sortedPetIds[1];

    const ownerAId = petAId === currentPet.id ? currentPet.owner_id : targetPet.ownerId;
    const ownerBId = petBId === currentPet.id ? currentPet.owner_id : targetPet.ownerId;

    const { error: matchError } = await supabaseClient
      .from('pet_matches')
      .upsert({
        pet_a_id: petAId,
        pet_b_id: petBId,
        owner_a_id: ownerAId,
        owner_b_id: ownerBId,
        match_key: `${petAId}_${petBId}`,
        status: 'active',
        matched_at: new Date().toISOString(),
      }, { onConflict: 'match_key' });

    if (matchError) {
      console.error('Error creating match:', matchError);
      return false;
    }

    return true;
  };

  const handleSwipe = async (action: 'like' | 'pass') => {
    if (!currentCandidate || !currentUser || !id) return;

    setActionLoading(true);
    try {
      const { error } = await supabaseClient
        .from('pet_swipes')
        .upsert({
          from_pet_id: id,
          to_pet_id: currentCandidate.id,
          owner_id: currentUser.id,
          action,
        }, { onConflict: 'from_pet_id,to_pet_id' });

      if (error) throw error;

      if (action === 'like') {
        const matchCreated = await createMatchIfMutual(currentCandidate);
        if (matchCreated) {
          Alert.alert('¡Match! 🎉', `${currentPet.name} y ${currentCandidate.name} hicieron match.`);
          await fetchMatches();
        }
      }

      if (currentIndex >= candidates.length - 1) {
        await fetchCandidates();
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (swipeError) {
      console.error('Error saving swipe:', swipeError);
      Alert.alert('Error', 'No se pudo registrar la acción. Intenta nuevamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenMatchChat = async (match: any) => {
    if (!currentUser?.id || !match?.id) return;

    try {
      const ownerAId = match.ownerAId;
      const ownerBId = match.ownerBId;

      const { data: upserted, error: upsertError } = await supabaseClient
        .from('pet_match_chats')
        .upsert({
          match_id: match.id,
          owner_a_id: ownerAId,
          owner_b_id: ownerBId,
          status: 'active',
        }, { onConflict: 'match_id' })
        .select('id')
        .single();

      if (upsertError) throw upsertError;

      router.push({
        pathname: '/pets/mating/chat/[id]',
        params: {
          id: upserted.id,
          petName: match.pet?.name || 'Match'
        }
      });
    } catch (error) {
      console.error('Error opening match chat:', error);
      Alert.alert('Error', 'No se pudo abrir el chat del match.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Cargando matching...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentPet) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>No se encontró la mascota</Text>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (currentPet.owner_id !== currentUser?.id) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Solo el dueño puede usar esta función.</Text>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (currentPet.is_neutered) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Esta mascota está marcada como castrada y no puede usar matching.</Text>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!matingProfile?.is_active) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Activa “Buscar pareja” desde el perfil de la mascota para continuar.</Text>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Matching de {currentPet.name}</Text>
        <TouchableOpacity onPress={fetchCandidates}>
          <Text style={styles.refreshText}>Recargar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Candidatos por compatibilidad</Text>
          <Text style={styles.infoSubtitle}>Misma especie y sexo compatible. Priorizamos misma raza, pero también mostramos razas similares cuando no hay exactas.</Text>
        </Card>

        {currentCandidate ? (
          <Card style={styles.candidateCard}>
            <Image
              source={{ uri: currentCandidate.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100' }}
              style={styles.candidateImage}
            />
            <Text style={styles.candidateName}>{currentCandidate.name}</Text>
            <Text style={styles.candidateMeta}>
              {currentCandidate.breed} · {currentCandidate.age || 0} años · {currentCandidate.gender === 'male' ? 'Macho' : 'Hembra'}
            </Text>
            {!!currentCandidate.bio && (
              <Text style={styles.candidateBio}>{currentCandidate.bio}</Text>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.swipeButton, styles.passButton]}
                onPress={() => handleSwipe('pass')}
                disabled={actionLoading}
              >
                <X size={22} color="#B91C1C" />
                <Text style={styles.passText}>Pasar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.swipeButton, styles.likeButton]}
                onPress={() => handleSwipe('like')}
                disabled={actionLoading}
              >
                <Heart size={22} color="#15803D" />
                <Text style={styles.likeText}>Me interesa</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Sparkles size={28} color="#7C3AED" />
            <Text style={styles.emptyTitle}>Sin candidatos por ahora</Text>
            <Text style={styles.emptySubtitle}>
              Ajusta datos de mascotas o vuelve más tarde para nuevos perfiles compatibles.
            </Text>
          </Card>
        )}

        <Card style={styles.matchesCard}>
          <Text style={styles.matchesTitle}>Matches ({matches.length})</Text>
          {matches.length === 0 ? (
            <Text style={styles.matchesEmpty}>Aún no hay matches mutuos.</Text>
          ) : (
            matches.map(match => (
              <View key={match.id} style={styles.matchItem}>
                <Image
                  source={{ uri: match.pet.photo_url || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100' }}
                  style={styles.matchAvatar}
                />
                <View style={styles.matchInfo}>
                  <Text style={styles.matchName}>{match.pet.name}</Text>
                  <Text style={styles.matchMeta}>{match.pet.breed} · {match.pet.gender === 'male' ? 'Macho' : 'Hembra'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.matchChatButton}
                  onPress={() => handleOpenMatchChat(match)}
                >
                  <MessageCircle size={16} color="#5B21B6" />
                  <Text style={styles.matchChatButtonText}>Chat{match.unreadCount > 0 ? ` (${match.unreadCount})` : ''}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
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
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
    marginHorizontal: 8,
  },
  refreshText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  infoCard: {
    marginBottom: 12,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  infoTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#5B21B6',
  },
  infoSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6D28D9',
  },
  candidateCard: {
    marginBottom: 16,
  },
  candidateImage: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    marginBottom: 12,
  },
  candidateName: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  candidateMeta: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 8,
  },
  candidateBio: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  swipeButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  passButton: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  likeButton: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  passText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#B91C1C',
  },
  likeText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#15803D',
  },
  emptyCard: {
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  matchesCard: {
    marginBottom: 24,
  },
  matchesTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  matchesEmpty: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  matchAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 10,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  matchMeta: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  matchChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  matchChatButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#5B21B6',
  },
});
