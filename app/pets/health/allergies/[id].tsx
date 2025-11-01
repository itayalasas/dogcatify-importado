import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, TriangleAlert as AlertTriangle, ChevronDown } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card } from '../../../../components/ui/Card';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth} from '../../../../contexts/AuthContext';

export default function AddAllergy() {
  const { id, recordId, refresh } = useLocalSearchParams<{ id: string; recordId?: string; refresh?: string }>();
  const params = useLocalSearchParams();
  const { currentUser } = useAuth();
  
  // Pet data
  const [pet, setPet] = useState<any>(null);
  
  // Form data
  const [allergyName, setAllergyName] = useState('');
  const [allergyType, setAllergyType] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [severity, setSeverity] = useState('');
  const [treatment, setTreatment] = useState('');
  const [selectedVeterinarian, setSelectedVeterinarian] = useState<any>(null);
  const [selectedAllergy, setSelectedAllergy] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [diagnosisDate, setDiagnosisDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddVetModal, setShowAddVetModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempVetName, setTempVetName] = useState('');

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

    // Handle selected allergy
    if (params.selectedAllergy) {
      try {
        const allergy = JSON.parse(params.selectedAllergy as string);
        setSelectedAllergy(allergy);
        setAllergyName(allergy.name);
        setAllergyType(allergy.allergy_type || allergy.category || '');

        // Pre-fill symptoms if available
        if (allergy.symptoms && Array.isArray(allergy.symptoms)) {
          setSymptoms(allergy.symptoms.join(', '));
        } else if (allergy.common_symptoms && Array.isArray(allergy.common_symptoms)) {
          setSymptoms(allergy.common_symptoms.join(', '));
        }

        // Pre-fill severity if available
        if (allergy.severity) {
          setSeverity(allergy.severity);
        }

        console.log('Selected allergy:', allergy.name);
      } catch (error) {
        console.error('Error parsing selected allergy:', error);
      }
    }

    // Handle selected veterinarian
    if (params.selectedVeterinarian) {
      try {
        const vet = JSON.parse(params.selectedVeterinarian as string);
        setTreatment(vet.name);
        setSelectedVeterinarian(vet);
        console.log('Selected veterinarian:', vet.name);
      } catch (error) {
        console.error('Error parsing selected veterinarian:', error);
      }
    }

    // Handle preserved values
    if (params.currentType && typeof params.currentType === 'string') {
      setAllergyType(params.currentType);
    }

    if (params.currentSymptoms && typeof params.currentSymptoms === 'string') {
      setSymptoms(params.currentSymptoms);
    }

    if (params.currentSeverity && typeof params.currentSeverity === 'string') {
      setSeverity(params.currentSeverity);
    }

    if (params.currentTreatment && typeof params.currentTreatment === 'string') {
      setTreatment(params.currentTreatment);
    }

    if (params.currentVeterinarian && typeof params.currentVeterinarian === 'string') {
      setTreatment(params.currentVeterinarian);
    }

    if (params.currentNotes && typeof params.currentNotes === 'string') {
      setNotes(params.currentNotes);
    }
  }, [params.selectedAllergy, params.selectedVeterinarian, params.currentType, params.currentSymptoms, params.currentSeverity, params.currentTreatment, params.currentVeterinarian, params.currentNotes, params.currentDiagnosisDate]);

  useEffect(() => {
    fetchPetData();
    
    if (recordId) {
      setIsEditing(true);
      fetchAllergyDetails();
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

  const handleSelectAllergy = () => {
    router.push({
      pathname: '/pets/health/select-allergy',
      params: {
        petId: id,
        species: pet?.species || 'dog',
        breed: pet?.breed || '',
        ageInMonths: pet?.age_in_months?.toString() || '',
        weight: pet?.weight?.toString() || '',
        returnPath: `/pets/health/allergies/${id}`,
        currentValue: allergyName,
        currentType: allergyType,
        currentSymptoms: symptoms,
        currentSeverity: severity,
        currentTreatment: treatment,
        currentVeterinarian: selectedVeterinarian?.name || '',
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
        returnPath: `/pets/health/allergies/${id}`,
        currentValue: treatment,
        currentCondition: allergyName,
        currentNotes: notes,
        currentType: allergyType,
        currentSymptoms: symptoms,
        currentSeverity: severity,
        currentDiagnosisDate: diagnosisDate.toISOString()
      }
    });
  };

  const handleBackNavigation = () => {
    router.replace({
      pathname: `/pets/${id}`,
      params: { activeTab: 'health' }
    });
  };

  const handleAddTemporaryVet = async () => {
    if (!tempVetName.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del veterinario');
      return;
    }
    
    setTreatment(tempVetName.trim());
    setTempVetName('');
    setShowAddVetModal(false);
    Alert.alert('Veterinario agregado', `${tempVetName.trim()} ha sido agregado temporalmente`);
  };
  const fetchAllergyDetails = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pet_health')
        .select('*')
        .eq('id', recordId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setAllergyName(data.name || '');
        setSymptoms(data.symptoms || '');
        setSeverity(data.severity || '');
        setTreatment(data.treatment || '');
        setNotes(data.notes || '');
      }
    } catch (error) {
      console.error('Error fetching allergy details:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la alergia');
    }
  };

  const handleSubmit = async () => {
    if (!allergyName.trim() || !symptoms.trim()) {
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
        type: 'allergy',
        name: allergyName.trim(),
        symptoms: symptoms.trim(),
        severity: severity.trim() || null,
        treatment: treatment.trim() || null,
        notes: notes.trim() || null,
        created_at: new Date().toISOString()
      };
      
      let error;
      
      if (isEditing) {
        // Update existing record
        const { error: updateError } = await supabaseClient
          .from('pet_health')
          .update({
            name: allergyName.trim(),
            symptoms: symptoms.trim(),
            severity: severity.trim() || null,
            treatment: treatment.trim() || null,
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

      Alert.alert('Éxito', isEditing ? 'Alergia actualizada correctamente' : 'Alergia registrada correctamente', [
        { text: 'OK', onPress: () => router.push({
          pathname: `/pets/${id}`,
          params: { activeTab: 'health' }
        }) }
      ]);
    } catch (error) {
      console.error('Error saving allergy:', error);
      Alert.alert('Error', 'No se pudo registrar la alergia');
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
        <Text style={styles.title}>{isEditing ? 'Editar Alergia' : 'Agregar Alergia'}</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <View style={styles.iconContainer}>
            <AlertTriangle size={40} color="#F59E0B" />
          </View>

          {pet && (
            <View style={styles.petInfoContainer}>
              <Text style={styles.petInfoText}>
                {pet.species === 'dog' ? '🐕' : '🐱'} {pet.name} - {pet.breed}
              </Text>
              <Text style={styles.petInfoSubtext}>
                Alergias comunes en {pet.species === 'dog' ? 'perros' : 'gatos'}
              </Text>
            </View>
          )}

          {/* Allergy Name - Navigable */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Alérgeno *</Text>
            <TouchableOpacity 
              style={styles.selectableInput}
              onPress={handleSelectAllergy}
            >
              <Text style={[
                styles.selectableInputText,
                !allergyName && styles.placeholderText
              ]}>
                {allergyName || (pet?.species === 'dog' ? 
                  "Seleccionar alergia para perros..." : 
                  "Seleccionar alergia para gatos..."
                )}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Input
            label="Tipo de alergia"
            placeholder="Ej: Alimentaria, Ambiental, Medicamento..."
            value={allergyType}
            onChangeText={setAllergyType}
          />

          <Input
            label="Síntomas *"
            placeholder="Ej: Picazón, enrojecimiento, vómitos..."
            value={symptoms}
            onChangeText={setSymptoms}
            multiline
            numberOfLines={2}
          />

          <Input
            label="Severidad"
            placeholder="Ej: Leve, Moderada, Severa"
            value={severity}
            onChangeText={setSeverity}
          />

          {/* Treatment/Veterinarian - Navigable */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tratamiento / Veterinario</Text>
            <TouchableOpacity 
              style={styles.selectableInput}
              onPress={handleSelectVeterinarian}
            >
              <Text style={[
                styles.selectableInputText,
                !treatment && styles.placeholderText
              ]}>
                {treatment || "Seleccionar veterinario o escribir tratamiento..."}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.addTempVetButton}
              onPress={() => setShowAddVetModal(true)}
            >
              <Text style={styles.addTempVetText}>+ Agregar veterinario temporal</Text>
            </TouchableOpacity>
            
            <Input
              placeholder="O escribe el tratamiento manualmente..."
              value={treatment}
              onChangeText={setTreatment}
              multiline
              numberOfLines={2}
            />
          </View>

          <Input
            label="Notas adicionales"
            placeholder="Observaciones, recomendaciones..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <Button
            title={isEditing ? "Actualizar Alergia" : "Guardar Alergia"}
            onPress={handleSubmit}
            loading={loading}
            size="large"
          />
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>

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