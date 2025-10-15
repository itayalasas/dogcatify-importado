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

const API_KEY = 'Dc+xEVg6S6WoHc7MbV9FLQ==vASOw63SGaFxuAi8';
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
        ? `https://api.api-ninjas.com/v1/dogs?name=${encodeURIComponent(breedName)}`
        : `https://api.api-ninjas.com/v1/cats?name=${encodeURIComponent(breedName)}`;
      
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

    console.log('Validating for duplicate pets...');
    setIsLoading(true);
    
    try {
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
          `Ya tienes una mascota registrada con el nombre "${name.trim()}", especie "${species === 'dog' ? 'Perro' : 'Gato'}" y raza "${breed.trim()}". Por favor verifica la información o usa un nombre diferente.`,
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
                'Tu sesión expiró durante el proceso. La mascota se creó correctamente, pero inicia sesión nuevamente.',
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
                  'Tu sesión expiró durante el proceso. La mascota se creó correctamente, pero inicia sesión nuevamente.',
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
        
        Alert.alert(
          'Mascota agregada',
          'Tu mascota ha sido agregada correctamente',
          [{ text: 'OK', onPress: () => router.push('/(tabs)/pets') }]
        );
      } else {
        console.log('Error creating pet:', error);
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
      console.error('Error in handleSubmit:', error);
      // Check if this is a JWT error
      if (error && typeof error === 'object' && 'message' in error && 
          (error.message.includes('JWT') || error.message.includes('expired'))) {
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
                {breedInfo.min_weight_male && breedInfo.max_weight_male && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Peso (Macho)</Text>
                    <Text style={styles.breedStatValue}>
                      {breedInfo.min_weight_male} - {breedInfo.max_weight_male} kg
                    </Text>
                  </View>
                )}

                {breedInfo.min_weight_female && breedInfo.max_weight_female && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Peso (Hembra)</Text>
                    <Text style={styles.breedStatValue}>
                      {breedInfo.min_weight_female} - {breedInfo.max_weight_female} kg
                    </Text>
                  </View>
                )}

                {breedInfo.min_life_expectancy && breedInfo.max_life_expectancy && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Esperanza de vida</Text>
                    <Text style={styles.breedStatValue}>
                      {breedInfo.min_life_expectancy} - {breedInfo.max_life_expectancy} años
                    </Text>
                  </View>
                )}

                {breedInfo.energy !== undefined && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Energía</Text>
                    <View style={styles.breedStatRating}>
                      <Text style={styles.breedStatValue}>{breedInfo.energy}/5</Text>
                      <View style={styles.ratingBar}>
                        <View style={[styles.ratingFill, { width: `${(breedInfo.energy / 5) * 100}%` }]} />
                      </View>
                    </View>
                  </View>
                )}

                {breedInfo.trainability !== undefined && (
                  <View style={styles.breedStat}>
                    <Text style={styles.breedStatLabel}>Entrenabilidad</Text>
                    <View style={styles.breedStatRating}>
                      <Text style={styles.breedStatValue}>{breedInfo.trainability}/5</Text>
                      <View style={styles.ratingBar}>
                        <View style={[styles.ratingFill, { width: `${(breedInfo.trainability / 5) * 100}%` }]} />
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
              <Search size={20} color="#6B7280" style={styles.colorSearchIcon} />
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
              style={[styles.input, styles.textArea]}
            />
          </View>

          <Button
            title={isLoading ? "Agregando..." : "Agregar Mascota"}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
            size="large"
          />
        </View>
      </ScrollView>
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
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
    position: 'relative',
  },
  inputGroupHalf: {
    flex: 1,
    marginBottom: 16,
    marginHorizontal: 8,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  
  // Modern selector styles
  modernSelector: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
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
    fontSize: 16,
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
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
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
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 50,
    fontSize: 16,
    color: '#111827',
    minHeight: 50,
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
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    maxHeight: 200,
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
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 60,
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
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
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
    alignItems: 'center',
    marginVertical: 10,
  },
  petImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#E5E7EB',
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    fontSize: 40,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    backgroundColor: '#2D6A6F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  imageButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },

  // Breed info styles
  breedInfoContainer: {
    marginBottom: 20,
    padding: 16,
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
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  breedStatsGrid: {
    gap: 12,
  },
  breedStat: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2D6A6F',
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
    marginHorizontal: -8,
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
});