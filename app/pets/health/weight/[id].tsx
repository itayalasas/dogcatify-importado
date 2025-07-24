import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Scale, Plus, Info } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card } from '../../../../components/ui/Card';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';

const screenWidth = Dimensions.get('window').width;

interface WeightRecord {
  id: string;
  pet_id: string;
  user_id: string;
  weight: number;
  weight_unit: string;
  date: string;
  notes: string;
  created_at: string;
}

export default function PetWeight() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  
  const [pet, setPet] = useState<any>(null);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeRange, setTimeRange] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('3m');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const loadPetData = async () => {
      await fetchPetDetails();
      await fetchWeightRecords();
    };
    
    loadPetData();
  }, [id]);

  useEffect(() => {
    // Si no hay registros de peso y tenemos datos del pet, crear un registro inicial
    if (weightRecords.length === 0 && pet && pet.weight) {
      createInitialWeightRecord();
    }
  }, [pet, weightRecords]);

  const createInitialWeightRecord = async () => {
    if (!pet || !pet.weight || !currentUser) return;
    
    try {
      // Crear un registro de peso inicial con la fecha de creación de la mascota
      const initialDate = pet.created_at ? new Date(pet.created_at) : new Date();
      const formattedDate = formatDate(initialDate);
      
      const initialWeightData = {
        pet_id: id,
        user_id: currentUser.id,
        type: 'weight',
        weight: pet.weight,
        weight_unit: pet.weightDisplay?.unit || 'kg',
        date: formattedDate,
        notes: 'Peso inicial al registrar la mascota',
        created_at: new Date().toISOString()
      };
      
      const { error } = await supabaseClient.from('pet_health').insert(initialWeightData);
      
      if (error) {
        console.error('Error creating initial weight record:', error);
      } else {
        // Actualizar la lista de registros
        fetchWeightRecords();
      }
    } catch (error) {
      console.error('Error creating initial weight record:', error);
    }
  };

  const fetchPetDetails = async () => {
    fetchWeightRecords();
    try {
      const { data, error } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setPet(data);
      
      // Set initial weight from pet data
      if (data.weight) {
        setWeight(data.weight.toString());
      }
      
      // Set initial weight unit from pet data
      if (data.weightDisplay?.unit) {
        setWeightUnit(data.weightDisplay.unit);
      }
    } catch (error) {
      console.error('Error fetching pet details:', error);
    }
  };

  const fetchWeightRecords = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pet_health')
        .select('*')
        .eq('pet_id', id)
        .eq('type', 'weight')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      const formattedRecords = data.map(record => ({
        id: record.id,
        pet_id: record.pet_id,
        user_id: record.user_id,
        weight: parseFloat(record.weight || '0'),
        weight_unit: record.weight_unit || 'kg',
        date: record.date || '',
        notes: record.notes || '',
        created_at: record.created_at
      }));
      
      setWeightRecords(formattedRecords);
    } catch (error) {
      console.error('Error fetching weight records:', error);
    }
  };

  const formatDate = (date: Date) => {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleAddWeight = async () => {
    if (!weight) {
      Alert.alert('Error', 'Por favor ingresa el peso');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    setLoading(true);
    try {
      const healthData = {
        pet_id: id,
        user_id: currentUser.id,
        type: 'weight',
        weight: parseFloat(weight),
        weight_unit: weightUnit,
        date: formatDate(date),
        notes: notes.trim() || null,
        created_at: new Date().toISOString()
      };
      
      const { error } = await supabaseClient.from('pet_health').insert(healthData);

      if (error) throw error;

      // Also update the current weight in the pet record
      const { error: updateError } = await supabaseClient
        .from('pets')
        .update({
          weight: parseFloat(weight),
          weight_display: {
            value: parseFloat(weight),
            unit: weightUnit
          }
        })
        .eq('id', id);
      
      if (updateError) throw updateError;

      Alert.alert('Éxito', 'Peso registrado correctamente');
      setShowAddForm(false);
      setNotes('');
      fetchWeightRecords();
      fetchPetDetails();
    } catch (error) {
      console.error('Error saving weight:', error);
      Alert.alert('Error', 'No se pudo registrar el peso');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRecords = () => {
    if (timeRange === 'all') return weightRecords;
    
    const now = new Date();
    let cutoffDate;
    
    switch (timeRange) {
      case '1m':
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
      case '3m':
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 3);
        break;
      case '6m':
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 6);
        break;
      case '1y':
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 12);
        break;
      default:
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    }
    
    return weightRecords.filter(record => {
      if (!record.date) return false;
      const recordDate = parseDate(record.date);
      return recordDate >= cutoffDate;
    });
  };

  const parseDate = (dateString: string) => {
    // Parse date in format dd/mm/yyyy
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  const getChartData = () => {
    const filteredRecords = getFilteredRecords();
    
    // Simple chart data without external dependencies
    return filteredRecords.map(record => ({
      date: record.date,
      weight: record.weight
    }));
  };

  const chartData = getChartData();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity> 
        <Text style={styles.title}>Seguimiento de Peso</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.infoCard}>
          <View style={styles.iconContainer}>
            <Scale size={40} color="#3B82F6" />
          </View>
          <Text style={styles.infoTitle}>Seguimiento de Peso</Text>
          <Text style={styles.infoDescription}>
            Registra el peso de tu mascota regularmente para monitorear su salud.
          </Text>
          {!showAddForm ? (
            <Button
             title="Agregar Peso"
              onPress={() => setShowAddForm(true)}
              size="large"
            />
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.weightInputRow}>
                <View style={styles.weightInput}>
                  <Input
                    label="Peso *"
                    placeholder="0.0"
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.unitSelector}>
                  <Text style={styles.unitLabel}>Unidad</Text>
                  <View style={styles.unitButtons}>
                    <TouchableOpacity
                      style={[styles.unitButton, weightUnit === 'kg' && styles.selectedUnitButton]}
                      onPress={() => setWeightUnit('kg')}
                    >
                      <Text style={[styles.unitButtonText, weightUnit === 'kg' && styles.selectedUnitButtonText]}>kg</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitButton, weightUnit === 'lb' && styles.selectedUnitButton]}
                      onPress={() => setWeightUnit('lb')}
                    >
                      <Text style={[styles.unitButtonText, weightUnit === 'lb' && styles.selectedUnitButtonText]}>lb</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.dateInputContainer}>
                <Text style={styles.dateInputLabel}>Fecha *</Text>
                <TouchableOpacity 
                  style={styles.dateInput}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Calendar size={20} color="#6B7280" />
                  <Text style={styles.dateInputText}>
                    {formatDate(date)}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                  />
                )}
              </View>

              <Input
                label="Notas"
                placeholder="Observaciones, condiciones, etc."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.formButtons}>
                <Button
                  title="Cancelar"
                  onPress={() => setShowAddForm(false)}
                  variant="outline"
                  size="large"
                  style={styles.formButton}
                />
                <Button
                  title="Guardar"
                  onPress={handleAddWeight}
                  loading={loading}
                  size="large"
                  style={styles.formButton}
                />
              </View>
            </View>
          )}
        </Card>

        {weightRecords.length > 0 && (
          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>Gráfica de Peso</Text>
            
            <View style={styles.timeRangeSelector}>
              <TouchableOpacity
                style={[styles.timeRangeButton, timeRange === '1m' && styles.selectedTimeRange]}
                onPress={() => setTimeRange('1m')}
              >
                <Text style={[styles.timeRangeText, timeRange === '1m' && styles.selectedTimeRangeText]}>1M</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeRangeButton, timeRange === '3m' && styles.selectedTimeRange]}
                onPress={() => setTimeRange('3m')}
              >
                <Text style={[styles.timeRangeText, timeRange === '3m' && styles.selectedTimeRangeText]}>3M</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeRangeButton, timeRange === '6m' && styles.selectedTimeRange]}
                onPress={() => setTimeRange('6m')}
              >
                <Text style={[styles.timeRangeText, timeRange === '6m' && styles.selectedTimeRangeText]}>6M</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeRangeButton, timeRange === '1y' && styles.selectedTimeRange]}
                onPress={() => setTimeRange('1y')}
              >
                <Text style={[styles.timeRangeText, timeRange === '1y' && styles.selectedTimeRangeText]}>1A</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeRangeButton, timeRange === 'all' && styles.selectedTimeRange]}
                onPress={() => setTimeRange('all')}
              >
                <Text style={[styles.timeRangeText, timeRange === 'all' && styles.selectedTimeRangeText]}>Todo</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.simpleChart}>
              <Text style={styles.chartPlaceholder}>
                📊 Gráfica de peso disponible en versión completa
              </Text>
              {chartData.length > 0 && (
                <View style={styles.weightSummary}>
                  <Text style={styles.summaryText}>
                    Último peso: {chartData[chartData.length - 1]?.weight} kg
                  </Text>
                  <Text style={styles.summaryText}>
                    Total de registros: {chartData.length}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.chartInfo}>
              <Info size={16} color="#6B7280" />
              <Text style={styles.chartInfoText}>
                Registra el peso regularmente para monitorear la salud de tu mascota.
              </Text>
            </View>
          </Card>
        )}

        <Card style={styles.historyCard}>
          <Text style={styles.historyTitle}>Historial de Peso</Text>
          
          {weightRecords.length === 0 ? (
            <Text style={styles.emptyText}>No hay registros de peso</Text>
          ) : (
            weightRecords.slice().reverse().map((record, index) => (
              <View key={record.id} style={styles.historyItem}>
                <View style={styles.historyItemHeader}>
                  <Text style={styles.historyItemDate}>{record.date}</Text>
                  <Text style={styles.historyItemWeight}>
                    {record.weight} {record.weight_unit}
                  </Text>
                </View>
                {record.notes && (
                  <Text style={styles.historyItemNotes}>{record.notes}</Text>
                )}
                {index === weightRecords.length - 1 && record.notes?.includes('inicial') && (
                  <Text style={styles.initialWeightBadge}>Peso Inicial</Text>
                )}
              </View>
            ))
          )}
        </Card>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    margin: 20,
    marginBottom: 16,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  formContainer: {
    marginTop: 16,
  },
  weightInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  weightInput: {
    flex: 2,
    marginRight: 12,
  },
  unitSelector: {
    flex: 1,
  },
  unitLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 6,
  },
  unitButtons: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    overflow: 'hidden',
    height: 44,
  },
  unitButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  selectedUnitButton: {
    backgroundColor: '#3B82F6',
  },
  unitButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedUnitButtonText: {
    color: '#FFFFFF',
  },
  dateInputContainer: {
    marginBottom: 16,
  },
  dateInputLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 6,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
  },
  dateInputText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 10,
  },
  formButtons: {
    flexDirection: 'column',
    marginTop: 24,
    width: '100%',
    gap: 16,
  },
  formButton: {
    width: '100%',
  },
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  timeRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  selectedTimeRange: {
    backgroundColor: '#3B82F6',
  },
  timeRangeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedTimeRangeText: {
    color: '#FFFFFF',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  simpleChart: {
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  chartPlaceholder: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  weightSummary: {
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  chartInfo: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  chartInfoText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  historyCard: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  historyItemWeight: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
  },
  historyItemNotes: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280', 
    fontStyle: 'italic',
  },
  initialWeightBadge: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});