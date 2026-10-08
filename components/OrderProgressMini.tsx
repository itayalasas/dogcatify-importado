import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, AccessibilityInfo } from 'react-native';
import { type OrderFulfillmentMode } from '../utils/orderFulfillment';
import { colors, radius, spacing } from '../constants/theme';

// Etapas de un pedido de productos, en orden. Cada etapa agrupa los estados que la representan.
const SHIPPING_STAGES: string[][] = [
  ['pending', 'reserved'],
  ['confirmed'],
  ['processing', 'preparing'],
  ['ready_for_delivery'],
  ['shipped'],
  ['delivered', 'completed'],
];

const PICKUP_STAGES: string[][] = [
  ['pending', 'reserved'],
  ['confirmed'],
  ['processing', 'preparing'],
  ['ready_for_delivery', 'shipped'],
  ['delivered', 'completed'],
];

interface OrderProgressMiniProps {
  status: string;
  fulfillmentMode?: OrderFulfillmentMode;
}

/** Barra de etapas compacta para la lista de pedidos. No se muestra en pedidos terminados o con problemas. */
export const OrderProgressMini: React.FC<OrderProgressMiniProps> = ({ status, fulfillmentMode = 'shipping' }) => {
  const stages = fulfillmentMode === 'pickup' ? PICKUP_STAGES : SHIPPING_STAGES;
  const currentIndex = stages.findIndex((group) => group.includes(status));
  const isFinished = currentIndex === stages.length - 1;

  const [reduceMotion, setReduceMotion] = useState(false);
  const fill = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentIndex < 0) return;
    if (reduceMotion) {
      fill.setValue(1);
      return;
    }
    fill.setValue(0);
    Animated.timing(fill, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentIndex, fill, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || currentIndex < 0 || isFinished) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion, currentIndex, isFinished]);

  if (currentIndex < 0 || isFinished) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Paso ${currentIndex + 1} de ${stages.length}`}
    >
      <View style={styles.segments}>
        {stages.map((_, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <View key={index} style={styles.segment}>
              {(isDone || isCurrent) && (
                <Animated.View
                  style={[
                    styles.segmentFill,
                    {
                      width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', isCurrent ? '60%' : '100%'] }),
                      opacity: isCurrent
                        ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] })
                        : 1,
                    },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.caption}>
        Paso {currentIndex + 1} de {stages.length}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  segments: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  caption: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginTop: 6,
  },
});

export default OrderProgressMini;
