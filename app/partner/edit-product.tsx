import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, DollarSign, Package, Camera, Upload, X, Tag, Plus, ChevronRight } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { toast } from '../../components/ui/Toast';
import { FormSection } from '../../components/partner-setup/FormSection';
import { FormFooter } from '../../components/partner-setup/FormFooter';
import { FormSkeleton } from '../../components/partner-setup/FormSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';
import { generateVariantGroupId } from '../../utils/productVariants';
import { colors, radius, spacing, typography } from '../../constants/theme';

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
  const [partnerId, setPartnerId] = useState<string>('');
  const [variantGroupId, setVariantGroupId] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [showAddPresentation, setShowAddPresentation] = useState(false);
  const [newPresentation, setNewPresentation] = useState({ weight: '', price: '', stock: '10' });
  const [addingPresentation, setAddingPresentation] = useState(false);

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
      const { data, error } = await supabaseClient
        .from('partner_products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error) throw error;

      if (data) {
        setProductName(data.name || '');
        setDescription(data.description || '');
        setCategory(data.category || '');
        setPrice(data.price?.toString() || '');
        setStock(data.stock?.toString() || '');
        setBrand(data.brand || '');
        setWeight(data.weight || '');
        setSize(data.size || '');
        setColor(data.color || '');
        setAgeRange(data.age_range || '');
        setPetType(data.pet_type || '');
        setVariantGroupId(data.variant_group_id || null);
        setShowAddPresentation(false);
        setNewPresentation({ weight: '', price: '', stock: '10' });
        await loadSiblings(data.variant_group_id || null);

        // Store existing images separately
        if (data.images && data.images.length > 0) {
          setExistingImages(data.images);
        }

        // Fetch partner info
        if (data.partner_id) {
          setPartnerId(data.partner_id);
          const { data: partnerData, error: partnerError } = await supabaseClient
            .from('partners')
            .select('*')
            .eq('id', data.partner_id)
            .single();

          if (!partnerError && partnerData) {
            setPartnerProfile(partnerData);
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

  const loadSiblings = async (groupId: string | null) => {
    if (!groupId) {
      setSiblings([]);
      return;
    }

    const { data } = await supabaseClient
      .from('partner_products')
      .select('id, weight, price, stock, is_active')
      .eq('variant_group_id', groupId)
      .neq('id', productId)
      .order('price', { ascending: true });

    setSiblings(data || []);
  };

  const handleAddPresentation = async () => {
    const newWeight = newPresentation.weight.trim();
    const newPrice = parseFloat(newPresentation.price);
    const newStock = parseInt(newPresentation.stock);

    if (!weight.trim()) {
      Alert.alert('Error', 'Primero indica el peso/volumen de este producto y guarda los cambios para poder diferenciarlo de la nueva presentación');
      return;
    }

    if (!newWeight) {
      Alert.alert('Error', 'Indicá el peso/volumen de la nueva presentación (ej: 2kg)');
      return;
    }

    if (!(newPrice > 0)) {
      Alert.alert('Error', 'Indicá un precio mayor a 0 para la nueva presentación');
      return;
    }

    if (isNaN(newStock) || newStock < 0) {
      Alert.alert('Error', 'Indicá un stock válido (0 o más) para la nueva presentación');
      return;
    }

    const takenLabels = [weight, ...siblings.map((item) => item.weight || '')].map((label) => label.trim().toLowerCase());
    if (takenLabels.includes(newWeight.toLowerCase())) {
      Alert.alert('Error', 'Ya existe una presentación con ese peso/volumen');
      return;
    }

    setAddingPresentation(true);
    try {
      // Copy the saved version of this product so the new presentation shares
      // its name, images, brand, etc.
      const { data: current, error: currentError } = await supabaseClient
        .from('partner_products')
        .select('*')
        .eq('id', productId)
        .single();

      if (currentError || !current) throw currentError || new Error('PRODUCT_NOT_FOUND');

      const groupId = current.variant_group_id || generateVariantGroupId();

      if (!current.variant_group_id) {
        const { error: groupError } = await supabaseClient
          .from('partner_products')
          .update({ variant_group_id: groupId })
          .eq('id', productId);

        if (groupError) throw groupError;
      }

      const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...copy } = current;
      const { error: insertError } = await supabaseClient
        .from('partner_products')
        .insert({
          ...copy,
          variant_group_id: groupId,
          weight: newWeight,
          price: newPrice,
          stock: newStock,
          is_active: true,
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      setVariantGroupId(groupId);
      setNewPresentation({ weight: '', price: '', stock: '10' });
      setShowAddPresentation(false);
      await loadSiblings(groupId);
    } catch (error) {
      console.error('Error adding presentation:', error);
      Alert.alert('Error', 'No se pudo agregar la presentación');
    } finally {
      setAddingPresentation(false);
    }
  };

  const handleSelectImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - existingImages.length,
      });

      if (!result.canceled && result.assets) {
        if (images.length + existingImages.length + result.assets.length > 5) {
          Alert.alert('Límite alcanzado', 'Podés seleccionar máximo 5 imágenes en total');
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        if (images.length + existingImages.length >= 5) {
          Alert.alert('Límite alcanzado', 'Podés seleccionar máximo 5 imágenes');
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
      Alert.alert('Error', 'Completá todos los campos obligatorios');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    if (existingImages.length === 0 && images.length === 0) {
      Alert.alert('Error', 'Tenés que incluir al menos una imagen del producto');
      return;
    }

    setSaveLoading(true);
    try {
      // Upload any new images
      const newImageUrls: string[] = [];

      for (const image of images) {
        const imageUrl = await uploadImage(
          image.uri,
          `partners/${partnerId}/products/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        );
        newImageUrls.push(imageUrl);
      }

      // Combine existing and new images
      const allImageUrls = [...existingImages, ...newImageUrls];

      // Update product data
      const { error } = await supabaseClient
        .from('partner_products')
        .update({
          name: productName.trim(),
          description: description.trim(),
          category: category.trim(),
          price: parseFloat(price),
          stock: parseInt(stock),
          brand: brand.trim() || null,
          weight: weight.trim() || null,
          size: size.trim() || null,
          color: color.trim() || null,
          age_range: ageRange.trim() || null,
          pet_type: petType.trim() || null,
          images: allImageUrls,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (error) throw error;

      toast.success('Producto actualizado');
      router.back();
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
        <ScreenHeader title="Editar producto" />
        <FormSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={"Editar producto"} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FormSection title="Datos básicos" style={styles.firstSection}>
          <Input
            label="Nombre del producto *"
            placeholder="Ej: Alimento premium para perros, Juguete interactivo..."
            value={productName}
            onChangeText={setProductName}
          />

          <Input
            label="Descripción"
            placeholder="Describí en detalle el producto..."
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
        </FormSection>

        <FormSection title="Precio y stock">
          <Input
            label="Precio *"
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            leftIcon={<DollarSign size={20} color={colors.textTertiary} />}
          />

          <Input
            label="Stock disponible *"
            placeholder="10"
            value={stock}
            onChangeText={setStock}
            keyboardType="numeric"
            leftIcon={<Package size={20} color={colors.textTertiary} />}
          />
        </FormSection>

        <FormSection title="Detalles y presentaciones">
          <Input
            label="Marca"
            placeholder="Ej: Royal Canin, Pedigree, Kong..."
            value={brand}
            onChangeText={setBrand}
            leftIcon={<Tag size={20} color={colors.textTertiary} />}
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
          
          <View style={styles.presentationsBox}>
            <Text style={styles.presentationsTitle}>Otras presentaciones</Text>
            <Text style={styles.presentationsHint}>
              Este producto se vende también en otros pesos, cada uno con su precio y stock. Tocá una para editarla.
            </Text>

            {siblings.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.siblingRow}
                onPress={() => router.replace({ pathname: '/partner/edit-product', params: { productId: item.id } })}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Editar presentación ${item.weight || 'sin peso'}`}
              >
                <View style={styles.siblingInfo}>
                  <Text style={styles.siblingWeight}>{item.weight || 'Sin peso'}</Text>
                  <Text style={styles.siblingMeta}>
                    ${Number(item.price).toLocaleString('es-UY')} · Stock {item.stock}{item.is_active === false ? ' · Inactivo' : ''}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}

            {showAddPresentation ? (
              <View style={styles.presentationCard}>
                <View style={styles.row}>
                  <View style={styles.halfWidth}>
                    <Input
                      label="Peso/Volumen *"
                      placeholder="Ej: 2kg"
                      value={newPresentation.weight}
                      onChangeText={(value) => setNewPresentation((prev) => ({ ...prev, weight: value }))}
                    />
                  </View>
                  <View style={styles.halfWidth}>
                    <Input
                      label="Precio *"
                      placeholder="0"
                      value={newPresentation.price}
                      onChangeText={(value) => setNewPresentation((prev) => ({ ...prev, price: value }))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <Input
                  label="Stock *"
                  placeholder="10"
                  value={newPresentation.stock}
                  onChangeText={(value) => setNewPresentation((prev) => ({ ...prev, stock: value }))}
                  keyboardType="numeric"
                  leftIcon={<Package size={20} color={colors.textTertiary} />}
                />
                <View style={styles.presentationActions}>
                  <Button
                    title="Cancelar"
                    onPress={() => setShowAddPresentation(false)}
                    variant="outline"
                    size="medium"
                    style={styles.presentationActionButton}
                  />
                  <Button
                    title="Agregar"
                    onPress={handleAddPresentation}
                    loading={addingPresentation}
                    size="medium"
                    style={styles.presentationActionButton}
                  />
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addPresentationButton} onPress={() => setShowAddPresentation(true)}>
                <Plus size={18} color={colors.primary} />
                <Text style={styles.addPresentationText}>Agregar presentación</Text>
              </TouchableOpacity>
            )}
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
        </FormSection>

        <FormSection title="Fotos *" subtitle="Hasta 5 imágenes. Se necesita al menos una.">
          <View style={styles.imageSection}>
            
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
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel="Quitar foto"
                      >
                        <X size={16} color={colors.white} />
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
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel="Quitar foto"
                      >
                        <X size={16} color={colors.white} />
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
                accessibilityRole="button"
                accessibilityLabel="Tomar foto"
                accessibilityState={{ disabled: images.length + existingImages.length >= 5 }}
              >
                <Camera size={24} color={(images.length + existingImages.length >= 5) ? colors.textDisabled : colors.primary} />
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
                accessibilityRole="button"
                accessibilityLabel="Elegir fotos de la galería"
                accessibilityState={{ disabled: images.length + existingImages.length >= 5 }}
              >
                <Upload size={24} color={(images.length + existingImages.length >= 5) ? colors.textDisabled : colors.primary} />
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

        </FormSection>
      </ScrollView>

      <FormFooter>
        <Button
          title="Guardar cambios"
            onPress={handleSaveProduct}
            loading={saveLoading}
            size="large"
            disabled={saveLoading || (!productName.trim() || !price || !stock || (existingImages.length === 0 && images.length === 0))}
          />
      </FormFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 6,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingBottom: spacing.xl,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  firstSection: {
    marginTop: spacing.lg,
  },
  formCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryLabel: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryButton: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  selectedCategory: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    ...typography.label,
    color: colors.textTertiary,
  },
  selectedCategoryText: {
    color: colors.white,
  },
  imageSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.md,
  },
  imagesSubtitle: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  imageAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginHorizontal: spacing.sm,
  },
  disabledAction: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  imageActionText: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  disabledActionText: {
    color: colors.textTertiary,
  },
  imagePreview: {
    flexDirection: 'row',
    marginVertical: spacing.sm,
  },
  imageContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: radius.sm,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.danger,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCount: {
    ...typography.bodySmall,
    color: colors.textTertiary, 
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  presentationsBox: {
    marginBottom: spacing.lg,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  presentationsTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  presentationsHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  siblingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  siblingInfo: {
    flex: 1,
  },
  siblingWeight: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  siblingMeta: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  presentationCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presentationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  presentationActionButton: {
    flex: 1,
    width: undefined,
  },
  addPresentationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  addPresentationText: {
    ...typography.label,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
});
