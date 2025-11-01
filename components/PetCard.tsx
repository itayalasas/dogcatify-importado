import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, Scale, Trash2, UserPlus } from 'lucide-react-native';
import { Card } from './ui/Card';
import { Pet } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface PetCardProps {
  pet: Pet;
  onPress: () => void;
  onDelete?: (petId: string) => void;
  onShare?: (petId: string) => void;
  isShared?: boolean;
}

export const PetCard: React.FC<PetCardProps> = ({ pet, onPress, onDelete, onShare, isShared }) => {
  const { t } = useLanguage();

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
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Image 
          source={{ uri: pet.photoURL || pet.photo_url }} 
          style={styles.petImage} 
          onError={(e) => console.log('Error loading pet image:', pet.photoURL || pet.photo_url, e.nativeEvent.error)}
        />
        {onDelete && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation();
              onDelete(pet.id);
            }}
          >
            <Trash2 size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        {onShare && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={(e) => {
              e.stopPropagation();
              onShare(pet.id);
            }}
          >
            <UserPlus size={14} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Compartir</Text>
          </TouchableOpacity>
        )}
        {isShared && (
          <View style={styles.sharedBadge}>
            <Text style={styles.sharedBadgeText}>Compartida</Text>
          </View>
        )}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.petName}>{pet.name}</Text>
            <Text style={styles.genderIcon}>
              {pet.gender === 'male' ? '♂️' : '♀️'}
            </Text>
          </View>
          <Text style={styles.petBreed}>{pet.breed}</Text>
          
          <View style={styles.details}>
            <View style={styles.detailItem}>
              <Calendar size={16} color="#6B7280" />
              <Text style={styles.detailText}>{formatAge()}</Text>
            </View>
            <View style={styles.detailItem}>
              <Scale size={16} color="#6B7280" />
              <Text style={styles.detailText}>{formatWeight()}</Text>
            </View>
          </View>

          {(pet.isNeutered || pet.hasChip) && (
            <View style={styles.badges}>
              {pet.isNeutered && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {pet.species === 'dog' ? 'Castrado' : 'Esterilizado'}
                  </Text>
                </View>
              )}
              {pet.hasChip && (
                <View style={styles.badge}>
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
    marginBottom: 10,
    marginHorizontal: 2,
  },
  petImage: {
    width: '100%', 
    height: 180,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    resizeMode: 'cover',
  },
  content: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  petName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
  },
  genderIcon: {
    fontSize: 16,
  },
  petBreed: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 10,
    fontFamily: 'Inter-Regular',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 3,
    fontFamily: 'Inter-Regular',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  shareButton: {
    position: 'absolute',
    top: 8,
    right: 48,
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  shareButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  sharedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  sharedBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
});