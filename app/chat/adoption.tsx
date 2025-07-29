import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send, Phone, Heart } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { supabaseClient } from '../../lib/supabase';

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
      
      // Send push notification to partner
      try {
        const { data: partnerData } = await supabaseClient
          .from('partners')
          .select('user_id')
          .eq('id', partnerId)
          .single();
        
        if (partnerData?.user_id) {
          await sendNotificationToUser(
            partnerData.user_id,
            `Nuevo mensaje de adopción - ${petName}`,
            `${currentUser!.displayName}: ${textToSend}`,
            {
              type: 'adoption_message',
              chatId: chatToUse,
              petId,
              petName,
              deepLink: `chat/partner-adoption/${chatToUse}`
            }
          );
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Adopción - {petName}</Text>
          <Text style={styles.headerSubtitle}>{partnerName}</Text>
        </View>
        <TouchableOpacity onPress={handleContactShelter} style={styles.phoneButton}>
          <Phone size={20} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
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
            placeholder="Escribe tu mensaje..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={() => sendMessage()}
            disabled={!newMessage.trim() || loading}
          >
            <Send size={20} color={newMessage.trim() ? "#FFFFFF" : "#9CA3AF"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  phoneButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 4,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  theirMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  senderName: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirMessageTime: {
    color: '#9CA3AF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
});