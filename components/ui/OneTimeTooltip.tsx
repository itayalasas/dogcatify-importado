import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
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

type TargetLayout = { x: number; y: number; width: number; height: number };

const CARD_MAX_WIDTH = 268;
const SCREEN_MARGIN = 16;
const TARGET_GAP = 14;
const SPOTLIGHT_PADDING = 8;
const MIN_VERTICAL_SPACE = 130;

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [targetLayout, setTargetLayout] = useState<TargetLayout | null>(null);
  const anchorRef = useRef<View>(null);
  const dismissingRef = useRef(false);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let measureTimeout: ReturnType<typeof setTimeout> | null = null;
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

      // Layout of the wrapped target settles a tick after mount; measuring
      // immediately can still return stale (0,0) coordinates from the
      // previous screen, especially right after navigation.
      measureTimeout = setTimeout(() => {
        anchorRef.current?.measureInWindow((x, y, width, height) => {
          if (!isMounted) return;
          setTargetLayout({ x, y, width, height });
        });
      }, 350);

      dismissingRef.current = false;
      setVisible(true);

      opacityAnim.setValue(0);
      scaleAnim.setValue(0.94);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.back(1.2)),
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
      if (timeout) clearTimeout(timeout);
      if (measureTimeout) clearTimeout(measureTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintKey, userId, enabled, autoHideMs]);

  const dismissHint = async () => {
    if (dismissingRef.current) {
      return;
    }

    dismissingRef.current = true;

    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(async () => {
      setVisible(false);
      setTargetLayout(null);
      await markHintAsSeen(hintKey, userId);
      onHidden?.();
    });
  };

  const showModal = visible && !!targetLayout;

  let cardPositionStyle: ViewStyle = {};
  let arrowLeft = CARD_MAX_WIDTH / 2 - 8;
  let arrowIsUp = true;
  let cardWidth = CARD_MAX_WIDTH;
  let spotlightStyle: ViewStyle = {};

  if (showModal && targetLayout) {
    cardWidth = Math.min(CARD_MAX_WIDTH, screenWidth - SCREEN_MARGIN * 2);
    const targetCenterX = targetLayout.x + targetLayout.width / 2;
    const cardLeft = Math.min(
      Math.max(targetCenterX - cardWidth / 2, SCREEN_MARGIN),
      screenWidth - cardWidth - SCREEN_MARGIN,
    );

    const spaceBelow = screenHeight - (targetLayout.y + targetLayout.height);
    const spaceAbove = targetLayout.y;
    let showBelow = placement === 'bottom';
    if (showBelow && spaceBelow < MIN_VERTICAL_SPACE && spaceAbove >= MIN_VERTICAL_SPACE) {
      showBelow = false;
    } else if (!showBelow && spaceAbove < MIN_VERTICAL_SPACE && spaceBelow >= MIN_VERTICAL_SPACE) {
      showBelow = true;
    }

    arrowIsUp = showBelow;
    cardPositionStyle = showBelow
      ? { top: targetLayout.y + targetLayout.height + TARGET_GAP, left: cardLeft }
      : { bottom: screenHeight - targetLayout.y + TARGET_GAP, left: cardLeft };

    arrowLeft = Math.min(
      Math.max(targetCenterX - cardLeft - 8, 16),
      cardWidth - 32,
    );

    spotlightStyle = {
      left: targetLayout.x - SPOTLIGHT_PADDING,
      top: targetLayout.y - SPOTLIGHT_PADDING,
      width: targetLayout.width + SPOTLIGHT_PADDING * 2,
      height: targetLayout.height + SPOTLIGHT_PADDING * 2,
    };
  }

  return (
    <>
      <View ref={anchorRef} style={containerStyle} collapsable={false}>
        {children}
      </View>

      {showModal && (
        <Modal transparent visible animationType="none" onRequestClose={dismissHint}>
          <Pressable style={styles.backdrop} onPress={dismissHint}>
            <View pointerEvents="none" style={[styles.spotlight, spotlightStyle]} />

            <Animated.View
              style={[
                styles.card,
                cardPositionStyle,
                {
                  width: cardWidth,
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <View
                style={[
                  styles.arrow,
                  arrowIsUp ? styles.arrowUp : styles.arrowDown,
                  { left: arrowLeft },
                ]}
              />

              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Lightbulb size={12} color="#2D6A6F" />
                  <Text style={styles.badgeText}>Tip</Text>
                </View>

                <TouchableOpacity
                  onPress={() => void dismissHint()}
                  style={styles.closeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={14} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.cardText}>{text}</Text>

              <TouchableOpacity
                onPress={() => void dismissHint()}
                style={styles.gotItButton}
                activeOpacity={0.85}
              >
                <Text style={styles.gotItButtonText}>Entendido</Text>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  spotlight: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#5EEAD4',
    shadowColor: '#5EEAD4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 14,
  },
  cardHeader: {
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
  cardText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Medium',
    marginBottom: 12,
  },
  closeButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#2D6A6F',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  gotItButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowUp: {
    top: -8,
    borderBottomWidth: 8,
    borderBottomColor: '#FFFFFF',
  },
  arrowDown: {
    bottom: -8,
    borderTopWidth: 8,
    borderTopColor: '#FFFFFF',
  },
});
