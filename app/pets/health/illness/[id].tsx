import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Heart } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card } from '../../../../components/ui/Card';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';

export default function AddIllness() {
  const { id, recordId, refresh } = useLocalSearchParams<{ id: string; recordId?: string; refresh?: string }>();
  const { currentUser } = useAuth();
  
  const [illnessName, setIllnessName] = useState('');
  const [diagnosisDate, setDiagnosisDate] = useState(new Date());
  const [treatment, setTreatment] = useState('');
  const [veterinarian, setVeterinarian] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (recordId) {
      setIsEditing(true);
      fetchIllnessDetails();
    }
  }, [recordId]);

  const fetchIllnessDetails = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pet_health')
        .select('*')
        .eq('id', recordId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setIllnessName(data.name || '');
        
        // Parse diagnosis date
        if (data.diagnosis_date) {
          const [day, month, year] = data.diagnosis_date.split('/');
          if (day && month && year) {
            setDiagnosisDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
          }
        }
        
        setTreatment(data.treatment || '');
        setVeterinarian(data.veterinarian || '');
        setStatus(data.status || 'active');
        setNotes(data.notes || '');
      }
    } catch (error) {
      console.error('Error fetching illness details:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la enfermedad');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString();
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDiagnosisDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (!illnessName.trim() || !diagnosisDate) {
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
        type: 'illness',
        name: illnessName.trim(),
        diagnosis_date: formatDate(diagnosisDate),
        treatment: treatment.trim() || null,
        veterinarian: veterinarian.trim() || null,
        status: status,
        notes: notes.trim() || null,
        created_at: new Date().toISOString()
      };
      
      let error;
      
      if (isEditing) {
        // Update existing record
        const { error: updateError } = await supabaseClient
          .from('pet_health')
          .update({
            name: illnessName.trim(),
            diagnosis_date: formatDate(diagnosisDate),
            treatment: treatment.trim() || null,
            veterinarian: veterinarian.trim() || null,
            status: status,
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

      Alert.alert('Éxito', isEditing ? 'Enfermedad actualizada correctamente' : 'Enfermedad registrada correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving illness:', error);
      Alert.alert('Error', 'No se pudo registrar la enfermedad');
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
        <Text style={styles.title}>{isEditing ? 'Editar Enfermedad' : 'Agregar Enfermedad'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <View style={styles.iconContainer}>
            <Heart size={40} color="#EF4444" />
          </View>

          {/* Illness Name */}
          <Input
            label="Nombre de la enfermedad *"
            placeholder="Ej: Otitis, Dermatitis, Gastritis..."
            value={illnessName}
            onChangeText={setIllnessName}
          />

          {/* Diagnosis Date */}
          <View style={styles.dateInputContainer}>
            <Text style={styles.dateInputLabel}>Fecha de diagnóstico *</Text>
            <TouchableOpacity 
              style={styles.dateInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={20} color="#6B7280" />
              <Text style={styles.dateInputText}>
                {formatDate(diagnosisDate)}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={diagnosisDate}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}
          </View>

          <Input
            label="Tratamiento"
            placeholder="Medicamentos, terapias, etc."
            value={treatment}
            onChangeText={setTreatment}
            multiline
            numberOfLines={2}
          />

          <Input
            label="Veterinario"
            placeholder="Nombre del veterinario o clínica"
            value={veterinarian}
            onChangeText={setVeterinarian}
          />

          <Input
            label="Notas adicionales"
            placeholder="Síntomas, evolución, observaciones..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <Button
            title={isEditing ? "Actualizar Enfermedad" : "Guardar Enfermedad"}
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