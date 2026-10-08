import { router } from 'expo-router';
import { supabaseClient } from '../lib/supabase';

// Debe coincidir con public.is_order_chat_open() en la base de datos.
export const ORDER_CHAT_OPEN_STATUSES = ['confirmed', 'preparing', 'processing', 'ready_for_delivery', 'shipped'];

// Antes de la confirmación el chat todavía no existe, pero conviene avisar que se habilitará.
export const ORDER_CHAT_UPCOMING_STATUSES = ['pending', 'reserved'];

export const isOrderChatOpen = (status?: string | null) =>
  !!status && ORDER_CHAT_OPEN_STATUSES.includes(status);

export type OpenOrderChatResult = { ok: true } | { ok: false; reason: 'closed' | 'error' };

/** Abre (o crea) la conversación del pedido entre el cliente y el local. */
export async function openOrderChat(orderId: string, orderNumber?: string | null): Promise<OpenOrderChatResult> {
  const { data, error } = await supabaseClient.rpc('get_or_create_order_chat', { p_order_id: orderId });

  if (error || !data) {
    return { ok: false, reason: error?.message?.includes('order_chat_closed') ? 'closed' : 'error' };
  }

  router.push({
    pathname: '/chat/[id]',
    params: { id: String(data), ...(orderNumber ? { orderNumber } : {}) },
  });
  return { ok: true };
}
