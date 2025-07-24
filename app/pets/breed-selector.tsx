import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search } from 'lucide-react-native';

const API_KEY = 'Dc+xEVg6S6WoHc7MbV9FLQ==vASOw63SGaFxuAi8';

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
      console.log(`Fetching all ${species} breeds...`);
      
      // API Ninjas requires at least one parameter, so we'll use all letters of the alphabet
      const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
      
      let allBreeds: string[] = [];
      
      // Function to fetch breeds for a specific letter
      const fetchBreedsByLetter = async (letter: string) => {
        const endpoint = species === 'dog'
          ? `https://api.api-ninjas.com/v1/dogs?name=${letter}`
          : `https://api.api-ninjas.com/v1/cats?name=${letter}`;
        
        console.log(`Fetching breeds with letter ${letter}...`);
        
        const response = await fetch(endpoint, {
          headers: {
            'X-Api-Key': API_KEY,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.map((item: any) => item.name);
        }
        return [];
      };
      
      // Fetch breeds for common letters to get a comprehensive list
      // Using all letters to get a more complete list
      const breedPromises = letters.map(letter => fetchBreedsByLetter(letter));
      const breedResults = await Promise.all(breedPromises);
      
      // Combine all results and remove duplicates
      const combinedBreeds = breedResults.flat();
      allBreeds = Array.from(new Set(combinedBreeds)).sort();
      
      console.log(`Total unique breeds found: ${allBreeds.length}`);
      
      setBreeds(allBreeds);
      setFilteredBreeds(allBreeds);
      
    } catch (error) {
      console.error('Error fetching breeds:', error);
      Alert.alert('Error', 'Ocurrió un error al cargar las razas. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleBreedSelect = (breed: string) => {
    console.log("Breed selected:", breed);
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