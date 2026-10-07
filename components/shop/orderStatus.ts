import type { BadgeTone } from '../ui/Badge';

/** Tono del Badge según el estado del pedido (solo visual, no cambia la lógica de estados). */
export const getOrderStatusTone = (status: string): BadgeTone => {
  switch (status) {
    case 'pending':
    case 'reserved':
      return 'warning';
    case 'payment_failed':
    case 'insufficient_stock':
    case 'cancelled':
      return 'danger';
    case 'confirmed':
    case 'processing':
    case 'preparing':
    case 'ready_for_delivery':
      return 'primary';
    case 'shipped':
      return 'info';
    case 'completed':
    case 'delivered':
      return 'success';
    default:
      return 'neutral';
  }
};
