import { normalizePartnerPlanTier, type PartnerPlanTier } from './partnerPlans';

export type UserPlanTier = 'free' | 'standard' | 'premium';
export type SubscriptionAudienceTarget = 'users' | 'partners' | 'all';

export interface UserPlanLimits {
  maxPets: number | null;
  maxPostsPerDay: number | null;
  maxPetAlbums: number | null;
  maxMatchSwipesPerDay: number | null;
  dottyEnabled: boolean;
}

export interface PartnerPlanLimits {
  maxBusinesses: number | null;
  maxServices: number | null;
  maxProducts: number | null;
  maxPromotions: number | null;
}

export interface SubscriptionPlanLimits {
  users: UserPlanLimits;
  partners: PartnerPlanLimits;
}

export interface SubscriptionPlanRowLike {
  tier?: string | null;
  audience_target?: SubscriptionAudienceTarget | null;
  limits?: Record<string, any> | null;
}

export type SubscriptionPlanRowLikeInput = SubscriptionPlanRowLike | SubscriptionPlanRowLike[] | null | undefined;

const DEFAULT_USER_LIMITS_BY_TIER: Record<UserPlanTier, UserPlanLimits> = {
  free: {
    maxPets: 2,
    maxPostsPerDay: 3,
    maxPetAlbums: 2,
    maxMatchSwipesPerDay: 1,
    dottyEnabled: false,
  },
  standard: {
    maxPets: 5,
    maxPostsPerDay: 10,
    maxPetAlbums: 5,
    maxMatchSwipesPerDay: 5,
    dottyEnabled: true,
  },
  premium: {
    maxPets: null,
    maxPostsPerDay: null,
    maxPetAlbums: null,
    maxMatchSwipesPerDay: null,
    dottyEnabled: true,
  },
};

const DEFAULT_PARTNER_LIMITS_BY_TIER: Record<PartnerPlanTier, PartnerPlanLimits> = {
  starter: {
    maxBusinesses: 1,
    maxServices: 5,
    maxProducts: 10,
    maxPromotions: 1,
  },
  growth: {
    maxBusinesses: 3,
    maxServices: 20,
    maxProducts: 40,
    maxPromotions: 3,
  },
  pro: {
    maxBusinesses: null,
    maxServices: null,
    maxProducts: null,
    maxPromotions: null,
  },
};

const normalizeTier = (value?: string | null) => String(value || '').toLowerCase();

const toNullableInteger = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
};

const toBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return fallback;
};

const mapPartnerTierToUserTier = (tier?: string | null): UserPlanTier => {
  const normalized = normalizeTier(tier);
  if (normalized === 'standard' || normalized === 'growth') return 'standard';
  if (normalized === 'premium' || normalized === 'pro') return 'premium';
  return 'free';
};

const mapUserTierToPartnerTier = (tier?: string | null): PartnerPlanTier => {
  const normalized = normalizeTier(tier);
  if (normalized === 'growth' || normalized === 'standard') return 'growth';
  if (normalized === 'pro' || normalized === 'premium') return 'pro';
  return 'starter';
};

const normalizeUserLimits = (value: Record<string, any> | null | undefined, fallbackTier?: string | null): UserPlanLimits => {
  const defaults = DEFAULT_USER_LIMITS_BY_TIER[mapPartnerTierToUserTier(fallbackTier)];
  const source = value || {};

  return {
    maxPets: toNullableInteger(source.max_pets ?? source.maxPets ?? defaults.maxPets),
    maxPostsPerDay: toNullableInteger(source.max_posts_per_day ?? source.maxPostsPerDay ?? defaults.maxPostsPerDay),
    maxPetAlbums: toNullableInteger(source.max_pet_albums ?? source.maxPetAlbums ?? defaults.maxPetAlbums),
    maxMatchSwipesPerDay: toNullableInteger(source.max_match_swipes_per_day ?? source.maxMatchSwipesPerDay ?? defaults.maxMatchSwipesPerDay),
    dottyEnabled: toBoolean(source.dotty_enabled ?? source.dottyEnabled, defaults.dottyEnabled),
  };
};

const normalizePartnerLimits = (value: Record<string, any> | null | undefined, fallbackTier?: string | null): PartnerPlanLimits => {
  const defaults = DEFAULT_PARTNER_LIMITS_BY_TIER[normalizePartnerPlanTier(mapUserTierToPartnerTier(fallbackTier))];
  const source = value || {};

  return {
    maxBusinesses: toNullableInteger(source.max_businesses ?? source.maxBusinesses ?? defaults.maxBusinesses),
    maxServices: toNullableInteger(source.max_services ?? source.maxServices ?? defaults.maxServices),
    maxProducts: toNullableInteger(source.max_products ?? source.maxProducts ?? defaults.maxProducts),
    maxPromotions: toNullableInteger(source.max_promotions ?? source.maxPromotions ?? defaults.maxPromotions),
  };
};

export const getDefaultSubscriptionPlanLimits = (audience: SubscriptionAudienceTarget, tier?: string | null): SubscriptionPlanLimits => {
  const userTier = mapPartnerTierToUserTier(tier);
  const partnerTier = normalizePartnerPlanTier(mapUserTierToPartnerTier(tier));

  return {
    users: audience === 'partners'
      ? DEFAULT_USER_LIMITS_BY_TIER.free
      : DEFAULT_USER_LIMITS_BY_TIER[userTier],
    partners: audience === 'users'
      ? DEFAULT_PARTNER_LIMITS_BY_TIER.starter
      : DEFAULT_PARTNER_LIMITS_BY_TIER[partnerTier],
  };
};

const normalizeSubscriptionPlanRow = (row?: SubscriptionPlanRowLikeInput): SubscriptionPlanRowLike | null => {
  if (!row) return null;
  if (Array.isArray(row)) return row[0] || null;
  return row;
};

export const resolveSubscriptionPlanLimits = (row?: SubscriptionPlanRowLikeInput): SubscriptionPlanLimits => {
  const normalizedRow = normalizeSubscriptionPlanRow(row);
  const tier = normalizedRow?.tier || null;
  const audience = (normalizedRow?.audience_target || 'users') as SubscriptionAudienceTarget;
  const rawLimits = normalizedRow?.limits || {};

  const defaults = getDefaultSubscriptionPlanLimits(audience, tier);
  const rawUserLimits = rawLimits.users || rawLimits.user || rawLimits.clients || rawLimits.pet_owner || null;
  const rawPartnerLimits = rawLimits.partners || rawLimits.partner || rawLimits.business || rawLimits.businesses || null;

  return {
    users: audience === 'partners'
      ? normalizeUserLimits(rawUserLimits, tier)
      : normalizeUserLimits({ ...defaults.users, ...rawUserLimits }, tier),
    partners: audience === 'users'
      ? normalizePartnerLimits(rawPartnerLimits, tier)
      : normalizePartnerLimits({ ...defaults.partners, ...rawPartnerLimits }, tier),
  };
};

export const formatLimitValue = (value: number | null | undefined, unit?: string) => {
  if (value === null || value === undefined) return 'Sin límite';
  return `${value.toLocaleString('es-UY')}${unit ? ` ${unit}` : ''}`;
};

export const buildUserLimitSummary = (limits: UserPlanLimits) => [
  { label: 'Mascotas', value: formatLimitValue(limits.maxPets) },
  { label: 'Publicaciones/día', value: formatLimitValue(limits.maxPostsPerDay) },
  { label: 'Álbumes', value: formatLimitValue(limits.maxPetAlbums) },
  { label: 'Matches/día', value: formatLimitValue(limits.maxMatchSwipesPerDay) },
  { label: 'Dotty', value: limits.dottyEnabled ? 'Incluido' : 'No incluido' },
];

export const buildPartnerLimitSummary = (limits: PartnerPlanLimits) => [
  { label: 'Negocios', value: formatLimitValue(limits.maxBusinesses) },
  { label: 'Servicios', value: formatLimitValue(limits.maxServices) },
  { label: 'Productos', value: formatLimitValue(limits.maxProducts) },
  { label: 'Promociones', value: formatLimitValue(limits.maxPromotions) },
];
