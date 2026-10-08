import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Pill } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { EmptyState, SkeletonList } from '../../../components/ui';
import { HealthHeader, HealthSearchBar, SelectionCheck, selectorCardStyles } from '../../../components/health';
import { supabaseClient } from '../../../lib/supabase';
import { envConfig } from '../../../utils/envConfig';
import { colors, spacing, radius, fontSize } from '../../../constants/theme';

export default function SelectTreatment() {
  const { petId, conditionId, species, illnessName, ageInMonths, weight, returnPath, currentValue, currentCondition, currentSelectedCondition, currentVeterinarian, currentNotes } = useLocalSearchParams<{
    petId: string;
    conditionId?: string;
    species?: string;
    illnessName?: string;
    ageInMonths?: string;
    weight?: string;
    returnPath: string;
    currentValue?: string;
    currentCondition?: string;
    currentSelectedCondition?: string;
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
      const illness = illnessName || currentCondition;
      const petSpecies = species || 'dog';

      if (!illness) {
        setLoading(false);
        return;
      }

      console.log(`Searching cache for ${petSpecies} - ${illness}`);

      const { data: cachedData, error: cacheError } = await supabaseClient
        .from('treatments_ai_cache')
        .select('*')
        .eq('species', petSpecies)
        .eq('illness_name', illness)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedData && cachedData.treatments) {
        console.log('✓ Using cached treatment data for', illness);
        const cachedTreatments = typeof cachedData.treatments === 'string'
          ? JSON.parse(cachedData.treatments)
          : cachedData.treatments;
        setTreatments(cachedTreatments);
        setFilteredTreatments(cachedTreatments);
        setLoading(false);
        return;
      }

      console.log('⚠ No cache found, generating with AI...');
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      const supabaseAnonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

      const petAge = ageInMonths ? parseInt(ageInMonths) : 24;
      const petWeight = weight ? parseFloat(weight) : undefined;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-treatment-recommendations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            species: petSpecies,
            illnessName: illness,
            ageInMonths: petAge,
            weight: petWeight
          })
        }
      );

      if (!response.ok) {
        throw new Error('Error generating treatment recommendations');
      }

      const { treatments: aiTreatments } = await response.json();
      console.log(`✓ Generated ${aiTreatments.length} treatment recommendations via AI`);

      const cacheKey = `${petSpecies}_${illness}_general`;
      await supabaseClient
        .from('treatments_ai_cache')
          .insert({
            species: petSpecies,
            illness_name: illness,
            age_in_months: petAge,
            weight: petWeight,
            treatments: aiTreatments,
            cache_key: cacheKey
        });

      console.log('✓ Saved to cache for future use');
      setTreatments(aiTreatments);
      setFilteredTreatments(aiTreatments);
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
    console.log('Navigating back with treatment:', treatment.name);
    router.replace({
      pathname: returnPath as any,
      params: {
        selectedTreatment: JSON.stringify(treatment),
        ...(currentSelectedCondition && { currentSelectedCondition }),
        ...(currentCondition && { currentCondition }),
        ...(currentVeterinarian && { currentVeterinarian }),
        ...(currentNotes && { currentNotes })
      }
    });
  };

  const getTypeIcon = (type: string) => {
    const normalizedType = type?.toLowerCase() || 'other';
    const icons: Record<string, string> = {
      medicamento: '💊',
      medication: '💊',
      suplemento: '🧪',
      supplement: '🧪',
      terapia: '🏥',
      therapy: '🏥',
      procedimiento: '🔬',
      procedure: '🔬',
      cirugía: '🔪',
      surgery: '🔪',
      'cuidado en casa': '🏠',
      'home care': '🏠',
      dieta: '🥗',
      diet: '🥗',
      lifestyle: '🏃',
      topical: '🧴',
      injection: '💉',
      other: '📋'
    };
    return icons[normalizedType] || '💊';
  };

  const getTypeName = (type: string) => {
    if (!type) return 'Sin tipo';
    const normalizedType = type.toLowerCase();
    const names: Record<string, string> = {
      medicamento: 'Medicamento',
      medication: 'Medicamento',
      suplemento: 'Suplemento',
      supplement: 'Suplemento',
      terapia: 'Terapia',
      therapy: 'Terapia',
      procedimiento: 'Procedimiento',
      procedure: 'Procedimiento',
      cirugía: 'Cirugía',
      surgery: 'Cirugía',
      'cuidado en casa': 'Cuidado en casa',
      'home care': 'Cuidado en casa',
      dieta: 'Dieta',
      diet: 'Dieta',
      lifestyle: 'Estilo de vida',
      topical: 'Tópico',
      injection: 'Inyección',
      other: 'Otro'
    };
    return names[normalizedType] || type;
  };

  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader title={'Elegí el tratamiento'} subtitle={illnessName ? `Para ${illnessName}` : undefined} />

      <HealthSearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Buscar tratamiento..." />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              {illnessName ? 'Generando recomendaciones con IA...' : 'Cargando tratamientos...'}
            </Text>
            {illnessName && (
              <Text style={styles.loadingSubtext}>
                Analizando tratamientos para {illnessName}
              </Text>
            )}
            <SkeletonList kind="cards" count={3} style={styles.skeleton} />
          </View>
        ) : filteredTreatments.length === 0 ? (
          <EmptyState
            icon={<Pill size={32} color={colors.primary} />}
            title="No se encontraron tratamientos"
            description={searchQuery.trim() ? 'Probá con otros términos de búsqueda.' : 'No pudimos cargar la lista. Probá de nuevo en un momento.'}
            actionLabel={searchQuery.trim() ? 'Limpiar búsqueda' : 'Reintentar'}
            onAction={() => {
              if (searchQuery.trim()) {
                setSearchQuery('');
              } else {
                setLoading(true);
                fetchTreatments();
              }
            }}
          />
        ) : (
          <View style={styles.treatmentsList}>
            {filteredTreatments.map((treatment, index) => {
              const isSelected = !!currentValue && treatment.name === currentValue;
              return (
              <Card key={treatment.id || `treatment-${index}`} padding={false} style={[styles.treatmentCard, isSelected && selectorCardStyles.selected]}>
                <TouchableOpacity
                  style={[styles.treatmentContent, selectorCardStyles.touchable]}
                  onPress={() => handleSelectTreatment(treatment)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={selectorCardStyles.row}>
                  <View style={selectorCardStyles.body}>
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
                    {(treatment.is_prescription_required || treatment.requires_prescription) && (
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

                  {(treatment.dosage_info || treatment.dosage) && (
                    <View style={styles.dosageContainer}>
                      <Text style={styles.dosageTitle}>Dosificación:</Text>
                      <Text style={styles.dosageText}>{treatment.dosage_info || treatment.dosage}</Text>
                    </View>
                  )}

                  {treatment.duration && (
                    <View style={styles.durationContainer}>
                      <Text style={styles.durationTitle}>Duración:</Text>
                      <Text style={styles.durationText}>{treatment.duration}</Text>
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
                  </View>
                  <View style={selectorCardStyles.check}>
                    <SelectionCheck selected={isSelected} />
                  </View>
                </View>
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
  skeleton: {
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    marginTop: spacing.lg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
    width: 32,
  },
  searchContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
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
    marginTop: spacing.lg,
  },
  loadingSubtext: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  treatmentsList: {
    gap: spacing.md,
  },
  treatmentCard: {
    marginBottom: spacing.sm,
  },
  treatmentContent: {
    padding: spacing.lg,
  },
  treatmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  treatmentName: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  typeIcon: {
    fontSize: fontSize.sm,
    marginRight: spacing.xs,
  },
  typeText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.success,
  },
  treatmentDescription: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  treatmentDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  prescriptionBadge: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  prescriptionText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.danger,
  },
  costBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  costText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.success,
  },
  dosageContainer: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  dosageTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  dosageText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  durationContainer: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  durationTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  durationText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  sideEffectsContainer: {
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  sideEffectsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  sideEffectsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.warning,
  },
});
