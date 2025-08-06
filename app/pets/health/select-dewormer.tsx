import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, Pill, Clock, Shield, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { supabaseClient } from '../../../lib/supabase';

export default function SelectDewormer() {
  const { petId, species, returnPath, currentValue, currentVeterinarian, currentNotes, currentNextDueDate } = useLocalSearchParams<{
    petId: string;
    species: string;
    returnPath: string;
    currentValue?: string;
    currentVeterinarian?: string;
    currentNotes?: string;
    currentNextDueDate?: string;
  }>();

  const [dewormers, setDewormers] = useState<any[]>([]);
  const [filteredDewormers, setFilteredDewormers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDewormers();
  }, []);

  useEffect(() => {
    filterDewormers();
  }, [searchQuery, dewormers]);

  const fetchDewormers = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('dewormers_catalog')
        .select('*')
        .eq('is_active', true)
        .in('species', [species, 'both'])
        .order('name', { ascending: true });

      if (error) throw error;
      setDewormers(data || []);
      setFilteredDewormers(data || []);
    } catch (error) {
      console.error('Error fetching dewormers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterDewormers = () => {
    if (searchQuery.trim()) {
      const filtered = dewormers.filter(dewormer =>
        dewormer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dewormer.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dewormer.active_ingredient?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredDewormers(filtered);
    } else {
      setFilteredDewormers(dewormers);
    }
  };

  const handleSelectDewormer = (dewormer: any) => {
    console.log('Navigating back with dewormer:', dewormer.name);
    router.push({
      pathname: returnPath,
      params: {
        selectedDewormer: JSON.stringify(dewormer),
        // Preserve other form values
        ...(currentVeterinarian && { currentVeterinarian }),
        ...(currentNotes && { currentNotes }),
        ...(currentNextDueDate && { currentNextDueDate })
      }
    });
  };

  const getMethodIcon = (method: string) => {
    const icons: Record<string, string> = {
      oral: '💊',
      topical: '🧴',
      injection: '💉',
      chewable: '🍖'
    };
    return icons[method] || '💊';
  };

  const getMethodName = (method: string) => {
    const names: Record<string, string> = {
      oral: 'Oral',
      topical: 'Tópico',
      injection: 'Inyección',
      chewable: 'Masticable'
    };
    return names[method] || 'Oral';
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      oral: '#3B82F6',
      topical: '#10B981',
      injection: '#EF4444',
      chewable: '#F59E0B'
    };
    return colors[method] || '#6B7280';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>
          Seleccionar Desparasitante {species === 'dog' ? '🐕' : '🐱'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar desparasitante..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando desparasitantes...</Text>
          </View>
        ) : filteredDewormers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Pill size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No se encontraron desparasitantes</Text>
            <Text style={styles.emptySubtitle}>
              Intenta con otros términos de búsqueda
            </Text>
          </View>
        ) : (
          <View style={styles.dewormersList}>
            {filteredDewormers.map((dewormer) => (
              <Card key={dewormer.id} style={styles.dewormerCard}>
                <TouchableOpacity
                  style={styles.dewormerContent}
                  onPress={() => handleSelectDewormer(dewormer)}
                >
                  <View style={styles.dewormerHeader}>
                    <Text style={styles.dewormerName}>{dewormer.name}</Text>
                    <View style={[styles.methodBadge, { backgroundColor: getMethodColor(dewormer.administration_method) + '20' }]}>
                      <Text style={styles.methodIcon}>
                        {getMethodIcon(dewormer.administration_method)}
                      </Text>
                      <Text style={[styles.methodText, { color: getMethodColor(dewormer.administration_method) }]}>
                        {getMethodName(dewormer.administration_method)}
                      </Text>
                    </View>
                  </View>

                  {dewormer.brand && (
                    <Text style={styles.brandText}>Marca: {dewormer.brand}</Text>
                  )}

                  {dewormer.active_ingredient && (
                    <Text style={styles.ingredientText}>
                      Principio activo: {dewormer.active_ingredient}
                    </Text>
                  )}

                  <View style={styles.dewormerDetails}>
                    {dewormer.prescription_required && (
                      <View style={styles.prescriptionBadge}>
                        <Shield size={12} color="#EF4444" />
                        <Text style={styles.prescriptionText}>Requiere receta</Text>
                      </View>
                    )}
                    
                    {dewormer.frequency && (
                      <View style={styles.frequencyBadge}>
                        <Clock size={12} color="#3B82F6" />
                        <Text style={styles.frequencyText}>{dewormer.frequency}</Text>
                      </View>
                    )}
                  </View>

                  {dewormer.parasite_types && dewormer.parasite_types.length > 0 && (
                    <View style={styles.parasitesContainer}>
                      <Text style={styles.parasitesTitle}>Trata:</Text>
                      <Text style={styles.parasitesText}>
                        {dewormer.parasite_types.slice(0, 3).join(', ')}
                        {dewormer.parasite_types.length > 3 && '...'}
                      </Text>
                    </View>
                  )}

                  {dewormer.age_recommendation && (
                    <View style={styles.ageContainer}>
                      <Text style={styles.ageTitle}>Edad recomendada:</Text>
                      <Text style={styles.ageText}>{dewormer.age_recommendation}</Text>
                    </View>
                  )}

                  {dewormer.common_side_effects && dewormer.common_side_effects.length > 0 && (
                    <View style={styles.sideEffectsContainer}>
                      <AlertTriangle size={12} color="#F59E0B" />
                      <Text style={styles.sideEffectsTitle}>Posibles efectos:</Text>
                      <Text style={styles.sideEffectsText}>
                        {dewormer.common_side_effects.slice(0, 2).join(', ')}
                        {dewormer.common_side_effects.length > 2 && '...'}
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
  dewormersList: {
    gap: 12,
  },
  dewormerCard: {
    marginBottom: 8,
  },
  dewormerContent: {
    padding: 16,
  },
  dewormerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dewormerName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  methodIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  methodText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  brandText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 4,
  },
  ingredientText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  dewormerDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  prescriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  prescriptionText: {
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
  parasitesContainer: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  parasitesTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 4,
  },
  parasitesText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#166534',
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