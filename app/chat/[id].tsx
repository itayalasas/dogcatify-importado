import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function ChatScreen() {
  const { id, petName } = useLocalSearchParams<{ id: string; petName?: string }>();
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!currentUser || !id) {
      router.replace('/auth/login');
      return;
    }
    
    fetchConversation();
    fetchMessages();
    
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
          setMessages(prev => [...prev, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser, id]);

  const fetchConversation = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('chat_conversations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST301' || error.message?.includes('JWT expired')) {
          Alert.alert('Sesión expirada', 'Tu sesión ha expirado. Inicia sesión nuevamente.');
          router.replace('/auth/login');
          return;
        }
        throw error;
      }
      
      setConversation(data);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      Alert.alert('Error', 'No se pudo cargar la conversación');
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      
      if (error) {
        if (error.code === 'PGRST301' || error.message?.includes('JWT expired')) {
          Alert.alert('Sesión expirada', 'Tu sesión ha expirado. Inicia sesión nuevamente.');
          router.replace('/auth/login');
          return;
        }
        throw error;
      }
      
      setMessages(data || []);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    try {
      const messageData = {
        conversation_id: id,
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
        if (error.code === 'PGRST301' || error.message?.includes('JWT expired')) {
          Alert.alert('Sesión expirada', 'Tu sesión ha expirado. Inicia sesión nuevamente.');
          router.replace('/auth/login');
          return;
        }
        throw error;
      }

      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
          {formatTime(message.created_at)}
        </Text>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {petName ? `Adopción de ${petName}` : 'Chat'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Inicia la conversación sobre la adopción de {petName}
              </Text>
            </View>
          ) : (
            messages.map(renderMessage)
          )}
        </ScrollView>

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
              !newMessage.trim() && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim()}
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
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#EF4444',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
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
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
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
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#EF4444',
    width: 40,
    height: 40,
    borderRadius: 20,
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