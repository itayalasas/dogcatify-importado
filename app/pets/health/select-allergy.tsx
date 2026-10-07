import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { EmptyState, SkeletonList } from '../../../components/ui';
import { HealthHeader, HealthSearchBar, SelectionCheck, selectorCardStyles } from '../../../components/health';
import { supabaseClient } from '../../../lib/supabase';
import { envConfig } from '../../../utils/envConfig';
import { colors, spacing, radius, fontSize } from '../../../constants/theme';

export default function SelectAllergy() {
  const { petId, species, breed, ageInMonths, weight, returnPath, currentValue, currentType, currentSymptoms, currentSeverity, currentTreatment, currentVeterinarian, currentNotes, currentDiagnosisDate } = useLocalSearchParams<{
    petId: string;
    species: string;
    breed?: string;
    ageInMonths?: string;
    weight?: string;
    returnPath: string;
    currentValue?: string;
    currentType?: string;
    currentSymptoms?: string;
    currentSeverity?: string;
    currentTreatment?: string;
    currentVeterinarian?: string;
    currentNotes?: string;
    currentDiagnosisDate?: string;
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
      const petBreed = breed || 'Genérico';

      console.log(`Searching cache for ${species} - ${petBreed}`);

      const { data: cachedData, error: cacheError } = await supabaseClient
        .from('allergies_ai_cache')
        .select('*')
        .eq('species', species)
        .eq('breed', petBreed)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedData && cachedData.allergies) {
        console.log('✓ Using cached allergy data for', petBreed);
        const cachedAllergies = typeof cachedData.allergies === 'string'
          ? JSON.parse(cachedData.allergies)
          : cachedData.allergies;
        setAllergies(cachedAllergies);
        setFilteredAllergies(cachedAllergies);
        setLoading(false);
        return;
      }

      console.log('⚠ No cache found, generating with AI...');
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      const supabaseAnonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

      const petAge = ageInMonths ? parseInt(ageInMonths) : 24;
      const petWeight = weight ? parseFloat(weight) : undefined;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-allergy-recommendations`,
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
        throw new Error('Error generating allergy recommendations');
      }

      const { allergies: aiAllergies } = await response.json();
      console.log(`✓ Generated ${aiAllergies.length} allergy recommendations via AI`);

      const cacheKey = `${species}_${petBreed}_general`;
      await supabaseClient
        .from('allergies_ai_cache')
        .insert({
          species,
          breed: petBreed,
          age_in_months: petAge,
          weight: petWeight,
          allergies: aiAllergies,
          cache_key: cacheKey
        });

      console.log('✓ Saved to cache for future use');
      setAllergies(aiAllergies);
      setFilteredAllergies(aiAllergies);
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
        allergy.allergy_type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAllergies(filtered);
    } else {
      setFilteredAllergies(allergies);
    }
  };

  const handleSelectAllergy = (allergy: any) => {
    console.log('Navigating back with allergy:', allergy.name);
    router.replace({
      pathname: returnPath as any,
      params: {
        selectedAllergy: JSON.stringify(allergy),
        // Preserve all current values when returning
        ...(currentTreatment && { currentTreatment }),
        ...(currentVeterinarian && { currentVeterinarian }),
        ...(currentNotes && { currentNotes }),
        ...(currentDiagnosisDate && { currentDiagnosisDate })
      }
    });
  };

  const getTypeIcon = (type: string) => {
    const normalizedType = type?.toLowerCase() || 'other';
    const icons: Record<string, string> = {
      alimentaria: '🍽️',
      ambiental: '🌿',
      medicamento: '💊',
      picaduras: '🦟',
      contacto: '🤚',
      estacional: '🌸',
      pulgas: '🪲',
      food: '🍽️',
      environmental: '🌿',
      medication: '💊',
      insect: '🦟',
      contact: '🤚',
      seasonal: '🌸',
      flea: '🪲',
      other: '⚠️'
    };
    return icons[normalizedType] || '⚠️';
  };

  const getTypeName = (type: string) => {
    if (!type) return 'Sin tipo';
    const normalizedType = type.toLowerCase();
    const names: Record<string, string> = {
      alimentaria: 'Alimentaria',
      ambiental: 'Ambiental',
      medicamento: 'Medicamento',
      picaduras: 'Picaduras',
      contacto: 'Contacto',
      estacional: 'Estacional',
      pulgas: 'Pulgas',
      food: 'Alimentaria',
      environmental: 'Ambiental',
      medication: 'Medicamento',
      insect: 'Picaduras',
      contact: 'Contacto',
      seasonal: 'Estacional',
      flea: 'Pulgas',
      other: 'Otra'
    };
    return names[normalizedType] || type;
  };

  const getSeverityColor = (severity: string) => {
    const normalizedSeverity = severity?.toLowerCase() || 'moderate';
    const toneColors: Record<string, string> = {
      mild: colors.success,
      leve: colors.success,
      moderate: colors.warning,
      moderada: colors.warning,
      severe: colors.danger,
      severa: colors.danger
    };
    return toneColors[normalizedSeverity] || colors.warning;
  };

  const getSeverityLabel = (severity: string) => {
    const normalizedSeverity = severity?.toLowerCase() || 'moderate';
    const labels: Record<string, string> = {
      mild: 'Leve',
      leve: 'Leve',
      moderate: 'Moderada',
      moderada: 'Moderada',
      severe: 'Severa',
      severa: 'Severa'
    };
    return labels[normalizedSeverity] || 'Moderada';
  };

  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader title={`Elegí la alergia ${species === 'dog' ? '🐕' : '🐱'}`} />

      <HealthSearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Buscar alergia..." />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              {breed ? 'Generando recomendaciones con IA...' : 'Cargando alergias...'}
            </Text>
            {breed && (
              <Text style={styles.loadingSubtext}>
                Analizando predisposiciones para {species === 'dog' ? 'perros' : 'gatos'} {breed}
              </Text>
            )}
            <SkeletonList kind="cards" count={3} style={styles.skeleton} />
          </View>
        ) : filteredAllergies.length === 0 ? (
          <EmptyState
            icon={<AlertCircle size={32} color={colors.primary} />}
            title="No se encontraron alergias"
            description={searchQuery.trim() ? 'Probá con otros términos de búsqueda.' : 'No pudimos cargar la lista. Probá de nuevo en un momento.'}
            actionLabel={searchQuery.trim() ? 'Limpiar búsqueda' : 'Reintentar'}
            onAction={() => {
              if (searchQuery.trim()) {
                setSearchQuery('');
              } else {
                setLoading(true);
                fetchAllergies();
              }
            }}
          />
        ) : (
          <View style={styles.allergiesList}>
            {filteredAllergies.map((allergy, index) => {
              const isSelected = !!currentValue && allergy.name === currentValue;
              return (
              <Card key={allergy.id || `allergy-${index}`} padding={false} style={[styles.allergyCard, isSelected && selectorCardStyles.selected]}>
                <TouchableOpacity
                  style={[styles.allergyContent, selectorCardStyles.touchable]}
                  onPress={() => handleSelectAllergy(allergy)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={selectorCardStyles.row}>
                  <View style={selectorCardStyles.body}>
                  <View style={styles.allergyHeader}>
                    <Text style={styles.allergyName}>{allergy.name}</Text>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeIcon}>
                        {getTypeIcon(allergy.allergy_type)}
                      </Text>
                      <Text style={styles.typeText}>
                        {getTypeName(allergy.allergy_type)}
                      </Text>
                    </View>
                  </View>

                  {allergy.description && (
                    <Text style={styles.allergyDescription} numberOfLines={2}>
                      {allergy.description}
                    </Text>
                  )}

                  <View style={styles.allergyDetails}>
                    {allergy.severity && (
                      <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(allergy.severity) + '20' }]}>
                        <Text style={[styles.severityText, { color: getSeverityColor(allergy.severity) }]}>
                          {getSeverityLabel(allergy.severity)}
                        </Text>
                      </View>
                    )}

                    {allergy.frequency && (
                      <View style={styles.frequencyBadge}>
                        <Text style={styles.frequencyText}>⭐ {allergy.frequency}</Text>
                      </View>
                    )}
                  </View>

                  {(allergy.symptoms || allergy.common_symptoms) && (
                    <View style={styles.symptomsContainer}>
                      <Text style={styles.symptomsTitle}>Síntomas típicos:</Text>
                      <Text style={styles.symptomsText}>
                        {(allergy.symptoms || allergy.common_symptoms).slice(0, 3).join(', ')}
                        {(allergy.symptoms || allergy.common_symptoms).length > 3 && '...'}
                      </Text>
                    </View>
                  )}

                  {allergy.triggers && allergy.triggers.length > 0 && (
                    <View style={styles.triggersContainer}>
                      <Text style={styles.triggersTitle}>Desencadenantes:</Text>
                      <Text style={styles.triggersText}>
                        {allergy.triggers.slice(0, 2).join(', ')}
                        {allergy.triggers.length > 2 && '...'}
                      </Text>
                    </View>
                  )}

                  {allergy.prevention_tips && allergy.prevention_tips.length > 0 && (
                    <View style={styles.tipsContainer}>
                      <Text style={styles.tipsTitle}>💡 Consejos:</Text>
                      <Text style={styles.tipsText} numberOfLines={1}>
                        {allergy.prevention_tips[0]}
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
  allergiesList: {
    gap: spacing.md,
  },
  allergyCard: {
    marginBottom: spacing.sm,
  },
  allergyContent: {
    padding: spacing.lg,
  },
  allergyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  allergyName: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
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
    color: colors.primaryStrong,
  },
  allergyDescription: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  allergyDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  severityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  severityText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
  },
  frequencyBadge: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  frequencyText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.warning,
  },
  symptomsContainer: {
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  symptomsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  symptomsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.danger,
  },
  triggersContainer: {
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  triggersTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  triggersText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.warning,
  },
  tipsContainer: {
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  tipsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.success,
    marginBottom: spacing.xs,
  },
  tipsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.success,
  },
});
