import {
  normalizePartnerPlanTier,
  resolvePartnerPlanTier,
  resolvePartnerAccountSubscription,
  canAccessPartnerModule,
  getPartnerSubscriptionStatusLabel,
  getPartnerPlan,
  DEFAULT_PARTNER_PLAN_TIER,
} from '../partnerPlans';

const HOUR_MS = 60 * 60 * 1000;
const future = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * HOUR_MS).toISOString();
const past = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR_MS).toISOString();

describe('normalizePartnerPlanTier', () => {
  it('accepts valid tiers', () => {
    expect(normalizePartnerPlanTier('starter')).toBe('starter');
    expect(normalizePartnerPlanTier('growth')).toBe('growth');
    expect(normalizePartnerPlanTier('pro')).toBe('pro');
  });

  it('is case-insensitive', () => {
    expect(normalizePartnerPlanTier('PRO')).toBe('pro');
    expect(normalizePartnerPlanTier('Growth')).toBe('growth');
  });

  it('falls back to the default tier for unknown or missing values', () => {
    expect(normalizePartnerPlanTier('enterprise')).toBe(DEFAULT_PARTNER_PLAN_TIER);
    expect(normalizePartnerPlanTier(null)).toBe(DEFAULT_PARTNER_PLAN_TIER);
    expect(normalizePartnerPlanTier(undefined)).toBe(DEFAULT_PARTNER_PLAN_TIER);
    expect(normalizePartnerPlanTier('')).toBe(DEFAULT_PARTNER_PLAN_TIER);
  });
});

describe('resolvePartnerPlanTier', () => {
  it('returns the plan tier as-is when there is no subscription status', () => {
    expect(resolvePartnerPlanTier('pro', null, null)).toBe('pro');
  });

  it('downgrades a pending subscription to the default tier regardless of the stored tier', () => {
    expect(resolvePartnerPlanTier('pro', 'pending', null)).toBe(DEFAULT_PARTNER_PLAN_TIER);
  });

  it('keeps the tier while trialing or active with no expiration date', () => {
    expect(resolvePartnerPlanTier('growth', 'trialing', null)).toBe('growth');
    expect(resolvePartnerPlanTier('growth', 'active', null)).toBe('growth');
  });

  it('keeps the tier while trialing or active before expiration', () => {
    expect(resolvePartnerPlanTier('pro', 'active', future(24))).toBe('pro');
  });

  it('downgrades an active/trialing subscription once it is past its expiration date', () => {
    expect(resolvePartnerPlanTier('pro', 'active', past(1))).toBe(DEFAULT_PARTNER_PLAN_TIER);
    expect(resolvePartnerPlanTier('pro', 'trialing', past(1))).toBe(DEFAULT_PARTNER_PLAN_TIER);
  });

  it('keeps the tier for paused/cancelled/expired/past_due only while access has not run out yet', () => {
    expect(resolvePartnerPlanTier('growth', 'cancelled', future(24))).toBe('growth');
    expect(resolvePartnerPlanTier('growth', 'paused', future(24))).toBe('growth');
  });

  it('downgrades paused/cancelled/expired/past_due once future access has run out', () => {
    expect(resolvePartnerPlanTier('growth', 'cancelled', past(1))).toBe(DEFAULT_PARTNER_PLAN_TIER);
    expect(resolvePartnerPlanTier('growth', 'expired', null)).toBe(DEFAULT_PARTNER_PLAN_TIER);
    expect(resolvePartnerPlanTier('growth', 'past_due', null)).toBe(DEFAULT_PARTNER_PLAN_TIER);
  });
});

describe('resolvePartnerAccountSubscription', () => {
  it('returns null for an empty or missing list of businesses', () => {
    expect(resolvePartnerAccountSubscription([])).toBeNull();
  });

  it('picks the highest current tier across a single owner\'s multiple businesses', () => {
    // This is exactly the scenario behind the partners_user_id_unique bugfix:
    // one owner, several partner rows, all sharing one subscription outcome.
    const result = resolvePartnerAccountSubscription([
      { subscription_plan_tier: 'starter', subscription_plan_status: 'active', subscription_plan_expires_at: future(24) },
      { subscription_plan_tier: 'pro', subscription_plan_status: 'active', subscription_plan_expires_at: future(24) },
      { subscription_plan_tier: 'growth', subscription_plan_status: 'active', subscription_plan_expires_at: future(24) },
    ]);

    expect(result?.subscriptionPlanTier).toBe('pro');
  });

  it('ignores rows whose subscription has actually lapsed when a current one exists', () => {
    const result = resolvePartnerAccountSubscription([
      { subscription_plan_tier: 'pro', subscription_plan_status: 'expired', subscription_plan_expires_at: past(1) },
      { subscription_plan_tier: 'starter', subscription_plan_status: 'active', subscription_plan_expires_at: future(24) },
    ]);

    expect(result?.subscriptionPlanTier).toBe('starter');
  });

  it('falls back to the best resolved tier among all rows when none are currently active', () => {
    const result = resolvePartnerAccountSubscription([
      { subscription_plan_tier: 'pro', subscription_plan_status: 'expired', subscription_plan_expires_at: past(1) },
    ]);

    expect(result?.subscriptionPlanTier).toBe(DEFAULT_PARTNER_PLAN_TIER);
  });
});

describe('canAccessPartnerModule', () => {
  it('allows any module when none is specified', () => {
    expect(canAccessPartnerModule('starter', undefined)).toBe(true);
  });

  it('gates clients/insights behind at least the growth tier', () => {
    expect(canAccessPartnerModule('starter', 'clients')).toBe(false);
    expect(canAccessPartnerModule('growth', 'clients')).toBe(true);
    expect(canAccessPartnerModule('pro', 'insights')).toBe(true);
  });

  it('requires both the pro tier and a shelter business type for adoptions', () => {
    expect(canAccessPartnerModule('pro', 'adoptions', 'shelter')).toBe(true);
    expect(canAccessPartnerModule('pro', 'adoptions', 'store')).toBe(false);
    expect(canAccessPartnerModule('growth', 'adoptions', 'shelter')).toBe(false);
  });

  it('evaluates access against the resolved (post-expiration) tier, not the stored one', () => {
    expect(canAccessPartnerModule('pro', 'insights', undefined, 'active', past(1))).toBe(false);
  });
});

describe('getPartnerSubscriptionStatusLabel', () => {
  it('labels cancelled/paused subscriptions differently depending on remaining access', () => {
    expect(getPartnerSubscriptionStatusLabel('cancelled', future(24))).toBe('Cancelada hasta vencimiento');
    expect(getPartnerSubscriptionStatusLabel('cancelled', past(1))).toBe('Cancelada');
    expect(getPartnerSubscriptionStatusLabel('paused', future(24))).toBe('Pausada hasta vencimiento');
    expect(getPartnerSubscriptionStatusLabel('paused', null)).toBe('Pausada');
  });

  it('defaults unrecognized/empty statuses to Activa', () => {
    expect(getPartnerSubscriptionStatusLabel(null, null)).toBe('Activa');
  });
});

describe('getPartnerPlan', () => {
  it('returns immutable copies so callers cannot mutate the shared plan definitions', () => {
    const plan = getPartnerPlan('pro');
    plan.features.push('hacked');
    expect(getPartnerPlan('pro').features).not.toContain('hacked');
  });
});
