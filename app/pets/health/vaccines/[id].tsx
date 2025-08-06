import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Syringe, ChevronDown } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card } from '../../../../components/ui/Card';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';

export default function AddVaccine() {
  const { id, recordId, refresh } = useLocalSearchParams<{ id: string; recordId?: string; refresh?: string }>();
  const params = useLocalSearchParams();
  const { currentUser } = useAuth();
  
  // Pet data
  const [pet, setPet] = useState<any>(null);
  
  // Form data
  const [vaccineName, setVaccineName] = useState('');
  const [vaccineDate, setVaccineDate] = useState(new Date());
  const [nextDueDate, setNextDueDate] = useState<Date | null>(null);
  const [veterinarian, setVeterinarian] = useState('');
  const [selectedVaccine, setSelectedVaccine] = useState<any>(null);
  const [selectedVeterinarian, setSelectedVeterinarian] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [showVaccineDatePicker, setShowVaccineDatePicker] = useState(false);
  const [showNextDueDatePicker, setShowNextDueDatePicker] = useState(false);
  const [showAddVetModal, setShowAddVetModal] = useState(false);
  const [tempVetName, setTempVetName] = useState('');

  // Handle return parameters from selection screens
  useEffect(() => {
    // Handle preserved application date
    if (params.currentApplicationDate && typeof params.currentApplicationDate === 'string') {
      try {
        setVaccineDate(new Date(params.currentApplicationDate));
      } catch (error) {
        console.error('Error parsing application date:', error);
      }
    }
    
    // Handle selected vaccine
    if (params.selectedVaccine) {
      try {
        const vaccine = JSON.parse(params.selectedVaccine as string);
        setVaccineName(vaccine.name);
        setSelectedVaccine(vaccine);
        console.log('Selected vaccine:', vaccine.name);
      } catch (error) {
        console.error('Error parsing selected vaccine:', error);
      }
    }
    
    // Handle selected veterinarian
    if (params.selectedVeterinarian) {
      try {
        const vet = JSON.parse(params.selectedVeterinarian as string);
        setVeterinarian(vet.name);
        setSelectedVeterinarian(vet);
        console.log('Selected veterinarian:', vet.name);
      } catch (error) {
        console.error('Error parsing selected veterinarian:', error);
      }
    }
    
    // Handle preserved values
    if (params.currentVeterinarian && typeof params.currentVeterinarian === 'string') {
      setVeterinarian(params.currentVeterinarian);
    }
    
    if (params.currentNotes && typeof params.currentNotes === 'string') {
      setNotes(params.currentNotes);
    }
    
    if (params.currentNextDueDate && typeof params.currentNextDueDate === 'string') {
      try {
        setNextDueDate(new Date(params.currentNextDueDate));
      } catch (error) {
        console.error('Error parsing next due date:', error);
      }
    }
  }, [params.selectedVaccine, params.currentVeterinarian, params.currentNotes, params.currentNextDueDate]);

  // Calculate next due date when vaccine date or selected vaccine changes
  useEffect(() => {
    if (selectedVaccine && vaccineDate) {
      calculateNextDueDate();
    }
  }, [selectedVaccine, vaccineDate]);

  const calculateNextDueDate = () => {
    if (!selectedVaccine || !vaccineDate || !pet) return;
    
    const nextDate = new Date(vaccineDate);
    
    // Logic based on vaccine type and pet age
    if (selectedVaccine.frequency) {
      const frequency = selectedVaccine.frequency.toLowerCase();
      
      if (frequency.includes('anual') || frequency.includes('yearly')) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else if (frequency.includes('6 meses') || frequency.includes('6 months')) {
        nextDate.setMonth(nextDate.getMonth() + 6);
      } else if (frequency.includes('3-4 semanas') || frequency.includes('3-4 weeks')) {
        nextDate.setDate(nextDate.getDate() + 28); // 4 weeks
      } else if (frequency.includes('2-3 semanas') || frequency.includes('2-3 weeks')) {
        nextDate.setDate(nextDate.getDate() + 21); // 3 weeks
      } else if (frequency.includes('refuerzo')) {
        const ageInWeeks = calculateAgeInWeeks(pet);
        // For boosters, check if it's puppy/kitten or adult
        if (ageInWeeks < 16) {
          // Puppy/kitten - next dose in 3-4 weeks
          nextDate.setDate(nextDate.getDate() + 28);
        } else {
          // Adult - annual booster
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
      } else {
        // Default: annual for most vaccines
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
    } else {
      // No frequency info - use age-based logic
      const ageInWeeks = calculateAgeInWeeks(pet);
      if (ageInWeeks < 16) {
        // Puppy/kitten - next dose in 4 weeks
        nextDate.setDate(nextDate.getDate() + 28);
      } else {
        // Adult - annual booster
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
    }
    
    setNextDueDate(nextDate);
  };

  const calculateAgeInWeeks = (petData: any) => {
    if (!petData.age_display && petData.age) {
      return petData.age * 52; // Default to years
    }
    
    if (!petData.age_display) {
      return 52; // Default to 1 year if no age data
    }
    
    const { value, unit } = petData.age_display;
    
    if (!value || !unit) {
      return petData.age ? petData.age * 52 : 52;
    }
    
    switch (unit) {
      case 'days':
        return value / 7;
      case 'months':
        return value * 4.33; // Average weeks per month
      case 'years':
      default:
        return value * 52;
    }
  };
  useEffect(() => {
    fetchPetData();
    
    if (recordId) {
      setIsEditing(true);
      fetchVaccineDetails();
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

  const handleSelectVaccine = () => {
    router.push({
      pathname: '/pets/health/select-vaccine',
      params: { 
        petId: id,
        species: pet?.species || 'dog',
        returnPath: `/pets/health/vaccines/${id}`,
        currentValue: vaccineName,
        // Preserve current form values
        currentVeterinarian: veterinarian,
        currentNotes: notes,
        currentNextDueDate: nextDueDate?.toISOString(),
        currentApplicationDate: vaccineDate.toISOString()
      }
    });
  };

  const handleSelectVeterinarian = () => {
    router.push({
      pathname: '/pets/health/select-veterinarian',
      params: { 
        petId: id,
        returnPath: `/pets/health/vaccines/${id}`,
        currentValue: veterinarian,
        // Preserve current form values
        currentCondition: vaccineName,
        currentNotes: notes,
        currentApplicationDate: vaccineDate.toISOString(),
        currentNextDueDate: nextDueDate?.toISOString()
      }
    });
  };

  const handleAddTemporaryVet = async () => {
    if (!tempVetName.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del veterinario');
      return;
    }
    
    setVeterinarian(tempVetName.trim());
    setTempVetName('');
    setShowAddVetModal(false);
    Alert.alert('Veterinario agregado', `${tempVetName.trim()} ha sido agregado temporalmente`);
  };
  const fetchVaccineDetails = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pet_health')
        .select('*')
        .eq('id', recordId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setVaccineName(data.name || '');
        
        // Parse application date
        if (data.application_date) {
          const [day, month, year] = data.application_date.split('/');
          if (day && month && year) {
            setVaccineDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
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
      console.error('Error fetching vaccine details:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la vacuna');
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const onVaccineDateChange = (event: any, selectedDate?: Date) => {
    setShowVaccineDatePicker(false);
    if (selectedDate) {
      setVaccineDate(selectedDate);
    }
  };

  const onNextDueDateChange = (event: any, selectedDate?: Date) => {
    setShowNextDueDatePicker(false);
    if (selectedDate) {
      setNextDueDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (!vaccineName.trim() || !vaccineDate) {
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
        type: 'vaccine',
        name: vaccineName.trim(),
        application_date: formatDate(vaccineDate),
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
            name: vaccineName.trim(),
            application_date: formatDate(vaccineDate),
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

      // Try to generate medical alert for next dose
      if (nextDueDate) {
        try {
          const alertDate = new Date(nextDueDate);
          alertDate.setDate(alertDate.getDate() - 7); // 7 days before
          
          if (alertDate > new Date()) {
            const { error: alertError } = await supabaseClient
              .from('medical_alerts')
              .insert({
                pet_id: id,
                user_id: currentUser.id,
                alert_type: 'vaccine',
                title: `Refuerzo de vacuna: ${vaccineName.trim()}`,
                description: `Es hora del refuerzo de ${vaccineName.trim()} para ${pet?.name}`,
                due_date: alertDate.toISOString().split('T')[0],
                priority: vaccineName.toLowerCase().includes('dhpp') || 
                         vaccineName.toLowerCase().includes('rabia') ? 'high' : 'medium',
                status: 'pending',
                metadata: {
                  vaccine_name: vaccineName.trim(),
                  last_application: formatDate(vaccineDate),
                  veterinarian: veterinarian.trim() || null
                }
              });
            
            if (alertError) {
              console.warn('Could not create medical alert:', alertError);
            } else {
              console.log('Medical alert created for next vaccine dose');
            }
          }
        } catch (alertError) {
          console.warn('Error creating medical alert:', alertError);
        }
      }

      Alert.alert('Éxito', isEditing ? 'Vacuna actualizada correctamente' : 'Vacuna registrada correctamente', [
        { text: 'OK', onPress: () => router.push({
          pathname: `/pets/${id}`,
          params: { activeTab: 'health' }
        }) }
      ]);
    } catch (error) {
      console.error('Error saving vaccine:', error);
      Alert.alert('Error', 'No se pudo registrar la vacuna');
    } finally {
      setLoading(false);
    }
  };

  const handleBackNavigation = () => {
    router.push({
      pathname: `/pets/${id}`,
      params: { activeTab: 'health' }
    });
  };
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackNavigation} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Editar Vacuna' : 'Agregar Vacuna'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <View style={styles.iconContainer}>
            <Syringe size={40} color="#3B82F6" />
          </View>

          {pet && (
            <View style={styles.petInfoContainer}>
              <Text style={styles.petInfoText}>
                {pet.species === 'dog' ? '🐕' : '🐱'} {pet.name} - {pet.breed}
              </Text>
              <Text style={styles.petInfoSubtext}>
                Vacunas específicas para {pet.species === 'dog' ? 'perros' : 'gatos'}
              </Text>
            </View>
          )}

          {/* Vaccine Name - Navigable */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nombre de la vacuna *</Text>
            <TouchableOpacity 
              style={styles.selectableInput}
              onPress={handleSelectVaccine}
            >
              <Text style={[
                styles.selectableInputText,
                !vaccineName && styles.placeholderText
              ]}>
                {vaccineName || (pet?.species === 'dog' ? 
                  "Seleccionar vacuna para perros..." : 
                  "Seleccionar vacuna para gatos..."
                )}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Vaccine Date */}
          <View style={styles.dateInputContainer}>
            <Text style={styles.dateInputLabel}>Fecha de aplicación *</Text>
            <TouchableOpacity 
              style={styles.dateInput}
              onPress={() => setShowVaccineDatePicker(true)}
            >
              <Calendar size={20} color="#6B7280" />
              <Text style={styles.dateInputText}>
                {formatDate(vaccineDate)}
              </Text>
            </TouchableOpacity>
            {showVaccineDatePicker && (
              <DateTimePicker
                value={vaccineDate}
                mode="date"
                display="default"
                onChange={onVaccineDateChange}
              />
            )}
          </View>

          {/* Next Due Date */}
          <View style={styles.dateInputContainer}>
            <Text style={styles.dateInputLabel}>Próxima dosis</Text>
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
            
            <TouchableOpacity 
              style={styles.addTempVetButton}
              onPress={() => setShowAddVetModal(true)}
            >
              <Text style={styles.addTempVetText}>+ Agregar veterinario temporal</Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Notas adicionales"
            placeholder="Observaciones, reacciones, etc."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <Button
            title={isEditing ? "Actualizar Vacuna" : "Guardar Vacuna"}
            onPress={handleSubmit}
            loading={loading}
            size="large"
          />
        </Card>
      </ScrollView>

      {/* Add Temporary Veterinarian Modal */}
      <Modal
        visible={showAddVetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddVetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Agregar Veterinario Temporal</Text>
            <Text style={styles.modalSubtitle}>
              Si el veterinario no está en la lista, puedes agregarlo temporalmente
            </Text>
            
            <Input
              label="Nombre del veterinario o clínica"
              placeholder="Ej: Dr. García, Clínica San Martín"
              value={tempVetName}
              onChangeText={setTempVetName}
            />
            
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={() => {
                  setShowAddVetModal(false);
                  setTempVetName('');
                }}
                variant="outline"
                size="large"
                style={styles.modalButton}
              />
              <Button
                title="Agregar"
                onPress={handleAddTemporaryVet}
                size="large"
                style={styles.modalButton}
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
    marginBottom: 8,
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
  addTempVetButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  addTempVetText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 0,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    width: '100%',
    maxHeight: '60%',
    minHeight: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'column',
    gap: 16,
    marginTop: 24,
  },
  modalButton: {
    width: '100%',
  },
});