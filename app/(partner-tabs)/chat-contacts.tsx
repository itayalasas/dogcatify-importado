import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MessageCircle, Phone, Search, Clock } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function ChatContacts() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);

  useEffect(() => {
    if (!currentUser || !businessId) return;
    
    fetchPartnerProfile();
    fetchConversations();
    
    // Set up real-time subscription for conversation updates
    const subscription = supabaseClient
      .channel('partner-conversations')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chat_conversations',
          filter: `partner_id=eq.${businessId}`
        }, 
        () => {
          fetchConversations();
        }
      )
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages'
        }, 
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser, businessId]);

  const fetchPartnerProfile = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', businessId)
        .single();
      
      if (error) throw error;
      
      setPartnerProfile({
        id: data.id,
        businessName: data.business_name,
        businessType: data.business_type,
        logo: data.logo,
      });
    } catch (error) {
      console.error('Error fetching partner profile:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('chat_conversations')
        .select('*')
        .eq('partner_id', businessId)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Process conversations to get latest message and unread count
      const processedConversations = await Promise.all(
        (data || []).map(async (conv) => {
          // Get adoption pet info
          const { data: petData } = await supabaseClient
            .from('adoption_pets')
            .select('name, species, images')
            .eq('id', conv.adoption_pet_id)
            .single();
          
          // Get customer profile
          const { data: customerData } = await supabaseClient
            .from('profiles')
            .select('display_name, photo_url')
            .eq('id', conv.user_id)
            .single();
          
          // Get latest message
          const { data: latestMessage } = await supabaseClient
            .from('chat_messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get unread count
          const { count: unreadCount } = await supabaseClient
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', currentUser?.id);

          return {
            ...conv,
            latestMessage,
            unreadCount: unreadCount || 0,
            customerName: customerData?.display_name || 'Usuario',
            customerAvatar: customerData?.photo_url,
            petName: petData?.name,
            petSpecies: petData?.species,
            petImage: petData?.images?.[0],
          };
        })
      );

      setConversations(processedConversations);
      console.log('Conversations loaded:', processedConversations.length);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationPress = (conversation: any) => {
    router.push(`/chat/${conversation.id}?petName=${conversation.petName}`);
  };

  const formatLastMessageTime = (date: string) => {
    const messageDate = new Date(date);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Ahora';
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return messageDate.toLocaleDateString();
  };

  const filteredConversations = conversations.filter(conv =>
    conv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.petName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderConversation = (conversation: any) => (
    <TouchableOpacity
      key={conversation.id}
      style={styles.conversationCard}
      onPress={() => handleConversationPress(conversation)}
    >
      <View style={styles.conversationHeader}>
        {/* Customer Avatar */}
        {conversation.customerAvatar ? (
          <Image source={{ uri: conversation.customerAvatar }} style={styles.customerAvatar} />
        ) : (
          <View style={styles.customerAvatarPlaceholder}>
            <Text style={styles.customerAvatarText}>👤</Text>
          </View>
        )}

        <View style={styles.conversationInfo}>
          <View style={styles.conversationTitleRow}>
            <Text style={styles.customerName}>{conversation.customerName}</Text>
            {conversation.latestMessage && (
              <Text style={styles.messageTime}>
                {formatLastMessageTime(conversation.latestMessage.created_at)}
              </Text>
            )}
          </View>

          <View style={styles.petInfoRow}>
            <Text style={styles.petInfo}>
              {conversation.petSpecies === 'dog' ? '🐶' : '🐱'} {conversation.petName}
            </Text>
            {conversation.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{conversation.unreadCount}</Text>
              </View>
            )}
          </View>

          {conversation.latestMessage && (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {conversation.latestMessage.sender_id === currentUser?.id ? 'Tú: ' : ''}
              {conversation.latestMessage.message}
            </Text>
          )}
        </View>

        {/* Pet Image */}
        {conversation.petImage ? (
          <Image source={{ uri: conversation.petImage }} style={styles.petImage} />
        ) : (
          <View style={styles.petImagePlaceholder}>
            <Text style={styles.petImageText}>
              {conversation.petSpecies === 'dog' ? '🐶' : '🐱'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando conversaciones...</Text>
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
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Contactos de Adopción</Text>
          <Text style={styles.subtitle}>{partnerProfile?.businessName}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Buscar conversaciones..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={20} color="#9CA3AF" />}
        />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 Resumen de Contactos</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{conversations.length}</Text>
              <Text style={styles.statLabel}>Total{'\n'}Conversaciones</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {conversations.filter(c => c.unreadCount > 0).length}
              </Text>
              <Text style={styles.statLabel}>Sin{'\n'}Leer</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {conversations.filter(c => c.status === 'active').length}
              </Text>
              <Text style={styles.statLabel}>Activas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
              </Text>
              <Text style={styles.statLabel}>Mensajes{'\n'}Pendientes</Text>
            </View>
          </View>
        </Card>

        {filteredConversations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MessageCircle size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? 'Intenta con otros términos de búsqueda'
                : 'Las conversaciones sobre adopciones aparecerán aquí'
              }
            </Text>
          </Card>
        ) : (
          <View style={styles.conversationsList}>
            {filteredConversations.map(renderConversation)}
          </View>
        )}
      </ScrollView>
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
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  placeholder: {
    width: 32,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  conversationsList: {
    gap: 8,
  },
  conversationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  customerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  customerAvatarText: {
    fontSize: 20,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  messageTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  petInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  petInfo: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  lastMessage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  petImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 12,
  },
  petImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  petImageText: {
    fontSize: 16,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
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