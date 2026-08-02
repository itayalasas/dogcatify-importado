import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Dimensions, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, ChevronDown, Check, Mars, Venus, Search } from '../../components/ui/Icons';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage } from '../../utils/imageUpload';
import { resolveSubscriptionPlanLimits } from '../../utils/subscriptionPlanLimits';

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
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };
  
  const uploadPetImage = async (): Promise<string | null> => {
    if (!petImage) return null;

    try {
      const filename = `pets/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      return await uploadImage(petImage, filename);
    } catch (error) {
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
    
    setLoadingBreedInfo(true);
    try {
      const endpoint = speciesType === 'dog' 
        ? `https://proj-apis-pet-2r9a-7efeae.wittybeach-c1a761c9.northcentralus.azurecontainerapps.io/dogs?name=${encodeURIComponent(breedName)}`
        : `https://proj-apis-pet-2r9a-7efeae.wittybeach-c1a761c9.northcentralus.azurecontainerapps.io/cats?name=${encodeURIComponent(breedName)}`;
      
      
      const response = await fetch(endpoint, {
        headers: {
          'X-Api-Key': API_KEY
        }
      });
      
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.length > 0) {
          setBreedInfo(data[0]);
        } else {
          setBreedInfo(null);
        }
      } else {
      }
    } catch (error) {
      setBreedInfo(null); 
    } finally {
      setLoadingBreedInfo(false);
    }
  };

  const handleBreedSelect = () => {
    if (!species) {
      Alert.alert('Selecciona especie', 'Por favor selecciona primero la especie de tu mascota');
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
        'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
        [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
      );
      return;
    }
    
    if (!name.trim() || !species || !breed.trim() || !age.trim() || !weight.trim() || !gender) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }
    
    if (!currentUser) {
      Alert.alert('Error', 'Debes estar autenticado para agregar una mascota');
      return;
    }

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
      }

      const userPlanLimits = resolveSubscriptionPlanLimits(subscriptionData?.subscription_plans || null);
      const maxPetsAllowed = userPlanLimits.users.maxPets;

      if (maxPetsAllowed !== null) {
        const { count: petsCount, error: petsCountError } = await supabaseClient
          .from('pets')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', currentUser.id);

        if (petsCountError) {
        } else if ((petsCount || 0) >= maxPetsAllowed) {
          Alert.alert(
            'Límite alcanzado',
            `Tu plan actual permite hasta ${maxPetsAllowed} mascota${maxPetsAllowed === 1 ? '' : 's'}. Actualiza tu suscripción para registrar más.`,
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
        Alert.alert('Error', 'No se pudo verificar si la mascota ya existe');
        return;
      }
      
      if (existingPets && existingPets.length > 0) {
        Alert.alert(
          'Mascota ya registrada',
          `Ya tienes una mascota registrada con el nombre "${name.trim()}", especie "${species === 'dog' ? 'Perro' : 'Gato'}" y raza "${breed.trim()}". Por favor verifica la información o usa un nombre diferente.`,
          [{ text: 'Entendido', style: 'default' }]
        );
        return;
      }
      
      
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

      
      // Insert pet and get the created pet ID
      const { data: createdPet, error } = await supabaseClient
        .from('pets')
        .insert(petData)
        .select('id')
        .single();
      
      if (!error && createdPet) {
        
        // Create initial weight record only once
        try {
          
          // Verify no existing weight records first
          const { data: existingWeightRecords, error: checkError } = await supabaseClient
            .from('pet_health')
            .select('id')
            .eq('pet_id', createdPet.id)
            .eq('type', 'weight');
          
          if (checkError) {
            // Check if this is a JWT error
            if (checkError.message?.includes('JWT') || checkError.message?.includes('expired')) {
              Alert.alert(
                'Sesión expirada',
                'Tu sesión expiró durante el proceso. La mascota se creó correctamente, pero inicia sesión nuevamente.',
                [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
              );
              return;
            }
          } else if (existingWeightRecords && existingWeightRecords.length > 0) {
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
              // Check if this is a JWT error
              if (weightError.message?.includes('JWT') || weightError.message?.includes('expired')) {
                Alert.alert(
                  'Sesión expirada',
                  'Tu sesión expiró durante el proceso. La mascota se creó correctamente, pero inicia sesión nuevamente.',
                  [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
                );
                return;
              }
            } else {
            }
          }
        } catch (weightError) {
          // Don't fail pet creation if weight record fails
        }
        
        Alert.alert(
          'Mascota agregada',
          'Tu mascota ha sido agregada correctamente',
          [{ text: 'OK', onPress: () => router.push('/(tabs)/pets') }]
        );
      } else {
        // Check if this is a JWT error
        if (error && (error.message?.includes('JWT') || error.message?.includes('expired'))) {
          Alert.alert(
            'Sesión expirada',
            'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
            [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
          );
          return;
        }
        Alert.alert('Error', error.message || 'Error al agregar la mascota');
      }
    } catch (error) {
      // Check if this is a JWT error
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('JWT') || errorMessage.includes('expired')) {
        Alert.alert(
          'Sesión expirada',
          'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/pets')} style={styles.backButton}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agregar Mascota</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
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
              <ChevronDown size={20} color="#6B7280" />
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
                      <Check size={16} color="#2D6A6F" />
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
                  {breed || (species ? 'Seleccionar raza' : 'Primero selecciona la especie')}
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

          {/* Nombre - Después de la información de la raza */}
          {/* Especie - Primer campo */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre *</Text>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Nombre de tu mascota"
              style={styles.input}
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
                <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
                  <Text style={styles.imageButtonText}>Tomar foto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                  <Text style={styles.imageButtonText}>Galería</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Edad y Peso en fila */}
          <View style={styles.row}>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.label}>Edad *</Text>
              <Input
                value={age}
                onChangeText={setAge}
                placeholder="Edad"
                keyboardType="numeric"
                style={styles.input}
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
                <ChevronDown size={20} color="#6B7280" />
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
                        <Check size={16} color="#2D6A6F" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.label}>Peso *</Text>
              <Input
                value={weight}
                onChangeText={setWeight}
                placeholder="Peso"
                keyboardType="numeric"
                style={styles.input}
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
                <ChevronDown size={20} color="#6B7280" />
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
                        <Check size={16} color="#2D6A6F" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Color con autocompletado */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorInputContainer}>
              <TextInput
                style={styles.colorInput}
                value={colorQuery}
                onChangeText={handleColorInputChange}
                placeholder="Escribe o selecciona un color"
                onFocus={() => setShowColorSuggestions(true)}
              />
              <View style={styles.colorSearchIcon}>
                <Search size={20} color="#6B7280" />
              </View>
            </View>
            
            {showColorSuggestions && filteredColors.length > 0 && (
              <View style={styles.colorSuggestions}>
                {filteredColors.slice(0, 6).map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.colorSuggestion}
                    onPress={() => handleColorSelect(item)}
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
                >
                  <Text style={[
                    styles.genderIcon,
                    { color: gender === option.value ? '#FFFFFF' : '#6B7280' }
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

          {/* Estado - Checkboxes mejorados */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Estado</Text>
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.modernCheckboxRow} 
                onPress={() => setIsNeutered(!isNeutered)}
              >
                <View style={[styles.modernCheckbox, isNeutered && styles.checkedModernCheckbox]}>
                  {isNeutered && <Check size={16} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxText}>
                  {species === 'dog' ? 'Castrado' : 'Esterilizado'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modernCheckboxRow} 
                onPress={() => setHasChip(!hasChip)}
              >
                <View style={[styles.modernCheckbox, hasChip && styles.checkedModernCheckbox]}>
                  {hasChip && <Check size={16} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxText}>
                  Tiene microchip
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {hasChip && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Número de microchip</Text>
              <Input
                value={chipNumber}
                onChangeText={setChipNumber}
                placeholder="Ingresa el número de microchip"
                style={styles.input}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descripción</Text>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción adicional (opcional)"
              multiline
              numberOfLines={4}
              style={StyleSheet.flatten([styles.input, styles.textArea])}
            />
          </View>

          <Button
            title={isLoading ? "Agregando..." : "Agregar Mascota"}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
            size="large"
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    fontSize: 21,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  placeholder: {
    width: 42,
  },
  content: {
    flex: 1,
  },
  form: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 34,
  },
  inputGroup: {
    marginBottom: 18,
    position: 'relative',
  },
  inputGroupHalf: {
    flex: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    minHeight: 54,
  },
  textArea: {
    height: 118,
    textAlignVertical: 'top',
  },
  
  // Modern selector styles
  modernSelector: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  disabledSelector: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  selectorText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    flex: 1,
  },
  disabledSelectorText: {
    color: '#9CA3AF',
  },
  
  // Modern dropdown styles
  modernDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    marginTop: 8,
    shadowColor: '#0F172A',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedDropdownOption: {
    backgroundColor: '#F0F9FF',
  },
  dropdownIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  dropdownOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
  selectedDropdownOptionText: {
    color: '#2D6A6F',
    fontFamily: 'Inter-Medium',
  },

  // Color input styles
  colorInputContainer: {
    position: 'relative',
  },
  colorInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 50,
    fontSize: 16,
    color: '#111827',
    minHeight: 56,
  },
  colorSearchIcon: {
    position: 'absolute',
    right: 16,
    top: 15,
  },
  colorSuggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    marginTop: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 1000,
    maxHeight: 200,
    overflow: 'hidden',
  },
  colorSuggestion: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  colorSuggestionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },

  // Gender selector styles
  genderSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 60,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  selectedGenderOption: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  genderIcon: {
    fontSize: 24,
    fontFamily: 'Inter-Regular',
  },
  genderOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 8,
  },
  selectedGenderOptionText: {
    color: '#FFFFFF',
  },

  // Modern checkbox styles
  checkboxContainer: {
    gap: 12,
  },
  modernCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  modernCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkedModernCheckbox: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  checkboxText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },

  // Image styles
  imageContainer: {
    alignItems: 'stretch',
    marginTop: 2,
    marginBottom: 4,
    padding: 12,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  petImage: {
    width: '100%',
    height: 230,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 0,
  },
  imagePlaceholder: {
    width: '100%',
    height: 230,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
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
    backgroundColor: '#2D6A6F',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  imageButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },

  // Breed info styles
  breedInfoContainer: {
    marginBottom: 22,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  breedInfoTitle: { 
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  breedImage: {
    width: '100%',
    height: 190,
    borderRadius: 18,
    marginBottom: 16,
  },
  breedStatsGrid: {
    gap: 12,
  },
  breedStat: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  breedStatLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  breedStatValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  breedStatRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  ratingFill: {
    height: '100%',
    backgroundColor: '#2D6A6F',
    borderRadius: 3,
  },

  // Layout styles
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  submitButton: {
    minHeight: 56,
    borderRadius: 18,
    marginTop: 4,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
});
