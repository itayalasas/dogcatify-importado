import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  userName?: string;
}

export function DogCatiFyGameBanner({ userName }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push('/game' as any)}
      style={styles.card}
    >
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🎮 ZONA GAMER</Text>
        </View>

        <Text style={styles.title}>
          ¡Juega Patitas al Rescate! 🐾
        </Text>
        
        <Text style={styles.subtitle}>
          Supera niveles de puzle y desbloquea hasta un 20% OFF en alimentos y servicios para tu mascota.
        </Text>

        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>Jugar ahora</Text>
          <Ionicons name="arrow-forward-circle" size={20} color="#ea580c" />
        </View>
      </View>

      <View style={styles.iconContainer}>
        <Text style={styles.emoji}>🐶🧩</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fed7aa',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  content: {
    flex: 1,
    paddingRight: 10,
  },
  badge: {
    backgroundColor: '#ffedd5',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  badgeText: {
    color: '#c2410c',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#431407',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#7c2d12',
    lineHeight: 16,
    marginBottom: 8,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ea580c',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
});
