import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, Scale, ShieldCheck, Trash2, UserPlus } from 'lucide-react-native';
import { Card } from './ui/Card';
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
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.pressable}>
        <View style={styles.imageArea}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.petImage}
              onError={(e) => undefined}
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
                onPress={(e) => {
                  e.stopPropagation();
                  onShare(pet.id);
                }}
              >
                <UserPlus size={15} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>Compartir</Text>
              </TouchableOpacity>
            )}

            {onDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete(pet.id);
                }}
              >
                <Trash2 size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {isShared && (
            <View style={styles.sharedBadge}>
              <ShieldCheck size={13} color="#0F766E" />
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
              <Calendar size={16} color="#2D6A6F" />
              <Text style={styles.detailText}>{formatAge()}</Text>
            </View>
            <View style={styles.detailPill}>
              <Scale size={16} color="#2D6A6F" />
              <Text style={styles.detailText}>{formatWeight()}</Text>
            </View>
          </View>

          {(pet.isNeutered || pet.hasChip) && (
            <View style={styles.badges}>
              {pet.isNeutered && (
                <View style={styles.badge}>
                  <ShieldCheck size={13} color="#0F766E" />
                  <Text style={styles.badgeText}>
                    {pet.species === 'dog' ? 'Castrado' : 'Esterilizado'}
                  </Text>
                </View>
              )}
              {pet.hasChip && (
                <View style={styles.badge}>
                  <ShieldCheck size={13} color="#0F766E" />
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

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    marginHorizontal: 2,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  pressable: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  imageArea: {
    height: 245,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#EEF7F6',
  },
  imageFallbackText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
  },
  imageScrim: {
    display: 'none',
  },
  topActions: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareButton: {
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: 'rgba(37, 99, 235, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  shareButtonText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  sharedBadge: {
    position: 'absolute',
    left: 16,
    top: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(236, 253, 245, 0.96)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  sharedBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#0F766E',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: '#FFFFFF',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  nameBlock: {
    flex: 1,
  },
  petName: {
    fontSize: 23,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 3,
  },
  petBreed: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  genderBadge: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  genderBadgeMale: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  genderBadgeFemale: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  genderText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  genderTextMale: {
    color: '#2563EB',
  },
  genderTextFemale: {
    color: '#DB2777',
  },
  details: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  detailPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 7,
    fontFamily: 'Inter-SemiBold',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#0F766E',
  },
});
