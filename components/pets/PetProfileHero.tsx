import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, Camera, Calendar, Scale, ShieldCheck, Cpu } from 'lucide-react-native';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/IconButton';
import { Skeleton } from '../ui/Skeleton';
import { colors, radius, shadows, spacing, typography, touchTarget } from '../../constants/theme';

interface PetProfileHeroProps {
  name: string;
  breed?: string | null;
  species?: string | null;
  gender?: string | null;
  photoUrl?: string | null;
  ageLabel: string;
  weightLabel: string;
  isNeutered?: boolean;
  hasChip?: boolean;
  onBack: () => void;
  onUpdatePhoto: () => void;
  onAppointments: () => void;
}

/** Encabezado de la ficha: foto grande, nombre, raza y datos clave como insignias. */
export const PetProfileHero: React.FC<PetProfileHeroProps> = ({
  name,
  breed,
  species,
  gender,
  photoUrl,
  ageLabel,
  weightLabel,
  isNeutered,
  hasChip,
  onBack,
  onUpdatePhoto,
  onAppointments,
}) => {
  const isDog = species === 'dog';
  const isMale = gender === 'male';

  return (
    <View style={styles.wrapper}>
      <View style={styles.cover}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.coverImage}
            onError={(e) => console.log('Error loading pet image:', photoUrl, e.nativeEvent.error)}
          />
        ) : (
          <View style={styles.coverFallback}>
            <Text style={styles.coverEmoji}>{isDog ? '🐶' : '🐱'}</Text>
          </View>
        )}

        <IconButton
          variant="surface"
          icon={<ArrowLeft size={22} color={colors.text} />}
          onPress={onBack}
          accessibilityLabel="Volver"
          style={styles.backButton}
        />

        <TouchableOpacity
          style={styles.photoButton}
          onPress={onUpdatePhoto}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Cambiar foto de ${name}`}
        >
          <Camera size={16} color={colors.text} />
          <Text style={styles.photoButtonText}>Cambiar foto</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
              {name}
            </Text>
            <Text style={styles.breed} numberOfLines={1}>
              {breed || (isDog ? 'Perro' : 'Gato')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.appointmentsButton}
            onPress={onAppointments}
            accessibilityRole="button"
            accessibilityLabel={`Ver citas de ${name}`}
          >
            <Calendar size={16} color={colors.primary} />
            <Text style={styles.appointmentsText}>Citas</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.badges}>
          <Badge label={isMale ? '♂ Macho' : '♀ Hembra'} tone={isMale ? 'info' : 'accent'} />
          <Badge label={ageLabel} tone="primary" icon={<Calendar size={12} color={colors.primary} />} />
          <Badge label={weightLabel} tone="primary" icon={<Scale size={12} color={colors.primary} />} />
          {isNeutered ? (
            <Badge
              label={isDog ? 'Castrado' : 'Esterilizado'}
              tone="success"
              icon={<ShieldCheck size={12} color={colors.success} />}
            />
          ) : null}
          {hasChip ? (
            <Badge label="Microchip" tone="success" icon={<Cpu size={12} color={colors.success} />} />
          ) : null}
        </View>
      </View>
    </View>
  );
};

/** Esqueleto de la ficha mientras carga. */
export const PetProfileHeroSkeleton: React.FC = () => (
  <View style={styles.wrapper} accessibilityLabel="Cargando información de la mascota">
    <Skeleton height={COVER_HEIGHT} borderRadius={0} />
    <View style={styles.infoCard}>
      <Skeleton width="55%" height={26} />
      <Skeleton width="35%" height={14} style={{ marginTop: spacing.sm }} />
      <View style={[styles.badges, { marginTop: spacing.lg }]}>
        <Skeleton width={72} height={24} borderRadius={radius.pill} />
        <Skeleton width={64} height={24} borderRadius={radius.pill} />
        <Skeleton width={64} height={24} borderRadius={radius.pill} />
      </View>
    </View>
    <View style={{ padding: spacing.lg, gap: spacing.md }}>
      <Skeleton height={44} borderRadius={radius.pill} />
      <Skeleton height={160} borderRadius={radius.lg} />
      <Skeleton height={120} borderRadius={radius.lg} />
    </View>
  </View>
);

const COVER_HEIGHT = 260;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
  },
  cover: {
    height: COVER_HEIGHT,
    backgroundColor: colors.primarySoft,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 80,
  },
  backButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
  },
  photoButton: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xxxl + spacing.sm,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  photoButtonText: {
    ...typography.captionStrong,
    color: colors.text,
  },
  infoCard: {
    marginTop: -spacing.xxl,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
  },
  name: {
    ...typography.display,
    color: colors.text,
  },
  breed: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  appointmentsButton: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  appointmentsText: {
    ...typography.label,
    color: colors.primary,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
