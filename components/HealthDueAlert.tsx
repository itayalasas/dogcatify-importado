import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Pill, Stethoscope, Syringe, X } from 'lucide-react-native';
import { supabaseClient } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/theme';

// Se avisa de lo que vence en los próximos 14 días (y de lo ya vencido).
const WINDOW_DAYS = 14;

// Cerrado en esta sesión de la app (vuelve a salir al reabrir DogCatiFy)
let dismissedThisSession = false;

interface DueItem {
  petId: string;
  petName: string;
  title: string;
  type: string;
  daysLeft: number;
}

const TYPE_LABEL: Record<string, string> = {
  vaccine: 'VACUNA',
  deworming: 'DESPARASITACIÓN',
  checkup: 'CONTROL',
  medication: 'MEDICACIÓN',
};

/** Mismo criterio de colores que los próximos turnos. */
const getTone = (daysLeft: number) => {
  if (daysLeft <= 1) return { fg: colors.danger, soft: colors.dangerSoft, border: '#FECACA' };
  if (daysLeft <= 3) return { fg: colors.warning, soft: colors.warningSoft, border: '#FDE68A' };
  return { fg: colors.primary, soft: colors.primarySoft, border: colors.primaryBorder };
};

const whenLabel = (daysLeft: number) => {
  if (daysLeft < 0) return `Venció hace ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'día' : 'días'}`;
  if (daysLeft === 0) return 'Vence hoy';
  if (daysLeft === 1) return 'Vence mañana';
  return `Vence en ${daysLeft} días`;
};

const toLocalDay = (value: string) => {
  // due_date es DATE ("2026-10-12"): se toma como día local, no UTC.
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

async function fetchDue(userId: string): Promise<{ first: DueItem; count: number } | null> {
  const limit = new Date();
  limit.setDate(limit.getDate() + WINDOW_DAYS);
  const limitStr = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabaseClient
    .from('medical_alerts')
    .select('pet_id, title, alert_type, due_date, pets!inner(name)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lte('due_date', limitStr)
    .order('due_date', { ascending: true })
    .limit(10);
  if (error || !data?.length) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items: DueItem[] = (data as any[]).map((row) => ({
    petId: row.pet_id,
    petName: row.pets?.name || 'Tu mascota',
    title: row.title || 'Recordatorio de salud',
    type: row.alert_type,
    daysLeft: Math.round((toLocalDay(row.due_date).getTime() - today.getTime()) / 86400000),
  }));

  return { first: items[0], count: items.length };
}

/**
 * Aviso al entrar a la app, con el mismo formato que el de "necesita mimos" del juego:
 * la vacuna, desparasitación o control que vence más pronto. Al tocarlo abre la mascota.
 */
export function HealthDueAlert({ onVisibleChange }: { onVisibleChange?: (visible: boolean) => void }) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<{ first: DueItem; count: number } | null>(null);
  const slide = useRef(new Animated.Value(-160)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const refresh = useCallback(() => {
    if (!currentUser?.id || dismissedThisSession) return;
    fetchDue(currentUser.id)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [currentUser?.id]);

  useFocusEffect(refresh);

  useEffect(() => {
    onVisibleChange?.(Boolean(info));
  }, [info, onVisibleChange]);

  useEffect(() => {
    if (!info) return;
    slide.setValue(-160);
    Animated.spring(slide, { toValue: 0, friction: 7, tension: 60, delay: 700, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
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

  const { first, count } = info;
  const tone = getTone(first.daysLeft);
  const Icon = first.type === 'deworming' ? Pill : first.type === 'vaccine' ? Syringe : Stethoscope;
  const iconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const open = () => hide(() => router.push(`/pets/${first.petId}`));

  return (
    <Animated.View
      style={[styles.wrapper, { top: insets.top + 8, transform: [{ translateY: slide }] }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={open}
        style={[styles.card, { borderColor: tone.border, shadowColor: tone.fg }]}
        accessibilityRole="button"
        accessibilityLabel={`${first.title} de ${first.petName}. ${whenLabel(first.daysLeft)}. Abrir la ficha`}
      >
        <View style={[styles.stripe, { backgroundColor: tone.fg }]} />
        <Animated.View style={[styles.iconWrap, { backgroundColor: tone.soft, transform: [{ scale: iconScale }] }]}>
          <Icon size={22} color={tone.fg} />
        </Animated.View>

        <View style={styles.textWrap}>
          <Text style={[styles.kicker, { color: tone.fg }]} numberOfLines={1}>
            {(TYPE_LABEL[first.type] || 'SALUD')} · {first.petName.toUpperCase()}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {first.title}
            {count > 1 ? ` (+${count - 1})` : ''}
          </Text>
          <Text style={[styles.when, { color: tone.fg }]}>{whenLabel(first.daysLeft)}</Text>
        </View>

        <View style={[styles.cta, { backgroundColor: tone.fg }]}>
          <Text style={styles.ctaText}>Ver{'\n'}ficha</Text>
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
    zIndex: 10001,
    elevation: 21,
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
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 12,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  kicker: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    marginTop: 1,
  },
  when: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  cta: {
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
    elevation: 22,
  },
});
