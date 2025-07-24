import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Clock, X, Check } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

interface ScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxSlots: number;
  slotDuration: number; // in minutes
  isActive: boolean;
}

export default function ConfigureSchedule() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>();
  const { currentUser } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [selectedDay, setSelectedDay] = useState(1); // Monday
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [maxSlots, setMaxSlots] = useState('8');
  const [slotDuration, setSlotDuration] = useState('60');

  const daysOfWeek = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
  ];

  useEffect(() => {
    if (!partnerId) return;
    
    // Fetch partner profile
    const partnerRef = doc(db, 'partners', partnerId);
    const unsubscribePartner = onSnapshot(partnerRef, (doc) => {
      if (doc.exists()) {
        setPartnerProfile({ id: doc.id, ...doc.data() });
      }
      fetchSchedule();
    });
    
    return () => unsubscribePartner();
  }, [partnerId]);

  const fetchSchedule = () => {
    const scheduleQuery = query(
      collection(db, 'businessSchedule'),
      where('partnerId', '==', partnerId)
    );

    const unsubscribe = onSnapshot(scheduleQuery, (snapshot) => {
      const scheduleData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduleItem[];
      
      // Sort by day of week
      scheduleData.sort((a, b) => {
        if (a.dayOfWeek === 0) return 1; // Sunday last
        if (b.dayOfWeek === 0) return -1;
        return a.dayOfWeek - b.dayOfWeek;
      });
      
      setSchedule(scheduleData);
    });

    return unsubscribe;
  };

  const handleAddSchedule = async () => {
    if (!startTime || !endTime || !maxSlots || !slotDuration) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    // Check if schedule already exists for this day
    const existingSchedule = schedule.find(item => item.dayOfWeek === selectedDay);
    if (existingSchedule) {
      Alert.alert('Error', 'Ya existe un horario para este día. Puedes editarlo o eliminarlo.');
      return;
    }

    setLoading(true);
    try {
      const scheduleData = {
        partnerId,
        dayOfWeek: selectedDay,
        startTime,
        endTime,
        maxSlots: parseInt(maxSlots),
        slotDuration: parseInt(slotDuration),
        isActive: true,
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'businessSchedule'), scheduleData);
      
      // Reset form
      setSelectedDay(1);
      setStartTime('09:00');
      setEndTime('17:00');
      setMaxSlots('8');
      setSlotDuration('60');
      setShowAddModal(false);
      
      Alert.alert('Éxito', 'Horario agregado correctamente');
    } catch (error) {
      console.error('Error adding schedule:', error);
      Alert.alert('Error', 'No se pudo agregar el horario');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async (scheduleId: string, isActive: boolean) => {
    try {
      const scheduleRef = doc(db, 'businessSchedule', scheduleId);
      await updateDoc(scheduleRef, {
        isActive: !isActive,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error toggling schedule:', error);
      Alert.alert('Error', 'No se pudo actualizar el horario');
    }
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    Alert.alert(
      'Eliminar Horario',
      '¿Estás seguro de que quieres eliminar este horario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'businessSchedule', scheduleId));
              Alert.alert('Éxito', 'Horario eliminado correctamente');
            } catch (error) {
              console.error('Error deleting schedule:', error);
              Alert.alert('Error', 'No se pudo eliminar el horario');
            }
          }
        }
      ]
    );
  };

  const getDayName = (dayOfWeek: number) => {
    const day = daysOfWeek.find(d => d.value === dayOfWeek);
    return day ? day.label : 'Desconocido';
  };

  const getAvailableDays = () => {
    const usedDays = schedule.map(item => item.dayOfWeek);
    return daysOfWeek.filter(day => !usedDays.includes(day.value));
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
                   partnerProfile?.businessType === 'shop' ? '🛍️' : '⏰'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.title}>Configurar Horarios</Text>
              <Text style={styles.businessName}>{partnerProfile?.businessName}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.addButton, getAvailableDays().length === 0 && styles.disabledButton]} 
          onPress={() => setShowAddModal(true)}
          disabled={getAvailableDays().length === 0}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>⏰ Horarios de Trabajo</Text>
          <Text style={styles.infoDescription}>
            Define tus horarios de trabajo para que los clientes puedan hacer reservas
          </Text>
        </Card>

        {schedule.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Clock size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No hay horarios configurados</Text>
            <Text style={styles.emptySubtitle}>
              Agrega tu primer horario para comenzar a recibir reservas
            </Text>
            <Button
              title="Agregar Horario"
              onPress={() => setShowAddModal(true)}
              size="medium"
            />
          </Card>
        ) : (
          <View style={styles.scheduleList}>
            {schedule.map((item) => (
              <Card key={item.id} style={styles.scheduleCard}>
                <View style={styles.scheduleHeader}>
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.dayName}>{getDayName(item.dayOfWeek)}</Text>
                    <Text style={styles.timeRange}>
                      {item.startTime} - {item.endTime}
                    </Text>
                  </View>
                  <View style={[
                    styles.scheduleStatus,
                    { backgroundColor: item.isActive ? '#D1FAE5' : '#FEE2E2' }
                  ]}>
                    <Text style={[
                      styles.scheduleStatusText,
                      { color: item.isActive ? '#065F46' : '#991B1B' }
                    ]}>
                      {item.isActive ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
                </View>

                <View style={styles.scheduleDetails}>
                  <Text style={styles.scheduleDetail}>
                    Máximo {item.maxSlots} citas por día
                  </Text>
                  <Text style={styles.scheduleDetail}>
                    Duración por cita: {item.slotDuration} minutos
                  </Text>
                </View>

                <View style={styles.scheduleActions}>
                  <Button
                    title={item.isActive ? 'Desactivar' : 'Activar'}
                    onPress={() => handleToggleSchedule(item.id, item.isActive)}
                    variant={item.isActive ? 'outline' : 'primary'}
                    size="small"
                  />
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteSchedule(item.id)}
                  >
                    <X size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Schedule Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Horario</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <View>
                {getAvailableDays().length > 0 ? (
                  <View style={styles.daySelector}>
                    <Text style={styles.selectorLabel}>Selecciona un día:</Text>
                    <View style={styles.dayOptions}>
                      {getAvailableDays().map((day) => (
                        <TouchableOpacity
                          key={day.value}
                          style={[
                            styles.dayOption,
                            selectedDay === day.value && styles.selectedDayOption
                          ]}
                          onPress={() => setSelectedDay(day.value)}
                        >
                          <Text style={[
                            styles.dayOptionText,
                            selectedDay === day.value && styles.selectedDayOptionText
                          ]}>
                            {day.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.noMoreDaysContainer}>
                    <Text style={styles.noMoreDaysText}>
                      Ya has configurado todos los días disponibles.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.timeInputs}>
                <View style={styles.timeInput}>
                  <Input
                    label="Hora de inicio"
                    placeholder="09:00"
                    value={startTime}
                    onChangeText={setStartTime}
                    leftIcon={<Clock size={20} color="#6B7280" />}
                  />
                </View>
                <View style={styles.timeInput}>
                  <Input
                    label="Hora de fin"
                    placeholder="17:00"
                    value={endTime}
                    onChangeText={setEndTime}
                    leftIcon={<Clock size={20} color="#6B7280" />}
                  />
                </View>
              </View>

              <Input
                label="Máximo de citas por día"
                placeholder="8"
                value={maxSlots}
                onChangeText={setMaxSlots}
                keyboardType="numeric"
              />

              <Input
                label="Duración por cita (minutos)"
                placeholder="60"
                value={slotDuration}
                onChangeText={setSlotDuration}
                keyboardType="numeric"
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={() => setShowAddModal(false)}
                variant="outline"
                size="medium"
              />
              <Button
                title="Agregar"
                onPress={handleAddSchedule}
                loading={loading}
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'flex-end',
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
  addButton: {
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  scheduleList: {
    gap: 12,
  },
  scheduleCard: {
    padding: 16,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scheduleInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  timeRange: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  scheduleStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scheduleStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  scheduleDetails: {
    marginBottom: 16,
  },
  scheduleDetail: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  scheduleActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  modalForm: {
    flex: 1,
    marginBottom: 20,
  },
  daySelector: {
    marginBottom: 20,
  },
  selectorLabel: { 
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  dayOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap', 
    marginTop: 8,
  },
  dayOption: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 4, 
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedDayOption: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  dayOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedDayOptionText: {
    color: '#FFFFFF',
  },
  timeInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16, 
  },
  timeInput: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12, 
  },
  noMoreDaysContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    marginBottom: 20,
  },
  noMoreDaysText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
    textAlign: 'center',
  }
});