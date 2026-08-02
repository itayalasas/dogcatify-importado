import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isServiceBookingOrder, resolveOrderType } from '../utils/orderClassification';
import { getOrderFulfillmentMode, getOrderStatusLabel, isStorePickupOrder } from '../utils/orderFulfillment';

describe('reglas de pedidos', () => {
  it('reconoce una reserva por su tipo o por señales de servicio', () => {
    assert.equal(resolveOrderType({ order_type: 'booking' }), 'service_booking');
    assert.equal(resolveOrderType({ booking_id: 'booking-1' }), 'service_booking');
    assert.equal(isServiceBookingOrder({ items: [{ type: 'service' }] }), true);
  });

  it('clasifica como compra de producto cuando no hay señales de servicio', () => {
    assert.equal(resolveOrderType({ items: [{ type: 'product' }] }), 'product_purchase');
  });

  it('detecta retiro en tienda sin depender de mayúsculas', () => {
    assert.equal(isStorePickupOrder(' Retiro en tienda - Local Centro '), true);
    assert.equal(isStorePickupOrder('Av. Italia 1234'), false);
  });

  it('mantiene las reservas de servicio fuera del flujo de retiro', () => {
    assert.equal(getOrderFulfillmentMode('service_booking', 'Retiro en tienda'), 'shipping');
  });

  it('adapta las etiquetas al modo de entrega', () => {
    assert.equal(getOrderStatusLabel('shipped', 'product_purchase', 'Retiro en tienda'), 'Listo para retirar');
    assert.equal(getOrderStatusLabel('delivered', 'product_purchase', 'Av. Italia 1234'), 'Entregado');
  });
});
