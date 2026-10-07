import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Syringe, Shield, Clock, TriangleAlert as AlertTriangle, Calendar } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '../../../components/ui/Card';
import { Badge, EmptyState, SkeletonList } from '../../../components/ui';
import { HealthHeader, HealthSearchBar, SelectionCheck } from '../../../components/health';
import { supabaseClient } from '../../../lib/supabase';
import { envConfig } from '../../../utils/envConfig';
import { colors, spacing, radius, fontSize } from '../../../constants/theme';

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
        `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/generate-vaccine-recommendations`,
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
      pathname: returnPath as any,
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
    const toneColors: Record<string, string> = {
      core: colors.danger, // Red for required
      non_core: colors.primary, // Blue for recommended
      lifestyle: colors.success // Green for lifestyle
    };
    return toneColors[type] || colors.textSecondary;
  };

  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader
        title={`Elegí la vacuna ${species === 'dog' ? '🐕' : '🐱'}`}
        subtitle="Recomendadas según especie y edad"
      />

      <HealthSearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Buscar vacuna..." />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <SkeletonList kind="cards" count={4} />
        ) : filteredVaccines.length === 0 ? (
          <EmptyState
            icon={<Syringe size={32} color={colors.primary} />}
            title="No se encontraron vacunas"
            description={searchQuery.trim() ? 'Probá con otros términos de búsqueda.' : 'No pudimos cargar las recomendaciones. Probá de nuevo en un momento.'}
            actionLabel={searchQuery.trim() ? 'Limpiar búsqueda' : 'Reintentar'}
            onAction={() => {
              if (searchQuery.trim()) {
                setSearchQuery('');
              } else {
                setLoading(true);
                fetchVaccines();
              }
            }}
          />
        ) : (
          <View style={styles.vaccinesList}>
            {filteredVaccines.map((vaccine, index) => {
              const isSelected = !!currentValue && vaccine.name === currentValue;
              return (
              <Card key={index} padding={false} style={[styles.vaccineCard, isSelected && styles.cardSelected]}>
                <TouchableOpacity
                  style={styles.vaccineContent}
                  onPress={() => handleSelectVaccine(vaccine)}
                  accessibilityRole="button"
                  accessibilityLabel={`Elegir ${vaccine.name}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.vaccineHeader}>
                    <View style={styles.vaccineTitleContainer}>
                      <Text style={styles.vaccineName}>{vaccine.name}</Text>
                      {vaccine.fullName && vaccine.fullName !== vaccine.name && (
                        <Text style={styles.vaccineFullName}>{vaccine.fullName}</Text>
                      )}
                    </View>
                    <View style={styles.headerRight}>
                      {vaccine.isEssential && (
                        <Badge label="Esencial" tone="primary" size="small" icon={<Shield size={12} color={colors.primary} />} />
                      )}
                      <SelectionCheck selected={isSelected} />
                    </View>
                  </View>

                  {vaccine.description && (
                    <Text style={styles.vaccineDescription}>
                      {vaccine.description}
                    </Text>
                  )}

                  <View style={styles.vaccineDetails}>
                    <View style={styles.detailRow}>
                      <Clock size={14} color={colors.primary} />
                      <Text style={styles.detailLabel}>Frecuencia:</Text>
                      <Text style={styles.detailValue}>{vaccine.frequency}</Text>
                    </View>

                    {vaccine.recommendedAgeWeeks && vaccine.recommendedAgeWeeks.length > 0 && (
                      <View style={styles.detailRow}>
                        <Calendar size={14} color={colors.success} />
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
                      <AlertTriangle size={12} color={colors.warning} />
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
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.text,
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
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  vaccinesList: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  vaccineCard: {
    marginBottom: spacing.md,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vaccineContent: {
    padding: spacing.lg,
  },
  vaccineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  vaccineTitleContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  vaccineName: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  vaccineFullName: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  essentialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  essentialText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: colors.danger,
  },
  vaccineDescription: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  vaccineDetails: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    flex: 1,
  },
  brandsContainer: {
    backgroundColor: colors.successSoft,
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  brandsLabel: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-SemiBold',
    color: colors.success,
    marginBottom: spacing.xs,
  },
  brandsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.success,
  },
  sideEffectsContainer: {
    backgroundColor: colors.warningSoft,
    padding: 10,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: spacing.sm,
  },
  sideEffectsLabel: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-SemiBold',
    color: colors.warning,
  },
  sideEffectsText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.warning,
    flex: 1,
  },
  notesContainer: {
    backgroundColor: colors.primarySoft,
    padding: 10,
    borderRadius: radius.sm,
  },
  notesText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.primaryStrong,
    lineHeight: 16,
  },
});
