import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, Plus, Calendar, MapPin, DollarSign, CheckCircle2, XCircle } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { canAccessPartnerModule, getPartnerLockedActionLabel, getPartnerPlan } from '../../utils/partnerPlans';

type AdoptionPet = {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number | null;
  age_unit?: string | null;
  size?: string | null;
  adoption_fee?: number | null;
  is_available?: boolean | null;
  images?: string[] | null;
  description?: string | null;
  created_at?: string | null;
};

export default function ManageAdoptions() {
  const params = useLocalSearchParams<{ partnerId?: string; businessId?: string }>();
  const partnerId = params.partnerId || params.businessId;
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [adoptionPets, setAdoptionPets] = useState<AdoptionPet[]>([]);

  useEffect(() => {
    if (!partnerId || !currentUser) return;

    const loadData = async () => {
      try {
        const { data: partnerData, error: partnerError } = await supabaseClient
          .from('partners')
          .select('id, business_name, business_type, subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at')
          .eq('id', partnerId)
          .single();

        if (partnerError) throw partnerError;

        const planTier = partnerData?.subscription_plan_tier || 'starter';
        const canManageAdoptions = canAccessPartnerModule(
          planTier,
          'adoptions',
          partnerData?.business_type,
          partnerData?.subscription_plan_status,
          partnerData?.subscription_plan_expires_at,
        );

        setPartnerProfile({
          id: partnerData.id,
          businessName: partnerData.business_name,
          businessType: partnerData.business_type,
          subscriptionPlanTier: planTier,
        });

        if (!canManageAdoptions) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        const { data: petsData, error: petsError } = await supabaseClient
          .from('adoption_pets')
          .select('id, name, species, breed, age, age_unit, size, adoption_fee, is_available, images, description, created_at')
          .eq('partner_id', partnerId)
          .order('created_at', { ascending: false });

        if (petsError) throw petsError;

        setAdoptionPets((petsData || []) as AdoptionPet[]);
      } catch (error) {
        console.error('Error loading adoption management:', error);
        Alert.alert('Error', 'No se pudo cargar la gestión de adopciones');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const subscription = supabaseClient
      .channel('adoption-pets-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'adoption_pets',
          filter: `partner_id=eq.${partnerId}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [partnerId, currentUser]);

  const handleAddPet = () => {
    if (!partnerId) return;
    router.push({
      pathname: '/partner/add-adoption-pet',
      params: { partnerId },
    });
  };

  const formatAge = (pet: AdoptionPet) => {
    if (pet.age === null || pet.age === undefined) return 'Edad no informada';
    const unit = pet.age_unit === 'months' ? 'meses' : 'años';
    return `${pet.age} ${unit}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando adopciones...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (accessDenied) {
    const plan = getPartnerPlan(partnerProfile?.subscriptionPlanTier);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Gestión de Adopciones</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.lockedContainer}>
          <Card style={styles.lockedCard}>
            <Text style={styles.lockedBadge}>{getPartnerLockedActionLabel('adoptions')}</Text>
            <Text style={styles.lockedTitle}>Módulo disponible en Pro</Text>
            <Text style={styles.lockedText}>
              {plan.name} no incluye la gestión de adopciones para refugios.
            </Text>
            <Text style={styles.lockedTextSecondary}>
              Este módulo permite publicar mascotas, revisar disponibilidad y habilitar el contacto con adoptantes.
            </Text>
            <TouchableOpacity
              style={styles.lockedButton}
              onPress={() => router.back()}
            >
              <Text style={styles.lockedButtonText}>Volver</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Gestión de Adopciones</Text>
          <Text style={styles.subtitle}>{partnerProfile?.businessName}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddPet}>
          <Plus size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{adoptionPets.length}</Text>
              <Text style={styles.summaryLabel}>Mascotas{'\n'}publicadas</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>
                {adoptionPets.filter(pet => pet.is_available !== false).length}
              </Text>
              <Text style={styles.summaryLabel}>Disponibles{'\n'}para adopción</Text>
            </View>
          </View>
        </Card>

        {adoptionPets.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Heart size={48} color="#EF4444" />
            <Text style={styles.emptyTitle}>No hay mascotas en adopción</Text>
            <Text style={styles.emptySubtitle}>
              Publica tu primera mascota para comenzar el proceso de adopción
            </Text>
            <Button title="Agregar Mascota" onPress={handleAddPet} />
          </Card>
        ) : (
          <View style={styles.petsList}>
            {adoptionPets.map((pet) => (
              <Card key={pet.id} style={styles.petCard}>
                <View style={styles.petHeader}>
                  <View style={styles.petHeaderInfo}>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petBreed}>{pet.breed || 'Raza no informada'}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: pet.is_available !== false ? '#D1FAE5' : '#FEE2E2' },
                    ]}
                  >
                    {pet.is_available !== false ? (
                      <CheckCircle2 size={14} color="#065F46" />
                    ) : (
                      <XCircle size={14} color="#991B1B" />
                    )}
                    <Text
                      style={[
                        styles.statusText,
                        { color: pet.is_available !== false ? '#065F46' : '#991B1B' },
                      ]}
                    >
                      {pet.is_available !== false ? 'Disponible' : 'No disponible'}
                    </Text>
                  </View>
                </View>

                {pet.images?.[0] ? (
                  <Image source={{ uri: pet.images[0] }} style={styles.petImage} />
                ) : null}

                <View style={styles.petDetails}>
                  <View style={styles.detailItem}>
                    <Calendar size={16} color="#6B7280" />
                    <Text style={styles.detailText}>{formatAge(pet)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <MapPin size={16} color="#6B7280" />
                    <Text style={styles.detailText}>{pet.size || 'Tamaño no informado'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <DollarSign size={16} color="#6B7280" />
                    <Text style={styles.detailText}>
                      {pet.adoption_fee ? pet.adoption_fee.toLocaleString('es-UY') : '0'} UYU
                    </Text>
                  </View>
                </View>

                {pet.description ? (
                  <Text style={styles.petDescription} numberOfLines={3}>
                    {pet.description}
                  </Text>
                ) : null}
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
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  placeholder: {
    width: 38,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  petsList: {
    gap: 12,
  },
  petCard: {
    overflow: 'hidden',
  },
  petHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  petHeaderInfo: {
    flex: 1,
    paddingRight: 8,
  },
  petName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  petBreed: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  petImage: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    marginBottom: 12,
  },
  petDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  petDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 19,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  lockedBadge: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  lockedTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  lockedText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 8,
  },
  lockedTextSecondary: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  lockedButton: {
    backgroundColor: '#2D6A6F',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  lockedButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
});
