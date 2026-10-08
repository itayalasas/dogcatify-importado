import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, Plus, Calendar, MapPin, DollarSign, CheckCircle2, XCircle } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { IconButton } from '../../components/ui/IconButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { SkeletonList } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { canAccessPartnerModule, getPartnerLockedActionLabel, getPartnerPlan } from '../../utils/partnerPlans';
import { colors, radius, spacing, typography } from '../../constants/theme';

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
        <ScreenHeader title="Gestión de adopciones" />
        <SkeletonList kind="cards" count={3} style={styles.skeleton} />
      </SafeAreaView>
    );
  }

  if (accessDenied) {
    const plan = getPartnerPlan(partnerProfile?.subscriptionPlanTier);
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Gestión de adopciones" />
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
            <Button title="Volver" onPress={() => router.back()} variant="outline" />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Gestión de adopciones"
        subtitle={partnerProfile?.businessName}
        right={
          <IconButton
            icon={<Plus size={22} color={colors.onPrimary} />}
            onPress={handleAddPet}
            accessibilityLabel="Agregar mascota"
            variant="filled"
          />
        }
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
          <EmptyState
            icon={<Heart size={32} color={colors.primary} />}
            title="No hay mascotas en adopción"
            description="Publicá tu primera mascota para comenzar el proceso de adopción 🐾"
            actionLabel="Agregar mascota"
            onAction={handleAddPet}
          />
        ) : (
          <View style={styles.petsList}>
            {adoptionPets.map((pet) => (
              <Card key={pet.id} style={styles.petCard}>
                <View style={styles.petHeader}>
                  <View style={styles.petHeaderInfo}>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petBreed}>{pet.breed || 'Raza no informada'}</Text>
                  </View>
                  <Badge
                    label={pet.is_available !== false ? 'Disponible' : 'No disponible'}
                    tone={pet.is_available !== false ? 'success' : 'neutral'}
                    icon={pet.is_available !== false
                      ? <CheckCircle2 size={14} color={colors.success} />
                      : <XCircle size={14} color={colors.textSecondary} />}
                  />
                </View>

                {pet.images?.[0] ? (
                  <Image source={{ uri: pet.images[0] }} style={styles.petImage} />
                ) : null}

                <View style={styles.petDetails}>
                  <View style={styles.detailItem}>
                    <Calendar size={16} color={colors.textTertiary} />
                    <Text style={styles.detailText}>{formatAge(pet)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <MapPin size={16} color={colors.textTertiary} />
                    <Text style={styles.detailText}>{pet.size || 'Tamaño no informado'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <DollarSign size={16} color={colors.textTertiary} />
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
    backgroundColor: colors.background,
    paddingTop: 50,
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
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  placeholder: {
    width: 38,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  skeleton: {
    padding: spacing.lg,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    ...typography.title,
    color: colors.text,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  petsList: {
    gap: spacing.md,
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
    paddingRight: spacing.sm,
  },
  petName: {
    ...typography.heading,
    color: colors.text,
  },
  petBreed: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    gap: spacing.xs,
  },
  statusText: {
    ...typography.captionStrong,
  },
  petImage: {
    width: '100%',
    height: 190,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  petDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  petDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: spacing.xl,
  },
  lockedBadge: {
    ...typography.captionStrong,
    color: colors.warning,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  lockedTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  lockedText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  lockedTextSecondary: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  lockedButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  lockedButtonText: {
    color: colors.white,
    ...typography.label,
  },
});
