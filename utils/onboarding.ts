import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseClient } from '@/lib/supabase';
import type { User } from '../types';

export type AppRole = 'owner' | 'partner' | 'admin';

type PostLoginRoleContext = Pick<User, 'isOwner' | 'isPartner' | 'isAdmin'>;

const ONBOARDING_CACHE_PREFIX = '@onboarding_seen_user_';
const ACTIVE_ROLE_CACHE_PREFIX = '@active_role_user_';
const ACTIVE_PARTNER_BUSINESS_CACHE_PREFIX = '@active_partner_business_user_';

const getOnboardingCacheKey = (userId: string) => `${ONBOARDING_CACHE_PREFIX}${userId}`;
const getActiveRoleCacheKey = (userId: string) => `${ACTIVE_ROLE_CACHE_PREFIX}${userId}`;
const getActivePartnerBusinessCacheKey = (userId: string) => `${ACTIVE_PARTNER_BUSINESS_CACHE_PREFIX}${userId}`;

const isAppRole = (value: string | null | undefined): value is AppRole =>
  value === 'owner' || value === 'partner' || value === 'admin';

const buildSelectRoleRoute = (redirect?: string): string => {
  if (!redirect) {
    return '/auth/select-role';
  }

  return `/auth/select-role?redirect=${encodeURIComponent(redirect)}`;
};

export const getAvailableRoles = (userContext?: PostLoginRoleContext | null): AppRole[] => {
  const roles: AppRole[] = [];

  if (userContext?.isOwner) {
    roles.push('owner');
  }

  if (userContext?.isPartner) {
    roles.push('partner');
  }

  if (userContext?.isAdmin) {
    roles.push('admin');
  }

  return roles;
};

export const resolvePreferredActiveRole = async (
  userId: string,
  availableRoles: AppRole[],
): Promise<AppRole | null> => {
  try {
    const storedRole = await getStoredActiveRole(userId);
    if (storedRole && availableRoles.includes(storedRole)) {
      return storedRole;
    }
  } catch (error) {
  }

  if (availableRoles.length === 1) {
    return availableRoles[0];
  }

  return null;
};

export const getStoredActiveRole = async (userId: string): Promise<AppRole | null> => {
  try {
    const storedRole = await AsyncStorage.getItem(getActiveRoleCacheKey(userId));
    return isAppRole(storedRole) ? storedRole : null;
  } catch (error) {
    return null;
  }
};

export const setStoredActiveRole = async (userId: string, role: AppRole): Promise<void> => {
  try {
    await AsyncStorage.setItem(getActiveRoleCacheKey(userId), role);
  } catch (error) {
  }
};

export const clearStoredActiveRole = async (userId: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(getActiveRoleCacheKey(userId));
  } catch (error) {
  }
};

export const getStoredActivePartnerBusinessId = async (userId: string): Promise<string | null> => {
  try {
    const storedBusinessId = await AsyncStorage.getItem(getActivePartnerBusinessCacheKey(userId));
    return storedBusinessId?.trim() ? storedBusinessId : null;
  } catch (error) {
    return null;
  }
};

export const setStoredActivePartnerBusinessId = async (userId: string, businessId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(getActivePartnerBusinessCacheKey(userId), businessId);
  } catch (error) {
  }
};

export const clearStoredActivePartnerBusinessId = async (userId: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(getActivePartnerBusinessCacheKey(userId));
  } catch (error) {
  }
};

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
      return false;
    }

    if (data?.onboarding_completed) {
      await AsyncStorage.setItem(cacheKey, 'true');
      return false;
    }

    return true;
  } catch (error) {
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
  } finally {
    await AsyncStorage.setItem(cacheKey, 'true');
  }
};

export const resolveRoleRoute = async (
  userId: string,
  role: AppRole,
): Promise<string> => {
  const showOnboarding = await shouldShowOnboarding(userId);
  if (showOnboarding) {
    return '/onboarding';
  }

  if (role === 'partner') {
    return '/(partner-tabs)/business-selector';
  }

  if (role === 'admin') {
    return '/(admin-tabs)/analytics';
  }

  return '/(tabs)';
};

export const resolvePostLoginRoute = async (
  userId: string,
  redirect?: string,
  userContext?: PostLoginRoleContext | null,
): Promise<string> => {
  const showOnboarding = await shouldShowOnboarding(userId);
  if (showOnboarding) {
    return '/onboarding';
  }

  const resolvedContext = userContext ?? (await (async () => {
    try {
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('is_owner, is_partner, is_admin, onboarding_completed')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return null;
      }

      return profile
        ? {
            isOwner: profile.is_owner ?? true,
            isPartner: profile.is_partner ?? false,
            isAdmin: profile.is_admin ?? false,
          }
        : null;
    } catch (error) {
      return null;
    }
  })());

  const availableRoles = getAvailableRoles(resolvedContext);

  if (availableRoles.length > 1) {
    return buildSelectRoleRoute(redirect);
  }

  if (redirect) {
    return redirect;
  }

  const preferredRole = await resolvePreferredActiveRole(userId, availableRoles);

  if (preferredRole) {
    return resolveRoleRoute(userId, preferredRole);
  }

  return redirect || '/(tabs)';
};
