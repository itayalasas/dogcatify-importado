import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, Pill } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { supabaseClient } from '../../../lib/supabase';

export default function SelectTreatment() {
  const { petId, conditionId, returnPath, currentValue, currentCondition, currentVeterinarian, currentNotes } = useLocalSearchParams<{
    petId: string;
    conditionId?: string;
    returnPath: string;
    currentValue?: string;
    currentCondition?: string;
    currentVeterinarian?: string;
    currentNotes?: string;
  }>();

  const [treatments, setTreatments] = useState<any[]>([]);
  const [filteredTreatments, setFilteredTreatments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTreatments();
  }, []);

  useEffect(() => {
    filterTreatments();
  }, [searchQuery, treatments]);

  const fetchTreatments = async () => {
    try {
      let query = supabaseClient
        .from('medical_treatments')
        .select('*')
        .eq('is_active', true);

      // If conditionId is provided, filter by condition
      if (conditionId) {
        query = query.eq('condition_id', conditionId);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) throw error;
      setTreatments(data || []);
      setFilteredTreatments(data || []);
    } catch (error) {
      console.error('Error fetching treatments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTreatments = () => {
    if (searchQuery.trim()) {
      const filtered = treatments.filter(treatment =>
        treatment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        treatment.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        treatment.type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTreatments(filtered);
    } else {
      setFilteredTreatments(treatments);
    }
  };

  const handleSelectTreatment = (treatment: any) => {
    // Navigate back with selected treatment
    console.log('Navigating back with treatment:', treatment.name);
    router.push({
      pathname: returnPath,
      params: {
        selectedTreatment: JSON.stringify(treatment),
        // Preserve other form values from navigation params
        ...(currentCondition && { selectedCondition: JSON.stringify({ name: currentCondition }) }),
        ...(currentVeterinarian && { selectedVeterinarian: JSON.stringify({ name: currentVeterinarian }) }),
        ...(currentNotes && { currentNotes: currentNotes })
      }
    });
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      medication: '💊',
      therapy: '🏥',
      surgery: '🔪',
      diet: '🥗',
      lifestyle: '🏃',
      supplement: '🧪',
      topical: '🧴',
      injection: '💉',
      other: '📋'
    };
    return icons[type] || '📋';
  };

  const getTypeName = (type: string) => {
    const names: Record<string, string> = {
      medication: 'Medicamento',
      therapy: 'Terapia',
      surgery: 'Cirugía',
      diet: 'Dieta',
      lifestyle: 'Estilo de vida',
      supplement: 'Suplemento',
      topical: 'Tópico',
      injection: 'Inyección',
      other: 'Otro'
    };
    return names[type] || 'Sin tipo';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Seleccionar Tratamiento</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar tratamiento..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando tratamientos...</Text>
          </View>
        ) : filteredTreatments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Pill size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No se encontraron tratamientos</Text>
            <Text style={styles.emptySubtitle}>
              Intenta con otros términos de búsqueda
            </Text>
          </View>
        ) : (
          <View style={styles.treatmentsList}>
            {filteredTreatments.map((treatment) => (
              <Card key={treatment.id} style={styles.treatmentCard}>
                <TouchableOpacity
                  style={styles.treatmentContent}
                  onPress={() => handleSelectTreatment(treatment)}
                >
                  <View style={styles.treatmentHeader}>
                    <Text style={styles.treatmentName}>{treatment.name}</Text>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeIcon}>
                        {getTypeIcon(treatment.type)}
                      </Text>
                      <Text style={styles.typeText}>
                        {getTypeName(treatment.type)}
                      </Text>
                    </View>
                  </View>

                  {treatment.description && (
                    <Text style={styles.treatmentDescription} numberOfLines={2}>
                      {treatment.description}
                    </Text>
                  )}

                  <View style={styles.treatmentDetails}>
                    {treatment.is_prescription_required && (
                      <View style={styles.prescriptionBadge}>
                        <Text style={styles.prescriptionText}>📋 Requiere receta</Text>
                      </View>
                    )}
                    
                    {treatment.cost_range && (
                      <View style={styles.costBadge}>
                        <Text style={styles.costText}>💰 {treatment.cost_range}</Text>
                      </View>
                    )}
                  </View>

                  {treatment.dosage_info && (
                    <View style={styles.dosageContainer}>
                      <Text style={styles.dosageTitle}>Dosificación:</Text>
                      <Text style={styles.dosageText}>{treatment.dosage_info}</Text>
                    </View>
                  )}

                  {treatment.side_effects && treatment.side_effects.length > 0 && (
                    <View style={styles.sideEffectsContainer}>
                      <Text style={styles.sideEffectsTitle}>Efectos secundarios:</Text>
                      <Text style={styles.sideEffectsText}>
                        {treatment.side_effects.slice(0, 2).join(', ')}
                        {treatment.side_effects.length > 2 && '...'}
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
  treatmentsList: {
    gap: 12,
  },
  treatmentCard: {
    marginBottom: 8,
  },
  treatmentContent: {
    padding: 16,
  },
  treatmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  treatmentName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
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
    color: '#166534',
  },
  treatmentDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  treatmentDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  prescriptionBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  prescriptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#991B1B',
  },
  costBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  costText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#166534',
  },
  dosageContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dosageTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  dosageText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  sideEffectsContainer: {
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
    marginBottom: 4,
  },
  sideEffectsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
  },
});