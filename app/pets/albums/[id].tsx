import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Camera, Trash2, Share, X, CreditCard as Edit } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

export default function AlbumDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchAlbumDetails();
  }, [id]);

  const fetchAlbumDetails = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pet_albums')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        // Process image URLs to ensure they're complete
        let processedImages = data.images || [];
        if (processedImages.length > 0) {
          processedImages = processedImages.map((img: string) => {
            if (img && img.startsWith('/storage/v1/object/public/')) {
              const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
              return `${supabaseUrl}${img}`;
            }
            return img;
          });
        }
        
        setAlbum({
          ...data,
          images: processedImages,
          createdAt: new Date(data.created_at)
        });
        
        setTitle(data.title || '');
        setDescription(data.description || '');
        setIsShared(data.is_shared || false);
      }
    } catch (error) {
      console.error('Error fetching album details:', error);
      Alert.alert('Error', 'No se pudo cargar la información del álbum');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPhotos = async () => {
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
        setSelectedImages(result.assets);
      }
    } catch (error) {
      console.error('Error selecting photos:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las fotos');
    }
  };

  const uploadImageToStorage = async (imageAsset: ImagePicker.ImagePickerAsset): Promise<string> => {
    try {
      // Create a folder structure
      const filename = `pets/albums/${album.pet_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        
      const formData = new FormData();
      formData.append('file', {
        uri: imageAsset.uri,
        type: 'image/jpeg',
        name: filename,
      } as any);
        
      const { data, error } = await supabaseClient.storage
        .from('dogcatify')
        .upload(filename, formData, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabaseClient.storage
        .from('dogcatify')
        .getPublicUrl(filename);
        
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleAddPhotos = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('Error', 'Por favor selecciona al menos una foto');
      return;
    }

    setUploadingImages(true);
    try {
      // Upload all images to storage
      const uploadPromises = selectedImages.map(image => uploadImageToStorage(image));
      const imageUrls = await Promise.all(uploadPromises);

      // Get current images
      const currentImages = album.images || [];
      
      // Update album with new images
      const { error } = await supabaseClient
        .from('pet_albums')
        .update({
          images: [...currentImages, ...imageUrls]
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setAlbum({
        ...album,
        images: [...currentImages, ...imageUrls]
      });
      
      setSelectedImages([]);
      Alert.alert('Éxito', 'Fotos agregadas correctamente');
    } catch (error) {
      console.error('Error adding photos:', error);
      Alert.alert('Error', 'No se pudieron agregar las fotos');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleUpdateAlbum = async () => {
    try {
      const { error } = await supabaseClient
        .from('pet_albums')
        .update({
          title: title.trim() || 'Álbum sin título',
          description: description.trim() || '',
          is_shared: isShared
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setAlbum({
        ...album,
        title: title.trim() || 'Álbum sin título',
        description: description.trim() || '',
        is_shared: isShared
      });
      
      setShowEditModal(false);
      Alert.alert('Éxito', 'Álbum actualizado correctamente');
    } catch (error) {
      console.error('Error updating album:', error);
      Alert.alert('Error', 'No se pudo actualizar el álbum');
    }
  };

  const handleDeleteAlbum = async () => {
    try {
      const { error } = await supabaseClient
        .from('pet_albums')
        .delete()
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Éxito', 'Álbum eliminado correctamente', [
        { 
          text: 'OK', 
          onPress: () => {
            router.push({
              pathname: `/pets/${album.pet_id}`,
              params: { refresh: 'true', activeTab: 'albums' }
            });
          } 
        }
      ]);
    } catch (error) {
      console.error('Error deleting album:', error);
      Alert.alert('Error', 'No se pudo eliminar el álbum');
    }
  };

  const confirmDeleteImage = (imageUrl: string) => {
    setImageToDelete(imageUrl);
    setShowDeleteConfirm(true);
  };

  const handleDeleteImage = async () => {
    if (!imageToDelete) return;
    
    try {
      // Filter out the image to delete
      const updatedImages = album.images.filter((img: string) => img !== imageToDelete);
      
      // Update album with new images array
      const { error } = await supabaseClient
        .from('pet_albums')
        .update({
          images: updatedImages
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setAlbum({
        ...album,
        images: updatedImages
      });
      
      setImageToDelete(null);
      setShowDeleteConfirm(false);
      Alert.alert('Éxito', 'Imagen eliminada correctamente');
    } catch (error) {
      console.error('Error deleting image:', error);
      Alert.alert('Error', 'No se pudo eliminar la imagen');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando álbum...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!album) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontró el álbum</Text>
          <Button title="Volver" onPress={() => router.back()} />
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
        <Text style={styles.title}>{album.title || 'Álbum sin título'}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowEditModal(true)} style={styles.editButton}>
            <Edit size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => Alert.alert(
              'Eliminar Álbum', 
              '¿Estás seguro de que quieres eliminar este álbum?',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: handleDeleteAlbum }
              ]
            )} 
            style={styles.deleteButton}
          >
            <Trash2 size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {album.description && (
          <Card style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>{album.description}</Text>
          </Card>
        )}

        <View style={styles.addPhotosSection}>
          <TouchableOpacity style={styles.addPhotosButton} onPress={handleSelectPhotos}>
            <Camera size={24} color="#3B82F6" />
            <Text style={styles.addPhotosText}>Agregar Fotos</Text>
          </TouchableOpacity>
          
          {selectedImages.length > 0 && (
            <View style={styles.selectedPhotosContainer}>
              <Text style={styles.selectedPhotosTitle}>
                Fotos seleccionadas ({selectedImages.length}):
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedPhotosScroll}>
                {selectedImages.map((image, index) => (
                  <View key={index} style={styles.selectedPhotoContainer}>
                    <Image source={{ uri: image.uri }} style={styles.selectedPhoto} />
                    <TouchableOpacity 
                      style={styles.removeSelectedPhoto}
                      onPress={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                    >
                      <X size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              
              <Button
                title="Agregar a Álbum"
                onPress={handleAddPhotos}
                loading={uploadingImages}
                size="medium"
              />
            </View>
          )}
        </View>

        <View style={styles.photosGrid}>
          {album.images && album.images.map((imageUrl: string, index: number) => (
            <View key={index} style={styles.photoContainer}>
              <Image source={{ uri: imageUrl }} style={styles.photo} />
              <TouchableOpacity 
                style={styles.deletePhotoButton}
                onPress={() => confirmDeleteImage(imageUrl)}
              >
                <Trash2 size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Edit Album Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Álbum</Text>
            
            <Input
              label="Título del álbum"
              placeholder="Ej: Primer día en casa, Cumpleaños..."
              value={title}
              onChangeText={setTitle}
            />

            <Input
              label="Descripción"
              placeholder="Describe este momento especial..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.shareOption}>
              <Text style={styles.shareOptionLabel}>Compartir en el feed</Text>
              <TouchableOpacity 
                style={[styles.shareToggle, isShared && styles.shareToggleActive]}
                onPress={() => setIsShared(!isShared)}
              >
                <View style={[styles.shareToggleHandle, isShared && styles.shareToggleHandleActive]} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={() => setShowEditModal(false)}
                variant="outline"
                size="medium"
              />
              <Button
                title="Guardar Cambios"
                onPress={handleUpdateAlbum}
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmTitle}>Eliminar Imagen</Text>
            <Text style={styles.confirmText}>¿Estás seguro de que quieres eliminar esta imagen?</Text>
            
            <View style={styles.confirmActions}>
              <Button
                title="Cancelar"
                onPress={() => setShowDeleteConfirm(false)}
                variant="outline"
                size="small"
              />
              <Button
                title="Eliminar"
                onPress={handleDeleteImage}
                variant="primary"
                size="small"
              />
            </View>
          </View>
        </View>
      </Modal>
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
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  editButton: {
    padding: 8,
    marginRight: 4,
  },
  deleteButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  descriptionCard: {
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  addPhotosSection: {
    marginBottom: 16,
  },
  addPhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
  },
  addPhotosText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 8,
  },
  selectedPhotosContainer: {
    marginTop: 16,
  },
  selectedPhotosTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginBottom: 8,
  },
  selectedPhotosScroll: {
    marginBottom: 16,
  },
  selectedPhotoContainer: {
    position: 'relative',
    marginRight: 8,
  },
  selectedPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeSelectedPhoto: {
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
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoContainer: {
    width: '48%',
    marginBottom: 16,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  deletePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  shareOptionLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  shareToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    padding: 2,
  },
  shareToggleActive: {
    backgroundColor: '#3B82F6',
  },
  shareToggleHandle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  shareToggleHandleActive: {
    transform: [{ translateX: 22 }],
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});