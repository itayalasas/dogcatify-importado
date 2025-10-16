import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Platform, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Camera, Upload, X, Share2 } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabaseClient } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { detectPetInImage, validateImagesForPets } from '../../../../utils/petDetection';
import { uploadImage } from '../../../../utils/imageUpload';

export default function AddPhoto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoDescription, setPhotoDescription] = useState('');
  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [validatingImages, setValidatingImages] = useState(false);

  const handleSelectPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para usar la cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const uploadImageToStorage = async (imageAsset: ImagePicker.ImagePickerAsset): Promise<string> => {
    try {
      console.log('Starting upload for image:', imageAsset.uri);

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const filename = `pets/albums/${id}/${timestamp}-${randomId}.jpg`;

      console.log('Upload filename:', filename);

      const publicUrl = await uploadImage(imageAsset.uri, filename);
      console.log('Public URL generated:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);

      if (error.message?.includes('Network request failed')) {
        throw new Error('Error de conexión. Verifica tu conexión a internet e intenta nuevamente.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('La subida tardó demasiado. Intenta con imágenes más pequeñas.');
      } else {
        throw new Error(`Error al subir imagen: ${error.message || 'Error desconocido'}`);
      }
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

    setLoading(true);
    try {
      console.log('Starting to save photos, total images:', selectedImages.length);
      
      // Upload images one by one to avoid overwhelming the connection
      const imageUrls: string[] = [];
      
      console.log('Starting sequential uploads...');
      for (let i = 0; i < selectedImages.length; i++) {
        try {
          console.log(`Uploading image ${i + 1} of ${selectedImages.length}...`);
          const imageUrl = await uploadImageToStorage(selectedImages[i]);
          imageUrls.push(imageUrl);
          console.log(`Image ${i + 1} uploaded successfully:`, imageUrl);
          
          // Pequeña pausa entre subidas para evitar saturar la conexión
          if (i < selectedImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (uploadError) {
          console.error(`Error uploading image ${i + 1}:`, uploadError);
          
          // Mostrar opción de continuar o cancelar
          const shouldContinue = await new Promise((resolve) => {
            Alert.alert(
              'Error al subir imagen',
              `No se pudo subir la imagen ${i + 1} de ${selectedImages.length}.\n\nError: ${uploadError.message}\n\n¿Deseas continuar con las imágenes restantes?`,
              [
                {
                  text: 'Cancelar todo',
                  style: 'cancel',
                  onPress: () => resolve(false)
                },
                {
                  text: 'Continuar',
                  onPress: () => resolve(true)
                }
              ]
            );
          });
          
          if (!shouldContinue) {
            throw new Error('Subida cancelada por el usuario');
          }
          
          // Continuar con la siguiente imagen
          continue;
        }
      }
      
      // Verificar que al menos una imagen se subió exitosamente
      if (imageUrls.length === 0) {
        throw new Error('No se pudo subir ninguna imagen. Verifica tu conexión e intenta nuevamente.');
      }
      
      console.log(`Successfully uploaded ${imageUrls.length} of ${selectedImages.length} images`);

      // Prepare success message
      const successMessage = imageUrls.length === selectedImages.length
        ? `Se guardaron exitosamente ${imageUrls.length} foto(s) en el álbum`
        : `Se guardaron ${imageUrls.length} de ${selectedImages.length} foto(s). Algunas imágenes no se pudieron subir.`;

      console.log('Saving album to database...');
      // Save album to database
      const albumResult = await supabaseClient
        .from('pet_albums')
        .insert({
          pet_id: id,
          owner_id: currentUser.id,
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
          
          // Get current user data for author info
          const { data: userData, error: userError } = await supabaseClient
            .from('profiles')
            .select('display_name, photo_url')
            .eq('id', currentUser.id)
            .single();
          
          if (userError) {
            console.error('Error fetching user data:', userError);
          }
          
          // Get the album ID from the insert result
          const { data: createdAlbum, error: albumFetchError } = await supabaseClient
            .from('pet_albums')
            .select('id')
            .eq('pet_id', id)
            .eq('owner_id', currentUser.id)
            .eq('title', photoTitle.trim() || 'Álbum sin título')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          const albumId = createdAlbum?.id;
          
          // Create post with complete author information
          const postData = {
            user_id: currentUser.id,
            pet_id: id,
            content: photoDescription || `Nuevas fotos de ${petData.name} 📸`,
            image_url: imageUrls[0],
            album_images: imageUrls,
            type: 'album',
            album_id: albumId, // Reference to the album
            author: {
              name: userData?.display_name || currentUser.displayName || 'Usuario',
              avatar: userData?.photo_url || currentUser.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100'
            },
            pet: {
              name: petData.name,
              species: petData.species === 'dog' ? 'Perro' : 'Gato'
            },
            likes: [],
            created_at: new Date().toISOString()
          };
          
          console.log('Creating post with data:', postData);
          
          const postResult = await supabaseClient
            .from('posts')
            .insert(postData);
            
          if (postResult.error) {
            console.error('Error creating post:', postResult.error);
            Alert.alert(
              'Advertencia',
              'Las fotos se guardaron correctamente, pero no se pudo compartir en el feed. ¿Deseas intentar compartir manualmente más tarde?',
              [{ text: 'Entendido' }]
            );
          } else {
            console.log('Post created successfully');
            Alert.alert(
              '¡Éxito!',
              `${successMessage}\n\n📸 Las fotos también se compartieron en el feed para que otros usuarios puedan verlas.`,
              [{ text: 'Perfecto' }]
            );
          }
        }
      } else {
        // Si no se comparte, solo mostrar mensaje de éxito normal
        Alert.alert('¡Éxito!', successMessage);
      }

      router.push({
        pathname: `/pets/${id}`,
        params: { refresh: 'true', activeTab: 'albums' }
      });
    } catch (error) {
      console.error('Error saving photos:', error);
      
      let errorMessage = 'No se pudieron guardar las fotos';
      if (error.message?.includes('conexión')) {
        errorMessage = 'Error de conexión. Verifica tu internet e intenta nuevamente.';
      } else if (error.message?.includes('cancelada')) {
        errorMessage = 'Subida cancelada por el usuario.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
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