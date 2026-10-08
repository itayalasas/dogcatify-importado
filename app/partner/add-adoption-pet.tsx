import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, Camera, Upload, X, Plus, Minus } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { toast } from '../../components/ui/Toast';
import { FormFooter } from '../../components/partner-setup/FormFooter';
import { FormSkeleton } from '../../components/partner-setup/FormSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';
import { canAccessPartnerModule, getPartnerLockedActionLabel, getPartnerPlan } from '../../utils/partnerPlans';
import { colors, radius, spacing, typography } from '../../constants/theme';

export default function AddAdoptionPet() {
  const { partnerId } = useLocalSearchParams<{ partnerId: string }>();
  const { currentUser } = useAuth();
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [initializing, setInitializing] = useState(true);
  
  // Debug logs
  useEffect(() => {
    console.log('AddAdoptionPet component loaded');
    console.log('Partner ID:', partnerId);
    console.log('Current user:', currentUser?.email);
  }, [partnerId, currentUser]);

  useEffect(() => {
    if (!partnerId || !currentUser) return;

    const loadPartner = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('partners')
          .select('id, business_name, business_type, subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at')
          .eq('id', partnerId)
          .single();

        if (error) throw error;

        const planTier = data?.subscription_plan_tier || 'starter';
        const allowed = canAccessPartnerModule(
          planTier,
          'adoptions',
          data?.business_type,
          data?.subscription_plan_status,
          data?.subscription_plan_expires_at,
        );

        setPartnerProfile({
          id: data.id,
          businessName: data.business_name,
          businessType: data.business_type,
          subscriptionPlanTier: planTier,
        });

        if (!allowed) {
          setAccessDenied(true);
        }
      } catch (error) {
        console.error('Error loading adoption partner:', error);
      } finally {
        setInitializing(false);
      }
    };

    loadPartner();
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
          Alert.alert('Límite alcanzado', 'Podés seleccionar máximo 5 imágenes');
          return;
        }
        setImages(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadImage = async (imageUri: string, path: string): Promise<string> => {
    return uploadImageUtil(imageUri, path);
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
      Alert.alert('Error', 'Completá todos los campos obligatorios (nombre, raza, edad, peso y descripción)');
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

      toast.success('Mascota publicada para adopción');
      router.back();
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

  if (initializing) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Mascota en adopción" />
        <FormSkeleton />
      </SafeAreaView>
    );
  }

  if (accessDenied) {
    const plan = getPartnerPlan(partnerProfile?.subscriptionPlanTier);

    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Mascota en adopción" />

        <View style={styles.lockedContainer}>
          <Card style={styles.lockedCard}>
            <Text style={styles.lockedBadge}>{getPartnerLockedActionLabel('adoptions')}</Text>
            <Text style={styles.lockedTitle}>Gestión de adopciones disponible en Pro</Text>
            <Text style={styles.lockedText}>
              {plan.name} no incluye este módulo para refugios.
            </Text>
            <Text style={styles.lockedTextSecondary}>
              Desde el plan Pro podés publicar mascotas, administrar requisitos y habilitar el contacto con adoptantes.
            </Text>
            <Button title="Volver" onPress={() => router.back()} variant="outline" />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Mascota en adopción" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
          <View style={styles.headerInfo}>
            <Text style={styles.headerSubtitle}>
              Completá toda la información para encontrarle el hogar perfecto 🐾
            </Text>
          </View>

        <Card style={styles.formCard}>
          {/* Datos Básicos */}
          <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>Datos básicos</Text>
          
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
            placeholder="Describí la personalidad, historia y características especiales de la mascota..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

        </Card>

        <Card style={styles.formCard}>
          {/* Salud */}
          <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>Salud y cuidados</Text>
          
          <View style={styles.checkboxGroup}>
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setIsVaccinated(!isVaccinated)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!isVaccinated }}
            >
              <View style={[styles.checkbox, isVaccinated && styles.checkedCheckbox]}>
                {isVaccinated && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Vacunas al día</Text>
            </TouchableOpacity>

            {isVaccinated && (
              <View style={styles.vaccinesList}>
                <Text style={styles.subLabel}>Vacunas aplicadas</Text>
                {vaccines.map((vaccine, index) => (
                  <View key={index} style={styles.vaccineItem}>
                    <Text style={styles.vaccineText}>{vaccine}</Text>
                    <TouchableOpacity
                      onPress={() => removeVaccine(index)}
                      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar vacuna ${vaccine}`}
                    >
                      <X size={16} color={colors.danger} />
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
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={addVaccine}
                    accessibilityRole="button"
                    accessibilityLabel="Agregar vacuna"
                  >
                    <Plus size={16} color={colors.white} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setIsDewormed(!isDewormed)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!isDewormed }}
            >
              <View style={[styles.checkbox, isDewormed && styles.checkedCheckbox]}>
                {isDewormed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Desparasitado/a</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setIsNeutered(!isNeutered)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!isNeutered }}
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

        </Card>

        <Card style={styles.formCard}>
          {/* Comportamiento */}
          <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>Comportamiento y personalidad</Text>
          
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

        </Card>

        <Card style={styles.formCard}>
          {/* Condiciones de Adopción */}
          <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>Condiciones de adopción</Text>
          
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

        </Card>

        <Card style={styles.formCard}>
          {/* Imágenes */}
          <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>Fotos (mínimo 3, máximo 5)</Text>
          
          <View style={styles.imageSection}>
            <View style={styles.imageActions}>
              <TouchableOpacity 
                style={[styles.imageAction, images.length >= 5 && styles.disabledAction]} 
                onPress={handleTakePhoto}
                disabled={images.length >= 5}
                accessibilityRole="button"
                accessibilityLabel="Tomar foto"
                accessibilityState={{ disabled: images.length >= 5 }}
              >
                <Camera size={24} color={images.length >= 5 ? colors.textDisabled : colors.primary} />
                <Text style={[styles.imageActionText, images.length >= 5 && styles.disabledActionText]}>
                  Tomar foto
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.imageAction, images.length >= 5 && styles.disabledAction]} 
                onPress={handleSelectImages}
                disabled={images.length >= 5}
                accessibilityRole="button"
                accessibilityLabel="Elegir fotos de la galería"
                accessibilityState={{ disabled: images.length >= 5 }}
              >
                <Upload size={24} color={images.length >= 5 ? colors.textDisabled : colors.primary} />
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
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel="Quitar foto"
                    >
                      <X size={16} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            
            <Text style={styles.imageCount}>
              {images.length}/5 imágenes {images.length < 3 ? '(mínimo 3 requeridas)' : ''}
            </Text>
          </View>

        </Card>
      </ScrollView>

      <FormFooter>
        <Button
          title="Publicar para adopción"
            onPress={handleSubmit}
            loading={loading}
            size="large"
            disabled={loading || images.length < 3}
          />
      </FormFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
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
    padding: 6,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  formCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  firstSectionTitle: {
    marginTop: 0,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  headerInfo: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  subLabel: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  speciesSelector: {
    marginBottom: spacing.lg,
  },
  genderSelector: {
    marginBottom: spacing.lg,
  },
  sizeSelector: {
    marginBottom: spacing.lg,
  },
  energySection: {
    marginBottom: spacing.lg,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  selectedOption: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  optionIcon: {
    ...typography.title,
    marginBottom: spacing.xs,
  },
  optionText: {
    ...typography.label,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  selectedOptionText: {
    color: colors.white,
  },
  smallOption: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  smallOptionText: {
    ...typography.captionStrong,
    color: colors.textTertiary,
  },
  energyOption: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  energyDesc: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  checkboxGroup: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  checkmark: {
    color: colors.white,
    ...typography.captionStrong,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.text,
  },
  vaccinesList: {
    marginLeft: spacing.xxxl,
    marginTop: spacing.sm,
  },
  vaccineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  vaccineText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  addVaccineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  vaccineInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  temperamentSection: {
    marginBottom: spacing.lg,
  },
  temperamentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  temperamentChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  selectedTemperament: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  temperamentText: {
    ...typography.captionStrong,
    color: colors.textTertiary,
  },
  selectedTemperamentText: {
    color: colors.white,
  },
  compatibilitySection: {
    marginBottom: spacing.lg,
  },
  compatibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  compatibilityLabel: {
    ...typography.label,
    color: colors.textSecondary,
    flex: 1,
  },
  compatibilityOptions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  compatibilityButton: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  selectedCompatibility: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  compatibilityButtonText: {
    ...typography.captionStrong,
    color: colors.textTertiary,
  },
  selectedCompatibilityText: {
    color: colors.white,
  },
  requirementsSection: {
    marginBottom: spacing.lg,
  },
  requirementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  requirementChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedRequirement: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  requirementText: {
    ...typography.captionStrong,
    color: colors.textTertiary,
  },
  selectedRequirementText: {
    color: colors.white,
  },
  imageSection: {
    marginBottom: spacing.xl,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  imageAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginHorizontal: spacing.sm,
  },
  disabledAction: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  imageActionText: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  disabledActionText: {
    color: colors.textTertiary,
  },
  imagePreview: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  imageContainer: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: radius.sm,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.danger,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCount: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: spacing.xl,
  },
  lockedBadge: {
    ...typography.captionStrong,
    color: colors.warning,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  lockedTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  lockedText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  lockedTextSecondary: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  lockedButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  lockedButtonText: {
    color: colors.white,
    ...typography.label,
  },
});
