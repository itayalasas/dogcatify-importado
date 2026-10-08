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
import { ScreenHeader, toast } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../constants/theme';
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
          'No encontramos datos suficientes en la foto. Completá el formulario manualmente.'
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
      Alert.alert('Faltan datos', 'Completá nombre, dirección y descripción antes de enviar.');
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

      toast.success(
        'Enviado para aprobación',
        'Gracias por tu aporte. Vamos a revisar el lugar antes de publicarlo.'
      );
      router.replace('/(tabs)/places');
    } catch (error) {
      Alert.alert('Error', `No se pudo enviar la solicitud: ${getErrorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title="Registrar lugar"
        onBack={() => (step === 'form' ? setStep('choose') : router.back())}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {step === 'choose' && (
          <>
            <Text style={styles.subtitle}>
              Sumá un lugar pet-friendly para que otros lo descubran. Tu propuesta se revisa antes de publicarse.
            </Text>

            <TouchableOpacity onPress={() => pickPhotoAndAnalyze(false)} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="Con foto: subí una foto y completamos el formulario">
              <Card style={styles.optionCard}>
                <View style={styles.optionIcon}>
                  <ImagePlus size={28} color={colors.primary} />
                </View>
                <Text style={styles.optionTitle}>Con foto (IA)</Text>
                <Text style={styles.optionDescription}>
                  Subí una foto del lugar y completamos el formulario automáticamente buscando el negocio real.
                </Text>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => pickPhotoAndAnalyze(true)} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="Tomar una foto ahora con la cámara">
              <Card style={styles.optionCard}>
                <View style={styles.optionIcon}>
                  <Camera size={28} color={colors.primary} />
                </View>
                <Text style={styles.optionTitle}>Tomar una foto ahora</Text>
                <Text style={styles.optionDescription}>
                  Usá la cámara en el lugar para que la IA tenga más contexto (incluida tu ubicación).
                </Text>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity onPress={startManual} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="Cargar el lugar manualmente">
              <Card style={styles.optionCard}>
                <View style={styles.optionIcon}>
                  <PenLine size={28} color={colors.primary} />
                </View>
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
                          accessibilityRole="button"
                          accessibilityState={{ selected: category === cat.value }}
                          accessibilityLabel={`Categoría ${cat.label}`}
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
                  placeholder="Ej: Av. 18 de Julio 1234, Montevideo"
                  value={address}
                  onChangeText={setAddress}
                  leftIcon={<MapPin size={20} color={colors.textTertiary} />}
                />

                <Input
                  label="Teléfono"
                  placeholder="Ej: 099 123 456"
                  value={phone}
                  onChangeText={setPhone}
                  leftIcon={<Phone size={20} color={colors.textTertiary} />}
                />

                <Input
                  label="Descripción *"
                  placeholder="Contá por qué este lugar es pet-friendly..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />

                {coordinates && (
                  <View style={styles.coordinatesRow}>
                    <Navigation size={16} color={colors.textTertiary} />
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
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selectedAmenities.includes(amenity) }}
                      >
                        <Text style={[styles.amenityOptionText, selectedAmenities.includes(amenity) && styles.selectedAmenityOptionText]}>
                          {amenity}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.customAmenityContainer}>
                    <Input
                      label="¿No encontrás el servicio? Agregalo acá"
                      placeholder="Ej: Peluquería canina"
                      value={customAmenity}
                      onChangeText={setCustomAmenity}
                    />
                    <Button
                      title="Agregar"
                      variant="outline"
                      onPress={handleAddCustomAmenity}
                      disabled={!customAmenity.trim()}
                    />
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
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButton: { padding: 8, width: 40 },
  title: { fontSize: 18, fontFamily: 'Inter-Bold', color: colors.text },
  content: { padding: spacing.xl, paddingBottom: spacing.huge },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  optionCard: {
    padding: spacing.xl,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  optionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  analyzingContainer: {
    paddingVertical: 32,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  categorySection: { marginBottom: 16 },
  categoryOptions: { flexDirection: 'row', gap: 8 },
  categoryOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    minWidth: 80,
    minHeight: 56,
  },
  selectedCategoryOption: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryOptionIcon: { fontSize: 20, marginBottom: 4 },
  categoryOptionText: { ...typography.captionStrong, color: colors.textSecondary, textAlign: 'center' },
  selectedCategoryOptionText: { color: colors.onPrimary },
  coordinatesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  coordinatesText: { ...typography.caption, color: colors.textSecondary },
  amenitiesSection: { marginBottom: 20 },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityOption: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    minHeight: 36,
    justifyContent: 'center',
  },
  selectedAmenityOption: { backgroundColor: colors.primary, borderColor: colors.primary },
  amenityOptionText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  selectedAmenityOptionText: { color: colors.onPrimary },
  customAmenityContainer: { marginTop: 16, gap: 8 },
  addAmenityButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  addAmenityButtonText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: colors.white },
  submitButton: { marginTop: 8 },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
