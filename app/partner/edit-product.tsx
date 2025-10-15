import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, DollarSign, Package, Camera, Upload, X, Tag } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';

export default function EditProduct() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { currentUser } = useAuth();
  
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState(''); 
  const [brand, setBrand] = useState('');
  const [weight, setWeight] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [petType, setPetType] = useState('');
  const [images, setImages] = useState<any[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);

  useEffect(() => {
    if (!productId) {
      Alert.alert('Error', 'ID de producto no proporcionado');
      router.back();
      return;
    }
    
    fetchProductDetails();
  }, [productId]);

  const fetchProductDetails = async () => {
    try {
      const productDoc = await getDoc(doc(db, 'partnerProducts', productId as string));
      
      if (productDoc.exists()) {
        const data = productDoc.data();
        setProductName(data.name || '');
        setDescription(data.description || '');
        setCategory(data.category || '');
        setPrice(data.price?.toString() || '');
        setStock(data.stock?.toString() || ''); 
        setBrand(data.brand || '');
        setWeight(data.weight || '');
        setSize(data.size || '');
        setColor(data.color || '');
        setAgeRange(data.ageRange || '');
        setPetType(data.petType || '');
        
        // Store existing images separately
        if (data.images && data.images.length > 0) {
          setExistingImages(data.images);
        }
        
        // Fetch partner info
        if (data.partnerId) {
          const partnerDoc = await getDoc(doc(db, 'partners', data.partnerId));
          if (partnerDoc.exists()) {
            setPartnerProfile(partnerDoc.data());
          }
        }
      } else {
        Alert.alert('Error', 'Producto no encontrado');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      Alert.alert('Error', 'No se pudo cargar la información del producto');
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
        selectionLimit: 5 - existingImages.length,
      });

      if (!result.canceled && result.assets) {
        if (images.length + existingImages.length + result.assets.length > 5) {
          Alert.alert('Límite alcanzado', 'Puedes seleccionar máximo 5 imágenes en total');
          return;
        }
        setImages(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes');
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

      if (!result.canceled && result.assets) {
        if (images.length + existingImages.length >= 5) {
          Alert.alert('Límite alcanzado', 'Puedes seleccionar máximo 5 imágenes');
          return;
        }
        setImages(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadImage = async (imageUri: string, path: string): Promise<string> => {
    return uploadImageUtil(imageUri, path);
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveProduct = async () => {
    if (!productName.trim() || !price || !stock) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    if (existingImages.length === 0 && images.length === 0) {
      Alert.alert('Error', 'Debes incluir al menos una imagen del producto');
      return;
    }

    setSaveLoading(true);
    try {
      // Upload any new images
      const newImageUrls: string[] = [];
      
      for (const image of images) {
        const imageUrl = await uploadImage(
          image.uri, 
          `partners/${partnerProfile.id}/products/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        );
        newImageUrls.push(imageUrl);
      }

      // Combine existing and new images
      const allImageUrls = [...existingImages, ...newImageUrls];

      // Update product data
      const productRef = doc(db, 'partnerProducts', productId as string);
      await updateDoc(productRef, {
        name: productName.trim(),
        description: description.trim(),
        category: category.trim(),
        price: parseFloat(price), 
        stock: parseInt(stock), 
        brand: brand.trim() || null,
        weight: weight.trim() || null,
        size: size.trim() || null,
        color: color.trim() || null,
        ageRange: ageRange.trim() || null,
        petType: petType.trim() || null,
        images: allImageUrls,
        updatedAt: new Date(),
      });

      Alert.alert('Éxito', 'Producto actualizado correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating product:', error);
      Alert.alert('Error', 'No se pudo actualizar el producto');
    } finally {
      setSaveLoading(false);
    }
  };

  const categories = [
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
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando información del producto...</Text>
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
        <Text style={styles.title}>Editar Producto</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <Input
            label="Nombre del producto *"
            placeholder="Ej: Alimento premium para perros, Juguete interactivo..."
            value={productName}
            onChangeText={setProductName}
          />

          <Input
            label="Descripción"
            placeholder="Describe detalladamente el producto..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <View style={styles.categorySection}>
            <Text style={styles.categoryLabel}>Categoría *</Text>
            <View style={styles.categories}>
              {categories.map((cat) => (
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

          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Imágenes (máx. 5) *</Text>
            
            {/* Existing Images */}
            {existingImages.length > 0 && (
              <>
                <Text style={styles.imagesSubtitle}>Imágenes actuales:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreview}>
                  {existingImages.map((imageUrl, index) => (
                    <View key={`existing-${index}`} style={styles.imageContainer}>
                      <Image source={{ uri: imageUrl }} style={styles.previewImage} />
                      <TouchableOpacity 
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveExistingImage(index)}
                      >
                        <X size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
            
            {/* New Images */}
            {images.length > 0 && (
              <>
                <Text style={styles.imagesSubtitle}>Nuevas imágenes:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreview}>
                  {images.map((image, index) => (
                    <View key={`new-${index}`} style={styles.imageContainer}>
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
            
            {/* Image Actions */}
            <View style={styles.imageActions}>
              <TouchableOpacity 
                style={[
                  styles.imageAction,
                  (images.length + existingImages.length >= 5) && styles.disabledAction
                ]} 
                onPress={handleTakePhoto}
                disabled={images.length + existingImages.length >= 5}
              >
                <Camera size={24} color={(images.length + existingImages.length >= 5) ? "#9CA3AF" : "#3B82F6"} />
                <Text style={[
                  styles.imageActionText,
                  (images.length + existingImages.length >= 5) && styles.disabledActionText
                ]}>Tomar foto</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.imageAction,
                  (images.length + existingImages.length >= 5) && styles.disabledAction
                ]} 
                onPress={handleSelectImages}
                disabled={images.length + existingImages.length >= 5}
              >
                <Upload size={24} color={(images.length + existingImages.length >= 5) ? "#9CA3AF" : "#3B82F6"} />
                <Text style={[
                  styles.imageActionText,
                  (images.length + existingImages.length >= 5) && styles.disabledActionText
                ]}>Galería</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.imageCount}>
              {images.length + existingImages.length}/5 imágenes
            </Text>
          </View>

          <Button
            title="Guardar Cambios"
            onPress={handleSaveProduct}
            loading={saveLoading}
            size="large"
            disabled={saveLoading || (!productName.trim() || !price || !stock || (existingImages.length === 0 && images.length === 0))}
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
  imagesSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 8,
    marginTop: 12,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
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
  imagePreview: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  previewImage: {
    width: 100,
    height: 100,
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
  imageCount: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280', 
    textAlign: 'center',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
});