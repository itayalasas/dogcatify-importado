import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Heart, ChevronDown } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card } from '../../../../components/ui/Card';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';

export default function AddIllness() {
  const { id, recordId, refresh } = useLocalSearchParams<{ id: string; recordId?: string; refresh?: string }>();
  const params = useLocalSearchParams();
  const { currentUser } = useAuth();
  
  // Pet data
  const [pet, setPet] = useState<any>(null);
  
  // Form data
  const [illnessName, setIllnessName] = useState('');
  const [diagnosisDate, setDiagnosisDate] = useState(new Date());
  const [treatment, setTreatment] = useState('');
  const [veterinarian, setVeterinarian] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<any>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<any>(null);
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleBackNavigation = () => {
    router.replace({
      pathname: `/pets/${id}`,
      params: { activeTab: 'health' }
    });
  };
  // Handle return parameters from selection screens
  useEffect(() => {
    // Handle preserved diagnosis date
    if (params.currentDiagnosisDate && typeof params.currentDiagnosisDate === 'string') {
      try {
        setDiagnosisDate(new Date(params.currentDiagnosisDate));
      } catch (error) {
        console.error('Error parsing diagnosis date:', error);
      }
    }
    
    // Handle selected condition
    if (params.selectedCondition) {
      try {
        const condition = JSON.parse(params.selectedCondition as string);
        setSelectedCondition(condition);
        setIllnessName(condition.name);
        console.log('Selected condition:', condition.name);
      } catch (error) {
        console.error('Error parsing selected condition:', error);
      }
    }

    // Restore selected condition when coming back from another screen
    if (params.currentSelectedCondition && typeof params.currentSelectedCondition === 'string') {
      try {
        const condition = JSON.parse(params.currentSelectedCondition);
        setSelectedCondition(condition);
        setIllnessName(condition.name);
        console.log('Restored selected condition:', condition.name);
      } catch (error) {
        console.error('Error parsing currentSelectedCondition:', error);
      }
    }

    // Handle selected treatment
    if (params.selectedTreatment) {
      try {
        const treatmentData = JSON.parse(params.selectedTreatment as string);
        setSelectedTreatment(treatmentData);
        setTreatment(treatmentData.name);
        console.log('Selected treatment:', treatmentData.name);
      } catch (error) {
        console.error('Error parsing selected treatment:', error);
      }
    }
    
    // Handle selected veterinarian
    if (params.selectedVeterinarian) {
      try {
        const vetData = JSON.parse(params.selectedVeterinarian as string);
        setVeterinarian(vetData.name);
        console.log('Selected veterinarian:', vetData.name);
      } catch (error) {
        console.error('Error parsing selected veterinarian:', error);
      }
    }
    
    // Restore selected treatment when coming back from another screen
    if (params.currentSelectedTreatment && typeof params.currentSelectedTreatment === 'string') {
      try {
        const treatmentData = JSON.parse(params.currentSelectedTreatment);
        setSelectedTreatment(treatmentData);
        setTreatment(treatmentData.name);
        console.log('Restored selected treatment:', treatmentData.name);
      } catch (error) {
        console.error('Error parsing currentSelectedTreatment:', error);
      }
    }

    // Handle preserved notes
    if (params.currentNotes && typeof params.currentNotes === 'string') {
      setNotes(params.currentNotes);
      console.log('Restored notes:', params.currentNotes);
    }

    // Handle preserved treatment
    if (params.currentTreatment && typeof params.currentTreatment === 'string') {
      setTreatment(params.currentTreatment);
      console.log('Restored treatment:', params.currentTreatment);
    }

    // Handle preserved condition
    if (params.currentCondition && typeof params.currentCondition === 'string') {
      setIllnessName(params.currentCondition);
      console.log('Restored condition:', params.currentCondition);
    }

    // Handle preserved veterinarian
    if (params.currentVeterinarian && typeof params.currentVeterinarian === 'string') {
      setVeterinarian(params.currentVeterinarian);
      console.log('Restored veterinarian:', params.currentVeterinarian);
    }
  }, [params.selectedCondition, params.selectedTreatment, params.selectedVeterinarian, params.currentSelectedCondition, params.currentSelectedTreatment, params.currentTreatment, params.currentCondition, params.currentVeterinarian, params.currentNotes]);
  useEffect(() => {
    fetchPetData();
    
    if (recordId) {
      setIsEditing(true);
      fetchIllnessDetails();
    }
  }, [recordId]);

  const fetchPetData = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setPet(data);
    } catch (error) {
      console.error('Error fetching pet data:', error);
    }
  };

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

  const handleSelectCondition = () => {
    router.push({
      pathname: '/pets/health/select-condition',
      params: {
        petId: id,
        species: pet?.species || 'dog',
        breed: pet?.breed || '',
        ageInMonths: pet?.age_in_months?.toString() || '',
        weight: pet?.weight?.toString() || '',
        returnPath: `/pets/health/illness/${id}`,
        currentValue: illnessName,
        currentTreatment: treatment,
        currentVeterinarian: veterinarian,
        currentNotes: notes,
        currentDiagnosisDate: diagnosisDate.toISOString()
      }
    });
  };

  const handleSelectTreatment = () => {
    router.push({
      pathname: '/pets/health/select-treatment',
      params: {
        petId: id,
        species: pet?.species || 'dog',
        illnessName: illnessName,
        ageInMonths: pet?.age_in_months?.toString() || '',
        weight: pet?.weight?.toString() || '',
        returnPath: `/pets/health/illness/${id}`,
        currentValue: treatment,
        currentCondition: illnessName,
        currentSelectedCondition: selectedCondition ? JSON.stringify(selectedCondition) : undefined,
        currentVeterinarian: veterinarian,
        currentNotes: notes,
        currentDiagnosisDate: diagnosisDate.toISOString()
      }
    });
  };

  const handleSelectVeterinarian = () => {
    router.push({
      pathname: '/pets/health/select-veterinarian',
      params: {
        petId: id,
        returnPath: `/pets/health/illness/${id}`,
        currentValue: veterinarian,
        currentCondition: illnessName,
        currentTreatment: treatment,
        currentSelectedCondition: selectedCondition ? JSON.stringify(selectedCondition) : undefined,
        currentSelectedTreatment: selectedTreatment ? JSON.stringify(selectedTreatment) : undefined,
        currentNotes: notes,
        currentDiagnosisDate: diagnosisDate.toISOString()
      }
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDiagnosisDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (!illnessName.trim()) {
      Alert.alert('Error', 'Por favor selecciona una enfermedad');
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

      // Generate checkup alert for chronic conditions
      if (status === 'active' && !isEditing) {
        try {
          const checkupDate = new Date();
          checkupDate.setMonth(checkupDate.getMonth() + 3); // 3 months from now
          
          const { error: alertError } = await supabaseClient
            .from('medical_alerts')
            .insert({
              pet_id: id,
              user_id: currentUser.id,
              alert_type: 'checkup',
              title: `Revisión médica: ${illnessName.trim()}`,
              description: `Revisión de seguimiento para ${illnessName.trim()} de ${pet?.name}`,
              due_date: checkupDate.toISOString().split('T')[0],
              priority: 'medium',
              status: 'pending',
              metadata: {
                condition_name: illnessName.trim(),
                diagnosis_date: formatDate(diagnosisDate),
                veterinarian: veterinarian.trim() || null
              }
            });
          
          if (alertError) {
            console.warn('Could not create medical alert:', alertError);
          } else {
            console.log('Medical alert created for illness checkup');
          }
        } catch (alertError) {
          console.warn('Error creating medical alert:', alertError);
        }
      }

      Alert.alert('Éxito', isEditing ? 'Enfermedad actualizada correctamente' : 'Enfermedad registrada correctamente', [
        { text: 'OK', onPress: handleBackNavigation }
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
        <TouchableOpacity onPress={handleBackNavigation} style={styles.backButton}>
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

          {pet && (
            <View style={styles.petInfoContainer}>
              <Text style={styles.petInfoText}>
                {pet.species === 'dog' ? '🐕' : '🐱'} {pet.name} - {pet.breed}
              </Text>
              <Text style={styles.petInfoSubtext}>
                Enfermedades específicas para {pet.species === 'dog' ? 'perros' : 'gatos'}
              </Text>
            </View>
          )}

          {/* Illness Name - Navigable */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nombre de la enfermedad *</Text>
            <TouchableOpacity 
              style={styles.selectableInput}
              onPress={handleSelectCondition}
            >
              <Text style={[
                styles.selectableInputText,
                !illnessName && styles.placeholderText
              ]}>
                {illnessName || (pet?.species === 'dog' ? 
                  "Seleccionar enfermedad para perros..." : 
                  "Seleccionar enfermedad para gatos..."
                )}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

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

          {/* Treatment - Navigable */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tratamiento</Text>
            <TouchableOpacity 
              style={styles.selectableInput}
              onPress={handleSelectTreatment}
            >
              <Text style={[
                styles.selectableInputText,
                !treatment && styles.placeholderText
              ]}>
                {treatment || "Seleccionar tratamiento..."}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Veterinarian - Navigable */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Veterinario</Text>
            <TouchableOpacity 
              style={styles.selectableInput}
              onPress={handleSelectVeterinarian}
            >
              <Text style={[
                styles.selectableInputText,
                !veterinarian && styles.placeholderText
              ]}>
                {veterinarian || "Seleccionar veterinario..."}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <Input
            label="Notas adicionales"
            placeholder="Síntomas, evolución, observaciones..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <Button
            title={isEditing ? 'Actualizar Enfermedad' : 'Guardar Enfermedad'}
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
  petInfoContainer: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  petInfoText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0369A1',
    marginBottom: 4,
  },
  petInfoSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#0369A1',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 6,
  },
  selectableInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  selectableInputText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    flex: 1,
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  dateInputContainer: {
    marginBottom: 20,
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
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 50,
  },
  dateInputText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 10,
  },
});