import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, User, Phone, Mail, Calendar, Heart } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
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
        .eq('partner_id', partnerId);

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

      // Fetch customer details
      const clientsData = [];
      for (const customerId of customerIds) {
        try {
          const { data: userData, error: userError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', customerId)
            .single();
          
          if (userError) continue;
          
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
        return { backgroundColor: '#ECFDF5', color: '#059669' };
      case 'Fiel':
        return { backgroundColor: '#EFF6FF', color: '#2563EB' };
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
              <Phone size={14} color="#6B7280" />
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
              <Calendar size={14} color="#6B7280" />
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
          <Calendar size={14} color="#6B7280" />
          <Text style={styles.lastBookingText}>
            Última interacción: {formatLastBooking(client.lastBooking)}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.contactButton, !client.phone && !client.email ? styles.contactButtonDisabled : null]}
          onPress={() => handleContactClient(client)}
          disabled={!client.phone && !client.email}
        >
          {client.phone ? <Phone size={16} color="#3B82F6" /> : <Mail size={16} color="#3B82F6" />}
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.businessInfo}>
            {partnerProfile?.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {partnerProfile?.businessType === 'veterinary' ? '🏥' : 
                   partnerProfile?.businessType === 'grooming' ? '✂️' : 
                   partnerProfile?.businessType === 'walking' ? '🚶' : 
                   partnerProfile?.businessType === 'boarding' ? '🏠' : 
                   partnerProfile?.businessType === 'shop' ? '🛍️' : '👥'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.title}>Mis Clientes</Text>
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
              <Text style={styles.statNumber}>{clients.length}</Text>
              <Text style={styles.statLabel}>Clientes totales</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {clients.reduce((sum, client) => sum + (client.totalInteractions || client.bookingsCount), 0)}
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando clientes...</Text>
          </View>
        ) : clients.length === 0 ? (
          <Card style={styles.emptyCard}>
            <User size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Aún no tienes clientes</Text>
            <Text style={styles.emptySubtitle}>
              Los clientes aparecerán aquí cuando hagan reservas de tus servicios o compren productos
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.retentionCard}>
              <View style={styles.retentionHeader}>
                <View style={styles.retentionHeaderLeft}>
                  <Heart size={20} color="#EF4444" />
                  <View>
                    <Text style={styles.retentionTitle}>Seguimiento y retención</Text>
                    <Text style={styles.retentionSubtitle}>
                      Prioriza a quienes necesitan un recontacto hoy
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
    marginLeft: 8,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoPlaceholderText: {
    fontSize: 20,
  },
  businessName: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  statsHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  statsCard: {
    padding: 16,
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
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  retentionCard: {
    marginBottom: 12,
    padding: 16,
  },
  retentionHeader: {
    marginBottom: 12,
  },
  retentionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  retentionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  retentionSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  retentionStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  retentionStat: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  retentionStatValue: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  retentionStatLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  priorityList: {
    gap: 10,
  },
  priorityClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  priorityClientInfo: {
    flex: 1,
    marginRight: 12,
  },
  priorityClientName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 8,
  },
  priorityClientMeta: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  priorityClientAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EBF8FF',
  },
  priorityClientActionDisabled: {
    backgroundColor: '#F3F4F6',
  },
  priorityClientActionText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#2563EB',
  },
  retentionEmptyText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 19,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  lockedContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  lockedTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
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
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  clientCard: {
    marginBottom: 12,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  clientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  clientEmail: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  clientMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  clientDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientDetailText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  clientStats: {
    alignItems: 'center',
  },
  segmentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  bookingsCount: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  bookingsLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
    color: '#6B7280',
    marginLeft: 4,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  contactButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  contactButtonText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 4,
  },
});
