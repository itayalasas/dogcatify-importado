import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

// For screens reached right after an external payment (Mercado Pago), where the
// navigation history is unreliable or was cleared on purpose: "back" should
// land on the home screen, not on whatever happens to be left underneath (an
// old screen, or the login screen). Covers the Android hardware back button;
// the returned function is for the on-screen back arrow. iOS's swipe-back is
// disabled per screen in app/_layout.tsx.
export const useBackToHome = (enabled = true) => {
  const goHome = useCallback(() => {
    router.replace('/(tabs)');
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goHome();
        return true;
      });

      return () => subscription.remove();
    }, [enabled, goHome]),
  );

  return goHome;
};
