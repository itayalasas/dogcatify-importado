import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search } from 'lucide-react-native';
import { fetchPetBreedData } from '../../utils/petBreedApi';

export default function BreedSelector() {
  const { species } = useLocalSearchParams<{ species: string }>();
  const [breeds, setBreeds] = useState<string[]>([]);
  const [filteredBreeds, setFilteredBreeds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBreeds();
  }, [species]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredBreeds(
        breeds.filter(breed => 
          breed && typeof breed === 'string' && 
          breed.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredBreeds(breeds);
    }
  }, [searchQuery, breeds]);

  const fetchBreeds = async () => {
    setLoading(true);
    try {
      
      const data = await fetchPetBreedData('list', species === 'dog' ? 'dog' : 'cat');
        
        // Handle different possible data structures
        let breedNames: string[] = [];
        
        if (Array.isArray(data)) {
          // Try different possible property names for breed names
          breedNames = data
            .map((item: any) => {
              // Try common property names
              return item.name || item.breed || item.breed_name || item;
            })
            .filter((name: any) => name && typeof name === 'string')
            .sort();
        }
        
        setBreeds(breedNames);
        setFilteredBreeds(breedNames);
    } catch (error) {
      Alert.alert(
        'Error', 
        'Ocurrió un error al cargar las razas. Por favor intenta de nuevo.',
        [
          { text: 'Reintentar', onPress: () => fetchBreeds() },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBreedSelect = (breed: string) => {
    // Navigate back with the selected breed as a parameter
    router.push({
      pathname: '/pets/add',
      params: { 
        species: species,
        selectedBreed: breed 
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>
          Seleccionar Raza {species === 'dog' ? '🐕' : '🐱'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9CA3AF" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Buscar raza..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Cargando razas de {species === 'dog' ? 'perros' : 'gatos'}...</Text>
        </View>
      ) : (
        <ScrollView style={styles.breedList} showsVerticalScrollIndicator={false}>
          {breeds.length === 0 && !searchQuery && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>
                No se pudieron cargar las razas. Intenta de nuevo.
              </Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={fetchBreeds}
              >
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {filteredBreeds.map((breed, index) => (
            <TouchableOpacity
              key={index}
              style={styles.breedItem}
              onPress={() => handleBreedSelect(breed)}
            >
              <Text style={styles.breedText}>{breed}</Text>
            </TouchableOpacity>
          ))}
          {filteredBreeds.length === 0 && searchQuery && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>
                No se encontraron razas que coincidan con "{searchQuery}"
              </Text>
            </View>
          )}
        </ScrollView>
      )}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    width: 40,
  },
  searchContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  breedList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  breedItem: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  breedText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
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
    marginTop: 12,
  },
  noResultsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
});
