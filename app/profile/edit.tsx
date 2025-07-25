import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Camera, Upload, User, Phone, MapPin, Mail } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';

export default function EditProfile() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  
  // Form state
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(currentUser?.photoURL || null);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    // Load existing user data
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setAddress(currentUser.location || '');
      setBio(currentUser.bio || '');
      setProfileImage(currentUser.photoURL || null);
    }
  }, [currentUser]);

  const handleSelectPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'No se pudo seleccionar la foto');
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
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadImageToStorage = async (imageAsset: ImagePicker.ImagePickerAsset): Promise<string> => {
    try {
      setUploadingImage(true);
      const filename = `profiles/${currentUser!.id}/${Date.now()}.jpg`;
      
      try {
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
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const updateUserPostsAndComments = async (newPhotoURL: string, newDisplayName: string) => {
    try {
      console.log('Updating user posts with new data...');
      // Update all posts by this user
      const { error: postsError } = await supabaseClient
        .from('posts')
        .update({
          // Posts table doesn't have author column, it uses user_id reference
          // The author info is fetched via join with profiles table
        })
        .eq('user_id', currentUser!.id);
      
      if (postsError) {
        console.error('Error updating posts:', postsError);
      } else {
        console.log('Posts updated successfully');
      }

      console.log('Updating user comments with new data...');
      // Comments table doesn't have author column, it uses user_id reference
      // The author info is fetched via join with profiles table
      console.log('Comments use user_id reference, no direct update needed');

      console.log('Updating user pet albums with new data...');
      // Pet albums table doesn't have author column, it uses user_id reference
      // The author info is fetched via join with profiles table
      console.log('Pet albums use user_id reference, no direct update needed');

      console.log('Successfully updated all user posts and comments');
    } catch (error) {
      console.error('Error updating user posts and comments:', error);
      // Don't throw error here as profile update was successful
    }
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    console.log('Starting profile save process...');
    console.log('Current user ID:', currentUser.id);
    console.log('Display name:', displayName.trim());
    console.log('Selected image:', selectedImage ? 'Yes' : 'No');

    setLoading(true);
    try {
      let photoURL = profileImage;

      // Upload new image if selected
      if (selectedImage) {
        console.log('Uploading new image...');
        photoURL = await uploadImageToStorage(selectedImage);
        console.log('Image uploaded successfully:', photoURL);
      }

      console.log('Updating Supabase profile...');
      // Update Supabase user profile
      const { error } = await supabaseClient
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          photo_url: photoURL || null,
          phone: phone.trim() || null,
          location: address.trim() || null,
          bio: bio.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (error) {
        console.error('Supabase profile update error:', error);
        throw error;
      }
      console.log('Supabase profile updated successfully');

      console.log('Updating auth user metadata...');
      // Update auth user metadata
      const { error: authError } = await supabaseClient.auth.updateUser({
        data: {
          display_name: displayName.trim(),
          photo_url: photoURL || null,
        }
      });
      
      if (authError) {
        console.error('Auth user update error:', authError);
        // Don't throw error here as profile was already updated
      } else {
        console.log('Auth user updated successfully');
      }

      // Since posts, comments, and albums use user_id references,
      // they will automatically show updated profile info via joins
      console.log('Profile references will be updated automatically via joins');

      console.log('Profile save completed successfully');
      Alert.alert('Éxito', 'Perfil actualizado correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', `No se pudo actualizar el perfil: ${error.message || error}`);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Foto de perfil',
      'Selecciona una opción',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Tomar foto', onPress: handleTakePhoto },
        { text: 'Elegir de galería', onPress: handleSelectPhoto },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Editar Perfil</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          {/* Profile Photo Section */}
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>Foto de Perfil</Text>
            <View style={styles.photoContainer}>
              <TouchableOpacity onPress={showImageOptions} style={styles.photoButton}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.placeholderPhoto}>
                    <User size={40} color="#9CA3AF" />
                  </View>
                )}
                <View style={styles.photoOverlay}>
                  <Camera size={20} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Toca para cambiar la foto</Text>
            </View>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Básica</Text>
            
            <Input
              label="Nombre completo *"
              placeholder="Tu nombre completo"
              value={displayName}
              onChangeText={setDisplayName}
              leftIcon={<User size={20} color="#6B7280" />}
            />

            <Input
              label="Correo electrónico"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
              leftIcon={<Mail size={20} color="#6B7280" />}
              style={styles.disabledInput}
            />

            <Input
              label="Teléfono"
              placeholder="Ej: +1 234 567 8900"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              leftIcon={<Phone size={20} color="#6B7280" />}
            />

            <Input
              label="Dirección"
              placeholder="Tu dirección completa"
              value={address}
              onChangeText={setAddress}
              leftIcon={<MapPin size={20} color="#6B7280" />}
            />

            <Input
              label="Biografía"
              placeholder="Cuéntanos sobre ti y tus mascotas..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
            />
          </View>

          <Button
            title={uploadingImage ? "Subiendo foto..." : "Guardar Cambios"}
            onPress={handleSaveProfile}
            loading={loading || uploadingImage}
            size="large"
            disabled={uploadingImage}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 30, // Add padding at the top to show status bar
    paddingBottom: 20,
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
    minHeight: 60,
  },
  backButton: {
    padding: 6,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flexShrink: 1,
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
  photoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  photoContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  photoButton: {
    position: 'relative',
    marginBottom: 8,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  placeholderPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  photoHint: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  disabledInput: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
});