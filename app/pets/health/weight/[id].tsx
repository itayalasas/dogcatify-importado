import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Dimensions, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Scale, Plus, Info, TrendingUp, TriangleAlert as AlertTriangle, TrendingDown, CircleCheck as CheckCircle, Sparkles } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card } from '../../../../components/ui/Card';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { envConfig } from '../../../../utils/envConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, fontSize } from '../../../../constants/theme';
import { HealthHeader } from '../../../../components/health';
import { toast } from '../../../../components/ui/Toast';
import { Badge } from '../../../../components/ui/Badge';
import { EmptyState } from '../../../../components/ui/EmptyState';


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
  const [aiTips, setAiTips] = useState<string[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchWeightRecords(), fetchPetDetails()]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id && currentUser) {
      fetchPetDetails();
      fetchWeightRecords();
    }
  }, [id]);

  // Separate effect to create initial weight record after pet data is loaded
  useEffect(() => {
    if (pet && currentUser && weightRecords.length === 0 && pet.weight) {
      console.log('Pet loaded and no weight records found, creating initial record...');
      createInitialWeightRecord();
    }
  }, [pet, weightRecords, currentUser]);

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

  useEffect(() => {
    // Load cached tips or auto-generate when weight status is determined
    if (weightStatus !== 'unknown' && weightRecords.length > 0 && aiTips.length === 0) {
      loadOrGenerateTips();
    }
  }, [weightStatus, weightRecords.length, aiTips.length]);

  const createInitialWeightRecord = async () => {
    if (!pet || !pet.weight || !currentUser || weightRecords.length > 0) {
      console.log('Cannot create initial weight record - missing data or records already exist', {
        hasPet: !!pet,
        hasWeight: !!pet?.weight,
        hasUser: !!currentUser,
        existingRecords: weightRecords.length
      });
      return;
    }
    
    // Double check - verify no existing weight records in database
    try {
      const { data: existingRecords, error: checkError } = await supabaseClient
        .from('pet_health')
        .select('id')
        .eq('pet_id', id)
        .eq('type', 'weight');
      
      if (checkError) {
        console.error('Error checking existing weight records:', checkError);
        return;
      }
      
      if (existingRecords && existingRecords.length > 0) {
        console.log('Weight records already exist in database, skipping creation');
        return;
      }
    } catch (error) {
      console.error('Error in duplicate check:', error);
      return;
    }
    
    try {
      console.log('Creating initial weight record for pet:', pet.name, 'Weight:', pet.weight);
      
      // Crear un registro de peso inicial con la fecha de creación de la mascota
      const initialDate = pet.created_at ? new Date(pet.created_at) : new Date();
      
      const initialWeightData = {
        pet_id: id,
        user_id: currentUser.id,
        type: 'weight',
        weight: pet.weight,
        weight_unit: pet.weight_display?.unit || 'kg',
        date: initialDate.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }),
        notes: 'Peso inicial al registrar la mascota',
        created_at: new Date().toISOString()
      };
      
      console.log('Initial weight data to insert:', initialWeightData);
      
      const { error } = await supabaseClient.from('pet_health').insert(initialWeightData);
      
      if (error) {
        console.error('Error creating initial weight record:', error);
        return;
      } else {
        console.log('Initial weight record created successfully');
      }
      
      // Refrescar los registros después de crear el inicial
      setTimeout(() => {
        fetchWeightRecords();
      }, 500);
      
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
      if (data.weight_display?.unit) {
        setWeightUnit(data.weight_display.unit);
      } else if (data.weightDisplay?.unit) {
        setWeightUnit(data.weightDisplay.unit);
      }
    } catch (error) {
      console.error('Error fetching pet details:', error);
    }
  };

  const fetchWeightRecords = async () => {
    try {
      console.log('=== FETCH WEIGHT RECORDS DEBUG ===');
      console.log('Fetching weight records for pet:', id);
      
      const { data, error } = await supabaseClient
        .from('pet_health')
        .select('*')
        .eq('pet_id', id)
        .eq('type', 'weight')
        .order('created_at', { ascending: true });
      
      console.log('Query result:', data);
      console.log('Query error:', error);
      
      if (error) {
        console.error('❌ Error fetching weight records:', error);
        throw error;
      }
      
      console.log('✅ Weight records fetched:', data?.length || 0);
      
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
      
      console.log('Formatted weight records:', formattedRecords);
      setWeightRecords(formattedRecords);
      console.log('=== END FETCH WEIGHT RECORDS DEBUG ===');
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
      Alert.alert('Error', 'Ingresá el peso');
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

      toast.success('Peso registrado');
      setShowAddForm(false);
      setNotes('');
      
      // Refresh data after adding new weight
      await Promise.all([
        fetchWeightRecords(),
        fetchPetDetails()
      ]);
      
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

  const loadOrGenerateTips = async () => {
    try {
      const cacheKey = `weight_ai_tips_${id}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setAiTips(JSON.parse(cached));
        return;
      }
    } catch (_e) {
      // If cache read fails, just generate
    }
    generateWeightAdvice();
  };


  const getWeightTrend = (): { trend: 'increasing' | 'decreasing' | 'stable'; difference: number } => {
    if (weightRecords.length < 2) return { trend: 'stable', difference: 0 };
    const first = weightRecords[0].weight;
    const last = weightRecords[weightRecords.length - 1].weight;
    const diff = last - first;
    if (diff > 0.1) return { trend: 'increasing', difference: diff };
    if (diff < -0.1) return { trend: 'decreasing', difference: diff };
    return { trend: 'stable', difference: diff };
  };

  const generateWeightAdvice = async () => {
    if (!pet || weightStatus === 'unknown') return;

    setLoadingAI(true);
    setAiError(null);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        setAiError('Debes estar autenticado');
        return;
      }

      const latestRecord = weightRecords[weightRecords.length - 1];
      const { trend, difference } = getWeightTrend();


      // Calculate age in months
      let ageMonths: number | undefined;
      if (pet.birth_date) {
        const birth = new Date(pet.birth_date);
        const now = new Date();
        ageMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      }

      const response = await fetch(
        `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/generate-weight-advice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            petName: pet.name,
            species: pet.species || 'dog',
            breed: pet.breed || '',
            gender: pet.gender || 'male',
            ageMonths,
            currentWeight: latestRecord?.weight ?? pet.weight,
            weightUnit: latestRecord?.weight_unit ?? 'kg',
            weightStatus,
            idealMin: idealWeightRange?.min,
            idealMax: idealWeightRange?.max,
            weightTrend: trend,
            weightDifference: difference,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Error al generar consejos');
      }

      const data = await response.json();
      const tips = data.tips || [];
      setAiTips(tips);
      // Persist tips so they survive app restarts
      await AsyncStorage.setItem(`weight_ai_tips_${id}`, JSON.stringify(tips));
      setAiTips(data.tips || []);
    } catch (error: any) {
      console.error('Error generating weight advice:', error);
      setAiError('No se pudieron generar los consejos. Probá de nuevo.');
    } finally {
      setLoadingAI(false);
    }
  };

  const getWeightStatusInfo = () => {
    switch (weightStatus) {
      case 'underweight':
        return {
          icon: <AlertTriangle size={20} color={colors.warning} />,
          text: 'Bajo peso',
          color: colors.warning,
          bgColor: colors.warningSoft,
          recommendation: 'Consulta con un veterinario sobre la alimentación'
        };
      case 'overweight':
        return {
          icon: <AlertTriangle size={20} color={colors.danger} />,
          text: 'Sobrepeso',
          color: colors.danger,
          bgColor: colors.dangerSoft,
          recommendation: 'Considera una dieta y más ejercicio'
        };
      case 'ideal':
        return {
          icon: <CheckCircle size={20} color={colors.success} />,
          text: 'Peso ideal',
          color: colors.success,
          bgColor: colors.successSoft,
          recommendation: 'Mantén la rutina actual'
        };
      default:
        return {
          icon: <Scale size={20} color={colors.textSecondary} />,
          text: 'Sin datos de raza',
          color: colors.textSecondary,
          bgColor: colors.surfaceAlt,
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
                    backgroundColor: point.isInRange ? colors.success : 
                      point.status === 'underweight' ? colors.warning : colors.danger
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
        icon: <Scale size={16} color={colors.textSecondary} />,
        color: colors.textSecondary
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
        icon: <AlertTriangle size={16} color={colors.warning} />,
        color: colors.warning
      };
    } else if (weightInKg > idealMaxKg) {
      return {
        icon: <AlertTriangle size={16} color={colors.danger} />,
        color: colors.danger
      };
    } else {
      return {
        icon: <CheckCircle size={16} color={colors.success} />,
        color: colors.success
      };
    }
  };

  const renderWeightChart = () => {
    if (chartData.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyChartText}>
            📊 Agregá registros de peso para ver la gráfica
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
            <View style={[styles.legendColor, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Peso ideal</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: colors.warning }]} />
            <Text style={styles.legendText}>Bajo peso</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: colors.danger }]} />
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
                        backgroundColor: record.isInRange ? colors.success : 
                          record.status === 'underweight' ? colors.warning : colors.danger
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
                    <TrendingUp size={20} color={difference > 0.5 ? colors.danger : colors.primary} /> :
                    <TrendingDown size={20} color={difference < -0.5 ? colors.warning : colors.primary} />
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
      <HealthHeader title="Seguimiento de peso" subtitle={pet?.name} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <Card style={styles.infoCard}>
          <View style={styles.iconContainer}>
            <Scale size={40} color={colors.primary} />
          </View>
          <Text style={styles.infoTitle}>Peso de tu mascota</Text>
          {pet && (
            <Text style={styles.petInfo}>
              {pet.name} • {pet.breed} • {pet.gender === 'male' ? 'Macho' : 'Hembra'}
            </Text>
          )}
          <Text style={styles.infoDescription}>
            Registrá el peso de tu mascota seguido para cuidar su salud.
          </Text>
          {!showAddForm ? (
            <Button
              title="Agregar peso"
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
                      accessibilityRole="button"
                      accessibilityState={{ selected: weightUnit === 'kg' }}
                      onPress={() => setWeightUnit('kg')}
                    >
                      <Text style={[styles.unitButtonText, weightUnit === 'kg' && styles.selectedUnitButtonText]}>kg</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitButton, weightUnit === 'lb' && styles.selectedUnitButton]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: weightUnit === 'lb' }}
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
                  accessibilityRole="button"
                  onPress={() => setShowDatePicker(true)}
                >
                  <Calendar size={20} color={colors.textSecondary} />
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
            <Text style={styles.chartTitle}>Evolución del peso</Text>
            
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
                accessibilityRole="button"
                accessibilityState={{ selected: timeRange === '1m' }}
                onPress={() => setTimeRange('1m')}
              >
                <Text style={[styles.timeRangeText, timeRange === '1m' && styles.selectedTimeRangeText]}>1M</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeRangeButton, timeRange === '3m' && styles.selectedTimeRange]}
                accessibilityRole="button"
                accessibilityState={{ selected: timeRange === '3m' }}
                onPress={() => setTimeRange('3m')}
              >
                <Text style={[styles.timeRangeText, timeRange === '3m' && styles.selectedTimeRangeText]}>3M</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeRangeButton, timeRange === '6m' && styles.selectedTimeRange]}
                accessibilityRole="button"
                accessibilityState={{ selected: timeRange === '6m' }}
                onPress={() => setTimeRange('6m')}
              >
                <Text style={[styles.timeRangeText, timeRange === '6m' && styles.selectedTimeRangeText]}>6M</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeRangeButton, timeRange === '1y' && styles.selectedTimeRange]}
                accessibilityRole="button"
                accessibilityState={{ selected: timeRange === '1y' }}
                onPress={() => setTimeRange('1y')}
              >
                <Text style={[styles.timeRangeText, timeRange === '1y' && styles.selectedTimeRangeText]}>1A</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeRangeButton, timeRange === 'all' && styles.selectedTimeRange]}
                accessibilityRole="button"
                accessibilityState={{ selected: timeRange === 'all' }}
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
                  📊 Agregá registros de peso para ver la gráfica
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
              <Info size={16} color={colors.textSecondary} />
              <Text style={styles.chartInfoText}>
                {idealWeightRange ? 
                  `Mantené el peso entre ${idealWeightRange.min}kg y ${idealWeightRange.max}kg para una salud óptima.` :
                  'Registrá el peso seguido para cuidar la salud de tu mascota.'
                }
              </Text>
            </View>
          </Card>
        )}

        {/* AI Weight Advice Card */}
        {weightStatus !== 'unknown' && weightRecords.length > 0 && (
          <Card style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <Sparkles size={20} color={colors.primary} />
              <Text style={styles.aiCardTitle}>Consejos de IA</Text>
            </View>
            <Text style={styles.aiCardSubtitle}>
              Recomendaciones personalizadas basadas en el estado de peso de {pet?.name}
            </Text>

            {loadingAI && (
              <View style={styles.aiLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.aiLoadingText}>Analizando el peso de {pet?.name}...</Text>
              </View>
            )}

            {aiError && !loadingAI && (
              <View style={styles.aiErrorContainer}>
                <Text style={styles.aiErrorText}>{aiError}</Text>
                <TouchableOpacity style={styles.aiRetryButton} onPress={generateWeightAdvice} accessibilityRole="button">
                  <Text style={styles.aiRetryButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}

            {aiTips.length > 0 && !loadingAI && (
              <View style={styles.aiTipsContainer}>
                {aiTips.map((tip, index) => (
                  <View key={index} style={styles.aiTipItem}>
                    <Text style={styles.aiTipText}>{tip}</Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.aiRefreshButton} accessibilityRole="button" onPress={() => {
                    AsyncStorage.removeItem(`weight_ai_tips_${id}`);
                    generateWeightAdvice();
                  }}>
                  <Sparkles size={14} color={colors.primary} />
                  <Text style={styles.aiRefreshText}>Regenerar consejos</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}

        {/* History Card */}
        <Card style={styles.historyCard}>
          <Text style={styles.historyTitle}>Historial de peso</Text>
          
          {weightRecords.length === 0 ? (
            <EmptyState
              icon={<Scale size={32} color={colors.primary} />}
              title="Sin registros todavía"
              description="Todavía no hay registros de peso. Agregá el primero para empezar el seguimiento."
              actionLabel={!showAddForm ? 'Agregar peso' : undefined}
              onAction={!showAddForm ? () => setShowAddForm(true) : undefined}
            />
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
                    <Badge label="Peso inicial" tone="primary" size="small" style={styles.initialBadge} />
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
  initialBadge: {
    marginTop: spacing.xs,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    margin: spacing.xl,
    marginBottom: spacing.lg,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: fontSize.xl,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  petInfo: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  infoDescription: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  formContainer: {
    marginTop: spacing.lg,
  },
  weightInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  weightInput: {
    flex: 2,
    marginRight: spacing.md,
  },
  unitSelector: {
    flex: 1,
  },
  unitLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  unitButtons: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    overflow: 'hidden',
    height: 44,
  },
  unitButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  selectedUnitButton: {
    backgroundColor: colors.primary,
  },
  unitButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  selectedUnitButtonText: {
    color: colors.white,
  },
  dateInputContainer: {
    marginBottom: spacing.lg,
  },
  dateInputLabel: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 50,
    gap: spacing.sm,
  },
  dateInputText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.text,
  },
  formButtons: {
    flexDirection: 'column',
    marginTop: spacing.xxl,
    width: '100%',
    gap: spacing.lg,
  },
  formButton: {
    width: '100%',
  },
  chartCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  chartTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  weightStatusContainer: {
    marginBottom: spacing.lg,
  },
  weightStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  weightStatusText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 6,
  },
  weightRecommendation: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  timeRangeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  selectedTimeRange: {
    backgroundColor: colors.primary,
  },
  timeRangeText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  selectedTimeRangeText: {
    color: colors.white,
  },
  chartContainer: {
    marginBottom: spacing.lg,
  },
  chart: {
    position: 'relative',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
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
    backgroundColor: colors.primary,
    transformOrigin: 'left center',
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  chartLabelText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
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
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  simpleChart: {
    backgroundColor: colors.background,
    padding: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  chartPlaceholder: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  weightSummary: {
    alignItems: 'center',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  summaryValue: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
    marginBottom: spacing.sm,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  visualChart: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weightBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
    marginBottom: spacing.lg,
  },
  weightBarContainer: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 60,
  },
  weightBarBackground: {
    width: 30,
    height: 120,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  weightBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  weightBarLabel: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginTop: spacing.xs,
  },
  weightBarDate: {
    fontSize: 9,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  weightTrend: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  emptyChart: {
    backgroundColor: colors.background,
    padding: 40,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  chartInfo: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'flex-start',
  },
  chartInfoText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  historyCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  historyTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  historyItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  historyItemDate: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  historyItemWeightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyItemWeight: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary,
    marginRight: spacing.sm,
  },
  weightStatusIndicator: {
    marginLeft: spacing.xs,
  },
  historyItemNotes: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary, 
    fontStyle: 'italic',
  },
  initialWeightBadge: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.white,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  aiCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  aiCardTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  aiCardSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  aiGenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  aiGenerateButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  aiLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  aiLoadingText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.primary,
  },
  aiErrorContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  aiErrorText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  aiRetryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
  },
  aiRetryButtonText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
  },
  aiTipsContainer: {
    gap: spacing.md,
  },
  aiTipItem: {
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  aiTipText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  aiRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: 6,
  },
  aiRefreshText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
  },
});
