export type PartnerPlanTier = 'starter' | 'growth' | 'pro';

export type PartnerModule = 'clients' | 'insights' | 'adoptions' | 'priority_support';

export type PartnerSubscriptionStatus =
  | 'pending'
  | 'trialing'
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'expired'
  | 'past_due';

export interface PartnerPlanDefinition {
  tier: PartnerPlanTier;
  name: string;
  subtitle: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  accent: string;
  surface: string;
  border: string;
  badgeText: string;
  features: string[];
  limitations: string[];
  moduleAccess: Record<PartnerModule, boolean>;
}

export interface PartnerPlanSummary {
  tier: PartnerPlanTier;
  name: string;
  subtitle: string;
  description: string;
  badgeText: string;
  accent: string;
  surface: string;
  border: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  features: string[];
  limitations: string[];
  moduleAccess: Record<PartnerModule, boolean>;
}

export const PARTNER_PLAN_ORDER: PartnerPlanTier[] = ['starter', 'growth', 'pro'];

const PARTNER_PLAN_DEFINITIONS: Record<PartnerPlanTier, PartnerPlanDefinition> = {
  starter: {
    tier: 'starter',
    name: 'Starter',
    subtitle: 'Operacion esencial',
    description: 'Para aliados que necesitan gestionar agenda, servicios, productos y cobros sin capas extra.',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'UYU',
    trialDays: 0,
    accent: '#2563EB',
    surface: '#EFF6FF',
    border: '#BFDBFE',
    badgeText: 'Base',
    features: [
      'Dashboard operativo',
      'Agenda y reservas',
      'Gestion de servicios y productos',
      'Pedidos y cobros con Mercado Pago',
      'Edicion basica del negocio',
    ],
    limitations: [
      'No incluye clientes avanzados',
      'No incluye inteligencia comercial',
      'No incluye adopciones',
      'No incluye soporte prioritario',
    ],
    moduleAccess: {
      clients: false,
      insights: false,
      adoptions: false,
      priority_support: false,
    },
  },
  growth: {
    tier: 'growth',
    name: 'Growth',
    subtitle: 'Crecimiento y control',
    description: 'Para aliados que ya quieren analizar clientes y tomar mejores decisiones comerciales.',
    priceMonthly: 1490,
    priceYearly: 14900,
    currency: 'UYU',
    trialDays: 7,
    accent: '#047857',
    surface: '#ECFDF5',
    border: '#A7F3D0',
    badgeText: 'Recomendado',
    features: [
      'Todo lo del plan Starter',
      'Historial y segmento de clientes',
      'Inteligencia de negocio basica',
      'Analiticas de demanda y actividad',
      'Mejor soporte operativo',
    ],
    limitations: [
      'No incluye modulo de adopciones',
      'No incluye soporte prioritario',
    ],
    moduleAccess: {
      clients: true,
      insights: true,
      adoptions: false,
      priority_support: false,
    },
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    subtitle: 'Operacion completa',
    description: 'Para aliados que necesitan analitica avanzada, adopciones y el paquete mas completo.',
    priceMonthly: 2990,
    priceYearly: 29900,
    currency: 'UYU',
    trialDays: 14,
    accent: '#7C3AED',
    surface: '#F5F3FF',
    border: '#DDD6FE',
    badgeText: 'Avanzado',
    features: [
      'Todo lo del plan Growth',
      'Gestion de contactos de adopcion',
      'Insights avanzados y localizacion',
      'Prioridad en soporte',
      'Configuracion comercial completa',
    ],
    limitations: [],
    moduleAccess: {
      clients: true,
      insights: true,
      adoptions: true,
      priority_support: true,
    },
  },
};

export const DEFAULT_PARTNER_PLAN_TIER: PartnerPlanTier = 'starter';

export const normalizePartnerPlanTier = (value?: string | null): PartnerPlanTier => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'starter' || normalized === 'growth' || normalized === 'pro') {
    return normalized;
  }

  return DEFAULT_PARTNER_PLAN_TIER;
};

export const getPartnerPlan = (value?: string | null): PartnerPlanSummary => {
  const tier = normalizePartnerPlanTier(value);
  const plan = PARTNER_PLAN_DEFINITIONS[tier];

  return {
    tier: plan.tier,
    name: plan.name,
    subtitle: plan.subtitle,
    description: plan.description,
    badgeText: plan.badgeText,
    accent: plan.accent,
    surface: plan.surface,
    border: plan.border,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    currency: plan.currency,
    trialDays: plan.trialDays,
    features: [...plan.features],
    limitations: [...plan.limitations],
    moduleAccess: { ...plan.moduleAccess },
  };
};

export const getPartnerPlanName = (value?: string | null) => getPartnerPlan(value).name;

export const getPartnerPlanBadgeText = (value?: string | null) => getPartnerPlan(value).badgeText;

export const getPartnerPlanDisplayPrice = (value?: string | null, cadence: 'monthly' | 'yearly' = 'monthly') => {
  const plan = getPartnerPlan(value);
  const amount = cadence === 'monthly' ? plan.priceMonthly : plan.priceYearly;

  return amount === 0 ? 'Gratis' : `${amount.toLocaleString('es-UY')} ${plan.currency}`;
};

const getTimestampOrNull = (value?: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

export const resolvePartnerPlanTier = (
  planTier?: string | null,
  subscriptionStatus?: string | null,
  expiresAt?: string | null,
) => {
  const tier = normalizePartnerPlanTier(planTier);
  const status = String(subscriptionStatus || '').toLowerCase();
  const expiresAtTimestamp = getTimestampOrNull(expiresAt);
  const now = Date.now();
  const hasFutureAccess = expiresAtTimestamp ? expiresAtTimestamp > now : false;

  if (!status) {
    return tier;
  }

  if (status === 'pending') {
    return DEFAULT_PARTNER_PLAN_TIER;
  }

  if (status === 'trialing' || status === 'active') {
    if (expiresAtTimestamp && expiresAtTimestamp <= now) {
      return DEFAULT_PARTNER_PLAN_TIER;
    }

    return tier;
  }

  if (status === 'paused' || status === 'cancelled' || status === 'expired' || status === 'past_due') {
    return hasFutureAccess ? tier : DEFAULT_PARTNER_PLAN_TIER;
  }

  return tier;
};

export const getPartnerSubscriptionStatusLabel = (
  subscriptionStatus?: string | null,
  expiresAt?: string | null,
) => {
  const status = String(subscriptionStatus || '').toLowerCase();
  const expiresAtTimestamp = getTimestampOrNull(expiresAt);
  const hasFutureAccess = expiresAtTimestamp ? expiresAtTimestamp > Date.now() : false;

  if (status === 'trialing') return 'Prueba activa';
  if (status === 'pending') return 'Pendiente';
  if (status === 'paused') return hasFutureAccess ? 'Pausada hasta vencimiento' : 'Pausada';
  if (status === 'cancelled') return hasFutureAccess ? 'Cancelada hasta vencimiento' : 'Cancelada';
  if (status === 'expired') return 'Vencida';
  if (status === 'past_due') return 'Pago pendiente';

  return 'Activa';
};

export const canAccessPartnerModule = (
  planTier?: string | null,
  module?: PartnerModule,
  businessType?: string,
  subscriptionStatus?: string | null,
  expiresAt?: string | null,
) => {
  if (!module) return true;

  const effectiveTier = resolvePartnerPlanTier(planTier, subscriptionStatus, expiresAt);
  const plan = getPartnerPlan(effectiveTier);

  if (module === 'adoptions') {
    return plan.moduleAccess.adoptions && businessType === 'shelter';
  }

  return plan.moduleAccess[module];
};

export const getPartnerUpgradeCopy = (module: PartnerModule) => {
  switch (module) {
    case 'clients':
      return 'El plan Growth desbloquea el modulo de clientes y el seguimiento de interacciones.';
    case 'insights':
      return 'El plan Growth o superior habilita la inteligencia de negocio para ver el rendimiento del negocio.';
    case 'adoptions':
      return 'El plan Pro desbloquea el modulo de adopciones y los contactos del refugio.';
    case 'priority_support':
      return 'El plan Pro incluye soporte prioritario para aliados con mayor volumen.';
    default:
      return 'Actualiza el plan para desbloquear mas funciones.';
  }
};

export const getPartnerLockedActionLabel = (module: PartnerModule) => {
  switch (module) {
    case 'clients':
      return 'Disponible en Growth';
    case 'insights':
      return 'Disponible en Growth';
    case 'adoptions':
      return 'Disponible en Pro';
    case 'priority_support':
      return 'Disponible en Pro';
    default:
      return 'Requiere upgrade';
  }
};
