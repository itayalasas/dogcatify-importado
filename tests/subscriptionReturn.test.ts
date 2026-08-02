import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSubscriptionDeepLink,
  getSubscriptionReturnCopy,
  isUuid,
  normalizeSubscriptionScope,
  normalizeSubscriptionStatus,
} from '../utils/subscriptionReturn';

describe('retorno de suscripciones', () => {
  it('normaliza estados equivalentes de Mercado Pago', () => {
    assert.equal(normalizeSubscriptionStatus('approved'), 'active');
    assert.equal(normalizeSubscriptionStatus('in_process'), 'pending');
    assert.equal(normalizeSubscriptionStatus('rejected'), 'cancelled');
  });

  it('sólo acepta partner como alcance alternativo', () => {
    assert.equal(normalizeSubscriptionScope('partner'), 'partner');
    assert.equal(normalizeSubscriptionScope('admin'), 'user');
  });

  it('genera mensajes y severidad consistentes', () => {
    const result = getSubscriptionReturnCopy('past_due', 'partner');

    assert.equal(result.status, 'past_due');
    assert.equal(result.scope, 'partner');
    assert.equal(result.severity, 'danger');
  });

  it('valida identificadores UUID', () => {
    assert.equal(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301'), true);
    assert.equal(isUuid('order-123'), false);
  });

  it('construye deep links internos sin aceptar un target externo', () => {
    const link = buildSubscriptionDeepLink({
      scope: 'partner',
      status: 'approved',
      target: 'https://sitio-malicioso.example',
      business_id: 'business-1',
    });

    assert.equal(link.startsWith('dogcatify://partner/subscription?'), true);
    assert.equal(link.includes('businessId=business-1'), true);
    assert.equal(link.includes('sitio-malicioso'), false);
  });
});
