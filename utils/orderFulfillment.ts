export type OrderFulfillmentMode = 'shipping' | 'pickup';

export const isStorePickupOrder = (shippingAddress?: string | null): boolean => {
  const normalizedAddress = (shippingAddress || '').trim().toLowerCase();

  if (!normalizedAddress) {
    return false;
  }

  return (
    normalizedAddress.startsWith('retiro en tienda') ||
    normalizedAddress.includes('retiro')
  );
};

export const getOrderFulfillmentMode = (
  orderType?: string,
  shippingAddress?: string | null
): OrderFulfillmentMode => {
  if (orderType === 'service_booking') {
    return 'shipping';
  }

  return isStorePickupOrder(shippingAddress) ? 'pickup' : 'shipping';
};

export const getOrderStatusLabel = (
  status: string,
  orderType?: string,
  shippingAddress?: string | null
): string => {
  const isPickup = isStorePickupOrder(shippingAddress);

  switch (status) {
    case 'pending':
      return orderType === 'service_booking' ? 'Pendiente de pago' : 'Pendiente';
    case 'reserved':
      return 'Reservado';
    case 'payment_failed':
      return 'Pago fallido';
    case 'confirmed':
      return 'Confirmado';
    case 'processing':
      return 'En proceso';
    case 'preparing':
      return 'Preparando';
    case 'ready_for_delivery':
      return isPickup ? 'Listo para retirar' : 'Listo para entrega';
    case 'shipped':
      return isPickup ? 'Listo para retirar' : 'En reparto';
    case 'delivered':
      return 'Entregado';
    case 'completed':
      return 'Completado';
    case 'cancelled':
      return 'Cancelado';
    case 'refunded':
      return 'Reembolsado';
    default:
      return 'Desconocido';
  }
};
