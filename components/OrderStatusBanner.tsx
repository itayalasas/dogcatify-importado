import React, { useMemo, useState } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  Truck,
  X as CloseIcon,
} from 'lucide-react-native';
import { Card } from './ui/Card';

type BannerSeverity = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

type OrderStatusBannerParams = {
  notification_title?: string | string[];
  notification_body?: string | string[];
  notification_status?: string | string[];
  notification_fulfillment_mode?: string | string[];
  notification_order_number?: string | string[];
  notification_recipient_role?: string | string[];
};

type OrderStatusBannerProps = {
  style?: StyleProp<ViewStyle>;
};

const getSingleParam = (value?: string | string[] | null) =>
  Array.isArray(value) ? value[0] : value;

const normalizeText = (value?: string | string[] | null) =>
  String(getSingleParam(value) || '').trim();

const normalizeStatus = (value?: string | string[] | null) => {
  const normalized = normalizeText(value).toLowerCase();

  switch (normalized) {
    case 'authorized':
    case 'approved':
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'pending':
    case 'reserved':
    case 'payment_pending':
    case 'payment_failed':
      return normalized;
    case 'confirmed':
    case 'processing':
    case 'preparing':
    case 'ready_for_delivery':
    case 'shipped':
    case 'delivered':
    case 'completed':
    case 'cancelled':
    case 'canceled':
    case 'refunded':
      return normalized === 'canceled' ? 'cancelled' : normalized;
    default:
      return 'unknown';
  }
};

const getSeverity = (status: string): BannerSeverity => {
  switch (status) {
    case 'active':
    case 'confirmed':
    case 'processing':
    case 'preparing':
    case 'ready_for_delivery':
    case 'shipped':
    case 'delivered':
    case 'completed':
      return 'success';
    case 'trialing':
      return 'info';
    case 'pending':
    case 'reserved':
      return 'warning';
    case 'payment_failed':
    case 'cancelled':
    case 'refunded':
      return 'danger';
    default:
      return 'neutral';
  }
};

const getTone = (severity: BannerSeverity) => {
  switch (severity) {
    case 'success':
      return {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        accentColor: '#047857',
        textColor: '#065F46',
        iconBackgroundColor: '#D1FAE5',
      };
    case 'info':
      return {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
        accentColor: '#1D4ED8',
        textColor: '#1E3A8A',
        iconBackgroundColor: '#DBEAFE',
      };
    case 'warning':
      return {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        accentColor: '#B45309',
        textColor: '#92400E',
        iconBackgroundColor: '#FEF3C7',
      };
    case 'danger':
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

const getIcon = (status: string, fulfillmentMode: string) => {
  switch (status) {
    case 'payment_failed':
    case 'cancelled':
    case 'refunded':
      return AlertCircle;
    case 'delivered':
    case 'completed':
      return CheckCircle;
    case 'ready_for_delivery':
      return fulfillmentMode === 'pickup' ? Package : CheckCircle;
    case 'shipped':
      return fulfillmentMode === 'pickup' ? Package : Truck;
    case 'processing':
    case 'preparing':
    case 'confirmed':
      return Package;
    default:
      return Clock;
  }
};

const getDefaultTitle = (status: string, fulfillmentMode: string, recipientRole: string) => {
  if (status === 'ready_for_delivery') {
    return fulfillmentMode === 'pickup'
      ? recipientRole === 'partner'
        ? 'Pedido listo para retirar'
        : 'Listo para retirar'
      : 'Pedido listo para entrega';
  }

  if (status === 'delivered' && fulfillmentMode === 'pickup') {
    return recipientRole === 'partner' ? 'Pedido retirado' : 'Retiro confirmado';
  }

  const titles: Record<string, string> = {
    active: 'Pedido actualizado',
    trialing: 'Pedido actualizado',
    pending: 'Pedido pendiente',
    reserved: 'Pedido reservado',
    payment_failed: 'Pago fallido',
    confirmed: 'Pedido confirmado',
    processing: 'Pedido en proceso',
    preparing: 'Pedido en preparacion',
    shipped: fulfillmentMode === 'pickup' ? 'Pedido actualizado' : 'En reparto',
    delivered: fulfillmentMode === 'pickup' ? 'Pedido retirado' : 'Pedido entregado',
    completed: 'Pedido completado',
    cancelled: 'Pedido cancelado',
    refunded: 'Pedido reembolsado',
    unknown: 'Pedido actualizado',
  };

  return titles[status] || 'Pedido actualizado';
};

const getDefaultBody = (status: string, fulfillmentMode: string, recipientRole: string, orderNumber: string) => {
  const orderLabel = orderNumber ? `pedido ${orderNumber}` : 'pedido';

  switch (status) {
    case 'ready_for_delivery':
      return fulfillmentMode === 'pickup'
        ? recipientRole === 'partner'
          ? `El ${orderLabel} ya puede ser retirado en tienda.`
          : `Tu ${orderLabel} ya esta listo para retirar en tienda.`
        : `Tu ${orderLabel} ya esta listo para salir a entrega.`;
    case 'delivered':
      return fulfillmentMode === 'pickup'
        ? recipientRole === 'partner'
          ? `El cliente confirmo que retiro el ${orderLabel} en tienda.`
          : `Confirmamos que retiraste tu ${orderLabel} en tienda.`
        : `Tu ${orderLabel} fue entregado.`;
    case 'confirmed':
      return `Tu ${orderLabel} fue confirmado.`;
    case 'processing':
      return `Estamos procesando tu ${orderLabel}.`;
    case 'preparing':
      return `Estamos preparando tu ${orderLabel}.`;
    case 'shipped':
      return fulfillmentMode === 'pickup'
        ? `Tu ${orderLabel} cambio de estado.`
        : `Tu ${orderLabel} esta en camino.`;
    case 'payment_failed':
      return `No pudimos confirmar el pago de tu ${orderLabel}.`;
    case 'cancelled':
      return `Tu ${orderLabel} fue cancelado.`;
    case 'refunded':
      return `Tu ${orderLabel} fue reembolsado.`;
    default:
      return `Estamos actualizando el estado de tu ${orderLabel}.`;
  }
};

export const OrderStatusBanner: React.FC<OrderStatusBannerProps> = ({ style }) => {
  const params = useLocalSearchParams<OrderStatusBannerParams>();
  const [visible, setVisible] = useState(true);

  const title = normalizeText(params.notification_title);
  const body = normalizeText(params.notification_body);
  const rawStatus = normalizeText(params.notification_status);
  const fulfillmentMode = normalizeText(params.notification_fulfillment_mode).toLowerCase() || 'shipping';
  const orderNumber = normalizeText(params.notification_order_number);
  const recipientRole = normalizeText(params.notification_recipient_role).toLowerCase() || 'customer';
  const status = normalizeStatus(rawStatus);
  const severity = getSeverity(status);
  const tone = getTone(severity);
  const Icon = getIcon(status, fulfillmentMode);

  const resolvedTitle = title || getDefaultTitle(status, fulfillmentMode, recipientRole);
  const resolvedBody = body || getDefaultBody(status, fulfillmentMode, recipientRole, orderNumber);
  const shouldRender = visible && Boolean(title || body || rawStatus || orderNumber);

  const orderLabel = useMemo(() => {
    if (!orderNumber) return null;
    return `Pedido ${orderNumber}`;
  }, [orderNumber]);

  if (!shouldRender) {
    return null;
  }

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: tone.backgroundColor,
          borderColor: tone.borderColor,
        },
        style,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: tone.iconBackgroundColor }]}>
          <Icon size={18} color={tone.accentColor} />
        </View>

        <View style={styles.content}>
          {orderLabel ? <Text style={[styles.orderLabel, { color: tone.textColor }]}>{orderLabel}</Text> : null}
          <Text style={[styles.title, { color: tone.accentColor }]}>{resolvedTitle}</Text>
          <Text style={[styles.message, { color: tone.textColor }]}>{resolvedBody}</Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Cerrar notificacion"
          onPress={() => setVisible(false)}
          style={styles.closeButton}
        >
          <CloseIcon size={16} color={tone.textColor} />
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  orderLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  message: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    lineHeight: 19,
  },
  closeButton: {
    paddingLeft: 12,
    paddingTop: 2,
  },
});
