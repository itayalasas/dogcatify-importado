import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, DollarSign, Clock, Camera } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';

export default function EditService() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { currentUser } = useAuth();
  
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);

  useEffect(() => {
    if (!serviceId) {
      Alert.alert('Error', 'ID de servicio no proporcionado');
      router.back();
      return;
    }
    
    fetchServiceDetails();
  }, [serviceId]);

  const fetchServiceDetails = async () => {
    try {
      const serviceDoc = await getDoc(doc(db, 'partnerServices', serviceId));
      
      if (serviceDoc.exists()) {
        const data = serviceDoc.data();
        setServiceName(data.name || '');
        setDescription(data.description || '');
        setCategory(data.category || '');
        setPrice(data.price?.toString() || '');
        setDuration(data.duration?.toString() || '');
        setImages(data.images || []);
        
        // Fetch partner info
        if (data.partnerId) {
          const partnerDoc = await getDoc(doc(db, 'partners', data.partnerId));
          if (partnerDoc.exists()) {
            setPartnerProfile(partnerDoc.data());
          }
        }
      } else {
        Alert.alert('Error', 'Servicio no encontrado');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching service details:', error);
      Alert.alert('Error', 'No se pudo cargar la información del servicio');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages(prev => [...prev, ...newImages].slice(0, 5));
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes');
    }
  };

  const uploadImage = async (imageUri: string, path: string): Promise<string> => {
    return uploadImageUtil(imageUri, path);
  };

  const handleSaveService = async () => {
    if (!serviceName.trim() || !price || !duration) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    setSaveLoading(true);
    try {
      // Upload any new images (those that don't start with https://)
      const imageUrls: string[] = [];
      
      for (const image of images) {
        if (image.startsWith('https://')) {
          // Existing image, keep as is
          imageUrls.push(image);
        } else {
          // New image, upload it
          const imageUrl = await uploadImage(
            image, 
            `partners/${partnerProfile.id}/services/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
          );
          imageUrls.push(imageUrl);
        }
      }

      // Update service data
      const serviceRef = doc(db, 'partnerServices', serviceId);
      await updateDoc(serviceRef, {
        name: serviceName.trim(),
        description: description.trim(),
        category: category.trim(),
        price: parseFloat(price),
        duration: parseInt(duration),
        images: imageUrls,
        updatedAt: new Date(),
      });

      Alert.alert('Éxito', 'Servicio actualizado correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating service:', error);
      Alert.alert('Error', 'No se pudo actualizar el servicio');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const getBusinessTypeConfig = (type: string) => {
    switch (type) {
      case 'veterinary':
        return {
          title: 'Editar Servicio Veterinario',
          categories: ['Consulta', 'Vacunación', 'Cirugía', 'Emergencia', 'Diagnóstico'],
        };
      case 'grooming':
        return {
          title: 'Editar Servicio de Peluquería',
          categories: ['Baño', 'Corte', 'Uñas', 'Oídos', 'Completo'],
        };
      case 'walking':
        return {
          title: 'Editar Servicio de Paseo',
          categories: ['Paseo corto', 'Paseo largo', 'Ejercicio', 'Cuidado'],
        };
      case 'boarding':
        return {
          title: 'Editar Servicio de Pensión',
          categories: ['Diario', 'Nocturno', 'Fin de semana', 'Semanal'],
        };
      default:
        return {
          title: 'Editar Servicio',
          categories: ['General'],
        };
    }
  };

  const config = getBusinessTypeConfig(partnerProfile?.businessType || '');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando información del servicio...</Text>
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
        <Text style={styles.title}>{config.title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <Input
            label="Nombre del servicio *"
            placeholder="Ej: Consulta general, Baño completo..."
            value={serviceName}
            onChangeText={setServiceName}
          />

          <Input
            label="Descripción"
            placeholder="Describe detalladamente el servicio..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <View style={styles.categorySection}>
            <Text style={styles.categoryLabel}>Categoría *</Text>
            <View style={styles.categories}>
              {config.categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.selectedCategory
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[
                    styles.categoryText,
                    category === cat && styles.selectedCategoryText
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label="Precio *"
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            leftIcon={<DollarSign size={20} color="#6B7280" />}
          />

          <Input
            label="Duración (minutos) *"
            placeholder="60"
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
            leftIcon={<Clock size={20} color="#6B7280" />}
          />

          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Imágenes (máx. 5)</Text>
            <TouchableOpacity style={styles.imageSelector} onPress={handleSelectImages}>
              <Camera size={24} color="#3B82F6" />
              <Text style={styles.imageSelectorText}>Agregar imágenes</Text>
            </TouchableOpacity>
            
            {images.length > 0 && (
              <ScrollView horizontal style={styles.imagePreview} showsHorizontalScrollIndicator={false}>
                {images.map((image, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image source={{ uri: image }} style={styles.previewImage} />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <Text style={styles.removeImageText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          <Button
            title="Guardar Cambios"
            onPress={handleSaveService}
            loading={saveLoading}
            size="large"
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
  categorySection: {
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedCategory: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categoryText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  imageSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  imageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  imageSelectorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 8,
  },
  imagePreview: {
    flexDirection: 'row',
  },
  imageContainer: {
    position: 'relative',
    marginRight: 8,
  },
  previewImage: {
    width: 80,
    height: 80,
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
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});