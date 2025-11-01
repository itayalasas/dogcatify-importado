import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, Building, Star, Phone, MapPin, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { supabaseClient } from '../../../lib/supabase';

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
    currentSelectedTreatment
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
      pathname: returnPath,
      params: {
        selectedVeterinarian: JSON.stringify({ name: veterinarian.business_name }),
        ...(currentCondition && { currentCondition }),
        ...(currentTreatment && { currentTreatment }),
        ...(currentVaccine && { selectedVaccine: currentSelectedVaccine || JSON.stringify({ name: currentVaccine }) }),
        ...(currentNotes && { currentNotes }),
        ...(currentApplicationDate && { currentApplicationDate }),
        ...(currentSelectedDewormer && { currentSelectedDewormer }),
        ...(currentSelectedCondition && { currentSelectedCondition }),
        ...(currentSelectedTreatment && { currentSelectedTreatment })
      }
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={14}
        color={i < rating ? "#F59E0B" : "#E5E7EB"}
        fill={i < rating ? "#F59E0B" : "transparent"}
      />
    ));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Seleccionar Veterinario</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar veterinario o clínica..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando veterinarios...</Text>
          </View>
        ) : filteredVeterinarians.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Building size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No se encontraron veterinarios</Text>
            <Text style={styles.emptySubtitle}>
              Intenta con otros términos de búsqueda
            </Text>
          </View>
        ) : (
          <View style={styles.veterinariansList}>
            {filteredVeterinarians.map((veterinarian) => (
              <Card key={veterinarian.id} style={styles.veterinarianCard}>
                <TouchableOpacity
                  style={styles.veterinarianContent}
                  onPress={() => handleSelectVeterinarian(veterinarian)}
                >
                  <View style={styles.veterinarianHeader}>
                    <Text style={styles.veterinarianName}>{veterinarian.business_name}</Text>
                    {veterinarian.is_verified && (
                      <View style={styles.verifiedBadge}>
                        <CheckCircle size={12} color="#10B981" />
                        <Text style={styles.verifiedText}>Verificado</Text>
                      </View>
                    )}
                  </View>

                  {veterinarian.address && (
                    <View style={styles.addressContainer}>
                      <MapPin size={14} color="#6B7280" />
                      <Text style={styles.addressText}>{veterinarian.address}</Text>
                    </View>
                  )}

                  {veterinarian.phone && (
                    <View style={styles.phoneContainer}>
                      <Phone size={14} color="#6B7280" />
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
  veterinariansList: {
    gap: 12,
  },
  veterinarianCard: {
    marginBottom: 8,
  },
  veterinarianContent: {
    padding: 16,
  },
  veterinarianHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  veterinarianName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  emergencyBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#065F46',
    marginLeft: 4,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  phoneText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginRight: 4,
  },
  reviewsText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  descriptionContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  descriptionTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  businessTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  businessTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  businessTypeIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  businessTypeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
});