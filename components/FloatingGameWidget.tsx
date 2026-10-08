import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  PanResponder,
  Pressable,
  Easing,
  LayoutChangeEvent,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X } from 'lucide-react-native';
import { supabaseClient } from '../lib/supabase';
import { colors } from '../constants/theme';

const LOGO = require('../assets/images/patitas-game-logo.png');

const BUBBLE_SIZE = 64;
const EDGE_MARGIN = 10;
const TOP_MARGIN = 30;
const LEGACY_DISMISS_KEY = 'patitas_game_widget_dismissed_date';
const POSITION_KEY = 'patitas_game_widget_position';
const DEFAULT_MAX_DISCOUNT = 20;
// Tiempo que la burbuja queda oculta después de cerrarla con la X
const REAPPEAR_AFTER_MS = 3 * 60 * 1000;

// Vive en memoria (a nivel de módulo): sobrevive si el home se desmonta/remonta,
// pero se reinicia al cerrar y abrir la app.
let hiddenUntil = 0;

const clampY = (y: number, height: number) =>
  Math.min(Math.max(y, TOP_MARGIN), height - BUBBLE_SIZE - EDGE_MARGIN);

/**
 * Burbuja flotante estilo "oferta" que lleva al juego Patitas al Rescate.
 * - Se puede arrastrar y se pega al borde izquierdo o derecho (recuerda la posición).
 * - Muestra un globo con la oferta que se despliega y se esconde solo.
 * - Al cerrarla con la X se oculta unos minutos; vuelve sola, al volver a abrir la app
 *   o al regresar a DogCatiFy desde segundo plano.
 * Renderizar como último hijo de la pantalla: ocupa todo el espacio con pointerEvents="box-none".
 */
export function FloatingGameWidget() {
  const router = useRouter();
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [maxDiscount, setMaxDiscount] = useState(DEFAULT_MAX_DISCOUNT);
  const [showTooltip, setShowTooltip] = useState(false);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const appear = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const isDragging = useRef(false);
  const savedYRatio = useRef<number | null>(null);
  const savedSide = useRef<'left' | 'right'>('right');
  const areaRef = useRef(area);
  areaRef.current = area;

  const reappearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAgain = () => {
    hiddenUntil = 0;
    if (reappearTimer.current) clearTimeout(reappearTimer.current);
    reappearTimer.current = null;
    setIsVisible(true);
  };

  // Posición guardada + % máximo configurado por el admin
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const position = await AsyncStorage.getItem(POSITION_KEY);
        if (position) {
          const parsed = JSON.parse(position);
          savedYRatio.current = typeof parsed.yRatio === 'number' ? parsed.yRatio : null;
          savedSide.current = parsed.side === 'left' ? 'left' : 'right';
        }
        // Limpia el cierre "hasta mañana" de la versión anterior
        AsyncStorage.removeItem(LEGACY_DISMISS_KEY).catch(() => {});
      } catch {
        // Se usa la posición por defecto
      }

      if (mounted) {
        const remaining = hiddenUntil - Date.now();
        if (remaining <= 0) {
          setIsVisible(true);
        } else {
          reappearTimer.current = setTimeout(showAgain, remaining);
        }
      }

      try {
        const { data } = await supabaseClient
          .from('admin_settings')
          .select('value')
          .eq('key', 'game_promotions_config')
          .maybeSingle();
        const cfg = data?.value;
        if (cfg && mounted) {
          const percents = ['level3', 'level5', 'level10']
            .filter(k => cfg[k]?.active !== false && typeof cfg[k]?.percent === 'number')
            .map(k => cfg[k].percent as number);
          if (percents.length > 0) setMaxDiscount(Math.max(...percents));
        }
      } catch {
        // Se mantiene el valor por defecto
      }
    })();
    return () => {
      mounted = false;
      if (reappearTimer.current) clearTimeout(reappearTimer.current);
    };
  }, []);

  // Al volver a DogCatiFy desde segundo plano, la burbuja vuelve a mostrarse
  useEffect(() => {
    let previous: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', next => {
      if (previous.match(/inactive|background/) && next === 'active') showAgain();
      previous = next;
    });
    return () => sub.remove();
  }, []);

  // Posición inicial una vez que conocemos el tamaño de la pantalla
  useEffect(() => {
    if (!area || !isVisible) return;
    const s = savedSide.current;
    setSide(s);
    pan.setValue({
      x: s === 'right' ? area.width - BUBBLE_SIZE - EDGE_MARGIN : EDGE_MARGIN,
      y: clampY(area.height * (savedYRatio.current ?? 0.72), area.height),
    });
  }, [area, isVisible]);

  // Animaciones: entrada con rebote, pulso continuo, sacudida periódica y globo de oferta
  useEffect(() => {
    if (!isVisible || !area) return;

    Animated.spring(appear, { toValue: 1, friction: 5, tension: 60, delay: 800, useNativeDriver: true }).start();

    const pulseLoop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    pulseLoop.start();

    const shake = () =>
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 70, useNativeDriver: true }),
      ]).start();

    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const openTooltip = () => {
      if (isDragging.current) return;
      setShowTooltip(true);
      tooltipAnim.setValue(0);
      Animated.spring(tooltipAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      shake();
      hideTimer = setTimeout(() => {
        Animated.timing(tooltipAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
          setShowTooltip(false)
        );
      }, 4500);
    };

    const firstTooltip = setTimeout(openTooltip, 1800);
    const shakeInterval = setInterval(shake, 6000);
    const tooltipInterval = setInterval(openTooltip, 25000);

    return () => {
      pulseLoop.stop();
      clearTimeout(firstTooltip);
      if (hideTimer) clearTimeout(hideTimer);
      clearInterval(shakeInterval);
      clearInterval(tooltipInterval);
    };
  }, [isVisible, area]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Capture: le quita el gesto al Pressable cuando el dedo se mueve (arrastre)
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.extractOffset();
        tooltipAnim.setValue(0);
        setShowTooltip(false);
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const a = areaRef.current;
        if (!a) {
          isDragging.current = false;
          return;
        }
        const current = (pan as any).__getValue() as { x: number; y: number };
        const snapRight = current.x + BUBBLE_SIZE / 2 > a.width / 2;
        const target = {
          x: snapRight ? a.width - BUBBLE_SIZE - EDGE_MARGIN : EDGE_MARGIN,
          y: clampY(current.y, a.height),
        };
        const newSide = snapRight ? 'right' : 'left';
        setSide(newSide);
        savedSide.current = newSide;
        savedYRatio.current = target.y / a.height;
        Animated.spring(pan, { toValue: target, friction: 6, useNativeDriver: false }).start(() => {
          isDragging.current = false;
        });
        AsyncStorage.setItem(POSITION_KEY, JSON.stringify({ side: newSide, yRatio: target.y / a.height })).catch(
          () => {}
        );
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        isDragging.current = false;
      },
    })
  ).current;

  const handleOpenGame = () => {
    if (isDragging.current) return;
    router.push('/game' as any);
  };

  const handleDismiss = () => {
    hiddenUntil = Date.now() + REAPPEAR_AFTER_MS;
    Animated.timing(appear, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setIsVisible(false));
    if (reappearTimer.current) clearTimeout(reappearTimer.current);
    reappearTimer.current = setTimeout(showAgain, REAPPEAR_AFTER_MS);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!area || area.width !== width || area.height !== height) setArea({ width, height });
  };

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const rotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] });
  const tooltipScale = tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {isVisible && area && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.wrapper, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
        >
          <Animated.View style={{ transform: [{ scale: appear }] }}>
            {/* Globo con la oferta */}
            {showTooltip && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.tooltip,
                  side === 'right' ? styles.tooltipLeftOfBubble : styles.tooltipRightOfBubble,
                  { opacity: tooltipAnim, transform: [{ scale: tooltipScale }] },
                ]}
              >
                <Text style={styles.tooltipTitle}>🎁 ¡Jugá y ganá!</Text>
                <Text style={styles.tooltipText}>Hasta {maxDiscount}% OFF en DogCatiFy</Text>
              </Animated.View>
            )}

            {/* Anillo de pulso */}
            <Animated.View
              pointerEvents="none"
              style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            />

            <Pressable
              onPress={handleOpenGame}
              style={styles.bubblePress}
              accessibilityRole="button"
              accessibilityLabel={`Jugar Patitas al Rescate, hasta ${maxDiscount}% de descuento`}
            >
              <Animated.View style={[styles.bubble, { transform: [{ rotate }] }]}>
                <Image source={LOGO} style={styles.logo} />
              </Animated.View>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{maxDiscount}%</Text>
              </View>
              <View style={styles.playLabel}>
                <Text style={styles.playText}>JUGAR</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={handleDismiss}
              style={[styles.closeBtn, side === 'right' ? { left: -6 } : { right: -6 }]}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Ocultar el juego por unos minutos"
            >
              <X size={10} color={colors.white} strokeWidth={3} />
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    zIndex: 9999,
    elevation: 12,
  },
  ring: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#F97316',
  },
  bubblePress: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FDBA74',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  logo: {
    width: BUBBLE_SIZE - 6,
    height: BUBBLE_SIZE - 6,
    borderRadius: (BUBBLE_SIZE - 6) / 2,
  },
  discountBadge: {
    position: 'absolute',
    top: -8,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 12,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  playLabel: {
    position: 'absolute',
    bottom: -9,
    alignSelf: 'center',
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 12,
  },
  playText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeBtn: {
    position: 'absolute',
    top: -6,
    backgroundColor: colors.textTertiary,
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 13,
  },
  tooltip: {
    position: 'absolute',
    top: 6,
    width: 170,
    backgroundColor: '#EA580C',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 11,
  },
  tooltipLeftOfBubble: {
    right: BUBBLE_SIZE + 10,
  },
  tooltipRightOfBubble: {
    left: BUBBLE_SIZE + 10,
  },
  tooltipTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  tooltipText: {
    color: '#FFEDD5',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
});
