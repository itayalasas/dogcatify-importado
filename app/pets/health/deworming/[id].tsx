import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Pill } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card } from '../../../../components/ui/Card';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';

export default function AddDeworming() {
  const { id, recordId, refresh } = useLocalSearchParams<{ id: string; recordId?: string; refresh?: string }>();
  const { currentUser } = useAuth();
  
  const [productName, setProductName] = useState('');
  const [applicationDate, setApplicationDate] = useState(new Date());
  const [nextDueDate, setNextDueDate] = useState<Date | null>(null);
  const [veterinarian, setVeterinarian] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [showApplicationDatePicker, setShowApplicationDatePicker] = useState(false);
  const [showNextDueDatePicker, setShowNextDueDatePicker] = useState(false);

  useEffect(() => {
    if (recordId) {
      setIsEditing(true);
      fetchDewormingDetails();
    }
  }, [recordId]);

  const fetchDewormingDetails = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pet_health')
        .select('*')
        .eq('id', recordId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setProductName(data.product_name || '');
        
        // Parse application date
        if (data.application_date) {
          const [day, month, year] = data.application_date.split('/');
          if (day && month && year) {
            setApplicationDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
          }
        }
        
        // Parse next due date
        if (data.next_due_date) {
          const [day, month, year] = data.next_due_date.split('/');
          if (day && month && year) {
            setNextDueDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
          }
        }
        
        setVeterinarian(data.veterinarian || '');
        setNotes(data.notes || '');
      }
    } catch (error) {
      console.error('Error fetching deworming details:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la desparasitación');
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString();
  };

  const onApplicationDateChange = (event: any, selectedDate?: Date) => {
    setShowApplicationDatePicker(false);
    if (selectedDate) {
      setApplicationDate(selectedDate);
    }
  };

  const onNextDueDateChange = (event: any, selectedDate?: Date) => {
    setShowNextDueDatePicker(false);
    if (selectedDate) {
      setNextDueDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (!productName.trim() || !applicationDate) {
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
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
        type: 'deworming',
        product_name: productName.trim(),
        application_date: formatDate(applicationDate),
        next_due_date: nextDueDate ? formatDate(nextDueDate) : null,
        veterinarian: veterinarian.trim() || null,
        notes: notes.trim() || null,
        created_at: new Date().toISOString()
      };
      
      let error;
      
      if (isEditing) {
        // Update existing record
        const { error: updateError } = await supabaseClient
          .from('pet_health')
          .update({
            product_name: productName.trim(),
            application_date: formatDate(applicationDate),
            next_due_date: nextDueDate ? formatDate(nextDueDate) : null,
            veterinarian: veterinarian.trim() || null,
            notes: notes.trim() || null
          })
          .eq('id', recordId);
          
        error = updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabaseClient.from('pet_health').insert(healthData);
        error = insertError;
      }

      if (error) {
        throw error;
      }

      Alert.alert('Éxito', 'Desparasitación guardada correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving deworming:', error);
      Alert.alert('Error', 'No se pudo registrar la desparasitación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Editar Desparasitación' : 'Agregar Desparasitación'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <View style={styles.iconContainer}>
            <Pill size={40} color="#10B981" />
          </View>

          {/* Product Name */}
          <Input
            label="Producto utilizado *"
            placeholder="Ej: Drontal, Milbemax, Revolution..."
            value={productName}
            onChangeText={setProductName}
          />

          {/* Application Date */}
          <View style={styles.dateInputContainer}>
            <Text style={styles.dateInputLabel}>Fecha de aplicación *</Text>
            <TouchableOpacity 
              style={styles.dateInput}
              onPress={() => setShowApplicationDatePicker(true)}
            >
              <Calendar size={20} color="#6B7280" />
              <Text style={styles.dateInputText}>
                {formatDate(applicationDate)}
              </Text>
            </TouchableOpacity>
            {showApplicationDatePicker && (
              <DateTimePicker
                value={applicationDate}
                mode="date"
                display="default"
                onChange={onApplicationDateChange}
              />
            )}
          </View>

          {/* Next Due Date */}
          <View style={styles.dateInputContainer}>
            <Text style={styles.dateInputLabel}>Próxima desparasitación</Text>
            <TouchableOpacity 
              style={styles.dateInput}
              onPress={() => setShowNextDueDatePicker(true)}
            >
              <Calendar size={20} color="#6B7280" />
              <Text style={styles.dateInputText}>
                {nextDueDate ? formatDate(nextDueDate) : 'No establecida'}
              </Text>
            </TouchableOpacity>
            {showNextDueDatePicker && (
              <DateTimePicker
                value={nextDueDate || new Date()}
                mode="date"
                display="default"
                onChange={onNextDueDateChange}
              />
            )}
          </View>

          <Input
            label="Veterinario"
            placeholder="Nombre del veterinario o clínica"
            value={veterinarian}
            onChangeText={setVeterinarian}
          />

          <Input
            label="Notas adicionales"
            placeholder="Tipo de parásitos, reacciones, etc."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <Button
            title={isEditing ? "Actualizar Desparasitación" : "Guardar Desparasitación"}
            onPress={handleSubmit}
            loading={loading}
            size="large"
          />
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
  formCard: {
    margin: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  dateInputContainer: {
    marginBottom: 14,
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
});