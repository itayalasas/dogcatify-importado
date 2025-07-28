import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, Camera, Upload, X, Plus, Minus } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';

export default function AddAdoptionPet() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>();
  const { currentUser } = useAuth();
  
  // Debug logs
  useEffect(() => {
    console.log('AddAdoptionPet component loaded');
    console.log('Partner ID:', partnerId);
    console.log('Current user:', currentUser?.email);
  }, [partnerId, currentUser]);
  
  // Datos básicos
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<'dog' | 'cat' | 'other'>('dog');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState('');
  const [ageUnit, setAgeUnit] = useState<'years' | 'months'>('years');
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [weight, setWeight] = useState('');
  const [color, setColor] = useState('');
  const [description, setDescription] = useState('');
  
  // Salud
  const [isVaccinated, setIsVaccinated] = useState(false);
  const [vaccines, setVaccines] = useState<string[]>([]);
  const [newVaccine, setNewVaccine] = useState('');
  const [isDewormed, setIsDewormed] = useState(false);
  const [isNeutered, setIsNeutered] = useState(false);
  const [healthCondition, setHealthCondition] = useState('');
  const [lastVetVisit, setLastVetVisit] = useState('');
  
  // Comportamiento
  const [temperament, setTemperament] = useState<string[]>([]);
  const [goodWithDogs, setGoodWithDogs] = useState<boolean | null>(null);
  const [goodWithCats, setGoodWithCats] = useState<boolean | null>(null);
  const [goodWithKids, setGoodWithKids] = useState<boolean | null>(null);
  const [energyLevel, setEnergyLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [specialNeeds, setSpecialNeeds] = useState('');
  
  // Adopción
  const [adoptionRequirements, setAdoptionRequirements] = useState<string[]>([]);
  const [adoptionFee, setAdoptionFee] = useState('');
  const [adoptionZones, setAdoptionZones] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [adoptionProcess, setAdoptionProcess] = useState('');
  
  // Imágenes
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);

  const temperamentOptions = [
    'Cariñoso', 'Juguetón', 'Tranquilo', 'Tímido', 'Activo', 'Protector',
    'Sociable', 'Independiente', 'Obediente', 'Curioso', 'Leal', 'Energético'
  ];

  const requirementOptions = [
    'Casa con patio', 'Experiencia previa', 'Tiempo disponible', 
    'Sin niños pequeños', 'Sin otras mascotas', 'Seguimiento post-adopción',
    'Contrato de adopción', 'Visita previa al hogar'
  ];

  const handleSelectImages = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - images.length,
      });

      if (!result.canceled && result.assets) {
        setImages(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para usar la cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        if (images.length >= 5) {
          Alert.alert('Límite alcanzado', 'Puedes seleccionar máximo 5 imágenes');
          return;
        }
        setImages(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadImage = async (imageUri: string, path: string): Promise<string> => {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    const { data, error } = await supabaseClient.storage
      .from('dogcatify')
      .upload(path, blob);

    if (error) throw error;

    const { data: { publicUrl } } = supabaseClient.storage
      .from('dogcatify')
      .getPublicUrl(path);
    
    return publicUrl;
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleTemperament = (trait: string) => {
    setTemperament(prev => 
      prev.includes(trait) 
        ? prev.filter(t => t !== trait)
        : [...prev, trait]
    );
  };

  const toggleRequirement = (req: string) => {
    setAdoptionRequirements(prev => 
      prev.includes(req) 
        ? prev.filter(r => r !== req)
        : [...prev, req]
    );
  };

  const addVaccine = () => {
    if (newVaccine.trim()) {
      setVaccines(prev => [...prev, newVaccine.trim()]);
      setNewVaccine('');
    }
  };

  const removeVaccine = (index: number) => {
    setVaccines(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!petName || !breed || !age || !weight || !description.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios (nombre, raza, edad, peso y descripción)');
      return;
    }

    if (images.length < 3) {
      Alert.alert('Error', 'Se requieren mínimo 3 fotos para la adopción');
      return;
    }

    setLoading(true);
    try {
      // Upload images
      const imageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const imageUrl = await uploadImage(
          images[i].uri, 
          `adoptions/${partnerId}/${Date.now()}-${i}.jpg`
        );
        imageUrls.push(imageUrl);
      }

      // Create adoption pet data
      const adoptionData = {
        partner_id: partnerId,
        name: petName.trim(),
        species,
        breed: breed.trim(),
        gender,
        age: parseInt(age),
        age_unit: ageUnit,
        size,
        weight: parseFloat(weight),
        color: color.trim(),
        description: description.trim(),
        
        // Salud
        is_vaccinated: isVaccinated,
        vaccines: vaccines,
        is_dewormed: isDewormed,
        is_neutered: isNeutered,
        health_condition: healthCondition.trim() || null,
        last_vet_visit: lastVetVisit.trim() || null,
        
        // Comportamiento
        temperament: temperament,
        good_with_dogs: goodWithDogs,
        good_with_cats: goodWithCats,
        good_with_kids: goodWithKids,
        energy_level: energyLevel,
        special_needs: specialNeeds.trim() || null,
        
        // Adopción
        adoption_requirements: adoptionRequirements,
        adoption_fee: adoptionFee ? parseFloat(adoptionFee) : 0,
        adoption_zones: adoptionZones.trim() || null,
        contact_info: contactInfo.trim() || null,
        adoption_process: adoptionProcess.trim() || null,
        
        images: imageUrls,
        is_available: true,
        created_at: new Date().toISOString()
      };

      // Save to adoption_pets table
      const { error } = await supabaseClient
        .from('adoption_pets')
        .insert(adoptionData);

      if (error) throw error;

      Alert.alert('Éxito', 'Mascota agregada para adopción correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error adding adoption pet:', error);
      
      let errorMessage = 'No se pudo agregar la mascota para adopción';
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = `Error: ${error.message}`;
        } else if ('details' in error) {
          errorMessage = `Error: ${error.details}`;
        }
      }
      
      console.error('Detailed error:', JSON.stringify(error, null, 2));
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Agregar Mascota en Adopción</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>🐾 Agregar Mascota en Adopción</Text>
            <Text style={styles.headerSubtitle}>
              Completa toda la información para encontrar el hogar perfecto
            </Text>
          </View>

          {/* Datos Básicos */}
          <Text style={styles.sectionTitle}>📋 Datos Básicos</Text>
          
          <Input
            label="Nombre de la mascota *"
            placeholder="Ej: Toby, Luna, Max..."
            value={petName}
            onChangeText={setPetName}
          />

          <View style={styles.speciesSelector}>
            <Text style={styles.label}>Especie *</Text>
            <View style={styles.optionsRow}>
              {[
                { value: 'dog', label: 'Perro', icon: '🐕' },
                { value: 'cat', label: 'Gato', icon: '🐱' },
                { value: 'other', label: 'Otro', icon: '🐾' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    species === option.value && styles.selectedOption
                  ]}
                  onPress={() => setSpecies(option.value as any)}
                >
                  <Text style={styles.optionIcon}>{option.icon}</Text>
                  <Text style={[
                    styles.optionText,
                    species === option.value && styles.selectedOptionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label="Raza o mestizaje *"
            placeholder="Ej: Labrador, Mestizo, Siamés..."
            value={breed}
            onChangeText={setBreed}
          />

          <View style={styles.genderSelector}>
            <Text style={styles.label}>Sexo *</Text>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.optionButton, gender === 'male' && styles.selectedOption]}
                onPress={() => setGender('male')}
              >
                <Text style={styles.optionIcon}>♂️</Text>
                <Text style={[styles.optionText, gender === 'male' && styles.selectedOptionText]}>
                  Macho
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, gender === 'female' && styles.selectedOption]}
                onPress={() => setGender('female')}
              >
                <Text style={styles.optionIcon}>♀️</Text>
                <Text style={[styles.optionText, gender === 'female' && styles.selectedOptionText]}>
                  Hembra
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Input
                label="Edad *"
                placeholder="2"
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Unidad</Text>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={[styles.smallOption, ageUnit === 'years' && styles.selectedOption]}
                  onPress={() => setAgeUnit('years')}
                >
                  <Text style={[styles.smallOptionText, ageUnit === 'years' && styles.selectedOptionText]}>
                    Años
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallOption, ageUnit === 'months' && styles.selectedOption]}
                  onPress={() => setAgeUnit('months')}
                >
                  <Text style={[styles.smallOptionText, ageUnit === 'months' && styles.selectedOptionText]}>
                    Meses
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.sizeSelector}>
            <Text style={styles.label}>Tamaño *</Text>
            <View style={styles.optionsRow}>
              {[
                { value: 'small', label: 'Pequeño' },
                { value: 'medium', label: 'Mediano' },
                { value: 'large', label: 'Grande' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionButton, size === option.value && styles.selectedOption]}
                  onPress={() => setSize(option.value as any)}
                >
                  <Text style={[styles.optionText, size === option.value && styles.selectedOptionText]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Input
                label="Peso (kg) *"
                placeholder="15"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfWidth}>
              <Input
                label="Color/Pelaje"
                placeholder="Marrón, Negro..."
                value={color}
                onChangeText={setColor}
              />
            </View>
          </View>

          <Input
            label="Descripción de la mascota *"
            placeholder="Describe la personalidad, historia y características especiales de la mascota..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          {/* Salud */}
          <Text style={styles.sectionTitle}>🩺 Salud y Cuidados</Text>
          
          <View style={styles.checkboxGroup}>
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setIsVaccinated(!isVaccinated)}
            >
              <View style={[styles.checkbox, isVaccinated && styles.checkedCheckbox]}>
                {isVaccinated && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Vacunas al día</Text>
            </TouchableOpacity>

            {isVaccinated && (
              <View style={styles.vaccinesList}>
                <Text style={styles.subLabel}>Vacunas aplicadas:</Text>
                {vaccines.map((vaccine, index) => (
                  <View key={index} style={styles.vaccineItem}>
                    <Text style={styles.vaccineText}>{vaccine}</Text>
                    <TouchableOpacity onPress={() => removeVaccine(index)}>
                      <X size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addVaccineRow}>
                  <Input
                    placeholder="Ej: Rabia, Parvovirus..."
                    value={newVaccine}
                    onChangeText={setNewVaccine}
                    style={styles.vaccineInput}
                  />
                  <TouchableOpacity style={styles.addButton} onPress={addVaccine}>
                    <Plus size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setIsDewormed(!isDewormed)}
            >
              <View style={[styles.checkbox, isDewormed && styles.checkedCheckbox]}>
                {isDewormed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Desparasitado/a</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setIsNeutered(!isNeutered)}
            >
              <View style={[styles.checkbox, isNeutered && styles.checkedCheckbox]}>
                {isNeutered && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Castrado/Esterilizado</Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Condición de salud"
            placeholder="Saludable, artritis leve, etc."
            value={healthCondition}
            onChangeText={setHealthCondition}
          />

          <Input
            label="Última revisión veterinaria"
            placeholder="Enero 2024"
            value={lastVetVisit}
            onChangeText={setLastVetVisit}
          />

          {/* Comportamiento */}
          <Text style={styles.sectionTitle}>🧠 Comportamiento y Personalidad</Text>
          
          <View style={styles.temperamentSection}>
            <Text style={styles.label}>Temperamento</Text>
            <View style={styles.temperamentGrid}>
              {temperamentOptions.map((trait) => (
                <TouchableOpacity
                  key={trait}
                  style={[
                    styles.temperamentChip,
                    temperament.includes(trait) && styles.selectedTemperament
                  ]}
                  onPress={() => toggleTemperament(trait)}
                >
                  <Text style={[
                    styles.temperamentText,
                    temperament.includes(trait) && styles.selectedTemperamentText
                  ]}>
                    {trait}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.compatibilitySection}>
            <Text style={styles.label}>Se lleva bien con:</Text>
            
            <View style={styles.compatibilityRow}>
              <Text style={styles.compatibilityLabel}>Otros perros:</Text>
              <View style={styles.compatibilityOptions}>
                <TouchableOpacity
                  style={[styles.compatibilityButton, goodWithDogs === true && styles.selectedCompatibility]}
                  onPress={() => setGoodWithDogs(true)}
                >
                  <Text style={[styles.compatibilityButtonText, goodWithDogs === true && styles.selectedCompatibilityText]}>Sí</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.compatibilityButton, goodWithDogs === false && styles.selectedCompatibility]}
                  onPress={() => setGoodWithDogs(false)}
                >
                  <Text style={[styles.compatibilityButtonText, goodWithDogs === false && styles.selectedCompatibilityText]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.compatibilityButton, goodWithDogs === null && styles.selectedCompatibility]}
                  onPress={() => setGoodWithDogs(null)}
                >
                  <Text style={[styles.compatibilityButtonText, goodWithDogs === null && styles.selectedCompatibilityText]}>No sabe</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.compatibilityRow}>
              <Text style={styles.compatibilityLabel}>Gatos:</Text>
              <View style={styles.compatibilityOptions}>
                <TouchableOpacity
                  style={[styles.compatibilityButton, goodWithCats === true && styles.selectedCompatibility]}
                  onPress={() => setGoodWithCats(true)}
                >
                  <Text style={[styles.compatibilityButtonText, goodWithCats === true && styles.selectedCompatibilityText]}>Sí</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.compatibilityButton, goodWithCats === false && styles.selectedCompatibility]}
                  onPress={() => setGoodWithCats(false)}
                >
                  <Text style={[styles.compatibilityButtonText, goodWithCats === false && styles.selectedCompatibilityText]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.compatibilityButton, goodWithCats === null && styles.selectedCompatibility]}
                  onPress={() => setGoodWithCats(null)}
                >
                  <Text style={[styles.compatibilityButtonText, goodWithCats === null && styles.selectedCompatibilityText]}>No sabe</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.compatibilityRow}>
              <Text style={styles.compatibilityLabel}>Niños:</Text>
              <View style={styles.compatibilityOptions}>
                <TouchableOpacity
                  style={[styles.compatibilityButton, goodWithKids === true && styles.selectedCompatibility]}
                  onPress={() => setGoodWithKids(true)}
                >
                  <Text style={[styles.compatibilityButtonText, goodWithKids === true && styles.selectedCompatibilityText]}>Sí</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.compatibilityButton, goodWithKids === false && styles.selectedCompatibility]}
                  onPress={() => setGoodWithKids(false)}
                >
                  <Text style={[styles.compatibilityButtonText, goodWithKids === false && styles.selectedCompatibilityText]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.compatibilityButton, goodWithKids === null && styles.selectedCompatibility]}
                  onPress={() => setGoodWithKids(null)}
                >
                  <Text style={[styles.compatibilityButtonText, goodWithKids === null && styles.selectedCompatibilityText]}>No sabe</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.energySection}>
            <Text style={styles.label}>Nivel de energía *</Text>
            <View style={styles.optionsRow}>
              {[
                { value: 'low', label: 'Bajo', desc: 'Tranquilo' },
                { value: 'medium', label: 'Medio', desc: 'Moderado' },
                { value: 'high', label: 'Alto', desc: 'Muy activo' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.energyOption, energyLevel === option.value && styles.selectedOption]}
                  onPress={() => setEnergyLevel(option.value as any)}
                >
                  <Text style={[styles.optionText, energyLevel === option.value && styles.selectedOptionText]}>
                    {option.label}
                  </Text>
                  <Text style={styles.energyDesc}>{option.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label="Necesidades especiales"
            placeholder="Dieta especial, medicamentos, ejercicio..."
            value={specialNeeds}
            onChangeText={setSpecialNeeds}
            multiline
            numberOfLines={2}
          />

          {/* Condiciones de Adopción */}
          <Text style={styles.sectionTitle}>🏡 Condiciones de Adopción</Text>
          
          <View style={styles.requirementsSection}>
            <Text style={styles.label}>Requisitos para adopción</Text>
            <View style={styles.requirementsGrid}>
              {requirementOptions.map((req) => (
                <TouchableOpacity
                  key={req}
                  style={[
                    styles.requirementChip,
                    adoptionRequirements.includes(req) && styles.selectedRequirement
                  ]}
                  onPress={() => toggleRequirement(req)}
                >
                  <Text style={[
                    styles.requirementText,
                    adoptionRequirements.includes(req) && styles.selectedRequirementText
                  ]}>
                    {req}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label="Costo de adopción (opcional)"
            placeholder="0 (solo gastos veterinarios)"
            value={adoptionFee}
            onChangeText={setAdoptionFee}
            keyboardType="numeric"
          />

          <Input
            label="Zonas de adopción"
            placeholder="Ciudad, región o país donde se permite adoptar"
            value={adoptionZones}
            onChangeText={setAdoptionZones}
          />

          <Input
            label="Información de contacto"
            placeholder="Teléfono, email, horarios..."
            value={contactInfo}
            onChangeText={setContactInfo}
            multiline
            numberOfLines={2}
          />

          <Input
            label="Proceso de adopción"
            placeholder="Entrevista, visita previa, seguimiento..."
            value={adoptionProcess}
            onChangeText={setAdoptionProcess}
            multiline
            numberOfLines={3}
          />

          {/* Imágenes */}
          <Text style={styles.sectionTitle}>📸 Fotos (mínimo 3, máximo 5)</Text>
          
          <View style={styles.imageSection}>
            <View style={styles.imageActions}>
              <TouchableOpacity 
                style={[styles.imageAction, images.length >= 5 && styles.disabledAction]} 
                onPress={handleTakePhoto}
                disabled={images.length >= 5}
              >
                <Camera size={24} color={images.length >= 5 ? "#9CA3AF" : "#3B82F6"} />
                <Text style={[styles.imageActionText, images.length >= 5 && styles.disabledActionText]}>
                  Tomar Foto
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.imageAction, images.length >= 5 && styles.disabledAction]} 
                onPress={handleSelectImages}
                disabled={images.length >= 5}
              >
                <Upload size={24} color={images.length >= 5 ? "#9CA3AF" : "#3B82F6"} />
                <Text style={[styles.imageActionText, images.length >= 5 && styles.disabledActionText]}>
                  Galería
                </Text>
              </TouchableOpacity>
            </View>
            
            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreview}>
                {images.map((image, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image source={{ uri: image.uri }} style={styles.previewImage} />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <X size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            
            <Text style={styles.imageCount}>
              {images.length}/5 imágenes {images.length < 3 ? '(mínimo 3 requeridas)' : ''}
            </Text>
          </View>

          <Button
            title="Publicar para Adopción"
            onPress={handleSubmit}
            loading={loading}
            size="large"
            disabled={loading || images.length < 3}
          />
        </Card>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 6,
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
  },
  formCard: {
    margin: 16,
  },
  headerInfo: {
    marginBottom: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 24,
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  speciesSelector: {
    marginBottom: 16,
  },
  genderSelector: {
    marginBottom: 16,
  },
  sizeSelector: {
    marginBottom: 16,
  },
  energySection: {
    marginBottom: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  optionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  selectedOptionText: {
    color: '#FFFFFF',
  },
  smallOption: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  smallOptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  energyOption: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  energyDesc: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  checkboxGroup: {
    gap: 12,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  vaccinesList: {
    marginLeft: 32,
    marginTop: 8,
  },
  vaccineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  vaccineText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  addVaccineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  vaccineInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: '#EF4444',
    padding: 8,
    borderRadius: 6,
  },
  temperamentSection: {
    marginBottom: 16,
  },
  temperamentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  temperamentChip: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedTemperament: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  temperamentText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedTemperamentText: {
    color: '#FFFFFF',
  },
  compatibilitySection: {
    marginBottom: 16,
  },
  compatibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  compatibilityLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    flex: 1,
  },
  compatibilityOptions: {
    flexDirection: 'row',
    gap: 4,
  },
  compatibilityButton: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedCompatibility: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  compatibilityButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedCompatibilityText: {
    color: '#FFFFFF',
  },
  requirementsSection: {
    marginBottom: 16,
  },
  requirementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  requirementChip: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedRequirement: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  requirementText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedRequirementText: {
    color: '#FFFFFF',
  },
  imageSection: {
    marginBottom: 20,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  imageAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    marginHorizontal: 8,
  },
  disabledAction: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  imageActionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginTop: 8,
  },
  disabledActionText: {
    color: '#9CA3AF',
  },
  imagePreview: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 8,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCount: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
});