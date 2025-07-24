import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Clock, CircleAlert as AlertCircle, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient, getPet } from '../../../lib/supabase';

export default function PetAppointments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [pet, setPet] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (!id) return;
    
    fetchPetDetails();
    fetchAppointments();
  }, [id]);

  const fetchPetDetails = async () => {
    try {
      const petData = await getPet(id as string);
      setPet(petData);
    } catch (error) {
      console.error('Error fetching pet details:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const { data: appointmentsData, error } = await supabaseClient
        .from('bookings')
        .select('*')
        .eq('pet_id', id)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      const formattedAppointments = appointmentsData?.map(appointment => ({
        ...appointment,
        date: appointment.date ? new Date(appointment.date) : new Date(),
        serviceName: appointment.service_name,
        partnerName: appointment.partner_name,
      })) || [];
      
      setAppointments(formattedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertCircle size={16} color="#92400E" />;
      case 'confirmed': return <CheckCircle size={16} color="#065F46" />;
      case 'completed': return <CheckCircle size={16} color="#1E40AF" />;
      case 'cancelled': return <AlertCircle size={16} color="#991B1B" />;
      default: return <Clock size={16} color="#374151" />;
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    const now = new Date();
    if (activeTab === 'upcoming') {
      return appointment.date >= now || appointment.status === 'pending' || appointment.status === 'confirmed';
    } else {
      return appointment.date < now || appointment.status === 'completed' || appointment.status === 'cancelled';
    }
  });

  const handleBookAppointment = () => {
    router.push('/(tabs)/services');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Citas</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando citas...</Text>
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
        <Text style={styles.title}>Citas</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.petInfo}>
        <Text style={styles.petName}>{pet?.name || 'Mascota'}</Text>
        <Text style={styles.petBreed}>{pet?.breed || 'Raza no especificada'}</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Próximas Citas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Historial
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.appointmentsCard}>
          <View style={styles.calendarHeader}>
            <Calendar size={20} color="#3B82F6" />
            <Text style={styles.calendarTitle}>
              {activeTab === 'upcoming' ? 'Próximas Citas' : 'Historial de Citas'}
            </Text>
          </View>

          {filteredAppointments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                No hay {activeTab === 'upcoming' ? 'próximas citas' : 'historial de citas'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'upcoming' 
                  ? 'Programa una cita para tu mascota' 
                  : 'Las citas completadas aparecerán aquí'}
              </Text>
              {activeTab === 'upcoming' && (
                <Button
                  title="Reservar Cita"
                  onPress={handleBookAppointment}
                  size="medium"
                />
              )}
            </View>
          ) : (
            filteredAppointments.map((appointment) => (
              <View key={appointment.id} style={styles.appointmentItem}>
                <View style={styles.appointmentHeader}>
                  <Text style={styles.appointmentService}>{appointment.serviceName}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(appointment.status) }
                  ]}>
                    {getStatusIcon(appointment.status)}
                    <Text style={[
                      styles.statusText,
                      { color: getStatusTextColor(appointment.status) }
                    ]}>
                      {getStatusText(appointment.status)}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.appointmentProvider}>{appointment.partnerName}</Text>
                
                <View style={styles.appointmentDetails}>
                  <View style={styles.appointmentDetail}>
                    <Calendar size={16} color="#6B7280" />
                    <Text style={styles.appointmentDetailText}>
                      {appointment.date.toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <View style={styles.appointmentDetail}>
                    <Clock size={16} color="#6B7280" />
                    <Text style={styles.appointmentDetailText}>
                      {appointment.time}
                    </Text>
                  </View>
                </View>
                
                {appointment.notes && (
                  <Text style={styles.appointmentNotes}>
                    Notas: {appointment.notes}
                  </Text>
                )}
              </View>
            ))
          )}
        </Card>
        
        {activeTab === 'upcoming' && (
          <View style={styles.bookButtonContainer}>
            <Button
              title="Reservar Nueva Cita"
              onPress={handleBookAppointment}
              size="large"
            />
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
  petInfo: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  petName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  petBreed: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
    fontSize: 14,
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
  appointmentsCard: {
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  appointmentItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  appointmentService: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
  appointmentProvider: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
  },
  appointmentDetails: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  appointmentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  appointmentDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 6,
  },
  appointmentNotes: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  bookButtonContainer: {
    marginBottom: 24,
  },
});