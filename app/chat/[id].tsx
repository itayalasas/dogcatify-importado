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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, ArrowLeft } from 'lucide-react-native';

interface Message {
  id: string;
  text: string;
  sender_id: string;
  created_at: string;
  conversation_id: string;
}

interface Conversation {
  id: string;
  pet_id: string;
  user_id: string;
  shelter_id: string;
  created_at: string;
  pet?: {
    name: string;
    photos: string[];
  };
  user?: {
    full_name: string;
    email: string;
  };
  shelter?: {
    business_name: string;
    email: string;
  };
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id && currentUser) {
      fetchConversation();
      fetchMessages();
      subscribeToMessages();
    }
  }, [id, currentUser]);

  const fetchConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          pet:pets(name, photos),
          user:profiles!conversations_user_id_fkey(full_name, email),
          shelter:partners!conversations_shelter_id_fkey(business_name, email)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setConversation(data);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      Alert.alert('Error', 'No se pudo cargar la conversación');
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !conversation) return;

    try {
      const { error } = await supabase.from('messages').insert({
        text: newMessage.trim(),
        sender_id: currentUser.id,
        conversation_id: id,
      });

      if (error) throw error;

      setNewMessage('');
      scrollToBottom();
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
    const isOwnMessage = item.sender_id === currentUser?.id;
    
    console.log('=== MESSAGE DEBUG ===');
    console.log('Message ID:', item.id);
    console.log('Message text:', item.text);
    console.log('Message sender_id:', item.sender_id);
    console.log('Message sender_id type:', typeof item.sender_id);
    console.log('Current user ID:', currentUser?.id);
    console.log('Current user ID type:', typeof currentUser?.id);
    console.log('Are they equal?:', item.sender_id === currentUser?.id);
    console.log('Is own message?:', isOwnMessage);
    console.log('Message created at:', item.created_at);
    console.log('=== END MESSAGE DEBUG ===');

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <Text style={[
          styles.messageText,
          isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
        ]}>
          {item.text}
        </Text>
        <Text style={[
          styles.messageTime,
          isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
        ]}>
          {new Date(item.created_at).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando conversación...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#2D6A6F" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {conversation?.pet?.name || 'Chat'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {currentUser?.id === conversation?.user_id
              ? conversation?.shelter?.business_name
              : conversation?.user?.full_name}
          </Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={scrollToBottom}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Escribe un mensaje..."
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !newMessage.trim() && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Send size={20} color={newMessage.trim() ? '#FFFFFF' : '#CCCCCC'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: Platform.OS === 'ios' ? 60 : 12,
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D6A6F',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2D6A6F',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#333333',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#999999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#2D6A6F',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F0F0F0',
  },
});