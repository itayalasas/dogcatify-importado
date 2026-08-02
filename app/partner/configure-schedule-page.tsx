import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Clock, X } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { formatDateLabel, generateUruguayHolidayClosures, toLocalDateKey, type ScheduleClosureEntry } from '../../utils/scheduleExceptions';

interface ScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxSlots: number;
  slotDuration: number; // in minutes
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  isActive: boolean;
}

export default function ConfigureSchedulePage() {
  const { partnerId, dayOfWeek } = useLocalSearchParams<{ partnerId: string; dayOfWeek?: string }>();
  const { currentUser } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [closures, setClosures] = useState<ScheduleClosureEntry[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [closuresLoading, setClosuresLoading] = useState(false);
  
  // Form state - permitir selección múltiple de días
  const [selectedDays, setSelectedDays] = useState<number[]>(dayOfWeek ? [parseInt(dayOfWeek)] : []);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [maxSlots, setMaxSlots] = useState('8');
  const [slotDuration, setSlotDuration] = useState('60');
  const [breakEnabled, setBreakEnabled] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState('12:00');
  const [breakEndTime, setBreakEndTime] = useState('13:00');
  const [closureDate, setClosureDate] = useState('');
  const [closureReason, setClosureReason] = useState('');
  const [holidayYear, setHolidayYear] = useState(String(new Date().getFullYear()));

  const daysOfWeek = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
  ];

  const isWalkingBusiness = partnerProfile?.businessType === 'walking';

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
            logo: data.logo,
            ...data
          });
        }
        
        await Promise.all([fetchSchedule(), fetchClosures()]);
      } catch (error) {
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

  const fetchSchedule = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('business_schedule')
        .select('*')
        .eq('partner_id', partnerId)
        .order('day_of_week', { ascending: true });
      
      if (error) throw error;
      
      const scheduleData = data.map(item => ({
        id: item.id,
        dayOfWeek: item.day_of_week,
        startTime: item.start_time,
        endTime: item.end_time,
        maxSlots: item.max_slots,
        slotDuration: item.slot_duration,
        breakStartTime: item.break_start_time,
        breakEndTime: item.break_end_time,
        isActive: item.is_active,
      }));

      const scheduleWithBreak = scheduleData.find(
        (item) => item.breakStartTime && item.breakEndTime,
      );

      if (scheduleWithBreak) {
        setBreakEnabled(true);
        setBreakStartTime(scheduleWithBreak.breakStartTime || '12:00');
        setBreakEndTime(scheduleWithBreak.breakEndTime || '13:00');
      } else {
        setBreakEnabled(false);
      }
      
      // Sort by day of week (Sunday last)
      scheduleData.sort((a, b) => {
        if (a.dayOfWeek === 0) return 1; // Sunday last
        if (b.dayOfWeek === 0) return -1;
        return a.dayOfWeek - b.dayOfWeek;
      });
      
      setSchedule(scheduleData);
    } catch (error) {
    }
  };

  const fetchClosures = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('business_schedule_closures')
        .select('id, partner_id, closed_date, reason, closure_type, source_year, created_at, updated_at')
        .eq('partner_id', partnerId)
        .order('closed_date', { ascending: true });

      if (error) throw error;

      setClosures((data || []).map((item: any) => ({
        id: item.id,
        partner_id: item.partner_id,
        closed_date: item.closed_date,
        reason: item.reason,
        closure_type: item.closure_type,
        source_year: item.source_year,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })));
    } catch (error) {
    }
  };

  const handleAddSchedule = async () => {
    // Validar campos según el tipo de negocio
    const isBoarding = partnerProfile?.businessType === 'boarding';
    const isShop = partnerProfile?.businessType === 'shop';
    const requiresAppointmentFields = !isBoarding && !isShop;

    if (!startTime || !endTime || selectedDays.length === 0) {
      Alert.alert('Error', 'Por favor completa todos los campos y selecciona al menos un día');
      return;
    }

    // Solo validar estos campos si el negocio maneja citas (NO boarding ni shop)
    if (requiresAppointmentFields && (!maxSlots || !slotDuration)) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (breakEnabled) {
      if (!breakStartTime || !breakEndTime) {
        Alert.alert('Error', 'Completa la pausa interna para bloquear ese intervalo');
        return;
      }

      const [breakStartHour, breakStartMinute] = breakStartTime.split(':').map(Number);
      const [breakEndHour, breakEndMinute] = breakEndTime.split(':').map(Number);
      const [scheduleStartHour, scheduleStartMinute] = startTime.split(':').map(Number);
      const [scheduleEndHour, scheduleEndMinute] = endTime.split(':').map(Number);

      const breakStartMinutes = (breakStartHour * 60) + breakStartMinute;
      const breakEndMinutes = (breakEndHour * 60) + breakEndMinute;
      const scheduleStartMinutes = (scheduleStartHour * 60) + scheduleStartMinute;
      const scheduleEndMinutes = (scheduleEndHour * 60) + scheduleEndMinute;

      if (breakEndMinutes <= breakStartMinutes) {
        Alert.alert('Error', 'La pausa debe terminar después de iniciar');
        return;
      }

      if (breakStartMinutes < scheduleStartMinutes || breakEndMinutes > scheduleEndMinutes) {
        Alert.alert('Error', 'La pausa debe estar dentro del horario configurado');
        return;
      }
    }

    // Verificar si alguno de los días seleccionados ya tiene horario
    const existingDays = selectedDays.filter(day => 
      schedule.some(item => item.dayOfWeek === day)
    );
    
    if (existingDays.length > 0) {
      const dayNames = existingDays.map(day => getDayName(day)).join(', ');
      Alert.alert(
        'Días con horario existente', 
        `Ya existe un horario para: ${dayNames}. Estos días serán omitidos.`,
        [
          { 
            text: 'Cancelar', 
            style: 'cancel' 
          },
          { 
            text: 'Continuar con el resto', 
            onPress: () => {
              // Filtrar los días que ya tienen horario
              const availableDays = selectedDays.filter(day => 
                !schedule.some(item => item.dayOfWeek === day)
              );
              if (availableDays.length > 0) {
                createSchedules(availableDays);
              } else {
                Alert.alert('No hay días disponibles', 'Todos los días seleccionados ya tienen horario configurado.');
              }
            }
          }
        ]
      );
    } else {
      createSchedules(selectedDays);
    }
  };

  const createSchedules = async (days: number[]) => {
    setLoading(true);
    try {
      // Determinar el tipo de negocio
      const isBoarding = partnerProfile?.businessType === 'boarding';
      const isShop = partnerProfile?.businessType === 'shop';
      const requiresAppointmentFields = !isBoarding && !isShop;

      // Crear un horario para cada día seleccionado
      const promises = days.map(async (day) => {
        const scheduleData = {
          partner_id: partnerId,
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
          break_start_time: breakEnabled ? breakStartTime : null,
          break_end_time: breakEnabled ? breakEndTime : null,
          // Para boarding y shop, usar 0 ya que no manejan citas
          max_slots: requiresAppointmentFields ? parseInt(maxSlots) : 0,
          slot_duration: requiresAppointmentFields ? parseInt(slotDuration) : 0,
          is_active: true,
          created_at: new Date().toISOString(),
        };

        const { error } = await supabaseClient
          .from('business_schedule')
          .insert(scheduleData);

        if (error) throw error;
      });
      
      await Promise.all(promises);
      
      // Reset form
      setSelectedDays([]);
      setStartTime('09:00');
      setEndTime('17:00');
      setMaxSlots('8');
      setSlotDuration('60');
      
      Alert.alert('Éxito', 'Horario agregado correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar el horario');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async (scheduleId: string, isActive: boolean) => {
    try {
      const { error } = await supabaseClient
        .from('business_schedule')
        .update({
          is_active: !isActive,
        })
        .eq('id', scheduleId);
      
      if (error) throw error;
      
      // Refresh the schedule data
      fetchSchedule();
    } catch (error) {
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
              const { error } = await supabaseClient
                .from('business_schedule')
                .delete()
                .eq('id', scheduleId);
              
              if (error) throw error;
              
              Alert.alert('Éxito', 'Horario eliminado correctamente');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el horario');
            }
          }
        }
      ]
    );
  };

  const handleAddClosure = async () => {
    const normalizedDate = toLocalDateKey(closureDate);

    if (!normalizedDate) {
      Alert.alert('Error', 'Ingresa una fecha válida con formato AAAA-MM-DD');
      return;
    }

    setClosuresLoading(true);
    try {
      const now = new Date().toISOString();
      const reason = closureReason.trim() || 'Cierre manual';

      const { error } = await supabaseClient
        .from('business_schedule_closures')
        .upsert([
          {
            partner_id: partnerId,
            closed_date: normalizedDate,
            reason,
            closure_type: 'manual',
            source_year: new Date(`${normalizedDate}T12:00:00`).getFullYear(),
            created_at: now,
            updated_at: now,
          },
        ], {
          onConflict: 'partner_id,closed_date',
        });

      if (error) throw error;

      setClosureDate('');
      setClosureReason('');
      await fetchClosures();
      Alert.alert('Éxito', 'El día quedó bloqueado en la agenda');
    } catch (error) {
      Alert.alert('Error', 'No se pudo bloquear el día');
    } finally {
      setClosuresLoading(false);
    }
  };

  const handleDeleteClosure = (closureId: string) => {
    Alert.alert(
      'Eliminar cierre',
      '¿Quieres volver a habilitar este día en la agenda?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('business_schedule_closures')
                .delete()
                .eq('id', closureId);

              if (error) throw error;

              await fetchClosures();
              Alert.alert('Éxito', 'El día volvió a estar disponible');
            } catch (error) {
              Alert.alert('Error', 'No se pudo quitar el cierre');
            }
          },
        },
      ]
    );
  };

  const handleLoadHolidayClosures = async () => {
    const year = Math.trunc(Number(holidayYear));

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      Alert.alert('Error', 'Ingresa un año válido');
      return;
    }

    const holidaySeeds = generateUruguayHolidayClosures(year);
    if (holidaySeeds.length === 0) {
      Alert.alert('Error', 'No se pudieron generar los feriados para ese año');
      return;
    }

    setClosuresLoading(true);
    try {
      const now = new Date().toISOString();
      const payload = holidaySeeds.map((seed) => ({
        partner_id: partnerId,
        closed_date: seed.closed_date,
        reason: seed.reason,
        closure_type: seed.closure_type,
        source_year: seed.source_year,
        created_at: now,
        updated_at: now,
      }));

      const { error } = await supabaseClient
        .from('business_schedule_closures')
        .upsert(payload, {
          onConflict: 'partner_id,closed_date',
        });

      if (error) throw error;

      await fetchClosures();
      Alert.alert('Éxito', `Se cargaron los feriados del ${year}`);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los feriados');
    } finally {
      setClosuresLoading(false);
    }
  };

  const getDayName = (dayOfWeek: number) => {
    const day = daysOfWeek.find(d => d.value === dayOfWeek);
    return day ? day.label : 'Desconocido';
  };

  const toggleDaySelection = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const isDayAvailable = (day: number) => {
    const usedDays = schedule.map(item => item.dayOfWeek);
    return !usedDays.includes(day);
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
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>⏰ Horarios de Trabajo</Text>
          <Text style={styles.infoDescription}>
            {isWalkingBusiness
              ? 'Define tus horarios de paseo y cuántos turnos puedes aceptar en cada franja.'
              : 'Define tus horarios de trabajo para que los clientes puedan hacer reservas'}
          </Text>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Agregar Nuevo Horario</Text>
          
          <View style={styles.daySelector}>
            <Text style={styles.selectorLabel}>Días de la semana (selecciona uno o varios)</Text>
            <View style={styles.dayOptions}>
              {daysOfWeek.map((day) => {
                const isAvailable = isDayAvailable(day.value);
                const isSelected = selectedDays.includes(day.value);
                return (
                  <TouchableOpacity
                    key={day.value}
                    style={[
                      styles.dayOption,
                      isSelected && styles.selectedDayOption,
                      !isAvailable && styles.disabledDayOption
                    ]}
                    onPress={() => isAvailable && toggleDaySelection(day.value)}
                    disabled={!isAvailable}
                  >
                    <Text style={[
                      styles.dayOptionText,
                      isSelected && styles.selectedDayOptionText,
                      !isAvailable && styles.disabledDayOptionText
                    ]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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

          {/* Solo mostrar estos campos si es un negocio que maneja citas (NO pensión ni tienda) */}
          {partnerProfile?.businessType !== 'boarding' && partnerProfile?.businessType !== 'shop' && (
            <>
              <Input
                label={isWalkingBusiness ? 'Cantidad de turnos por horario' : 'Máximo de citas por horario'}
                placeholder={isWalkingBusiness ? '3' : '8'}
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
            </>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.addButton}
              onPress={handleAddSchedule}
              disabled={loading}
            >
              <Text style={styles.addButtonText}>
                {loading ? "Agregando..." : "Agregar Horario"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.breakSection}>
            <View style={styles.breakHeader}>
              <Text style={styles.sectionTitle}>Pausa interna opcional</Text>
              <Switch
                value={breakEnabled}
                onValueChange={setBreakEnabled}
                trackColor={{ false: '#D1D5DB', true: '#60A5FA' }}
                thumbColor={breakEnabled ? '#2563EB' : '#F9FAFB'}
              />
            </View>
            <Text style={styles.breakHelperText}>
              Este bloque se oculta a los clientes y sirve para almuerzo, descanso o tareas internas.
            </Text>
            {breakEnabled && (
              <View style={styles.timeInputs}>
                <View style={styles.timeInput}>
                  <Input
                    label="Inicio de pausa"
                    placeholder="12:00"
                    value={breakStartTime}
                    onChangeText={setBreakStartTime}
                    leftIcon={<Clock size={20} color="#6B7280" />}
                  />
                </View>
                <View style={styles.timeInput}>
                  <Input
                    label="Fin de pausa"
                    placeholder="13:00"
                    value={breakEndTime}
                    onChangeText={setBreakEndTime}
                    leftIcon={<Clock size={20} color="#6B7280" />}
                  />
                </View>
              </View>
            )}
          </View>
        </Card>

        {schedule.length > 0 && (
          <Card style={styles.scheduleListCard}>
            <Text style={styles.sectionTitle}>Horarios Configurados</Text>
            <View style={styles.scheduleList}>
              {schedule.map((item) => (
                <View key={item.id} style={styles.scheduleCard}>
                  <View style={styles.scheduleHeader}>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.dayName}>{getDayName(item.dayOfWeek)}</Text>
                      <Text style={styles.timeRange}>
                        {item.startTime} - {item.endTime}
                      </Text>
                      {item.breakStartTime && item.breakEndTime && (
                        <Text style={styles.breakSummary}>
                          Pausa: {item.breakStartTime} - {item.breakEndTime}
                        </Text>
                      )}
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

                  {partnerProfile?.businessType !== 'boarding' && partnerProfile?.businessType !== 'shop' && (
                    <View style={styles.scheduleDetails}>
                      <Text style={styles.scheduleDetail}>
                        {isWalkingBusiness ? `Hasta ${item.maxSlots} turnos por horario` : `Máximo ${item.maxSlots} citas por horario`}
                      </Text>
                      <Text style={styles.scheduleDetail}>
                        Duración por cita: {item.slotDuration} minutos
                      </Text>
                    </View>
                  )}

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
                </View>
              ))}
            </View>
          </Card>
        )}

        <Card style={styles.closureCard}>
          <Text style={styles.sectionTitle}>Cierres y feriados</Text>
          <Text style={styles.breakHelperText}>
            Bloquea días completos por feriados, aniversarios, reparaciones o descansos especiales.
          </Text>

          <Input
            label="Fecha cerrada"
            placeholder="2026-07-18"
            value={closureDate}
            onChangeText={setClosureDate}
          />

          <Input
            label="Motivo"
            placeholder="Feriado, reparación, aniversario..."
            value={closureReason}
            onChangeText={setClosureReason}
          />

          <Input
            label="Año para feriados"
            placeholder="2026"
            value={holidayYear}
            onChangeText={setHolidayYear}
            keyboardType="numeric"
          />

          <View style={styles.closureButtonsRow}>
            <Button
              title={closuresLoading ? 'Guardando...' : 'Agregar cierre'}
              onPress={handleAddClosure}
              loading={closuresLoading}
              disabled={closuresLoading}
              variant="primary"
              size="medium"
            />
            <Button
              title={closuresLoading ? 'Cargando...' : `Cargar feriados ${holidayYear || new Date().getFullYear()}`}
              onPress={handleLoadHolidayClosures}
              loading={closuresLoading}
              disabled={closuresLoading}
              variant="outline"
              size="medium"
            />
          </View>

          {closures.length > 0 ? (
            <View style={styles.closureList}>
              {closures.map((closure) => (
                <View key={closure.id} style={styles.closureItem}>
                  <View style={styles.closureItemInfo}>
                    <Text style={styles.closureItemDate}>
                      {formatDateLabel(closure.closed_date)}
                    </Text>
                    <Text style={styles.closureItemReason}>
                      {closure.reason || (closure.closure_type === 'holiday' ? 'Feriado' : 'Cierre manual')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closureDeleteButton}
                    onPress={() => closure.id && handleDeleteClosure(closure.id)}
                  >
                    <X size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyClosuresText}>Todavía no hay días bloqueados.</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: 50, // Añadir padding superior para el encabezado
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
  content: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  infoCard: {
    marginBottom: 16,
    padding: 20,
  },
  infoTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  formCard: {
    marginBottom: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  daySelector: {
    marginBottom: 20,
  },
  selectorLabel: { 
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 12,
  },
  dayOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: 8,
  },
  dayOption: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    margin: 4,
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  selectedDayOption: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  disabledDayOption: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.4,
  },
  dayOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedDayOptionText: {
    color: '#FFFFFF',
  },
  disabledDayOptionText: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  timeInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    marginTop: 24,
    gap: 12,
  },
  timeInput: { 
    flex: 1,
  },
  breakSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  breakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  breakHelperText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D6A6F',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
  },
  addButton: {
    width: '100%',
    backgroundColor: '#2D6A6F',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleListCard: {
    marginBottom: 16,
  },
  scheduleList: {
    gap: 12,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
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
  breakSummary: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#0F766E',
    marginTop: 2,
  },
  scheduleActions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  scheduleActionButton: {
    width: '100%',
    minHeight: 44,
  },
  deleteButton: {
    width: '100%',
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8, 
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  closureCard: {
    marginBottom: 16,
    padding: 20,
  },
  closureButtonsRow: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16,
  },
  closureList: {
    gap: 12,
  },
  closureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  closureItemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  closureItemDate: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  closureItemReason: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  closureDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyClosuresText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
});
