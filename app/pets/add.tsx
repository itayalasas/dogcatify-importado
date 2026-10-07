import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Dimensions, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDown, Check, Search } from '../../components/ui/Icons';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage } from '../../utils/imageUpload';
import { resolveSubscriptionPlanLimits } from '../../utils/subscriptionPlanLimits';

import { colors, radius, spacing, typography } from '../../constants/theme';
interface BreedInfo {
  name: string;
  min_height?: number;
  max_height?: number;
  min_weight_male?: number;
  max_weight_male?: number;
  min_weight_female?: number;
  max_weight_female?: number;
  min_life_expectancy?: number;
  max_life_expectancy?: number;
  shedding?: number;
  barking?: number;
  energy?: number;
  protectiveness?: number;
  trainability?: number;
  image_link?: string;
}

type PetSpecies = 'dog' | 'cat';
type AgeUnit = 'years' | 'months' | 'days';
type WeightUnit = 'kg' | 'lb';

const API_KEY = 'pk_XYb1Nbel6qVH0fQfv3CpYwHJG1NC5aca';
const { width: screenWidth } = Dimensions.get('window');

// Lista completa de colores para mascotas
const petColors = [
  // Colores básicos
  'Negro', 'Blanco', 'Marrón', 'Gris', 'Dorado', 'Crema', 'Beige',
  // Combinaciones comunes
  'Negro y blanco', 'Marrón y blanco', 'Gris y blanco', 'Dorado y blanco',
  'Tricolor', 'Bicolor', 'Manchado', 'Atigrado', 'Rayado',
  // Colores específicos de perros
  'Chocolate', 'Canela', 'Arena', 'Rojizo', 'Rubio', 'Plateado',
  'Merle', 'Brindle', 'Sable', 'Leonado', 'Caoba',
  // Colores específicos de gatos
  'Naranja', 'Calico', 'Carey', 'Siamés', 'Himalayo', 'Smoke',
  'Tabby', 'Tortoiseshell', 'Colorpoint', 'Chinchilla',
  // Otros
  'Albino', 'Multicolor', 'Jaspeado', 'Moteado'
];

export default function AddPet() {
  const { currentUser, checkTokenValidity } = useAuth();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ 
    species?: PetSpecies; 
    selectedBreed?: string; 
  }>();
  
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>(params.species || 'dog');
  const [breed, setBreed] = useState('');
  const [savedName, setSavedName] = useState('');
  const [age, setAge] = useState('');
  const [ageUnit, setAgeUnit] = useState<AgeUnit>('years');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [color, setColor] = useState('');
  const [colorQuery, setColorQuery] = useState('');
  const [showColorSuggestions, setShowColorSuggestions] = useState(false);
  const [isNeutered, setIsNeutered] = useState(false);
  const [hasChip, setHasChip] = useState(false);
  const [chipNumber, setChipNumber] = useState('');
  const [gender, setGender] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [breedInfo, setBreedInfo] = useState<BreedInfo | null>(null);
  const [loadingBreedInfo, setLoadingBreedInfo] = useState(false);
  const [showSpeciesSelector, setShowSpeciesSelector] = useState(false);
  const [showAgeUnitSelector, setShowAgeUnitSelector] = useState(false);
  const [showWeightUnitSelector, setShowWeightUnitSelector] = useState(false);
  const [petImage, setPetImage] = useState<string | null>(null);

  // Lista completa de colores para mascotas
  const petColorsLocal = [
    // Colores básicos
    'Negro', 'Blanco', 'Marrón', 'Gris', 'Dorado', 'Crema', 'Beige',
    // Combinaciones comunes
    'Negro y blanco', 'Marrón y blanco', 'Gris y blanco', 'Dorado y blanco',
    'Tricolor', 'Bicolor', 'Manchado', 'Atigrado', 'Rayado',
    // Colores específicos de perros
    'Chocolate', 'Canela', 'Arena', 'Rojizo', 'Rubio', 'Plateado',
    'Merle', 'Brindle', 'Sable', 'Leonado', 'Caoba',
    // Colores específicos de gatos
    'Naranja', 'Calico', 'Carey', 'Siamés', 'Himalayo', 'Smoke',
    'Tabby', 'Tortoiseshell', 'Colorpoint', 'Chinchilla',
    // Otros
    'Albino', 'Multicolor', 'Jaspeado', 'Moteado'
  ];

  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor);
    setColorQuery(selectedColor);
    setShowColorSuggestions(false);
  };

  const handleColorInputChange = (text: string) => {
    setColorQuery(text);
    setColor(text);
    setShowColorSuggestions(text.length > 0);
  };

  // Filtrar colores basado en la búsqueda
  const filteredColors = petColorsLocal.filter(petColor =>
    petColor.toLowerCase().includes(colorQuery.toLowerCase())
  );

  // Image picker functions
  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPetImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };
  
  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para usar la cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPetImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };
  
  const uploadPetImage = async (): Promise<string | null> => {
    if (!petImage) return null;

    try {
      const filename = `pets/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      return await uploadImage(petImage, filename);
    } catch (error) {
      console.error('Error uploading pet image:', error);
      return null;
    }
  };

  useEffect(() => {
    if (params.species) {
      setSpecies(params.species as PetSpecies);
      // Preserve the name when changing species
      if (name) {
        setSavedName(name);
      }
    }
    
    if (params.selectedBreed) {
      setBreed(params.selectedBreed);
      // Restore the name after breed selection
      if (savedName) {
        setName(savedName);
      }
      // Fetch breed info when breed is selected
      fetchBreedInfo(params.selectedBreed, params.species || species);
    }
  }, [params.species, params.selectedBreed]);

  const fetchBreedInfo = async (breedName: string, speciesType: PetSpecies) => {
    if (!breedName) return;
    
    console.log(`Fetching breed info for ${breedName} (${speciesType})`);
    setLoadingBreedInfo(true);
    try {
      const endpoint = speciesType === 'dog' 
        ? `https://proj-apis-pet-2r9a-7efeae.wittybeach-c1a761c9.northcentralus.azurecontainerapps.io/dogs?name=${encodeURIComponent(breedName)}`
        : `https://proj-apis-pet-2r9a-7efeae.wittybeach-c1a761c9.northcentralus.azurecontainerapps.io/cats?name=${encodeURIComponent(breedName)}`;
      
      console.log(`API endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        headers: {
          'X-Api-Key': API_KEY
        }
      });
      
      console.log(`API response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Received data:`, data);
        
        if (data && data.length > 0) {
          console.log(`Setting breed info for ${data[0].name}`);
          setBreedInfo(data[0]);
          console.log('Breed info set successfully');
        } else {
          console.log(`No breed info found for ${breedName}`);
          setBreedInfo(null);
        }
      } else {
        console.error('API response not OK:', await response.text());
      }
    } catch (error) {
      console.error('Error fetching breed info:', error);
      setBreedInfo(null); 
    } finally {
      setLoadingBreedInfo(false);
    }
  };

  const handleBreedSelect = () => {
    if (!species) {
      Alert.alert('Seleccioná la especie', 'Primero seleccioná la especie de tu mascota');
      return;
    }
    
    // Save the current name before navigating to breed selector
    if (name) {
      setSavedName(name);
    }
    
    // Navigate to breed selector with current species
    router.push({
      pathname: '/pets/breed-selector',
      params: { species }
    });
  };

  const handleSubmit = async () => {
    // Check token validity before proceeding
    const isTokenValid = await checkTokenValidity();
    if (!isTokenValid) {
      Alert.alert(
        'Sesión expirada',
        'Tu sesión expiró. Iniciá sesión de nuevo.',
        [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
      );
      return;
    }
    
    if (!name.trim() || !species || !breed.trim() || !age.trim() || !weight.trim() || !gender) {
      Alert.alert('Error', 'Completá todos los campos obligatorios');
      return;
    }
    
    if (!currentUser) {
      Alert.alert('Error', 'Tenés que iniciar sesión para agregar una mascota');
      return;
    }

    console.log('Validating for duplicate pets...');
    setIsLoading(true);
    
    try {
      const { data: subscriptionData, error: subscriptionError } = await supabaseClient
        .from('user_subscriptions')
        .select(`
          status,
          subscription_plans (
            tier,
            audience_target,
            limits
          )
        `)
        .eq('user_id', currentUser.id)
        .in('status', ['active', 'trialing', 'pending', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscriptionError) {
        console.error('Error loading user subscription limits:', subscriptionError);
      }

      const userPlanLimits = resolveSubscriptionPlanLimits(subscriptionData?.subscription_plans || null);
      const maxPetsAllowed = userPlanLimits.users.maxPets;

      if (maxPetsAllowed !== null) {
        const { count: petsCount, error: petsCountError } = await supabaseClient
          .from('pets')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', currentUser.id);

        if (petsCountError) {
          console.error('Error counting pets for plan limit:', petsCountError);
        } else if ((petsCount || 0) >= maxPetsAllowed) {
          Alert.alert(
            'Límite alcanzado',
            `Tu plan actual permite hasta ${maxPetsAllowed} mascota${maxPetsAllowed === 1 ? '' : 's'}. Actualizá tu suscripción para registrar más.`,
            [
              { text: 'Ver suscripción', onPress: () => router.push('/profile/subscription') },
              { text: 'OK', style: 'cancel' },
            ]
          );
          return;
        }
      }

      // Check if a pet with the same name, species, and breed already exists for this user
      const { data: existingPets, error: checkError } = await supabaseClient
        .from('pets')
        .select('id, name, species, breed')
        .eq('owner_id', currentUser.id)
        .eq('name', name.trim())
        .eq('species', species)
        .eq('breed', breed.trim());
      
      if (checkError) {
        console.error('Error checking for duplicate pets:', checkError);
        Alert.alert('Error', 'No se pudo verificar si la mascota ya existe');
        return;
      }
      
      if (existingPets && existingPets.length > 0) {
        console.log('Duplicate pet found:', existingPets[0]);
        Alert.alert(
          'Mascota ya registrada',
          `Ya tenés una mascota registrada con el nombre "${name.trim()}", especie "${species === 'dog' ? 'Perro' : 'Gato'}" y raza "${breed.trim()}". Revisá la información o usá un nombre diferente.`,
          [{ text: 'Entendido', style: 'default' }]
        );
        return;
      }
      
      console.log('No duplicate found, proceeding with pet creation...');
      
      // Upload image if selected
      let photoURL = null;
      if (petImage) {
        photoURL = await uploadPetImage();
      } else if (breedInfo?.image_link) {
        photoURL = breedInfo.image_link;
      }
      
      // Create pet data object
      const petData: any = {
        name: name.trim(),
        species,
        breed: breed.trim(),
        age: Number(age),
        age_display: {
          value: Number(age),
          unit: ageUnit
        },
        weight: Number(weight),
        weight_display: {
          value: Number(weight),
          unit: weightUnit
        },
        color: color.trim() || null,
        gender: gender,
        is_neutered: isNeutered,
        has_chip: hasChip,
        chip_number: hasChip ? chipNumber.trim() : null,
        medical_notes: description.trim() || null,
        owner_id: currentUser.id,
        photo_url: photoURL,
        breed_info: breedInfo,
        personality: [],
      };

      console.log('Pet data:', petData);
      
      // Insert pet and get the created pet ID
      const { data: createdPet, error } = await supabaseClient
        .from('pets')
        .insert(petData)
        .select('id')
        .single();
      
      if (!error && createdPet) {
        console.log('Pet created successfully');
        
        // Create initial weight record only once
        try {
          console.log('Creating initial weight record...');
          
          // Verify no existing weight records first
          const { data: existingWeightRecords, error: checkError } = await supabaseClient
            .from('pet_health')
            .select('id')
            .eq('pet_id', createdPet.id)
            .eq('type', 'weight');
          
          if (checkError) {
            console.error('Error checking existing weight records:', checkError);
            // Check if this is a JWT error
            if (checkError.message?.includes('JWT') || checkError.message?.includes('expired')) {
              Alert.alert(
                'Sesión expirada',
                'Tu sesión expiró durante el proceso. La mascota se creó correctamente, pero iniciá sesión de nuevo.',
                [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
              );
              return;
            }
          } else if (existingWeightRecords && existingWeightRecords.length > 0) {
            console.log('Weight records already exist for this pet, skipping creation');
          } else {
            // No existing records, create initial one
            const initialWeightData = {
              pet_id: createdPet.id,
              user_id: currentUser.id,
              type: 'weight',
              weight: parseFloat(weight),
              weight_unit: weightUnit,
              date: new Date().toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }),
              notes: 'Peso inicial al registrar la mascota',
              created_at: new Date().toISOString()
            };
            
            const { error: weightError } = await supabaseClient
              .from('pet_health')
              .insert(initialWeightData);
            
            if (weightError) {
              console.error('Error creating initial weight record:', weightError);
              // Check if this is a JWT error
              if (weightError.message?.includes('JWT') || weightError.message?.includes('expired')) {
                Alert.alert(
                  'Sesión expirada',
                  'Tu sesión expiró durante el proceso. La mascota se creó correctamente, pero iniciá sesión de nuevo.',
                  [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
                );
                return;
              }
            } else {
              console.log('Initial weight record created successfully');
            }
          }
        } catch (weightError) {
          console.error('Error in initial weight record creation:', weightError);
          // Don't fail pet creation if weight record fails
        }
        
        toast.success('¡Listo! Tu mascota se agregó correctamente');
        router.push('/(tabs)/pets');
      } else {
        console.log('Error creating pet:', error);
        // Check if this is a JWT error
        if (error && (error.message?.includes('JWT') || error.message?.includes('expired'))) {
          Alert.alert(
            'Sesión expirada',
            'Tu sesión expiró. Iniciá sesión de nuevo.',
            [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
          );
          return;
        }
        Alert.alert('Error', error.message || 'Error al agregar la mascota');
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      // Check if this is a JWT error
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('JWT') || errorMessage.includes('expired')) {
        Alert.alert(
          'Sesión expirada',
          'Tu sesión expiró. Iniciá sesión de nuevo.',
          [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
        );
        return;
      }
      Alert.alert('Error', 'Error al procesar la solicitud');
    } finally {
      setIsLoading(false);
    }
  };

  const speciesOptions = [
    { value: 'dog', label: 'Perro', icon: '🐕' },
    { value: 'cat', label: 'Gato', icon: '🐱' },
  ];
  
  const ageUnitOptions = [
    { value: 'years', label: 'Años' },
    { value: 'months', label: 'Meses' },
    { value: 'days', label: 'Días' },
  ];

  const weightUnitOptions = [
    { value: 'kg', label: 'Kilogramos' },
    { value: 'lb', label: 'Libras' },
  ];

  const genderOptions = [
    { value: 'male', label: 'Macho', icon: '♂' },
    { value: 'female', label: 'Hembra', icon: '♀' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Agregar mascota" onBack={() => router.push('/(tabs)/pets')} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <View style={[styles.sectionHeader, styles.sectionHeaderFirst]}>
            <Text style={styles.sectionStep}>Paso 1 de 4</Text>
            <Text style={styles.sectionTitle}>Especie y raza</Text>
            <Text style={styles.sectionSubtitle}>Así te mostramos información y cuidados según su raza.</Text>
          </View>

          {/* Especie - Primer campo */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Especie *</Text>
            <TouchableOpacity
              style={styles.modernSelector}
              onPress={() => setShowSpeciesSelector(!showSpeciesSelector)}
            >
              <View style={styles.selectorContent}>
                <Text style={styles.selectorIcon}>
                  {speciesOptions.find(opt => opt.value === species)?.icon || '🐾'}
                </Text>
                <Text style={styles.selectorText}>
                  {speciesOptions.find(opt => opt.value === species)?.label || 'Seleccionar especie'}
                </Text>
              </View>
              <ChevronDown size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            {showSpeciesSelector && (
              <View style={styles.modernDropdown}>
                {speciesOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.modernDropdownOption,
                      species === option.value && styles.selectedDropdownOption
                    ]}
                    onPress={() => {
                      setSpecies(option.value as PetSpecies);
                      setShowSpeciesSelector(false);
                      // Reset breed when species changes
                      if (species !== option.value) {
                        setBreed('');
                        setBreedInfo(null);
                      }
                    }}
                  >
                    <Text style={styles.dropdownIcon}>{option.icon}</Text>
                    <Text style={[
                      styles.dropdownOptionText,
                      species === option.value && styles.selectedDropdownOptionText
                    ]}>
                      {option.label}
                    </Text>
                    {species === option.value && (
                      <Check size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Raza - Segundo campo */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Raza *</Text>
            <TouchableOpacity
              style={[styles.modernSelector, !species && styles.disabledSelector]}
              onPress={handleBreedSelect}
              disabled={!species}
            >
              <View style={styles.selectorContent}>
                <Text style={styles.selectorIcon}>🏷️</Text>
                <Text style={[
                  styles.selectorText,
                  !species && styles.disabledSelectorText
                ]}>
                  {breed || (species ? 'Seleccionar raza' : 'Primero seleccioná la especie')}
                </Text>
              </View>
              <ChevronDown size={20} color={!species ? "#D1D5DB" : "#6B7280"} />
            </TouchableOpacity>
            {loadingBreedInfo && (
              <Text style={styles.loadingText}>Buscando información de la raza...</Text>
            )}
          </View>

          {/* Información de la raza */}
          {breedInfo && breed && (
            <Card style={styles.breedInfoContainer}>
              <Text style={styles.breedInfoTitle}>Información de la raza {breed}</Text>

              {breedInfo.image_link && (
                <Image 
                  source={{ uri: breedInfo.image_link }} 
                  style={styles.breedImage}
                  resizeMode="cover"
                />
              )}

              <View style={styles.breedStatsGrid}>
                {/* Peso (Macho) */}
                {species === 'dog' && breedInfo.min_weight_male && breedInfo.max_weight_male && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Peso (Macho)</Text>
                    <Text style={styles.breedStatValue}>
                      {breedInfo.min_weight_male} - {breedInfo.max_weight_male} kg
                    </Text>
                  </View>
                )}
                {species === 'cat' && (breedInfo as any).min_weight && (breedInfo as any).max_weight && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Peso (Macho)</Text>
                    <Text style={styles.breedStatValue}>
                      {(breedInfo as any).min_weight} - {(breedInfo as any).max_weight} kg
                    </Text>
                  </View>
                )}

                {/* Peso (Hembra) */}
                {species === 'dog' && breedInfo.min_weight_female && breedInfo.max_weight_female && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Peso (Hembra)</Text>
                    <Text style={styles.breedStatValue}>
                      {breedInfo.min_weight_female} - {breedInfo.max_weight_female} kg
                    </Text>
                  </View>
                )}
                {species === 'cat' && (breedInfo as any).min_weight && (breedInfo as any).max_weight && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Peso (Hembra)</Text>
                    <Text style={styles.breedStatValue}>
                      {(breedInfo as any).min_weight} - {(breedInfo as any).max_weight} kg
                    </Text>
                  </View>
                )}

                {/* Esperanza de vida */}
                {breedInfo.min_life_expectancy && breedInfo.max_life_expectancy && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Esperanza de vida</Text>
                    <Text style={styles.breedStatValue}>
                      {breedInfo.min_life_expectancy} - {breedInfo.max_life_expectancy} años
                    </Text>
                  </View>
                )}

                {/* Energía */}
                {(breedInfo.energy !== undefined || (breedInfo as any).playfulness !== undefined) && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Energía</Text>
                    <View style={styles.breedStatRating}>
                      <Text style={styles.breedStatValue}>
                        {species === 'dog' ? breedInfo.energy : (breedInfo as any).playfulness}/5
                      </Text>
                      <View style={styles.ratingBar}>
                        <View style={[styles.ratingFill, {
                          width: `${((species === 'dog' ? breedInfo.energy : (breedInfo as any).playfulness) / 5) * 100}%`
                        }]} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Entrenabilidad */}
                {(breedInfo.trainability !== undefined || (breedInfo as any).intelligence !== undefined) && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Entrenabilidad</Text>
                    <View style={styles.breedStatRating}>
                      <Text style={styles.breedStatValue}>
                        {species === 'dog' ? breedInfo.trainability : (breedInfo as any).intelligence}/5
                      </Text>
                      <View style={styles.ratingBar}>
                        <View style={[styles.ratingFill, {
                          width: `${((species === 'dog' ? breedInfo.trainability : (breedInfo as any).intelligence) / 5) * 100}%`
                        }]} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Muda de pelo */}
                {(breedInfo as any).shedding !== undefined && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Muda de pelo</Text>
                    <View style={styles.breedStatRating}>
                      <Text style={styles.breedStatValue}>{(breedInfo as any).shedding}/5</Text>
                      <View style={styles.ratingBar}>
                        <View style={[styles.ratingFill, { width: `${((breedInfo as any).shedding / 5) * 100}%` }]} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Protección (solo perros) - Amigable con familia (para gatos) */}
                {species === 'dog' && (breedInfo as any).protectiveness !== undefined && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Protección</Text>
                    <View style={styles.breedStatRating}>
                      <Text style={styles.breedStatValue}>{(breedInfo as any).protectiveness}/5</Text>
                      <View style={styles.ratingBar}>
                        <View style={[styles.ratingFill, { width: `${((breedInfo as any).protectiveness / 5) * 100}%` }]} />
                      </View>
                    </View>
                  </View>
                )}
                {species === 'cat' && (breedInfo as any).family_friendly !== undefined && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Protección</Text>
                    <View style={styles.breedStatRating}>
                      <Text style={styles.breedStatValue}>{(breedInfo as any).family_friendly}/5</Text>
                      <View style={styles.ratingBar}>
                        <View style={[styles.ratingFill, { width: `${((breedInfo as any).family_friendly / 5) * 100}%` }]} />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </Card>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionStep}>Paso 2 de 4</Text>
            <Text style={styles.sectionTitle}>Datos básicos</Text>
            <Text style={styles.sectionSubtitle}>Nombre, foto, edad y peso de tu mascota.</Text>
          </View>

          {/* Nombre */}
          <View style={styles.inputGroup}>
            <Input
              label="Nombre *"
              value={name}
              onChangeText={setName}
              placeholder="Nombre de tu mascota"
              autoCapitalize="words"
              containerStyle={styles.inputContainer}
            />
          </View>

          {/* Foto de la mascota */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Foto de la mascota</Text>
            <View style={styles.imageContainer}>
              {petImage ? (
                <Image source={{ uri: petImage }} style={styles.petImage} />
              ) : breedInfo?.image_link ? (
                <Image source={{ uri: breedInfo.image_link }} style={styles.petImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>📷</Text>
                </View>
              )}
              
              <View style={styles.imageButtons}>
                <Button
                  title="Sacar foto"
                  onPress={takePhoto}
                  variant="secondary"
                  icon={<Camera size={18} color={colors.primary} />}
                  style={styles.imageButton}
                />
                <Button
                  title="Galería"
                  onPress={pickImage}
                  variant="secondary"
                  icon={<ImageIcon size={18} color={colors.primary} />}
                  style={styles.imageButton}
                />
              </View>
            </View>
          </View>

          {/* Edad y Peso en fila */}
          <View style={styles.row}>
            <View style={styles.inputGroupHalf}>
              <Input
                label="Edad *"
                containerStyle={styles.inputContainer}
                value={age}
                onChangeText={setAge}
                placeholder="Edad"
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.inputGroupHalf}>
              <Text style={styles.label}>Unidad</Text>
              <TouchableOpacity
                style={styles.modernSelector}
                onPress={() => setShowAgeUnitSelector(!showAgeUnitSelector)}
              >
                <Text style={styles.selectorText}>
                  {ageUnitOptions.find(opt => opt.value === ageUnit)?.label || 'Años'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              {showAgeUnitSelector && (
                <View style={styles.modernDropdown}>
                  {ageUnitOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.modernDropdownOption,
                        ageUnit === option.value && styles.selectedDropdownOption
                      ]}
                      onPress={() => {
                        setAgeUnit(option.value as AgeUnit);
                        setShowAgeUnitSelector(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownOptionText,
                        ageUnit === option.value && styles.selectedDropdownOptionText
                      ]}>
                        {option.label}
                      </Text>
                      {ageUnit === option.value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.inputGroupHalf}>
              <Input
                label="Peso *"
                containerStyle={styles.inputContainer}
                value={weight}
                onChangeText={setWeight}
                placeholder="Peso"
                keyboardType="decimal-pad"
              />
            </View>
            
            <View style={styles.inputGroupHalf}>
              <Text style={styles.label}>Unidad</Text>
              <TouchableOpacity
                style={styles.modernSelector}
                onPress={() => setShowWeightUnitSelector(!showWeightUnitSelector)}
              >
                <Text style={styles.selectorText}>
                  {weightUnitOptions.find(opt => opt.value === weightUnit)?.label || 'Kilogramos'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              {showWeightUnitSelector && (
                <View style={styles.modernDropdown}>
                  {weightUnitOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.modernDropdownOption,
                        weightUnit === option.value && styles.selectedDropdownOption
                      ]}
                      onPress={() => {
                        setWeightUnit(option.value as WeightUnit);
                        setShowWeightUnitSelector(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownOptionText,
                        weightUnit === option.value && styles.selectedDropdownOptionText
                      ]}>
                        {option.label}
                      </Text>
                      {weightUnit === option.value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Color con autocompletado */}
          <View style={styles.inputGroup}>
            <Input
              label="Color"
              containerStyle={styles.inputContainer}
              value={colorQuery}
              onChangeText={handleColorInputChange}
              placeholder="Escribí o seleccioná un color"
              onFocus={() => setShowColorSuggestions(true)}
              rightIcon={<Search size={20} color={colors.icon} />}
            />
            
            {showColorSuggestions && filteredColors.length > 0 && (
              <View style={styles.colorSuggestions}>
                {filteredColors.slice(0, 6).map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.colorSuggestion}
                    onPress={() => handleColorSelect(item)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.colorSuggestionText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Género */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Género *</Text>
            <View style={styles.genderSelector}>
              {genderOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.genderOption,
                    gender === option.value && styles.selectedGenderOption
                  ]}
                  onPress={() => setGender(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: gender === option.value }}
                >
                  <Text style={[
                    styles.genderIcon,
                    { color: gender === option.value ? colors.onPrimary : colors.textSecondary }
                  ]}>
                    {option.icon}
                  </Text>
                  <Text style={[
                    styles.genderOptionText,
                    gender === option.value && styles.selectedGenderOptionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionStep}>Paso 3 de 4</Text>
            <Text style={styles.sectionTitle}>Salud e identificación</Text>
          </View>

          {/* Estado - Checkboxes mejorados */}
          <View style={styles.inputGroup}>
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.modernCheckboxRow}
                onPress={() => setIsNeutered(!isNeutered)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isNeutered }}
              >
                <View style={[styles.modernCheckbox, isNeutered && styles.checkedModernCheckbox]}>
                  {isNeutered && <Check size={16} color={colors.white} />}
                </View>
                <Text style={styles.checkboxText}>
                  {species === 'dog' ? 'Castrado' : 'Esterilizado'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modernCheckboxRow}
                onPress={() => setHasChip(!hasChip)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: hasChip }}
              >
                <View style={[styles.modernCheckbox, hasChip && styles.checkedModernCheckbox]}>
                  {hasChip && <Check size={16} color={colors.white} />}
                </View>
                <Text style={styles.checkboxText}>
                  Tiene microchip
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {hasChip && (
            <View style={styles.inputGroup}>
              <Input
                label="Número de microchip"
                containerStyle={styles.inputContainer}
                value={chipNumber}
                onChangeText={setChipNumber}
                placeholder="Ingresá el número de microchip"
              />
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionStep}>Paso 4 de 4</Text>
            <Text style={styles.sectionTitle}>Sobre tu mascota</Text>
          </View>

          <View style={styles.inputGroup}>
            <Input
              label="Descripción"
              helperText="Opcional: carácter, costumbres, lo que la hace única."
              containerStyle={styles.inputContainer}
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción adicional"
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
          </View>
          <Text style={styles.requiredNote}>* Campos obligatorios</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isLoading ? 'Agregando...' : 'Agregar mascota'}
          onPress={handleSubmit}
          loading={isLoading}
          disabled={isLoading}
          size="large"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    paddingTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sectionHeaderFirst: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  sectionStep: {
    ...typography.captionStrong,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.xxs,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  inputContainer: {
    marginBottom: 0,
  },
  requiredNote: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 44,
  },
  content: {
    flex: 1,
  },
  form: {
    paddingHorizontal: 18,
    paddingTop: spacing.xl,
    paddingBottom: 34,
  },
  inputGroup: {
    marginBottom: 18,
    position: 'relative',
  },
  inputGroupHalf: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  textArea: {
    height: 118,
    textAlignVertical: 'top',
  },
  
  // Modern selector styles
  modernSelector: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  disabledSelector: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  selectorText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    flex: 1,
  },
  disabledSelectorText: {
    color: colors.textSecondary,
  },
  
  // Modern dropdown styles
  modernDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 1000,
    overflow: 'hidden',
  },
  modernDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  selectedDropdownOption: {
    backgroundColor: '#F0F9FF',
  },
  dropdownIcon: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  dropdownOptionText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  selectedDropdownOptionText: {
    color: colors.primary,
    fontFamily: 'Inter-Medium',
  },

  // Color input styles
  colorSuggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 1000,
    maxHeight: 200,
    overflow: 'hidden',
  },
  colorSuggestion: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  colorSuggestionText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Gender selector styles
  genderSelector: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 60,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  selectedGenderOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genderIcon: {
    fontSize: 24,
    fontFamily: 'Inter-Regular',
  },
  genderOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  selectedGenderOptionText: {
    color: colors.white,
  },

  // Modern checkbox styles
  checkboxContainer: {
    gap: spacing.md,
  },
  modernCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 56,
  },
  modernCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: 6,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkedModernCheckbox: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },

  // Image styles
  imageContainer: {
    alignItems: 'stretch',
    marginTop: spacing.xxs,
    marginBottom: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  petImage: {
    width: '100%',
    height: 230,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 0,
  },
  imagePlaceholder: {
    width: '100%',
    height: 230,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    fontSize: 40,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  imageButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },

  // Breed info styles
  breedInfoContainer: {
    marginBottom: 22,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  breedInfoTitle: { 
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  breedImage: {
    width: '100%',
    height: 190,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  breedStatsGrid: {
    gap: spacing.md,
  },
  breedStat: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breedStatLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  breedStatValue: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  breedStatRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  ratingFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },

  // Layout styles
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
