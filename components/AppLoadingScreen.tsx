import React, { useEffect, useRef } from 'react';
import { View, Image, Text, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../constants/theme';

const { width } = Dimensions.get('window');
const BRAND_COLOR = colors.primary;
const LOGO_SIZE = Math.min(width * 0.4, 160);
const RING_SIZE = LOGO_SIZE + 44;
const ROTATION_PERIOD_MS = 1400;

interface AppLoadingScreenProps {
  message?: string;
}

// Shared branded loading screen: used both while the app's initial
// configuration/session is loading (app/_layout.tsx) and while the root
// route is waiting on auth state to resolve before redirecting
// (app/index.tsx). White background matches Expo's native splash
// (app.json) so there's no color flash between the native and JS splash.
//
// The app moves through several internal loading gates on boot (config →
// auth → platform status), each a different branch in the component tree,
// so this component gets unmounted and remounted as they resolve — there's
// no way to keep a single persisted instance across that boundary without
// restructuring how providers mount (AuthProvider etc. can't mount before
// config finishes loading; the shared Supabase client throws if touched
// before initializeSupabase() resolves).
//
// A plain Animated.loop always restarts its rotation from 0deg on mount,
// so a remount mid-spin would visibly snap backwards. To avoid that, the
// ring's starting angle is derived from the real wall-clock time
// (Date.now() % ROTATION_PERIOD_MS) instead of always starting at 0 — so
// even across a hard remount, the ring looks like it never stopped
// spinning. The logo itself stays static at the center; only the ring
// around it animates.
export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  message = 'Cargando DogCatiFy...',
}) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startPhase = (Date.now() % ROTATION_PERIOD_MS) / ROTATION_PERIOD_MS;
    rotation.setValue(startPhase);

    const startLoop = () => {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: ROTATION_PERIOD_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    };

    // Play out the remainder of the current cycle first so the loop settles
    // into the same rhythm it would already be on, then loop full laps.
    const firstLap = Animated.timing(rotation, {
      toValue: 1,
      duration: ROTATION_PERIOD_MS * (1 - startPhase),
      easing: Easing.linear,
      useNativeDriver: true,
    });

    firstLap.start(({ finished }) => {
      if (!finished) return;
      rotation.setValue(0);
      startLoop();
    });

    return () => {
      firstLap.stop();
    };
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <View style={styles.logoStack}>
        <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]} />
        <Image
          source={require('../assets/images/logo-transp.png')}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  logoStack: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.primaryMuted,
    borderTopColor: BRAND_COLOR,
  },
  message: {
    ...typography.label,
    fontSize: 16,
    marginTop: spacing.xxl,
    color: BRAND_COLOR,
  },
});
