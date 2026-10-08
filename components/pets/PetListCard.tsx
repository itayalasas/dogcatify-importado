import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, Scale, ShieldCheck, Trash2, UserPlus, Cpu, Users } from 'lucide-react-native';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { colors, radius, shadows, spacing, typography, touchTarget, hitSlop } from '../../constants/theme';
import { Pet } from '../../types';

interface PetListCardProps {
  pet: Pet;
  onPress: () => void;
  onDelete?: (petId: string) => void;
  onShare?: (petId: string) => void;
  isShared?: boolean;
}

export const formatPetAge = (pet: Pick<Pet, 'age' | 'ageDisplay'>) => {
  if (pet.ageDisplay) {
    const { value, unit } = pet.ageDisplay;
    switch (unit) {
      case 'days':
        return `${value} ${value === 1 ? 'día' : 'días'}`;
      case 'months':
        return `${value} ${value === 1 ? 'mes' : 'meses'}`;
      case 'years':
      default:
        return `${value} ${value === 1 ? 'año' : 'años'}`;
    }
  }
  return `${pet.age} ${pet.age === 1 ? 'año' : 'años'}`;
};

const formatWeight = (pet: Pet) => {
  if (pet.weightDisplay) return `${pet.weightDisplay.value} ${pet.weightDisplay.unit}`;
  return `${pet.weight} kg`;
};

/** Tarjeta de mascota para "Mis mascotas": foto grande, nombre, raza, edad y estado. */
export const PetListCard: React.FC<PetListCardProps> = ({ pet, onPress, onDelete, onShare, isShared }) => {
  const photoUri = pet.photoURL || pet.photo_url;
  const isMale = pet.gender === 'male';

  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={`Ver ficha de ${pet.name}`}
      >
        <View style={styles.imageArea}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.petImage} />
          ) : (
            <View style={styles.imageFallback}>
              <Text style={styles.fallbackEmoji}>{pet.species === 'dog' ? '🐶' : '🐱'}</Text>
            </View>
          )}

          {isShared ? (
            <Badge
              label="Compartida"
              tone="primary"
              icon={<Users size={12} color={colors.primary} />}
              style={styles.sharedBadge}
            />
          ) : null}
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.nameBlock}>
              <Text style={styles.petName} numberOfLines={1}>
                {pet.name}
              </Text>
              <Text style={styles.petBreed} numberOfLines={1}>
                {pet.breed || (pet.species === 'dog' ? 'Perro' : 'Gato')}
              </Text>
            </View>
            <Badge label={isMale ? 'Macho' : 'Hembra'} tone={isMale ? 'info' : 'accent'} />
          </View>

          <View style={styles.details}>
            <View style={styles.detailPill}>
              <Calendar size={14} color={colors.primary} />
              <Text style={styles.detailText}>{formatPetAge(pet)}</Text>
            </View>
            <View style={styles.detailPill}>
              <Scale size={14} color={colors.primary} />
              <Text style={styles.detailText}>{formatWeight(pet)}</Text>
            </View>
          </View>

          {pet.isNeutered || pet.hasChip ? (
            <View style={styles.badges}>
              {pet.isNeutered ? (
                <Badge
                  size="small"
                  tone="success"
                  label={pet.species === 'dog' ? 'Castrado' : 'Esterilizado'}
                  icon={<ShieldCheck size={12} color={colors.success} />}
                />
              ) : null}
              {pet.hasChip ? (
                <Badge
                  size="small"
                  tone="success"
                  label="Microchip"
                  icon={<Cpu size={12} color={colors.success} />}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      {onShare || onDelete ? (
        <View style={styles.topActions}>
          {onShare ? (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => onShare(pet.id)}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={`Compartir a ${pet.name}`}
            >
              <UserPlus size={16} color={colors.primary} />
              <Text style={styles.shareButtonText}>Compartir</Text>
            </TouchableOpacity>
          ) : null}
          {onDelete ? (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete(pet.id)}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar a ${pet.name}`}
            >
              <Trash2 size={18} color={colors.danger} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

/** Esqueleto con la forma de PetListCard. */
export const PetListCardSkeleton: React.FC = () => (
  <View style={[styles.card, styles.skeletonCard]}>
    <Skeleton height={220} borderRadius={0} />
    <View style={styles.content}>
      <Skeleton width="50%" height={20} />
      <Skeleton width="35%" height={14} style={{ marginTop: spacing.sm }} />
      <View style={[styles.details, { marginTop: spacing.md }]}>
        <Skeleton width={80} height={28} borderRadius={radius.pill} />
        <Skeleton width={80} height={28} borderRadius={radius.pill} />
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.md,
  },
  skeletonCard: {
    overflow: 'hidden',
  },
  pressable: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  imageArea: {
    height: 220,
    backgroundColor: colors.primarySoft,
  },
  petImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    fontSize: 64,
  },
  sharedBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.surface,
  },
  topActions: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shareButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  shareButtonText: {
    ...typography.captionStrong,
    color: colors.primary,
  },
  deleteButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  content: {
    padding: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  nameBlock: {
    flex: 1,
  },
  petName: {
    ...typography.title,
    color: colors.text,
  },
  petBreed: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  details: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  detailText: {
    ...typography.label,
    color: colors.text,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
