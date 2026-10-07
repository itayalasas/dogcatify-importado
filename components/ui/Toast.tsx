import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, AccessibilityInfo, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { colors, radius, spacing, typography, shadows, maxFontScale } from '../../constants/theme';

/**
 * Avisos breves y no bloqueantes.
 *
 * Usar para confirmar algo que ya pasó ("Guardado", "Agregado al carrito").
 * Para decisiones (¿Eliminar?) o errores que requieren acción, seguir usando Alert.
 *
 *   import { toast } from '../components/ui/Toast';
 *   toast.success('Plan actualizado');
 */
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
}

type Listener = (t: ToastMessage) => void;
const listeners = new Set<Listener>();
let nextId = 1;

const show = (type: ToastType, title: string, message?: string, duration = 2800) => {
  const t: ToastMessage = { id: nextId++, type, title, message, duration };
  if (listeners.size === 0) {
    // Sin host montado (no debería pasar): al menos que quede en el log.
    console.log(`[toast:${type}] ${title}${message ? ` - ${message}` : ''}`);
    return;
  }
  listeners.forEach((l) => l(t));
};

export const toast = {
  success: (title: string, message?: string) => show('success', title, message),
  error: (title: string, message?: string) => show('error', title, message, 4000),
  info: (title: string, message?: string) => show('info', title, message),
  warning: (title: string, message?: string) => show('warning', title, message, 3500),
  show,
};

const iconFor = (type: ToastType) => {
  const props = { size: 20, color: colors.white };
  switch (type) {
    case 'success':
      return <CheckCircle2 {...props} />;
    case 'error':
      return <AlertCircle {...props} />;
    case 'warning':
      return <AlertTriangle {...props} />;
    default:
      return <Info {...props} />;
  }
};

const bgFor: Record<ToastType, string> = {
  success: colors.primaryStrong,
  error: colors.danger,
  warning: '#92400E',
  info: colors.text,
};

/** Se monta una sola vez, en app/_layout.tsx. */
export const ToastHost: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setCurrent(null));
  };

  useEffect(() => {
    const listener: Listener = (t) => {
      if (timer.current) clearTimeout(timer.current);
      setCurrent(t);
      translateY.setValue(-120);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      AccessibilityInfo.announceForAccessibility(t.message ? `${t.title}. ${t.message}` : t.title);
      timer.current = setTimeout(hide, t.duration);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { top: insets.top + spacing.sm }]}>
      <Animated.View style={{ transform: [{ translateY }], opacity, width: '100%', alignItems: 'center' }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (timer.current) clearTimeout(timer.current);
            hide();
          }}
          style={[styles.toast, { backgroundColor: bgFor[current.type] }]}
          accessibilityRole="alert"
          accessibilityLabel={current.message ? `${current.title}. ${current.message}` : current.title}
          accessibilityHint="Tocá para cerrar"
        >
          <View style={styles.icon}>{iconFor(current.type)}</View>
          <View style={styles.textBox}>
            <Text style={styles.title} maxFontSizeMultiplier={maxFontScale.compact}>
              {current.title}
            </Text>
            {current.message ? (
              <Text style={styles.message} maxFontSizeMultiplier={maxFontScale.compact}>
                {current.message}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 520,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    ...shadows.lg,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : null),
  },
  icon: { marginRight: spacing.md },
  textBox: { flex: 1 },
  title: { ...typography.bodyStrong, fontSize: 15, color: colors.white },
  message: { ...typography.bodySmall, color: 'rgba(255, 255, 255, 0.9)', marginTop: 2 },
});
