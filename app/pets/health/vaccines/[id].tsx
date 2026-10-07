import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Calendar, Syringe, ChevronDown, Camera, Image as ImageIcon } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card } from '../../../../components/ui/Card';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { extractMedicalRecordsFromImage, ExtractedMedicalRecord, simulateOCRExtraction } from '../../../../utils/medicalCardOCR';
import { colors, spacing, radius, fontSize } from '../../../../constants/theme';
import { HealthHeader, HealthStatusBadge } from '../../../../components/health';
import { toast } from '../../../../components/ui/Toast';

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
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

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
  }, [params.selectedVaccine, params.selectedVeterinarian, params.currentVeterinarian, params.currentNotes, params.currentNextDueDate, params.currentApplicationDate]);

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
        currentVaccine: vaccineName,
        currentSelectedVaccine: selectedVaccine ? JSON.stringify(selectedVaccine) : undefined,
        currentNotes: notes,
        currentApplicationDate: vaccineDate.toISOString(),
        currentNextDueDate: nextDueDate?.toISOString()
      }
    });
  };

  const handleAddTemporaryVet = async () => {
    if (!tempVetName.trim()) {
      Alert.alert('Error', 'Ingresá el nombre del veterinario');
      return;
    }
    
    setVeterinarian(tempVetName.trim());
    setTempVetName('');
    setShowAddVetModal(false);
    toast.success('Veterinario agregado', `${tempVetName.trim()} quedó agregado temporalmente`);
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
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

      toast.success(isEditing ? 'Vacuna actualizada' : 'Vacuna registrada');
      router.push({
        pathname: '/pets/[id]',
        params: { id, activeTab: 'health' }
      });
    } catch (error) {
      console.error('Error saving vaccine:', error);
      Alert.alert('Error', 'No se pudo registrar la vacuna');
    } finally {
      setLoading(false);
    }
  };

  const handleBackNavigation = () => {
    router.push({
      pathname: '/pets/[id]',
      params: { id, activeTab: 'health' }
    });
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processVaccinationCard(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para usar la cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processVaccinationCard(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const processVaccinationCard = async (imageUri: string) => {
    setProcessingImage(true);
    try {
      let extractedRecords: ExtractedMedicalRecord[] = [];

      try {
        const result = await extractMedicalRecordsFromImage(
          imageUri,
          'vaccine',
          {
            species: pet?.species,
            name: pet?.name
          }
        );
        extractedRecords = result.records;
      } catch (apiError) {
        console.log('API not available, using simulation:', apiError);
        const simulatedData = await simulateOCRExtraction('vaccine');
        extractedRecords = [simulatedData];
      }

      if (extractedRecords.length === 0) {
        Alert.alert(
          'Sin resultados',
          'No se encontraron vacunas en la imagen. Ingresá los datos a mano.'
        );
        return;
      }

      if (extractedRecords.length === 1) {
        populateFormWithRecord(extractedRecords[0]);
        toast.info('Información extraída', 'Se extrajo 1 vacuna. Revisá los datos antes de guardar.');
      } else {
        handleMultipleRecords(extractedRecords);
      }
    } catch (error) {
      console.error('Error processing vaccination card:', error);
      Alert.alert(
        'Error',
        'No se pudo procesar la imagen del carnet. Ingresá los datos a mano.'
      );
    } finally {
      setProcessingImage(false);
    }
  };

  const populateFormWithRecord = (record: ExtractedMedicalRecord) => {
    if (record.name) {
      setVaccineName(record.name);
    }

    if (record.applicationDate) {
      try {
        const parsedDate = parseOCRDate(record.applicationDate);
        if (parsedDate) {
          setVaccineDate(parsedDate);
          console.log('Parsed application date:', formatDate(parsedDate), 'from', record.applicationDate);
        }
      } catch (dateError) {
        console.error('Error parsing application date:', dateError);
      }
    }

    if (record.nextDueDate) {
      try {
        const parsedDate = parseOCRDate(record.nextDueDate);
        if (parsedDate) {
          setNextDueDate(parsedDate);
          console.log('Parsed next due date:', formatDate(parsedDate), 'from', record.nextDueDate);
        }
      } catch (dateError) {
        console.error('Error parsing next due date:', dateError);
      }
    }

    if (record.veterinarian) {
      setVeterinarian(record.veterinarian);
    }

    if (record.notes) {
      setNotes(record.notes);
    }
  };

  const parseOCRDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    try {
      // Format: DD/MM/YYYY or DD/MM/YY
      const parts = dateStr.split('/');
      if (parts.length !== 3) return null;

      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);

      // Handle 2-digit years
      if (year < 100) {
        // Si el año es menor a 50, asumimos 2000+
        // Si el año es 50 o mayor, asumimos 1900+
        year = year < 50 ? 2000 + year : 1900 + year;
      }

      // Validate date components
      if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
        console.error('Invalid date components:', { day, month, year });
        return null;
      }

      // Create date (month is 0-indexed in JavaScript Date)
      const date = new Date(year, month - 1, day);
      
      // Verify the date is valid (handles cases like Feb 30)
      if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
        console.error('Date validation failed:', { input: dateStr, parsed: date });
        return null;
      }

      return date;
    } catch (error) {
      console.error('Error parsing OCR date:', dateStr, error);
      return null;
    }
  };

  const handleMultipleRecords = async (records: ExtractedMedicalRecord[]) => {
    Alert.alert(
      `¡${records.length} vacunas encontradas!`,
      `Se encontraron ${records.length} vacunas en la imagen. ¿Querés guardarlas todas automáticamente?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Revisar una por una',
          onPress: () => {
            populateFormWithRecord(records[0]);
            toast.info(
              'Primera vacuna',
              `Mostrando la primera de ${records.length} vacunas. Guardá esta y después escaneá de nuevo para las demás.`
            );
          }
        },
        {
          text: 'Guardar todas',
          onPress: () => saveMultipleRecords(records)
        }
      ]
    );
  };

  const saveMultipleRecords = async (records: ExtractedMedicalRecord[]) => {
    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    setLoading(true);
    try {
      const recordsToInsert = records.map(record => ({
        pet_id: id,
        user_id: currentUser.id,
        type: 'vaccine',
        name: record.name || 'Vacuna',
        application_date: record.applicationDate || formatDate(new Date()),
        next_due_date: record.nextDueDate || null,
        veterinarian: record.veterinarian || null,
        notes: record.notes || null,
        created_at: new Date().toISOString()
      }));

      const { error } = await supabaseClient
        .from('pet_health')
        .insert(recordsToInsert);

      if (error) throw error;

      toast.success(`Se guardaron ${records.length} vacunas`);
      router.push({
        pathname: '/pets/[id]',
        params: { id, activeTab: 'health' }
      });
    } catch (error) {
      console.error('Error saving multiple vaccines:', error);
      Alert.alert('Error', 'No se pudieron guardar todas las vacunas');
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader
        title={isEditing ? 'Editar vacuna' : 'Nueva vacuna'}
        subtitle={pet?.name}
        onBack={handleBackNavigation}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.formCard}>
          <View style={styles.iconContainer}>
            <Syringe size={40} color={colors.primary} />
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

          {/* Scan Vaccination Card Button */}
          <TouchableOpacity
            style={styles.scanButton}
            accessibilityRole="button"
            onPress={() => setShowScanOptions(true)}
            disabled={processingImage}
          >
            {processingImage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Camera size={24} color={colors.primary} />
            )}
            <Text style={styles.scanButtonText}>
              {processingImage ? 'Procesando imagen...' : 'Escanear carnet de vacunación'}
            </Text>
          </TouchableOpacity>

          {/* Vaccine Name - Navigable */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nombre de la vacuna *</Text>
            <TouchableOpacity 
              style={styles.selectableInput}
              accessibilityRole="button"
              onPress={handleSelectVaccine}
            >
              <Text style={[
                styles.selectableInputText,
                !vaccineName && styles.placeholderText
              ]}>
                {vaccineName || (pet?.species === 'dog' ? 
                  "Elegí una vacuna para perros..." : 
                  "Elegí una vacuna para gatos..."
                )}
              </Text>
              <ChevronDown size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Vaccine Date */}
          <View style={styles.dateInputContainer}>
            <Text style={styles.dateInputLabel}>Fecha de aplicación *</Text>
            <TouchableOpacity 
              style={styles.dateInput}
              accessibilityRole="button"
              onPress={() => setShowVaccineDatePicker(true)}
            >
              <Calendar size={20} color={colors.textSecondary} />
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
            <View style={styles.labelRow}>
              <Text style={[styles.dateInputLabel, styles.labelRowText]}>Próxima dosis</Text>
              <HealthStatusBadge dueDate={nextDueDate} />
            </View>
            <TouchableOpacity 
              style={styles.dateInput}
              accessibilityRole="button"
              onPress={() => setShowNextDueDatePicker(true)}
            >
              <Calendar size={20} color={colors.textSecondary} />
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
              accessibilityRole="button"
              onPress={handleSelectVeterinarian}
            >
              <Text style={[
                styles.selectableInputText,
                !veterinarian && styles.placeholderText
              ]}>
                {veterinarian || "Elegí un veterinario..."}
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
            title={isEditing ? "Guardar cambios" : "Guardar vacuna"}
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

      {/* Scan Options Modal */}
      <Modal
        visible={showScanOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScanOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Escanear carnet de vacunación</Text>
            <Text style={styles.modalSubtitle}>
              Sacá una foto o elegí una imagen del carnet de vacunación para extraer la información automáticamente
            </Text>

            <View style={styles.scanOptionsContainer}>
              <TouchableOpacity
                style={styles.scanOptionButton}
                accessibilityRole="button"
                onPress={() => {
                  setShowScanOptions(false);
                  handleTakePhoto();
                }}
              >
                <Camera size={32} color={colors.primary} />
                <Text style={styles.scanOptionText}>Sacar foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.scanOptionButton}
                accessibilityRole="button"
                onPress={() => {
                  setShowScanOptions(false);
                  handlePickImage();
                }}
              >
                <ImageIcon size={32} color={colors.primary} />
                <Text style={styles.scanOptionText}>Desde la galería</Text>
              </TouchableOpacity>
            </View>

            <Button
              title="Cancelar"
              onPress={() => setShowScanOptions(false)}
              variant="outline"
              size="large"
            />
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
  keyboardAvoidingView: {
    flex: 1,
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
  dateInputContainer: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelRowText: {
    marginBottom: 0,
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
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  scanButtonText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary,
  },
  scanOptionsContainer: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  scanOptionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  scanOptionText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
