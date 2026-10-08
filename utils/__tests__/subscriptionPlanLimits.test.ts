import {
  getDefaultSubscriptionPlanLimits,
  resolveSubscriptionPlanLimits,
  formatLimitValue,
} from '../subscriptionPlanLimits';

describe('getDefaultSubscriptionPlanLimits', () => {
  it('gives free-tier user limits and starter partner limits for a users-only audience with no tier', () => {
    const limits = getDefaultSubscriptionPlanLimits('users', null);

    expect(limits.users.maxPets).toBe(2);
    expect(limits.users.dottyEnabled).toBe(false);
    expect(limits.partners.maxBusinesses).toBe(1);
  });

  it('unlocks user limits based on tier while forcing starter partner limits for a users-only audience', () => {
    const limits = getDefaultSubscriptionPlanLimits('users', 'premium');

    expect(limits.users.maxPets).toBeNull();
    expect(limits.users.dottyEnabled).toBe(true);
    expect(limits.partners.maxBusinesses).toBe(1);
  });

  it('unlocks partner limits based on tier while forcing free user limits for a partners-only audience', () => {
    const limits = getDefaultSubscriptionPlanLimits('partners', 'pro');

    expect(limits.partners.maxBusinesses).toBeNull();
    expect(limits.users.maxPets).toBe(2);
  });

  it('unlocks both sides for an "all" audience plan', () => {
    const limits = getDefaultSubscriptionPlanLimits('all', 'growth');

    expect(limits.users.maxPets).toBe(5);
    expect(limits.partners.maxBusinesses).toBe(3);
  });
});

describe('resolveSubscriptionPlanLimits', () => {
  it('returns the free/starter defaults when given no row at all', () => {
    const limits = resolveSubscriptionPlanLimits(undefined);

    expect(limits.users.maxPets).toBe(2);
    expect(limits.partners.maxBusinesses).toBe(1);
  });

  it('unwraps a Supabase-style array row (single relation returned as [row])', () => {
    const limits = resolveSubscriptionPlanLimits([
      { tier: 'growth', audience_target: 'partners', limits: {} },
    ]);

    expect(limits.partners.maxBusinesses).toBe(3);
  });

  it('applies explicit overrides on top of the tier defaults', () => {
    const limits = resolveSubscriptionPlanLimits({
      tier: 'starter',
      audience_target: 'partners',
      limits: { partners: { max_businesses: 7 } },
    });

    // Override wins over the starter default of 1.
    expect(limits.partners.maxBusinesses).toBe(7);
    // Untouched fields still fall back to the starter defaults.
    expect(limits.partners.maxServices).toBe(5);
  });

  it('accepts the alternate "business"/"businesses" key names for partner overrides', () => {
    const limits = resolveSubscriptionPlanLimits({
      tier: 'starter',
      audience_target: 'partners',
      limits: { business: { max_businesses: 4 } },
    });

    expect(limits.partners.maxBusinesses).toBe(4);
  });

  it('treats an explicit null override as "not provided" and falls back to the tier default (?? does not distinguish null from missing)', () => {
    const limits = resolveSubscriptionPlanLimits({
      tier: 'starter',
      audience_target: 'partners',
      limits: { partners: { max_businesses: null } },
    });

    expect(limits.partners.maxBusinesses).toBe(1);
  });

  it('produces an actually unlimited (null) value only via the pro tier default, not via an override', () => {
    const limits = resolveSubscriptionPlanLimits({
      tier: 'pro',
      audience_target: 'partners',
      limits: {},
    });

    expect(limits.partners.maxBusinesses).toBeNull();
  });

  it('clamps negative override values to zero instead of allowing negative limits', () => {
    const limits = resolveSubscriptionPlanLimits({
      tier: 'starter',
      audience_target: 'partners',
      limits: { partners: { max_businesses: -5 } },
    });

    expect(limits.partners.maxBusinesses).toBe(0);
  });
});

describe('formatLimitValue', () => {
  it('renders null/undefined as unlimited', () => {
    expect(formatLimitValue(null)).toBe('Sin límite');
    expect(formatLimitValue(undefined)).toBe('Sin límite');
  });

  it('formats a numeric value with thousands separators and an optional unit', () => {
    expect(formatLimitValue(1000)).toBe('1.000');
    expect(formatLimitValue(5, 'mascotas')).toBe('5 mascotas');
  });
});
