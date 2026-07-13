export type SubscriptionScope = 'user' | 'partner';

export type SubscriptionReturnStatus =
  | 'active'
  | 'trialing'
  | 'pending'
  | 'paused'
  | 'cancelled'
  | 'expired'
  | 'past_due'
  | 'unknown';

export type SubscriptionReturnSeverity = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface SubscriptionReturnCopy {
  title: string;
  message: string;
  status: SubscriptionReturnStatus;
  scope: SubscriptionScope;
  severity: SubscriptionReturnSeverity;
}

export interface SubscriptionReturnTone {
  backgroundColor: string;
  borderColor: string;
  accentColor: string;
  textColor: string;
  iconBackgroundColor: string;
}

const MOBILE_APP_SCHEME = 'dogcatify';

export const getSingleParam = (value?: string | string[] | null) =>
  Array.isArray(value) ? value[0] : value;

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const normalizeSubscriptionScope = (value?: string | string[] | null): SubscriptionScope => {
  const normalized = String(getSingleParam(value) || '').trim().toLowerCase();
  return normalized === 'partner' ? 'partner' : 'user';
};

export const normalizeSubscriptionStatus = (value?: string | string[] | null): SubscriptionReturnStatus => {
  const normalized = String(getSingleParam(value) || '').trim().toLowerCase();

  switch (normalized) {
    case 'authorized':
    case 'approved':
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'in_process':
    case 'pending':
    case 'pending_review':
      return 'pending';
    case 'paused':
      return 'paused';
    case 'cancelled':
    case 'canceled':
    case 'rejected':
      return 'cancelled';
    case 'expired':
      return 'expired';
    case 'past_due':
      return 'past_due';
    default:
      return 'unknown';
  }
};

export const getSubscriptionReturnTone = (status?: string | string[] | null): SubscriptionReturnTone => {
  const normalizedStatus = normalizeSubscriptionStatus(status);

  switch (normalizedStatus) {
    case 'active':
      return {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        accentColor: '#047857',
        textColor: '#065F46',
        iconBackgroundColor: '#D1FAE5',
      };
    case 'trialing':
      return {
        backgroundColor: '#ECFEFF',
        borderColor: '#A5F3FC',
        accentColor: '#0F766E',
        textColor: '#115E59',
        iconBackgroundColor: '#CFFAFE',
      };
    case 'pending':
      return {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        accentColor: '#B45309',
        textColor: '#92400E',
        iconBackgroundColor: '#FEF3C7',
      };
    case 'paused':
      return {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        accentColor: '#475569',
        textColor: '#334155',
        iconBackgroundColor: '#E2E8F0',
      };
    case 'cancelled':
    case 'expired':
    case 'past_due':
      return {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        accentColor: '#B91C1C',
        textColor: '#7F1D1D',
        iconBackgroundColor: '#FEE2E2',
      };
    default:
      return {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        accentColor: '#334155',
        textColor: '#475569',
        iconBackgroundColor: '#E2E8F0',
      };
  }
};

export const getSubscriptionReturnCopy = (
  status?: string | string[] | null,
  scope?: string | string[] | null,
  customMessage?: string | string[] | null,
): SubscriptionReturnCopy => {
  const normalizedScope = normalizeSubscriptionScope(scope);
  const normalizedStatus = normalizeSubscriptionStatus(status);
  const providedMessage = String(getSingleParam(customMessage) || '').trim();
  const subject = normalizedScope === 'partner' ? 'tu suscripcion de aliado' : 'tu suscripcion';
  const titleSubject = normalizedScope === 'partner' ? 'Aliado' : 'Suscripcion';

  const titles: Record<SubscriptionReturnStatus, string> = {
    active: `${titleSubject} activa`,
    trialing: `${titleSubject} en prueba`,
    pending: `${titleSubject} pendiente`,
    paused: `${titleSubject} pausada`,
    cancelled: `${titleSubject} cancelada`,
    expired: `${titleSubject} vencida`,
    past_due: `${titleSubject} con pago pendiente`,
    unknown: `${titleSubject} actualizada`,
  };

  const defaultMessages: Record<SubscriptionReturnStatus, string> = {
    active: `Tu suscripcion${normalizedScope === 'partner' ? ' de aliado' : ''} quedo activa correctamente.`,
    trialing: `Tu suscripcion${normalizedScope === 'partner' ? ' de aliado' : ''} quedo en periodo de prueba.`,
    pending: `Tu suscripcion${normalizedScope === 'partner' ? ' de aliado' : ''} quedo pendiente de confirmacion en Mercado Pago.`,
    paused: `Tu suscripcion${normalizedScope === 'partner' ? ' de aliado' : ''} quedo pausada.`,
    cancelled: `Tu suscripcion${normalizedScope === 'partner' ? ' de aliado' : ''} quedo cancelada.`,
    expired: `Tu suscripcion${normalizedScope === 'partner' ? ' de aliado' : ''} vencio. Debes renovarla para seguir usando el plan.`,
    past_due: `Tu suscripcion${normalizedScope === 'partner' ? ' de aliado' : ''} tiene un pago pendiente.`,
    unknown: `Estamos confirmando el estado de ${subject}.`,
  };

  const severity: SubscriptionReturnSeverity = (() => {
    switch (normalizedStatus) {
      case 'active':
        return 'success';
      case 'trialing':
        return 'info';
      case 'pending':
        return 'warning';
      case 'paused':
        return 'neutral';
      case 'cancelled':
      case 'expired':
      case 'past_due':
        return 'danger';
      default:
        return 'neutral';
    }
  })();

  return {
    title: titles[normalizedStatus],
    message: providedMessage || defaultMessages[normalizedStatus],
    status: normalizedStatus,
    scope: normalizedScope,
    severity,
  };
};

export const buildSubscriptionDeepLink = (
  params: Record<string, string | string[] | undefined>,
  fallbackTarget?: string,
) => {
  const scope = normalizeSubscriptionScope(
    params.scope ?? params.subscription_scope ?? params.account_scope,
  );
  const target = getSingleParam(params.target);
  const resolvedTarget = target?.startsWith(`${MOBILE_APP_SCHEME}://`)
    ? target
    : fallbackTarget || (scope === 'partner'
      ? `${MOBILE_APP_SCHEME}://partner/subscription`
      : `${MOBILE_APP_SCHEME}://profile/subscription`);

  const url = new URL(resolvedTarget);

  Object.entries(params).forEach(([key, value]) => {
    if (key === 'target') return;

    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      const cleanValue = typeof item === 'string' ? item.trim() : '';
      if (!cleanValue) return;

      if (key === 'business_id') {
        url.searchParams.set('businessId', cleanValue);
        return;
      }

      url.searchParams.set(key, cleanValue);
    });
  });

  const externalReference = getSingleParam(params.external_reference);
  if (!url.searchParams.get('subscription_id') && externalReference && isUuid(externalReference)) {
    url.searchParams.set('subscription_id', externalReference);
  }

  if (!url.searchParams.get('subscription_scope')) {
    url.searchParams.set('subscription_scope', scope);
  }

  return url.toString();
};
