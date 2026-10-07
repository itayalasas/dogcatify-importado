import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Sparkles, ShieldAlert, HeartPulse, ChevronRight, PawPrint } from 'lucide-react-native';
import { ScreenHeader, EmptyState, SkeletonListItem } from '../../../components/ui';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '../../../lib/supabase';
import { formatPetAgeLabel } from '../../../utils/petCare';

import { colors, radius, spacing, typography } from '../../../constants/theme';
export default function PetCareIndex() {
  const { currentUser } = useAuth();
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) {
      setLoading(false);
      setPets([]);
      return;
    }

    loadPets();
  }, [currentUser?.id]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPets();
    } finally {
      setRefreshing(false);
    }
  };

  const loadPets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('owner_id', currentUser!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPets(data || []);
    } catch (error) {
      console.error('Error loading pets for care hub:', error);
      setPets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPet = (petId: string) => {
    router.push({
      pathname: '/pets/care/[id]',
      params: { id: petId },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Cuidado inteligente"
        subtitle="Recomendaciones y emergencia, todo en un solo lugar"
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Card style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Sparkles size={26} color={colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Centro de cuidado para tus mascotas</Text>
              <Text style={styles.heroText}>
                Abrí una mascota para ver recomendaciones personalizadas de vacunas, peso, conducta,
                alergias y un modo de emergencia con acceso rápido a su historial.
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <ShieldAlert size={20} color={colors.danger} />
            <Text style={styles.featureTitle}>Modo emergencia</Text>
          </View>
          <Text style={styles.featureText}>
            Tené a mano la historia clínica, el QR para veterinarios y los datos críticos de salud
            de cada mascota.
          </Text>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <HeartPulse size={20} color={colors.success} />
            <Text style={styles.featureTitle}>Recomendaciones personalizadas</Text>
          </View>
          <Text style={styles.featureText}>
            El sistema usa el perfil real de cada mascota para sugerir cuidados, prevención y
            próximos pasos.
          </Text>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tus mascotas</Text>
          <Text style={styles.sectionCount}>{pets.length} registradas</Text>
        </View>

        {loading && !refreshing ? (
          <View accessibilityLabel="Cargando mascotas">
            <SkeletonListItem style={styles.skeletonItem} />
            <SkeletonListItem style={styles.skeletonItem} />
            <SkeletonListItem style={styles.skeletonItem} />
          </View>
        ) : pets.length === 0 ? (
          <Card style={styles.emptyCard} padding={false}>
            <EmptyState
              icon={<PawPrint size={32} color={colors.primary} />}
              title="Agregá tu primera mascota"
              description="Cuando la agregues vas a poder ver recomendaciones personalizadas, alertas y el centro de emergencia."
              actionLabel="Registrar mi primera mascota"
              onAction={() => router.push('/pets/add')}
            />
          </Card>
        ) : (
          pets.map((pet) => (
            <TouchableOpacity
              key={pet.id}
              activeOpacity={0.88}
              onPress={() => handleOpenPet(pet.id)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir el centro de cuidado de ${pet.name}`}
            >
              <Card style={styles.petCard}>
                <View style={styles.petRow}>
                  {pet.photo_url ? (
                    <Image source={{ uri: pet.photo_url }} style={styles.petImage} />
                  ) : (
                    <View style={[styles.petImage, styles.petImageFallback]}>
                      <Text style={styles.petImageEmoji}>{pet.species === 'dog' ? '🐶' : '🐱'}</Text>
                    </View>
                  )}
                  <View style={styles.petInfo}>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petMeta}>
                      {pet.species === 'dog' ? '🐕 Perro' : '🐱 Gato'} · {pet.breed || 'Raza no disponible'}
                    </Text>
                    <Text style={styles.petMeta}>{formatPetAgeLabel(pet)}</Text>
                    <Text style={styles.petHint}>Tocá para abrir el centro de cuidado</Text>
                  </View>
                  <ChevronRight size={18} color={colors.icon} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skeletonItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  petImageFallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petImageEmoji: {
    fontSize: 28,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  heroCard: {
    marginBottom: spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: 6,
  },
  heroText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  featureCard: {
    marginBottom: spacing.md,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featureTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 19,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: spacing.xl,
  },
  petCard: {
    marginBottom: spacing.md,
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  petImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petMeta: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  petHint: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
    marginTop: spacing.xs,
  },
});
