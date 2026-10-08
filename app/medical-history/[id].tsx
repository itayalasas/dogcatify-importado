import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Calendar, Search, X, ChevronDown } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState, IconButton, SkeletonList } from '../../components/ui';
import { toast } from '../../components/ui/Toast';
import { HealthHeader, HealthSectionCard, HealthRecordItem } from '../../components/health';
import { supabaseClient } from '../../lib/supabase';
import { verifyMedicalHistoryToken } from '../../utils/medicalHistoryTokens';
import { envConfig } from '../../utils/envConfig';
import { colors, spacing, radius, fontSize } from '../../constants/theme';

interface MedicalRecord {
  id: string;
  type: string;
  name?: string;
  product_name?: string;
  application_date?: string;
  diagnosis_date?: string;
  next_due_date?: string;
  symptoms?: string;
  severity?: string;
  treatment?: string;
  veterinarian?: string;
  weight?: number;
  weight_unit?: string;
  date?: string;
  status?: string;
  notes?: string;
  created_at: string;
}

interface Pet {
  id: string;
  owner_id?: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  age_display?: { value: number; unit: string };
  gender: string;
  weight: number;
  weight_display?: { value: number; unit: string };
  color?: string;
  is_neutered?: boolean;
  has_chip?: boolean;
  chip_number?: string;
  medical_notes?: string;
  created_at: string;
  photo_url?: string;
}

interface Owner {
  id: string;
  display_name: string;
  email: string;
  phone?: string;
}

export default function MedicalHistoryShared() {
  const { id, token } = useLocalSearchParams<{ id: string; token?: string }>();
  
  // Data state
  const [pet, setPet] = useState<Pet | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isWebView, setIsWebView] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>('');
  
  // Derived state for different record types
  const vaccineRecords = medicalRecords.filter(record => record.type === 'vaccine');
  const illnessRecords = medicalRecords.filter(record => record.type === 'illness');
  const allergyRecords = medicalRecords.filter(record => record.type === 'allergy');
  const dewormingRecords = medicalRecords.filter(record => record.type === 'deworming');
  const weightRecords = medicalRecords.filter(record => record.type === 'weight');
  
  // Filter functions for modals
  const getFilteredVeterinarians = () => {
    if (!veterinarianSearchQuery.trim()) return veterinarians;
    return veterinarians.filter(vet =>
      vet.business_name.toLowerCase().includes(veterinarianSearchQuery.toLowerCase()) ||
      vet.address?.toLowerCase().includes(veterinarianSearchQuery.toLowerCase())
    );
  };

  // Form states for adding new records
  const [currentFormType, setCurrentFormType] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  // Modal states
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [showIllnessModal, setShowIllnessModal] = useState(false);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [showDewormingModal, setShowDewormingModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showDewormerModal, setShowDewormerModal] = useState(false);
  const [showVetModal, setShowVetModal] = useState(false);
  const [showTempVetModal, setShowTempVetModal] = useState(false);
  
  // Catalog data
  const [vaccines, setVaccines] = useState<any[]>([]);
  const [conditions, setConditions] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [dewormers, setDewormers] = useState<any[]>([]);
  const [veterinarians, setVeterinarians] = useState<any[]>([]);
  
  // Form inputs
  const [tempVetName, setTempVetName] = useState('');
  const [veterinarianSearchQuery, setVeterinarianSearchQuery] = useState('');
  const [selectedVaccine, setSelectedVaccine] = useState<any>(null);
  const [selectedCondition, setSelectedCondition] = useState<any>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<any>(null);
  const [selectedAllergy, setSelectedAllergy] = useState<any>(null);
  const [selectedDewormer, setSelectedDewormer] = useState<any>(null);
  const [selectedVeterinarian, setSelectedVeterinarian] = useState<any>(null);
  
  // Fetch functions for catalogs
  const fetchVaccines = async () => {
    try {
      const species = pet?.species || 'dog';
      console.log('Fetching vaccines for species:', species, '(pet data available:', !!pet, ')');
      console.log('Fetching vaccines for species:', species, '(pet data available:', !!pet, ')');
      
      const { data, error } = await supabaseClient
        .from('vaccines_catalog')
        .select('*')
        .eq('is_active', true)
        .in('species', [species, 'both'])
        .order('is_required', { ascending: false })
        .order('name', { ascending: true });

      console.log('Vaccines query result:', { 
        count: data?.length || 0, 
        error: error?.message,
        firstVaccine: data?.[0]?.name,
        querySpecies: [species, 'both']
      });
      
      if (error) {
        console.error('Error fetching vaccines:', error);
        setVaccines([]);
        return;
      }
      
      setVaccines(data || []);
    } catch (error) {
      console.error('Error in fetchVaccines:', error);
      setVaccines([]);
    }
  };

  const fetchConditions = async () => {
    try {
      console.log('Fetching conditions for species:', pet?.species);
      
      const { data, error } = await supabaseClient
        .from('medical_conditions')
        .select('*')
        .eq('is_active', true)
        .in('species', [pet?.species || 'dog', 'both'])
        .order('name', { ascending: true });

      console.log('Conditions query result:', { 
        count: data?.length || 0, 
        error: error?.message,
        firstCondition: data?.[0]?.name 
      });
      
      if (error) {
        console.error('Error fetching conditions:', error);
        setConditions([]);
        return;
      }
      
      setConditions(data || []);
    } catch (error) {
      console.error('Error in fetchConditions:', error);
      setConditions([]);
    }
  };

  const fetchTreatments = async () => {
    try {
      console.log('Fetching treatments for all conditions');
      
      const { data, error } = await supabaseClient
        .from('medical_treatments')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      console.log('Treatments query result:', { 
        count: data?.length || 0, 
        error: error?.message,
        firstTreatment: data?.[0]?.name 
      });
      
      if (error) {
        console.error('Error fetching treatments:', error);
        setTreatments([]);
        return;
      }
      
      setTreatments(data || []);
    } catch (error) {
      console.error('Error in fetchTreatments:', error);
      setTreatments([]);
    }
  };

  const fetchAllergies = async () => {
    try {
      console.log('Fetching allergies for species:', pet?.species);
      
      const { data, error } = await supabaseClient
        .from('allergies_catalog')
        .select('*')
        .eq('is_active', true)
        .in('species', [pet?.species || 'dog', 'both'])
        .order('is_common', { ascending: false })
        .order('name', { ascending: true });

      console.log('Allergies query result:', { 
        count: data?.length || 0, 
        error: error?.message,
        firstAllergy: data?.[0]?.name 
      });
      
      if (error) {
        console.error('Error fetching allergies:', error);
        setAllergies([]);
        return;
      }
      
      setAllergies(data || []);
    } catch (error) {
      console.error('Error in fetchAllergies:', error);
      setAllergies([]);
    }
  };

  const fetchDewormers = async () => {
    try {
      console.log('Fetching dewormers for species:', pet?.species);
      
      const { data, error } = await supabaseClient
        .from('dewormers_catalog')
        .select('*')
        .eq('is_active', true)
        .in('species', [pet?.species || 'dog', 'both'])
        .order('name', { ascending: true });

      console.log('Dewormers query result:', { 
        count: data?.length || 0, 
        error: error?.message,
        firstDewormer: data?.[0]?.name 
      });
      
      if (error) {
        console.error('Error fetching dewormers:', error);
        setDewormers([]);
        return;
      }
      
      setDewormers(data || []);
    } catch (error) {
      console.error('Error in fetchDewormers:', error);
      setDewormers([]);
    }
  };

  const fetchVeterinarians = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('business_type', 'veterinary')
        .eq('is_verified', true)
        .eq('is_active', true)
        .order('business_name', { ascending: true });

      if (error) throw error;
      setVeterinarians(data || []);
    } catch (error) {
      console.error('Error fetching veterinarians:', error);
    }
  };

  // Selection modals
  const [showVaccineSelection, setShowVaccineSelection] = useState(false);
  const [showConditionSelection, setShowConditionSelection] = useState(false);
  const [showTreatmentSelection, setShowTreatmentSelection] = useState(false);
  const [showAllergySelection, setShowAllergySelection] = useState(false);
  const [showDewormerSelection, setShowDewormerSelection] = useState(false);
  const [showVeterinarianSelection, setShowVeterinarianSelection] = useState(false);
  
  // Search states
  const [vaccineSearch, setVaccineSearch] = useState('');
  const [conditionSearch, setConditionSearch] = useState('');
  const [treatmentSearch, setTreatmentSearch] = useState('');
  const [allergySearch, setAllergySearch] = useState('');
  const [dewormerSearch, setDewormerSearch] = useState('');
  const [veterinarianSearch, setVeterinarianSearch] = useState('');
  
  // Form states for vaccine
  const [vaccineForm, setVaccineForm] = useState({
    name: '',
    applicationDate: new Date(),
    nextDueDate: null as Date | null,
    veterinarian: '',
    notes: ''
  });
  
  // Form states for illness
  const [illnessForm, setIllnessForm] = useState({
    name: '',
    diagnosisDate: new Date(),
    symptoms: '',
    severity: '',
    treatment: '',
    veterinarian: '',
    status: 'active',
    notes: ''
  });
  
  // Form states for allergy
  const [allergyForm, setAllergyForm] = useState({
    name: '',
    symptoms: '',
    severity: '',
    treatment: '',
    notes: ''
  });
  
  // Form states for deworming
  const [dewormingForm, setDewormingForm] = useState({
    productName: '',
    applicationDate: new Date(),
    nextDueDate: null as Date | null,
    veterinarian: '',
    notes: ''
  });
  
  // Form states for weight
  const [weightForm, setWeightForm] = useState({
    weight: '',
    weightUnit: 'kg',
    date: new Date(),
    notes: ''
  });
  
  const [saving, setSaving] = useState(false);
  
  // Loading states for catalogs
  const [loadingVaccines, setLoadingVaccines] = useState(false);
  const [loadingConditions, setLoadingConditions] = useState(false);
  const [loadingTreatments, setLoadingTreatments] = useState(false);
  const [loadingAllergies, setLoadingAllergies] = useState(false);
  const [loadingDewormers, setLoadingDewormers] = useState(false);
  const [loadingVeterinarians, setLoadingVeterinarians] = useState(false);

  const createSupabaseHeaders = (apiKey: string): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    apikey: apiKey,
  });

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return String(error);
  };

  // Check if this is being accessed from web without authentication
  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsWebView(true);
      loadMedicalHistoryForWeb();
    } else if (id) {
      verifyTokenAndFetchData();
    }
  }, [id, token]);

  const loadMedicalHistoryForWeb = async () => {
    try {
      console.log('Loading medical history for web view...');
      
      // Call the Edge Function directly for web access
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      const supabaseAnonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? '';
      const apiUrl = `${supabaseUrl}/functions/v1/medical-history/${id}${token ? `?token=${token}` : ''}`;
      
      console.log('Fetching from Edge Function:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: createSupabaseHeaders(supabaseAnonKey),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge Function error:', response.status, errorText);
        
        if (response.status === 400) {
          setError('Enlace inválido o token no válido');
        } else if (response.status === 410) {
          setError('Este enlace ha expirado por seguridad');
        } else if (response.status === 404) {
          setError('Mascota no encontrada');
        } else {
          setError('Error al cargar la historia clínica');
        }
        setLoading(false);
        return;
      }
      
      const htmlContent = await response.text();
      setHtmlContent(htmlContent);
      setLoading(false);
    } catch (error) {
      console.error('Error loading medical history for web:', error);
      setError('Error de conexión al cargar la historia clínica');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && !isWebView) {
      verifyTokenAndFetchData();
    }
  }, [id, token, isWebView]);

  // Fetch nomenclators after pet data is available
  useEffect(() => {
    if (pet && pet.species) {
      console.log('Pet data available, fetching nomenclators for species:', pet.species);
      fetchVaccines();
      fetchConditions();
      fetchTreatments();
      fetchDewormers();
      fetchAllergies();
    }
  }, [pet]);
  // Fetch catalog data when modals open
  useEffect(() => {
    if (showVaccineModal && pet) {
      fetchVaccines();
    }
  }, [showVaccineModal, pet]);

  useEffect(() => {
    if (showConditionModal && pet) {
      fetchConditions();
    }
  }, [showConditionModal, pet]);

  useEffect(() => {
    if (showTreatmentModal) {
      fetchTreatments();
    }
  }, [showTreatmentModal]);

  useEffect(() => {
    if (showAllergyModal && pet) {
      fetchAllergies();
    }
  }, [showAllergyModal, pet]);

  useEffect(() => {
    if (showDewormerModal && pet) {
      fetchDewormers();
    }
  }, [showDewormerModal, pet]);
  // Fetch nomenclators when pet data is available
  useEffect(() => {
    if (pet && pet.species) {
      console.log('Pet data available, fetching nomenclators for species:', pet.species);
    }
  }, [pet]);

  useEffect(() => {
    if (showVetModal) {
      fetchVeterinarians();
    }
  }, [showVetModal]);
  const verifyTokenAndFetchData = async () => {
    try {
      console.log('=== VERIFYING TOKEN AND FETCHING DATA ===');
      console.log('Pet ID:', id);
      console.log('Token provided:', !!token);
      
      if (token) {
        console.log('Token valid, fetching medical history...');
        
        // Try to fetch data via Edge Function first
        try {
          console.log('=== CALLING EDGE FUNCTION FOR ALL DATA ===');
          const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
          const supabaseKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? '';
          
          const edgeFunctionUrl = `${supabaseUrl}/functions/v1/medical-history-data/${id}?token=${token}`;
          console.log('Edge Function URL:', edgeFunctionUrl);
          
          const response = await fetch(edgeFunctionUrl, {
            method: 'GET',
            headers: createSupabaseHeaders(supabaseKey),
          });
          
          console.log('Edge Function response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('Edge Function returned data:', {
              success: data.success,
              petName: data.pet?.name,
              ownerName: data.owner?.display_name,
              totalRecords: data.recordCounts?.total || 0,
              recordsByType: data.recordCounts
            });
            
            if (data.success) {
              setTokenExpired(false);
              setPet(data.pet);
              setOwner(data.owner);
              setMedicalRecords(data.medicalRecords || []);
              setHasValidToken(true);
              console.log('=== DATA SET SUCCESSFULLY ===');
              return;
            } else {
              if (data.isExpired) {
                console.log('Token expired, showing expiration message');
                setTokenExpired(true);
                setError('El enlace ha expirado por seguridad. Solicita un nuevo enlace al propietario de la mascota.');
              } else {
                setError(data.error || 'Error al cargar los datos');
              }
            }
          } else {
            // medical-history-data no está desplegada: antes la pantalla
            // quedaba vacía. Caemos a la carga directa.
            console.warn('medical-history-data respondió', response.status, '- usando carga directa');
            await fetchMedicalHistoryDirectly();
          }
        } catch (edgeError) {
          console.error('Edge Function error:', edgeError);
          // Fallback to direct database access
          await fetchMedicalHistoryDirectly();
        }
      } else {
        // No token provided, try direct access
        await fetchMedicalHistoryDirectly();
      }
        
        setDataLoaded(true);
        
        // Fetch veterinarians immediately since they don't depend on pet species
        await fetchVeterinarians();
    } catch (error) {
      console.error('Error in verifyTokenAndFetchData:', error);
      Alert.alert('Error', 'No se pudo cargar la historia clínica');
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicalData = async () => {
    await verifyTokenAndFetchData();
  };

  const fetchMedicalHistoryDirectly = async () => {
    try {
      console.log('=== FETCHING MEDICAL DATA FOR REACT COMPONENTS ===');
      console.log('Pet ID:', id);
      
      // Fetch pet data
      const { data: petData, error: petError } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (petError) {
        console.error('Error fetching pet data:', petError);
        throw petError;
      }
      
      console.log('Pet data loaded:', petData?.name);
      setPet(petData);
      
      // Fetch owner data
      const { data: ownerData, error: ownerError } = await supabaseClient
        .from('profiles')
        .select('id, display_name, email, phone')
        .eq('id', petData.owner_id)
        .single();
      
      if (ownerError) {
        console.error('Error fetching owner data:', ownerError);
        throw ownerError;
      }
      
      console.log('Owner data loaded:', ownerData?.display_name);
      setOwner(ownerData);
      
      // Fetch medical records
      console.log('Fetching medical records for pet:', id);
      console.log('Fetching medical records directly from database...');
      
      const { data: recordsData, error: recordsError } = await supabaseClient
        .from('pet_health')
        .select('*')
        .eq('pet_id', id)
        .order('created_at', { ascending: false });
      
      console.log('Direct database query result:', {
        recordsFound: recordsData?.length || 0,
        error: recordsError?.message,
        errorCode: recordsError?.code
      });
      
      if (recordsError) {
        console.error('Error fetching medical records:', recordsError);
        // Don't throw error, just log it
      }
      
      const records = recordsData || [];
      console.log('Medical records loaded:', records.length);
      setMedicalRecords(records);
      
      console.log('=== MEDICAL DATA LOADED SUCCESSFULLY ===');
    } catch (error) {
      console.error('Error fetching medical history directly:', error);
      throw error;
    }
  };

  const handleAddRecord = (type: string) => {
    setCurrentFormType(type);
    setFormData({});
    
    switch (type) {
      case 'vaccine':
        fetchVaccines();
        setShowVaccineModal(true);
        break;
      case 'illness':
        fetchConditions();
        setShowConditionModal(true);
        break;
      case 'allergy':
        fetchAllergies();
        setShowAllergyModal(true);
        break;
      case 'deworming':
        fetchDewormers();
        setShowDewormerModal(true);
        break;
      default:
        console.warn('Unknown record type:', type);
    }
  };

  const handleSaveRecord = async () => {
    if (!currentFormType || !formData.name) {
      Alert.alert('Error', 'Completá los campos obligatorios');
      return;
    }

    try {
      const recordData = {
        pet_id: id,
        user_id: owner?.id || '',
        type: currentFormType,
        ...formData,
        created_at: new Date().toISOString()
      };

      // Call Edge Function to save record
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      const supabaseKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? '';
      const response = await fetch(`${supabaseUrl}/functions/v1/save-medical-record`, {
        method: 'POST',
        headers: createSupabaseHeaders(supabaseKey),
        body: JSON.stringify({
          recordData,
          token: token
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error saving record');
      }

      toast.success('Registro médico guardado');
      
      // Close modal and refresh data
      closeAllModals();
      fetchMedicalData();
    } catch (error) {
      console.error('Error saving medical record:', error);
      Alert.alert('Error', 'No se pudo guardar el registro médico');
    }
  };

  const closeAllModals = () => {
    setShowVaccineModal(false);
    setShowConditionModal(false);
    setShowTreatmentModal(false);
    setShowAllergyModal(false);
    setShowDewormerModal(false);
    setShowVetModal(false);
    setShowTempVetModal(false);
    setCurrentFormType(null);
    setFormData({});
    setSelectedVaccine(null);
    setSelectedCondition(null);
    setSelectedTreatment(null);
    setSelectedAllergy(null);
    setSelectedDewormer(null);
    setSelectedVeterinarian(null);
  };

  const handleSelectVaccine = (vaccine: any) => {
    setSelectedVaccine(vaccine);
    setFormData((prev: Record<string, any>) => ({ ...prev, name: vaccine.name }));
    setShowVaccineModal(false);
  };

  const handleSelectCondition = (condition: any) => {
    setSelectedCondition(condition);
    setFormData((prev: Record<string, any>) => ({ ...prev, name: condition.name }));
    setShowConditionModal(false);
    
    // Load treatments for this condition
    fetchTreatments();
  };

  const handleSelectTreatment = (treatment: any) => {
    setSelectedTreatment(treatment);
    setFormData((prev: Record<string, any>) => ({ ...prev, treatment: treatment.name }));
    setShowTreatmentModal(false);
  };

  const handleSelectAllergy = (allergy: any) => {
    setSelectedAllergy(allergy);
    setFormData((prev: Record<string, any>) => ({ ...prev, name: allergy.name }));
    setShowAllergyModal(false);
  };

  const handleSelectDewormer = (dewormer: any) => {
    setSelectedDewormer(dewormer);
    setFormData((prev: Record<string, any>) => ({ ...prev, product_name: dewormer.name }));
    setShowDewormerModal(false);
  };

  const handleSelectVeterinarian = (vet: any) => {
    setSelectedVeterinarian(vet);
    setFormData((prev: Record<string, any>) => ({ ...prev, veterinarian: vet.business_name }));
    setShowVetModal(false);
  };

  // Load catalog data when modals open
  const loadVaccines = async () => {
    if (vaccines.length > 0) return;
    
    try {
      const species = pet?.species || 'dog';
      const { data, error } = await supabaseClient
        .from('vaccines_catalog')
        .select('*')
        .eq('is_active', true)
        .in('species', [species, 'both'])
        .order('is_required', { ascending: false })
        .order('name', { ascending: true });
      
      if (error) throw error;
      setVaccines(data || []);
    } catch (error) {
      console.error('Error loading vaccines:', error);
    }
  };

  const loadConditions = async () => {
    if (conditions.length > 0) return;
    
    try {
      const { data, error } = await supabaseClient
        .from('medical_conditions')
        .select('*')
        .eq('is_active', true)
        .in('species', [pet?.species || 'dog', 'both'])
        .order('name', { ascending: true });
      
      if (error) throw error;
      setConditions(data || []);
    } catch (error) {
      console.error('Error loading conditions:', error);
    }
  };

  const loadTreatments = async () => {
    if (treatments.length > 0) return;
    
    try {
      const { data, error } = await supabaseClient
        .from('medical_treatments')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      setTreatments(data || []);
    } catch (error) {
      console.error('Error loading treatments:', error);
    }
  };

  const loadAllergies = async () => {
    if (allergies.length > 0) return;
    
    try {
      const { data, error } = await supabaseClient
        .from('allergies_catalog')
        .select('*')
        .eq('is_active', true)
        .in('species', [pet?.species || 'dog', 'both'])
        .order('is_common', { ascending: false })
        .order('name', { ascending: true });
      
      if (error) throw error;
      setAllergies(data || []);
    } catch (error) {
      console.error('Error loading allergies:', error);
    }
  };

  const loadDewormers = async () => {
    if (dewormers.length > 0) return;
    
    try {
      const { data, error } = await supabaseClient
        .from('dewormers_catalog')
        .select('*')
        .eq('is_active', true)
        .in('species', [pet?.species || 'dog', 'both'])
        .order('name', { ascending: true });
      
      if (error) throw error;
      setDewormers(data || []);
    } catch (error) {
      console.error('Error loading dewormers:', error);
    }
  };

  const loadVeterinarians = async () => {
    if (veterinarians.length > 0) return;
    
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('business_type', 'veterinary')
        .eq('is_verified', true)
        .eq('is_active', true)
        .order('business_name', { ascending: true });
      
      if (error) throw error;
      setVeterinarians(data || []);
    } catch (error) {
      console.error('Error loading veterinarians:', error);
    }
  };

  // Save functions
  const saveVaccine = async () => {
    if (!vaccineForm.name || !vaccineForm.applicationDate) {
      Alert.alert('Error', 'Completá los campos obligatorios');
      return;
    }

    setSaving(true);
    try {
      const recordData = {
        pet_id: id!,
        user_id: pet?.owner_id || '',
        type: 'vaccine',
        name: vaccineForm.name,
        application_date: formatDate(vaccineForm.applicationDate),
        next_due_date: vaccineForm.nextDueDate ? formatDate(vaccineForm.nextDueDate) : null,
        veterinarian: vaccineForm.veterinarian || null,
        notes: vaccineForm.notes || null,
        created_at: new Date().toISOString()
      };

      await saveRecord(recordData);
      setShowVaccineModal(false);
      resetVaccineForm();
    } catch (error) {
      console.error('Error saving vaccine:', error);
      Alert.alert('Error', 'No se pudo guardar la vacuna');
    } finally {
      setSaving(false);
    }
  };

  const saveIllness = async () => {
    if (!illnessForm.name || !illnessForm.diagnosisDate) {
      Alert.alert('Error', 'Completá los campos obligatorios');
      return;
    }

    setSaving(true);
    try {
      const recordData = {
        pet_id: id!,
        user_id: pet?.owner_id || '',
        type: 'illness',
        name: illnessForm.name,
        diagnosis_date: formatDate(illnessForm.diagnosisDate),
        symptoms: illnessForm.symptoms || null,
        severity: illnessForm.severity || null,
        treatment: illnessForm.treatment || null,
        veterinarian: illnessForm.veterinarian || null,
        status: illnessForm.status,
        notes: illnessForm.notes || null,
        created_at: new Date().toISOString()
      };

      await saveRecord(recordData);
      setShowIllnessModal(false);
      resetIllnessForm();
    } catch (error) {
      console.error('Error saving illness:', error);
      Alert.alert('Error', 'No se pudo guardar la enfermedad');
    } finally {
      setSaving(false);
    }
  };

  const saveAllergy = async () => {
    if (!allergyForm.name || !allergyForm.symptoms) {
      Alert.alert('Error', 'Completá los campos obligatorios');
      return;
    }

    setSaving(true);
    try {
      const recordData = {
        pet_id: id!,
        user_id: pet?.owner_id || '',
        type: 'allergy',
        name: allergyForm.name,
        symptoms: allergyForm.symptoms,
        severity: allergyForm.severity || null,
        treatment: allergyForm.treatment || null,
        notes: allergyForm.notes || null,
        created_at: new Date().toISOString()
      };

      await saveRecord(recordData);
      setShowAllergyModal(false);
      resetAllergyForm();
    } catch (error) {
      console.error('Error saving allergy:', error);
      Alert.alert('Error', 'No se pudo guardar la alergia');
    } finally {
      setSaving(false);
    }
  };

  const saveDeworming = async () => {
    if (!dewormingForm.productName || !dewormingForm.applicationDate) {
      Alert.alert('Error', 'Completá los campos obligatorios');
      return;
    }

    setSaving(true);
    try {
      const recordData = {
        pet_id: id!,
        user_id: pet?.owner_id || '',
        type: 'deworming',
        product_name: dewormingForm.productName,
        application_date: formatDate(dewormingForm.applicationDate),
        next_due_date: dewormingForm.nextDueDate ? formatDate(dewormingForm.nextDueDate) : null,
        veterinarian: dewormingForm.veterinarian || null,
        notes: dewormingForm.notes || null,
        created_at: new Date().toISOString()
      };

      await saveRecord(recordData);
      setShowDewormingModal(false);
      resetDewormingForm();
    } catch (error) {
      console.error('Error saving deworming:', error);
      Alert.alert('Error', 'No se pudo guardar la desparasitación');
    } finally {
      setSaving(false);
    }
  };

  const saveWeight = async () => {
    if (!weightForm.weight || !weightForm.date) {
      Alert.alert('Error', 'Completá los campos obligatorios');
      return;
    }

    setSaving(true);
    try {
      const recordData = {
        pet_id: id!,
        user_id: pet?.owner_id || '',
        type: 'weight',
        weight: parseFloat(weightForm.weight),
        weight_unit: weightForm.weightUnit,
        date: formatDate(weightForm.date),
        notes: weightForm.notes || null,
        created_at: new Date().toISOString()
      };

      await saveRecord(recordData);
      setShowWeightModal(false);
      resetWeightForm();
    } catch (error) {
      console.error('Error saving weight:', error);
      Alert.alert('Error', 'No se pudo guardar el peso');
    } finally {
      setSaving(false);
    }
  };

  const saveRecord = async (recordData: any) => {
    try {
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      const supabaseKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? '';
      
      const response = await fetch(`${supabaseUrl}/functions/v1/save-medical-record`, {
        method: 'POST',
        headers: createSupabaseHeaders(supabaseKey),
        body: JSON.stringify({
          recordData,
          token
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Save failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save record');
      }

      // Refresh data
      await verifyTokenAndFetchData();
      toast.success('Registro guardado');
    } catch (error) {
      console.error('Error saving record:', error);
      throw error;
    }
  };

  // Reset form functions
  const resetVaccineForm = () => {
    setVaccineForm({
      name: '',
      applicationDate: new Date(),
      nextDueDate: null,
      veterinarian: '',
      notes: ''
    });
  };

  const resetIllnessForm = () => {
    setIllnessForm({
      name: '',
      diagnosisDate: new Date(),
      symptoms: '',
      severity: '',
      treatment: '',
      veterinarian: '',
      status: 'active',
      notes: ''
    });
  };

  const resetAllergyForm = () => {
    setAllergyForm({
      name: '',
      symptoms: '',
      severity: '',
      treatment: '',
      notes: ''
    });
  };

  const resetDewormingForm = () => {
    setDewormingForm({
      productName: '',
      applicationDate: new Date(),
      nextDueDate: null,
      veterinarian: '',
      notes: ''
    });
  };

  const resetWeightForm = () => {
    setWeightForm({
      weight: '',
      weightUnit: 'kg',
      date: new Date(),
      notes: ''
    });
  };

  // Selection handlers
  const handleVaccineSelect = (vaccine: any) => {
    setVaccineForm(prev => ({ ...prev, name: vaccine.name }));
    setShowVaccineSelection(false);
  };

  const handleConditionSelect = (condition: any) => {
    setIllnessForm(prev => ({ 
      ...prev, 
      name: condition.name,
      symptoms: condition.common_symptoms?.join(', ') || ''
    }));
    setShowConditionSelection(false);
  };

  const handleTreatmentSelect = (treatment: any) => {
    setIllnessForm(prev => ({ ...prev, treatment: treatment.name }));
    setShowTreatmentSelection(false);
  };

  const handleAllergySelect = (allergy: any) => {
    setAllergyForm(prev => ({ 
      ...prev, 
      name: allergy.name,
      symptoms: allergy.common_symptoms?.join(', ') || ''
    }));
    setShowAllergySelection(false);
  };

  const handleDewormerSelect = (dewormer: any) => {
    setDewormingForm(prev => ({ ...prev, productName: dewormer.name }));
    setShowDewormerSelection(false);
  };

  const handleVeterinarianSelect = (veterinarian: any) => {
    const vetName = veterinarian.business_name;
    
    if (currentFormType === 'vaccine') {
      setVaccineForm(prev => ({ ...prev, veterinarian: vetName }));
    } else if (currentFormType === 'illness') {
      setIllnessForm(prev => ({ ...prev, veterinarian: vetName }));
    } else if (currentFormType === 'deworming') {
      setDewormingForm(prev => ({ ...prev, veterinarian: vetName }));
    }
    
    setShowVeterinarianSelection(false);
  };

  const handleAddTempVet = () => {
    if (!tempVetName.trim()) {
      Alert.alert('Error', 'Ingresá el nombre del veterinario');
      return;
    }
    
    const vetName = tempVetName.trim();
    
    if (currentFormType === 'vaccine') {
      setVaccineForm(prev => ({ ...prev, veterinarian: vetName }));
    } else if (currentFormType === 'illness') {
      setIllnessForm(prev => ({ ...prev, veterinarian: vetName }));
    } else if (currentFormType === 'deworming') {
      setDewormingForm(prev => ({ ...prev, veterinarian: vetName }));
    }
    
    setTempVetName('');
    setShowTempVetModal(false);
    setShowVeterinarianSelection(false);
  };

  // Utility functions
  const formatAge = (pet: Pet): string => {
    if (pet.age_display) {
      const { value, unit } = pet.age_display;
      switch (unit) {
        case 'days': return `${value} ${value === 1 ? 'día' : 'días'}`;
        case 'months': return `${value} ${value === 1 ? 'mes' : 'meses'}`;
        case 'years': return `${value} ${value === 1 ? 'año' : 'años'}`;
        default: return `${value} ${unit}`;
      }
    }
    return `${pet.age} ${pet.age === 1 ? 'año' : 'años'}`;
  };

  const formatWeight = (pet: Pet): string => {
    if (pet.weight_display) {
      return `${pet.weight_display.value} ${pet.weight_display.unit}`;
    }
    return `${pet.weight} kg`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDisplayDate = (dateString: string): string => {
    if (!dateString) return 'No especificada';
    
    if (dateString.includes('/')) {
      return dateString;
    }
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Filter functions
  const getFilteredVaccines = () => {
    return vaccines.filter(vaccine =>
      vaccine.name.toLowerCase().includes(vaccineSearch.toLowerCase())
    );
  };

  const getFilteredConditions = () => {
    return conditions.filter(condition =>
      condition.name.toLowerCase().includes(conditionSearch.toLowerCase())
    );
  };

  const getFilteredTreatments = () => {
    return treatments.filter(treatment =>
      treatment.name.toLowerCase().includes(treatmentSearch.toLowerCase())
    );
  };

  const getFilteredAllergies = () => {
    return allergies.filter(allergy =>
      allergy.name.toLowerCase().includes(allergySearch.toLowerCase())
    );
  };

  const getFilteredDewormers = () => {
    return dewormers.filter(dewormer =>
      dewormer.name.toLowerCase().includes(dewormerSearch.toLowerCase())
    );
  };

  const renderTokenExpiredMessage = () => (
    <View style={styles.container}>
      <HealthHeader title="Historia clínica veterinaria" showBack={false} />
      
      <View style={styles.content}>
        <Card style={styles.expiredCard}>
          <View style={styles.expiredIconContainer}>
            <Text style={styles.expiredIcon}>🕒</Text>
          </View>
          
          <Text style={styles.expiredTitle}>Enlace expirado</Text>
          <Text style={styles.expiredMessage}>
            Este enlace de historia clínica ha expirado por motivos de seguridad.
          </Text>
          
          <View style={styles.expiredInstructions}>
            <Text style={styles.instructionsTitle}>Para acceder a la historia clínica:</Text>
            <Text style={styles.instructionItem}>
              1. Contactá al dueño de la mascota
            </Text>
            <Text style={styles.instructionItem}>
              2. Pedile que genere un enlace nuevo
            </Text>
            <Text style={styles.instructionItem}>
              3. Los enlaces expiran en 2 horas por seguridad
            </Text>
          </View>
          
          <View style={styles.securityNote}>
            <Text style={styles.securityNoteText}>
              🔒 Los enlaces temporales protegen la privacidad de los datos médicos
            </Text>
          </View>
        </Card>
      </View>
    </View>
  );

  // Web view rendering for veterinarians
  if (isWebView && Platform.OS === 'web') {
    if (loading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>🐾</div>
            <div style={{ fontSize: '18px', color: colors.primary }}>Cargando historia clínica...</div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'Arial, sans-serif',
          padding: '20px'
        }}>
          <div style={{ 
            textAlign: 'center',
            maxWidth: '500px',
            padding: '40px',
            backgroundColor: colors.dangerSoft,
            borderRadius: '12px',
            border: '1px solid #FECACA'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <div style={{ fontSize: '24px', color: colors.danger, marginBottom: '16px' }}>Error</div>
            <div style={{ fontSize: '16px', color: colors.danger, lineHeight: '1.5' }}>{error}</div>
          </div>
        </div>
      );
    }

    if (htmlContent) {
      return (
        <div style={{ height: '100vh', width: '100%', overflow: 'auto' }}>
          <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>
      );
    }

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🐾</div>
          <div style={{ fontSize: '18px', color: colors.textSecondary }}>Historia clínica no disponible</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <HealthHeader title="Historia clínica" />
        <SkeletonList kind="cards" count={4} />
      </SafeAreaView>
    );
  }

  if (tokenExpired) {
    return renderTokenExpiredMessage();
  }

  if (!pet || !owner) {
    return (
      <SafeAreaView style={styles.container}>
        <HealthHeader title="Historia clínica" />
        <EmptyState
          icon={<X size={32} color={colors.danger} />}
          title="No se pudo cargar la información"
          description={error || 'Revisá tu conexión y probá de nuevo.'}
          actionLabel="Reintentar"
          onAction={() => {
            setLoading(true);
            fetchMedicalData();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader title="Historia clínica" subtitle={pet.name} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pet Profile */}
        <Card style={styles.petCard}>
          <Text style={styles.petName}>🐾 {pet.name}</Text>
          <Text style={styles.petBreed}>{pet.breed}</Text>
          <Text style={styles.petDetails}>
            {pet.species === 'dog' ? 'Perro' : 'Gato'} • {pet.gender === 'male' ? 'Macho' : 'Hembra'} • {formatAge(pet)}
          </Text>
          <Text style={styles.petWeight}>Peso: {formatWeight(pet)}</Text>
          {pet.color && <Text style={styles.petColor}>Color: {pet.color}</Text>}
        </Card>

        {/* Owner Info */}
        <Card style={styles.ownerCard}>
          <Text style={styles.sectionTitle}>👤 Dueño</Text>
          <Text style={styles.ownerName}>{owner.display_name}</Text>
          <Text style={styles.ownerEmail}>{owner.email}</Text>
          {owner.phone && <Text style={styles.ownerPhone}>{owner.phone}</Text>}
        </Card>

        {/* Vaccines Section */}
        <HealthSectionCard
          emoji="💉"
          title="Vacunas"
          count={vaccineRecords.length}
          onAdd={() => handleAddRecord('vaccine')}
          addAccessibilityLabel="Agregar vacuna"
          isEmpty={vaccineRecords.length === 0}
          emptyText="No hay vacunas registradas"
        >
          {vaccineRecords.map((record, index) => (
            <HealthRecordItem
              key={record.id}
              title={record.name || 'Sin nombre'}
              dateLabel="Aplicada:"
              date={formatDisplayDate(record.application_date || '')}
              dueDate={record.next_due_date}
              details={[
                { label: 'Próxima', value: record.next_due_date ? formatDisplayDate(record.next_due_date) : null },
                { label: 'Veterinario', value: record.veterinarian },
              ]}
              notes={record.notes}
              isLast={index === vaccineRecords.length - 1}
            />
          ))}
        </HealthSectionCard>

        {/* Illnesses Section */}
        <HealthSectionCard
          emoji="🏥"
          title="Enfermedades"
          count={illnessRecords.length}
          onAdd={() => handleAddRecord('illness')}
          addAccessibilityLabel="Agregar enfermedad"
          isEmpty={illnessRecords.length === 0}
          emptyText="No hay enfermedades registradas"
        >
          {illnessRecords.map((record, index) => (
            <HealthRecordItem
              key={record.id}
              title={record.name || 'Sin nombre'}
              dateLabel="Diagnóstico:"
              date={formatDisplayDate(record.diagnosis_date || '')}
              details={[
                { label: 'Síntomas', value: record.symptoms },
                { label: 'Severidad', value: record.severity },
                { label: 'Tratamiento', value: record.treatment },
                { label: 'Veterinario', value: record.veterinarian },
              ]}
              notes={record.notes}
              isLast={index === illnessRecords.length - 1}
            />
          ))}
        </HealthSectionCard>

        {/* Allergies Section */}
        <HealthSectionCard
          emoji="🚨"
          title="Alergias"
          count={allergyRecords.length}
          onAdd={() => handleAddRecord('allergy')}
          addAccessibilityLabel="Agregar alergia"
          isEmpty={allergyRecords.length === 0}
          emptyText="No hay alergias registradas"
        >
          {allergyRecords.map((record, index) => (
            <HealthRecordItem
              key={record.id}
              title={record.name || 'Sin nombre'}
              details={[
                { label: 'Síntomas', value: record.symptoms },
                { label: 'Severidad', value: record.severity },
                { label: 'Tratamiento', value: record.treatment },
              ]}
              notes={record.notes}
              isLast={index === allergyRecords.length - 1}
            />
          ))}
        </HealthSectionCard>

        {/* Deworming Section */}
        <HealthSectionCard
          emoji="💊"
          title="Desparasitación"
          count={dewormingRecords.length}
          onAdd={() => handleAddRecord('deworming')}
          addAccessibilityLabel="Agregar desparasitación"
          isEmpty={dewormingRecords.length === 0}
          emptyText="No hay desparasitaciones registradas"
        >
          {dewormingRecords.map((record, index) => (
            <HealthRecordItem
              key={record.id}
              title={record.product_name || record.name || 'Sin nombre'}
              dateLabel="Aplicada:"
              date={formatDisplayDate(record.application_date || '')}
              dueDate={record.next_due_date}
              details={[
                { label: 'Próxima', value: record.next_due_date ? formatDisplayDate(record.next_due_date) : null },
                { label: 'Veterinario', value: record.veterinarian },
              ]}
              notes={record.notes}
              isLast={index === dewormingRecords.length - 1}
            />
          ))}
        </HealthSectionCard>

        {/* Weight Section */}
        <HealthSectionCard
          emoji="⚖️"
          title="Peso"
          count={weightRecords.length}
          onAdd={hasValidToken ? () => setShowWeightModal(true) : undefined}
          addAccessibilityLabel="Agregar peso"
          isEmpty={weightRecords.length === 0}
          emptyText="No hay registros de peso"
        >
          <View style={styles.weightGrid}>
            {weightRecords.slice(0, 8).map((record, index) => (
              <View key={record.id} style={styles.weightItem}>
                <Text style={styles.weightDate}>{formatDisplayDate(record.date || '')}</Text>
                <Text style={styles.weightValue}>{record.weight} {record.weight_unit}</Text>
                {record.notes && record.notes !== 'Peso inicial al registrar la mascota' && (
                  <Text style={styles.weightNotes}>{record.notes}</Text>
                )}
              </View>
            ))}
          </View>
        </HealthSectionCard>

      </ScrollView>

      {/* Vaccine Selection Modal */}
      <Modal
        visible={showVaccineModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVaccineModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Elegí la vacuna</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowVaccineModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>
            
            <TextInput
              style={styles.searchInputOutlined}
              placeholder="Buscar vacuna..."
              onChangeText={(text) => {
                // Filter vaccines based on search
              }}
            />
            
            <ScrollView style={styles.optionsList}>
              {vaccines.map((vaccine) => (
                <TouchableOpacity accessibilityRole="button"
                  key={vaccine.id}
                  style={styles.optionItem}
                  onPress={() => handleSelectVaccine(vaccine)}
                >
                  <Text style={styles.optionText}>{vaccine.name}</Text>
                  {vaccine.is_required && (
                    <Text style={styles.requiredBadge}>Obligatoria</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Condition Selection Modal */}
      <Modal
        visible={showConditionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConditionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Elegí la enfermedad</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowConditionModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>
            
            <ScrollView style={styles.optionsList}>
              {conditions.map((condition) => (
                <TouchableOpacity accessibilityRole="button"
                  key={condition.id}
                  style={styles.optionItem}
                  onPress={() => handleSelectCondition(condition)}
                >
                  <Text style={styles.optionText}>{condition.name}</Text>
                  <Text style={styles.categoryText}>{condition.category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Treatment Selection Modal */}
      <Modal
        visible={showTreatmentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTreatmentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Elegí el tratamiento</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowTreatmentModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>
            
            <ScrollView style={styles.optionsList}>
              {treatments.map((treatment) => (
                <TouchableOpacity accessibilityRole="button"
                  key={treatment.id}
                  style={styles.optionItem}
                  onPress={() => handleSelectTreatment(treatment)}
                >
                  <Text style={styles.optionText}>{treatment.name}</Text>
                  <Text style={styles.categoryText}>{treatment.type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Allergy Selection Modal */}
      <Modal
        visible={showAllergyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllergyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Elegí la alergia</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowAllergyModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>
            
            <ScrollView style={styles.optionsList}>
              {allergies.map((allergy) => (
                <TouchableOpacity accessibilityRole="button"
                  key={allergy.id}
                  style={styles.optionItem}
                  onPress={() => handleSelectAllergy(allergy)}
                >
                  <Text style={styles.optionText}>{allergy.name}</Text>
                  <Text style={styles.categoryText}>{allergy.category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Dewormer Selection Modal */}
      <Modal
        visible={showDewormerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDewormerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Elegí el desparasitante</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowDewormerModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>
            
            <ScrollView style={styles.optionsList}>
              {dewormers.map((dewormer) => (
                <TouchableOpacity accessibilityRole="button"
                  key={dewormer.id}
                  style={styles.optionItem}
                  onPress={() => handleSelectDewormer(dewormer)}
                >
                  <Text style={styles.optionText}>{dewormer.name}</Text>
                  <Text style={styles.categoryText}>{dewormer.administration_method}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Veterinarian Selection Modal */}
      <Modal
        visible={showVetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Elegí el veterinario</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowVetModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>
            
            <ScrollView style={styles.optionsList}>
              {veterinarians.map((vet) => (
                <TouchableOpacity accessibilityRole="button"
                  key={vet.id}
                  style={styles.optionItem}
                  onPress={() => handleSelectVeterinarian(vet)}
                >
                  <Text style={styles.optionText}>{vet.business_name}</Text>
                  <Text style={styles.categoryText}>{vet.address}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity accessibilityRole="button" 
              style={styles.addTempButton}
              onPress={() => {
                setShowVetModal(false);
                setShowTempVetModal(true);
              }}
            >
              <Text style={styles.addTempButtonText}>+ Agregar veterinario temporal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Temporary Veterinarian Modal */}
      <Modal
        visible={showTempVetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTempVetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tempVetModal}>
            <Text style={styles.tempVetTitle}>Agregar veterinario temporal</Text>
            
            <TextInput
              style={styles.tempVetInput}
              placeholder="Nombre del veterinario o clínica"
              value={tempVetName}
              onChangeText={setTempVetName}
            />
            
            <View style={styles.tempVetActions}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.tempVetCancel}
                onPress={() => setShowTempVetModal(false)}
              >
                <Text style={styles.tempVetCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.tempVetSave}
                onPress={handleAddTempVet}
              >
                <Text style={styles.tempVetSaveText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Vaccine Modal */}
      <Modal
        visible={showVaccineModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVaccineModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>💉 Agregar vacuna</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowVaccineModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.selectInput}
                onPress={() => {
                  setShowVaccineSelection(true);
                  loadVaccines();
                }}
              >
                <Text style={[styles.selectInputText, !vaccineForm.name && styles.placeholderText]}>
                  {vaccineForm.name || 'Elegí una vacuna *'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" 
                style={styles.dateInput}
                onPress={() => {
                  const input = prompt('Fecha de aplicación (DD/MM/YYYY):', formatDate(vaccineForm.applicationDate));
                  if (input) {
                    const [day, month, year] = input.split('/').map(Number);
                    if (day && month && year) {
                      setVaccineForm(prev => ({ ...prev, applicationDate: new Date(year, month - 1, day) }));
                    }
                  }
                }}
              >
                <Calendar size={20} color={colors.textSecondary} />
                <Text style={styles.dateInputText}>
                  Aplicada: {formatDate(vaccineForm.applicationDate)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" 
                style={styles.dateInput}
                onPress={() => {
                  const input = prompt('Próxima dosis (DD/MM/YYYY) - opcional:', 
                    vaccineForm.nextDueDate ? formatDate(vaccineForm.nextDueDate) : '');
                  if (input) {
                    const [day, month, year] = input.split('/').map(Number);
                    if (day && month && year) {
                      setVaccineForm(prev => ({ ...prev, nextDueDate: new Date(year, month - 1, day) }));
                    }
                  } else if (input === '') {
                    setVaccineForm(prev => ({ ...prev, nextDueDate: null }));
                  }
                }}
              >
                <Calendar size={20} color={colors.textSecondary} />
                <Text style={styles.dateInputText}>
                  Próxima: {vaccineForm.nextDueDate ? formatDate(vaccineForm.nextDueDate) : 'No establecida'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" 
                style={styles.selectInput}
                onPress={() => {
                  setCurrentFormType('vaccine');
                  setShowVeterinarianSelection(true);
                  loadVeterinarians();
                }}
              >
                <Text style={[styles.selectInputText, !vaccineForm.veterinarian && styles.placeholderText]}>
                  {vaccineForm.veterinarian || 'Elegí un veterinario'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TextInput
                style={styles.textArea}
                placeholder="Notas adicionales..."
                value={vaccineForm.notes}
                onChangeText={(text) => setVaccineForm(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.cancelButton}
                onPress={() => setShowVaccineModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" 
                style={[styles.saveButton, (!vaccineForm.name || saving) && styles.disabledButton]}
                onPress={saveVaccine}
                disabled={!vaccineForm.name || saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Illness Modal */}
      <Modal
        visible={showIllnessModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIllnessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏥 Agregar enfermedad</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowIllnessModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.selectInput}
                onPress={() => {
                  setShowConditionSelection(true);
                  loadConditions();
                }}
              >
                <Text style={[styles.selectInputText, !illnessForm.name && styles.placeholderText]}>
                  {illnessForm.name || 'Elegí una enfermedad *'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" 
                style={styles.dateInput}
                onPress={() => {
                  const input = prompt('Fecha de diagnóstico (DD/MM/YYYY):', formatDate(illnessForm.diagnosisDate));
                  if (input) {
                    const [day, month, year] = input.split('/').map(Number);
                    if (day && month && year) {
                      setIllnessForm(prev => ({ ...prev, diagnosisDate: new Date(year, month - 1, day) }));
                    }
                  }
                }}
              >
                <Calendar size={20} color={colors.textSecondary} />
                <Text style={styles.dateInputText}>
                  Diagnóstico: {formatDate(illnessForm.diagnosisDate)}
                </Text>
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder="Síntomas observados..."
                value={illnessForm.symptoms}
                onChangeText={(text) => setIllnessForm(prev => ({ ...prev, symptoms: text }))}
                multiline
                numberOfLines={2}
              />

              <TextInput
                style={styles.textInput}
                placeholder="Severidad (Leve, Moderada, Severa)..."
                value={illnessForm.severity}
                onChangeText={(text) => setIllnessForm(prev => ({ ...prev, severity: text }))}
              />

              <TouchableOpacity accessibilityRole="button" 
                style={styles.selectInput}
                onPress={() => {
                  setShowTreatmentSelection(true);
                  loadTreatments();
                }}
              >
                <Text style={[styles.selectInputText, !illnessForm.treatment && styles.placeholderText]}>
                  {illnessForm.treatment || 'Elegí un tratamiento'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" 
                style={styles.selectInput}
                onPress={() => {
                  setCurrentFormType('illness');
                  setShowVeterinarianSelection(true);
                  loadVeterinarians();
                }}
              >
                <Text style={[styles.selectInputText, !illnessForm.veterinarian && styles.placeholderText]}>
                  {illnessForm.veterinarian || 'Elegí un veterinario'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TextInput
                style={styles.textArea}
                placeholder="Notas adicionales..."
                value={illnessForm.notes}
                onChangeText={(text) => setIllnessForm(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.cancelButton}
                onPress={() => setShowIllnessModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" 
                style={[styles.saveButton, (!illnessForm.name || saving) && styles.disabledButton]}
                onPress={saveIllness}
                disabled={!illnessForm.name || saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Allergy Modal */}
      <Modal
        visible={showAllergyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllergyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🚨 Agregar alergia</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowAllergyModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.selectInput}
                onPress={() => {
                  setShowAllergySelection(true);
                  loadAllergies();
                }}
              >
                <Text style={[styles.selectInputText, !allergyForm.name && styles.placeholderText]}>
                  {allergyForm.name || 'Elegí un alérgeno *'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TextInput
                style={styles.textArea}
                placeholder="Síntomas observados *"
                value={allergyForm.symptoms}
                onChangeText={(text) => setAllergyForm(prev => ({ ...prev, symptoms: text }))}
                multiline
                numberOfLines={2}
              />

              <TextInput
                style={styles.textInput}
                placeholder="Severidad (Leve, Moderada, Severa)..."
                value={allergyForm.severity}
                onChangeText={(text) => setAllergyForm(prev => ({ ...prev, severity: text }))}
              />

              <TextInput
                style={styles.textArea}
                placeholder="Tratamiento recomendado..."
                value={allergyForm.treatment}
                onChangeText={(text) => setAllergyForm(prev => ({ ...prev, treatment: text }))}
                multiline
                numberOfLines={2}
              />

              <TextInput
                style={styles.textArea}
                placeholder="Notas adicionales..."
                value={allergyForm.notes}
                onChangeText={(text) => setAllergyForm(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.cancelButton}
                onPress={() => setShowAllergyModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" 
                style={[styles.saveButton, (!allergyForm.name || !allergyForm.symptoms || saving) && styles.disabledButton]}
                onPress={saveAllergy}
                disabled={!allergyForm.name || !allergyForm.symptoms || saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deworming Modal */}
      <Modal
        visible={showDewormingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDewormingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>💊 Agregar desparasitación</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowDewormingModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.selectInput}
                onPress={() => {
                  setShowDewormerSelection(true);
                  loadDewormers();
                }}
              >
                <Text style={[styles.selectInputText, !dewormingForm.productName && styles.placeholderText]}>
                  {dewormingForm.productName || 'Elegí un producto *'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" 
                style={styles.dateInput}
                onPress={() => {
                  const input = prompt('Fecha de aplicación (DD/MM/YYYY):', formatDate(dewormingForm.applicationDate));
                  if (input) {
                    const [day, month, year] = input.split('/').map(Number);
                    if (day && month && year) {
                      setDewormingForm(prev => ({ ...prev, applicationDate: new Date(year, month - 1, day) }));
                    }
                  }
                }}
              >
                <Calendar size={20} color={colors.textSecondary} />
                <Text style={styles.dateInputText}>
                  Aplicada: {formatDate(dewormingForm.applicationDate)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" 
                style={styles.dateInput}
                onPress={() => {
                  const input = prompt('Próxima desparasitación (DD/MM/YYYY) - opcional:', 
                    dewormingForm.nextDueDate ? formatDate(dewormingForm.nextDueDate) : '');
                  if (input) {
                    const [day, month, year] = input.split('/').map(Number);
                    if (day && month && year) {
                      setDewormingForm(prev => ({ ...prev, nextDueDate: new Date(year, month - 1, day) }));
                    }
                  } else if (input === '') {
                    setDewormingForm(prev => ({ ...prev, nextDueDate: null }));
                  }
                }}
              >
                <Calendar size={20} color={colors.textSecondary} />
                <Text style={styles.dateInputText}>
                  Próxima: {dewormingForm.nextDueDate ? formatDate(dewormingForm.nextDueDate) : 'No establecida'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" 
                style={styles.selectInput}
                onPress={() => {
                  setCurrentFormType('deworming');
                  setShowVeterinarianSelection(true);
                  loadVeterinarians();
                }}
              >
                <Text style={[styles.selectInputText, !dewormingForm.veterinarian && styles.placeholderText]}>
                  {dewormingForm.veterinarian || 'Elegí un veterinario'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TextInput
                style={styles.textArea}
                placeholder="Notas adicionales..."
                value={dewormingForm.notes}
                onChangeText={(text) => setDewormingForm(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.cancelButton}
                onPress={() => setShowDewormingModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" 
                style={[styles.saveButton, (!dewormingForm.productName || saving) && styles.disabledButton]}
                onPress={saveDeworming}
                disabled={!dewormingForm.productName || saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Weight Modal */}
      <Modal
        visible={showWeightModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWeightModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚖️ Agregar peso</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowWeightModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <View style={styles.weightInputRow}>
                <TextInput
                  style={[styles.textInput, styles.weightInput]}
                  placeholder="Peso *"
                  value={weightForm.weight}
                  onChangeText={(text) => setWeightForm(prev => ({ ...prev, weight: text }))}
                  keyboardType="numeric"
                />
                
                <View style={styles.unitSelector}>
                  <TouchableOpacity accessibilityRole="button"
                    style={[styles.unitButton, weightForm.weightUnit === 'kg' && styles.selectedUnit]}
                    onPress={() => setWeightForm(prev => ({ ...prev, weightUnit: 'kg' }))}
                  >
                    <Text style={[styles.unitText, weightForm.weightUnit === 'kg' && styles.selectedUnitText]}>kg</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button"
                    style={[styles.unitButton, weightForm.weightUnit === 'lb' && styles.selectedUnit]}
                    onPress={() => setWeightForm(prev => ({ ...prev, weightUnit: 'lb' }))}
                  >
                    <Text style={[styles.unitText, weightForm.weightUnit === 'lb' && styles.selectedUnitText]}>lb</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity accessibilityRole="button" 
                style={styles.dateInput}
                onPress={() => {
                  const input = prompt('Fecha de pesaje (DD/MM/YYYY):', formatDate(weightForm.date));
                  if (input) {
                    const [day, month, year] = input.split('/').map(Number);
                    if (day && month && year) {
                      setWeightForm(prev => ({ ...prev, date: new Date(year, month - 1, day) }));
                    }
                  }
                }}
              >
                <Calendar size={20} color={colors.textSecondary} />
                <Text style={styles.dateInputText}>
                  Fecha: {formatDate(weightForm.date)}
                </Text>
              </TouchableOpacity>

              <TextInput
                style={styles.textArea}
                placeholder="Notas adicionales..."
                value={weightForm.notes}
                onChangeText={(text) => setWeightForm(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.cancelButton}
                onPress={() => setShowWeightModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" 
                style={[styles.saveButton, (!weightForm.weight || saving) && styles.disabledButton]}
                onPress={saveWeight}
                disabled={!weightForm.weight || saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Selection Modals */}
      
      {/* Vaccine Selection Modal */}
      <Modal
        visible={showVaccineSelection}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVaccineSelection(false)}
      >
        <View style={styles.selectionOverlay}>
          <View style={styles.selectionModal}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Elegí la vacuna</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowVaccineSelection(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar vacuna..."
                value={vaccineSearch}
                onChangeText={setVaccineSearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredVaccines().map((vaccine) => (
                <TouchableOpacity accessibilityRole="button"
                  key={vaccine.id}
                  style={styles.selectionItem}
                  onPress={() => handleVaccineSelect(vaccine)}
                >
                  <Text style={styles.selectionItemName}>{vaccine.name}</Text>
                  {vaccine.is_required && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>Obligatoria</Text>
                    </View>
                  )}
                  {vaccine.description && (
                    <Text style={styles.selectionItemDescription}>{vaccine.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Condition Selection Modal */}
      <Modal
        visible={showConditionSelection}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConditionSelection(false)}
      >
        <View style={styles.selectionOverlay}>
          <View style={styles.selectionModal}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Elegí la enfermedad</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowConditionSelection(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar enfermedad..."
                value={conditionSearch}
                onChangeText={setConditionSearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredConditions().map((condition) => (
                <TouchableOpacity accessibilityRole="button"
                  key={condition.id}
                  style={styles.selectionItem}
                  onPress={() => handleConditionSelect(condition)}
                >
                  <Text style={styles.selectionItemName}>{condition.name}</Text>
                  {condition.description && (
                    <Text style={styles.selectionItemDescription}>{condition.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Treatment Selection Modal */}
      <Modal
        visible={showTreatmentSelection}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTreatmentSelection(false)}
      >
        <View style={styles.selectionOverlay}>
          <View style={styles.selectionModal}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Elegí el tratamiento</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowTreatmentSelection(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar tratamiento..."
                value={treatmentSearch}
                onChangeText={setTreatmentSearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredTreatments().map((treatment) => (
                <TouchableOpacity accessibilityRole="button"
                  key={treatment.id}
                  style={styles.selectionItem}
                  onPress={() => handleTreatmentSelect(treatment)}
                >
                  <Text style={styles.selectionItemName}>{treatment.name}</Text>
                  {treatment.description && (
                    <Text style={styles.selectionItemDescription}>{treatment.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Allergy Selection Modal */}
      <Modal
        visible={showAllergySelection}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllergySelection(false)}
      >
        <View style={styles.selectionOverlay}>
          <View style={styles.selectionModal}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Elegí el alérgeno</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowAllergySelection(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar alérgeno..."
                value={allergySearch}
                onChangeText={setAllergySearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredAllergies().map((allergy) => (
                <TouchableOpacity accessibilityRole="button"
                  key={allergy.id}
                  style={styles.selectionItem}
                  onPress={() => handleAllergySelect(allergy)}
                >
                  <Text style={styles.selectionItemName}>{allergy.name}</Text>
                  {allergy.is_common && (
                    <View style={styles.commonBadge}>
                      <Text style={styles.commonText}>Común</Text>
                    </View>
                  )}
                  {allergy.description && (
                    <Text style={styles.selectionItemDescription}>{allergy.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Dewormer Selection Modal */}
      <Modal
        visible={showDewormerSelection}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDewormerSelection(false)}
      >
        <View style={styles.selectionOverlay}>
          <View style={styles.selectionModal}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Elegí el desparasitante</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowDewormerSelection(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar desparasitante..."
                value={dewormerSearch}
                onChangeText={setDewormerSearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredDewormers().map((dewormer) => (
                <TouchableOpacity accessibilityRole="button"
                  key={dewormer.id}
                  style={styles.selectionItem}
                  onPress={() => handleDewormerSelect(dewormer)}
                >
                  <Text style={styles.selectionItemName}>{dewormer.name}</Text>
                  {dewormer.brand && (
                    <Text style={styles.brandText}>Marca: {dewormer.brand}</Text>
                  )}
                  {dewormer.administration_method && (
                    <Text style={styles.methodText}>Método: {dewormer.administration_method}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Veterinarian Selection Modal */}
      <Modal
        visible={showVeterinarianSelection}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVeterinarianSelection(false)}
      >
        <View style={styles.selectionOverlay}>
          <View style={styles.selectionModal}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>Elegí el veterinario</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowVeterinarianSelection(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar veterinario..."
                value={veterinarianSearch}
                onChangeText={setVeterinarianSearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredVeterinarians().map((vet) => (
                <TouchableOpacity accessibilityRole="button"
                  key={vet.id}
                  style={styles.selectionItem}
                  onPress={() => handleVeterinarianSelect(vet)}
                >
                  <Text style={styles.selectionItemName}>{vet.business_name}</Text>
                  {vet.address && (
                    <Text style={styles.addressText}>{vet.address}</Text>
                  )}
                  {vet.phone && (
                    <Text style={styles.phoneText}>{vet.phone}</Text>
                  )}
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity accessibilityRole="button"
                style={styles.addTempVetButton}
                onPress={() => setShowTempVetModal(true)}
              >
                <Plus size={16} color={colors.primary} />
                <Text style={styles.addTempVetText}>Agregar veterinario temporal</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Temporary Veterinarian Modal */}
      <Modal
        visible={showTempVetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTempVetModal(false)}
      >
        <View style={styles.tempVetOverlay}>
          <View style={styles.tempVetModal}>
            <Text style={styles.tempVetTitle}>Agregar veterinario temporal</Text>
            <Text style={styles.tempVetSubtitle}>
              Si el veterinario no está en la lista, podés agregarlo temporalmente
            </Text>
            
            <TextInput
              style={styles.tempVetInput}
              placeholder="Nombre del veterinario o clínica"
              value={tempVetName}
              onChangeText={setTempVetName}
            />
            
            <View style={styles.tempVetActions}>
              <TouchableOpacity accessibilityRole="button" 
                style={styles.tempVetCancel}
                onPress={() => {
                  setShowTempVetModal(false);
                  setTempVetName('');
                }}
              >
                <Text style={styles.tempVetCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" 
                style={[styles.tempVetSave, !tempVetName.trim() && styles.disabledButton]}
                onPress={handleAddTempVet}
                disabled={!tempVetName.trim()}
              >
                <Text style={styles.tempVetSaveText}>Agregar</Text>
              </TouchableOpacity>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.danger,
    textAlign: 'center',
  },
  petCard: {
    marginBottom: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  petName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petBreed: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  petDetails: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  petWeight: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  petColor: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  ownerCard: {
    marginBottom: spacing.lg,
  },
  ownerName: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  ownerEmail: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  ownerPhone: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  addButtonText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.white,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  recordItem: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  recordTitle: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  recordDetail: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  recordLabel: {
    fontFamily: 'Inter-SemiBold',
    color: colors.primary,
  },
  recordNotes: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  weightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  weightItem: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  weightDate: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.primaryStrong,
    marginBottom: spacing.xs,
  },
  weightValue: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Bold',
    color: colors.primaryStrong,
  },
  weightNotes: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: colors.primaryStrong,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    flex: 1,
  },
  modalCloseText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    padding: spacing.xs,
  },
  searchContainerLegacy: {
    marginBottom: spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.text,
  },
  modalList: {
    flex: 1,
    maxHeight: 400,
  },
  emptyModalContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyModalTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyModalSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalItem: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
  },
  modalItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  modalItemName: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  methodIcon: {
    fontSize: fontSize.xs,
    marginRight: spacing.xs,
  },
  methodTextLegacy: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
  },
  modalItemBrand: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  modalItemIngredient: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalItemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  prescriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  prescriptionText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.danger,
    marginLeft: spacing.xs,
  },
  frequencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  frequencyText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.primaryStrong,
    marginLeft: spacing.xs,
  },
  parasitesContainer: {
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  parasitesTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.success,
    marginBottom: spacing.xs,
  },
  parasitesText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.success,
  },
  searchInputOutlined: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    fontSize: fontSize.md,
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  optionText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  categoryText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  requiredBadge: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  addTempButton: {
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  addTempButtonText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
  },
  tempVetModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    margin: spacing.xl,
  },
  tempVetTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  tempVetInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.xl,
  },
  tempVetActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tempVetCancel: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  tempVetCancelText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  tempVetSave: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  tempVetSaveText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.white,
  },
  modalForm: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    maxHeight: 400,
  },
  modalActions: {
    flexDirection: 'row',
    padding: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
    backgroundColor: colors.surface,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButtonText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.white,
  },
  disabledButton: {
    backgroundColor: colors.textTertiary,
    opacity: 0.6,
  },
  
  // Form input styles
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginBottom: spacing.lg,
    minHeight: 50,
  },
  selectInputText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    flex: 1,
  },
  placeholderText: {
    color: colors.textSecondary,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginBottom: spacing.lg,
    minHeight: 50,
  },
  dateInputText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    marginBottom: spacing.lg,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  weightInput: {
    flex: 2,
    marginBottom: 0,
  },
  unitSelector: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  unitButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  selectedUnit: {
    backgroundColor: colors.primary,
  },
  unitText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  selectedUnitText: {
    color: colors.white,
  },
  
  // Selection modal styles
  selectionOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  selectionModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    margin: spacing.xl,
    marginBottom: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  selectionList: {
    maxHeight: 400,
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  selectionItem: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectionItemName: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  selectionItemDescription: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  requiredText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.danger,
  },
  commonBadge: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  commonText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.warning,
  },
  brandText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
    marginTop: 2,
  },
  methodText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  addressText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  addTempVetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoSoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginTop: spacing.sm,
  },
  addTempVetText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  
  // Temporary vet modal styles
  tempVetOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  tempVetSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  expiredCard: {
    alignItems: 'center',
    paddingVertical: 40,
    margin: spacing.xl,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  expiredIconContainer: {
    marginBottom: spacing.xl,
  },
  expiredIcon: {
    fontSize: 64,
  },
  expiredTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: colors.warning,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  expiredMessage: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.warning,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 24,
  },
  expiredInstructions: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  instructionsTitle: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  instructionItem: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  securityNote: {
    backgroundColor: colors.successSoft,
    padding: spacing.lg,
    borderRadius: radius.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    width: '100%',
  },
  securityNoteText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.success,
    textAlign: 'center',
    lineHeight: 16,
  },
  webViewContainer: {
    flex: 1,
    height: '100%',
    overflow: 'scroll',
  },
  webView: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
}) as any;
