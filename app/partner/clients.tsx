import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Linking, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, User, Phone, Mail, Calendar, Heart } from 'lucide-react-native';
import { Card, Button, IconButton, EmptyState, SkeletonList } from '../../components/ui';
import { BusinessTypeAvatar } from '../../components/partner/BusinessTypeAvatar';
import { formatNumber } from '../../components/partner/format';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import {
  canAccessPartnerModule,
  getPartnerLockedActionLabel,
  resolvePartnerAccountSubscription,
  resolvePartnerPlanTier,
} from '../../utils/partnerPlans';

export default function PartnerClients() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>();
  const { currentUser } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAccountSubscription = async (userId?: string | null) => {
    if (!userId) {
      return null;
    }

    const { data, error } = await supabaseClient
      .from('partners')
      .select('subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at')
      .eq('user_id', userId)
      .eq('is_verified', true);

    if (error) {
      throw error;
    }

    return resolvePartnerAccountSubscription(data || []);
  };

  useEffect(() => {
    const userId = currentUser?.id;
    if (!partnerId || !userId) return;
    
    // Fetch partner profile using Supabase
    const fetchPartnerProfile = async () => {
      try {
        const [{ data, error }, accountSubscription] = await Promise.all([
          supabaseClient
            .from('partners')
            .select('*')
            .eq('id', partnerId)
            .single(),
          loadAccountSubscription(userId),
        ]);
        
        if (error) throw error;
        
        if (data) {
          const effectiveSubscriptionTier =
            accountSubscription?.subscriptionPlanTier ||
            resolvePartnerPlanTier(
              data.subscription_plan_tier,
              data.subscription_plan_status,
              data.subscription_plan_expires_at,
            );
          const effectiveSubscriptionStatus =
            accountSubscription?.subscriptionPlanStatus ||
            data.subscription_plan_status ||
            null;
          const effectiveSubscriptionExpiresAt =
            accountSubscription?.subscriptionPlanExpiresAt ||
            data.subscription_plan_expires_at ||
            null;

          setPartnerProfile({
            id: data.id,
            businessName: data.business_name,
            businessType: data.business_type,
            subscriptionPlanTier: effectiveSubscriptionTier,
            subscriptionPlanStatus: effectiveSubscriptionStatus,
            subscriptionPlanExpiresAt: effectiveSubscriptionExpiresAt,
            ...data
          });

          if (!canAccessPartnerModule(
            effectiveSubscriptionTier,
            'clients',
            data?.business_type,
            effectiveSubscriptionStatus,
            effectiveSubscriptionExpiresAt,
          )) {
            setLoading(false);
            return;
          }
        }

        fetchClients();
      } catch (error) {
        console.error('Error fetching partner profile:', error);
        setLoading(false);
      }
    };
    
    fetchPartnerProfile();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel(`partner-profile-changes-${userId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'partners',
          filter: `user_id=eq.${userId}`
        }, 
        () => {
          fetchPartnerProfile();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [partnerId, currentUser?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchClients();
    } finally {
      setRefreshing(false);
    }
  };

  const fetchClients = async () => {
    try {
      // Get all bookings for this partner using Supabase
      const { data: bookingsData, error: bookingsError } = await supabaseClient
        .from('bookings')
        .select('*')
        .eq('partner_id', partnerId);

      if (bookingsError) throw bookingsError;

      const bookings = bookingsData || [];

      // Get all orders for this partner
      const { data: ordersData, error: ordersError } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('partner_id', partnerId)
        .eq('is_split_master', false);

      if (ordersError) throw ordersError;

      const orders = ordersData || [];

      const customerIds = new Set<string>();

      // Extract unique customer IDs from bookings
      bookings.forEach(booking => {
        if (booking.customer_id) {
          customerIds.add(booking.customer_id);
        }
      });

      // Extract unique customer IDs from orders
      orders.forEach(order => {
        if (order.customer_id) {
          customerIds.add(order.customer_id);
        }
      });

      // Fetch customer contact details in one call (server-side verifies
      // this partner actually has a booking/order from each customer before
      // returning display_name/email/photo_url/phone).
      const { data: contactsData, error: contactsError } = await supabaseClient
        .rpc('get_partner_customer_contacts', { p_partner_id: partnerId });

      if (contactsError) throw contactsError;

      const contactsById = new Map<string, any>((contactsData || []).map((c: any) => [c.customer_id, c]));

      const clientsData = [];
      for (const customerId of customerIds) {
        try {
          const userData = contactsById.get(customerId);

          if (userData) {
            // Count bookings for this customer from the bookings array
            const customerBookings = bookings.filter(
              booking => booking.customer_id === customerId);

            // Count orders for this customer
            const customerOrders = orders.filter(
              order => order.customer_id === customerId);

            // Get the last interaction (booking or order)
            const lastBookingDate = customerBookings.length > 0
              ? new Date(customerBookings[customerBookings.length - 1].created_at)
              : null;
            const lastOrderDate = customerOrders.length > 0
              ? new Date(customerOrders[customerOrders.length - 1].created_at)
              : null;

            let lastInteraction = lastBookingDate;
            if (lastOrderDate && (!lastBookingDate || lastOrderDate > lastBookingDate)) {
              lastInteraction = lastOrderDate;
            }

            clientsData.push({
              id: customerId,
              displayName: userData.display_name,
              email: userData.email,
              photoURL: userData.photo_url,
              phone: userData.phone,
              bookingsCount: customerBookings.length,
              ordersCount: customerOrders.length,
              totalInteractions: customerBookings.length + customerOrders.length,
              lastBooking: lastInteraction
            });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }

      // Sort by most recent interaction
      clientsData.sort((a, b) => {
        if (!a.lastBooking) return 1;
        if (!b.lastBooking) return -1;
        return b.lastBooking.getTime() - a.lastBooking.getTime();
      });

      setClients(clientsData);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastBooking = (date: Date | null) => {
    if (!date) return 'Sin interacciones';
    
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Hoy';
    if (diffInDays === 1) return 'Ayer';
    if (diffInDays < 7) return `Hace ${diffInDays} días`;
    if (diffInDays < 30) return `Hace ${Math.floor(diffInDays / 7)} semana${Math.floor(diffInDays / 7) !== 1 ? 's' : ''}`;
    
    return date.toLocaleDateString();
  };

  const getDaysSince = (date: Date | null) => {
    if (!date) return null;

    return Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getClientSegment = (client: any) => {
    const daysSince = getDaysSince(client.lastBooking);

    if (daysSince === null) return 'Sin actividad';
    if ((client.totalInteractions || client.bookingsCount || 0) >= 3 && daysSince <= 30) return 'Fiel';
    if (daysSince <= 30) return 'Activo';
    if (daysSince <= 90) return 'En riesgo';
    return 'Dormido';
  };

  const getSegmentTone = (segment: string) => {
    switch (segment) {
      case 'Activo':
        return { backgroundColor: '#ECFDF5', color: '#047857' };
      case 'Fiel':
        return { backgroundColor: '#EEF6F6', color: '#24565A' };
      case 'En riesgo':
        return { backgroundColor: '#FFFBEB', color: '#D97706' };
      case 'Dormido':
        return { backgroundColor: '#F3F4F6', color: '#6B7280' };
      default:
        return { backgroundColor: '#F3F4F6', color: '#6B7280' };
    }
  };

  const clientInsights = clients.reduce(
    (acc, client) => {
      const segment = getClientSegment(client);

      if (segment === 'Activo' || segment === 'Fiel') acc.active += 1;
      if (segment === 'En riesgo') acc.atRisk += 1;
      if (segment === 'Dormido') acc.dormant += 1;
      if (segment === 'Fiel') acc.loyal += 1;

      return acc;
    },
    { active: 0, atRisk: 0, dormant: 0, loyal: 0 },
  );

  const priorityClients = clients
    .filter(client => ['En riesgo', 'Dormido'].includes(getClientSegment(client)))
    .sort((a, b) => {
      const daysA = getDaysSince(a.lastBooking);
      const daysB = getDaysSince(b.lastBooking);

      if (daysA === null) return 1;
      if (daysB === null) return -1;

      return daysB - daysA;
    })
    .slice(0, 3);

  const handleContactClient = async (client: any) => {
    try {
      const phone = String(client.phone || '').replace(/[^\d+]/g, '').trim();

      if (phone) {
        await Linking.openURL(`tel:${phone}`);
        return;
      }

      if (client.email) {
        await Linking.openURL(`mailto:${client.email}`);
        return;
      }

      Alert.alert('Sin contacto', 'Este cliente no tiene teléfono ni correo registrado.');
    } catch (error) {
      console.error('Error contacting client:', error);
      Alert.alert('Error', 'No se pudo abrir el medio de contacto.');
    }
  };

  const renderClient = (client: any) => {
    const segment = getClientSegment(client);
    const segmentTone = getSegmentTone(segment);

    return (
      <Card key={client.id} style={styles.clientCard}>
      <View style={styles.clientHeader}>
        <Image
          source={{ 
            uri: client.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100'
          }}
          style={styles.clientAvatar}
        />
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>
            {client.displayName || 'Cliente'}
          </Text>
          <Text style={styles.clientEmail}>{client.email}</Text>
          {client.phone && (
            <View style={styles.clientDetail}>
              <Phone size={14} color={colors.textSecondary} />
              <Text style={styles.clientDetailText}>{client.phone}</Text>
            </View>
          )}
          <View style={styles.clientMetaRow}>
            <View style={[styles.segmentBadge, { backgroundColor: segmentTone.backgroundColor }]}>
              <Text style={[styles.segmentBadgeText, { color: segmentTone.color }]}>
                {segment}
              </Text>
            </View>
            <View style={styles.lastBookingRow}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={styles.lastBookingRowText}>Última: {formatLastBooking(client.lastBooking)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.clientStats}>
          <Text style={styles.bookingsCount}>{client.totalInteractions || client.bookingsCount}</Text>
          <Text style={styles.bookingsLabel}>
            {client.ordersCount > 0 && client.bookingsCount > 0
              ? 'interacciones'
              : client.ordersCount > 0
              ? 'pedidos'
              : 'reservas'}
          </Text>
        </View>
      </View>

      <View style={styles.clientFooter}>
        <View style={styles.lastBooking}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={styles.lastBookingText}>
            Última interacción: {formatLastBooking(client.lastBooking)}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.contactButton, !client.phone && !client.email ? styles.contactButtonDisabled : null]}
          onPress={() => handleContactClient(client)}
          disabled={!client.phone && !client.email}
          accessibilityRole="button"
          accessibilityLabel={client.phone ? `Llamar a ${client.displayName || 'cliente'}` : client.email ? `Escribir a ${client.displayName || 'cliente'}` : 'Sin contacto'}
          accessibilityState={{ disabled: !client.phone && !client.email }}
        >
          {client.phone ? <Phone size={16} color={colors.primary} /> : <Mail size={16} color={colors.primary} />}
          <Text style={styles.contactButtonText}>
            {client.phone ? 'Llamar' : client.email ? 'Escribir' : 'Sin contacto'}
          </Text>
        </TouchableOpacity>
      </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconButton
            icon={<ArrowLeft size={24} color={colors.text} />}
            onPress={() => router.back()}
            accessibilityLabel="Volver"
          />
          <View style={styles.businessInfo}>
            {partnerProfile?.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <BusinessTypeAvatar type={partnerProfile?.businessType} size={40} style={styles.logoPlaceholder} />
            )}
            <View>
              <Text style={styles.title} accessibilityRole="header">Mis clientes</Text>
              <Text style={styles.businessName}>{partnerProfile?.businessName}</Text>
            </View>
          </View>
        </View>
        <View style={styles.placeholder} />
      </View>

      {!canAccessPartnerModule(
        partnerProfile?.subscriptionPlanTier,
        'clients',
        partnerProfile?.businessType,
        partnerProfile?.subscriptionPlanStatus,
        partnerProfile?.subscriptionPlanExpiresAt,
      ) ? (
        <View style={styles.lockedContainer}>
          <Card style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Clientes disponibles en Growth</Text>
            <Text style={styles.lockedText}>
              {getPartnerLockedActionLabel('clients')}
            </Text>
            <Button
              title="Ver planes"
              onPress={() => Alert.alert('Plan Growth', 'El plan Growth habilita clientes e inteligencia de negocio.')}
              size="medium"
            />
          </Card>
        </View>
      ) : (
        <>
      <View style={styles.statsHeader}>
        <Card style={styles.statsCard}>
          <View style={styles.statsContent}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatNumber(clients.length)}</Text>
              <Text style={styles.statLabel}>Clientes totales</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {formatNumber(clients.reduce((sum, client) => sum + (client.totalInteractions || client.bookingsCount), 0))}
              </Text>
              <Text style={styles.statLabel}>Interacciones</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{clientInsights.active}</Text>
              <Text style={styles.statLabel}>Activos (30 días)</Text>
            </View>
          </View>
        </Card>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {loading ? (
          <SkeletonList kind="list" count={6} />
        ) : clients.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon={<User size={32} color={colors.primary} />}
              title="Todavía no tenés clientes"
              description="Tus clientes van a aparecer acá cuando reserven tus servicios o compren productos."
            />
          </Card>
        ) : (
          <>
            <Card style={styles.retentionCard}>
              <View style={styles.retentionHeader}>
                <View style={styles.retentionHeaderLeft}>
                  <Heart size={20} color={colors.danger} />
                  <View>
                    <Text style={styles.retentionTitle}>Seguimiento y retención</Text>
                    <Text style={styles.retentionSubtitle}>
                      Priorizá a quienes necesitan un recontacto hoy
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.retentionStatsGrid}>
                <View style={styles.retentionStat}>
                  <Text style={styles.retentionStatValue}>{clientInsights.active}</Text>
                  <Text style={styles.retentionStatLabel}>Activos</Text>
                </View>
                <View style={styles.retentionStat}>
                  <Text style={styles.retentionStatValue}>{clientInsights.atRisk}</Text>
                  <Text style={styles.retentionStatLabel}>En riesgo</Text>
                </View>
                <View style={styles.retentionStat}>
                  <Text style={styles.retentionStatValue}>{clientInsights.loyal}</Text>
                  <Text style={styles.retentionStatLabel}>Fieles</Text>
                </View>
                <View style={styles.retentionStat}>
                  <Text style={styles.retentionStatValue}>{clientInsights.dormant}</Text>
                  <Text style={styles.retentionStatLabel}>Dormidos</Text>
                </View>
              </View>

              {priorityClients.length > 0 ? (
                <View style={styles.priorityList}>
                  {priorityClients.map((client) => {
                    const segment = getClientSegment(client);
                    const tone = getSegmentTone(segment);

                    return (
                      <View key={client.id} style={styles.priorityClientRow}>
                        <View style={styles.priorityClientInfo}>
                          <View style={[styles.segmentBadge, { backgroundColor: tone.backgroundColor }]}>
                            <Text style={[styles.segmentBadgeText, { color: tone.color }]}>
                              {segment}
                            </Text>
                          </View>
                          <Text style={styles.priorityClientName}>{client.displayName || 'Cliente'}</Text>
                          <Text style={styles.priorityClientMeta}>
                            {formatLastBooking(client.lastBooking)}
                            {client.totalInteractions ? ` · ${client.totalInteractions} interacciones` : ''}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.priorityClientAction,
                            !client.phone && !client.email ? styles.priorityClientActionDisabled : null,
                          ]}
                          onPress={() => handleContactClient(client)}
                          disabled={!client.phone && !client.email}
                          accessibilityRole="button"
                          accessibilityLabel={client.phone ? `Llamar a ${client.displayName || 'cliente'}` : client.email ? `Escribir a ${client.displayName || 'cliente'}` : 'Sin contacto'}
                          accessibilityState={{ disabled: !client.phone && !client.email }}
                        >
                          <Text style={styles.priorityClientActionText}>
                            {client.phone ? 'Llamar' : client.email ? 'Email' : 'Sin contacto'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.retentionEmptyText}>
                  No hay clientes en riesgo por ahora. Vamos muy bien.
                </Text>
              )}
            </Card>

            {clients.map(renderClient)}
          </>
        )}
      </ScrollView>
        </>
      )} 
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  logoPlaceholderText: {
    fontSize: 20,
  },
  businessName: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  statsHeader: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  statsCard: {
    padding: spacing.lg,
  },
  statsContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  retentionCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  retentionHeader: {
    marginBottom: spacing.md,
  },
  retentionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  retentionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  retentionSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    marginTop: 2,
  },
  retentionStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  retentionStat: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  retentionStatValue: {
    ...typography.title,
    color: colors.text,
  },
  retentionStatLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  priorityList: {
    gap: 10,
  },
  priorityClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityClientInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  priorityClientName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginTop: spacing.sm,
  },
  priorityClientMeta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  priorityClientAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: '#EBF8FF',
  },
  priorityClientActionDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
  priorityClientActionText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: colors.primaryPressed,
  },
  retentionEmptyText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    lineHeight: 19,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  lockedContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: spacing.xl,
  },
  lockedTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  lockedText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
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
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  clientCard: {
    marginBottom: spacing.md,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  clientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: spacing.md,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: 2,
  },
  clientEmail: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  clientMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  clientDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientDetailText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  clientStats: {
    alignItems: 'center',
  },
  segmentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  segmentBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
  },
  lastBookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastBookingRowText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  bookingsCount: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.success,
  },
  bookingsLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  clientFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastBooking: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lastBookingText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  contactButtonDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
  contactButtonText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
    marginLeft: spacing.xs,
  },
});
