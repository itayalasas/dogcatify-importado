import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send, Phone, Heart } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { supabaseClient } from '../../lib/supabase';
import { envConfig } from '../../utils/envConfig';
import { IconButton } from '../../components/ui';
import { colors, radius, spacing, typography, touchTarget } from '../../constants/theme';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Date;
  isFromCustomer: boolean;
}

export default function AdoptionChat() {
  const { petId, petName, partnerId, partnerName } = useLocalSearchParams<{
    petId: string;
    petName: string;
    partnerId: string;
    partnerName: string;
  }>();
  
  const { currentUser } = useAuth();
  const { sendNotificationToUser } = useNotifications();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && petId && partnerId) {
      initializeChat();
    }
  }, [currentUser, petId, partnerId]);

  const initializeChat = async () => {
    try {
      // Create or get existing chat
      const chatIdentifier = `adoption_${petId}_${currentUser!.id}`;
      
      // Check if chat already exists
      const { data: existingChat, error: chatError } = await supabaseClient
        .from('adoption_chats')
        .select('*')
        .eq('pet_id', petId)
        .eq('customer_id', currentUser!.id)
        .single();

      let currentChatId;
      
      if (chatError && chatError.code === 'PGRST116') {
        // Chat doesn't exist, create new one
        const { data: newChat, error: createError } = await supabaseClient
          .from('adoption_chats')
          .insert({
            pet_id: petId,
            partner_id: partnerId,
            customer_id: currentUser!.id,
            pet_name: petName,
            partner_name: partnerName,
            customer_name: currentUser!.displayName || 'Usuario',
            status: 'active',
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createError) throw createError;
        currentChatId = newChat.id;
        
        // Send initial message
        await sendInitialMessage(currentChatId);
      } else if (existingChat) {
        currentChatId = existingChat.id;
      }
      
      setChatId(currentChatId);
      fetchMessages(currentChatId);
      
      // Set up real-time subscription
      const subscription = supabaseClient
        .channel(`chat_${currentChatId}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'adoption_messages',
            filter: `chat_id=eq.${currentChatId}`
          }, 
          (payload) => {
            const newMessage = payload.new as any;
            setMessages(prev => [...prev, {
              id: newMessage.id,
              senderId: newMessage.sender_id,
              senderName: newMessage.sender_name,
              message: newMessage.message,
              timestamp: new Date(newMessage.created_at),
              isFromCustomer: newMessage.sender_id === currentUser!.id
            }]);
          }
        )
        .subscribe();
      
      return () => {
        subscription.unsubscribe();
      };
      
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'No se pudo inicializar el chat');
    }
  };

  const sendInitialMessage = async (chatId: string) => {
    const initialMessage = `¡Hola! Estoy interesado/a en adoptar a ${petName}. ¿Podrían darme más información sobre el proceso de adopción?`;
    
    await sendMessage(initialMessage, chatId);
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('adoption_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      const messagesData = data?.map(msg => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        message: msg.message,
        timestamp: new Date(msg.created_at),
        isFromCustomer: msg.sender_id === currentUser!.id
      })) || [];
      
      setMessages(messagesData);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (messageText?: string, targetChatId?: string) => {
    const textToSend = messageText || newMessage.trim();
    const chatToUse = targetChatId || chatId;
    
    if (!textToSend || !chatToUse) return;

    setLoading(true);
    try {
      const { error } = await supabaseClient
        .from('adoption_messages')
        .insert({
          chat_id: chatToUse,
          sender_id: currentUser!.id,
          sender_name: currentUser!.displayName || 'Usuario',
          message: textToSend,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      if (!messageText) {
        setNewMessage('');
      }
      
      // Send push notification to partner using FCM v1
      try {
        const { data: partnerData } = await supabaseClient
          .from('partners')
          .select('user_id')
          .eq('id', partnerId)
          .single();

        if (partnerData?.user_id) {
          {
            // Token resolution now happens server-side via targetUserId — the
            // client no longer reads the partner's push_token/fcm_token.
            const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
            const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-fcm-v1`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY')}`,
              },
              body: JSON.stringify({
                targetUserId: partnerData.user_id,
                title: `Nuevo mensaje sobre ${petName}`,
                body: `${currentUser!.displayName}: ${textToSend.substring(0, 100)}`,
                data: {
                  type: 'adoption_message',
                  chatId: chatToUse,
                  petId,
                  petName,
                  screen: 'AdoptionChat',
                  url: `dogcatify://chat/adoption?petId=${petId}&petName=${petName}&partnerId=${partnerId}&partnerName=${partnerName}`
                }
              }),
            });

            if (!response.ok) {
              console.error('Error sending FCM notification:', await response.text());
            } else {
              console.log('✅ Notification sent via FCM v1');
            }
          }
        }
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    } finally {
      setLoading(false);
    }
  };

  const handleContactShelter = async () => {
    try {
      const { data: partnerData } = await supabaseClient
        .from('partners')
        .select('phone, email')
        .eq('id', partnerId)
        .single();
      
      if (partnerData?.phone) {
        const phoneUrl = `tel:${partnerData.phone}`;
        if (await Linking.canOpenURL(phoneUrl)) {
          await Linking.openURL(phoneUrl);
        }
      } else {
        Alert.alert('Contacto', 'No hay número de teléfono disponible');
      }
    } catch (error) {
      console.error('Error contacting shelter:', error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <IconButton
            icon={<ArrowLeft size={24} color={colors.text} />}
            onPress={() => router.back()}
            accessibilityLabel="Volver"
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">{partnerName}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>Sobre la adopción de {petName}</Text>
          </View>
          <IconButton
            icon={<Phone size={20} color={colors.primary} />}
            onPress={handleContactShelter}
            variant="tonal"
            accessibilityLabel={`Llamar a ${partnerName || 'el refugio'}`}
          />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageContainer,
                message.isFromCustomer ? styles.myMessage : styles.theirMessage
              ]}
            >
              <View style={[
                styles.messageBubble,
                message.isFromCustomer ? styles.myMessageBubble : styles.theirMessageBubble
              ]}>
                {!message.isFromCustomer && (
                  <Text style={styles.senderName}>{message.senderName}</Text>
                )}
                <Text style={[
                  styles.messageText,
                  message.isFromCustomer ? styles.myMessageText : styles.theirMessageText
                ]}>
                  {message.message}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.isFromCustomer ? styles.myMessageTime : styles.theirMessageTime
                ]}>
                  {formatTime(message.timestamp)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Escribí tu mensaje..."
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Mensaje"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={() => sendMessage()}
            disabled={!newMessage.trim() || loading}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            accessibilityState={{ disabled: !newMessage.trim() || loading }}
            hitSlop={2}
          >
            <Send size={20} color={newMessage.trim() ? colors.onPrimary : colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  phoneButton: {
    padding: spacing.sm,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.lg,
  },
  messageContainer: {
    marginVertical: spacing.xs,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  theirMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  myMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  senderName: {
    ...typography.captionStrong,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  messageText: {
    ...typography.bodySmall,
    lineHeight: 20,
  },
  myMessageText: {
    color: colors.surface,
  },
  theirMessageText: {
    color: colors.text,
  },
  messageTime: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: spacing.xs,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  theirMessageTime: {
    color: colors.textTertiary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'android' ? 16 : 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    maxHeight: 100,
    ...typography.bodySmall,
    color: colors.text,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    width: touchTarget - 4,
    height: touchTarget - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
});
