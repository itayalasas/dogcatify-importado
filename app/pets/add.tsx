import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Dimensions } from 'react-native';
import { router, useLocalSearchParams, Link } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, ChevronDown, Check, Mars, Venus } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabaseClient } from '../../lib/supabase';

interface BreedInfo {
  name: string;
  min_height?: number;
  max_height?: number;
  min_weight?: number;
  max_weight?: number;
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

export default function AddPet() {
  const { currentUser } = useAuth();
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
  const [isNeutered, setIsNeutered] = useState(false);
  const [hasChip, setHasChip] = useState(false);
  const [chipNumber, setChipNumber] = useState('');
  const [gender, setGender] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [breedInfo, setBreedInfo] = useState<BreedInfo | null>(null);
  const [loadingBreedInfo, setLoadingBreedInfo] = useState(false);
  const [showSpeciesSelector, setShowSpeciesSelector] = useState(false);
  
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
      // Create a unique filename
      const filename = `pets/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', {
        uri: petImage,
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
      
      if (error) {
        console.error('Error uploading image:', error);
        return null;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabaseClient.storage
        .from('dogcatify')
        .getPublicUrl(filename);
      
      return publicUrl;
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
  }, [params.species]);

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
    if (!species) return;
    
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
    if (!name.trim() || !breed.trim() || !age.trim() || !weight.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      console.log('Missing required fields'); 
      return;
    }
    
    if (!currentUser) {
      Alert.alert('Error', 'Debes estar autenticado para agregar una mascota');
      console.log('User not authenticated');
      return;
    }

    console.log('Submitting pet data...');
    setIsLoading(true);
    try {
      // Usar la imagen de la raza como foto de la mascota
      let photoURL = breedInfo?.image_link || null;
      
      // Create pet data object
      const petData: any = {
        name: name.trim(),
        species,
        breed: breed.trim(),
        age: parseInt(age),
        age_display: {
          value: parseInt(age),
          unit: ageUnit
        },
        weight: parseFloat(weight),
        weight_display: {
          value: parseFloat(weight),
          unit: weightUnit
        },
        color: color.trim() || null,
        gender: gender || null,
        is_neutered: isNeutered,
        has_chip: hasChip,
        chip_number: hasChip ? chipNumber.trim() : null,
        medical_notes: description.trim() || null,
        owner_id: currentUser.id,
        photo_url: photoURL,
        breed_info: breedInfo || null,
        personality: [],
        created_at: new Date().toISOString()
      };

      console.log('Pet data:', petData);
      
      // Insert pet directly using supabaseClient
      const { data, error } = await supabaseClient
        .from('pets')
        .insert(petData)
        .select();
      
      if (!error) {
        console.log('Pet created successfully');
        Alert.alert(
          'Mascota agregada',
          'Tu mascota ha sido agregada correctamente',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/pets') }]
        );
      } else {
        console.log('Error creating pet:', error);
        Alert.alert('Error', error.message || 'Error al agregar la mascota');
      }
    } catch (error) {
      console.error('Error creating pet:', error);
      Alert.alert('Error', 'Error al agregar la mascota');
    } finally {
      setIsLoading(false);
    }
  };

  const speciesOptions = [
    { value: 'dog', label: 'Perro' },
    { value: 'cat', label: 'Gato' },
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
    { value: 'male', label: 'Macho' },
    { value: 'female', label: 'Hembra' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agregar Mascota</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre *</Text>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Nombre de tu mascota"
              style={styles.input}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Especie *</Text>
            <TouchableOpacity
              style={styles.speciesSelector}
              onPress={() => setShowSpeciesSelector(!showSpeciesSelector)}
            >
              <Text style={styles.selectorText}>
                {speciesOptions.find(opt => opt.value === species)?.label || 'Seleccionar'}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
            
            {showSpeciesSelector && (
              <View style={styles.speciesOptions}>
                {speciesOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.speciesOption}
                    onPress={() => {
                      setSpecies(option.value as PetSpecies);
                      setShowSpeciesSelector(false);
                    }}
                  >
                    <Text style={styles.speciesOptionText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Raza *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={handleBreedSelect}
            >
              <Text style={styles.selectorText}>
                {breed || 'Seleccionar raza'}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
            {loadingBreedInfo && (
              <Text style={styles.loadingText}>Buscando información de la raza...</Text>
            )}
          </View>

          {breedInfo && breed && (
            <View style={styles.breedInfoContainer}>
              <Text style={styles.breedInfoTitle}>Información de la raza {breed}</Text>

              {breedInfo.image_link && (
                <Image 
                  source={{ uri: breedInfo.image_link }} 
                  style={styles.breedImage}
                  resizeMode="cover"
                />
              )}

              {breedInfo.min_height && breedInfo.max_height && (
                <View style={styles.breedInfoCard}>
                  <View style={styles.breedDetails}>
                    <Text style={styles.breedDetailText}>
                      Altura: {breedInfo.min_height} - {breedInfo.max_height} cm
                    </Text>
                  </View>
                </View>
              )}

              {breedInfo.min_weight && breedInfo.max_weight && (
                <View style={styles.breedInfoCard}>
                  <View style={styles.breedDetails}>
                    <Text style={styles.breedDetailText}>
                      Peso: {breedInfo.min_weight} - {breedInfo.max_weight} kg
                    </Text>
                  </View>
                </View>
              )}

              {breedInfo.min_life_expectancy && breedInfo.max_life_expectancy && (
                <View style={styles.breedInfoCard}>
                  <View style={styles.breedDetails}>
                    <Text style={styles.breedDetailText}>
                      Esperanza de vida: {breedInfo.min_life_expectancy} - {breedInfo.max_life_expectancy} años
                    </Text>
                  </View>
                </View>
              )}

              {breedInfo.energy !== undefined && (
                <View style={styles.breedInfoCard}>
                  <View style={styles.breedDetails}>
                    <Text style={styles.breedDetailText}>
                      Nivel de energía: {breedInfo.energy}/5
                    </Text>
                  </View>
                </View>
              )}

              {breedInfo.protectiveness !== undefined && (
                <View style={styles.breedInfoCard}>
                  <View style={styles.breedDetails}>
                    <Text style={styles.breedDetailText}>
                      Protectividad: {breedInfo.protectiveness}/5
                    </Text>
                  </View>
                </View>
              )}

              {breedInfo.trainability !== undefined && (
                <View style={styles.breedInfoCard}>
                  <View style={styles.breedDetails}>
                    <Text style={styles.breedDetailText}>
                      Facilidad de entrenamiento: {breedInfo.trainability}/5
                    </Text>
                  </View>
                </View>
              )}

              {breedInfo.barking !== undefined && (
                <View style={styles.breedInfoCard}>
                  <View style={styles.breedDetails}>
                    <Text style={styles.breedDetailText}>
                      Nivel de ladrido: {breedInfo.barking}/5
                    </Text>
                  </View>
                </View>
              )}

              {breedInfo.shedding !== undefined && (
                <View style={styles.breedInfoCard}>
                  <View style={styles.breedDetails}>
                    <Text style={styles.breedDetailText}>
                      Nivel de muda: {breedInfo.shedding}/5
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

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
                style={styles.selector}
                onPress={() => {
                  // Rotate through age units
                  const currentIndex = ageUnitOptions.findIndex(opt => opt.value === ageUnit);
                  const nextIndex = (currentIndex + 1) % ageUnitOptions.length;
                  setAgeUnit(ageUnitOptions[nextIndex].value as AgeUnit);
                }}
              >
                <Text style={styles.selectorText}>
                  {ageUnitOptions.find(opt => opt.value === ageUnit)?.label || 'Años'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
              </TouchableOpacity>
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
                style={styles.selector}
                onPress={() => {
                  // Toggle between kg and lb
                  setWeightUnit(weightUnit === 'kg' ? 'lb' : 'kg');
                }}
              >
                <Text style={styles.selectorText}>
                  {weightUnitOptions.find(opt => opt.value === weightUnit)?.label || 'Kilogramos'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Color</Text>
            <Input
              value={color}
              onChangeText={setColor}
              placeholder="Color de tu mascota"
              style={styles.input}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Género</Text>
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
                  {option.value === 'male' ? (
                    <Mars size={24} color={gender === 'male' ? '#FFFFFF' : '#6B7280'} />
                  ) : (
                    <Venus size={24} color={gender === 'female' ? '#FFFFFF' : '#6B7280'} />
                  )}
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Estado</Text>
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkboxRow} 
                onPress={() => setIsNeutered(!isNeutered)}
              >
                <View style={[styles.checkbox, isNeutered && styles.checkedCheckbox]}>
                  {isNeutered && <Check size={16} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxText}>
                  {species === 'dog' ? 'Castrado' : 'Esterilizado'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.checkboxRow} 
                onPress={() => setHasChip(!hasChip)}
              >
                <View style={[styles.checkbox, hasChip && styles.checkedCheckbox]}>
                  {hasChip && <Check size={16} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxText}>Tiene microchip</Text>
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
            disabled={isLoading}
            style={styles.submitButton}
          />
          </>
        </View>
      </ScrollView>

      {/* Species Modal */}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputGroupHalf: {
    flex: 1,
    marginBottom: 16,
    marginHorizontal: 8,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  petImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 10,
  },
  imagePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    fontSize: 50,
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  imageButton: {
    backgroundColor: '#2D6A6F',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  imageButtonText: {
    color: 'white',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selector: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speciesSelector: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 16,
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -8,
    marginBottom: 4,
  },
  flex1: {
    flex: 1,
  },
  submitButton: {
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: '#2D6A6F',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  modalCancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
  },
  breedInfoContainer: {
    marginBottom: 20,
  },
  breedInfoTitle: { 
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  breedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  breedInfoCard: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#2D6A6F',
    borderRadius: 8,
  },
  breedDetails: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    alignItems: 'center',
    borderColor: '#2D6A6F',
  },
  breedDetailText: {
    fontSize: 14,
    color: '#FFFFFF',
    padding: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkboxText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  genderSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  genderOption: {
    width: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  selectedGenderOption: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  genderOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 8,
  },
  selectedGenderOptionText: {
    color: '#FFFFFF',
  }
});