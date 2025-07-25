import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, DollarSign, Clock, Camera, Package, Upload, X, ShoppingBag, Tag } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { launchImageLibraryAsync, launchCameraAsync, MediaTypeOptions, requestMediaLibraryPermissionsAsync, requestCameraPermissionsAsync, ImagePickerAsset } from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';

export default function AddService() {
  const { partnerId, businessType } = useLocalSearchParams<{ partnerId: string; businessType: string }>();
  const { currentUser } = useAuth();
  
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('60'); // For services
  const [stock, setStock] = useState('10'); // For products
  const [brand, setBrand] = useState(''); // For products
  const [weight, setWeight] = useState(''); // For products
  const [size, setSize] = useState(''); // For products
  const [color, setColor] = useState(''); // For products
  const [ageRange, setAgeRange] = useState(''); // For products
  const [petType, setPetType] = useState(''); // For products
  const [images, setImages] = useState<ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);

  useEffect(() => {
    if (partnerId) {
      fetchPartnerProfile();
    } else {
      console.log('No partner ID provided');
    }
  }, [partnerId]);

  const fetchPartnerProfile = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', partnerId)
        .single();
      
      if (error) {
        console.error('Error fetching partner profile:', error);
        return;
      }
      
      if (data) {
        setPartnerProfile({
          id: data.id,
          businessName: data.business_name,
          businessType: data.business_type,
          ...data
        });
      }
    } catch (error) {
      console.error('Error fetching partner profile:', error);
    }
  };

  const getServiceConfig = (type: string) => {
    switch (type) {
      case 'veterinary':
        return {
          title: 'Agregar Servicio Veterinario',
          titleIcon: '🏥',
          categories: ['Consulta', 'Vacunación', 'Cirugía', 'Emergencia', 'Diagnóstico'],
          needsDuration: true,
          needsStock: false,
          priceLabel: 'Precio de consulta'
        };
      case 'grooming':
        return {
          title: 'Agregar Servicio de Peluquería',
          titleIcon: '✂️',
          categories: ['Baño', 'Corte', 'Uñas', 'Oídos', 'Completo'],
          needsDuration: true,
          needsStock: false,
          priceLabel: 'Precio del servicio'
        };
      case 'walking':
        return {
          title: 'Agregar Servicio de Paseo',
          titleIcon: '🚶',
          categories: ['Paseo corto', 'Paseo largo', 'Ejercicio', 'Cuidado'],
          needsDuration: true,
          needsStock: false,
          priceLabel: 'Precio por hora'
        };
      case 'boarding':
        return {
          title: 'Agregar Servicio de Pensión',
          titleIcon: '🏠',
          categories: ['Diario', 'Nocturno', 'Fin de semana', 'Semanal'],
          needsDuration: false,
          needsStock: false,
          priceLabel: 'Precio por día'
        };
      case 'shop':
        return {
          title: 'Agregar Producto',
          titleIcon: '🛍️',
          categories: [
            'Comida',
            'Juguetes',
            'Accesorios',
            'Salud',
            'Higiene',
            'Camas',
            'Ropa',
            'Collares',
            'Correas',
            'Comederos',
            'Transportadoras',
            'Snacks',
            'Vitaminas',
            'Antiparasitarios',
            'Limpieza'
          ],
          needsDuration: false,
          needsStock: true,
          priceLabel: 'Precio del producto'
        };
      case 'shelter':
        return {
          title: 'Agregar Mascota en Adopción',
          titleIcon: '🐾',
          categories: ['Perro', 'Gato', 'Cachorro', 'Adulto', 'Senior'],
          needsDuration: false,
          needsStock: false,
          priceLabel: 'Costo de adopción'
        };
      default:
        return {
          title: 'Agregar Servicio',
          titleIcon: '⚙️',
          categories: ['General'],
          needsDuration: false,
          needsStock: false,
          priceLabel: 'Precio'
        };
    }
  };

  const config = getServiceConfig(businessType || '');

  const handleSelectImages = async () => {
    try {
      // Request permission
      const permissionResult = await requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permiso denegado', 'Necesitamos permiso para acceder a tu galería de fotos');
        return;
      }
      
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets) {
        setImages(prev => [...prev, ...result.assets].slice(0, 5));
      }
    } catch (error) {
      console.error('Error selecting images:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos permiso para acceder a la cámara');
        return;
      }
      
      const result = await launchCameraAsync({
        mediaTypes: MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        if (images.length >= 5) {
          Alert.alert('Límite alcanzado', 'Puedes seleccionar máximo 5 imágenes');
          return;
        }
        setImages(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadImage = async (imageUri: string, path: string): Promise<string> => {
    try {
      console.log('Starting image upload for:', imageUri);
      console.log('Upload path:', path);
      
      // Create a unique filename
      const filename = `partners/${partnerId}/services/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      console.log('Generated filename:', filename);
      
      // Fetch the image and convert to blob
      console.log('Fetching image from URI...');
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('Image converted to blob, size:', blob.size);
      
      // Upload blob to Supabase storage
      console.log('Uploading blob to Supabase storage...');
      const { data, error } = await supabaseClient.storage
        .from('dogcatify')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) {
        console.error('Supabase storage error:', error);
        throw new Error(`Storage upload failed: ${error.message}`);
      }
      
      console.log('Upload successful, data:', data);
      
      // Get the public URL
      const { data: urlData } = supabaseClient.storage
        .from('dogcatify')
        .getPublicUrl(filename);
      
      const publicUrl = urlData.publicUrl;
      console.log('Generated public URL:', publicUrl);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!serviceName || !description || !category || !price) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    if (config.needsDuration && !duration) {
      Alert.alert('Error', 'Por favor especifica la duración del servicio');
      return;
    }

    if (config.needsStock && !stock) {
      Alert.alert('Error', 'Por favor especifica el stock disponible');
      return;
    }
    
    if (images.length === 0 && businessType === 'shop') {
      Alert.alert('Error', 'Por favor agrega al menos una imagen del producto');
      return;
    }

    if (!currentUser || !partnerId) {
      Alert.alert('Error', 'Información de usuario o aliado no disponible');
      return;
    }
    
    // Validar que el tipo de negocio sea válido
    if (!businessType) {
      Alert.alert('Error', 'Tipo de negocio no especificado');
      return;
    }

    setLoading(true);
    try {
      // Upload images
      let imageUrls: string[] = [];
      
      if (images.length > 0) {
        console.log(`Subiendo ${images.length} imágenes...`);
        
        try {
          for (let i = 0; i < images.length; i++) {
            console.log(`Subiendo imagen ${i + 1} de ${images.length}...`);
            const path = `partners/${partnerId}/${businessType === 'shop' ? 'products' : 'services'}/${Date.now()}-${i}.jpg`;
            const imageUrl = await uploadImage(images[i].uri, path);
            imageUrls.push(imageUrl);
            console.log(`Imagen ${i+1} subida exitosamente`);
          }
          console.log('Todas las imágenes subidas exitosamente');
        } catch (uploadError) {
          console.error('Error durante la subida de imágenes:', uploadError);
          
          // Ofrecer opciones al usuario
          Alert.alert(
            'Error al subir imágenes',
            'No se pudieron subir las imágenes. ¿Qué deseas hacer?',
            [
              {
                text: 'Reintentar',
                onPress: () => {
                  // Reintentar la función completa
                  handleSubmit();
                  return;
                }
              },
              {
                text: 'Continuar sin imágenes',
                onPress: () => {
                  // Continuar sin imágenes
                  handleSubmitWithoutImages();
                  return;
                }
              },
              {
                text: 'Cancelar',
                style: 'cancel'
              }
            ]
          );
          return;
        }
      }

      try {
        // Determine table based on business type
        const tableName = businessType === 'shop' ? 'partner_products' : 'partner_services';
        
        console.log(`Guardando en tabla: ${tableName}`);
        
        if (businessType === 'shop') {
          // Create product data
          const productData = {
            partner_id: partnerId,
            name: serviceName.trim(),
            description: description.trim() || '',
            category: category.trim(),
            price: parseFloat(price),
            stock: parseInt(stock) || 10,
            brand: brand.trim() || null,
            weight: weight.trim() || null,
            size: size.trim() || null,
            color: color.trim() || null,
            age_range: ageRange.trim() || null,
            pet_type: petType.trim() || null,
            partner_name: partnerProfile?.businessName || 'Tienda',
            images: imageUrls,
            is_active: true,
            created_at: new Date().toISOString()
          };
          
          // Insert product into Supabase
          const { error } = await supabaseClient
            .from('partner_products')
            .insert(productData);
          
          if (error) throw error;
          
        } else {
          // Create service data
          const serviceData = {
            partner_id: partnerId,
            name: serviceName.trim(),
            description: description.trim() || '',
            category: category.trim(),
            price: parseFloat(price),
            duration: parseInt(duration) || 60,
            images: imageUrls,
            is_active: true,
            created_at: new Date().toISOString()
          };
          
          // Insert service into Supabase
          const { error } = await supabaseClient
            .from('partner_services')
            .insert(serviceData);
          
          if (error) throw error;
        }
      } catch (error) {
        console.error('Error saving to Supabase:', error);
        throw error;
      }

      Alert.alert(
        'Éxito',
        `${businessType === 'shop' ? 'Producto' : 'Servicio'} agregado correctamente`,
        [{ 
          text: 'OK', 
          onPress: () => {
            // Navigate back to the configure activities screen to see the new service
            router.push({
              pathname: '/partner/configure-activities',
              params: { 
                partnerId: partnerId,
                businessType: businessType 
              }
            });
          }
        }]
      );
    } catch (error) {
      console.error('Error adding service:', error);
      
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      Alert.alert(
        'Error al guardar', 
        `No se pudo agregar el ${businessType === 'shop' ? 'producto' : 'servicio'}.\n\nDetalle: ${errorMessage}\n\nPor favor verifica tu conexión e intenta nuevamente.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWithoutImages = async () => {
    if (!serviceName.trim() || !description.trim() || !category || !price) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    const config = getServiceConfig(businessType || '');
    if (config.needsDuration && !duration.trim()) {
      Alert.alert('Error', 'Por favor especifica la duración del servicio');
      return;
    }

    if (config.needsStock && !stock.trim()) {
      Alert.alert('Error', 'Por favor especifica el stock disponible');
      return;
    }

    if (!currentUser || !partnerId) {
      Alert.alert('Error', 'Información de usuario o aliado no disponible');
      return;
    }

    setLoading(true);
    try {
      console.log('Guardando sin imágenes...');
      
      // Determine table based on business type
      const tableName = businessType === 'shop' ? 'partner_products' : 'partner_services';
      console.log(`Guardando en tabla: ${tableName}`);
      
      if (businessType === 'shop') {
        // Create product data
        const productData = {
          partner_id: partnerId,
          name: serviceName.trim(),
          description: description.trim() || '',
          category: category.trim(),
          price: parseFloat(price),
          stock: parseInt(stock) || 10,
          brand: brand.trim() || null,
          weight: weight.trim() || null,
          size: size.trim() || null,
          color: color.trim() || null,
          age_range: ageRange.trim() || null,
          pet_type: petType.trim() || null,
          partner_name: partnerProfile?.businessName || 'Tienda',
          images: [], // Empty array for images
          is_active: true,
          created_at: new Date().toISOString()
        };
        
        const { error } = await supabaseClient
          .from('partner_products')
          .insert(productData);
        
        if (error) throw error;
        
      } else {
        // Create service data
        const serviceData = {
          partner_id: partnerId,
          name: serviceName.trim(),
          description: description.trim() || '',
          category: category.trim(),
          price: parseFloat(price),
          duration: parseInt(duration) || 60,
          images: [], // Empty array for images
          is_active: true,
          created_at: new Date().toISOString()
        };
        
        const { error } = await supabaseClient
          .from('partner_services')
          .insert(serviceData);
        
        if (error) throw error;
      }

      Alert.alert(
        'Éxito',
        `${businessType === 'shop' ? 'Producto' : 'Servicio'} agregado correctamente (sin imágenes)`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving without images:', error);
      Alert.alert('Error', `No se pudo guardar el ${businessType === 'shop' ? 'producto' : 'servicio'}`);
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
        <Text style={styles.title}>{config.title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{config.titleIcon} {config.title}</Text>
            <Text style={styles.headerSubtitle}>
              {businessType === 'shop' 
                ? 'Completa la información de tu producto para agregarlo a tu tienda'
                : 'Completa la información del servicio que ofreces a tus clientes'}
            </Text>
          </View>

          <Input
            label={businessType === 'shop' ? 'Nombre del producto *' : 'Nombre del servicio *'} 
            placeholder={businessType === 'shop' 
              ? "Ej: Alimento premium para perros, Juguete interactivo..." 
              : "Ej: Consulta general, Baño completo..."}
            value={serviceName}
            onChangeText={setServiceName}
          />

          <Input
            label="Descripción *"
            placeholder="Describe detalladamente el servicio..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <View style={styles.categorySection}>
            <Text style={styles.categoryLabel}>Categoría *</Text>
            <View style={styles.categories}>
              {config.categories.map((cat, index) => (
                <TouchableOpacity
                  key={index}
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
            label={config.priceLabel + ' *'}
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            leftIcon={<DollarSign size={20} color="#6B7280" />}
          />

          {businessType === 'shop' && (
            <>
              <Input
                label="Stock disponible *"
                placeholder="10"
                value={stock}
                onChangeText={setStock}
                keyboardType="numeric"
                leftIcon={<Package size={20} color="#6B7280" />}
              />
              
              <Input
                label="Marca"
                placeholder="Ej: Royal Canin, Pedigree, Kong..."
                value={brand}
                onChangeText={setBrand}
                leftIcon={<Tag size={20} color="#6B7280" />}
              />
              
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Input
                    label="Peso/Volumen"
                    placeholder="Ej: 1kg, 500ml"
                    value={weight}
                    onChangeText={setWeight}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Input
                    label="Tamaño"
                    placeholder="Ej: S, M, L, XL"
                    value={size}
                    onChangeText={setSize}
                  />
                </View>
              </View>
              
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Input
                    label="Color"
                    placeholder="Ej: Rojo, Azul, Negro"
                    value={color}
                    onChangeText={setColor}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Input
                    label="Edad recomendada"
                    placeholder="Ej: Cachorro, Adulto"
                    value={ageRange}
                    onChangeText={setAgeRange}
                  />
                </View>
              </View>
              
              <Input
                label="Tipo de mascota"
                placeholder="Ej: Perro, Gato, Ambos"
                value={petType}
                onChangeText={setPetType}
              />
            </>
          )}
          
          {businessType !== 'shop' && (
            <Input
              label="Duración (minutos) *" 
              placeholder="60"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              leftIcon={<Clock size={20} color="#6B7280" />}
            />
          )}

          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Imágenes (máx. 5) {businessType === 'shop' ? '*' : ''}</Text>
            <View style={styles.imageActions}>
              <TouchableOpacity style={[
                styles.imageAction,
                images.length >= 5 && styles.disabledAction
              ]} 
              onPress={handleTakePhoto}
              disabled={images.length >= 5}>
                <Camera size={24} color={images.length >= 5 ? "#9CA3AF" : "#3B82F6"} />
                <Text style={[
                  styles.imageActionText,
                  images.length >= 5 && styles.disabledActionText
                ]}>Tomar Foto</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[
                styles.imageAction,
                images.length >= 5 && styles.disabledAction
              ]} 
              onPress={handleSelectImages}
              disabled={images.length >= 5}>
                <Upload size={24} color={images.length >= 5 ? "#9CA3AF" : "#3B82F6"} />
                <Text style={[
                  styles.imageActionText,
                  images.length >= 5 && styles.disabledActionText
                ]}>Galería</Text>
              </TouchableOpacity>
            </View>
            
            {images.length > 0 && (
              <>
                <Text style={styles.selectedImagesTitle}>Imágenes seleccionadas ({images.length}/5):</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreview}>
                  {images.map((image, index) => (
                    <View key={index} style={styles.imageContainer}>
                      <Image source={{ uri: image.uri }} style={styles.previewImage} />
                      <TouchableOpacity 
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveImage(index)}
                      >
                        <X size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
            
            {images.length === 0 && (
              <View style={styles.noImagesContainer}>
                <Text style={styles.noImagesText}>
                  {businessType === 'shop' 
                    ? 'Agrega al menos una imagen de tu producto' 
                    : 'Las imágenes ayudan a mostrar tu servicio (opcional)'}
                </Text>
              </View>
            )}
            
            <Text style={styles.imageCount}>
              {images.length}/5 imágenes {businessType === 'shop' ? '(requerido)' : '(opcional)'}
            </Text>
          </View>

          <Button
            title={`Agregar ${businessType === 'shop' ? 'Producto' : 'Servicio'}`}
            onPress={handleSubmit}
            loading={loading}
            size="large" 
            disabled={loading || (businessType === 'shop' && images.length === 0)}
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
  headerInfo: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  formCard: {
    margin: 16,
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
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  imageAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    marginHorizontal: 8,
  },
  disabledAction: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  imageActionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginTop: 8,
  },
  disabledActionText: {
    color: '#9CA3AF',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  selectedImagesTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 12,
  },
  selectedImagesContainer: {
    marginTop: 8,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 8,
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
  noImagesContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  noImagesText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
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
    marginVertical: 10,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  imageCount: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  }
});