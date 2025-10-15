import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, MapPin, Star, Phone, Camera } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';

const CATEGORIES = [
  { id: 'parques', name: 'Parques', icon: '🌳' },
  { id: 'restaurantes', name: 'Restaurantes', icon: '🍽️' },
  { id: 'hoteles', name: 'Hoteles', icon: '🏨' },
  { id: 'tiendas', name: 'Tiendas', icon: '🏪' },
  { id: 'playas', name: 'Playas', icon: '🏖️' },
  { id: 'cafeterias', name: 'Cafeterías', icon: '☕' },
  { id: 'veterinarias', name: 'Veterinarias', icon: '🏥' },
];

const DEFAULT_AMENITIES = [
  'Área para perros',
  'Agua para mascotas',
  'Correas disponibles',
  'Menú pet-friendly',
  'Camas para mascotas',
  'Juguetes disponibles',
  'Servicio de baño',
  'Área de juegos',
  'Veterinario en sitio',
  'Guardería de mascotas',
];

export default function AddPlace() {
  const { currentUser } = useAuth();
  
  // Form state
  const [placeName, setPlaceName] = useState('');
  const [placeCategory, setPlaceCategory] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placePhone, setPlacePhone] = useState('');
  const [placeRating, setPlaceRating] = useState(5);
  const [placeDescription, setPlaceDescription] = useState('');
  const [placeImage, setPlaceImage] = useState<string | null>(null);
  const [placeAmenities, setPlaceAmenities] = useState<string[]>([]);
  const [placeLatitude, setPlaceLatitude] = useState('');
  const [placeLongitude, setPlaceLongitude] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPlaceImage(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permisos requeridos', 'Se necesitan permisos para usar la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPlaceImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
    const filename = `places/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    return uploadImageUtil(imageUri, filename);
  };

  const handleSubmit = async () => {
    if (!placeName || !placeCategory || !placeAddress || !placeDescription) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Debes estar autenticado para agregar un lugar');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = null;
      if (placeImage) {
        imageUrl = await uploadImage(placeImage);
      }

      const placeData = {
        name: placeName.trim(),
        category: placeCategory,
        address: placeAddress.trim(),
        phone: placePhone.trim() || null,
        rating: placeRating,
        description: placeDescription.trim(),
        pet_amenities: placeAmenities,
        image_url: imageUrl,
        coordinates: {
          latitude: parseFloat(placeLatitude) || 0,
          longitude: parseFloat(placeLongitude) || 0,
        },
        is_active: false, // Los lugares agregados por usuarios necesitan aprobación
        created_by: currentUser.id,
      };

      const { error } = await supabaseClient
        .from('places')
        .insert([placeData]);
      
      if (error) throw error;

      Alert.alert(
        '¡Gracias por tu contribución!', 
        'Tu lugar ha sido enviado para revisión. Una vez aprobado, aparecerá en la lista de lugares pet-friendly.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving place:', error);
      Alert.alert('Error', 'No se pudo guardar el lugar. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setPlaceAmenities(prev =>
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.icon || '📍';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Agregar Lugar Pet-Friendly</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>🐾 Contribuye a la Comunidad</Text>
          <Text style={styles.infoDescription}>
            Ayuda a otros dueños de mascotas agregando lugares que acepten y sean amigables con las mascotas
          </Text>
        </Card>

        <Card style={styles.formCard}>
          <Input
            label="Nombre del lugar *"
            placeholder="Ej: Parque Central, Café Luna, Hotel Pet Paradise..."
            value={placeName}
            onChangeText={setPlaceName}
          />

          <View style={styles.categorySection}>
            <Text style={styles.categoryLabel}>Categoría *</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryOption,
                    placeCategory === category.id && styles.selectedCategory
                  ]}
                  onPress={() => setPlaceCategory(category.id)}
                >
                  <Text style={styles.categoryOptionIcon}>{category.icon}</Text>
                  <Text style={[
                    styles.categoryOptionText,
                    placeCategory === category.id && styles.selectedCategoryText
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <Input
            label="Dirección *"
            placeholder="Dirección completa del lugar"
            value={placeAddress}
            onChangeText={setPlaceAddress}
            leftIcon={<MapPin size={20} color="#6B7280" />}
          />
          
          <Input
            label="Teléfono"
            placeholder="Número de contacto (opcional)"
            value={placePhone}
            onChangeText={setPlacePhone}
            leftIcon={<Phone size={20} color="#6B7280" />}
          />

          <View style={styles.coordinatesSection}>
            <Text style={styles.coordinatesLabel}>Coordenadas GPS (opcional)</Text>
            <Text style={styles.coordinatesDescription}>
              Si conoces las coordenadas exactas, ayúdanos a ubicar mejor el lugar
            </Text>
            <View style={styles.coordinatesRow}>
              <View style={styles.coordinateInput}>
                <Input
                  label="Latitud"
                  placeholder="Ej: 4.6097"
                  value={placeLatitude}
                  onChangeText={setPlaceLatitude}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.coordinateInput}>
                <Input
                  label="Longitud"
                  placeholder="Ej: -74.0817"
                  value={placeLongitude}
                  onChangeText={setPlaceLongitude}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>¿Qué tan pet-friendly es? *</Text>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setPlaceRating(star)}
                >
                  <Star
                    size={32}
                    color={star <= placeRating ? "#FCD34D" : "#E5E7EB"}
                    fill={star <= placeRating ? "#FCD34D" : "transparent"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingDescription}>
              {placeRating === 1 && "Acepta mascotas básicamente"}
              {placeRating === 2 && "Acepta mascotas con algunas restricciones"}
              {placeRating === 3 && "Bastante amigable con mascotas"}
              {placeRating === 4 && "Muy pet-friendly"}
              {placeRating === 5 && "¡Excelente para mascotas!"}
            </Text>
          </View>
          
          <Input
            label="Descripción *"
            placeholder="Describe por qué este lugar es pet-friendly, qué servicios ofrece para mascotas, etc."
            value={placeDescription}
            onChangeText={setPlaceDescription}
            multiline
            numberOfLines={4}
          />

          <View style={styles.imageSection}>
            <Text style={styles.imageLabel}>Foto del lugar (opcional)</Text>
            
            {placeImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: placeImage }} style={styles.selectedImage} />
                <View style={styles.imageActions}>
                  <TouchableOpacity 
                    style={styles.changeImageButton}
                    onPress={() => setPlaceImage(null)}
                  >
                    <Text style={styles.changeImageText}>Quitar imagen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.imageActions}>
                <TouchableOpacity style={styles.imageActionButton} onPress={handleTakePhoto}>
                  <Camera size={24} color="#3B82F6" />
                  <Text style={styles.imageActionText}>Tomar foto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageActionButton} onPress={handleSelectImage}>
                  <Text style={styles.imageActionText}>📷 Galería</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.amenitiesSection}>
            <Text style={styles.amenitiesLabel}>Servicios para mascotas</Text>
            <Text style={styles.amenitiesDescription}>
              Selecciona los servicios que este lugar ofrece para mascotas
            </Text>
            <View style={styles.amenitiesGrid}>
              {DEFAULT_AMENITIES.map((amenity) => (
                <TouchableOpacity
                  key={amenity}
                  style={[
                    styles.amenityOption,
                    placeAmenities.includes(amenity) && styles.selectedAmenity
                  ]}
                  onPress={() => toggleAmenity(amenity)}
                >
                  <Text style={[
                    styles.amenityOptionText,
                    placeAmenities.includes(amenity) && styles.selectedAmenityText
                  ]}>
                    {amenity}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.submitSection}>
            <Button
              title={loading ? "Enviando..." : "Enviar para Revisión"}
              onPress={handleSubmit}
              loading={loading}
              size="large"
            />
            <Text style={styles.submitNote}>
              Tu lugar será revisado por nuestro equipo antes de aparecer públicamente
            </Text>
          </View>
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
  infoCard: {
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 20,
  },
  infoTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  formCard: {
    marginBottom: 16,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: 80,
  },
  selectedCategory: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  categoryOptionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  categoryOptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  coordinatesSection: {
    marginBottom: 16,
  },
  coordinatesLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 4,
  },
  coordinatesDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  coordinatesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coordinateInput: {
    flex: 1,
  },
  ratingSection: {
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 12,
  },
  ratingStars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    textAlign: 'center',
  },
  imageSection: {
    marginBottom: 16,
  },
  imageLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  imagePreviewContainer: {
    marginBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 12,
  },
  changeImageButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  changeImageText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  imageActionButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  imageActionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  amenitiesSection: {
    marginBottom: 20,
  },
  amenitiesLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 4,
  },
  amenitiesDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityOption: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedAmenity: {
    backgroundColor: '#2D6A6F',
    borderColor: '#2D6A6F',
  },
  amenityOptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedAmenityText: {
    color: '#FFFFFF',
  },
  submitSection: {
    alignItems: 'center',
  },
  submitNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});