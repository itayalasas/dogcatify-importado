import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, Syringe, Shield, Clock, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { supabaseClient } from '../../../lib/supabase';

export default function SelectVaccine() {
  const { petId, species, returnPath, currentValue, currentVeterinarian, currentNotes, currentNextDueDate } = useLocalSearchParams<{
    petId: string;
    species: string;
    returnPath: string;
    currentValue?: string;
    currentVeterinarian?: string;
    currentNotes?: string;
    currentNextDueDate?: string;
  }>();

  const [vaccines, setVaccines] = useState<any[]>([]);
  const [filteredVaccines, setFilteredVaccines] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVaccines();
  }, []);

  useEffect(() => {
    filterVaccines();
  }, [searchQuery, vaccines]);

  const fetchVaccines = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('vaccines_catalog')
        .select('*')
        .eq('is_active', true)
        .in('species', [species, 'both'])
        .order('is_required', { ascending: false }) // Required vaccines first
        .order('name', { ascending: true });

      if (error) throw error;
      setVaccines(data || []);
      setFilteredVaccines(data || []);
    } catch (error) {
      console.error('Error fetching vaccines:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterVaccines = () => {
    if (searchQuery.trim()) {
      const filtered = vaccines.filter(vaccine =>
        vaccine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vaccine.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vaccine.type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredVaccines(filtered);
    } else {
      setFilteredVaccines(vaccines);
    }
  };

  const handleSelectVaccine = (vaccine: any) => {
    console.log('Navigating back with vaccine:', vaccine.name);
    router.push({
      pathname: returnPath,
      params: {
        selectedVaccine: JSON.stringify(vaccine),
        // Preserve other form values
        ...(currentVeterinarian && { currentVeterinarian }),
        ...(currentNotes && { currentNotes }),
        ...(currentNextDueDate && { currentNextDueDate })
      }
    });
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      core: '🛡️',
      non_core: '💉',
      lifestyle: '🏃'
    };
    return icons[type] || '💉';
  };

  const getTypeName = (type: string) => {
    const names: Record<string, string> = {
      core: 'Esencial',
      non_core: 'Recomendada',
      lifestyle: 'Estilo de vida'
    };
    return names[type] || 'Vacuna';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      core: '#DC2626', // Red for required
      non_core: '#3B82F6', // Blue for recommended
      lifestyle: '#10B981' // Green for lifestyle
    };
    return colors[type] || '#6B7280';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>
          Seleccionar Vacuna {species === 'dog' ? '🐕' : '🐱'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar vacuna..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando vacunas...</Text>
          </View>
        ) : filteredVaccines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Syringe size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No se encontraron vacunas</Text>
            <Text style={styles.emptySubtitle}>
              Intenta con otros términos de búsqueda
            </Text>
          </View>
        ) : (
          <View style={styles.vaccinesList}>
            {filteredVaccines.map((vaccine) => (
              <Card key={vaccine.id} style={styles.vaccineCard}>
                <TouchableOpacity
                  style={styles.vaccineContent}
                  onPress={() => handleSelectVaccine(vaccine)}
                >
                  <View style={styles.vaccineHeader}>
                    <Text style={styles.vaccineName}>{vaccine.name}</Text>
                    <View style={[styles.typeBadge, { backgroundColor: getTypeColor(vaccine.type) + '20' }]}>
                      <Text style={styles.typeIcon}>
                        {getTypeIcon(vaccine.type)}
                      </Text>
                      <Text style={[styles.typeText, { color: getTypeColor(vaccine.type) }]}>
                        {getTypeName(vaccine.type)}
                      </Text>
                    </View>
                  </View>

                  {vaccine.description && (
                    <Text style={styles.vaccineDescription} numberOfLines={2}>
                      {vaccine.description}
                    </Text>
                  )}

                  <View style={styles.vaccineDetails}>
                    {vaccine.is_required && (
                      <View style={styles.requiredBadge}>
                        <Shield size={12} color="#DC2626" />
                        <Text style={styles.requiredText}>Obligatoria</Text>
                      </View>
                    )}
                    
                    {vaccine.frequency && (
                      <View style={styles.frequencyBadge}>
                        <Clock size={12} color="#3B82F6" />
                        <Text style={styles.frequencyText}>{vaccine.frequency}</Text>
                      </View>
                    )}
                  </View>

                  {vaccine.age_recommendation && (
                    <View style={styles.ageContainer}>
                      <Text style={styles.ageTitle}>Edad recomendada:</Text>
                      <Text style={styles.ageText}>{vaccine.age_recommendation}</Text>
                    </View>
                  )}

                  {vaccine.common_brands && vaccine.common_brands.length > 0 && (
                    <View style={styles.brandsContainer}>
                      <Text style={styles.brandsTitle}>Marcas comunes:</Text>
                      <Text style={styles.brandsText}>
                        {vaccine.common_brands.slice(0, 3).join(', ')}
                        {vaccine.common_brands.length > 3 && '...'}
                      </Text>
                    </View>
                  )}

                  {vaccine.side_effects && vaccine.side_effects.length > 0 && (
                    <View style={styles.sideEffectsContainer}>
                      <AlertTriangle size={12} color="#F59E0B" />
                      <Text style={styles.sideEffectsTitle}>Posibles efectos:</Text>
                      <Text style={styles.sideEffectsText}>
                        {vaccine.side_effects.slice(0, 2).join(', ')}
                        {vaccine.side_effects.length > 2 && '...'}
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
  vaccinesList: {
    gap: 12,
  },
  vaccineCard: {
    marginBottom: 8,
  },
  vaccineContent: {
    padding: 16,
  },
  vaccineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  vaccineName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  typeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  vaccineDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  vaccineDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  requiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  requiredText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#991B1B',
    marginLeft: 4,
  },
  frequencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  frequencyText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    marginLeft: 4,
  },
  ageContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  ageTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  ageText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  brandsContainer: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  brandsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 4,
  },
  brandsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#166534',
  },
  sideEffectsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  sideEffectsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginLeft: 6,
    marginRight: 6,
  },
  sideEffectsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    flex: 1,
  },
});