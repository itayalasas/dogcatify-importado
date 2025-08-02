import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabaseClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Send, ArrowLeft, User } from 'lucide-react-native';

interface Message {
  id: string;
  message: string;
  sender_id: string;
  created_at: string;
  sender_name?: string;
  is_read: boolean;
}

interface ConversationDetails {
  id: string;
  adoption_pet_id: string;
  partner_id: string;
  user_id: string;
  status: string;
  petName?: string;
  customerName?: string;
  partnerName?: string;
}

export default function ChatScreen() {
  const { id: conversationId, petName } = useLocalSearchParams<{ 
    id: string; 
    petName?: string; 
  }>();
  const { currentUser } = useAuth();
  const { sendChatNotification } = useNotifications();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationDetails, setConversationDetails] = useState<ConversationDetails | null>(null);
  const [recipientId, setRecipientId] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!conversationId || !currentUser) {
      console.log('Missing conversationId or currentUser');
      setLoading(false);
      return;
    }
    
    console.log('Loading chat for conversation:', conversationId);
    loadConversationDetails();
    loadMessages();
    
    // Set up polling for new messages every 3 seconds
    const pollInterval = setInterval(() => {
      loadMessages();
    }, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [conversationId, currentUser]);

  const loadConversationDetails = async () => {
    try {
      console.log('Loading conversation details for:', conversationId);
      
      const { data: conversation, error } = await supabaseClient
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) {
        console.error('Error loading conversation:', error);
        throw error;
      }

      console.log('Conversation data:', conversation);
      setConversationDetails(conversation);

      // Determine recipient based on current user
      if (conversation.user_id === currentUser?.id) {
        // Current user is the customer, recipient is the partner
        setRecipientId(conversation.partner_id);
        
        // Get partner name
        const { data: partnerData } = await supabaseClient
          .from('partners')
          .select('business_name')
          .eq('id', conversation.partner_id)
          .single();
        
        setRecipientName(partnerData?.business_name || 'Refugio');
      } else {
        // Current user is the partner, recipient is the customer
        setRecipientId(conversation.user_id);
        
        // Get customer name
        const { data: customerData } = await supabaseClient
          .from('profiles')
          .select('display_name')
          .eq('id', conversation.user_id)
          .single();
        
        setRecipientName(customerData?.display_name || 'Usuario');
      }
    } catch (error) {
      console.error('Error loading conversation details:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la conversación');
    }
  };

  const loadMessages = async () => {
    try {
      console.log('Loading messages for conversation:', conversationId);
      
      const { data, error } = await supabaseClient
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        throw error;
      }

      console.log('Messages loaded:', data?.length || 0);
      
      // Get sender names for messages
      const messagesWithSenderNames = await Promise.all(
        (data || []).map(async (msg) => {
          let senderName = 'Usuario';
          
          try {
            if (msg.sender_id === currentUser?.id) {
              senderName = currentUser.displayName || 'Tú';
            } else {
              // Get sender name from profiles
              const { data: senderData } = await supabaseClient
                .from('profiles')
                .select('display_name')
                .eq('id', msg.sender_id)
                .single();
              
              if (senderData?.display_name) {
                senderName = senderData.display_name;
              } else {
                // Try to get from partners if it's a partner
                const { data: partnerData } = await supabaseClient
                  .from('partners')
                  .select('business_name')
                  .eq('user_id', msg.sender_id)
                  .single();
                
                if (partnerData?.business_name) {
                  senderName = partnerData.business_name;
                }
              }
            }
          } catch (error) {
            console.error('Error getting sender name:', error);
          }
          
          return {
            ...msg,
            sender_name: senderName
          };
        })
      );

      setMessages(messagesWithSenderNames);
      
      // Mark messages as read if they're not from current user
      const unreadMessages = messagesWithSenderNames.filter(
        msg => !msg.is_read && msg.sender_id !== currentUser?.id
      );
      
      if (unreadMessages.length > 0) {
        markMessagesAsRead(unreadMessages.map(msg => msg.id));
      }
      
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async (messageIds: string[]) => {
    try {
      const { error } = await supabaseClient
        .from('chat_messages')
        .update({ is_read: true })
        .in('id', messageIds);
      
      if (error) {
        console.error('Error marking messages as read:', error);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !conversationId) return;

    try {
      console.log('Sending message:', newMessage.trim());
      
      const messageData = {
        conversation_id: conversationId,
        sender_id: currentUser.id,
        message: newMessage.trim(),
        message_type: 'text',
        is_read: false,
        created_at: new Date().toISOString()
      };

      const { error } = await supabaseClient
        .from('chat_messages')
        .insert([messageData]);

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      console.log('Message sent successfully');

      // Send push notification to recipient
      if (recipientId && recipientName) {
        try {
          await sendChatNotification(
            recipientId,
            currentUser.displayName || 'Usuario',
            petName || 'mascota',
            newMessage.trim(),
            conversationId
          );
          console.log('Push notification sent');
        } catch (notificationError) {
          console.error('Error sending push notification:', notificationError);
          // Don't fail the message sending if notification fails
        }
      }

      setNewMessage('');
      
      // Reload messages to show the new one
      setTimeout(() => {
        loadMessages();
        scrollToBottom();
      }, 500);
      
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === currentUser?.id;
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.otherMessage
      ]}>
        {!isMyMessage && (
          <Text style={styles.senderName}>{item.sender_name}</Text>
        )}
        <Text style={[
          styles.messageText,
          isMyMessage ? styles.myMessageText : styles.otherMessageText
        ]}>
          {item.message}
        </Text>
        <Text style={[
          styles.messageTime,
          isMyMessage ? styles.myMessageTime : styles.otherMessageTime
        ]}>
          {new Date(item.created_at).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando mensajes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>
              {recipientName || 'Chat'}
            </Text>
            {petName && (
              <Text style={styles.headerSubtitle}>
                Sobre la adopción de {petName}
              </Text>
            )}
          </View>
          
          <View style={styles.headerAvatar}>
            <User size={24} color="#6B7280" />
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={scrollToBottom}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              !newMessage.trim() && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim()}
          >
            <Send 
              size={20} 
              color={!newMessage.trim() ? '#9CA3AF' : '#FFFFFF'} 
            />
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
  keyboardContainer: {
    flex: 1,
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
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#EF4444',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  senderName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
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
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  sendButton: {
    backgroundColor: '#EF4444',
    borderRadius: 20,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
});