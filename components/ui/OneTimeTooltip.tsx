import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Lightbulb, X } from 'lucide-react-native';
import { hasSeenHint, markHintAsSeen } from '../../utils/oneTimeHints';

interface OneTimeTooltipProps {
  hintKey: string;
  text: string;
  userId?: string | null;
  children: React.ReactNode;
  placement?: 'top' | 'bottom';
  autoHideMs?: number;
  containerStyle?: ViewStyle;
  enabled?: boolean;
  onHidden?: () => void;
}

export const OneTimeTooltip: React.FC<OneTimeTooltipProps> = ({
  hintKey,
  text,
  userId,
  children,
  placement = 'top',
  autoHideMs = 6500,
  containerStyle,
  enabled = true,
  onHidden,
}) => {
  const [visible, setVisible] = useState(false);
  const dismissingRef = useRef(false);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(placement === 'bottom' ? -6 : 6)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    let isMounted = true;

    const evaluateVisibility = async () => {
      if (!enabled) {
        setVisible(false);
        dismissingRef.current = false;
        return;
      }

      const seen = await hasSeenHint(hintKey, userId);
      if (!isMounted || seen) {
        return;
      }

      dismissingRef.current = false;
      setVisible(true);

      opacityAnim.setValue(0);
      translateAnim.setValue(placement === 'bottom' ? -6 : 6);
      scaleAnim.setValue(0.96);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      timeout = setTimeout(() => {
        void dismissHint();
      }, autoHideMs);
    };

    void evaluateVisibility();

    return () => {
      isMounted = false;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [hintKey, userId, enabled, autoHideMs, opacityAnim, placement, scaleAnim, translateAnim]);

  const dismissHint = async () => {
    if (dismissingRef.current) {
      return;
    }

    dismissingRef.current = true;

    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: placement === 'bottom' ? -4 : 4,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(async () => {
      setVisible(false);
      await markHintAsSeen(hintKey, userId);
      onHidden?.();
    });
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {visible && (
        <Animated.View
          style={[
            styles.tooltip,
            placement === 'bottom' ? styles.bottomTooltip : styles.topTooltip,
            {
              opacity: opacityAnim,
              transform: [{ translateY: translateAnim }, { scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.tooltipHeader}>
            <View style={styles.badge}>
              <Lightbulb size={12} color="#2D6A6F" />
              <Text style={styles.badgeText}>Tip</Text>
            </View>

            <TouchableOpacity onPress={() => void dismissHint()} style={styles.closeButton}>
              <X size={14} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.tooltipText}>{text}</Text>
          <View style={[styles.arrow, placement === 'bottom' ? styles.arrowBottom : styles.arrowTop]} />
        </Animated.View>
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    maxWidth: 250,
    minWidth: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    zIndex: 50,
    right: 0,
    borderWidth: 1,
    borderColor: '#D9E7E6',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },
  topTooltip: {
    bottom: '100%',
    marginBottom: 10,
  },
  bottomTooltip: {
    top: '100%',
    marginTop: 10,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E7F4F3',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#2D6A6F',
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tooltipText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter-Medium',
    paddingRight: 12,
  },
  closeButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    right: 18,
  },
  arrowTop: {
    top: '100%',
    borderTopWidth: 8,
    borderTopColor: '#FFFFFF',
  },
  arrowBottom: {
    bottom: '100%',
    borderBottomWidth: 8,
    borderBottomColor: '#FFFFFF',
  },
});
