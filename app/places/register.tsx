import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Camera, MapPin, Phone, Navigation, ImagePlus, PenLine } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { analyzePlacePhoto, submitPlaceRequest } from '../../utils/placeDiscovery';

const getCurrentCoords = async (): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
};

const CATEGORIES = [
  { value: 'park', label: 'Parque', icon: '🌳' },
  { value: 'restaurant', label: 'Restaurante', icon: '🍽️' },
  { value: 'hotel', label: 'Hotel', icon: '🏨' },
  { value: 'store', label: 'Tienda', icon: '🏪' },
  { value: 'beach', label: 'Playa', icon: '🏖️' },
  { value: 'cafe', label: 'Cafetería', icon: '☕' },
  { value: 'vet', label: 'Veterinaria', icon: '🐾' },
];

const PET_AMENITIES = [
  'Área de juegos para mascotas',
  'Bebederos para mascotas',
  'Menú especial para mascotas',
  'Área de descanso para mascotas',
  'Servicio de cuidado de mascotas',
  'Bolsas para desechos',
  'Correas disponibles',
  'Juguetes para mascotas',
];

type Step = 'choose' | 'form';
type Method = 'photo_ai' | 'manual';

export default function RegisterPlace() {
  const { currentUser } = useAuth();

  const [step, setStep] = useState<Step>('choose');
  const [method, setMethod] = useState<Method>('manual');
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [sourcePhotoUri, setSourcePhotoUri] = useState<string | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [aiRawResponse, setAiRawResponse] = useState<unknown>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [rating, setRating] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('park');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState('');

  const resetForm = () => {
    setSourcePhotoUri(null);
    setGooglePlaceId(null);
    setAiRawResponse(null);
    setCoordinates(null);
    setRating(null);
    setName('');
    setCategory('park');
    setAddress('');
    setPhone('');
    setDescription('');
    setSelectedAmenities([]);
    setCustomAmenity('');
  };

  const startManual = () => {
    resetForm();
    setMethod('manual');
    setStep('form');
  };

  const pickPhotoAndAnalyze = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permisos requeridos', fromCamera
        ? 'Se necesitan permisos para usar la cámara'
        : 'Se necesitan permisos para acceder a la galería');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    resetForm();
    setMethod('photo_ai');
    setSourcePhotoUri(uri);
    setStep('form');
    setAnalyzing(true);

    try {
      const coords = (await getCurrentCoords()) || undefined;

      const suggestion = await analyzePlacePhoto(uri, coords);

      setName(suggestion.name || '');
      if (suggestion.category) setCategory(suggestion.category);
      setAddress(suggestion.address || '');
      setPhone(suggestion.phone || '');
      setDescription(suggestion.description || '');
      setRating(suggestion.rating ?? null);
      setCoordinates(suggestion.coordinates || null);
      setGooglePlaceId(suggestion.googlePlaceId || null);
      setAiRawResponse(suggestion);

      if (!suggestion.name && !suggestion.address) {
        Alert.alert(
          'No pudimos identificar el lugar',
          'No encontramos datos suficientes en la foto. Completa el formulario manualmente.'
        );
      }
    } catch (error) {
      Alert.alert('No se pudo analizar la foto', getErrorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  const handleAddCustomAmenity = () => {
    if (customAmenity.trim() && !selectedAmenities.includes(customAmenity.trim())) {
      setSelectedAmenities(prev => [...prev, customAmenity.trim()]);
      setCustomAmenity('');
    }
  };

  const handleSubmit = async () => {
    if (!currentUser?.id) return;

    if (!name.trim() || !address.trim() || !description.trim()) {
      Alert.alert('Faltan datos', 'Completa nombre, dirección y descripción antes de enviar.');
      return;
    }

    setSubmitting(true);
    try {
      await submitPlaceRequest({
        requestedBy: currentUser.id,
        submissionMethod: method,
        name: name.trim(),
        category,
        address: address.trim(),
        phone: phone.trim() || undefined,
        description: description.trim(),
        petAmenities: selectedAmenities,
        coordinates,
        rating,
        sourcePhotoUri,
        googlePlaceId,
        aiRawResponse,
      });

      Alert.alert(
        'Enviado para aprobación',
        'Gracias por tu aporte. Un administrador va a revisar tu lugar antes de publicarlo.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/places') }]
      );
    } catch (error) {
      Alert.alert('Error', `No se pudo enviar la solicitud: ${getErrorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => (step === 'form' ? setStep('choose') : router.back())} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Registrar lugar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 'choose' && (
          <>
            <Text style={styles.subtitle}>
              Sumá un lugar pet-friendly para que otros lo descubran. Tu propuesta se revisa antes de publicarse.
            </Text>

            <TouchableOpacity onPress={() => pickPhotoAndAnalyze(false)} activeOpacity={0.88}>
              <Card style={styles.optionCard}>
                <ImagePlus size={32} color="#2D6A6F" />
                <Text style={styles.optionTitle}>Con foto (IA)</Text>
                <Text style={styles.optionDescription}>
                  Subí una foto del lugar y completamos el formulario automáticamente buscando el negocio real.
                </Text>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => pickPhotoAndAnalyze(true)} activeOpacity={0.88}>
              <Card style={styles.optionCard}>
                <Camera size={32} color="#2D6A6F" />
                <Text style={styles.optionTitle}>Tomar una foto ahora</Text>
                <Text style={styles.optionDescription}>
                  Usá la cámara en el lugar para que la IA tenga más contexto (incluida tu ubicación).
                </Text>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity onPress={startManual} activeOpacity={0.88}>
              <Card style={styles.optionCard}>
                <PenLine size={32} color="#2D6A6F" />
                <Text style={styles.optionTitle}>Cargar manualmente</Text>
                <Text style={styles.optionDescription}>
                  Completá vos mismo el nombre, dirección y demás datos del lugar.
                </Text>
              </Card>
            </TouchableOpacity>
          </>
        )}

        {step === 'form' && (
          <>
            {sourcePhotoUri && (
              <Image source={{ uri: sourcePhotoUri }} style={styles.previewImage} />
            )}

            {analyzing ? (
              <View style={styles.analyzingContainer}>
                <LoadingSpinner message="Analizando la foto y buscando el lugar..." size="medium" />
              </View>
            ) : (
              <>
                <Input
                  label="Nombre del lugar *"
                  placeholder="Ej: Parque Central Pet-Friendly"
                  value={name}
                  onChangeText={setName}
                />

                <View style={styles.categorySection}>
                  <Text style={styles.fieldLabel}>Categoría *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.categoryOptions}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat.value}
                          style={[styles.categoryOption, category === cat.value && styles.selectedCategoryOption]}
                          onPress={() => setCategory(cat.value)}
                        >
                          <Text style={styles.categoryOptionIcon}>{cat.icon}</Text>
                          <Text style={[styles.categoryOptionText, category === cat.value && styles.selectedCategoryOptionText]}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <Input
                  label="Dirección *"
                  placeholder="Ej: Av. Principal 123, Ciudad"
                  value={address}
                  onChangeText={setAddress}
                  leftIcon={<MapPin size={20} color="#6B7280" />}
                />

                <Input
                  label="Teléfono"
                  placeholder="Ej: +1234567890"
                  value={phone}
                  onChangeText={setPhone}
                  leftIcon={<Phone size={20} color="#6B7280" />}
                />

                <Input
                  label="Descripción *"
                  placeholder="Describe por qué este lugar es pet-friendly..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />

                {coordinates && (
                  <View style={styles.coordinatesRow}>
                    <Navigation size={16} color="#6B7280" />
                    <Text style={styles.coordinatesText}>
                      Ubicación detectada: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
                    </Text>
                  </View>
                )}

                <View style={styles.amenitiesSection}>
                  <Text style={styles.fieldLabel}>Servicios para mascotas</Text>
                  <View style={styles.amenitiesGrid}>
                    {PET_AMENITIES.map((amenity) => (
                      <TouchableOpacity
                        key={amenity}
                        style={[styles.amenityOption, selectedAmenities.includes(amenity) && styles.selectedAmenityOption]}
                        onPress={() => toggleAmenity(amenity)}
                      >
                        <Text style={[styles.amenityOptionText, selectedAmenities.includes(amenity) && styles.selectedAmenityOptionText]}>
                          {amenity}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.customAmenityContainer}>
                    <Input
                      label="¿No encuentras el servicio? Agrégalo aquí"
                      placeholder="Ej: Peluquería canina"
                      value={customAmenity}
                      onChangeText={setCustomAmenity}
                    />
                    <TouchableOpacity style={styles.addAmenityButton} onPress={handleAddCustomAmenity}>
                      <Text style={styles.addAmenityButtonText}>Agregar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Button
                  title={submitting ? 'Enviando...' : 'Enviar para aprobación'}
                  onPress={handleSubmit}
                  disabled={submitting}
                  loading={submitting}
                  size="large"
                  style={styles.submitButton}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButton: { padding: 8, width: 40 },
  title: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#111827' },
  content: { padding: 20, paddingBottom: 40 },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 22,
  },
  optionCard: {
    padding: 20,
    marginBottom: 14,
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 10,
    marginBottom: 6,
  },
  optionDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
  },
  analyzingContainer: {
    paddingVertical: 32,
  },
  fieldLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  categorySection: { marginBottom: 16 },
  categoryOptions: { flexDirection: 'row', gap: 8 },
  categoryOption: {
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 80,
  },
  selectedCategoryOption: { backgroundColor: '#2D6A6F', borderColor: '#2D6A6F' },
  categoryOptionIcon: { fontSize: 20, marginBottom: 4 },
  categoryOptionText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#6B7280', textAlign: 'center' },
  selectedCategoryOptionText: { color: '#FFFFFF' },
  coordinatesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  coordinatesText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280' },
  amenitiesSection: { marginBottom: 20 },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityOption: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedAmenityOption: { backgroundColor: '#2D6A6F', borderColor: '#2D6A6F' },
  amenityOptionText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#6B7280' },
  selectedAmenityOptionText: { color: '#FFFFFF' },
  customAmenityContainer: { marginTop: 16, gap: 8 },
  addAmenityButton: {
    backgroundColor: '#2D6A6F',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addAmenityButtonText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  submitButton: { marginTop: 8 },
});
