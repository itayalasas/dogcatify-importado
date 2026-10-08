import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Heart, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { EmptyState, SkeletonList } from '../../../components/ui';
import { HealthHeader, HealthSearchBar, SelectionCheck, selectorCardStyles } from '../../../components/health';
import { supabaseClient } from '../../../lib/supabase';
import { envConfig } from '../../../utils/envConfig';
import { colors, spacing, radius, fontSize } from '../../../constants/theme';

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
      const petBreed = breed || 'Genérico';

      console.log(`Searching cache for ${species} - ${petBreed}`);

      const { data: cachedData, error: cacheError } = await supabaseClient
        .from('illnesses_ai_cache')
        .select('*')
        .eq('species', species)
        .eq('breed', petBreed)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedData && cachedData.illnesses) {
        console.log('✓ Using cached illness data for', petBreed);
        const illnesses = typeof cachedData.illnesses === 'string'
          ? JSON.parse(cachedData.illnesses)
          : cachedData.illnesses;
        setConditions(illnesses);
        setFilteredConditions(illnesses);
        setLoading(false);
        return;
      }

      console.log('⚠ No cache found, generating with AI...');
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      const supabaseAnonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

      const petAge = ageInMonths ? parseInt(ageInMonths) : 24;
      const petWeight = weight ? parseFloat(weight) : undefined;

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
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error('Error generating illness recommendations');
      }

      const { illnesses } = await response.json();
      console.log(`✓ Generated ${illnesses.length} illness recommendations via AI`);

      const cacheKey = `${species}_${petBreed}_general`;
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

      console.log('✓ Saved to cache for future use');
      setConditions(illnesses);
      setFilteredConditions(illnesses);
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
      pathname: returnPath as any,
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
      <HealthHeader title={`Elegí la enfermedad ${species === 'dog' ? '🐕' : '🐱'}`} />

      <HealthSearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Buscar enfermedad..." />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              {breed ? 'Generando recomendaciones con IA...' : 'Cargando enfermedades...'}
            </Text>
            {breed && (
              <Text style={styles.loadingSubtext}>
                Analizando predisposiciones para {species === 'dog' ? 'perros' : 'gatos'} {breed}
              </Text>
            )}
            <SkeletonList kind="cards" count={3} style={styles.skeleton} />
          </View>
        ) : filteredConditions.length === 0 ? (
          <EmptyState
            icon={<Heart size={32} color={colors.primary} />}
            title="No se encontraron enfermedades"
            description={searchQuery.trim() ? 'Probá con otros términos de búsqueda.' : 'No pudimos cargar la lista. Probá de nuevo en un momento.'}
            actionLabel={searchQuery.trim() ? 'Limpiar búsqueda' : 'Reintentar'}
            onAction={() => {
              if (searchQuery.trim()) {
                setSearchQuery('');
              } else {
                setLoading(true);
                fetchConditions();
              }
            }}
          />
        ) : (
          <View style={styles.conditionsList}>
            {filteredConditions.map((condition, index) => {
              const isSelected = !!currentValue && condition.name === currentValue;
              return (
              <Card key={condition.id || `illness-${index}`} padding={false} style={[styles.conditionCard, isSelected && selectorCardStyles.selected]}>
                <TouchableOpacity
                  style={[styles.conditionContent, selectorCardStyles.touchable]}
                  onPress={() => handleSelectCondition(condition)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={selectorCardStyles.row}>
                  <View style={selectorCardStyles.body}>
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
  conditionsList: {
    gap: spacing.md,
  },
  conditionCard: {
    marginBottom: spacing.sm,
  },
  conditionContent: {
    padding: spacing.lg,
  },
  conditionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  conditionName: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  categoryIcon: {
    fontSize: fontSize.sm,
    marginRight: spacing.xs,
  },
  categoryText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.primaryStrong,
  },
  conditionDescription: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  conditionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chronicBadge: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  chronicText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.warning,
  },
  contagiousBadge: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  severityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  severityHigh: {
    backgroundColor: colors.dangerSoft,
  },
  severityMedium: {
    backgroundColor: colors.warningSoft,
  },
  severityLow: {
    backgroundColor: colors.successSoft,
  },
  severityText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
  },
  contagiousText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.danger,
  },
  symptomsContainer: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  symptomsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  symptomsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
