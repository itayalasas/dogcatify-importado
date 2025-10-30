import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, User, Phone, Mail, Calendar, Heart } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function PartnerClients() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>();
  const { currentUser } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) return;
    
    // Fetch partner profile using Supabase
    const fetchPartnerProfile = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('id', partnerId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setPartnerProfile({
            id: data.id,
            businessName: data.business_name,
            businessType: data.business_type,
            ...data
          });
        }
        
        fetchClients();
      } catch (error) {
        console.error('Error fetching partner profile:', error);
      }
    };
    
    fetchPartnerProfile();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('partner-profile-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'partners',
          filter: `id=eq.${partnerId}`
        }, 
        () => {
          fetchPartnerProfile();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [partnerId]);

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

      // Set up real-time subscriptions for both bookings and orders
      const bookingsSubscription = supabaseClient
        .channel('bookings-changes-clients')
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            filter: `partner_id=eq.${partnerId}`
          },
          () => {
            console.log('Booking changed, refreshing clients');
            fetchClients();
          }
        )
        .subscribe();

      const ordersSubscription = supabaseClient
        .channel('orders-changes-clients')
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `partner_id=eq.${partnerId}`
          },
          () => {
            console.log('Order changed, refreshing clients');
            fetchClients();
          }
        )
        .subscribe();

      return () => {
        bookingsSubscription.unsubscribe();
        ordersSubscription.unsubscribe();
      };
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

  const renderClient = (client: any) => (
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
        
        <TouchableOpacity style={styles.contactButton}>
          <Mail size={16} color="#3B82F6" />
          <Text style={styles.contactButtonText}>Contactar</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

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
              <Text style={styles.statNumber}>
                {clients.filter(client => {
                  if (!client.lastBooking) return false;
                  const daysSince = Math.floor((new Date().getTime() - client.lastBooking.getTime()) / (1000 * 60 * 60 * 24));
                  return daysSince <= 30;
                }).length}
              </Text>
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
          clients.map(renderClient)
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
  contactButtonText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 4,
  },
});