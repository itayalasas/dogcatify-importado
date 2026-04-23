import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';
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
  autoHideMs = 5000,
  containerStyle,
  enabled = true,
  onHidden,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;

    const evaluateVisibility = async () => {
      if (!enabled) {
        setVisible(false);
        return;
      }

      const seen = await hasSeenHint(hintKey, userId);
      if (!seen) {
        setVisible(true);

        timeout = setTimeout(() => {
          dismissHint();
        }, autoHideMs);
      }
    };

    evaluateVisibility();

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [hintKey, userId, enabled, autoHideMs]);

  const dismissHint = async () => {
    setVisible(false);
    await markHintAsSeen(hintKey, userId);
    onHidden?.();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {visible && (
        <View style={[styles.tooltip, placement === 'bottom' ? styles.bottomTooltip : styles.topTooltip]}>
          <Text style={styles.tooltipText}>{text}</Text>
          <TouchableOpacity onPress={dismissHint} style={styles.closeButton}>
            <X size={14} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={[styles.arrow, placement === 'bottom' ? styles.arrowBottom : styles.arrowTop]} />
        </View>
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
    maxWidth: 220,
    minWidth: 160,
    backgroundColor: '#2D6A6F',
    borderRadius: 10,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 32,
    zIndex: 50,
    right: 0,
  },
  topTooltip: {
    bottom: '100%',
    marginBottom: 8,
  },
  bottomTooltip: {
    top: '100%',
    marginTop: 8,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Medium',
  },
  closeButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    right: 14,
  },
  arrowTop: {
    top: '100%',
    borderTopWidth: 6,
    borderTopColor: '#2D6A6F',
  },
  arrowBottom: {
    bottom: '100%',
    borderBottomWidth: 6,
    borderBottomColor: '#2D6A6F',
  },
});
