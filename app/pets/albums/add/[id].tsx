import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Platform, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Camera, Upload, X, Share2 } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { launchImageLibraryAsync, launchCameraAsync, MediaTypeOptions, requestMediaLibraryPermissionsAsync, requestCameraPermissionsAsync, ImagePickerAsset } from 'expo-image-picker';
import { launchImageLibraryAsync, launchCameraAsync, MediaType, requestMediaLibraryPermissionsAsync, requestCameraPermissionsAsync, ImagePickerAsset } from 'expo-image-picker';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { detectPetInImage, validateImagesForPets } from '../../../../utils/petDetection';

export default function AddPhoto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoDescription, setPhotoDescription] = useState('');
  const [selectedImages, setSelectedImages] = useState<ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [validatingImages, setValidatingImages] = useState(false);

  const handleSelectPhoto = async () => {
    try {
      const permissionResult = await requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaType.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [1, 1],
        selectionLimit: 10, // Limit to 10 photos
      });

      if (!result.canceled && result.assets) {
        // Check if adding new images would exceed limit
        const totalImages = selectedImages.length + result.assets.length;
        if (totalImages > 10) {
          Alert.alert('Límite alcanzado', 'Puedes seleccionar máximo 10 fotos por álbum');
          return;
        }
        
        setValidatingImages(true);
          
        try {
          // Validate images for pet content
          const imageUris = result.assets.map(asset => asset.uri);
          const { validImages, invalidImages } = await validateImagesForPets(imageUris);
          
          if (invalidImages.length > 0) {
            Alert.alert(
              'Imágenes sin mascotas detectadas',
              `Se encontraron ${invalidImages.length} imagen(es) que no parecen contener mascotas. ¿Deseas continuar solo con las imágenes válidas?`,
              [
                {
                  text: 'Cancelar',
                  style: 'cancel'
                },
                {
                  text: 'Continuar',
                  onPress: () => {
                    const validAssets = result.assets.filter(asset => 
                      validImages.includes(asset.uri)
                    );
                    if (validAssets.length > 0) {
                      setSelectedImages(prev => [...prev, ...validAssets]);
                    }
                  }
                }
              ]
            );
          } else {
            // All images are valid
            setSelectedImages(prev => [...prev, ...result.assets]);
          }
        } catch (error) {
          console.error('Error validating images:', error);
          // If validation fails, allow all images
          setSelectedImages(prev => [...prev, ...result.assets]);
        } finally {
          setValidatingImages(false);
        }
      }
    } catch (error) {
      console.error('Error selecting photos:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las fotos');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para usar la cámara');
        return;
      }

      const result = await launchCameraAsync({
        mediaTypes: MediaType.Images,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets) {
        if (selectedImages.length >= 10) {
          Alert.alert('Límite alcanzado', 'Puedes seleccionar máximo 10 fotos por álbum');
          return;
        }
        
        setValidatingImages(true);
        
        try {
          // Validate the captured image for pet content
          const hasPet = await detectPetInImage(result.assets[0].uri);
          
          if (!hasPet) {
            Alert.alert(
              'No se detectó mascota',
              'La imagen capturada no parece contener una mascota. ¿Deseas agregarla de todos modos?',
              [
                {
                  text: 'Cancelar',
                  style: 'cancel'
                },
                {
                  text: 'Agregar',
                  onPress: () => {
                    setSelectedImages(prev => [...prev, ...result.assets]);
                  }
                }
              ]
            );
          } else {
            setSelectedImages(prev => [...prev, ...result.assets]);
          }
        } catch (error) {
          console.error('Error validating image:', error);
          // If validation fails, allow the image
          setSelectedImages(prev => [...prev, ...result.assets]);
        } finally {
          setValidatingImages(false);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
  };

  const uploadImageToStorage = async (imageAsset: ImagePickerAsset, albumId: string): Promise<string> => {
    try {
      console.log('Starting image upload for:', imageAsset.uri);
      
      // Create a unique filename
      const filename = `pets/albums/${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      
      console.log('Uploading to path:', filename);
      
      // Fetch the image and convert to blob for proper upload
      const response = await fetch(imageAsset.uri);
      const blob = await response.blob();
      
      console.log('Image converted to blob, size:', blob.size);
      
      // Upload blob to Supabase storage
      const uploadResult = await supabaseClient.storage
        .from('dogcatify')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });
      
      console.log('Upload result:', uploadResult);
      
      if (uploadResult.error) {
        console.error('Upload error:', uploadResult.error);
        throw uploadResult.error;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabaseClient.storage
        .from('dogcatify')
        .getPublicUrl(filename);
      
      console.log('Generated public URL:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const createPostFromAlbum = async (imageUrls: string[], petData: any) => {
    try {
      const { error } = await supabaseClient
         .from('posts')
         .insert({
           user_id: currentUser!.id,
           pet_id: id,
           content: photoDescription || `Nuevas fotos de ${petData.name} 📸`,
           image_url: imageUrls[0], // Use first image as main post image
           album_images: imageUrls, // Store all images for carousel
           likes: [],
           author: {
             name: currentUser!.displayName || 'Usuario',
             avatar: currentUser!.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100',
           },
           pet: {
             name: petData.name,
             species: petData.species === 'dog' ? 'Perro' : 'Gato'
           },
           type: 'album'
         });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  };


  const handleSavePhotos = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('Error', 'Por favor selecciona al menos una foto');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    // Generate unique album ID at the beginning of the function
    const albumId = `album_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    setLoading(true);
    try {
      console.log('Starting to save photos, total images:', selectedImages.length);
      
      // Upload all images to Firebase Storage
      const uploadPromises = selectedImages.map(image => uploadImageToStorage(image, albumId));
      
      console.log('Starting parallel uploads...');
      let imageUrls;
      try {
        imageUrls = await Promise.all(uploadPromises);
        console.log('All uploads completed, URLs:', imageUrls);
      } catch (uploadError) {
        console.error('Error during uploads:', uploadError);
        throw new Error('Error al subir las imágenes: ' + uploadError.message);
      }

      console.log('Saving album to database...');
      // Save album to Firestore
      const albumResult = await supabaseClient
        .from('pet_albums')
        .insert({
          pet_id: id,
          user_id: currentUser.id,
          title: photoTitle.trim() || 'Álbum sin título',
          description: photoDescription.trim() || '',
          images: imageUrls,
          is_shared: isShared,
          created_at: new Date().toISOString()
        });

      console.log('Album save result:', albumResult);
      if (albumResult.error) {
        console.error('Album save error:', albumResult.error);
        throw albumResult.error;
      }
      
      console.log('Album saved successfully');

      // If user wants to share as post, create a post
      if (isShared) {
        console.log('Creating post for shared album...');
        const { data: petData, error: petError } = await supabaseClient
          .from('pets')
          .select('*')
          .eq('id', id)
          .single();
          
        if (petData && !petError) {
          console.log('Pet data found, creating post...');
          // Crear post directamente aquí en lugar de usar una función separada
          const postResult = await supabaseClient
            .from('posts')
            .insert({
              user_id: currentUser.id,
              pet_id: id,
              content: photoDescription || `Nuevas fotos de ${petData.name} 📸`,
              image_url: imageUrls[0],
              album_images: imageUrls,
              type: 'album',
              author: {
                name: currentUser.displayName || 'Usuario',
                avatar: currentUser.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100'
              },
              pet: {
                name: petData.name,
                species: petData.species === 'dog' ? 'Perro' : 'Gato'
              }
            });
            
          if (postResult.error) {
            console.error('Error creating post:', postResult.error);
            // No lanzar error para no interrumpir el flujo principal
          } else {
            console.log('Post created successfully');
          }
        }
      }

      Alert.alert('¡Éxito!', 'Las fotos se han guardado correctamente');
      router.back();
    } catch (error) {
      console.error('Error saving photos:', error);
      Alert.alert('Error', 'No se pudieron guardar las fotos');
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
        <Text style={styles.title}>Agregar Fotos</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>📸 Seleccionar Fotos</Text>
          
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoAction} onPress={handleTakePhoto}>
              <Camera size={24} color="#3B82F6" />
              <Text style={styles.photoActionText}>Tomar Foto</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.photoAction} onPress={handleSelectPhoto}>
              <Upload size={24} color="#3B82F6" />
              <Text style={styles.photoActionText}>Desde Galería</Text>
            </TouchableOpacity>
          </View>

          {selectedImages.length > 0 && (
            <View style={styles.selectedPhotos}>
              <Text style={styles.selectedPhotosTitle}>
                Fotos seleccionadas ({selectedImages.length}/10)
                {validatingImages && ' - Validando...'}:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                {selectedImages.map((image, index) => (
                  <View key={index} style={styles.selectedPhoto}>
                    <Image source={{ uri: image.uri }} style={styles.selectedPhotoImage} />
                    <TouchableOpacity 
                      style={styles.removePhoto}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <X size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <Input
            label="Título del álbum"
            placeholder="Ej: Primer día en casa, Cumpleaños..."
            value={photoTitle}
            onChangeText={setPhotoTitle}
          />

          <Input
            label="Descripción"
            placeholder="Describe este momento especial..."
            value={photoDescription}
            onChangeText={setPhotoDescription}
            multiline
            numberOfLines={3}
          />

          <View style={styles.shareSection}>
            <TouchableOpacity 
              style={styles.shareOption} 
              onPress={() => setIsShared(!isShared)}
            >
              <View style={[styles.checkbox, isShared && styles.checkedCheckbox]}>
                {isShared && <Share2 size={16} color="#FFFFFF" />}
              </View>
              <Text style={styles.shareOptionText}>
                Compartir como publicación en el feed
              </Text>
            </TouchableOpacity>
          </View>

          <Button
            title="Guardar en Álbum"
            onPress={handleSavePhotos}
            loading={loading || validatingImages}
            size="large"
            disabled={selectedImages.length === 0 || validatingImages}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  formCard: {
    margin: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  photoAction: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#EBF8FF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    flex: 1,
    marginHorizontal: 8,
  },
  photoActionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginTop: 8,
  },
  selectedPhotos: {
    marginBottom: 24,
  },
  selectedPhotosTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 12,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  selectedPhoto: {
    position: 'relative',
    marginRight: 12,
  },
  selectedPhotoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareSection: {
    marginBottom: 24,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  shareOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    flex: 1,
  },
});