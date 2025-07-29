import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Plus, Heart, MapPin } from 'lucide-react-native';
import { supabaseClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  description: string;
  image_url: string;
  user_id: string;
  created_at: string;
  location?: string;
}

export default function PetsTab() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchPets = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Check for JWT expired error
        if (error.code === 'PGRST301' || error.message?.includes('JWT expired')) {
          Alert.alert(
            'Sesión expirada',
            'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/auth/login'),
              },
            ]
          );
          return;
        }

        console.error('Error fetching pets:', error);
        Alert.alert('Error', 'No se pudieron cargar las mascotas');
        return;
      }

      )
      .subscribe();
    
    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [currentUser]);


      setPets(data || []);
    } catch (error) {
      console.error('Error fetching pets:', error);
      Alert.alert('Error', 'No se pudieron cargar las mascotas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPets();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPets();
  };

  const handleAddPet = () => {
    router.push('/pets/add');
  };

  const handlePetPress = (petId: string) => {
    router.push(`/pets/${petId}`);
  };

  const renderPetCard = ({ item }: { item: Pet }) => (
    <TouchableOpacity
      style={styles.petCard}
      onPress={() => handlePetPress(item.id)}
    >
      <Image
        source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
        style={styles.petImage}
      />
      <View style={styles.petInfo}>
        <Text style={styles.petName}>{item.name}</Text>
        <Text style={styles.petDetails}>
          {item.species} • {item.breed}
        </Text>
        <Text style={styles.petAge}>{item.age} años</Text>
        {item.location && (
          <View style={styles.locationContainer}>
            <MapPin size={12} color="#666" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.favoriteButton}>
        <Heart size={20} color="#FF6B6B" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (

      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando mascotas...</Text>
      </View>

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Mascotas</Text>

    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('myPets')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddPet}>
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {pets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No tienes mascotas registradas</Text>
          <Text style={styles.emptySubtitle}>
            Agrega tu primera mascota para comenzar
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleAddPet}>
            <Plus size={20} color="#fff" />
            <Text style={styles.emptyButtonText}>Agregar Mascota</Text>
          </TouchableOpacity>

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
      ) : (
        <FlatList
          data={pets}
          renderItem={renderPetCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D6A6F',
  },
  addButton: {
    backgroundColor: '#2D6A6F',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 20,
  },
  petCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  petImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D6A6F',
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  petAge: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  favoriteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D6A6F',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#2D6A6F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});