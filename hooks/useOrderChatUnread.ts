import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabaseClient } from '../lib/supabase';

const REFRESH_MS = 20000;

export type OrderChatUnread = {
  /** Mensajes sin leer por pedido (order_id → cantidad). */
  byOrder: Record<string, number>;
  /** Conversación de cada pedido con chat (order_id → conversation_id). */
  conversationByOrder: Record<string, string>;
  total: number;
};

const EMPTY: OrderChatUnread = { byOrder: {}, conversationByOrder: {}, total: 0 };

/**
 * Mensajes de clientes sin leer en los chats de pedidos de un negocio.
 * Se actualiza al entrar a la pantalla y cada 20 segundos mientras está visible.
 */
export function useOrderChatUnread(partnerId?: string | null, userId?: string | null) {
  const [unread, setUnread] = useState<OrderChatUnread>(EMPTY);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!partnerId || !userId) return;

    const { data: conversations, error } = await supabaseClient
      .from('chat_conversations')
      .select('id, order_id')
      .eq('partner_id', partnerId)
      .not('order_id', 'is', null);

    if (error || !conversations || conversations.length === 0) {
      if (mountedRef.current) setUnread(EMPTY);
      return;
    }

    const orderByConversation: Record<string, string> = {};
    const conversationByOrder: Record<string, string> = {};
    conversations.forEach((conversation: any) => {
      orderByConversation[conversation.id] = conversation.order_id;
      conversationByOrder[conversation.order_id] = conversation.id;
    });

    const { data: messages } = await supabaseClient
      .from('chat_messages')
      .select('conversation_id')
      .in('conversation_id', Object.keys(orderByConversation))
      .eq('is_read', false)
      .neq('sender_id', userId);

    const byOrder: Record<string, number> = {};
    (messages || []).forEach((message: any) => {
      const orderId = orderByConversation[message.conversation_id];
      if (orderId) byOrder[orderId] = (byOrder[orderId] || 0) + 1;
    });

    if (mountedRef.current) {
      setUnread({
        byOrder,
        conversationByOrder,
        total: Object.values(byOrder).reduce((sum, count) => sum + count, 0),
      });
    }
  }, [partnerId, userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const interval = setInterval(refresh, REFRESH_MS);
      return () => clearInterval(interval);
    }, [refresh])
  );

  return { ...unread, refresh };
}
