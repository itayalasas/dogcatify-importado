import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Modal, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Scale, Syringe, Heart, TriangleAlert as AlertTriangle, Pill, Camera, Plus, CreditCard as Edit, Trash2, Play, Image as ImageIcon, X } from 'lucide-react-native';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { extractMedicalRecordsFromImage, ExtractedMedicalRecord } from '../../utils/medicalCardOCR';

export default function PetDetail() {
  const { id, refresh, activeTab: initialTab, permissionLevel } = useLocalSearchParams<{
    id: string;
    refresh?: string;
    activeTab?: string;
    permissionLevel?: string;
  }>();
  const { currentUser } = useAuth();

  // Determine if user has edit permissions
  const canEdit = !permissionLevel || permissionLevel === 'edit' || permissionLevel === 'full';
  const [pet, setPet] = useState<any>(null);
  const [vaccines, setVaccines] = useState<any[]>([]);
  const [illnesses, setIllnesses] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [dewormings, setDewormings] = useState<any[]>([]);
  const [weightRecords, setWeightRecords] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialWeightCreated, setInitialWeightCreated] = useState(false);
  const [isCreatingInitialWeight, setIsCreatingInitialWeight] = useState(false);
  const [medicalAlerts, setMedicalAlerts] = useState<any[]>([]);
  const [behaviorHistory, setBehaviorHistory] = useState<any[]>([]);
  const [selectedTrait, setSelectedTrait] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basics' | 'health' | 'albums' | 'behavior' | 'appointments'>(
    initialTab as any || 'basics'
  );
  const [showScanOptionsModal, setShowScanOptionsModal] = useState(false);
  const [scanRecordType, setScanRecordType] = useState<'vaccine' | 'deworming' | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [showAlertModal, setShowAlertModal] = useState(false);

  useEffect(() => {
    fetchPetDetails();
    fetchHealthRecords();
    fetchAlbums();
    fetchMedicalAlerts();
    fetchBehaviorHistory();
  }, [id]);

  useEffect(() => {
    if (medicalAlerts.length > 0 && currentAlertIndex === 0 && !showAlertModal) {
      setTimeout(() => {
        setShowAlertModal(true);
      }, 1000);
    }
  }, [medicalAlerts]);

  // Add effect to refetch health records when returning from health forms
  useEffect(() => {
    if (refresh === 'true' && activeTab === 'health') {
      console.log('Refreshing health records due to refresh param');
      fetchHealthRecords();
    }
    if (refresh === 'true' && activeTab === 'behavior') {
      console.log('Refreshing behavior history due to refresh param');
      fetchBehaviorHistory();
    }
  }, [refresh, activeTab]);

  // Separate effect to create initial weight record after data is loaded
  useEffect(() => {
    if (pet && pet.weight && currentUser && weightRecords.length === 0 && !initialWeightCreated && !isCreatingInitialWeight) {
      console.log('✅ Creating initial weight record for pet:', pet.name);
      createInitialWeightRecord();
    }
  }, [pet, weightRecords, currentUser, initialWeightCreated, isCreatingInitialWeight]);

  useEffect(() => {
    // Refresh albums when returning from add album screen
    if (refresh === 'true') {
      fetchAlbums();
    }
  }, [refresh]);

  const handleBackNavigation = () => {
    router.push('/(tabs)/pets');
  };
  
  const fetchPetDetails = async () => {
    try {
      const { data: petData, error } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (petData && !error) {
        setPet({
          id: petData.id,
          ...petData
        });
      }
    } catch (error) {
      console.error('Error fetching pet details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthRecords = async () => {
    try {
      console.log('Fetching health records for pet:', id);
      const { data: healthRecords, error } = await supabaseClient
        .from('pet_health') 
        .select('*')
        .eq('pet_id', id)
        .order('created_at', { ascending: false });
      
      console.log('Health records fetched:', healthRecords?.length || 0);
      console.log('Raw health records data:', healthRecords);
      
      if (healthRecords && !error) {
        const processedRecords = healthRecords.map(record => ({
          ...record,
          createdAt: new Date(record.created_at || Date.now()),
          name: record.name || record.product_name || 'Sin nombre',
          applicationDate: record.application_date || '',
          diagnosisDate: record.diagnosis_date || '',
          nextDueDate: record.next_due_date || '',
          productName: record.product_name || '',
          symptoms: record.symptoms || '',
          severity: record.severity || '',
          treatment: record.treatment || '',
          veterinarian: record.veterinarian || '',
          status: record.status || 'active'
        }));
      
        // Filter by type with debugging
        const vaccinesFiltered = processedRecords.filter(record => record.type === 'vaccine');
        const illnessesFiltered = processedRecords.filter(record => record.type === 'illness');
        const allergiesFiltered = processedRecords.filter(record => record.type === 'allergy');
        const dewormingsFiltered = processedRecords.filter(record => record.type === 'deworming');
        const weightRecordsFiltered = processedRecords.filter(record => record.type === 'weight');
        
        console.log('Filtered records:', {
          vaccines: vaccinesFiltered.length,
          illnesses: illnessesFiltered.length,
          allergies: allergiesFiltered.length,
          dewormings: dewormingsFiltered.length,
          weight: weightRecordsFiltered.length
        });
        
        setVaccines(vaccinesFiltered);
        setIllnesses(illnessesFiltered);
        setAllergies(allergiesFiltered);
        setDewormings(dewormingsFiltered);
        
        setWeightRecords(weightRecordsFiltered);
        
        // If no weight records exist but pet has weight, create initial record
        if (weightRecordsFiltered.length === 0 && pet && pet.weight && currentUser) {
          console.log('No weight records found, creating initial record...');
          await createInitialWeightRecord();
        }
      } else if (error) {
        console.error('Error fetching health records:', error);
        Alert.alert('Error', 'No se pudieron cargar los registros de salud');
      }
    } catch (error) {
      console.error('Error fetching health records:', error);
      Alert.alert('Error', 'Error al cargar los datos de salud');
    }
  };
  
  const createInitialWeightRecord = async () => {
    if (!pet || !pet.weight || !currentUser || weightRecords.length > 0) {
      console.log('Cannot create initial weight record - missing data');
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
      console.log('Creating initial weight record for:', pet.name, 'Weight:', pet.weight);
      
      const initialWeightData = {
        pet_id: id,
        user_id: currentUser.id,
        type: 'weight',
        weight: pet.weight,
        weight_unit: pet.weight_display?.unit || 'kg',
        date: new Date(pet.created_at).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }),
        notes: 'Peso inicial al registrar la mascota',
        created_at: new Date().toISOString()
      };
      
      console.log('Initial weight data:', initialWeightData);
      
      const { error } = await supabaseClient
        .from('pet_health')
        .insert(initialWeightData);
      
      if (error) {
        console.error('Error creating initial weight record:', error);
      } else {
        console.log('Initial weight record created successfully');
        // Refresh health records to show the new weight record
        setTimeout(() => {
          fetchHealthRecords();
        }, 500);
      }
    } catch (error) {
      console.error('Error in createInitialWeightRecord:', error);
    }
  };

  const fetchAlbums = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pet_albums')
        .select('*')
        .eq('pet_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        // Procesar las URLs de las imágenes para asegurarse de que sean completas
        const processedAlbums = data.map(album => {
          let processedImages = album.images || [];
          if (processedImages.length > 0) {
            processedImages = processedImages.map((img: string) => {
              if (img && img.startsWith('/storage/v1/object/public/')) {
                const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
                return `${supabaseUrl}${img}`;
              }
              return img;
            });
          }
          
          return {
            ...album,
            images: processedImages,
            createdAt: new Date(album.created_at)
          };
        });
        
        setAlbums(processedAlbums);
      }
    } catch (error) {
      console.error('Error fetching albums:', error);
    }
  };

  const fetchMedicalAlerts = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('medical_alerts')
        .select('*')
        .eq('pet_id', id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      setMedicalAlerts(data || []);
    } catch (error) {
      console.error('Error fetching medical alerts:', error);
    }
  };

  const handleCompleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabaseClient
        .from('medical_alerts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      setShowAlertModal(false);

      if (currentAlertIndex < medicalAlerts.length - 1) {
        setTimeout(() => {
          setCurrentAlertIndex(currentAlertIndex + 1);
          setShowAlertModal(true);
        }, 500);
      } else {
        setCurrentAlertIndex(0);
      }

      fetchMedicalAlerts();
    } catch (error) {
      console.error('Error completing alert:', error);
      Alert.alert('Error', 'No se pudo marcar la alerta como completada');
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabaseClient
        .from('medical_alerts')
        .update({
          status: 'dismissed',
          completed_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      setShowAlertModal(false);

      if (currentAlertIndex < medicalAlerts.length - 1) {
        setTimeout(() => {
          setCurrentAlertIndex(currentAlertIndex + 1);
          setShowAlertModal(true);
        }, 500);
      } else {
        setCurrentAlertIndex(0);
      }

      fetchMedicalAlerts();
    } catch (error) {
      console.error('Error dismissing alert:', error);
      Alert.alert('Error', 'No se pudo descartar la alerta');
    }
  };

  const getAlertPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#DC2626';
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'vaccine': return <Syringe size={16} color="#3B82F6" />;
      case 'deworming': return <Pill size={16} color="#10B981" />;
      case 'checkup': return <Heart size={16} color="#EF4444" />;
      default: return <Calendar size={16} color="#6B7280" />;
    }
  };

  const formatAlertDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Vencida';
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays <= 7) return `En ${diffDays} días`;
    return date.toLocaleDateString();
  };

  const handleAddVaccine = () => {
    router.push(`/pets/health/vaccines/${id}`);
  };

  const handleAddIllness = () => {
    router.push(`/pets/health/illness/${id}`);
  };

  const handleAddAllergy = () => {
    router.push(`/pets/health/allergies/${id}`);
  };

  const handleAddDeworming = () => {
    router.push(`/pets/health/deworming/${id}`);
  };

  const handleScanMedicalCard = (type: 'vaccine' | 'deworming') => {
    setScanRecordType(type);
    setShowScanOptionsModal(true);
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
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await processMedicalCard(result.assets[0].uri, result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
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
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await processMedicalCard(result.assets[0].uri, result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };

  const processMedicalCard = async (imageUri: string, base64Data?: string) => {
    if (!scanRecordType) {
      Alert.alert('Error', 'No se especificó el tipo de registro');
      return;
    }

    setProcessingImage(true);
    try {
      console.log('Processing medical card:', imageUri, 'Type:', scanRecordType);

      const result = await extractMedicalRecordsFromImage(
        imageUri,
        scanRecordType,
        {
          species: pet?.species,
          name: pet?.name
        },
        base64Data
      );

      console.log('Result from extraction:', result);

      if (!result || !result.records) {
        throw new Error('Respuesta inválida del servidor');
      }

      if (result.records.length === 0) {
        Alert.alert(
          'Sin resultados',
          `No se encontraron ${scanRecordType === 'vaccine' ? 'vacunas' : 'desparasitaciones'} en la imagen.\n\nConsejos:\n• Asegúrate de que la imagen esté clara y enfocada\n• La escritura manual puede ser difícil de reconocer\n• Intenta con una imagen con mejor iluminación`,
          [{ text: 'Entendido' }]
        );
        return;
      }

      const recordType = scanRecordType;

      if (result.records.length === 1) {
        Alert.alert(
          '1 registro encontrado',
          '¿Deseas guardar este registro?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Guardar', onPress: () => saveMultipleRecords(result.records, recordType) }
          ]
        );
      } else {
        Alert.alert(
          `¡${result.records.length} registros encontrados!`,
          `Se encontraron ${result.records.length} ${recordType === 'vaccine' ? 'vacunas' : 'desparasitaciones'}. ¿Deseas guardarlas todas?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Guardar todas', onPress: () => saveMultipleRecords(result.records, recordType) }
          ]
        );
      }
    } catch (error: any) {
      console.error('Error processing medical card:', error);
      const errorMessage = error?.message || 'Error desconocido';
      Alert.alert(
        'Error',
        `No se pudo procesar la imagen. ${errorMessage}`
      );
    } finally {
      setProcessingImage(false);
      setShowScanOptionsModal(false);
      setScanRecordType(null);
    }
  };

  const saveMultipleRecords = async (records: ExtractedMedicalRecord[], recordType: 'vaccine' | 'deworming') => {
    if (!currentUser) return;

    setProcessingImage(true);
    try {
      const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };

      const recordsToInsert = records.map(record => {
        if (recordType === 'vaccine') {
          return {
            pet_id: id,
            user_id: currentUser.id,
            type: 'vaccine',
            name: record.name || 'Vacuna',
            application_date: record.applicationDate || formatDate(new Date()),
            next_due_date: record.nextDueDate || null,
            veterinarian: record.veterinarian || null,
            notes: record.notes || null,
            created_at: new Date().toISOString()
          };
        } else {
          return {
            pet_id: id,
            user_id: currentUser.id,
            type: 'deworming',
            product_name: record.productName || 'Desparasitante',
            application_date: record.applicationDate || formatDate(new Date()),
            next_due_date: record.nextDueDate || null,
            veterinarian: record.veterinarian || null,
            notes: record.notes || null,
            created_at: new Date().toISOString()
          };
        }
      });

      const { error } = await supabaseClient
        .from('pet_health')
        .insert(recordsToInsert);

      if (error) throw error;

      Alert.alert(
        'Éxito',
        `Se guardaron ${records.length} ${recordType === 'vaccine' ? 'vacunas' : 'desparasitaciones'} correctamente`
      );

      fetchHealthRecords();
    } catch (error) {
      console.error('Error saving multiple records:', error);
      Alert.alert('Error', 'No se pudieron guardar los registros');
    } finally {
      setProcessingImage(false);
    }
  };
  
  const handleAddWeight = () => {
    router.push({
      pathname: `/pets/health/weight/${id}`,
      params: { refresh: 'true' }
    });
  };

  const handleAddPhoto = () => {
    router.push(`/pets/albums/add/${id}`);
  };

  // Edit handlers
  const handleEditVaccine = (vaccineId: string) => {
    router.push({
      pathname: `/pets/health/vaccines/${id}`,
      params: { recordId: vaccineId }
    });
  };

  const handleEditIllness = (illnessId: string) => {
    router.push({
      pathname: `/pets/health/illness/${id}`,
      params: { recordId: illnessId }
    });
  };

  const handleEditAllergy = (allergyId: string) => {
    router.push({
      pathname: `/pets/health/allergies/${id}`,
      params: { recordId: allergyId }
    });
  };

  const handleEditDeworming = (dewormingId: string) => {
    router.push({
      pathname: `/pets/health/deworming/${id}`,
      params: { recordId: dewormingId }
    });
  };

  // Delete handlers
  const handleDeleteVaccine = (vaccineId: string, vaccineName: string) => {
    Alert.alert(
      'Eliminar Vacuna',
      `¿Estás seguro de eliminar "${vaccineName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('pet_health')
                .delete()
                .eq('id', vaccineId);

              if (error) throw error;

              await fetchHealthRecords();
              Alert.alert('Éxito', 'Vacuna eliminada correctamente');
            } catch (error) {
              console.error('Error deleting vaccine:', error);
              Alert.alert('Error', 'No se pudo eliminar la vacuna');
            }
          }
        }
      ]
    );
  };

  const handleDeleteIllness = (illnessId: string, illnessName: string) => {
    Alert.alert(
      'Eliminar Enfermedad',
      `¿Estás seguro de eliminar "${illnessName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('pet_health')
                .delete()
                .eq('id', illnessId);

              if (error) throw error;

              await fetchHealthRecords();
              Alert.alert('Éxito', 'Enfermedad eliminada correctamente');
            } catch (error) {
              console.error('Error deleting illness:', error);
              Alert.alert('Error', 'No se pudo eliminar la enfermedad');
            }
          }
        }
      ]
    );
  };

  const handleDeleteAllergy = (allergyId: string, allergyName: string) => {
    Alert.alert(
      'Eliminar Alergia',
      `¿Estás seguro de eliminar "${allergyName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('pet_health')
                .delete()
                .eq('id', allergyId);

              if (error) throw error;

              await fetchHealthRecords();
              Alert.alert('Éxito', 'Alergia eliminada correctamente');
            } catch (error) {
              console.error('Error deleting allergy:', error);
              Alert.alert('Error', 'No se pudo eliminar la alergia');
            }
          }
        }
      ]
    );
  };

  const handleDeleteDeworming = (dewormingId: string, productName: string) => {
    Alert.alert(
      'Eliminar Desparasitación',
      `¿Estás seguro de eliminar "${productName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('pet_health')
                .delete()
                .eq('id', dewormingId);

              if (error) throw error;

              await fetchHealthRecords();
              Alert.alert('Éxito', 'Desparasitación eliminada correctamente');
            } catch (error) {
              console.error('Error deleting deworming:', error);
              Alert.alert('Error', 'No se pudo eliminar la desparasitación');
            }
          }
        }
      ]
    );
  };

  const fetchBehaviorHistory = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pet_behavior')
        .select('*')
        .eq('pet_id', id)
        .order('assessment_date', { ascending: false });

      if (data && !error) {
        setBehaviorHistory(data);
      }
    } catch (error) {
      console.error('Error fetching behavior history:', error);
    }
  };

  const handleBehaviorAssessment = () => {
    router.push({
      pathname: `/pets/behavior/${id}`,
      params: { returnTo: 'behavior' }
    });
  };

  const handleViewAppointments = () => {
    router.push(`/pets/appointments/${id}`);
  };

  const handleGenerateMedicalHistory = async () => {
    if (!currentUser || !pet) {
      Alert.alert('Error', 'Información insuficiente para generar la historia clínica');
      return;
    }

    Alert.alert(
      'Generar Historia Clínica',
      '¿Qué deseas hacer?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Generar PDF', 
          onPress: () => generatePDF()
        },
        { 
          text: 'Generar QR para Veterinario', 
          onPress: () => generateQRForVet()
        }
      ]
    );
  };

  const generatePDF = async () => {
    try {
      Alert.alert('Generando historia clínica', 'Por favor espera...');
      
      // Import and use the function
      const { generateMedicalHistoryHTML } = await import('../../utils/medicalHistoryPDF');
      const htmlContent = await generateMedicalHistoryHTML(pet.id, currentUser!.id);
      
      // Navigate to a preview screen where user can share or view
      router.push({
        pathname: '/pets/medical-history-preview',
        params: {
          petId: pet.id,
          petName: pet.name,
          htmlContent: btoa(unescape(encodeURIComponent(htmlContent)))
        }
      });
    } catch (error) {
      console.error('Error generating medical history:', error);
      Alert.alert('Error', 'No se pudo generar la historia clínica');
    }
  };

  const generateQRForVet = async () => {
    try {
      Alert.alert('Generando enlace seguro', 'Creando enlace temporal para veterinario...');
      
      // Generate secure token for medical history access
      const { createMedicalHistoryToken } = await import('../../utils/medicalHistoryTokens');
      const tokenResult = await createMedicalHistoryToken(pet.id, currentUser!.id, 2); // 2 hours
      
      if (!tokenResult.success || !tokenResult.token) {
        throw new Error(tokenResult.error || 'No se pudo generar el enlace seguro');
      }
      
      // Create URL with token parameter
      const baseUrl = process.env.EXPO_PUBLIC_APP_DOMAIN || process.env.EXPO_PUBLIC_APP_URL || 'https://app-dogcatify.netlify.app';
      const shareUrl = `${baseUrl}/medical-history/${pet.id}?token=${tokenResult.token}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}&format=png&margin=20&ecc=M&color=2D6A6F&bgcolor=FFFFFF`;
      const shortUrl = `dogcatify.com/vet/${tokenResult.token.slice(-8)}`;
      
      // Navigate to QR sharing screen
      router.push({
        pathname: '/pets/share-medical-history',
        params: {
          petId: pet.id,
          petName: pet.name,
          qrCodeUrl,
          shareUrl,
          shortUrl,
          token: tokenResult.token,
          expiresAt: tokenResult.expiresAt?.toISOString()
        }
      });
    } catch (error) {
      console.error('Error generating QR for vet:', error);
      Alert.alert('Error', 'No se pudo generar el QR para veterinario');
    }
  };
  
  const handleBookAppointment = () => {
    router.push('/(tabs)/services');
  };
  
  const handleUpdatePhoto = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Upload the image
        const imageUri = result.assets[0].uri;
        const filename = `pets/${id}/${Date.now()}.jpg`;
        
        // Show loading
        Alert.alert('Actualizando foto', 'Subiendo imagen...');
        
        // Create form data for upload
        const formData = new FormData();
        formData.append('file', {
          uri: imageUri,
          type: 'image/jpeg',
          name: filename,
        } as any);

        // Upload to Supabase storage
        const { data, error } = await supabaseClient.storage
          .from('dogcatify')
          .upload(filename, formData, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
          .from('dogcatify')
          .getPublicUrl(filename);
        
        // Update pet record with new photo URL
        const { error: updateError } = await supabaseClient
          .from('pets')
          .update({ photo_url: publicUrl })
          .eq('id', id);

        if (updateError) throw updateError;
        
        // Update local state
        setPet({...pet, photo_url: publicUrl});
        
        Alert.alert('Éxito', 'Foto de perfil actualizada correctamente');
      }
    } catch (error) {
      console.error('Error updating pet photo:', error);
      Alert.alert('Error', 'No se pudo actualizar la foto de perfil');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando información de la mascota...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontró la mascota</Text>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const renderBasicsTab = () => (
    <Card style={styles.infoCard}>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Especie:</Text>
        <Text style={styles.infoValue}>
          {pet.species === 'dog' ? '🐕 Perro' : '🐱 Gato'}
        </Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Raza:</Text>
        <Text style={styles.infoValue}>{pet.breed}</Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Sexo:</Text>
        <Text style={styles.infoValue}>
          {pet.gender === 'male' ? '♂️ Macho' : '♀️ Hembra'}
        </Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Edad:</Text>
        <Text style={styles.infoValue}>
          {pet.ageDisplay ? `${pet.ageDisplay.value} ${pet.ageDisplay.unit === 'years' ? 'años' : pet.ageDisplay.unit === 'months' ? 'meses' : 'días'}` : `${pet.age} años`}
        </Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Peso:</Text>
        <Text style={styles.infoValue}>
          {pet.weightDisplay ? `${pet.weightDisplay.value} ${pet.weightDisplay.unit}` : `${pet.weight} kg`}
        </Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Estado:</Text>
        <Text style={styles.infoValue}>
          {pet.isNeutered ? 'Castrado' : 'No castrado'}
        </Text>
      </View>
      
      {pet.hasChip && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Microchip:</Text>
          <Text style={styles.infoValue}>{pet.chipNumber || 'Sí'}</Text>
        </View>
      )}
    </Card>
  );

  const renderHealthTab = () => (
    <View style={styles.healthContainer}>
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleContainer}>
            <Syringe size={20} color="#3B82F6" />
            <Text style={styles.healthTitle}>Vacunas</Text>
          </View>
          {canEdit && (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => handleScanMedicalCard('vaccine')}
              >
                <Camera size={16} color="#3B82F6" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={handleAddVaccine}>
                <Plus size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {vaccines.length === 0 ? (
          <Text style={styles.emptyText}>No hay vacunas registradas</Text>
        ) : (
          vaccines.map((vaccine) => (
            <Card key={vaccine.id} style={styles.healthCard}>
              <View style={styles.healthCardContent}>
                <View style={styles.healthCardInfo}>
                  <Text style={styles.healthItemTitle}>{vaccine.name}</Text>
                  <Text style={styles.healthItemDate}>
                    Aplicada: {vaccine.applicationDate}
                  </Text>
                  {vaccine.nextDueDate && (
                    <Text style={styles.healthItemNextDate}>
                      Próxima: {vaccine.nextDueDate}
                    </Text>
                  )}
                  {vaccine.veterinarian && (
                    <Text style={styles.healthItemVet}>
                      Veterinario: {vaccine.veterinarian}
                    </Text>
                  )}
                  {vaccine.notes && (
                    <Text style={styles.healthItemNotes}>
                      {vaccine.notes}
                    </Text>
                  )}
                </View>
                {canEdit && (
                  <View style={styles.healthCardActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditVaccine(vaccine.id)}
                    >
                      <Edit size={18} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteVaccine(vaccine.id, vaccine.name)}
                    >
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Card>
          ))
        )}
      </View>
      
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleContainer}>
            <Heart size={20} color="#EF4444" />
            <Text style={styles.healthTitle}>Enfermedades</Text>
          </View>
          {canEdit && (
            <TouchableOpacity style={styles.addButton} onPress={handleAddIllness}>
              <Plus size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {illnesses.length === 0 ? (
          <Text style={styles.emptyText}>No hay enfermedades registradas</Text>
        ) : (
          illnesses.map((illness) => (
            <Card key={illness.id} style={styles.healthCard}>
              <View style={styles.healthCardContent}>
                <View style={styles.healthCardInfo}>
                  <Text style={styles.healthItemTitle}>{illness.name}</Text>
                  <Text style={styles.healthItemDate}>
                    Diagnóstico: {illness.diagnosisDate}
                  </Text>
                  {illness.treatment && (
                    <Text style={styles.healthItemTreatment}>
                      Tratamiento: {illness.treatment}
                    </Text>
                  )}
                  {illness.veterinarian && (
                    <Text style={styles.healthItemVet}>
                      Veterinario: {illness.veterinarian}
                    </Text>
                  )}
                  {illness.status && (
                    <View style={styles.statusContainer}>
                      <Text style={[
                        styles.statusText,
                        illness.status === 'active' && styles.activeStatus,
                        illness.status === 'recovered' && styles.recoveredStatus
                      ]}>
                        Estado: {illness.status === 'active' ? 'Activa' :
                                illness.status === 'recovered' ? 'Recuperada' : illness.status}
                      </Text>
                    </View>
                  )}
                  {illness.notes && (
                    <Text style={styles.healthItemNotes}>
                      {illness.notes}
                    </Text>
                  )}
                </View>
                {canEdit && (
                  <View style={styles.healthCardActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditIllness(illness.id)}
                    >
                      <Edit size={18} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteIllness(illness.id, illness.name)}
                    >
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Card>
          ))
        )}
      </View>

      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleContainer}>
            <AlertTriangle size={20} color="#F59E0B" />
            <Text style={styles.healthTitle}>Alergias</Text>
          </View>
          {canEdit && (
            <TouchableOpacity style={styles.addButton} onPress={handleAddAllergy}>
              <Plus size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        
        {allergies.length === 0 ? (
          <Text style={styles.emptyText}>No hay alergias registradas</Text>
        ) : (
          allergies.map((allergy) => (
            <Card key={allergy.id} style={styles.healthCard}>
              <View style={styles.healthCardContent}>
                <View style={styles.healthCardInfo}>
                  <Text style={styles.healthItemTitle}>{allergy.name}</Text>
                  {allergy.symptoms && (
                    <Text style={styles.healthItemSymptoms}>
                      Síntomas: {allergy.symptoms}
                    </Text>
                  )}
                  {allergy.severity && (
                    <Text style={styles.healthItemSeverity}>
                      Severidad: {allergy.severity}
                    </Text>
                  )}
                  {allergy.treatment && (
                    <Text style={styles.healthItemTreatment}>
                      Tratamiento: {allergy.treatment}
                    </Text>
                  )}
                  {allergy.notes && (
                    <Text style={styles.healthItemNotes}>
                      {allergy.notes}
                    </Text>
                  )}
                </View>
                {canEdit && (
                  <View style={styles.healthCardActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditAllergy(allergy.id)}
                    >
                      <Edit size={18} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteAllergy(allergy.id, allergy.name)}
                    >
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Card>
          ))
        )}
      </View>
      
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleContainer}>
            <Pill size={20} color="#10B981" />
            <Text style={styles.healthTitle}>Desparasitaciones</Text>
          </View>
          {canEdit && (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => handleScanMedicalCard('deworming')}
              >
                <Camera size={16} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={handleAddDeworming}>
                <Plus size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {dewormings.length === 0 ? (
          <Text style={styles.emptyText}>No hay desparasitaciones registradas</Text>
        ) : (
          dewormings.map((deworming) => (
            <Card key={deworming.id} style={styles.healthCard}>
              <View style={styles.healthCardContent}>
                <View style={styles.healthCardInfo}>
                  <Text style={styles.healthItemTitle}>{deworming.productName}</Text>
                  <Text style={styles.healthItemDate}>
                    Aplicada: {deworming.applicationDate}
                  </Text>
                  {deworming.nextDueDate && (
                    <Text style={styles.healthItemNextDate}>
                      Próxima: {deworming.nextDueDate}
                    </Text>
                  )}
                  {deworming.veterinarian && (
                    <Text style={styles.healthItemVet}>
                      Veterinario: {deworming.veterinarian}
                    </Text>
                  )}
                  {deworming.notes && (
                    <Text style={styles.healthItemNotes}>
                      {deworming.notes}
                    </Text>
                  )}
                </View>
                {canEdit && (
                  <View style={styles.healthCardActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditDeworming(deworming.id)}
                    >
                      <Edit size={18} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteDeworming(deworming.id, deworming.productName)}
                    >
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Card>
          ))
        )}
      </View>
      
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleContainer}>
            <Scale size={20} color="#3B82F6" />
            <Text style={styles.healthTitle}>Seguimiento de Peso</Text>
          </View>
          {canEdit && (
            <TouchableOpacity style={styles.addButton} onPress={handleAddWeight}>
              <Plus size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {weightRecords.length === 0 ? (
          <Text style={styles.emptyText}>No hay registros de peso</Text>
        ) : (
          weightRecords.slice(0, 3).map((record) => (
            <Card key={record.id} style={styles.healthCard}>
              <Text style={styles.healthItemTitle}>
                {record.weight} {record.weight_unit}
              </Text>
              <Text style={styles.healthItemDate}>
                Fecha: {record.date}
              </Text>
              {record.notes && (
                <Text style={styles.healthItemNotes}>
                  {record.notes}
                </Text>
              )}
            </Card>
          ))
        )}
        
        {weightRecords.length > 3 && (
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => router.push(`/pets/health/weight/${id}`)}
          >
            <Text style={styles.viewAllText}>
              Ver todos los registros ({weightRecords.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const isVideoUrl = (url: string): boolean => {
    return url.startsWith('VIDEO:');
  };

  const getCleanUrl = (url: string): string => {
    return url.replace('VIDEO:', '');
  };

  const countMediaTypes = (images: string[]) => {
    const videos = images.filter(url => isVideoUrl(url)).length;
    const photos = images.length - videos;
    return { photos, videos };
  };

  const renderAlbumsTab = () => (
    <View style={styles.albumsContainer}>
      {canEdit && (
        <TouchableOpacity style={styles.addAlbumButton} onPress={handleAddPhoto}>
          <Camera size={24} color="#3B82F6" />
          <Text style={styles.addAlbumText}>Agregar Fotos</Text>
        </TouchableOpacity>
      )}

      {albums.length === 0 ? (
        <Text style={styles.emptyAlbumsText}>No hay álbumes creados</Text>
      ) : (
        <View style={styles.albumsGrid}>
          {albums.map((album) => {
            const firstMedia = album.images && album.images.length > 0 ? album.images[0] : null;
            const isVideo = firstMedia && isVideoUrl(firstMedia);
            const cleanUrl = firstMedia ? getCleanUrl(firstMedia) : null;
            const { photos, videos } = countMediaTypes(album.images || []);

            return (
              <TouchableOpacity
                key={album.id}
                style={styles.albumItem}
                onPress={() => router.push(`/pets/albums/${album.id}`)}
              >
                {cleanUrl ? (
                  <View style={styles.albumCoverContainer}>
                    {isVideo ? (
                      <>
                        <Video
                          source={{ uri: cleanUrl }}
                          style={styles.albumCover}
                          resizeMode="cover"
                          shouldPlay={false}
                          isMuted
                        />
                        <View style={styles.videoIndicator}>
                          <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                        </View>
                      </>
                    ) : (
                      <Image source={{ uri: cleanUrl }} style={styles.albumCover} />
                    )}
                  </View>
                ) : (
                  <View style={styles.albumPlaceholder}>
                    <Camera size={24} color="#9CA3AF" />
                  </View>
                )}
                <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
                <Text style={styles.albumCount}>
                  {photos > 0 && `${photos} foto${photos > 1 ? 's' : ''}`}
                  {photos > 0 && videos > 0 && ' • '}
                  {videos > 0 && `${videos} video${videos > 1 ? 's' : ''}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const behaviorTraits = [
    { name: 'Energía' },
    { name: 'Sociabilidad' },
    { name: 'Entrenabilidad' },
    { name: 'Agresividad' },
    { name: 'Ansiedad' },
    { name: 'Protección' },
    { name: 'Independencia' },
  ];

  const renderBehaviorTab = () => (
    <ScrollView style={styles.behaviorContainer}>
      <Card style={styles.behaviorCard}>
        <Text style={styles.behaviorTitle}>Evaluación de Comportamiento</Text>
        <Text style={styles.behaviorDescription}>
          Evalúa el comportamiento de tu mascota para entender mejor sus necesidades y personalidad.
        </Text>
        <Button
          title="Realizar Nueva Evaluación"
          onPress={handleBehaviorAssessment}
          size="medium"
        />
      </Card>

      {behaviorHistory.length > 0 && (
        <Card style={styles.historyCard}>
          <Text style={styles.historyTitle}>
            Historial de Evaluaciones ({behaviorHistory.length})
          </Text>
          <Text style={styles.historySubtitle}>
            Selecciona un trait para ver su evolución:
          </Text>

          <View style={styles.traitSelector}>
            {behaviorTraits.map((trait) => (
              <TouchableOpacity
                key={trait.name}
                style={[
                  styles.traitSelectorButton,
                  selectedTrait === trait.name && styles.traitSelectorButtonActive,
                ]}
                onPress={() => setSelectedTrait(trait.name)}
              >
                <Text
                  style={[
                    styles.traitSelectorText,
                    selectedTrait === trait.name && styles.traitSelectorTextActive,
                  ]}
                >
                  {trait.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedTrait && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Evolución de {selectedTrait}</Text>

              <View style={styles.chart}>
                {behaviorHistory.slice(0, 10).reverse().map((assessment, index) => {
                  const trait = assessment.traits.find((t: any) => t.name === selectedTrait);
                  const score = trait?.score || 0;
                  const date = new Date(assessment.assessment_date);
                  const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;

                  return (
                    <View key={assessment.id} style={styles.chartBar}>
                      <View style={styles.chartBarContainer}>
                        <View
                          style={[
                            styles.chartBarFill,
                            { height: `${(score / 5) * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.chartLabel}>{dateStr}</Text>
                      <Text style={styles.chartScore}>{score}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.chartLegend}>
                <Text style={styles.chartLegendText}>Últimas 10 evaluaciones</Text>
              </View>
            </View>
          )}

          <View style={styles.historySummary}>
            <Text style={styles.historySummaryTitle}>Resumen del Historial</Text>
            {behaviorHistory.slice(0, 5).map((assessment, index) => {
              const date = new Date(assessment.assessment_date);
              const avgScore = assessment.traits.reduce((sum: number, t: any) => sum + t.score, 0) / assessment.traits.length;

              return (
                <View key={assessment.id} style={styles.historyItem}>
                  <View style={styles.historyItemHeader}>
                    <Text style={styles.historyItemDate}>
                      {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <Text style={styles.historyItemAvg}>
                      Promedio: {avgScore.toFixed(1)}/5
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      )}
    </ScrollView>
  );

  const renderAppointmentsTab = () => (
    <View style={styles.appointmentsContainer}>
      <Card style={styles.appointmentsCard}>
        <Text style={styles.appointmentsTitle}>Historial de Citas</Text>
        <Text style={styles.appointmentsDescription}>
          Consulta el historial de citas médicas y reserva nuevas citas para tu mascota.
        </Text>
        <Button
          title="Ver Citas"
          onPress={handleViewAppointments}
          size="medium"
        />
      </Card>
    </View>
  );

  const renderMedicalAlerts = () => {
    if (medicalAlerts.length === 0) return null;

    return (
      <Card style={styles.alertsSummaryCard}>
        <View style={styles.alertsSummaryHeader}>
          <View style={styles.alertsIconContainer}>
            <Heart size={24} color="#2D6A6F" />
          </View>
          <View style={styles.alertsSummaryText}>
            <Text style={styles.alertsSummaryTitle}>Alertas Médicas</Text>
            <Text style={styles.alertsSummarySubtitle}>
              {medicalAlerts.length} {medicalAlerts.length === 1 ? 'alerta pendiente' : 'alertas pendientes'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.viewAlertsButton}
            onPress={() => setShowAlertModal(true)}
          >
            <Text style={styles.viewAlertsButtonText}>Ver</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderBreedInfo = () => {
    if (!pet.breed_info && (!pet.breedInfo || Object.keys(pet.breedInfo).length === 0)) return null;
    
    // Use breed_info from database if available, otherwise use breedInfo
    const breedInfoData = pet.breed_info || pet.breedInfo || {};
    
    // Ensure the image URL is complete
    let breedImageUrl = breedInfoData.image_link;
    if (breedImageUrl && breedImageUrl.startsWith('/storage/v1/object/public/')) {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      breedImageUrl = `${supabaseUrl}${breedImageUrl}`;
    }
    
    return (
      <Card style={styles.infoCard}>
        <Text style={styles.breedInfoTitle}>Información de la Raza</Text>
        
        {breedImageUrl && (
          <Image 
            source={{ uri: breedImageUrl }} 
            style={styles.breedImage} 
            onError={(e) => console.log('Error loading breed image:', breedImageUrl, e.nativeEvent.error)}
          />
        )}
        
        {breedInfoData.min_life_expectancy && breedInfoData.max_life_expectancy && (
          <Text style={styles.infoValue}>
            Esperanza de vida: {breedInfoData.min_life_expectancy}-{breedInfoData.max_life_expectancy} años
          </Text>
        )}
        
        {breedInfoData.energy !== undefined && (
          <Text style={styles.infoValue}>
            Nivel de energía: {breedInfoData.energy}/5
          </Text>
        )}
        
        {breedInfoData.trainability !== undefined && (
          <Text style={styles.infoValue}>
            Facilidad de entrenamiento: {breedInfoData.trainability}/5
            {breedInfoData.trainability <= 2 && (
              <Text style={styles.breedHighlight}> (Bajo - Puede ser difícil de entrenar)</Text>
            )}
          </Text>
        )}
        
        {breedInfoData.shedding !== undefined && (
          <Text style={styles.infoValue}>
            Nivel de muda: {breedInfoData.shedding}/5
            {breedInfoData.shedding >= 4 && (
              <Text style={styles.breedHighlight}> (Alto - Requerirá cepillado frecuente)</Text>
            )}
          </Text>
        )}
        
        {breedInfoData.barking !== undefined && (
          <Text style={styles.infoValue}>
            Nivel de ladrido: {breedInfoData.barking}/5
            {breedInfoData.barking >= 4 && (
              <Text style={styles.breedHighlight}> (Alto - Puede ser ruidoso)</Text>
            )}
          </Text>
        )}
        
        {breedInfoData.protectiveness !== undefined && (
          <Text style={styles.infoValue}>
            Nivel de protección: {breedInfoData.protectiveness}/5
          </Text>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackNavigation} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{pet.name}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.petProfile}>
        <TouchableOpacity onPress={handleUpdatePhoto}>
          <Image 
            source={{ uri: pet.photo_url || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100' }} 
            style={styles.petImage} 
            onError={(e) => console.log('Error loading pet image:', pet.photo_url, e.nativeEvent.error)}
          />
          <View style={styles.editPhotoOverlay}>
            <Camera size={16} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
        <View style={styles.petInfo}>
          <Text style={styles.petName}>{pet.name}</Text>
          <Text style={styles.petBreed}>{pet.breed}</Text>
          
          <View style={styles.petStats}>
            <View style={styles.petStat}>
              <Calendar size={16} color="#6B7280" />
              <Text style={styles.petStatText}>
                {pet.ageDisplay ? `${pet.ageDisplay.value} ${pet.ageDisplay.unit === 'years' ? 'años' : pet.ageDisplay.unit === 'months' ? 'meses' : 'días'}` : `${pet.age} años`}
              </Text>
            </View>
            
            <View style={styles.petStat}>
              <Scale size={16} color="#6B7280" />
              <Text style={styles.petStatText}>
                {pet.weightDisplay ? `${pet.weightDisplay.value} ${pet.weightDisplay.unit}` : `${pet.weight} kg`}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.appointmentsButton}
            onPress={handleBookAppointment}
          >
            <Calendar size={16} color="#3B82F6" />
            <Text style={styles.appointmentsButtonText}>Citas</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'basics' && styles.activeTab]} 
          onPress={() => setActiveTab('basics')}
        >
          <Text style={[styles.tabText, activeTab === 'basics' && styles.activeTabText]}>
            Básicos
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'health' && styles.activeTab]} 
          onPress={() => setActiveTab('health')}
        >
          <Text style={[styles.tabText, activeTab === 'health' && styles.activeTabText]}>
            Salud
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'albums' && styles.activeTab]}
          onPress={() => setActiveTab('albums')}
        >
          <Text style={[styles.tabText, activeTab === 'albums' && styles.activeTabText]}>
            Álbumes
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'behavior' && styles.activeTab]} 
          onPress={() => setActiveTab('behavior')}
        >
          <Text style={[styles.tabText, activeTab === 'behavior' && styles.activeTabText]}>
            Conducta
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'appointments' && styles.activeTab]} 
          onPress={() => setActiveTab('appointments')}
        >
          <Text style={[styles.tabText, activeTab === 'appointments' && styles.activeTabText]}>
            Citas
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Medical Alerts - Show in all tabs */}
        {renderMedicalAlerts()}
        
        {activeTab === 'basics' && (
          <>
            {renderBasicsTab()}
            
            {/* Medical History Actions */}
            <Card style={styles.medicalHistoryCard}>
              <Text style={styles.medicalHistoryTitle}>📋 Historia Clínica</Text>
              <Text style={styles.medicalHistoryDescription}>
                Genera un PDF completo con toda la información médica de {pet.name} o crea un QR para compartir con veterinarios.
              </Text>
              <Button
                title="Generar Historia Clínica"
                onPress={handleGenerateMedicalHistory}
                size="large"
              />
            </Card>
            
            {renderBreedInfo()}
          </>
        )}
        
        {activeTab === 'health' && renderHealthTab()}
        {activeTab === 'albums' && renderAlbumsTab()}
        {activeTab === 'behavior' && renderBehaviorTab()}
        {activeTab === 'appointments' && renderAppointmentsTab()}
      </ScrollView>

      {/* Medical Alerts Modal */}
      {medicalAlerts.length > 0 && showAlertModal && (
        <Modal
          visible={showAlertModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAlertModal(false)}
        >
          <View style={styles.alertModalOverlay}>
            <View style={styles.alertModalContent}>
              <View style={[
                styles.alertModalHeader,
                { borderLeftColor: getAlertPriorityColor(medicalAlerts[currentAlertIndex]?.priority || 'medium') }
              ]}>
                <View style={styles.alertModalIconContainer}>
                  {getAlertIcon(medicalAlerts[currentAlertIndex]?.alert_type || 'vaccine')}
                </View>
                <Text style={styles.alertModalTitle}>
                  {medicalAlerts[currentAlertIndex]?.title}
                </Text>
              </View>

              <Text style={styles.alertModalDescription}>
                {medicalAlerts[currentAlertIndex]?.description}
              </Text>

              <View style={styles.alertModalFooter}>
                <View style={styles.alertModalDateContainer}>
                  <Calendar size={16} color="#6B7280" />
                  <Text style={styles.alertModalDate}>
                    {formatAlertDate(medicalAlerts[currentAlertIndex]?.due_date || '')}
                  </Text>
                </View>

                <View style={[
                  styles.alertModalPriorityBadge,
                  { backgroundColor: getAlertPriorityColor(medicalAlerts[currentAlertIndex]?.priority || 'medium') + '20' }
                ]}>
                  <Text style={[
                    styles.alertModalPriorityText,
                    { color: getAlertPriorityColor(medicalAlerts[currentAlertIndex]?.priority || 'medium') }
                  ]}>
                    {medicalAlerts[currentAlertIndex]?.priority === 'urgent' ? 'URGENTE' :
                     medicalAlerts[currentAlertIndex]?.priority === 'high' ? 'ALTA' :
                     medicalAlerts[currentAlertIndex]?.priority === 'medium' ? 'MEDIA' : 'BAJA'}
                  </Text>
                </View>
              </View>

              <View style={styles.alertModalActions}>
                <TouchableOpacity
                  style={styles.alertModalDismissButton}
                  onPress={() => handleDismissAlert(medicalAlerts[currentAlertIndex]?.id)}
                >
                  <X size={20} color="#6B7280" />
                  <Text style={styles.alertModalDismissText}>Descartar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.alertModalCompleteButton}
                  onPress={() => handleCompleteAlert(medicalAlerts[currentAlertIndex]?.id)}
                >
                  <Heart size={20} color="#FFFFFF" />
                  <Text style={styles.alertModalCompleteText}>Completado</Text>
                </TouchableOpacity>
              </View>

              {medicalAlerts.length > 1 && (
                <Text style={styles.alertModalCounter}>
                  Alerta {currentAlertIndex + 1} de {medicalAlerts.length}
                </Text>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Scan Options Modal */}
      <Modal
        visible={showScanOptionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScanOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Escanear {scanRecordType === 'vaccine' ? 'Carnet de Vacunación' : 'Registro de Desparasitación'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Toma una foto o selecciona una imagen para extraer automáticamente todas las {scanRecordType === 'vaccine' ? 'vacunas' : 'desparasitaciones'} visibles
            </Text>

            {processingImage ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.processingText}>Analizando la imagen...</Text>
                <Text style={styles.processingSubtext}>
                  Esto puede tomar unos segundos
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.scanOptionsContainer}>
                  <TouchableOpacity
                    style={styles.scanOptionButton}
                    onPress={handleTakePhoto}
                  >
                    <Camera size={32} color={scanRecordType === 'vaccine' ? '#3B82F6' : '#10B981'} />
                    <Text style={styles.scanOptionText}>Tomar Foto</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.scanOptionButton}
                    onPress={handlePickImage}
                  >
                    <ImageIcon size={32} color={scanRecordType === 'vaccine' ? '#3B82F6' : '#10B981'} />
                    <Text style={styles.scanOptionText}>Desde Galería</Text>
                  </TouchableOpacity>
                </View>

                <Button
                  title="Cancelar"
                  onPress={() => {
                    setShowScanOptionsModal(false);
                    setScanRecordType(null);
                  }}
                  variant="outline"
                  size="large"
                />
              </>
            )}
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
    paddingTop: 50, // Increased padding at the top for better spacing across devices
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    width: 32,
  },
  petProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  petImage: {
    width: 80,
    height: 80,
    borderRadius: 40, 
    marginRight: 16,
  },
  editPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  petBreed: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
  },
  petStats: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  petStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  petStatText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  appointmentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  appointmentsButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoCard: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    textAlign: 'right',
  },
  breedInfoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827', 
    marginBottom: 12,
  },
  breedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  breedHighlight: {
    fontFamily: 'Inter-Medium',
    color: '#EF4444',
    fontSize: 13,
  },
  healthContainer: {
    gap: 16,
    paddingTop: 10,
  },
  healthSection: {
    marginBottom: 16,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  healthTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  scanButton: {
    backgroundColor: '#F3F4F6',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#3B82F6',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthCard: {
    marginBottom: 8,
    padding: 12,
  },
  healthCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  healthCardInfo: {
    flex: 1,
    marginRight: 8,
  },
  healthCardActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  healthItemTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  healthItemDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  healthItemNextDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#3B82F6',
  },
  healthItemTreatment: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  healthItemSymptoms: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  healthItemSeverity: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  healthItemNotes: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  healthItemVet: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#3B82F6',
  },
  statusContainer: {
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeStatus: {
    color: '#EF4444',
  },
  recoveredStatus: {
    color: '#10B981',
  },
  debugCard: {
    marginBottom: 8,
    backgroundColor: '#FEF3C7',
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  albumsContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 16,
  },
  addAlbumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    alignSelf: 'center',
  },
  addAlbumText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 8,
  },
  emptyAlbumsText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  albumsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  albumItem: {
    width: '48%',
    marginBottom: 16,
  },
  albumCoverContainer: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
    position: 'relative',
  },
  albumCover: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  albumPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  videoIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginBottom: 2,
  },
  albumCount: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  behaviorContainer: {
    paddingVertical: 20,
    paddingTop: 10,
  },
  behaviorCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  behaviorTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  behaviorDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  historyCard: {
    marginTop: 16,
    padding: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  historySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  traitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  traitSelectorButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  traitSelectorButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  traitSelectorText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  traitSelectorTextActive: {
    color: '#FFFFFF',
  },
  chartContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  chartTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  chartBarContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: '#10B981',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 20,
  },
  chartLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  chartScore: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 2,
  },
  chartLegend: {
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  chartLegendText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  historySummary: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  historySummaryTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  historyItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemDate: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  historyItemAvg: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  appointmentsContainer: {
    paddingVertical: 20,
    paddingTop: 10,
  },
  appointmentsCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appointmentsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  appointmentsDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  alertsCard: {
    marginBottom: 16,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  alertsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#92400E',
    marginBottom: 12,
  },
  alertItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  highPriorityAlert: {
    borderLeftColor: '#EF4444',
  },
  urgentAlert: {
    borderLeftColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 6,
    flex: 1,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  completeButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  dismissButton: {
    backgroundColor: '#6B7280',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  alertDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 8,
    lineHeight: 18,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertDueDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  priorityBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  highPriorityBadge: {
    backgroundColor: '#EF4444',
  },
  urgentPriorityBadge: {
    backgroundColor: '#DC2626',
  },
  priorityText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  alertsSummaryCard: {
    marginBottom: 16,
    backgroundColor: '#F0FDFA',
    borderWidth: 2,
    borderColor: '#2D6A6F',
  },
  alertsSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertsSummaryText: {
    flex: 1,
  },
  alertsSummaryTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F766E',
    marginBottom: 2,
  },
  alertsSummarySubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#14B8A6',
  },
  viewAlertsButton: {
    backgroundColor: '#2D6A6F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewAlertsButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  alertModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  alertModalHeader: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    marginBottom: 16,
  },
  alertModalIconContainer: {
    marginBottom: 8,
  },
  alertModalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    lineHeight: 28,
  },
  alertModalDescription: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 20,
  },
  alertModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  alertModalDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertModalDate: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  alertModalPriorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  alertModalPriorityText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
  },
  alertModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  alertModalDismissButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  alertModalDismissText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  alertModalCompleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A6F',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  alertModalCompleteText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  alertModalCounter: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
  },
  urgentPriorityBadge: {
    backgroundColor: '#DC2626',
  },
  priorityText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  medicalHistoryCard: {
    marginBottom: 16,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  medicalHistoryTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#0369A1',
    marginBottom: 8,
  },
  medicalHistoryDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#0369A1',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
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
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  processingText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginTop: 16,
  },
  processingSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 8,
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