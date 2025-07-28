import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send, Phone, MoveVertical as MoreVertical } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';

export default function ChatScreen() {
  const { id, petName } = useLocalSearchParams<{ id: string; petName?: string }>();
  const { currentUser } = useAuth();
  const { sendNotificationToUser } = useNotifications();
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherParticipant, setOtherParticipant] = useState<any>(null);
  const [adoptionPet, setAdoptionPet] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchConversationData();
    
    // Set up real-time subscription for new messages
    const subscription = supabaseClient
      .channel(`chat-${id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `conversation_id=eq.${id}`
        }, 
        (payload) => {
          console.log('New message received:', payload);
          const newMessage = payload.new;
          setMessages(prev => [...prev, {
            ...newMessage,
            created_at: new Date(newMessage.created_at)
          }]);
          
          // Mark message as read if it's not from current user
          if (newMessage.sender_id !== currentUser?.id) {
            markMessageAsRead(newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id, currentUser]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const fetchConversationData = async () => {
    try {
      // Fetch conversation details
      const { data: conversationData, error: convError } = await supabaseClient
        .from('chat_conversations')
        .select(`
          *,
          adoption_pets(*),
          partners(business_name, logo, phone)
        `)
        .eq('id', id)
        .single();

      if (convError) throw convError;

      setConversation(conversationData);
      setAdoptionPet(conversationData.adoption_pets);

      // Determine other participant
      const isUserCustomer = conversationData.user_id === currentUser?.id;
      
      if (isUserCustomer) {
        // Current user is the customer, other participant is the shelter
        setOtherParticipant({
          id: conversationData.partner_id,
          name: conversationData.partners.business_name,
          avatar: conversationData.partners.logo,
          phone: conversationData.partners.phone,
          type: 'shelter'
        });
      } else {
        // Current user is the shelter, other participant is the customer
        const { data: customerData, error: customerError } = await supabaseClient
          .from('profiles')
          .select('id, display_name, photo_url, phone')
          .eq('id', conversationData.user_id)
          .single();

        if (customerError) throw customerError;

        setOtherParticipant({
          id: customerData.id,
          name: customerData.display_name || 'Usuario',
          avatar: customerData.photo_url,
          phone: customerData.phone,
          type: 'customer'
        });
      }

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabaseClient
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      const formattedMessages = messagesData.map(msg => ({
        ...msg,
        created_at: new Date(msg.created_at)
      }));

      setMessages(formattedMessages);

      // Mark unread messages as read
      const unreadMessages = formattedMessages.filter(
        msg => !msg.is_read && msg.sender_id !== currentUser?.id
      );

      if (unreadMessages.length > 0) {
        await supabaseClient
          .from('chat_messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(msg => msg.id));
      }

    } catch (error) {
      console.error('Error fetching conversation data:', error);
      Alert.alert('Error', 'No se pudo cargar la conversación');
    } finally {
      setLoading(false);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabaseClient
        .from('chat_messages')
        .update({ is_read: true })
        .eq('id', messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !currentUser) return;

    setSending(true);
    try {
      const messageData = {
        conversation_id: id,
        sender_id: currentUser.id,
        message: newMessage.trim(),
        message_type: 'text',
        is_read: false
      };

      const { error } = await supabaseClient
        .from('chat_messages')
        .insert(messageData);

      if (error) throw error;

      // Send push notification to other participant
      if (otherParticipant) {
        const notificationTitle = `Nuevo mensaje de ${currentUser.displayName || 'Usuario'}`;
        const notificationBody = newMessage.trim();
        const notificationData = {
          type: 'chat_message',
          conversationId: id,
          petName: adoptionPet?.name,
          deepLink: `chat/${id}`
        };

        await sendNotificationToUser(
          otherParticipant.id,
          notificationTitle,
          notificationBody,
          notificationData
        );
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleCall = async () => {
    if (!otherParticipant?.phone) {
      Alert.alert('Error', 'No hay número de teléfono disponible');
      return;
    }

    try {
      const phoneUrl = `tel:${otherParticipant.phone}`;
      const canOpen = await Linking.canOpenURL(phoneUrl);
      
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'No se puede abrir la aplicación de llamadas');
      }
    } catch (error) {
      console.error('Error opening phone app:', error);
      Alert.alert('Error', 'No se pudo realizar la llamada');
    }
  };

  const formatMessageTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessage = (message: any) => {
    const isOwnMessage = message.sender_id === currentUser?.id;
    
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage
        ]}
      >
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {message.message}
          </Text>
          <Text style={[
            styles.messageTime,
            isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {formatMessageTime(message.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando conversación...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          {otherParticipant?.avatar ? (
            <Image source={{ uri: otherParticipant.avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarText}>
                {otherParticipant?.type === 'shelter' ? '🐾' : '👤'}
              </Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.headerName}>
              {otherParticipant?.name || 'Usuario'}
            </Text>
            <Text style={styles.headerSubtitle}>
              Adopción de {adoptionPet?.name || petName || 'mascota'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {otherParticipant?.phone && (
            <TouchableOpacity onPress={handleCall} style={styles.headerAction}>
              <Phone size={20} color="#3B82F6" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerAction}>
            <MoreVertical size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Pet Info Banner */}
      {adoptionPet && (
        <View style={styles.petBanner}>
          {adoptionPet.images && adoptionPet.images.length > 0 ? (
            <Image source={{ uri: adoptionPet.images[0] }} style={styles.petBannerImage} />
          ) : (
            <View style={styles.petBannerImagePlaceholder}>
              <Text style={styles.petBannerImageText}>
                {adoptionPet.species === 'dog' ? '🐶' : '🐱'}
              </Text>
            </View>
          )}
          <View style={styles.petBannerInfo}>
            <Text style={styles.petBannerName}>{adoptionPet.name}</Text>
            <Text style={styles.petBannerDetails}>
              {adoptionPet.breed} • {adoptionPet.age} {adoptionPet.age_unit === 'years' ? 'años' : 'meses'}
            </Text>
          </View>
        </View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(renderMessage)}
        </ScrollView>

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Escribe un mensaje..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            <Send size={20} color={newMessage.trim() && !sending ? "#FFFFFF" : "#9CA3AF"} />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    fontSize: 18,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerAction: {
    padding: 8,
  },
  petBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  petBannerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  petBannerImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  petBannerImageText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  petBannerInfo: {
    flex: 1,
  },
  petBannerName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
  },
  petBannerDetails: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 12,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  ownMessageBubble: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#6B7280',
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
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
});