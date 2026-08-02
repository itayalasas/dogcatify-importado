import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';

interface MatchMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function PetMatchChatScreen() {
  const { id: chatId, petName } = useLocalSearchParams<{ id: string; petName?: string }>();
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<MatchMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatMeta, setChatMeta] = useState<any>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!chatId || !currentUser?.id) return;

    initialize();

    const intervalId = setInterval(() => {
      fetchMessages(false);
    }, 4000);

    const channel = supabaseClient
      .channel(`pet-match-chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pet_match_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async payload => {
          const newMsg = payload.new as MatchMessage;
          const isIncoming = newMsg.sender_id !== currentUser?.id;

          if (isIncoming && !newMsg.is_read) {
            await supabaseClient
              .from('pet_match_messages')
              .update({ is_read: true })
              .eq('id', newMsg.id);

            newMsg.is_read = true;
          }

          setMessages(prev => {
            if (prev.some(msg => msg.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      clearInterval(intervalId);
      channel.unsubscribe();
    };
  }, [chatId, currentUser?.id]);

  const initialize = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchChatMeta(), fetchMessages()]);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchChatMeta = async () => {
    const { data, error } = await supabaseClient
      .from('pet_match_chats')
      .select('*')
      .eq('id', chatId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      Alert.alert('Error', 'No se encontró el chat');
      router.back();
      return;
    }

    setChatMeta(data);
  };

  const fetchMessages = async (markAsRead = true) => {
    const { data, error } = await supabaseClient
      .from('pet_match_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    setMessages(data || []);

    const unreadIds = (data || [])
      .filter(msg => msg.sender_id !== currentUser?.id && !msg.is_read)
      .map(msg => msg.id);

    if (markAsRead && unreadIds.length > 0) {
      await supabaseClient
        .from('pet_match_messages')
        .update({ is_read: true })
        .in('id', unreadIds);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatId || !currentUser?.id) return;

    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    try {
      const { data: insertedMessage, error } = await supabaseClient
        .from('pet_match_messages')
        .insert({
          chat_id: chatId,
          sender_id: currentUser.id,
          message: text,
          is_read: false,
        })
        .select('*')
        .single();

      if (error) throw error;

      if (insertedMessage) {
        setMessages(prev => {
          if (prev.some(msg => msg.id === insertedMessage.id)) return prev;
          return [...prev, insertedMessage as MatchMessage];
        });
      }
    } catch (error) {
      setNewMessage(text);
      Alert.alert('Error', 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const title = useMemo(() => {
    if (petName) return `Chat con ${petName}`;
    return 'Chat de match';
  }, [petName]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: MatchMessage }) => {
    const isMine = item.sender_id === currentUser?.id;

    return (
      <View style={[styles.messageRow, isMine ? styles.myMessageRow : styles.otherMessageRow]}>
        <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMine ? styles.myText : styles.otherText]}>{item.message}</Text>
          <Text style={[styles.messageTime, isMine ? styles.myTime : styles.otherTime]}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Cargando conversación...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.emptyText}>Aún no hay mensajes. ¡Inicia la conversación!</Text>}
        />

        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={18} color="#FFFFFF" />
            )}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  headerSpacer: {
    width: 30,
  },
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexGrow: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#9CA3AF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  messageRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  myBubble: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 19,
  },
  myText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#111827',
  },
  messageTime: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    textAlign: 'right',
  },
  myTime: {
    color: '#EDE9FE',
  },
  otherTime: {
    color: '#6B7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 110,
    minHeight: 40,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendButtonDisabled: {
    backgroundColor: '#C4B5FD',
  },
});
