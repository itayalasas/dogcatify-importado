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
import { colors, spacing, radius, fontSize } from '../../../../constants/theme';
import { HealthHeader } from '../../../../components/health';
import { toast } from '../../../../components/ui/Toast';

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

    // Handle selected allergy (only when coming from allergy selection)
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
    } else {
      // Restore complete allergy object when coming back from veterinarian selection
      if (params.selectedAllergyData && typeof params.selectedAllergyData === 'string') {
        try {
          const allergy = JSON.parse(params.selectedAllergyData);
          setSelectedAllergy(allergy);
          console.log('Restored complete allergy object:', allergy.name);
        } catch (error) {
          console.error('Error parsing selected allergy data:', error);
        }
      }

      // Restore allergy name when coming back from veterinarian selection
      if (params.currentCondition && typeof params.currentCondition === 'string') {
        setAllergyName(params.currentCondition);
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

    // Handle preserved values (only when not coming from allergy selection)
    if (!params.selectedAllergy) {
      if (params.currentType && typeof params.currentType === 'string') {
        setAllergyType(params.currentType);
      }

      if (params.currentSymptoms && typeof params.currentSymptoms === 'string') {
        setSymptoms(params.currentSymptoms);
      }

      if (params.currentSeverity && typeof params.currentSeverity === 'string') {
        setSeverity(params.currentSeverity);
      }
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
  }, [params.selectedAllergy, params.selectedAllergyData, params.selectedVeterinarian, params.currentCondition, params.currentType, params.currentSymptoms, params.currentSeverity, params.currentTreatment, params.currentVeterinarian, params.currentNotes, params.currentDiagnosisDate]);

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
        currentDiagnosisDate: diagnosisDate.toISOString(),
        // Preserve the complete selected allergy object
        ...(selectedAllergy && { selectedAllergyData: JSON.stringify(selectedAllergy) })
      }
    });
  };

  const handleBackNavigation = () => {
    router.replace({
      pathname: '/pets/[id]',
      params: { id, activeTab: 'health' }
    });
  };

  const getTypeName = (type: string) => {
    if (!type) return 'Sin tipo';
    const normalizedType = type.toLowerCase();
    const names: Record<string, string> = {
      alimentaria: 'Alimentaria',
      ambiental: 'Ambiental',
      medicamento: 'Medicamento',
      picaduras: 'Picaduras',
      contacto: 'Contacto',
      estacional: 'Estacional',
      pulgas: 'Pulgas',
      food: 'Alimentaria',
      environmental: 'Ambiental',
      medication: 'Medicamento',
      insect: 'Picaduras',
      contact: 'Contacto',
      seasonal: 'Estacional',
      flea: 'Pulgas',
      other: 'Otra'
    };
    return names[normalizedType] || type;
  };

  const getSeverityLabel = (severity: string) => {
    const normalizedSeverity = severity?.toLowerCase() || 'moderate';
    const labels: Record<string, string> = {
      mild: 'Leve',
      leve: 'Leve',
      moderate: 'Moderada',
      moderada: 'Moderada',
      severe: 'Severa',
      severa: 'Severa'
    };
    return labels[normalizedSeverity] || severity;
  };

  const getSeverityColor = (severity: string) => {
    const normalizedSeverity = severity?.toLowerCase() || 'moderate';
    const toneColors: Record<string, string> = {
      mild: colors.success,
      leve: colors.success,
      moderate: colors.warning,
      moderada: colors.warning,
      severe: colors.danger,
      severa: colors.danger
    };
    return toneColors[normalizedSeverity] || colors.warning;
  };

  const getSeverityBgColor = (severity: string) => {
    const normalizedSeverity = severity?.toLowerCase() || 'moderate';
    const toneColors: Record<string, string> = {
      mild: colors.successSoft,
      leve: colors.successSoft,
      moderate: colors.warningSoft,
      moderada: colors.warningSoft,
      severe: colors.dangerSoft,
      severa: colors.dangerSoft
    };
    return toneColors[normalizedSeverity] || colors.warningSoft;
  };

  const handleAddTemporaryVet = async () => {
    if (!tempVetName.trim()) {
      Alert.alert('Error', 'Ingresá el nombre del veterinario');
      return;
    }
    
    setTreatment(tempVetName.trim());
    setTempVetName('');
    setShowAddVetModal(false);
    toast.success('Veterinario agregado', `${tempVetName.trim()} quedó agregado temporalmente`);
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
      Alert.alert('Error', 'Completá los campos obligatorios');
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

      toast.success(isEditing ? 'Alergia actualizada' : 'Alergia registrada');
      router.push({
        pathname: '/pets/[id]',
        params: { id, activeTab: 'health' }
      });
    } catch (error) {
      console.error('Error saving allergy:', error);
      Alert.alert('Error', 'No se pudo registrar la alergia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader
        title={isEditing ? 'Editar alergia' : 'Nueva alergia'}
        subtitle={pet?.name}
        onBack={handleBackNavigation}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <View style={styles.iconContainer}>
            <AlertTriangle size={40} color={colors.warning} />
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
              accessibilityRole="button"
              onPress={handleSelectAllergy}
            >
              <Text style={[
                styles.selectableInputText,
                !allergyName && styles.placeholderText
              ]}>
                {allergyName || (pet?.species === 'dog' ? 
                  "Elegí una alergia para perros..." : 
                  "Elegí una alergia para gatos..."
                )}
              </Text>
              <ChevronDown size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Show additional info if AI-generated allergy was selected */}
          {selectedAllergy && (
            <View style={styles.aiInfoCard}>
              <View style={styles.aiInfoHeader}>
                <Text style={styles.aiInfoIcon}>🤖</Text>
                <Text style={styles.aiInfoTitle}>Información de IA</Text>
              </View>
              {selectedAllergy.description && (
                <Text style={styles.aiInfoDescription}>{selectedAllergy.description}</Text>
              )}
              {selectedAllergy.triggers && selectedAllergy.triggers.length > 0 && (
                <View style={styles.aiInfoSection}>
                  <Text style={styles.aiInfoLabel}>Desencadenantes:</Text>
                  <Text style={styles.aiInfoText}>{selectedAllergy.triggers.join(', ')}</Text>
                </View>
              )}
              {selectedAllergy.prevention_tips && selectedAllergy.prevention_tips.length > 0 && (
                <View style={styles.aiInfoSection}>
                  <Text style={styles.aiInfoLabel}>💡 Consejos de prevención:</Text>
                  {selectedAllergy.prevention_tips.map((tip: string, index: number) => (
                    <Text key={index} style={styles.aiInfoTip}>• {tip}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tipo de alergia</Text>
            {selectedAllergy ? (
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyInputText}>
                  {allergyType ? getTypeName(allergyType) : 'No especificado'}
                </Text>
              </View>
            ) : (
              <Input
                placeholder="Ej: Alimentaria, Ambiental, Medicamento..."
                value={allergyType}
                onChangeText={setAllergyType}
              />
            )}
          </View>

          <Input
            label="Síntomas *"
            placeholder="Ej: Picazón, enrojecimiento, vómitos..."
            value={symptoms}
            onChangeText={setSymptoms}
            multiline
            numberOfLines={3}
          />

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Severidad</Text>
            {selectedAllergy && severity ? (
              <View style={[styles.readOnlyInput, { backgroundColor: getSeverityBgColor(severity) }]}>
                <Text style={[styles.readOnlyInputText, { color: getSeverityColor(severity) }]}>
                  {getSeverityLabel(severity)}
                </Text>
              </View>
            ) : (
              <Input
                placeholder="Ej: Leve, Moderada, Severa"
                value={severity}
                onChangeText={setSeverity}
              />
            )}
          </View>

          {/* Treatment/Veterinarian - Navigable */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tratamiento / Veterinario</Text>
            <TouchableOpacity 
              style={styles.selectableInput}
              accessibilityRole="button"
              onPress={handleSelectVeterinarian}
            >
              <Text style={[
                styles.selectableInputText,
                !treatment && styles.placeholderText
              ]}>
                {treatment || "Elegí o escribí el tratamiento..."}
              </Text>
              <ChevronDown size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.addTempVetButton}
              accessibilityRole="button"
              onPress={() => setShowAddVetModal(true)}
            >
              <Text style={styles.addTempVetText}>+ Agregar veterinario temporal</Text>
            </TouchableOpacity>
            
            <Input
              placeholder="O escribí el tratamiento a mano..."
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
            title={isEditing ? "Guardar cambios" : "Guardar alergia"}
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
            <Text style={styles.modalTitle}>Agregar veterinario temporal</Text>
            <Text style={styles.modalSubtitle}>
              Si el veterinario no está en la lista, podés agregarlo temporalmente
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
  formCard: {
    margin: spacing.lg,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  petInfoContainer: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  petInfoText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.info,
    marginBottom: spacing.xs,
  },
  petInfoSubtext: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.info,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  selectableInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 50,
  },
  selectableInputText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    flex: 1,
  },
  placeholderText: {
    color: colors.textSecondary,
  },
  addTempVetButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  addTempVetText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 0,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    paddingBottom: 40,
    width: '100%',
    maxHeight: '60%',
    minHeight: 300,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'column',
    gap: spacing.lg,
    marginTop: spacing.xxl,
  },
  modalButton: {
    width: '100%',
  },
  aiInfoCard: {
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  aiInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  aiInfoIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  aiInfoTitle: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.success,
  },
  aiInfoDescription: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.success,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  aiInfoSection: {
    marginTop: spacing.sm,
  },
  aiInfoLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.success,
    marginBottom: spacing.xs,
  },
  aiInfoText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.success,
    lineHeight: 18,
  },
  aiInfoTip: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.success,
    lineHeight: 18,
    marginTop: 2,
  },
  readOnlyInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 50,
    justifyContent: 'center',
  },
  readOnlyInputText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
});
