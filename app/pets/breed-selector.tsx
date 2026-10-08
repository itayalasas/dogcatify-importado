import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Search, ChevronRight, PawPrint } from 'lucide-react-native';
import { ScreenHeader, EmptyState, Skeleton } from '../../components/ui';

import { colors, radius, spacing, typography } from '../../constants/theme';
const API_KEY = 'pk_XYb1Nbel6qVH0fQfv3CpYwHJG1NC5aca';

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
      console.log(`Fetching all ${species} breeds using optimized endpoint...`);
      
      // Use the optimized endpoint that returns all breeds at once
      const endpoint = species === 'dog'
        ? 'https://proj-apis-pet-2r9a-7efeae.wittybeach-c1a761c9.northcentralus.azurecontainerapps.io/alldogs'
        : 'https://proj-apis-pet-2r9a-7efeae.wittybeach-c1a761c9.northcentralus.azurecontainerapps.io/allcats';
      
      console.log(`Using endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        headers: {
          'X-Api-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`API returned ${data.length} breeds`);
        console.log('Sample breed data:', data[0]); // Debug log to see structure
        
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
        
        console.log(`Processed ${breedNames.length} unique breeds`);
        console.log('First 5 breeds:', breedNames.slice(0, 5)); // Debug log
        setBreeds(breedNames);
        setFilteredBreeds(breedNames);
      } else {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`API Error: ${response.status}`);
      }
      
    } catch (error) {
      console.error('Error fetching breeds:', error);
      Alert.alert(
        'Error', 
        'Ocurrió un error al cargar las razas. Intentá de nuevo.',
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
      <ScreenHeader
        title={`Seleccionar raza ${species === 'dog' ? '🐕' : '🐱'}`}
        onBack={() => router.back()}
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color={colors.icon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Buscar raza..."
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.breedList} accessibilityLabel={`Cargando razas de ${species === 'dog' ? 'perros' : 'gatos'}`}>
          {Array.from({ length: 10 }).map((_, i) => (
            <View key={i} style={styles.breedItem}>
              <Skeleton width={`${40 + ((i * 17) % 40)}%`} height={16} />
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          style={styles.breedList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {breeds.length === 0 && !searchQuery && (
            <EmptyState
              icon={<PawPrint size={32} color={colors.primary} />}
              title="No pudimos cargar las razas"
              description="Revisá tu conexión e intentá de nuevo."
              actionLabel="Reintentar"
              onAction={fetchBreeds}
            />
          )}
          
          {filteredBreeds.map((breed, index) => (
            <TouchableOpacity
              key={index}
              style={styles.breedItem}
              onPress={() => handleBreedSelect(breed)}
              accessibilityRole="button"
            >
              <Text style={styles.breedText}>{breed}</Text>
              <ChevronRight size={18} color={colors.icon} />
            </TouchableOpacity>
          ))}
          {filteredBreeds.length === 0 && searchQuery && (
            <EmptyState
              icon={<Search size={32} color={colors.primary} />}
              title="Sin resultados"
              description={`No encontramos razas que coincidan con "${searchQuery}".`}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  breedList: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  breedItem: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  breedText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
});