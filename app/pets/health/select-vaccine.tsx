import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, Syringe, Shield, Clock, TriangleAlert as AlertTriangle, Calendar } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [petData, setPetData] = useState<any>(null);

  useEffect(() => {
    fetchVaccines();
  }, []);

  useEffect(() => {
    filterVaccines();
  }, [searchQuery, vaccines]);

  const fetchVaccines = async () => {
    try {
      // Primero obtener datos de la mascota
      const { data: pet, error: petError } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('id', petId)
        .single();

      if (petError) throw petError;
      setPetData(pet);

      // Calcular edad en meses
      let ageInMonths = undefined;
      if (pet.birth_date) {
        const birthDate = new Date(pet.birth_date);
        const today = new Date();
        const monthsDiff = (today.getFullYear() - birthDate.getFullYear()) * 12 +
                          (today.getMonth() - birthDate.getMonth());
        ageInMonths = Math.max(0, monthsDiff);
      }

      // Generar clave de caché basada en especie y edad
      const cacheKey = `vaccines_${species}_${ageInMonths || 'all'}_${pet.breed || 'general'}`;

      // Intentar cargar desde caché
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          const cacheAge = Date.now() - cachedData.timestamp;

          // Caché válido por 7 días (604800000 ms)
          if (cacheAge < 604800000) {
            console.log('Cargando vacunas desde caché');
            setVaccines(cachedData.vaccines || []);
            setFilteredVaccines(cachedData.vaccines || []);
            setLoading(false);
            return;
          }
        }
      } catch (cacheError) {
        console.log('No se pudo cargar caché:', cacheError);
      }

      // Si no hay caché válido, consultar la API
      console.log('Consultando vacunas con IA...');
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-vaccine-recommendations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            species: species,
            ageInMonths: ageInMonths,
            breed: pet.breed,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Error al obtener vacunas');
      }

      const data = await response.json();
      const vaccines = data.vaccines || [];

      setVaccines(vaccines);
      setFilteredVaccines(vaccines);

      // Guardar en caché
      try {
        const cacheData = {
          vaccines,
          timestamp: Date.now(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('Vacunas guardadas en caché');
      } catch (cacheError) {
        console.error('Error al guardar en caché:', cacheError);
      }
    } catch (error) {
      console.error('Error fetching vaccines:', error);
      // Fallback a lista básica si falla
      setVaccines([]);
      setFilteredVaccines([]);
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

    // Calcular próxima dosis automáticamente basada en la frecuencia
    let calculatedNextDueDate = null;
    if (vaccine.frequency) {
      const today = new Date();
      const frequency = vaccine.frequency.toLowerCase();

      if (frequency.includes('anual') || frequency.includes('yearly')) {
        const nextDate = new Date(today);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        calculatedNextDueDate = nextDate.toISOString();
      } else if (frequency.includes('cada 3 años') || frequency.includes('every 3 years')) {
        const nextDate = new Date(today);
        nextDate.setFullYear(nextDate.getFullYear() + 3);
        calculatedNextDueDate = nextDate.toISOString();
      } else if (frequency.includes('6 meses') || frequency.includes('6 months')) {
        const nextDate = new Date(today);
        nextDate.setMonth(nextDate.getMonth() + 6);
        calculatedNextDueDate = nextDate.toISOString();
      } else if (frequency.includes('3-4 semanas') || frequency.includes('3-4 weeks') || frequency.includes('serie')) {
        // Para series de vacunación, la próxima dosis es en 3-4 semanas
        const nextDate = new Date(today);
        nextDate.setDate(nextDate.getDate() + 28); // 4 semanas
        calculatedNextDueDate = nextDate.toISOString();
      } else if (frequency.includes('refuerzo') && petData) {
        // Calcular basado en edad de la mascota
        let ageInMonths = undefined;
        if (petData.birth_date) {
          const birthDate = new Date(petData.birth_date);
          const monthsDiff = (today.getFullYear() - birthDate.getFullYear()) * 12 +
                            (today.getMonth() - birthDate.getMonth());
          ageInMonths = Math.max(0, monthsDiff);
        }

        const nextDate = new Date(today);
        if (ageInMonths !== undefined && ageInMonths < 4) {
          // Cachorro/gatito - siguiente dosis en 3-4 semanas
          nextDate.setDate(nextDate.getDate() + 28);
        } else {
          // Adulto - refuerzo anual
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
        calculatedNextDueDate = nextDate.toISOString();
      }
    }

    router.push({
      pathname: returnPath,
      params: {
        selectedVaccine: JSON.stringify(vaccine),
        // Preserve other form values
        ...(currentVeterinarian && { currentVeterinarian }),
        ...(currentNotes && { currentNotes }),
        // Usar la fecha calculada o la existente
        currentNextDueDate: calculatedNextDueDate || currentNextDueDate
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
            {filteredVaccines.map((vaccine, index) => (
              <Card key={index} style={styles.vaccineCard}>
                <TouchableOpacity
                  style={styles.vaccineContent}
                  onPress={() => handleSelectVaccine(vaccine)}
                >
                  <View style={styles.vaccineHeader}>
                    <View style={styles.vaccineTitleContainer}>
                      <Text style={styles.vaccineName}>{vaccine.name}</Text>
                      {vaccine.fullName && vaccine.fullName !== vaccine.name && (
                        <Text style={styles.vaccineFullName}>{vaccine.fullName}</Text>
                      )}
                    </View>
                    {vaccine.isEssential && (
                      <View style={styles.essentialBadge}>
                        <Shield size={14} color="#DC2626" />
                        <Text style={styles.essentialText}>Esencial</Text>
                      </View>
                    )}
                  </View>

                  {vaccine.description && (
                    <Text style={styles.vaccineDescription}>
                      {vaccine.description}
                    </Text>
                  )}

                  <View style={styles.vaccineDetails}>
                    <View style={styles.detailRow}>
                      <Clock size={14} color="#3B82F6" />
                      <Text style={styles.detailLabel}>Frecuencia:</Text>
                      <Text style={styles.detailValue}>{vaccine.frequency}</Text>
                    </View>

                    {vaccine.recommendedAgeWeeks && vaccine.recommendedAgeWeeks.length > 0 && (
                      <View style={styles.detailRow}>
                        <Calendar size={14} color="#10B981" />
                        <Text style={styles.detailLabel}>Edad recomendada:</Text>
                        <Text style={styles.detailValue}>
                          {vaccine.recommendedAgeWeeks[0]}-{vaccine.recommendedAgeWeeks[vaccine.recommendedAgeWeeks.length - 1]} semanas
                        </Text>
                      </View>
                    )}
                  </View>

                  {vaccine.commonBrands && vaccine.commonBrands.length > 0 && (
                    <View style={styles.brandsContainer}>
                      <Text style={styles.brandsLabel}>Marcas comunes:</Text>
                      <Text style={styles.brandsText}>
                        {vaccine.commonBrands.join(', ')}
                      </Text>
                    </View>
                  )}

                  {vaccine.sideEffects && (
                    <View style={styles.sideEffectsContainer}>
                      <AlertTriangle size={12} color="#F59E0B" />
                      <Text style={styles.sideEffectsLabel}>Posibles efectos:</Text>
                      <Text style={styles.sideEffectsText}>{vaccine.sideEffects}</Text>
                    </View>
                  )}

                  {vaccine.notes && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesText}>💡 {vaccine.notes}</Text>
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
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  content: {
    flex: 1,
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
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  vaccinesList: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  vaccineCard: {
    marginBottom: 16,
  },
  vaccineContent: {
    padding: 16,
  },
  vaccineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vaccineTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  vaccineName: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  vaccineFullName: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  essentialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  essentialText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
  },
  vaccineDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  vaccineDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
  },
  brandsContainer: {
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  brandsLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#059669',
    marginBottom: 4,
  },
  brandsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#047857',
  },
  sideEffectsContainer: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  sideEffectsLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#D97706',
  },
  sideEffectsText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#B45309',
    flex: 1,
  },
  notesContainer: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 16,
  },
});
