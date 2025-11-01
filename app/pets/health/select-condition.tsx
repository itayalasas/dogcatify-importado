import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, Heart, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { supabaseClient } from '../../../lib/supabase';

export default function SelectCondition() {
  const { petId, species, breed, ageInMonths, weight, returnPath, currentValue, currentTreatment, currentVeterinarian, currentNotes } = useLocalSearchParams<{
    petId: string;
    species: string;
    breed?: string;
    ageInMonths?: string;
    weight?: string;
    returnPath: string;
    currentValue?: string;
    currentTreatment?: string;
    currentVeterinarian?: string;
    currentNotes?: string;
  }>();

  const [conditions, setConditions] = useState<any[]>([]);
  const [filteredConditions, setFilteredConditions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConditions();
  }, []);

  useEffect(() => {
    filterConditions();
  }, [searchQuery, conditions]);

  const fetchConditions = async () => {
    try {
      const petBreed = breed || '';
      const petAge = ageInMonths ? parseInt(ageInMonths) : undefined;
      const petWeight = weight ? parseFloat(weight) : undefined;

      if (petBreed && petAge) {
        const cacheKey = `${species}_${petBreed}_${petAge}_${petWeight || 'any'}`;
        console.log('Checking AI cache for illnesses:', cacheKey);

        const { data: cachedData, error: cacheError } = await supabaseClient
          .from('illnesses_ai_cache')
          .select('*')
          .eq('species', species)
          .eq('breed', petBreed)
          .eq('age_in_months', petAge)
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (cachedData && cachedData.illnesses) {
          console.log('Using cached illness data');
          const illnesses = typeof cachedData.illnesses === 'string'
            ? JSON.parse(cachedData.illnesses)
            : cachedData.illnesses;
          setConditions(illnesses);
          setFilteredConditions(illnesses);
          setLoading(false);
          return;
        }

        console.log('No cache found, generating with AI...');
        const supabaseUrl = Deno.env ? Deno.env.get('SUPABASE_URL') : process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = Deno.env ? Deno.env.get('SUPABASE_ANON_KEY') : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/generate-illness-recommendations`,
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
          throw new Error('Error generating illness recommendations');
        }

        const { illnesses } = await response.json();
        console.log(`Generated ${illnesses.length} illness recommendations`);

        await supabaseClient
          .from('illnesses_ai_cache')
          .insert({
            species,
            breed: petBreed,
            age_in_months: petAge,
            weight: petWeight,
            illnesses: illnesses,
            cache_key: cacheKey
          });

        setConditions(illnesses);
        setFilteredConditions(illnesses);
      } else {
        const { data, error } = await supabaseClient
          .from('medical_conditions')
          .select('*')
          .eq('is_active', true)
          .in('species', [species, 'both'])
          .order('name', { ascending: true });

        if (error) throw error;
        setConditions(data || []);
        setFilteredConditions(data || []);
      }
    } catch (error) {
      console.error('Error fetching conditions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterConditions = () => {
    if (searchQuery.trim()) {
      const filtered = conditions.filter(condition =>
        condition.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        condition.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        condition.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredConditions(filtered);
    } else {
      setFilteredConditions(conditions);
    }
  };

  const handleSelectCondition = (condition: any) => {
    console.log('Navigating back with condition:', condition.name);
    router.replace({
      pathname: returnPath,
      params: {
        selectedCondition: JSON.stringify(condition),
        ...(currentTreatment && { currentTreatment }),
        ...(currentVeterinarian && { currentVeterinarian }),
        ...(currentNotes && { currentNotes })
      }
    });
  };

  const getCategoryIcon = (category: string) => {
    const normalizedCategory = category?.toLowerCase() || 'other';
    const icons: Record<string, string> = {
      infecciosa: '🦠',
      parasitaria: '🪱',
      genética: '🧬',
      comportamental: '🧠',
      digestiva: '🍽️',
      respiratoria: '🫁',
      dermatológica: '🩹',
      ortopédica: '🦴',
      neurológica: '🧠',
      cardíaca: '❤️',
      'renal/urinaria': '💧',
      reproductiva: '🐣',
      endocrina: '⚖️',
      oncológica: '🎗️',
      ocular: '👁️',
      auditiva: '👂',
      dental: '🦷',
      autoinmune: '��️',
      congénita: '👶',
      metabólica: '🔄',
      traumática: '🤕',
      nutricional: '🥗',
      tóxica: '☠️',
      infectious: '🦠',
      parasitic: '🪱',
      genetic: '🧬',
      behavioral: '🧠',
      digestive: '🍽️',
      respiratory: '🫁',
      skin: '🩹',
      orthopedic: '🦴',
      neurological: '🧠',
      cardiac: '❤️',
      urinary: '💧',
      reproductive: '🐣',
      endocrine: '⚖️',
      oncological: '🎗️',
      other: '📋'
    };
    return icons[normalizedCategory] || '📋';
  };

  const getCategoryName = (category: string) => {
    if (!category) return 'Sin categoría';
    const normalizedCategory = category.toLowerCase();
    const names: Record<string, string> = {
      infecciosa: 'Infecciosa',
      parasitaria: 'Parasitaria',
      genética: 'Genética',
      comportamental: 'Comportamental',
      digestiva: 'Digestiva',
      respiratoria: 'Respiratoria',
      dermatológica: 'Dermatológica',
      ortopédica: 'Ortopédica',
      neurológica: 'Neurológica',
      cardíaca: 'Cardíaca',
      'renal/urinaria': 'Renal/Urinaria',
      reproductiva: 'Reproductiva',
      endocrina: 'Endocrina',
      oncológica: 'Oncológica',
      ocular: 'Ocular',
      auditiva: 'Auditiva',
      dental: 'Dental',
      autoinmune: 'Autoinmune',
      congénita: 'Congénita',
      metabólica: 'Metabólica',
      traumática: 'Traumática',
      nutricional: 'Nutricional',
      tóxica: 'Tóxica',
      infectious: 'Infecciosa',
      parasitic: 'Parasitaria',
      genetic: 'Genética',
      behavioral: 'Comportamental',
      digestive: 'Digestiva',
      respiratory: 'Respiratoria',
      skin: 'Piel',
      orthopedic: 'Ortopédica',
      neurological: 'Neurológica',
      cardiac: 'Cardíaca',
      urinary: 'Urinaria',
      reproductive: 'Reproductiva',
      endocrine: 'Endocrina',
      oncological: 'Oncológica',
      other: 'Otra'
    };
    return names[normalizedCategory] || category;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>
          Seleccionar Enfermedad {species === 'dog' ? '🐕' : '🐱'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar enfermedad..."
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
              {breed ? 'Generando recomendaciones con IA...' : 'Cargando enfermedades...'}
            </Text>
            {breed && (
              <Text style={styles.loadingSubtext}>
                Analizando predisposiciones para {species === 'dog' ? 'perros' : 'gatos'} {breed}
              </Text>
            )}
          </View>
        ) : filteredConditions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Heart size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No se encontraron enfermedades</Text>
            <Text style={styles.emptySubtitle}>
              Intenta con otros términos de búsqueda
            </Text>
          </View>
        ) : (
          <View style={styles.conditionsList}>
            {filteredConditions.map((condition, index) => (
              <Card key={condition.id || `illness-${index}`} style={styles.conditionCard}>
                <TouchableOpacity
                  style={styles.conditionContent}
                  onPress={() => handleSelectCondition(condition)}
                >
                  <View style={styles.conditionHeader}>
                    <Text style={styles.conditionName}>{condition.name}</Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryIcon}>
                        {getCategoryIcon(condition.category)}
                      </Text>
                      <Text style={styles.categoryText}>
                        {getCategoryName(condition.category)}
                      </Text>
                    </View>
                  </View>

                  {condition.description && (
                    <Text style={styles.conditionDescription} numberOfLines={3}>
                      {condition.description}
                    </Text>
                  )}

                  <View style={styles.conditionDetails}>
                    {condition.severity && (
                      <View style={[
                        styles.severityBadge,
                        condition.severity === 'high' && styles.severityHigh,
                        condition.severity === 'medium' && styles.severityMedium,
                        condition.severity === 'low' && styles.severityLow
                      ]}>
                        <Text style={styles.severityText}>
                          {condition.severity === 'high' && '⚠️ Alta'}
                          {condition.severity === 'medium' && '⚡ Media'}
                          {condition.severity === 'low' && '✓ Baja'}
                        </Text>
                      </View>
                    )}

                    {condition.is_contagious && (
                      <View style={styles.contagiousBadge}>
                        <Text style={styles.contagiousText}>🦠 Contagiosa</Text>
                      </View>
                    )}
                  </View>

                  {(condition.symptoms || condition.common_symptoms) && (
                    <View style={styles.symptomsContainer}>
                      <Text style={styles.symptomsTitle}>Síntomas comunes:</Text>
                      <Text style={styles.symptomsText}>
                        {(condition.symptoms || condition.common_symptoms).slice(0, 3).join(', ')}
                        {(condition.symptoms || condition.common_symptoms).length > 3 && '...'}
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
  conditionsList: {
    gap: 12,
  },
  conditionCard: {
    marginBottom: 8,
  },
  conditionContent: {
    padding: 16,
  },
  conditionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  conditionName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  conditionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  conditionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chronicBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chronicText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
  },
  contagiousBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityHigh: {
    backgroundColor: '#FEE2E2',
  },
  severityMedium: {
    backgroundColor: '#FEF3C7',
  },
  severityLow: {
    backgroundColor: '#D1FAE5',
  },
  severityText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  contagiousText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#991B1B',
  },
  symptomsContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  symptomsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  symptomsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
});