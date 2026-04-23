import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseClient } from '@/lib/supabase';

const ONBOARDING_CACHE_PREFIX = '@onboarding_seen_user_';

const getOnboardingCacheKey = (userId: string) => `${ONBOARDING_CACHE_PREFIX}${userId}`;

export const shouldShowOnboarding = async (userId: string): Promise<boolean> => {
  try {
    const cacheKey = getOnboardingCacheKey(userId);
    const cachedValue = await AsyncStorage.getItem(cacheKey);

    if (cachedValue === 'true') {
      return false;
    }

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Could not validate onboarding status from DB:', error.message);
      return false;
    }

    if (data?.onboarding_completed) {
      await AsyncStorage.setItem(cacheKey, 'true');
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Error deciding onboarding visibility:', error);
    return false;
  }
};

export const completeOnboarding = async (userId: string): Promise<void> => {
  const cacheKey = getOnboardingCacheKey(userId);

  try {
    await supabaseClient
      .from('profiles')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', userId);
  } catch (error) {
    console.warn('Error updating onboarding completion in DB:', error);
  } finally {
    await AsyncStorage.setItem(cacheKey, 'true');
  }
};

export const resolvePostLoginRoute = async (userId: string, redirect?: string): Promise<string> => {
  if (redirect) {
    return redirect;
  }

  const showOnboarding = await shouldShowOnboarding(userId);
  return showOnboarding ? '/onboarding' : '/(tabs)';
};
