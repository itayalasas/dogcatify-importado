import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, AlertCircle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { supabaseClient } from '../../../lib/supabase';

export default function SelectAllergy() {
  const { petId, species, breed, ageInMonths, weight, returnPath, currentValue, currentType, currentSymptoms, currentSeverity, currentTreatment, currentVeterinarian, currentNotes, currentDiagnosisDate } = useLocalSearchParams<{
    petId: string;
    species: string;
    breed?: string;
    ageInMonths?: string;
    weight?: string;
    returnPath: string;
    currentValue?: string;
    currentType?: string;
    currentSymptoms?: string;
    currentSeverity?: string;
    currentTreatment?: string;
    currentVeterinarian?: string;
    currentNotes?: string;
    currentDiagnosisDate?: string;
  }>();

  const [allergies, setAllergies] = useState<any[]>([]);
  const [filteredAllergies, setFilteredAllergies] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllergies();
  }, []);

  useEffect(() => {
    filterAllergies();
  }, [searchQuery, allergies]);

  const fetchAllergies = async () => {
    try {
      const petBreed = breed || '';
      const petAge = ageInMonths ? parseInt(ageInMonths) : undefined;
      const petWeight = weight ? parseFloat(weight) : undefined;

      if (petBreed && petAge) {
        const cacheKey = `${species}_${petBreed}_${petAge}_${petWeight || 'any'}`;
        console.log('Checking AI cache for allergies:', cacheKey);

        const { data: cachedData, error: cacheError } = await supabaseClient
          .from('allergies_ai_cache')
          .select('*')
          .eq('species', species)
          .eq('breed', petBreed)
          .eq('age_in_months', petAge)
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (cachedData && cachedData.allergies) {
          console.log('Using cached allergy data');
          const cachedAllergies = typeof cachedData.allergies === 'string'
            ? JSON.parse(cachedData.allergies)
            : cachedData.allergies;
          setAllergies(cachedAllergies);
          setFilteredAllergies(cachedAllergies);
          setLoading(false);
          return;
        }

        console.log('No cache found, generating with AI...');
        const supabaseUrl = Deno.env ? Deno.env.get('SUPABASE_URL') : process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = Deno.env ? Deno.env.get('SUPABASE_ANON_KEY') : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/generate-allergy-recommendations`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              species,
              breed: petBreed,
              ageInMonths: petAge,
              weight: petWeight
            })
          }
        );

        if (!response.ok) {
          throw new Error('Error generating allergy recommendations');
        }

        const { allergies: aiAllergies } = await response.json();
        console.log(`Generated ${aiAllergies.length} allergy recommendations`);

        await supabaseClient
          .from('allergies_ai_cache')
          .insert({
            species,
            breed: petBreed,
            age_in_months: petAge,
            weight: petWeight,
            allergies: aiAllergies,
            cache_key: cacheKey
          });

        setAllergies(aiAllergies);
        setFilteredAllergies(aiAllergies);
      } else {
        console.log('Missing breed or age, using generic allergies...');

        const genericBreed = 'Común/ Doméstico/ Mestizo';
        const genericAge = 24;
        const cacheKey = `${species}_${genericBreed}_${genericAge}_any`;

        console.log('Checking AI cache for generic allergies:', cacheKey);

        const { data: cachedData, error: cacheError } = await supabaseClient
          .from('allergies_ai_cache')
          .select('*')
          .eq('species', species)
          .eq('breed', genericBreed)
          .eq('age_in_months', genericAge)
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (cachedData && cachedData.allergies) {
          console.log('Using cached generic allergy data');
          const cachedAllergies = typeof cachedData.allergies === 'string'
            ? JSON.parse(cachedData.allergies)
            : cachedData.allergies;
          setAllergies(cachedAllergies);
          setFilteredAllergies(cachedAllergies);
          setLoading(false);
          return;
        }

        console.log('No cache found, generating generic allergies with AI...');
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/generate-allergy-recommendations`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              species,
              breed: genericBreed,
              ageInMonths: genericAge,
              weight: undefined
            })
          }
        );

        if (!response.ok) {
          throw new Error('Error generating allergy recommendations');
        }

        const { allergies: aiAllergies } = await response.json();
        console.log(`Generated ${aiAllergies.length} generic allergy recommendations`);

        await supabaseClient
          .from('allergies_ai_cache')
          .insert({
            species,
            breed: genericBreed,
            age_in_months: genericAge,
            weight: null,
            allergies: aiAllergies,
            cache_key: cacheKey
          });

        setAllergies(aiAllergies);
        setFilteredAllergies(aiAllergies);
      }
    } catch (error) {
      console.error('Error fetching allergies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAllergies = () => {
    if (searchQuery.trim()) {
      const filtered = allergies.filter(allergy =>
        allergy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        allergy.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        allergy.allergy_type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAllergies(filtered);
    } else {
      setFilteredAllergies(allergies);
    }
  };

  const handleSelectAllergy = (allergy: any) => {
    console.log('Navigating back with allergy:', allergy.name);
    router.replace({
      pathname: returnPath,
      params: {
        selectedAllergy: JSON.stringify(allergy),
        // Preserve all current values when returning
        ...(currentTreatment && { currentTreatment }),
        ...(currentVeterinarian && { currentVeterinarian }),
        ...(currentNotes && { currentNotes }),
        ...(currentDiagnosisDate && { currentDiagnosisDate })
      }
    });
  };

  const getTypeIcon = (type: string) => {
    const normalizedType = type?.toLowerCase() || 'other';
    const icons: Record<string, string> = {
      alimentaria: '🍽️',
      ambiental: '🌿',
      medicamento: '💊',
      picaduras: '🦟',
      contacto: '🤚',
      estacional: '🌸',
      pulgas: '🪲',
      food: '🍽️',
      environmental: '🌿',
      medication: '💊',
      insect: '🦟',
      contact: '🤚',
      seasonal: '🌸',
      flea: '🪲',
      other: '⚠️'
    };
    return icons[normalizedType] || '⚠️';
  };

  const getTypeName = (type: string) => {
    if (!type) return 'Sin tipo';
    const normalizedType = type.toLowerCase();
    const names: Record<string, string> = {
      alimentaria: 'Alimentaria',
      ambiental: 'Ambiental',
      medicamento: 'Medicamento',
      picaduras: 'Picaduras',
      contacto: 'Contacto',
      estacional: 'Estacional',
      pulgas: 'Pulgas',
      food: 'Alimentaria',
      environmental: 'Ambiental',
      medication: 'Medicamento',
      insect: 'Picaduras',
      contact: 'Contacto',
      seasonal: 'Estacional',
      flea: 'Pulgas',
      other: 'Otra'
    };
    return names[normalizedType] || type;
  };

  const getSeverityColor = (severity: string) => {
    const normalizedSeverity = severity?.toLowerCase() || 'moderate';
    const colors: Record<string, string> = {
      mild: '#10B981',
      leve: '#10B981',
      moderate: '#F59E0B',
      moderada: '#F59E0B',
      severe: '#EF4444',
      severa: '#EF4444'
    };
    return colors[normalizedSeverity] || '#F59E0B';
  };

  const getSeverityLabel = (severity: string) => {
    const normalizedSeverity = severity?.toLowerCase() || 'moderate';
    const labels: Record<string, string> = {
      mild: 'Leve',
      leve: 'Leve',
      moderate: 'Moderada',
      moderada: 'Moderada',
      severe: 'Severa',
      severa: 'Severa'
    };
    return labels[normalizedSeverity] || 'Moderada';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>
          Seleccionar Alergia {species === 'dog' ? '🐕' : '🐱'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar alergia..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>
              {breed ? 'Generando recomendaciones con IA...' : 'Cargando alergias...'}
            </Text>
            {breed && (
              <Text style={styles.loadingSubtext}>
                Analizando predisposiciones para {species === 'dog' ? 'perros' : 'gatos'} {breed}
              </Text>
            )}
          </View>
        ) : filteredAllergies.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AlertCircle size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No se encontraron alergias</Text>
            <Text style={styles.emptySubtitle}>
              Intenta con otros términos de búsqueda
            </Text>
          </View>
        ) : (
          <View style={styles.allergiesList}>
            {filteredAllergies.map((allergy, index) => (
              <Card key={allergy.id || `allergy-${index}`} style={styles.allergyCard}>
                <TouchableOpacity
                  style={styles.allergyContent}
                  onPress={() => handleSelectAllergy(allergy)}
                >
                  <View style={styles.allergyHeader}>
                    <Text style={styles.allergyName}>{allergy.name}</Text>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeIcon}>
                        {getTypeIcon(allergy.allergy_type)}
                      </Text>
                      <Text style={styles.typeText}>
                        {getTypeName(allergy.allergy_type)}
                      </Text>
                    </View>
                  </View>

                  {allergy.description && (
                    <Text style={styles.allergyDescription} numberOfLines={2}>
                      {allergy.description}
                    </Text>
                  )}

                  <View style={styles.allergyDetails}>
                    {allergy.severity && (
                      <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(allergy.severity) + '20' }]}>
                        <Text style={[styles.severityText, { color: getSeverityColor(allergy.severity) }]}>
                          {getSeverityLabel(allergy.severity)}
                        </Text>
                      </View>
                    )}

                    {allergy.frequency && (
                      <View style={styles.frequencyBadge}>
                        <Text style={styles.frequencyText}>⭐ {allergy.frequency}</Text>
                      </View>
                    )}
                  </View>

                  {(allergy.symptoms || allergy.common_symptoms) && (
                    <View style={styles.symptomsContainer}>
                      <Text style={styles.symptomsTitle}>Síntomas típicos:</Text>
                      <Text style={styles.symptomsText}>
                        {(allergy.symptoms || allergy.common_symptoms).slice(0, 3).join(', ')}
                        {(allergy.symptoms || allergy.common_symptoms).length > 3 && '...'}
                      </Text>
                    </View>
                  )}

                  {allergy.triggers && allergy.triggers.length > 0 && (
                    <View style={styles.triggersContainer}>
                      <Text style={styles.triggersTitle}>Desencadenantes:</Text>
                      <Text style={styles.triggersText}>
                        {allergy.triggers.slice(0, 2).join(', ')}
                        {allergy.triggers.length > 2 && '...'}
                      </Text>
                    </View>
                  )}

                  {allergy.prevention_tips && allergy.prevention_tips.length > 0 && (
                    <View style={styles.tipsContainer}>
                      <Text style={styles.tipsTitle}>💡 Consejos:</Text>
                      <Text style={styles.tipsText} numberOfLines={1}>
                        {allergy.prevention_tips[0]}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    width: 32,
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  allergiesList: {
    gap: 12,
  },
  allergyCard: {
    marginBottom: 8,
  },
  allergyContent: {
    padding: 16,
  },
  allergyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  allergyName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  typeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  allergyDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  allergyDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  frequencyBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  frequencyText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
  },
  symptomsContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  symptomsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#991B1B',
    marginBottom: 4,
  },
  symptomsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#991B1B',
  },
  triggersContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  triggersTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginBottom: 4,
  },
  triggersText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
  },
  tipsContainer: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
  },
  tipsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#065F46',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#065F46',
  },
});
