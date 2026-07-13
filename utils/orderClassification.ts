export type OrderLike = {
  orderType?: string | null;
  order_type?: string | null;
  booking_id?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  items?: any[] | null;
};

const normalizeValue = (value?: string | null) => String(value || '').trim().toLowerCase();

export const resolveOrderType = (order: OrderLike) => {
  const rawType = normalizeValue(order?.orderType || order?.order_type);

  if (rawType === 'service_booking' || rawType === 'booking') {
    return 'service_booking';
  }

  const hasServiceSignals =
    Boolean(order?.booking_id) ||
    Boolean(order?.service_id) ||
    Boolean(order?.service_name) ||
    Boolean(order?.appointment_date) ||
    Boolean(order?.appointment_time) ||
    (Array.isArray(order?.items) && order.items.some((item: any) =>
      item?.type === 'service' ||
      Boolean(item?.service_name) ||
      Boolean(item?.booking_id)
    ));

  return hasServiceSignals ? 'service_booking' : (rawType || 'product_purchase');
};

export const isServiceBookingOrder = (order: OrderLike) => resolveOrderType(order) === 'service_booking';
