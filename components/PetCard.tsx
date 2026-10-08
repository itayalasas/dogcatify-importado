import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, Scale, ShieldCheck, Trash2, UserPlus } from 'lucide-react-native';
import { Card } from './ui/Card';
import { colors, radius, shadows, spacing, typography } from '../constants/theme';
import { Pet } from '../types';

interface PetCardProps {
  pet: Pet;
  onPress: () => void;
  onDelete?: (petId: string) => void;
  onShare?: (petId: string) => void;
  isShared?: boolean;
}

export const PetCard: React.FC<PetCardProps> = ({ pet, onPress, onDelete, onShare, isShared }) => {
  const photoUri = pet.photoURL || pet.photo_url;

  const formatAge = () => {
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

  const formatWeight = () => {
    if (pet.weightDisplay) {
      return `${pet.weightDisplay.value} ${pet.weightDisplay.unit}`;
    }
    return `${pet.weight} kg`;
  };

  return (
    <Card style={styles.card} padding={false}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={`Ver ficha de ${pet.name}`}
      >
        <View style={styles.imageArea}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.petImage}
              onError={(e) => console.log('Error loading pet image:', photoUri, e.nativeEvent.error)}
            />
          ) : (
            <View style={styles.imageFallback}>
              <Text style={styles.imageFallbackText}>{pet.species === 'dog' ? 'Perro' : 'Gato'}</Text>
            </View>
          )}

          <View style={styles.imageScrim} />

          <View style={styles.topActions}>
            {onShare && (
              <TouchableOpacity
                style={styles.shareButton}
                accessibilityRole="button"
                accessibilityLabel={`Compartir a ${pet.name}`}
                onPress={(e) => {
                  e.stopPropagation();
                  onShare(pet.id);
                }}
              >
                <UserPlus size={15} color={colors.onPrimary} />
                <Text style={styles.shareButtonText}>Compartir</Text>
              </TouchableOpacity>
            )}

            {onDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar a ${pet.name}`}
                hitSlop={4}
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete(pet.id);
                }}
              >
                <Trash2 size={18} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>

          {isShared && (
            <View style={styles.sharedBadge}>
              <ShieldCheck size={13} color={colors.success} />
              <Text style={styles.sharedBadgeText}>Compartida</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.nameBlock}>
              <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
              <Text style={styles.petBreed} numberOfLines={1}>{pet.breed}</Text>
            </View>

            <View style={[
              styles.genderBadge,
              pet.gender === 'male' ? styles.genderBadgeMale : styles.genderBadgeFemale,
            ]}>
              <Text style={[
                styles.genderText,
                pet.gender === 'male' ? styles.genderTextMale : styles.genderTextFemale,
              ]}>
                {pet.gender === 'male' ? 'Macho' : 'Hembra'}
              </Text>
            </View>
          </View>

          <View style={styles.details}>
            <View style={styles.detailPill}>
              <Calendar size={16} color={colors.primary} />
              <Text style={styles.detailText}>{formatAge()}</Text>
            </View>
            <View style={styles.detailPill}>
              <Scale size={16} color={colors.primary} />
              <Text style={styles.detailText}>{formatWeight()}</Text>
            </View>
          </View>

          {(pet.isNeutered || pet.hasChip) && (
            <View style={styles.badges}>
              {pet.isNeutered && (
                <View style={styles.badge}>
                  <ShieldCheck size={13} color={colors.success} />
                  <Text style={styles.badgeText}>
                    {pet.species === 'dog' ? 'Castrado' : 'Esterilizado'}
                  </Text>
                </View>
              )}
              {pet.hasChip && (
                <View style={styles.badge}>
                  <ShieldCheck size={13} color={colors.success} />
                  <Text style={styles.badgeText}>Microchip</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Card>
  );
};

// Etiqueta de hembra: rosa suave propio de la tarjeta (el tema no tiene rosa). Contraste 4,6:1.
const femaleTag = { background: '#FDF2F8', border: '#FBCFE8', text: '#BE185D' };

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xxs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadows.md,
  },
  pressable: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  imageArea: {
    height: 245,
    backgroundColor: colors.surface,
  },
  petImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  imageFallbackText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  imageScrim: {
    display: 'none',
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
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...shadows.sm,
  },
  shareButtonText: {
    ...typography.captionStrong,
    fontSize: 13,
    color: colors.onPrimary,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  sharedBadge: {
    position: 'absolute',
    left: spacing.lg,
    top: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  sharedBadgeText: {
    ...typography.captionStrong,
    color: colors.success,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  nameBlock: {
    flex: 1,
  },
  petName: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  petBreed: {
    ...typography.body,
    color: colors.textSecondary,
  },
  genderBadge: {
    minHeight: 32,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  genderBadgeMale: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
  genderBadgeFemale: {
    backgroundColor: femaleTag.background,
    borderColor: femaleTag.border,
  },
  genderText: {
    ...typography.captionStrong,
  },
  genderTextMale: {
    color: colors.primaryPressed,
  },
  genderTextFemale: {
    color: femaleTag.text,
  },
  details: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  detailPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailText: {
    ...typography.label,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeText: {
    ...typography.captionStrong,
    color: colors.success,
  },
});
