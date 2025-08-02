import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Dimensions, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Scale, Plus, Info, TrendingUp, TriangleAlert as AlertTriangle, TrendingDown, CircleCheck as CheckCircle } from 'lucide-react-native';
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

interface WeightRange {
  min: number;
  max: number;
  unit: string;
}

interface ChartPoint {
  date: string;
  weight: number;
  isInRange: boolean;
  status: 'underweight' | 'ideal' | 'overweight';
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
  const [idealWeightRange, setIdealWeightRange] = useState<WeightRange | null>(null);
  const [weightStatus, setWeightStatus] = useState<'underweight' | 'ideal' | 'overweight' | 'unknown'>('unknown');

  useEffect(() => {
    const loadPetData = async () => {
      await fetchPetDetails();
      await fetchWeightRecords();
    };
    
    loadPetData();
  }, [id]);

  useEffect(() => {
    // Calculate ideal weight range when pet data is available
    if (pet) {
      calculateIdealWeightRange();
    }
  }, [pet, weightRecords]);

  useEffect(() => {
    // Update weight status when records or ideal range changes
    if (weightRecords.length > 0 && idealWeightRange) {
      updateWeightStatus();
    }
  }, [weightRecords, idealWeightRange]);

  const createInitialWeightRecord = async () => {
    if (!pet || !pet.weight || !currentUser) return;
    
    try {
      // Verificar si ya existe un registro de peso inicial para esta mascota
      const { data: existingRecords, error: checkError } = await supabaseClient
        .from('pet_health')
        .select('id')
        .eq('pet_id', id)
        .eq('type', 'weight')
        .eq('notes', 'Peso inicial al registrar la mascota');
      
      if (checkError) {
        console.error('Error checking existing weight records:', checkError);
        return;
      }
      
      // Si ya existe un registro inicial, no crear otro
      if (existingRecords && existingRecords.length > 0) {
        console.log('Initial weight record already exists, skipping creation');
        return;
      }
      
      console.log('Creating initial weight record for pet:', pet.name);
      
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
        console.log('Initial weight record created successfully');
        // Actualizar la lista de registros después de un breve delay
        setTimeout(() => {
          fetchWeightRecords();
        }, 500);
      }
    } catch (error) {
      console.error('Error creating initial weight record:', error);
    }
  };

  const fetchPetDetails = async () => {
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
      
      // Fetch weight records after setting pet data
      await fetchWeightRecords();
      
      // Check if we need to create initial weight record
      // Only do this after we have both pet data and weight records
      setTimeout(async () => {
        const { data: existingRecords } = await supabaseClient
          .from('pet_health')
          .select('id')
          .eq('pet_id', id)
          .eq('type', 'weight');
        
        // Only create initial record if no weight records exist at all
        if ((!existingRecords || existingRecords.length === 0) && data.weight) {
          await createInitialWeightRecord();
        }
      }, 1000);
      
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

  const calculateIdealWeightRange = () => {
    if (!pet || !pet.breed_info || !pet.gender) {
      setIdealWeightRange(null);
      return;
    }

    const breedInfo = pet.breed_info;
    const gender = pet.gender; // 'male' or 'female'
    
    let minWeight, maxWeight;
    
    if (gender === 'male') {
      minWeight = breedInfo.min_weight_male;
      maxWeight = breedInfo.max_weight_male;
    } else {
      minWeight = breedInfo.min_weight_female;
      maxWeight = breedInfo.max_weight_female;
    }
    
    if (minWeight && maxWeight) {
      // Convert to the same unit as the pet's weight display
      const unit = pet.weight_display?.unit || 'kg';
      
      // If breed info is in different unit, convert
      let convertedMin = minWeight;
      let convertedMax = maxWeight;
      
      if (unit === 'lb' && typeof minWeight === 'number') {
        // Convert kg to lb (assuming breed info is in kg)
        convertedMin = minWeight * 2.20462;
        convertedMax = maxWeight * 2.20462;
      }
      
      setIdealWeightRange({
        min: convertedMin,
        max: convertedMax,
        unit: unit
      });
    } else {
      setIdealWeightRange(null);
    }
  };

  const updateWeightStatus = () => {
    if (!idealWeightRange || weightRecords.length === 0) {
      setWeightStatus('unknown');
      return;
    }

    // Get the most recent weight record
    const latestRecord = weightRecords[weightRecords.length - 1];
    const currentWeight = latestRecord.weight;
    
    // Convert weight to same unit as ideal range if needed
    let weightToCompare = currentWeight;
    if (latestRecord.weight_unit !== idealWeightRange.unit) {
      if (latestRecord.weight_unit === 'lb' && idealWeightRange.unit === 'kg') {
        weightToCompare = currentWeight / 2.20462;
      } else if (latestRecord.weight_unit === 'kg' && idealWeightRange.unit === 'lb') {
        weightToCompare = currentWeight * 2.20462;
      }
    }
    
    if (weightToCompare < idealWeightRange.min) {
      setWeightStatus('underweight');
    } else if (weightToCompare > idealWeightRange.max) {
      setWeightStatus('overweight');
    } else {
      setWeightStatus('ideal');
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
    
    return filteredRecords.map(record => {
      let isInRange = true;
      let status: 'underweight' | 'ideal' | 'overweight' = 'ideal';
      
      if (idealWeightRange) {
        let weightToCompare = record.weight;
        if (record.weight_unit !== idealWeightRange.unit) {
          if (record.weight_unit === 'lb' && idealWeightRange.unit === 'kg') {
            weightToCompare = record.weight / 2.20462;
          } else if (record.weight_unit === 'kg' && idealWeightRange.unit === 'lb') {
            weightToCompare = record.weight * 2.20462;
          }
        }
        
        if (weightToCompare < idealWeightRange.min) {
          status = 'underweight';
          isInRange = false;
        } else if (weightToCompare > idealWeightRange.max) {
          status = 'overweight';
          isInRange = false;
        }
      }
      
      return {
        date: record.date,
        weight: record.weight,
        unit: record.weight_unit,
        isInRange,
        status
      };
    });
  };

  const chartData = getChartData();

  const getWeightStatusInfo = () => {
    switch (weightStatus) {
      case 'underweight':
        return {
          icon: <AlertTriangle size={20} color="#F59E0B" />,
          text: 'Bajo peso',
          color: '#F59E0B',
          bgColor: '#FEF3C7',
          recommendation: 'Consulta con un veterinario sobre la alimentación'
        };
      case 'overweight':
        return {
          icon: <AlertTriangle size={20} color="#EF4444" />,
          text: 'Sobrepeso',
          color: '#EF4444',
          bgColor: '#FEE2E2',
          recommendation: 'Considera una dieta y más ejercicio'
        };
      case 'ideal':
        return {
          icon: <CheckCircle size={20} color="#10B981" />,
          text: 'Peso ideal',
          color: '#10B981',
          bgColor: '#D1FAE5',
          recommendation: 'Mantén la rutina actual'
        };
      default:
        return {
          icon: <Scale size={20} color="#6B7280" />,
          text: 'Sin datos de raza',
          color: '#6B7280',
          bgColor: '#F3F4F6',
          recommendation: 'Registra más información de la raza'
        };
    }
  };

  const renderSimpleChart = () => {
    if (chartData.length === 0) return null;

    const maxWeight = Math.max(...chartData.map(d => d.weight));
    const minWeight = Math.min(...chartData.map(d => d.weight));
    const weightRange = maxWeight - minWeight || 1;
    
    // Add ideal range to chart if available
    let chartMaxWeight = maxWeight;
    let chartMinWeight = minWeight;
    
    if (idealWeightRange) {
      chartMaxWeight = Math.max(maxWeight, idealWeightRange.max);
      chartMinWeight = Math.min(minWeight, idealWeightRange.min);
    }
    
    const chartRange = chartMaxWeight - chartMinWeight || 1;
    const chartWidth = screenWidth - 80;
    const chartHeight = 200;

    return (
      <View style={styles.chartContainer}>
        <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
          {/* Ideal weight range background */}
          {idealWeightRange && (
            <View
              style={[
                styles.idealRangeBackground,
                {
                  bottom: ((idealWeightRange.min - chartMinWeight) / chartRange) * chartHeight,
                  height: ((idealWeightRange.max - idealWeightRange.min) / chartRange) * chartHeight,
                  width: chartWidth,
                }
              ]}
            />
          )}
          
          {/* Weight points */}
          {chartData.map((point, index) => {
            const x = (index / (chartData.length - 1)) * (chartWidth - 20) + 10;
            const y = chartHeight - ((point.weight - chartMinWeight) / chartRange) * chartHeight;
            
            return (
              <View
                key={index}
                style={[
                  styles.chartPoint,
                  {
                    left: x - 4,
                    top: y - 4,
                    backgroundColor: point.isInRange ? '#10B981' : 
                      point.status === 'underweight' ? '#F59E0B' : '#EF4444'
                  }
                ]}
              />
            );
          })}
          
          {/* Chart lines connecting points */}
          {chartData.length > 1 && chartData.map((point, index) => {
            if (index === 0) return null;
            
            const prevPoint = chartData[index - 1];
            const x1 = ((index - 1) / (chartData.length - 1)) * (chartWidth - 20) + 10;
            const y1 = chartHeight - ((prevPoint.weight - chartMinWeight) / chartRange) * chartHeight;
            const x2 = (index / (chartData.length - 1)) * (chartWidth - 20) + 10;
            const y2 = chartHeight - ((point.weight - chartMinWeight) / chartRange) * chartHeight;
            
            const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            
            return (
              <View
                key={`line-${index}`}
                style={[
                  styles.chartLine,
                  {
                    left: x1,
                    top: y1,
                    width: lineLength,
                    transform: [{ rotate: `${angle}deg` }],
                  }
                ]}
              />
            );
          })}
        </View>
        
        {/* Chart labels */}
        <View style={styles.chartLabels}>
          <Text style={styles.chartLabelText}>
            Min: {chartMinWeight.toFixed(1)} {chartData[0]?.unit || 'kg'}
          </Text>
          <Text style={styles.chartLabelText}>
            Max: {chartMaxWeight.toFixed(1)} {chartData[0]?.unit || 'kg'}
          </Text>
        </View>
        
        {/* Ideal range info */}
        {idealWeightRange && (
          <View style={styles.idealRangeInfo}>
            <View style={styles.idealRangeIndicator} />
            <Text style={styles.idealRangeText}>
              Rango ideal: {idealWeightRange.min.toFixed(1)} - {idealWeightRange.max.toFixed(1)} {idealWeightRange.unit}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const convertWeightToKg = (weight: number, unit: string) => {
    if (unit === 'lb') {
      return weight / 2.20462;
    }
    return weight;
  };

  const getWeightStatus = (weightInKg: number) => {
    if (!idealWeightRange) {
      return {
        icon: <Scale size={16} color="#6B7280" />,
        color: '#6B7280'
      };
    }

    let idealMinKg = idealWeightRange.min;
    let idealMaxKg = idealWeightRange.max;
    
    if (idealWeightRange.unit === 'lb') {
      idealMinKg = idealWeightRange.min / 2.20462;
      idealMaxKg = idealWeightRange.max / 2.20462;
    }

    if (weightInKg < idealMinKg) {
      return {
        icon: <AlertTriangle size={16} color="#F59E0B" />,
        color: '#F59E0B'
      };
    } else if (weightInKg > idealMaxKg) {
      return {
        icon: <AlertTriangle size={16} color="#EF4444" />,
        color: '#EF4444'
      };
    } else {
      return {
        icon: <CheckCircle size={16} color="#10B981" />,
        color: '#10B981'
      };
    }
  };

  const renderWeightChart = () => {
    if (chartData.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyChartText}>
            📊 Agrega registros de peso para ver la gráfica
          </Text>
        </View>
      );
    }

    const maxDisplayRecords = 8;
    const displayRecords = chartData.slice(-maxDisplayRecords);
    
    // Calculate weight range for visualization
    const weights = displayRecords.map(record => convertWeightToKg(record.weight, record.unit));
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    const weightRange = maxWeight - minWeight || 1;

    return (
      <View style={styles.visualChart}>
        {/* Legend */}
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Peso ideal</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Bajo peso</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Sobrepeso</Text>
          </View>
        </View>

        {/* Weight bars */}
        <View style={styles.weightBars}>
          {displayRecords.map((record, index) => {
            const weightInKg = convertWeightToKg(record.weight, record.unit);
            const barHeight = Math.max(((weightInKg - minWeight) / weightRange) * 100, 10);
            const status = getWeightStatus(weightInKg);
            
            return (
              <View key={index} style={styles.weightBarContainer}>
                <>
                  <View style={styles.weightBarBackground}>
                    {/* Ideal range indicator */}
                    {idealWeightRange && (
                      <View
                        style={[
                          styles.idealRangeIndicator,
                          {
                            bottom: Math.max(((idealWeightRange.min - minWeight) / weightRange) * 120, 0),
                            height: Math.min(((idealWeightRange.max - idealWeightRange.min) / weightRange) * 120, 120),
                          }
                        ]}
                      />
                    )}
                    
                    <View
                      style={[
                        styles.weightBar,
                        {
                          height: barHeight,
                          backgroundColor: record.isInRange ? '#10B981' : 
                            record.status === 'underweight' ? '#F59E0B' : '#EF4444'
                        }
                      ]}
                    />
                  </View>
                  
                  <Text style={styles.weightBarLabel}>
                    {weightInKg.toFixed(1)}kg
                  </Text>
                  <Text style={styles.weightBarDate}>
                    {record.date.split('/').slice(0, 2).join('/')}
                  </Text>
                </>
              </View>
            );
          })}
        </View>

        {/* Weight Trend */}
        {chartData.length >= 2 && (
          <View style={styles.weightTrend}>
            {(() => {
              const firstWeight = chartData[0].weight;
              const lastWeight = chartData[chartData.length - 1].weight;
              const difference = lastWeight - firstWeight;
              const isIncreasing = difference > 0;
              const percentageChange = ((Math.abs(difference) / firstWeight) * 100).toFixed(1);
              
              return (
                <View style={styles.trendContainer}>
                  {isIncreasing ? 
                    <TrendingUp size={20} color={difference > 0.5 ? '#EF4444' : '#3B82F6'} /> :
                    <TrendingDown size={20} color={difference < -0.5 ? '#F59E0B' : '#3B82F6'} />
                  }
                  <Text style={styles.trendText}>
                    {isIncreasing ? 'Aumento' : 'Disminución'} de {Math.abs(difference).toFixed(1)}kg ({percentageChange}%)
                  </Text>
                </View>
              );
            })()}
          </View>
        )}
      </View>
    );
  };

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
          {pet && (
            <Text style={styles.petInfo}>
              {pet.name} • {pet.breed} • {pet.gender === 'male' ? 'Macho' : 'Hembra'}
            </Text>
          )}
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
            
            {/* Weight Status */}
            {idealWeightRange && (
              <View style={styles.weightStatusContainer}>
                <View style={[
                  styles.weightStatusBadge,
                  { backgroundColor: getWeightStatusInfo().bgColor }
                ]}>
                  {getWeightStatusInfo().icon}
                  <Text style={[
                    styles.weightStatusText,
                    { color: getWeightStatusInfo().color }
                  ]}>
                    {getWeightStatusInfo().text}
                  </Text>
                </View>
                <Text style={styles.weightRecommendation}>
                  {getWeightStatusInfo().recommendation}
                </Text>
              </View>
            )}
            
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
            
            {chartData.length > 0 ? (
              renderSimpleChart()
            ) : (
              <View style={styles.simpleChart}>
                <Text style={styles.chartPlaceholder}>
                  📊 Agrega registros de peso para ver la gráfica
                </Text>
              </View>
            )}
            
            {chartData.length > 0 && (
              <View style={styles.weightSummary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Último peso:</Text>
                  <Text style={styles.summaryValue}>
                    {chartData[chartData.length - 1]?.weight} {chartData[chartData.length - 1]?.unit}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total registros:</Text>
                  <Text style={styles.summaryValue}>{chartData.length}</Text>
                </View>
              </View>
            )}
            
            <View style={styles.chartInfo}>
              <Info size={16} color="#6B7280" />
              <Text style={styles.chartInfoText}>
                {idealWeightRange ? 
                  `Mantén el peso entre ${idealWeightRange.min}kg y ${idealWeightRange.max}kg para una salud óptima.` :
                  'Registra el peso regularmente para monitorear la salud de tu mascota.'
                }
              </Text>
            </View>
          </Card>
        )}

        {/* History Card */}
        <Card style={styles.historyCard}>
          <Text style={styles.historyTitle}>Historial de Peso</Text>
          
          {weightRecords.length === 0 ? (
            <Text style={styles.emptyText}>
              No hay registros de peso aún. Agrega el primer registro para comenzar el seguimiento.
            </Text>
          ) : (
            <View>
              {weightRecords.slice().reverse().map((record, index) => (
                <View key={record.id} style={styles.historyItem}>
                  <View style={styles.historyItemHeader}>
                    <Text style={styles.historyItemDate}>{record.date}</Text>
                    <View style={styles.historyItemWeightContainer}>
                      <Text style={styles.historyItemWeight}>
                        {record.weight} {record.weight_unit}
                      </Text>
                      {idealWeightRange && (
                        <View style={styles.weightStatusIndicator}>
                          {getWeightStatus(convertWeightToKg(record.weight, record.weight_unit)).icon}
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {record.notes && (
                    <Text style={styles.historyItemNotes}>{record.notes}</Text>
                  )}
                  
                  {record.notes === 'Peso inicial al registrar la mascota' && (
                    <Text style={styles.initialWeightBadge}>Peso inicial</Text>
                  )}
                </View>
              ))}
            </View>
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
  petInfo: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
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
  weightStatusContainer: {
    marginBottom: 16,
  },
  weightStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  weightStatusText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 6,
  },
  weightRecommendation: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
    marginBottom: 16,
  },
  chart: {
    position: 'relative',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  idealRangeBackground: {
    position: 'absolute',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 4,
  },
  chartPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#3B82F6',
    transformOrigin: 'left center',
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chartLabelText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  idealRangeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idealRangeIndicator: {
    width: 12,
    height: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 2,
    marginRight: 6,
  },
  idealRangeText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginRight: 8,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  chartLegend: {
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
  visualChart: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weightBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
    marginBottom: 16,
  },
  weightBarContainer: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 60,
  },
  weightBarBackground: {
    width: 30,
    height: 120,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  idealRangeIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 4,
  },
  weightBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  weightBarLabel: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 4,
  },
  weightBarDate: {
    fontSize: 9,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  weightTrend: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginLeft: 8,
  },
  emptyChart: {
    backgroundColor: '#F9FAFB',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
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
  historyItemWeightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyItemWeight: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
    marginRight: 8,
  },
  weightStatusIndicator: {
    marginLeft: 4,
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