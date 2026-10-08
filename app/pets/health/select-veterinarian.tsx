import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Building, Star, Phone, MapPin, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { EmptyState, SkeletonList } from '../../../components/ui';
import { HealthHeader, HealthSearchBar, SelectionCheck, selectorCardStyles } from '../../../components/health';
import { supabaseClient } from '../../../lib/supabase';
import { colors, spacing, radius, fontSize } from '../../../constants/theme';

export default function SelectVeterinarian() {
  const {
    petId,
    returnPath,
    currentValue,
    currentCondition,
    currentTreatment,
    currentNotes,
    currentVaccine,
    currentSelectedVaccine,
    currentApplicationDate,
    currentSelectedDewormer,
    currentSelectedCondition,
    currentSelectedTreatment,
    currentType,
    currentSymptoms,
    currentSeverity,
    currentDiagnosisDate,
    selectedAllergyData
  } = useLocalSearchParams<{
    petId: string;
    returnPath: string;
    currentValue?: string;
    currentCondition?: string;
    currentTreatment?: string;
    currentNotes?: string;
    currentVaccine?: string;
    currentSelectedVaccine?: string;
    currentApplicationDate?: string;
    currentSelectedDewormer?: string;
    currentSelectedCondition?: string;
    currentSelectedTreatment?: string;
    currentType?: string;
    currentSymptoms?: string;
    currentSeverity?: string;
    currentDiagnosisDate?: string;
    selectedAllergyData?: string;
  }>();

  const [veterinarians, setVeterinarians] = useState<any[]>([]);
  const [filteredVeterinarians, setFilteredVeterinarians] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVeterinarians();
  }, []);

  useEffect(() => {
    filterVeterinarians();
  }, [searchQuery, veterinarians]);

  const fetchVeterinarians = async () => {
    try {
      console.log('Fetching veterinary partners...');
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('business_type', 'veterinary')
        .eq('is_verified', true)
        .eq('is_active', true)
        .order('business_name', { ascending: true });

      if (error) throw error;
      
      console.log('Veterinary partners found:', data?.length || 0);
      setVeterinarians(data || []);
      setFilteredVeterinarians(data || []);
    } catch (error) {
      console.error('Error fetching veterinarians:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterVeterinarians = () => {
    if (searchQuery.trim()) {
      const filtered = veterinarians.filter(vet =>
        vet.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vet.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vet.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredVeterinarians(filtered);
    } else {
      setFilteredVeterinarians(veterinarians);
    }
  };

  const handleSelectVeterinarian = (veterinarian: any) => {
    console.log('Navigating back with veterinarian:', veterinarian.business_name);
    router.replace({
      pathname: returnPath as any,
      params: {
        selectedVeterinarian: JSON.stringify({ name: veterinarian.business_name }),
        ...(currentCondition && { currentCondition }),
        ...(currentTreatment && { currentTreatment }),
        ...(currentVaccine && { selectedVaccine: currentSelectedVaccine || JSON.stringify({ name: currentVaccine }) }),
        ...(currentNotes && { currentNotes }),
        ...(currentApplicationDate && { currentApplicationDate }),
        ...(currentSelectedDewormer && { currentSelectedDewormer }),
        ...(currentSelectedCondition && { currentSelectedCondition }),
        ...(currentSelectedTreatment && { currentSelectedTreatment }),
        // Preserve allergy-specific fields
        ...(currentType && { currentType }),
        ...(currentSymptoms && { currentSymptoms }),
        ...(currentSeverity && { currentSeverity }),
        ...(currentDiagnosisDate && { currentDiagnosisDate }),
        // Preserve complete allergy object for AI info card
        ...(selectedAllergyData && { selectedAllergyData })
      }
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={14}
        color={i < rating ? colors.warning : colors.borderStrong}
        fill={i < rating ? colors.warning : "transparent"}
      />
    ));
  };

  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader title={'Elegí el veterinario'} />

      <HealthSearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Buscar veterinario o clínica..." />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando veterinarios...</Text>
            <SkeletonList kind="cards" count={3} style={styles.skeleton} />
          </View>
        ) : filteredVeterinarians.length === 0 ? (
          <EmptyState
            icon={<Building size={32} color={colors.primary} />}
            title="No se encontraron veterinarios"
            description={searchQuery.trim() ? 'Probá con otros términos de búsqueda.' : 'Todavía no hay veterinarios registrados.'}
            actionLabel={searchQuery.trim() ? 'Limpiar búsqueda' : undefined}
            onAction={() => setSearchQuery('')}
          />
        ) : (
          <View style={styles.veterinariansList}>
            {filteredVeterinarians.map((veterinarian) => {
              const isSelected = !!currentValue && veterinarian.business_name === currentValue;
              return (
              <Card key={veterinarian.id} padding={false} style={[styles.veterinarianCard, isSelected && selectorCardStyles.selected]}>
                <TouchableOpacity
                  style={[styles.veterinarianContent, selectorCardStyles.touchable]}
                  onPress={() => handleSelectVeterinarian(veterinarian)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={selectorCardStyles.row}>
                  <View style={selectorCardStyles.body}>
                  <View style={styles.veterinarianHeader}>
                    <Text style={styles.veterinarianName}>{veterinarian.business_name}</Text>
                    {veterinarian.is_verified && (
                      <View style={styles.verifiedBadge}>
                        <CheckCircle size={12} color={colors.success} />
                        <Text style={styles.verifiedText}>Verificado</Text>
                      </View>
                    )}
                  </View>

                  {veterinarian.address && (
                    <View style={styles.addressContainer}>
                      <MapPin size={14} color={colors.textSecondary} />
                      <Text style={styles.addressText}>{veterinarian.address}</Text>
                    </View>
                  )}

                  {veterinarian.phone && (
                    <View style={styles.phoneContainer}>
                      <Phone size={14} color={colors.textSecondary} />
                      <Text style={styles.phoneText}>{veterinarian.phone}</Text>
                    </View>
                  )}

                  {veterinarian.rating && veterinarian.rating > 0 && (
                    <View style={styles.ratingContainer}>
                      <View style={styles.starsContainer}>
                        {renderStars(veterinarian.rating)}
                      </View>
                      <Text style={styles.ratingText}>{veterinarian.rating.toFixed(1)}</Text>
                      <Text style={styles.reviewsText}>({veterinarian.reviews_count || 0} reseñas)</Text>
                    </View>
                  )}

                  {veterinarian.description && (
                    <View style={styles.descriptionContainer}>
                      <Text style={styles.descriptionTitle}>Descripción:</Text>
                      <Text style={styles.descriptionText} numberOfLines={2}>
                        {veterinarian.description}
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.businessTypeContainer}>
                    <View style={styles.businessTypeBadge}>
                      <Text style={styles.businessTypeIcon}>🏥</Text>
                      <Text style={styles.businessTypeText}>Veterinaria</Text>
                    </View>
                  </View>
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
  veterinariansList: {
    gap: spacing.md,
  },
  veterinarianCard: {
    marginBottom: spacing.sm,
  },
  veterinarianContent: {
    padding: spacing.lg,
  },
  veterinarianHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  veterinarianName: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  emergencyBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  verifiedText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.success,
    marginLeft: spacing.xs,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  phoneText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginLeft: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: spacing.sm,
  },
  ratingText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginRight: spacing.xs,
  },
  reviewsText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  descriptionContainer: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  descriptionTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  businessTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: spacing.sm,
  },
  businessTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  businessTypeIcon: {
    fontSize: fontSize.xs,
    marginRight: spacing.xs,
  },
  businessTypeText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.primaryStrong,
  },
});
