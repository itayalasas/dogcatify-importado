import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Building, Camera, MapPin, Phone, Mail, FileText } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { NotificationService } from '@/utils/notifications';

const replicateMercadoPagoConfig = async (userId: string) => {
  try {
    console.log('Checking for existing Mercado Pago configuration for user:', userId);
    
    // Find any existing business from this user with Mercado Pago configured
    const { data: existingPartners, error } = await supabaseClient
      .from('partners')
      .select('*')
      .eq('user_id', userId)
      .eq('mercadopago_connected', true)
      .limit(1);
    
    if (error) {
      console.error('Error checking existing partners:', error);
      return;
    }
    
    if (existingPartners && existingPartners.length > 0) {
      const sourcePartner = existingPartners[0];
      console.log('Found existing partner with MP config:', sourcePartner.business_name);
      
      if (sourcePartner.mercadopago_config) {
        console.log('Replicating Mercado Pago configuration to new business...');
        
        // Get the newly created partner (last one created by this user)
        const { data: newPartners, error: newPartnerError } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (newPartnerError || !newPartners || newPartners.length === 0) {
          console.error('Error finding new partner:', newPartnerError);
          return;
        }
        
        const newPartner = newPartners[0];
        
        // Replicate the Mercado Pago configuration
        const { error: updateError } = await supabaseClient
          .from('partners')
          .update({
            mercadopago_connected: true,
            mercadopago_config: sourcePartner.mercadopago_config,
            commission_percentage: sourcePartner.commission_percentage || 5.0,
            updated_at: new Date().toISOString()
          })
          .eq('id', newPartner.id);
        
        if (updateError) {
          console.error('Error replicating MP config:', updateError);
        } else {
          console.log('Mercado Pago configuration replicated successfully to:', newPartner.business_name);
        }
      }
    } else {
      console.log('No existing Mercado Pago configuration found for user');
    }
  } catch (error) {
    console.error('Error in replicateMercadoPagoConfig:', error);
    // Don't throw error to avoid breaking the registration process
  }
};

const businessTypes = [
  { id: 'veterinary', name: 'Veterinaria', icon: '🏥', description: 'Servicios médicos para mascotas' },
  { id: 'grooming', name: 'Peluquería', icon: '✂️', description: 'Servicios de estética y cuidado' },
  { id: 'walking', name: 'Paseador', icon: '🚶', description: 'Servicios de paseo y ejercicio' },
  { id: 'boarding', name: 'Pensión', icon: '🏠', description: 'Hospedaje temporal para mascotas' },
  { id: 'shop', name: 'Tienda', icon: '🛍️', description: 'Venta de productos para mascotas' },
  { id: 'shelter', name: 'Refugio', icon: '🐾', description: 'Adopción y rescate de mascotas' },
];

export default function PartnerRegister() {
  const { currentUser } = useAuth();
  const [selectedType, setSelectedType] = useState<string>('');
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [logo, setLogo] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setLogo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        setLogo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const handleSelectLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLogo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleSelectImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const uploadDocument = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `partner-documents/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      // Create the bucket if it doesn't exist
      try {
        const { data: buckets } = await supabaseClient.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === 'dogcatify');
        
        if (!bucketExists) {
          console.log('Creating dogcatify bucket...');
          const { error: createError } = await supabaseClient.storage.createBucket('dogcatify', {
            public: true
          });
          
          if (createError) {
            console.error('Error creating bucket:', createError);
          }
        }
      } catch (bucketError) {
        console.error('Error checking/creating bucket:', bucketError);
      }
      
      // Upload the file
      const formData = new FormData();
      formData.append('file', {
        uri,
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
      
      // Get the public URL
      const { data: { publicUrl } } = supabaseClient.storage
        .from('dogcatify')
        .getPublicUrl(filename);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  };

  const uploadImage = async (imageUri: string, path: string): Promise<string> => {
    try {
      console.log(`Uploading image to path: ${path}`);
      
      // Fetch the image as a blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      console.log(`Image blob size: ${blob.size} bytes`);
      console.log(`Using Supabase URL: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
      
      // Use the existing 'dogcatify' bucket instead of 'partner-assets'
      const { data, error } = await supabaseClient.storage
        .from('dogcatify')
        .upload(path, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

      if (error) {
        console.error('Error uploading image:', error);
        throw error;
      }

      // Get the public URL
      const { data: urlData } = supabaseClient.storage
        .from('dogcatify')
        .getPublicUrl(path);
      
      const publicUrl = urlData.publicUrl;
      console.log(`Generated public URL: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!selectedType || !businessName || !description || !address || !phone) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    setLoading(true);
    try {
      // Upload logo if selected
      let logoUrl = null;
      if (logo) {
        logoUrl = await uploadImage(logo, `partners/${currentUser.id}/${Date.now()}_logo.jpg`);
      }

      // Upload gallery images
      const imageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const imageUrl = await uploadImage(images[i], `partners/${currentUser.id}/gallery/${Date.now()}_${i}.jpg`);
        imageUrls.push(imageUrl);
      }

      // Create partner request
      const { error } = await supabaseClient
        .from('partners')
        .insert({
          user_id: currentUser.id,
          business_name: businessName.trim(),
          business_type: selectedType,
          description: description.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          logo: logoUrl,
          images: imageUrls,
          is_active: true,
          is_verified: false,
          rating: 0,
          reviews_count: 0,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Check if user has other businesses with Mercado Pago configured
      await replicateMercadoPagoConfig(currentUser.id);
      // Update user profile to be a partner
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .update({
          is_partner: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

      // Send partner registration confirmation email
      try {
        Alert.alert(
          'Registro exitoso',
          'Tu solicitud para ser aliado ha sido enviada. Te notificaremos cuando sea aprobada.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } catch (error) {
        console.error('Error registering partner:', error);
        Alert.alert('Error', 'No se pudo completar el registro');
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error registering partner:', error);
      Alert.alert('Error', 'No se pudo completar el registro');
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
        <Text style={styles.title}>Convertirse en Aliado</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.introCard}>
          <Text style={styles.introTitle}>🤝 Únete como Aliado</Text>
          <Text style={styles.introDescription}>
            Ofrece tus servicios a la comunidad de Patitas y haz crecer tu negocio
          </Text>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Tipo de Negocio</Text>
          <View style={styles.businessTypes}>
            {businessTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.businessType,
                  selectedType === type.id && styles.selectedBusinessType
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Text style={styles.businessTypeIcon}>{type.icon}</Text>
                <Text style={[
                  styles.businessTypeName,
                  selectedType === type.id && styles.selectedBusinessTypeName
                ]}>
                  {type.name}
                </Text>
                <Text style={styles.businessTypeDescription}>{type.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Nombre del negocio *"
            placeholder="Ej: Veterinaria San Martín"
            value={businessName}
            onChangeText={setBusinessName}
            leftIcon={<Building size={20} color="#6B7280" />}
          />

          <Input
            label="Descripción *"
            placeholder="Describe tu negocio y servicios..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            leftIcon={<FileText size={20} color="#6B7280" />}
          />

          <Input
            label="Dirección *"
            placeholder="Dirección completa del negocio"
            value={address}
            onChangeText={setAddress}
            leftIcon={<MapPin size={20} color="#6B7280" />}
          />

          <Input
            label="Teléfono *"
            placeholder="Número de contacto"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon={<Phone size={20} color="#6B7280" />}
          />

          <Input
            label="Email de contacto *"
            placeholder="email@negocio.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={20} color="#6B7280" />}
          />

          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Logo del negocio</Text>
            <TouchableOpacity style={styles.logoSelector} onPress={handleSelectLogo}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.logoPreview} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Camera size={32} color="#9CA3AF" />
                  <Text style={styles.logoPlaceholderText}>Seleccionar logo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Galería de imágenes (máx. 5)</Text>
            <TouchableOpacity style={styles.gallerySelector} onPress={handleSelectImages}>
              <Camera size={24} color="#3B82F6" />
              <Text style={styles.gallerySelectorText}>Agregar imágenes</Text>
            </TouchableOpacity>
            
            {images.length > 0 && (
              <ScrollView horizontal style={styles.imagePreview} showsHorizontalScrollIndicator={false}>
                {images.map((image, index) => (
                  <Image key={index} source={{ uri: image }} style={styles.previewImage} />
                ))}
              </ScrollView>
            )}
          </View>

          <Button
            title="Enviar Solicitud"
            onPress={handleSubmit}
            loading={loading}
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
  introCard: {
    margin: 16,
    marginBottom: 8,
  },
  introTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  introDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  formCard: {
    margin: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  businessTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  businessType: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedBusinessType: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
  },
  businessTypeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  businessTypeName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  selectedBusinessTypeName: {
    color: '#3B82F6',
  },
  businessTypeDescription: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  imageSection: {
    marginBottom: 20,
  },
  logoSelector: {
    alignItems: 'center',
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logoPlaceholder: {
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
  logoPlaceholderText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  gallerySelector: {
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
  gallerySelectorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 8,
  },
  imagePreview: {
    flexDirection: 'row',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
});