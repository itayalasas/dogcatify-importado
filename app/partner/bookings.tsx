import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, User, Phone, Check, X, Eye } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { NotificationService } from '../../utils/notifications';

export default function PartnerBookings() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>();
  const { currentUser } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'completed'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) return;

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('partnerId', '==', partnerId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));
      setBookings(bookingsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [partnerId]);

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, {
        status: newStatus,
        updatedAt: new Date(),
      });

      // Get booking details to send email
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      if (bookingDoc.exists()) {
        const bookingData = bookingDoc.data();
        
        // Send appropriate email based on status
        try {
          if (newStatus === 'confirmed') {
            // Send confirmation email
            await NotificationService.sendBookingConfirmationEmail(
              bookingData.customerEmail || '',
              bookingData.customerName || 'Usuario',
              bookingData.serviceName || 'Servicio',
              bookingData.partnerName || 'Proveedor',
              bookingData.date.toDate().toLocaleDateString(),
              bookingData.time || '',
              bookingData.petName || 'Mascota'
            );
          } else if (newStatus === 'cancelled') {
            // Send cancellation email
            await NotificationService.sendBookingCancellationEmail(
              bookingData.customerEmail || '',
              bookingData.customerName || 'Usuario',
              bookingData.serviceName || 'Servicio',
              bookingData.partnerName || 'Proveedor',
              bookingData.date.toDate().toLocaleDateString(),
              bookingData.time || ''
            );
          }
        } catch (emailError) {
          console.error('Error sending booking status email:', emailError);
          // Continue with status update even if email fails
        }
      }
      
      const statusMessages = {
        confirmed: 'Reserva confirmada',
        completed: 'Reserva marcada como completada',
        cancelled: 'Reserva cancelada'
      };
      
      Alert.alert('Éxito', statusMessages[newStatus as keyof typeof statusMessages]);
    } catch (error) {
      console.error('Error updating booking status:', error);
      Alert.alert('Error', 'No se pudo actualizar la reserva');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FEF3C7';
      case 'confirmed': return '#D1FAE5';
      case 'completed': return '#DBEAFE';
      case 'cancelled': return '#FEE2E2';
      default: return '#F3F4F6';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'pending': return '#92400E';
      case 'confirmed': return '#065F46';
      case 'completed': return '#1E40AF';
      case 'cancelled': return '#991B1B';
      default: return '#374151';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmada';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return 'Desconocido';
    }
  };

  const filteredBookings = bookings.filter(booking => booking.status === activeTab);

  const renderBooking = (booking: any) => (
    <Card key={booking.id} style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.serviceName}>{booking.serviceName || 'Servicio'}</Text>
          <Text style={styles.customerName}>
            {booking.customerName || 'Cliente'}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(booking.status) }
        ]}>
          <Text style={[
            styles.statusText,
            { color: getStatusTextColor(booking.status) }
          ]}>
            {getStatusText(booking.status)}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.bookingDetail}>
          <Calendar size={16} color="#6B7280" />
          <Text style={styles.bookingDetailText}>
            {booking.date.toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.bookingDetail}>
          <Clock size={16} color="#6B7280" />
          <Text style={styles.bookingDetailText}>
            {booking.time || 'Hora no especificada'}
          </Text>
        </View>
        
        {booking.petName && (
          <View style={styles.bookingDetail}>
            <User size={16} color="#6B7280" />
            <Text style={styles.bookingDetailText}>
              Mascota: {booking.petName}
            </Text>
          </View>
        )}
        
        {booking.customerPhone && (
          <View style={styles.bookingDetail}>
            <Phone size={16} color="#6B7280" />
            <Text style={styles.bookingDetailText}>
              {booking.customerPhone}
            </Text>
          </View>
        )}
      </View>

      {booking.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>Notas:</Text>
          <Text style={styles.notesText}>{booking.notes}</Text>
        </View>
      )}

      <View style={styles.bookingActions}>
        {booking.status === 'pending' && (
          <>
            <Button
              title="Rechazar"
              onPress={() => handleUpdateBookingStatus(booking.id, 'cancelled')}
              variant="outline"
              size="small"
            />
            <Button
              title="Confirmar"
              onPress={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
              size="small"
            />
          </>
        )}
        
        {booking.status === 'confirmed' && (
          <Button
            title="Marcar Completada"
            onPress={() => handleUpdateBookingStatus(booking.id, 'completed')}
            size="small"
          />
        )}
        
        <TouchableOpacity style={styles.viewButton}>
          <Eye size={16} color="#3B82F6" />
          <Text style={styles.viewButtonText}>Ver Detalles</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando reservas...</Text>
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
        <Text style={styles.title}>Reservas</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pendientes ({bookings.filter(b => b.status === 'pending').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'confirmed' && styles.activeTab]}
          onPress={() => setActiveTab('confirmed')}
        >
          <Text style={[styles.tabText, activeTab === 'confirmed' && styles.activeTabText]}>
            Confirmadas ({bookings.filter(b => b.status === 'confirmed').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completadas ({bookings.filter(b => b.status === 'completed').length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredBookings.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Calendar size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>
              No hay reservas {activeTab === 'pending' ? 'pendientes' : activeTab === 'confirmed' ? 'confirmadas' : 'completadas'}
            </Text>
            <Text style={styles.emptySubtitle}>
              Las reservas aparecerán aquí cuando los clientes soliciten tus servicios
            </Text>
          </Card>
        ) : (
          filteredBookings.map(renderBooking)
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 6,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
    padding: 16,
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
  bookingCard: {
    marginBottom: 12,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  customerName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  bookingDetails: {
    marginBottom: 12,
  },
  bookingDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bookingDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 6,
  },
  notesSection: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  bookingActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 4,
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
  },
});