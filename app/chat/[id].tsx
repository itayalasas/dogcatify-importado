import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { sendPushNotification } = useNotifications();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationData, setConversationData] = useState(null);
  const flatListRef = useRef(null);

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
        .from('adoption_conversations')
        .select(`
          *,
          adoption_pets (
            name,
            profiles!adoption_pets_owner_id_fkey (
              full_name,
              id
            )
          ),
          interested_user:profiles!adoption_conversations_interested_user_id_fkey (
            full_name,
            id
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setConversationData(data);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      Alert.alert('Error', 'No se pudo cargar la conversación');
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('adoption_messages')
        .select(`
          *,
          sender:profiles!adoption_messages_sender_id_fkey (
            full_name
          )
        `)
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
      .channel(`messages-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'adoption_messages',
          filter: `conversation_id=eq.${id}`
        },
        (payload) => {
          console.log('New message received:', payload);
          fetchMessages(); // Refetch to get sender info
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !conversationData) return;

    try {
      const messageData = {
        conversation_id: id,
        sender_id: currentUser.id,
        message: newMessage.trim(),
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('adoption_messages')
        .insert([messageData]);

      if (error) throw error;

      // Determinar el destinatario de la notificación
      const isUserTheInterestedUser = currentUser.id === conversationData.interested_user_id;
      const recipientId = isUserTheInterestedUser 
        ? conversationData.adoption_pets.profiles.id 
        : conversationData.interested_user.id;
      
      const senderName = isUserTheInterestedUser 
        ? conversationData.interested_user.full_name 
        : conversationData.adoption_pets.profiles.full_name;
      
      const petName = conversationData.adoption_pets.name;
      const messagePreview = newMessage.length > 50 
        ? newMessage.substring(0, 50) + '...' 
        : newMessage;

      // Enviar notificación push al destinatario
      try {
        await sendPushNotification(
          recipientId,
          `${senderName} - Adopción de ${petName}`,
          messagePreview,
          {
            type: 'chat_message',
            conversationId: id,
            petName: petName,
            senderName: senderName
          }
        );
        console.log('Push notification sent successfully');
      } catch (notificationError) {
        console.error('Error sending push notification:', notificationError);
        // No bloquear el envío del mensaje si falla la notificación
      }

      setNewMessage('');
      
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    }
  };

  const renderMessage = (message: any) => {
    // Force different alignment for testing
    const testAlignment = message.message.includes('refugio') ? false : true;
    
    console.log('Test alignment (refugio=left, other=right):', testAlignment);
    
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          testAlignment ? styles.ownMessage : styles.otherMessage
        ]}
      >
        <View style={[
          styles.messageBubble,
          testAlignment ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            testAlignment ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {message.message}
          </Text>
          <Text style={styles.messageTime}>
            {new Date(message.created_at).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Cargando conversación...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#000" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>
              {conversationData?.adoption_pets?.profiles?.full_name || 'Refugio'}
            </Text>
            <Text style={styles.headerSubtitle}>
              Adopción de {conversationData?.adoption_pets?.name || 'Mascota'}
            </Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => renderMessage(item)}
          keyExtractor={(item) => item.id.toString()}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
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
            onPress={sendMessage}
            style={[
              styles.sendButton,
              { opacity: newMessage.trim() ? 1 : 0.5 }
            ]}
            disabled={!newMessage.trim()}
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});