import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MessageCircle, Phone, Search, Clock, User } from 'lucide-react-native';
import { Card, Button, IconButton, EmptyState, SkeletonList } from '../../components/ui';
import { formatNumber } from '../../components/partner/format';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { canAccessPartnerModule, getPartnerLockedActionLabel } from '../../utils/partnerPlans';

export default function ChatContacts() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!currentUser || !businessId) return;

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const loadChatContacts = async () => {
      const canLoad = await fetchPartnerProfile();
      if (!canLoad) {
        return;
      }

      await fetchConversations();

      // Set up polling for conversation updates every 5 seconds
      pollInterval = setInterval(() => {
        fetchConversations();
      }, 5000);
    };

    loadChatContacts();

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [currentUser, businessId]);

  const fetchPartnerProfile = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*, subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at')
        .eq('id', businessId)
        .single();
      
      if (error) throw error;

      const planTier = data.subscription_plan_tier || 'starter';
      const canViewAdoptions = canAccessPartnerModule(
        planTier,
        'adoptions',
        data.business_type,
        data.subscription_plan_status,
        data.subscription_plan_expires_at,
      );

      setPartnerProfile({
        id: data.id,
        businessName: data.business_name,
        businessType: data.business_type,
        subscriptionPlanTier: planTier,
        logo: data.logo,
      });

      if (!canViewAdoptions) {
        setAccessDenied(true);
        setLoading(false);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error fetching partner profile:', error);
      setLoading(false);
      return false;
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
          
          // Get customer profile (public columns only — other user's row)
          const { data: customerData } = await supabaseClient
            .from('profiles_public')
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchConversations();
    } finally {
      setRefreshing(false);
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
      accessibilityRole="button"
      accessibilityLabel={`Conversación con ${conversation.customerName} sobre ${conversation.petName || 'la mascota'}${conversation.unreadCount > 0 ? `, ${conversation.unreadCount} sin leer` : ''}`}
    >
      <View style={styles.conversationHeader}>
        {/* Customer Avatar */}
        {conversation.customerAvatar ? (
          <Image source={{ uri: conversation.customerAvatar }} style={styles.customerAvatar} />
        ) : (
          <View style={styles.customerAvatarPlaceholder}>
            <User size={22} color={colors.primary} />
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
              {conversation.latestMessage.sender_id === currentUser?.id ? 'Vos: ' : ''}
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
        <SkeletonList kind="list" count={6} style={{ padding: spacing.lg }} />
      </SafeAreaView>
    );
  }

  if (accessDenied) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lockedContainer}>
          <Card style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Módulo bloqueado</Text>
            <Text style={styles.lockedText}>
              {getPartnerLockedActionLabel('adoptions')} para este negocio.
            </Text>
            <Text style={styles.lockedTextSecondary}>
              Los contactos de adopción solo están disponibles para refugios con plan Pro.
            </Text>
            <Button title="Volver" onPress={() => router.back()} fullWidth={false} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon={<ArrowLeft size={24} color={colors.text} />}
          onPress={() => router.back()}
          accessibilityLabel="Volver"
        />
        <View style={styles.headerInfo}>
          <Text style={styles.title} accessibilityRole="header">Contactos de adopción</Text>
          <Text style={styles.subtitle}>{partnerProfile?.businessName}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Buscar conversaciones..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={20} color={colors.icon} />}
        />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Resumen de contactos</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatNumber(conversations.length)}</Text>
              <Text style={styles.statLabel}>Conversaciones</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {conversations.filter(c => c.unreadCount > 0).length}
              </Text>
              <Text style={styles.statLabel}>Sin leer</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {conversations.filter(c => c.status === 'active').length}
              </Text>
              <Text style={styles.statLabel}>Activas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {formatNumber(conversations.reduce((sum, c) => sum + c.unreadCount, 0))}
              </Text>
              <Text style={styles.statLabel}>Mensajes{'\n'}pendientes</Text>
            </View>
          </View>
        </Card>

        {filteredConversations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon={<MessageCircle size={32} color={colors.primary} />}
              title={searchQuery ? 'No encontramos conversaciones' : 'Todavía no hay conversaciones'}
              description={searchQuery
                ? 'Probá con otros términos de búsqueda.'
                : 'Las conversaciones sobre adopciones van a aparecer acá.'}
            />
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
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  placeholder: {
    width: 32,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  statsCard: {
    marginBottom: spacing.lg,
  },
  statsTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.lg,
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
    color: colors.danger,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  conversationsList: {
    gap: spacing.sm,
  },
  conversationCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    shadowColor: colors.black,
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
    marginRight: spacing.md,
  },
  customerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
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
    marginBottom: spacing.xs,
  },
  customerName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  messageTime: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  petInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  petInfo: {
    ...typography.label,
    color: colors.primary,
  },
  unreadBadge: {
    backgroundColor: colors.danger,
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
    color: colors.surface,
  },
  lastMessage: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  petImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: spacing.md,
  },
  petImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  petImageText: {
    fontSize: 16,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 18,
  },
  lockedTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  lockedText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#7C3AED',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.sm,
  },
  lockedTextSecondary: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  lockedButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  lockedButtonText: {
    color: colors.surface,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
});
