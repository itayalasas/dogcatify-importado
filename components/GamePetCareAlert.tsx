import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { X } from 'lucide-react-native';
import { supabaseClient } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/theme';

const LOGO = require('../assets/images/patitas-game-logo.png');

// Mismas reglas que el juego (src/data/roomsData.ts en Patitas al Rescate)
const LOW_HAPPINESS = 50;
const HAPPINESS_MIN = 30;

// Cerrado en esta sesión de la app (vuelve a salir al reabrir DogCatiFy)
let dismissedThisSession = false;

interface LowPet {
  name: string;
  happiness: number;
}

/** Lee el refugio del juego y devuelve la mascota con menos mimos (si está por debajo del umbral). */
async function fetchLowestPet(userId: string): Promise<{ worst: LowPet; count: number } | null> {
  const { data, error } = await supabaseClient
    .from('game_player_progress')
    .select('shelter_extras')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.shelter_extras?.petCare) return null;

  const extras = data.shelter_extras;
  const decay = Number(extras.decayPerHour) > 0 ? Number(extras.decayPerHour) : 2;
  const low: LowPet[] = Object.values<any>(extras.petCare)
    .map(care => {
      const hours = (Date.now() - Number(care.updatedAt || Date.now())) / 3600000;
      const happiness = Math.max(HAPPINESS_MIN, Math.round(Number(care.happiness ?? 100) - hours * decay));
      return { name: String(care.name || 'Tu mascota'), happiness };
    })
    .filter(p => p.happiness < LOW_HAPPINESS)
    .sort((a, b) => a.happiness - b.happiness);

  return low.length ? { worst: low[0], count: low.length } : null;
}

/**
 * Aviso tipo "notificación" en el home: una mascota del juego Patitas al Rescate necesita mimos.
 * Al tocarlo abre el juego directo en el refugio.
 */
export function GamePetCareAlert() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<{ worst: LowPet; count: number } | null>(null);
  const slide = useRef(new Animated.Value(-160)).current;
  const wiggle = useRef(new Animated.Value(0)).current;

  const refresh = useCallback(() => {
    if (!currentUser?.id || dismissedThisSession) return;
    fetchLowestPet(currentUser.id)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [currentUser?.id]);

  // Al volver al home (p. ej. después de jugar) se vuelve a consultar
  useFocusEffect(refresh);

  useEffect(() => {
    if (!info) return;
    slide.setValue(-160);
    Animated.spring(slide, { toValue: 0, friction: 7, tension: 60, delay: 1200, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2500),
        Animated.timing(wiggle, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 80, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 80, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [info]);

  if (!info) return null;

  const hide = (then?: () => void) => {
    dismissedThisSession = true;
    Animated.timing(slide, { toValue: -160, duration: 220, useNativeDriver: true }).start(() => {
      setInfo(null);
      then?.();
    });
  };

  const openShelter = () => hide(() => router.push({ pathname: '/game', params: { tab: 'shelter' } } as any));
  const rotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] });
  const { worst, count } = info;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { top: insets.top + 8, transform: [{ translateY: slide }] },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={openShelter}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${worst.name} necesita mimos, felicidad ${worst.happiness}%. Abrir el refugio del juego`}
      >
        <View style={styles.stripe} />
        <Animated.View style={[styles.avatarWrap, { transform: [{ rotate }] }]}>
          <Image source={LOGO} style={styles.avatar} />
          <Text style={styles.avatarEmoji}>🥺</Text>
        </Animated.View>

        <View style={styles.textWrap}>
          <Text style={styles.kicker}>PATITAS AL RESCATE · ¡NECESITA MIMOS!</Text>
          <Text style={styles.title} numberOfLines={1}>
            {worst.name} te extraña{count > 1 ? ` (+${count - 1})` : ''}
          </Text>
          <View style={styles.barRow}>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${worst.happiness}%` }]} />
            </View>
            <Text style={styles.percent}>{worst.happiness}%</Text>
          </View>
        </View>

        <View style={styles.cta}>
          <Text style={styles.ctaText}>Dar{'\n'}mimos</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => hide()}
        style={styles.close}
        hitSlop={14}
        accessibilityRole="button"
        accessibilityLabel="Cerrar aviso"
      >
        <X size={12} color={colors.textSecondary} strokeWidth={3} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 10000,
    elevation: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderWidth: 2,
    borderColor: '#FECDD3',
    overflow: 'hidden',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 12,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: '#F43F5E',
  },
  avatarWrap: {
    width: 46,
    height: 46,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#FDA4AF',
  },
  avatarEmoji: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    fontSize: 16,
  },
  textWrap: {
    flex: 1,
  },
  kicker: {
    fontSize: 9,
    fontWeight: '900',
    color: '#F43F5E',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    marginTop: 1,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  barBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFE4E6',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#F43F5E',
  },
  percent: {
    fontSize: 10,
    fontWeight: '900',
    color: '#E11D48',
  },
  cta: {
    backgroundColor: '#F43F5E',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  close: {
    position: 'absolute',
    top: -6,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 14,
  },
});
