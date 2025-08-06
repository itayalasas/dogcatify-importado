import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, TriangleAlert as AlertTriangle, Utensils, Leaf, Hand, Pill } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { supabaseClient } from '../../../lib/supabase';

export default function SelectAllergy() {
  const { petId, species, returnPath, currentValue, currentSymptoms, currentSeverity, currentTreatment, currentNotes } = useLocalSearchParams<{
    petId: string;
    species: string;
    returnPath: string;
    currentValue?: string;
    currentSymptoms?: string;
    currentSeverity?: string;
    currentTreatment?: string;
    currentNotes?: string;
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
      const { data, error } = await supabaseClient
        .from('allergies_catalog')
        .select('*')
        .eq('is_active', true)
        .in('species', [species, 'both'])
        .order('is_common', { ascending: false }) // Common allergies first
        .order('name', { ascending: true });

      if (error) throw error;
      setAllergies(data || []);
      setFilteredAllergies(data || []);
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
        allergy.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAllergies(filtered);
    } else {
      setFilteredAllergies(allergies);
    }
  };

  const handleSelectAllergy = (allergy: any) => {
    console.log('Navigating back with allergy:', allergy.name);
    router.push({
      pathname: returnPath,
      params: {
        selectedAllergy: JSON.stringify(allergy),
        // Preserve other form values
        ...(currentSymptoms && { currentSymptoms }),
        ...(currentSeverity && { currentSeverity }),
        ...(currentTreatment && { currentTreatment }),
        ...(currentNotes && { currentNotes })
      }
    });
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, JSX.Element> = {
      food: <Utensils size={16} color="#F59E0B" />,
      environmental: <Leaf size={16} color="#10B981" />,
      contact: <Hand size={16} color="#3B82F6" />,
      medication: <Pill size={16} color="#EF4444" />,
      flea: <AlertTriangle size={16} color="#F59E0B" />,
      other: <AlertTriangle size={16} color="#6B7280" />
    };
    return icons[category] || icons.other;
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      food: 'Alimentaria',
      environmental: 'Ambiental',
      contact: 'Contacto',
      medication: 'Medicamento',
      flea: 'Pulgas',
      other: 'Otra'
    };
    return names[category] || 'Sin categoría';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      food: '#F59E0B',
      environmental: '#10B981',
      contact: '#3B82F6',
      medication: '#EF4444',
      flea: '#F59E0B',
      other: '#6B7280'
    };
    return colors[category] || '#6B7280';
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
            <Text style={styles.loadingText}>Cargando alergias...</Text>
          </View>
        ) : filteredAllergies.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AlertTriangle size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No se encontraron alergias</Text>
            <Text style={styles.emptySubtitle}>
              Intenta con otros términos de búsqueda
            </Text>
          </View>
        ) : (
          <View style={styles.allergiesList}>
            {filteredAllergies.map((allergy) => (
              <Card key={allergy.id} style={styles.allergyCard}>
                <TouchableOpacity
                  style={styles.allergyContent}
                  onPress={() => handleSelectAllergy(allergy)}
                >
                  <View style={styles.allergyHeader}>
                    <Text style={styles.allergyName}>{allergy.name}</Text>
                    <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(allergy.category) + '20' }]}>
                      {getCategoryIcon(allergy.category)}
                      <Text style={[styles.categoryText, { color: getCategoryColor(allergy.category) }]}>
                        {getCategoryName(allergy.category)}
                      </Text>
                    </View>
                  </View>

                  {allergy.description && (
                    <Text style={styles.allergyDescription} numberOfLines={2}>
                      {allergy.description}
                    </Text>
                  )}

                  <View style={styles.allergyDetails}>
                    {allergy.is_common && (
                      <View style={styles.commonBadge}>
                        <Text style={styles.commonText}>⭐ Común</Text>
                      </View>
                    )}
                  </View>

                  {allergy.common_symptoms && allergy.common_symptoms.length > 0 && (
                    <View style={styles.symptomsContainer}>
                      <Text style={styles.symptomsTitle}>Síntomas típicos:</Text>
                      <Text style={styles.symptomsText}>
                        {allergy.common_symptoms.slice(0, 3).join(', ')}
                        {allergy.common_symptoms.length > 3 && '...'}
                      </Text>
                    </View>
                  )}

                  {allergy.common_triggers && allergy.common_triggers.length > 0 && (
                    <View style={styles.triggersContainer}>
                      <Text style={styles.triggersTitle}>Desencadenantes:</Text>
                      <Text style={styles.triggersText}>
                        {allergy.common_triggers.slice(0, 2).join(', ')}
                        {allergy.common_triggers.length > 2 && '...'}
                      </Text>
                    </View>
                  )}

                  {allergy.avoidance_tips && allergy.avoidance_tips.length > 0 && (
                    <View style={styles.tipsContainer}>
                      <Text style={styles.tipsTitle}>💡 Consejos:</Text>
                      <Text style={styles.tipsText}>
                        {allergy.avoidance_tips[0]}
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
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
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
  commonBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  commonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
  },
  symptomsContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
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
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  triggersTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  triggersText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  tipsContainer: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  tipsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#166534',
  },
});