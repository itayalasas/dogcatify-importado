import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { PawPrint, Plus } from 'lucide-react-native';
import { AppText } from '../ui/AppText';
import { Skeleton } from '../ui/Skeleton';
import { SectionTitle } from './SectionTitle';
import { getPets } from '../../lib/supabase';
import { colors, radius, spacing } from '../../constants/theme';

interface HomePet {
  id: string;
  name: string;
  photo_url?: string | null;
}

interface Props {
  userId?: string | null;
  /** Cambia cuando el usuario tira para actualizar el inicio. */
  refreshKey?: number;
}

const AVATAR = 72;

/**
 * Carrusel "Mis mascotas" del inicio: foto + nombre de cada mascota propia y una tarjeta para agregar.
 * Usa la misma lectura de mascotas que la pestaña Mascotas (getPets), solo lectura.
 */
export function MyPetsCarousel({ userId, refreshKey = 0 }: Props) {
  const [pets, setPets] = useState<HomePet[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getPets(userId);
      if (mounted.current) setPets(((data as any[]) || []).map((p) => ({ id: p.id, name: p.name, photo_url: p.photo_url })));
    } catch {
      // Si falla, el carrusel muestra solo la tarjeta de agregar
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Al volver al inicio (por ejemplo, después de agregar una mascota) se vuelve a leer
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (refreshKey > 0) load();
  }, [refreshKey, load]);

  return (
    <View style={styles.section}>
      <SectionTitle
        title="Mis mascotas"
        actionLabel={pets.length > 0 ? 'Ver todas' : undefined}
        onAction={() => router.push('/(tabs)/pets' as any)}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {loading && pets.length === 0
          ? [0, 1, 2].map((i) => (
              <View key={i} style={styles.item}>
                <Skeleton width={AVATAR} height={AVATAR} borderRadius={AVATAR / 2} />
                <Skeleton width={56} height={12} style={styles.nameSkeleton} />
              </View>
            ))
          : pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={styles.item}
                activeOpacity={0.8}
                onPress={() => router.push(`/pets/${pet.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`Ver ficha de ${pet.name}`}
              >
                {pet.photo_url ? (
                  <Image source={{ uri: pet.photo_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <PawPrint size={28} color={colors.primary} />
                  </View>
                )}
                <AppText variant="label" numberOfLines={1} style={styles.name} maxFontSizeMultiplier={1.3}>
                  {pet.name}
                </AppText>
              </TouchableOpacity>
            ))}

        <TouchableOpacity
          style={styles.item}
          activeOpacity={0.8}
          onPress={() => router.push('/pets/add' as any)}
          accessibilityRole="button"
          accessibilityLabel="Agregar mascota"
        >
          <View style={[styles.avatar, styles.addCircle]}>
            <Plus size={28} color={colors.primary} />
          </View>
          <AppText variant="label" color="primary" numberOfLines={1} style={styles.name} maxFontSizeMultiplier={1.3}>
            Agregar
          </AppText>
        </TouchableOpacity>
      </ScrollView>
      {!loading && pets.length === 0 ? (
        <AppText variant="bodySmall" color="textSecondary" style={styles.hint}>
          Agregá a tu mascota para llevar sus vacunas, turnos y cuidados al día.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xxl,
  },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  item: {
    width: AVATAR + spacing.sm,
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.surfaceAlt,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  addCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  name: {
    marginTop: spacing.sm,
    maxWidth: AVATAR + spacing.sm,
  },
  nameSkeleton: {
    marginTop: spacing.sm,
  },
  hint: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
});
