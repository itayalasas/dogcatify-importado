import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Calendar, Search, X, ChevronDown } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabaseClient } from '../../lib/supabase';
import { verifyMedicalHistoryToken } from '../../utils/medicalHistoryTokens';

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
  const [formData, setFormData] = useState<any>({});
  
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
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const apiUrl = `${supabaseUrl}/functions/v1/medical-history/${id}${token ? `?token=${token}` : ''}`;
      
      console.log('Fetching from Edge Function:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
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
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
          
          const edgeFunctionUrl = `${supabaseUrl}/functions/v1/medical-history-data/${id}?token=${token}`;
          console.log('Edge Function URL:', edgeFunctionUrl);
          
          const response = await fetch(edgeFunctionUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
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
        .select('display_name, email, phone')
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
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
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
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/save-medical-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          recordData,
          token: token
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error saving record');
      }

      Alert.alert('Éxito', 'Registro médico guardado correctamente');
      
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
    setFormData(prev => ({ ...prev, name: vaccine.name }));
    setShowVaccineModal(false);
  };

  const handleSelectCondition = (condition: any) => {
    setSelectedCondition(condition);
    setFormData(prev => ({ ...prev, name: condition.name }));
    setShowConditionModal(false);
    
    // Load treatments for this condition
    fetchTreatments();
  };

  const handleSelectTreatment = (treatment: any) => {
    setSelectedTreatment(treatment);
    setFormData(prev => ({ ...prev, treatment: treatment.name }));
    setShowTreatmentModal(false);
  };

  const handleSelectAllergy = (allergy: any) => {
    setSelectedAllergy(allergy);
    setFormData(prev => ({ ...prev, name: allergy.name }));
    setShowAllergyModal(false);
  };

  const handleSelectDewormer = (dewormer: any) => {
    setSelectedDewormer(dewormer);
    setFormData(prev => ({ ...prev, product_name: dewormer.name }));
    setShowDewormerModal(false);
  };

  const handleSelectVeterinarian = (vet: any) => {
    setSelectedVeterinarian(vet);
    setFormData(prev => ({ ...prev, veterinarian: vet.business_name }));
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
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
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
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
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
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
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
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
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
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
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
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/save-medical-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
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
      Alert.alert('Éxito', 'Registro guardado correctamente');
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
      Alert.alert('Error', 'Por favor ingresa el nombre del veterinario');
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
      <View style={styles.header}>
        <Text style={styles.title}>Historia Clínica Veterinaria</Text>
      </View>
      
      <View style={styles.content}>
        <Card style={styles.expiredCard}>
          <View style={styles.expiredIconContainer}>
            <Text style={styles.expiredIcon}>🕒</Text>
          </View>
          
          <Text style={styles.expiredTitle}>Enlace Expirado</Text>
          <Text style={styles.expiredMessage}>
            Este enlace de historia clínica ha expirado por motivos de seguridad.
          </Text>
          
          <View style={styles.expiredInstructions}>
            <Text style={styles.instructionsTitle}>Para acceder a la historia clínica:</Text>
            <Text style={styles.instructionItem}>
              1. Contacta al propietario de la mascota
            </Text>
            <Text style={styles.instructionItem}>
              2. Solicita que genere un nuevo enlace
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
            <div style={{ fontSize: '18px', color: '#2D6A6F' }}>Cargando historia clínica...</div>
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
            backgroundColor: '#FEF2F2',
            borderRadius: '12px',
            border: '1px solid #FECACA'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <div style={{ fontSize: '24px', color: '#DC2626', marginBottom: '16px' }}>Error</div>
            <div style={{ fontSize: '16px', color: '#991B1B', lineHeight: '1.5' }}>{error}</div>
          </div>
        </div>
      );
    }

    if (htmlContent) {
      return (
        <div style={{ height: '100vh', width: '100%' }}>
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
          <div style={{ fontSize: '18px', color: '#6B7280' }}>Historia clínica no disponible</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando historia clínica...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (tokenExpired) {
    return renderTokenExpiredMessage();
  }

  if (!pet || !owner) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se pudo cargar la información</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Historia Clínica - {pet.name}</Text>
        <View style={styles.placeholder} />
      </View>

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
          <Text style={styles.sectionTitle}>👤 Propietario</Text>
          <Text style={styles.ownerName}>{owner.display_name}</Text>
          <Text style={styles.ownerEmail}>{owner.email}</Text>
          {owner.phone && <Text style={styles.ownerPhone}>{owner.phone}</Text>}
        </Card>

        {/* Vaccines Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💉 Vacunas ({vaccineRecords.length})</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => handleAddRecord('vaccine')}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Agregar</Text>
            </TouchableOpacity>
          </View>
          
          {vaccineRecords.length === 0 ? (
            <Text style={styles.emptyText}>No hay vacunas registradas</Text>
          ) : (
            vaccineRecords.map((record, index) => (
              <View key={record.id} style={styles.recordItem}>
                <Text style={styles.recordTitle}>💉 {record.name}</Text>
                <Text style={styles.recordDetail}>
                  <Text style={styles.recordLabel}>Aplicada:</Text> {formatDisplayDate(record.application_date || '')}
                </Text>
                {record.next_due_date && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Próxima:</Text> {formatDisplayDate(record.next_due_date)}
                  </Text>
                )}
                {record.veterinarian && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Veterinario:</Text> {record.veterinarian}
                  </Text>
                )}
                {record.notes && (
                  <Text style={styles.recordNotes}>{record.notes}</Text>
                )}
              </View>
            ))
          )}
        </Card>

        {/* Illnesses Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏥 Enfermedades ({illnessRecords.length})</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => handleAddRecord('illness')}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Agregar</Text>
            </TouchableOpacity>
          </View>
          
          {illnessRecords.length === 0 ? (
            <Text style={styles.emptyText}>No hay enfermedades registradas</Text>
          ) : (
            illnessRecords.map((record, index) => (
              <View key={record.id} style={styles.recordItem}>
                <Text style={styles.recordTitle}>🏥 {record.name}</Text>
                <Text style={styles.recordDetail}>
                  <Text style={styles.recordLabel}>Diagnóstico:</Text> {formatDisplayDate(record.diagnosis_date || '')}
                </Text>
                {record.symptoms && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Síntomas:</Text> {record.symptoms}
                  </Text>
                )}
                {record.severity && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Severidad:</Text> {record.severity}
                  </Text>
                )}
                {record.treatment && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Tratamiento:</Text> {record.treatment}
                  </Text>
                )}
                {record.veterinarian && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Veterinario:</Text> {record.veterinarian}
                  </Text>
                )}
                {record.notes && (
                  <Text style={styles.recordNotes}>{record.notes}</Text>
                )}
              </View>
            ))
          )}
        </Card>

        {/* Allergies Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🚨 Alergias ({allergyRecords.length})</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => handleAddRecord('allergy')}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Agregar</Text>
            </TouchableOpacity>
          </View>
          
          {allergyRecords.length === 0 ? (
            <Text style={styles.emptyText}>No hay alergias registradas</Text>
          ) : (
            allergyRecords.map((record, index) => (
              <View key={record.id} style={styles.recordItem}>
                <Text style={styles.recordTitle}>🚨 {record.name}</Text>
                {record.symptoms && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Síntomas:</Text> {record.symptoms}
                  </Text>
                )}
                {record.severity && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Severidad:</Text> {record.severity}
                  </Text>
                )}
                {record.treatment && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Tratamiento:</Text> {record.treatment}
                  </Text>
                )}
                {record.notes && (
                  <Text style={styles.recordNotes}>{record.notes}</Text>
                )}
              </View>
            ))
          )}
        </Card>

        {/* Deworming Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💊 Desparasitación ({dewormingRecords.length})</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => handleAddRecord('deworming')}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Agregar</Text>
            </TouchableOpacity>
          </View>
          
          {dewormingRecords.length === 0 ? (
            <Text style={styles.emptyText}>No hay desparasitaciones registradas</Text>
          ) : (
            dewormingRecords.map((record, index) => (
              <View key={record.id} style={styles.recordItem}>
                <Text style={styles.recordTitle}>💊 {record.product_name || record.name}</Text>
                <Text style={styles.recordDetail}>
                  <Text style={styles.recordLabel}>Aplicada:</Text> {formatDisplayDate(record.application_date || '')}
                </Text>
                {record.next_due_date && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Próxima:</Text> {formatDisplayDate(record.next_due_date)}
                  </Text>
                )}
                {record.veterinarian && (
                  <Text style={styles.recordDetail}>
                    <Text style={styles.recordLabel}>Veterinario:</Text> {record.veterinarian}
                  </Text>
                )}
                {record.notes && (
                  <Text style={styles.recordNotes}>{record.notes}</Text>
                )}
              </View>
            ))
          )}
        </Card>

        {/* Weight Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>⚖️ Peso ({weightRecords.length})</Text>
            {hasValidToken && (
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setShowWeightModal(true)}
              >
                <Plus size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
          
          {weightRecords.length === 0 ? (
            <Text style={styles.emptyText}>No hay registros de peso</Text>
          ) : (
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
          )}
        </Card>
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
              <Text style={styles.modalTitle}>Seleccionar Vacuna</Text>
              <TouchableOpacity onPress={() => setShowVaccineModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar vacuna..."
              onChangeText={(text) => {
                // Filter vaccines based on search
              }}
            />
            
            <ScrollView style={styles.optionsList}>
              {vaccines.map((vaccine) => (
                <TouchableOpacity
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
              <Text style={styles.modalTitle}>Seleccionar Enfermedad</Text>
              <TouchableOpacity onPress={() => setShowConditionModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.optionsList}>
              {conditions.map((condition) => (
                <TouchableOpacity
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
              <Text style={styles.modalTitle}>Seleccionar Tratamiento</Text>
              <TouchableOpacity onPress={() => setShowTreatmentModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.optionsList}>
              {treatments.map((treatment) => (
                <TouchableOpacity
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
              <Text style={styles.modalTitle}>Seleccionar Alergia</Text>
              <TouchableOpacity onPress={() => setShowAllergyModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.optionsList}>
              {allergies.map((allergy) => (
                <TouchableOpacity
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
              <Text style={styles.modalTitle}>Seleccionar Desparasitante</Text>
              <TouchableOpacity onPress={() => setShowDewormerModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.optionsList}>
              {dewormers.map((dewormer) => (
                <TouchableOpacity
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
              <Text style={styles.modalTitle}>Seleccionar Veterinario</Text>
              <TouchableOpacity onPress={() => setShowVetModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.optionsList}>
              {veterinarians.map((vet) => (
                <TouchableOpacity
                  key={vet.id}
                  style={styles.optionItem}
                  onPress={() => handleSelectVeterinarian(vet)}
                >
                  <Text style={styles.optionText}>{vet.business_name}</Text>
                  <Text style={styles.categoryText}>{vet.address}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
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
            <Text style={styles.tempVetTitle}>Agregar Veterinario Temporal</Text>
            
            <TextInput
              style={styles.tempVetInput}
              placeholder="Nombre del veterinario o clínica"
              value={tempVetName}
              onChangeText={setTempVetName}
            />
            
            <View style={styles.tempVetActions}>
              <TouchableOpacity 
                style={styles.tempVetCancel}
                onPress={() => setShowTempVetModal(false)}
              >
                <Text style={styles.tempVetCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
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
              <Text style={styles.modalTitle}>💉 Agregar Vacuna</Text>
              <TouchableOpacity onPress={() => setShowVaccineModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => {
                  setShowVaccineSelection(true);
                  loadVaccines();
                }}
              >
                <Text style={[styles.selectInputText, !vaccineForm.name && styles.placeholderText]}>
                  {vaccineForm.name || 'Seleccionar vacuna *'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity 
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
                <Calendar size={20} color="#6B7280" />
                <Text style={styles.dateInputText}>
                  Aplicada: {formatDate(vaccineForm.applicationDate)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
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
                <Calendar size={20} color="#6B7280" />
                <Text style={styles.dateInputText}>
                  Próxima: {vaccineForm.nextDueDate ? formatDate(vaccineForm.nextDueDate) : 'No establecida'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => {
                  setCurrentFormType('vaccine');
                  setShowVeterinarianSelection(true);
                  loadVeterinarians();
                }}
              >
                <Text style={[styles.selectInputText, !vaccineForm.veterinarian && styles.placeholderText]}>
                  {vaccineForm.veterinarian || 'Seleccionar veterinario'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
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
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowVaccineModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
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
              <Text style={styles.modalTitle}>🏥 Agregar Enfermedad</Text>
              <TouchableOpacity onPress={() => setShowIllnessModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => {
                  setShowConditionSelection(true);
                  loadConditions();
                }}
              >
                <Text style={[styles.selectInputText, !illnessForm.name && styles.placeholderText]}>
                  {illnessForm.name || 'Seleccionar enfermedad *'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity 
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
                <Calendar size={20} color="#6B7280" />
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

              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => {
                  setShowTreatmentSelection(true);
                  loadTreatments();
                }}
              >
                <Text style={[styles.selectInputText, !illnessForm.treatment && styles.placeholderText]}>
                  {illnessForm.treatment || 'Seleccionar tratamiento'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => {
                  setCurrentFormType('illness');
                  setShowVeterinarianSelection(true);
                  loadVeterinarians();
                }}
              >
                <Text style={[styles.selectInputText, !illnessForm.veterinarian && styles.placeholderText]}>
                  {illnessForm.veterinarian || 'Seleccionar veterinario'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
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
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowIllnessModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
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
              <Text style={styles.modalTitle}>🚨 Agregar Alergia</Text>
              <TouchableOpacity onPress={() => setShowAllergyModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => {
                  setShowAllergySelection(true);
                  loadAllergies();
                }}
              >
                <Text style={[styles.selectInputText, !allergyForm.name && styles.placeholderText]}>
                  {allergyForm.name || 'Seleccionar alérgeno *'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
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
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowAllergyModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
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
              <Text style={styles.modalTitle}>💊 Agregar Desparasitación</Text>
              <TouchableOpacity onPress={() => setShowDewormingModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => {
                  setShowDewormerSelection(true);
                  loadDewormers();
                }}
              >
                <Text style={[styles.selectInputText, !dewormingForm.productName && styles.placeholderText]}>
                  {dewormingForm.productName || 'Seleccionar producto *'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity 
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
                <Calendar size={20} color="#6B7280" />
                <Text style={styles.dateInputText}>
                  Aplicada: {formatDate(dewormingForm.applicationDate)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
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
                <Calendar size={20} color="#6B7280" />
                <Text style={styles.dateInputText}>
                  Próxima: {dewormingForm.nextDueDate ? formatDate(dewormingForm.nextDueDate) : 'No establecida'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => {
                  setCurrentFormType('deworming');
                  setShowVeterinarianSelection(true);
                  loadVeterinarians();
                }}
              >
                <Text style={[styles.selectInputText, !dewormingForm.veterinarian && styles.placeholderText]}>
                  {dewormingForm.veterinarian || 'Seleccionar veterinario'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
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
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowDewormingModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
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
              <Text style={styles.modalTitle}>⚖️ Agregar Peso</Text>
              <TouchableOpacity onPress={() => setShowWeightModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
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
                  <TouchableOpacity
                    style={[styles.unitButton, weightForm.weightUnit === 'kg' && styles.selectedUnit]}
                    onPress={() => setWeightForm(prev => ({ ...prev, weightUnit: 'kg' }))}
                  >
                    <Text style={[styles.unitText, weightForm.weightUnit === 'kg' && styles.selectedUnitText]}>kg</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.unitButton, weightForm.weightUnit === 'lb' && styles.selectedUnit]}
                    onPress={() => setWeightForm(prev => ({ ...prev, weightUnit: 'lb' }))}
                  >
                    <Text style={[styles.unitText, weightForm.weightUnit === 'lb' && styles.selectedUnitText]}>lb</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
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
                <Calendar size={20} color="#6B7280" />
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
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowWeightModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
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
              <Text style={styles.selectionTitle}>Seleccionar Vacuna</Text>
              <TouchableOpacity onPress={() => setShowVaccineSelection(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar vacuna..."
                value={vaccineSearch}
                onChangeText={setVaccineSearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredVaccines().map((vaccine) => (
                <TouchableOpacity
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
              <Text style={styles.selectionTitle}>Seleccionar Enfermedad</Text>
              <TouchableOpacity onPress={() => setShowConditionSelection(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar enfermedad..."
                value={conditionSearch}
                onChangeText={setConditionSearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredConditions().map((condition) => (
                <TouchableOpacity
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
              <Text style={styles.selectionTitle}>Seleccionar Tratamiento</Text>
              <TouchableOpacity onPress={() => setShowTreatmentSelection(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar tratamiento..."
                value={treatmentSearch}
                onChangeText={setTreatmentSearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredTreatments().map((treatment) => (
                <TouchableOpacity
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
              <Text style={styles.selectionTitle}>Seleccionar Alérgeno</Text>
              <TouchableOpacity onPress={() => setShowAllergySelection(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar alérgeno..."
                value={allergySearch}
                onChangeText={setAllergySearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredAllergies().map((allergy) => (
                <TouchableOpacity
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
              <Text style={styles.selectionTitle}>Seleccionar Desparasitante</Text>
              <TouchableOpacity onPress={() => setShowDewormerSelection(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar desparasitante..."
                value={dewormerSearch}
                onChangeText={setDewormerSearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredDewormers().map((dewormer) => (
                <TouchableOpacity
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
              <Text style={styles.selectionTitle}>Seleccionar Veterinario</Text>
              <TouchableOpacity onPress={() => setShowVeterinarianSelection(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar veterinario..."
                value={veterinarianSearch}
                onChangeText={setVeterinarianSearch}
              />
            </View>
            
            <ScrollView style={styles.selectionList}>
              {getFilteredVeterinarians().map((vet) => (
                <TouchableOpacity
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
              
              <TouchableOpacity
                style={styles.addTempVetButton}
                onPress={() => setShowTempVetModal(true)}
              >
                <Plus size={16} color="#3B82F6" />
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
            <Text style={styles.tempVetTitle}>Agregar Veterinario Temporal</Text>
            <Text style={styles.tempVetSubtitle}>
              Si el veterinario no está en la lista, puedes agregarlo temporalmente
            </Text>
            
            <TextInput
              style={styles.tempVetInput}
              placeholder="Nombre del veterinario o clínica"
              value={tempVetName}
              onChangeText={setTempVetName}
            />
            
            <View style={styles.tempVetActions}>
              <TouchableOpacity 
                style={styles.tempVetCancel}
                onPress={() => {
                  setShowTempVetModal(false);
                  setTempVetName('');
                }}
              >
                <Text style={styles.tempVetCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
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
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
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
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
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
    fontSize: 16,
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
    textAlign: 'center',
  },
  petCard: {
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 20,
  },
  petName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  petBreed: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 8,
  },
  petDetails: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  petWeight: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  petColor: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  ownerCard: {
    marginBottom: 16,
  },
  ownerName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  ownerEmail: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  ownerPhone: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  recordItem: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2D6A6F',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  recordDetail: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 4,
  },
  recordLabel: {
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
  },
  recordNotes: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  weightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  weightItem: {
    backgroundColor: '#EBF8FF',
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  weightDate: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    marginBottom: 4,
  },
  weightValue: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#1E40AF',
  },
  weightNotes: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    flex: 1,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
    padding: 4,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
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
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyModalSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  modalItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  modalItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  modalItemName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  methodIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  methodText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  modalItemBrand: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginBottom: 4,
  },
  modalItemIngredient: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  modalItemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  prescriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  prescriptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#991B1B',
    marginLeft: 4,
  },
  frequencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  frequencyText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    marginLeft: 4,
  },
  parasitesContainer: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  parasitesTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 4,
  },
  parasitesText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#166534',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  requiredBadge: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  addTempButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  addTempButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  tempVetModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
  },
  tempVetTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  tempVetInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  tempVetActions: {
    flexDirection: 'row',
    gap: 12,
  },
  tempVetCancel: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tempVetCancelText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  tempVetSave: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tempVetSaveText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  modalForm: {
    padding: 20,
    paddingTop: 16,
    maxHeight: 400,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2D6A6F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  
  // Form input styles
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  selectInputText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    flex: 1,
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  dateInputText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 8,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  weightInput: {
    flex: 2,
    marginBottom: 0,
  },
  unitSelector: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  unitButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  selectedUnit: {
    backgroundColor: '#2D6A6F',
  },
  unitText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedUnitText: {
    color: '#FFFFFF',
  },
  
  // Selection modal styles
  selectionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  selectionModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    margin: 20,
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  selectionList: {
    maxHeight: 400,
    padding: 20,
    paddingTop: 16,
  },
  selectionItem: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectionItemName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  selectionItemDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  requiredText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#991B1B',
  },
  commonBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  commonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
  },
  brandText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginTop: 2,
  },
  methodText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  addressText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  phoneText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  addTempVetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addTempVetText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 8,
  },
  
  // Temporary vet modal styles
  tempVetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tempVetSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  expiredCard: {
    alignItems: 'center',
    paddingVertical: 40,
    margin: 20,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  expiredIconContainer: {
    marginBottom: 20,
  },
  expiredIcon: {
    fontSize: 64,
  },
  expiredTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#92400E',
    marginBottom: 12,
    textAlign: 'center',
  },
  expiredMessage: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  expiredInstructions: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
  },
  instructionsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  instructionItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 8,
    paddingLeft: 8,
  },
  securityNote: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    width: '100%',
  },
  securityNoteText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    textAlign: 'center',
    lineHeight: 16,
  },
});