import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Pill, Clock, Shield, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { EmptyState, SkeletonList } from '../../../components/ui';
import { HealthHeader, HealthSearchBar, SelectionCheck, selectorCardStyles } from '../../../components/health';
import { supabaseClient } from '../../../lib/supabase';
import { envConfig } from '../../../utils/envConfig';
import { colors, spacing, radius, fontSize } from '../../../constants/theme';

export default function SelectDewormer() {
  const { petId, species, breed, ageInMonths, weight, returnPath, currentValue, currentVeterinarian, currentNotes, currentNextDueDate } = useLocalSearchParams<{
    petId: string;
    species: string;
    breed?: string;
    ageInMonths?: string;
    weight?: string;
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
      const petBreed = breed || 'Genérico';
      const petAge = ageInMonths ? parseInt(ageInMonths) : 24;
      const petWeight = weight ? parseFloat(weight) : undefined;

      console.log(`Searching cache for ${species} - ${petBreed}`);

      const { data: cachedData, error: cacheError } = await supabaseClient
        .from('dewormers_ai_cache')
        .select('*')
        .eq('species', species)
        .eq('breed', petBreed)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedData && !cacheError) {
        console.log('✓ Using cached dewormer data for', petBreed);
        const cachedDewormers = cachedData.recommendations.dewormers.map((d: any) => ({
          id: `ai_${d.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: d.name,
          brand: d.brand,
          active_ingredient: d.activeIngredient,
          administration_method: d.administrationMethod,
          parasite_types: d.parasiteTypes,
          frequency: d.frequency,
          age_recommendation: d.ageRecommendation,
          weight_range: d.weightRange,
          prescription_required: d.prescriptionRequired,
          common_side_effects: d.commonSideEffects,
          notes: d.notes,
          is_recommended: d.isRecommended,
          priority: d.priority,
          species: [species],
          is_active: true
        }));
        setDewormers(cachedDewormers);
        setFilteredDewormers(cachedDewormers);
        setLoading(false);
        return;
      }

      console.log('⚠ No cache found, generating with AI...');
      await fetchFromAI(petBreed, petAge, petWeight);
    } catch (error) {
      console.error('Error fetching dewormers:', error);
      await fetchFromCatalog();
    }
  };

  const fetchFromAI = async (petBreed: string, petAge: number, petWeight?: number) => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      const anonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-dewormer-recommendations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || anonKey}`,
          },
          body: JSON.stringify({
            species,
            breed: petBreed,
            ageInMonths: petAge,
            weight: petWeight,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch AI recommendations');
      }

      const result = await response.json();

      const aiDewormers = result.dewormers.map((d: any) => ({
        id: `ai_${d.name.toLowerCase().replace(/\s+/g, '_')}`,
        name: d.name,
        brand: d.brand,
        active_ingredient: d.activeIngredient,
        administration_method: d.administrationMethod,
        parasite_types: d.parasiteTypes,
        frequency: d.frequency,
        age_recommendation: d.ageRecommendation,
        weight_range: d.weightRange,
        prescription_required: d.prescriptionRequired,
        common_side_effects: d.commonSideEffects,
        notes: d.notes,
        is_recommended: d.isRecommended,
        priority: d.priority,
        species: [species],
        is_active: true
      }));

      setDewormers(aiDewormers);
      setFilteredDewormers(aiDewormers);

      console.log(`✓ Generated ${aiDewormers.length} dewormer recommendations via AI`);

      const cacheKey = `${species}_${petBreed}_general`;
      const { error: cacheError } = await supabaseClient
        .from('dewormers_ai_cache')
        .insert({
          species,
          breed: petBreed,
          age_in_months: petAge,
          weight: petWeight,
          recommendations: result,
          cache_key: cacheKey,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (cacheError) {
        console.warn('Could not cache AI recommendations:', cacheError);
      } else {
        console.log('✓ Saved to cache for future use');
      }

    } catch (error) {
      console.error('Error fetching from AI:', error);
      await fetchFromCatalog();
    } finally {
      setLoading(false);
    }
  };

  const fetchFromCatalog = async () => {
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
      console.error('Error fetching dewormers catalog:', error);
      setDewormers([]);
      setFilteredDewormers([]);
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
    router.replace({
      pathname: returnPath as any,
      params: {
        selectedDewormer: JSON.stringify(dewormer),
        // Preserve other form values
        ...(currentVeterinarian && { currentVeterinarian }),
        ...(currentNotes && { currentNotes })
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
    const toneColors: Record<string, string> = {
      oral: colors.primary,
      topical: colors.success,
      injection: colors.danger,
      chewable: colors.warning
    };
    return toneColors[method] || colors.textSecondary;
  };

  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader title={`Elegí el desparasitante ${species === 'dog' ? '🐕' : '🐱'}`} />

      <HealthSearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Buscar desparasitante..." />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando desparasitantes...</Text>
            <SkeletonList kind="cards" count={3} style={styles.skeleton} />
          </View>
        ) : filteredDewormers.length === 0 ? (
          <EmptyState
            icon={<Pill size={32} color={colors.primary} />}
            title="No se encontraron desparasitantes"
            description={searchQuery.trim() ? 'Probá con otros términos de búsqueda.' : 'No pudimos cargar la lista. Probá de nuevo en un momento.'}
            actionLabel={searchQuery.trim() ? 'Limpiar búsqueda' : 'Reintentar'}
            onAction={() => {
              if (searchQuery.trim()) {
                setSearchQuery('');
              } else {
                setLoading(true);
                fetchDewormers();
              }
            }}
          />
        ) : (
          <View style={styles.dewormersList}>
            {filteredDewormers.map((dewormer) => {
              const isSelected = !!currentValue && dewormer.name === currentValue;
              return (
              <Card key={dewormer.id} padding={false} style={[styles.dewormerCard, isSelected && selectorCardStyles.selected]}>
                <TouchableOpacity
                  style={[styles.dewormerContent, selectorCardStyles.touchable]}
                  onPress={() => handleSelectDewormer(dewormer)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={selectorCardStyles.row}>
                  <View style={selectorCardStyles.body}>
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
                        <Shield size={12} color={colors.danger} />
                        <Text style={styles.prescriptionText}>Requiere receta</Text>
                      </View>
                    )}
                    
                    {dewormer.frequency && (
                      <View style={styles.frequencyBadge}>
                        <Clock size={12} color={colors.primary} />
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
                      <AlertTriangle size={12} color={colors.warning} />
                      <Text style={styles.sideEffectsTitle}>Posibles efectos:</Text>
                      <Text style={styles.sideEffectsText}>
                        {dewormer.common_side_effects.slice(0, 2).join(', ')}
                        {dewormer.common_side_effects.length > 2 && '...'}
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
  dewormersList: {
    gap: spacing.md,
  },
  dewormerCard: {
    marginBottom: spacing.sm,
  },
  dewormerContent: {
    padding: spacing.lg,
  },
  dewormerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  dewormerName: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  methodIcon: {
    fontSize: fontSize.xs,
    marginRight: spacing.xs,
  },
  methodText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
  },
  brandText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  ingredientText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  dewormerDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  prescriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  prescriptionText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.danger,
    marginLeft: spacing.xs,
  },
  frequencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  frequencyText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.primaryStrong,
    marginLeft: spacing.xs,
  },
  parasitesContainer: {
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  parasitesTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.success,
    marginBottom: spacing.xs,
  },
  parasitesText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.success,
  },
  ageContainer: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  ageTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  ageText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  sideEffectsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginLeft: 6,
    marginRight: 6,
  },
  sideEffectsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.warning,
    flex: 1,
  },
});
