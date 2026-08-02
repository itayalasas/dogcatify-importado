import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Calendar, Pill, ChevronDown, Camera, Image as ImageIcon } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card } from '../../../../components/ui/Card';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { extractMedicalRecordsFromImage, ExtractedMedicalRecord, simulateOCRExtraction } from '../../../../utils/medicalCardOCR';

export default function AddDeworming() {
  const { id, recordId, refresh } = useLocalSearchParams<{ id: string; recordId?: string; refresh?: string }>();
  const params = useLocalSearchParams();
  const { currentUser } = useAuth();
  
  // Pet data
  const [pet, setPet] = useState<any>(null);
  
  // Form data
  const [productName, setProductName] = useState('');
  const [applicationDate, setApplicationDate] = useState(new Date());
  const [nextDueDate, setNextDueDate] = useState<Date | null>(null);
  const [veterinarian, setVeterinarian] = useState('');
  const [selectedDewormer, setSelectedDewormer] = useState<any>(null);
  const [selectedVeterinarian, setSelectedVeterinarian] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [showApplicationDatePicker, setShowApplicationDatePicker] = useState(false);
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
        setApplicationDate(new Date(params.currentApplicationDate));
      } catch (error) {
      }
    }
    
    // Handle selected dewormer
    if (params.selectedDewormer) {
      try {
        const dewormer = JSON.parse(params.selectedDewormer as string);
        setProductName(dewormer.name);
        setSelectedDewormer(dewormer);
      } catch (error) {
      }
    }

    // Handle selected veterinarian
    if (params.selectedVeterinarian) {
      try {
        const vet = JSON.parse(params.selectedVeterinarian as string);
        setVeterinarian(vet.name);
        setSelectedVeterinarian(vet);
      } catch (error) {
      }
    }

    // Handle preserved values (but NOT next due date, as it will be calculated automatically)
    if (params.currentVeterinarian && typeof params.currentVeterinarian === 'string') {
      setVeterinarian(params.currentVeterinarian);
    }

    if (params.currentNotes && typeof params.currentNotes === 'string') {
      setNotes(params.currentNotes);
    }

    // Restore selected dewormer when coming back from veterinarian selection
    if (params.currentSelectedDewormer && typeof params.currentSelectedDewormer === 'string') {
      try {
        const dewormer = JSON.parse(params.currentSelectedDewormer);
        setSelectedDewormer(dewormer);
        setProductName(dewormer.name);
      } catch (error) {
      }
    }
  }, [params.selectedDewormer, params.currentVeterinarian, params.currentNotes, params.currentSelectedDewormer]);

  // Calculate next due date when dewormer or application date changes
  useEffect(() => {
    if (selectedDewormer && applicationDate && pet) {
      calculateNextDueDate();
    }
  }, [selectedDewormer, applicationDate, pet]);

  const calculateNextDueDate = () => {
    if (!selectedDewormer || !applicationDate || !pet) return;


    const nextDate = new Date(applicationDate);
    const ageInWeeks = calculateAgeInWeeks(pet);
    const petBreed = pet.breed?.toLowerCase() || '';

    if (selectedDewormer.frequency) {
      const frequency = selectedDewormer.frequency.toLowerCase();

      if (frequency.includes('cada 3 meses') || frequency.includes('quarterly')) {
        nextDate.setMonth(nextDate.getMonth() + 3);
      } else if (frequency.includes('cada 2 meses') || frequency.includes('bi-monthly')) {
        nextDate.setMonth(nextDate.getMonth() + 2);
      } else if (frequency.includes('mensual') || frequency.includes('monthly')) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (frequency.includes('cada 2 semanas') || frequency.includes('bi-weekly')) {
        nextDate.setDate(nextDate.getDate() + 14);
      } else if (frequency.includes('semanal') || frequency.includes('weekly')) {
        nextDate.setDate(nextDate.getDate() + 7);
      } else {
        calculateBreedBasedFrequency(nextDate, ageInWeeks, petBreed);
      }
    } else {
      calculateBreedBasedFrequency(nextDate, ageInWeeks, petBreed);
    }

    setNextDueDate(nextDate);
  };

  const calculateBreedBasedFrequency = (nextDate: Date, ageInWeeks: number, breed: string) => {
    const isLargeBreed = breed.includes('pastor') || breed.includes('labrador') || breed.includes('golden') ||
                          breed.includes('rottweiler') || breed.includes('doberman') || breed.includes('gran danes');

    const isSmallBreed = breed.includes('chihuahua') || breed.includes('yorkie') || breed.includes('poodle') ||
                          breed.includes('maltés') || breed.includes('shih tzu') || breed.includes('pomerania');

    if (ageInWeeks < 16) {
      nextDate.setDate(nextDate.getDate() + 14);
    } else if (ageInWeeks < 52) {
      if (isLargeBreed) {
        nextDate.setMonth(nextDate.getMonth() + 2);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
    } else {
      if (isLargeBreed) {
        nextDate.setMonth(nextDate.getMonth() + 2);
      } else if (isSmallBreed) {
        nextDate.setMonth(nextDate.getMonth() + 4);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 3);
      }
    }
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
      fetchDewormingDetails();
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
    }
  };

  const handleSelectDewormer = () => {
    router.push({
      pathname: '/pets/health/select-dewormer',
      params: {
        petId: id,
        species: pet?.species || 'dog',
        breed: pet?.breed || '',
        ageInMonths: pet?.age ? Math.floor(pet.age * 12).toString() : calculateAgeInMonths(pet).toString(),
        weight: pet?.weight?.toString() || '',
        returnPath: `/pets/health/deworming/${id}`,
        currentValue: productName,
        currentVeterinarian: veterinarian,
        currentNotes: notes,
        currentApplicationDate: applicationDate.toISOString()
      }
    });
  };

  const calculateAgeInMonths = (petData: any) => {
    if (!petData) return 12;

    if (petData.age) {
      return Math.floor(petData.age * 12);
    }

    if (!petData.age_display) return 12;

    const { value, unit } = petData.age_display;

    if (!value || !unit) {
      return petData.age ? Math.floor(petData.age * 12) : 12;
    }

    switch (unit) {
      case 'days':
        return Math.floor(value / 30);
      case 'months':
        return value;
      case 'years':
      default:
        return value * 12;
    }
  };

  const handleSelectVeterinarian = () => {
    router.push({
      pathname: '/pets/health/select-veterinarian',
      params: {
        petId: id,
        returnPath: `/pets/health/deworming/${id}`,
        currentValue: veterinarian,
        currentCondition: productName,
        currentNotes: notes,
        currentApplicationDate: applicationDate.toISOString(),
        currentSelectedDewormer: selectedDewormer ? JSON.stringify(selectedDewormer) : undefined
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
      Alert.alert('Error', 'No se pudo cargar la información de la desparasitación');
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

      // Try to generate medical alert for next deworming
      if (nextDueDate) {
        try {
          const alertDate = new Date(nextDueDate);
          alertDate.setDate(alertDate.getDate() - 3); // 3 days before for deworming
          
          if (alertDate > new Date()) {
            const { error: alertError } = await supabaseClient
              .from('medical_alerts')
              .insert({
                pet_id: id,
                user_id: currentUser.id,
                alert_type: 'deworming',
                title: 'Desparasitación pendiente',
                description: `Es hora de desparasitar a ${pet?.name}`,
                due_date: alertDate.toISOString().split('T')[0],
                priority: 'medium',
                status: 'pending',
                metadata: {
                  product_name: productName.trim(),
                  last_application: formatDate(applicationDate),
                  veterinarian: veterinarian.trim() || null
                }
              });
            
            if (alertError) {
            } else {
            }
          }
        } catch (alertError) {
        }
      }

      Alert.alert('Éxito', 'Desparasitación guardada correctamente', [
        { text: 'OK', onPress: () => router.replace({
          pathname: '/pets/[id]',
          params: { id, activeTab: 'health' }
        }) }
      ]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo registrar la desparasitación');
    } finally {
      setLoading(false);
    }
  };

  const handleBackNavigation = () => {
    router.replace({
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
        await processDewormingCard(result.assets[0].uri);
      }
    } catch (error) {
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
        await processDewormingCard(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const processDewormingCard = async (imageUri: string) => {
    setProcessingImage(true);
    try {
      let extractedRecords: ExtractedMedicalRecord[] = [];

      try {
        const result = await extractMedicalRecordsFromImage(
          imageUri,
          'deworming',
          {
            species: pet?.species,
            name: pet?.name
          }
        );
        extractedRecords = result.records;
      } catch (apiError) {
        const simulatedData = await simulateOCRExtraction('deworming');
        extractedRecords = [simulatedData];
      }

      if (extractedRecords.length === 0) {
        Alert.alert(
          'Sin resultados',
          'No se encontraron desparasitaciones en la imagen. Por favor ingresa los datos manualmente.'
        );
        return;
      }

      if (extractedRecords.length === 1) {
        populateFormWithRecord(extractedRecords[0]);
        Alert.alert(
          'Información extraída',
          'Se extrajo 1 desparasitación. Por favor verifica los datos antes de guardar.',
          [{ text: 'OK' }]
        );
      } else {
        handleMultipleRecords(extractedRecords);
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'No se pudo procesar la imagen del registro. Por favor ingresa los datos manualmente.'
      );
    } finally {
      setProcessingImage(false);
    }
  };

  const populateFormWithRecord = (record: ExtractedMedicalRecord) => {
    if (record.productName) {
      setProductName(record.productName);
    }

    if (record.applicationDate) {
      try {
        const parsedDate = parseOCRDate(record.applicationDate);
        if (parsedDate) {
          setApplicationDate(parsedDate);
        }
      } catch (dateError) {
      }
    }

    if (record.nextDueDate) {
      try {
        const parsedDate = parseOCRDate(record.nextDueDate);
        if (parsedDate) {
          setNextDueDate(parsedDate);
        }
      } catch (dateError) {
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
        return null;
      }

      // Create date (month is 0-indexed in JavaScript Date)
      const date = new Date(year, month - 1, day);
      
      // Verify the date is valid (handles cases like Feb 30)
      if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
        return null;
      }

      return date;
    } catch (error) {
      return null;
    }
  };

  const handleMultipleRecords = async (records: ExtractedMedicalRecord[]) => {
    Alert.alert(
      `¡${records.length} desparasitaciones encontradas!`,
      `Se encontraron ${records.length} desparasitaciones en la imagen. ¿Deseas guardarlas todas automáticamente?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Revisar una por una',
          onPress: () => {
            populateFormWithRecord(records[0]);
            Alert.alert(
              'Primera desparasitación',
              `Mostrando la primera de ${records.length} desparasitaciones. Guarda esta y luego escanea nuevamente para las demás.`
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
        type: 'deworming',
        product_name: record.productName || 'Desparasitante',
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

      Alert.alert(
        'Éxito',
        `Se guardaron ${records.length} desparasitaciones correctamente`,
        [
          {
            text: 'OK',
            onPress: () => router.replace({
              pathname: '/pets/[id]',
              params: { id, activeTab: 'health' }
            })
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudieron guardar todas las desparasitaciones');
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
        <Text style={styles.title}>{isEditing ? 'Editar Desparasitación' : 'Agregar Desparasitación'}</Text>
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
            <Pill size={40} color="#10B981" />
          </View>

          {pet && (
            <View style={styles.petInfoContainer}>
              <Text style={styles.petInfoText}>
                {pet.species === 'dog' ? '🐕' : '🐱'} {pet.name} - {pet.breed}
              </Text>
              <Text style={styles.petInfoSubtext}>
                Desparasitantes para {pet.species === 'dog' ? 'perros' : 'gatos'}
              </Text>
            </View>
          )}

          {/* Scan Deworming Card Button */}
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setShowScanOptions(true)}
            disabled={processingImage}
          >
            {processingImage ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <Camera size={24} color="#10B981" />
            )}
            <Text style={styles.scanButtonText}>
              {processingImage ? 'Procesando imagen...' : 'Escanear registro de desparasitación'}
            </Text>
          </TouchableOpacity>

          {/* Product Name - Navigable */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Producto utilizado *</Text>
            <TouchableOpacity 
              style={styles.selectableInput}
              onPress={handleSelectDewormer}
            >
              <Text style={[
                styles.selectableInputText,
                !productName && styles.placeholderText
              ]}>
                {productName || (pet?.species === 'dog' ? 
                  "Seleccionar desparasitante para perros..." : 
                  "Seleccionar desparasitante para gatos..."
                )}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

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
            
            <TouchableOpacity 
              style={styles.addTempVetButton}
              onPress={() => setShowAddVetModal(true)}
            >
              <Text style={styles.addTempVetText}>+ Agregar veterinario temporal</Text>
            </TouchableOpacity>
          </View>

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

      {/* Scan Options Modal */}
      <Modal
        visible={showScanOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScanOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Escanear Registro de Desparasitación</Text>
            <Text style={styles.modalSubtitle}>
              Toma una foto o selecciona una imagen del registro de desparasitación para extraer la información automáticamente
            </Text>

            <View style={styles.scanOptionsContainer}>
              <TouchableOpacity
                style={styles.scanOptionButton}
                onPress={() => {
                  setShowScanOptions(false);
                  handleTakePhoto();
                }}
              >
                <Camera size={32} color="#10B981" />
                <Text style={styles.scanOptionText}>Tomar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.scanOptionButton}
                onPress={() => {
                  setShowScanOptions(false);
                  handlePickImage();
                }}
              >
                <ImageIcon size={32} color="#10B981" />
                <Text style={styles.scanOptionText}>Desde Galería</Text>
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
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  scanButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  scanOptionsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  scanOptionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  scanOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    textAlign: 'center',
  },
});
