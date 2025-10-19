import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, DollarSign, Clock, Camera, Package, Upload, X, Tag, Users } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { launchImageLibraryAsync, launchCameraAsync, MediaTypeOptions, requestMediaLibraryPermissionsAsync, requestCameraPermissionsAsync, ImagePickerAsset } from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';

export default function EditService() {
  const { serviceId, partnerId, businessType } = useLocalSearchParams<{ serviceId: string; partnerId: string; businessType: string }>();
  const { currentUser } = useAuth();

  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('60');
  const [stock, setStock] = useState('10');
  const [currency, setCurrency] = useState('UYU');
  const [currencyCodeDgi, setCurrencyCodeDgi] = useState('858');
  const [brand, setBrand] = useState('');
  const [weight, setWeight] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [petType, setPetType] = useState('');

  // Campos específicos para Pensión (boarding)
  const [boardingPetType, setBoardingPetType] = useState<'dog' | 'cat' | 'both'>('both');
  const [capacityDaily, setCapacityDaily] = useState('');
  const [capacityOvernight, setCapacityOvernight] = useState('');
  const [capacityWeekend, setCapacityWeekend] = useState('');
  const [capacityWeekly, setCapacityWeekly] = useState('');
  const [priceDaily, setPriceDaily] = useState('');
  const [priceOvernight, setPriceOvernight] = useState('');
  const [priceWeekend, setPriceWeekend] = useState('');
  const [priceWeekly, setPriceWeekly] = useState('');

  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    if (serviceId) {
      fetchServiceDetails();
    }
  }, [serviceId]);

  const fetchServiceDetails = async () => {
    try {
      setLoading(true);

      const isProduct = businessType === 'shop';
      const tableName = isProduct ? 'partner_products' : 'partner_services';

      const { data, error } = await supabaseClient
        .from(tableName)
        .select('*')
        .eq('id', serviceId)
        .single();

      if (error) throw error;

      if (data) {
        setServiceName(data.name || '');
        setDescription(data.description || '');
        setCategory(data.category || '');
        setPrice(data.price?.toString() || '');
        setDuration(data.duration?.toString() || '60');
        setExistingImages(data.images || []);
        setCurrency(data.currency || 'UYU');
        setCurrencyCodeDgi(data.currency_code_dgi || '858');

        if (isProduct) {
          setStock(data.stock?.toString() || '10');
          setBrand(data.brand || '');
          setWeight(data.weight || '');
          setSize(data.size || '');
          setColor(data.color || '');
          setAgeRange(data.age_range || '');
          setPetType(data.pet_type || '');
        }

        // Cargar datos específicos de Pensión
        if (businessType === 'boarding') {
          setBoardingPetType(data.pet_type || 'both');
          setCapacityDaily(data.capacity_daily?.toString() || '');
          setCapacityOvernight(data.capacity_overnight?.toString() || '');
          setCapacityWeekend(data.capacity_weekend?.toString() || '');
          setCapacityWeekly(data.capacity_weekly?.toString() || '');
          setPriceDaily(data.price_daily?.toString() || '');
          setPriceOvernight(data.price_overnight?.toString() || '');
          setPriceWeekend(data.price_weekend?.toString() || '');
          setPriceWeekly(data.price_weekly?.toString() || '');
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

  const CURRENCY_OPTIONS = [
    { code: 'UYU', dgiCode: '858', name: 'Peso Uruguayo', symbol: '$' },
    { code: 'USD', dgiCode: '840', name: 'Dólar Estadounidense', symbol: 'US$' },
    { code: 'EUR', dgiCode: '978', name: 'Euro', symbol: '€' }
  ];

  const handleCurrencyChange = (currencyCode: string) => {
    const selectedCurrency = CURRENCY_OPTIONS.find(c => c.code === currencyCode);
    if (selectedCurrency) {
      setCurrency(selectedCurrency.code);
      setCurrencyCodeDgi(selectedCurrency.dgiCode);
    }
  };

  const handleSelectImages = async () => {
    try {
      const permissionResult = await requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permiso denegado', 'Necesitamos permiso para acceder a tu galería de fotos');
        return;
      }

      const totalImages = existingImages.length + newImages.length;
      if (totalImages >= 5) {
        Alert.alert('Límite alcanzado', 'Puedes tener máximo 5 imágenes');
        return;
      }

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - totalImages,
      });

      if (!result.canceled && result.assets) {
        setNewImages(prev => [...prev, ...result.assets].slice(0, 5 - existingImages.length));
      }
    } catch (error) {
      console.error('Error selecting images:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes');
    }
  };

  const handleRemoveExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNewImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos permiso para acceder a la cámara');
        return;
      }

      const totalImages = existingImages.length + newImages.length;
      if (totalImages >= 5) {
        Alert.alert('Límite alcanzado', 'Puedes tener máximo 5 imágenes');
        return;
      }

      const result = await launchCameraAsync({
        mediaTypes: MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        setNewImages(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
    const filename = `partners/${partnerId}/services/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    return uploadImageUtil(imageUri, filename);
  };

  const handleSubmit = async () => {
    // Validación básica
    if (!serviceName || !description) {
      Alert.alert('Error', 'Por favor completa el nombre y descripción');
      return;
    }

    // Validación específica para Pensión
    if (businessType === 'boarding') {
      if (!priceDaily && !priceOvernight && !priceWeekend && !priceWeekly) {
        Alert.alert('Error', 'Por favor especifica al menos un precio para una categoría');
        return;
      }
      if (!capacityDaily && !capacityOvernight && !capacityWeekend && !capacityWeekly) {
        Alert.alert('Error', 'Por favor especifica al menos una capacidad para una categoría');
        return;
      }
    } else {
      // Validación para otros servicios
      if (businessType !== 'shop' && (!category || !price)) {
        Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
        return;
      }
    }

    if (!currentUser || !partnerId) {
      Alert.alert('Error', 'Información de usuario o aliado no disponible');
      return;
    }

    setSaveLoading(true);
    try {
      // Upload new images
      let uploadedImageUrls: string[] = [];

      if (newImages.length > 0) {
        console.log(`Subiendo ${newImages.length} imágenes nuevas...`);

        for (let i = 0; i < newImages.length; i++) {
          const imageUrl = await uploadImage(newImages[i].uri);
          uploadedImageUrls.push(imageUrl);
        }
      }

      // Combine existing and new images
      const allImages = [...existingImages, ...uploadedImageUrls];

      const isProduct = businessType === 'shop';
      const tableName = isProduct ? 'partner_products' : 'partner_services';

      if (isProduct) {
        // Update product
        const productData = {
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
          images: allImages,
          currency: currency,
          currency_code_dgi: currencyCodeDgi,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
          .from('partner_products')
          .update(productData)
          .eq('id', serviceId);

        if (error) throw error;

      } else if (businessType === 'boarding') {
        // Update boarding service
        const serviceData = {
          name: serviceName.trim(),
          description: description.trim() || '',
          category: 'Pensión',
          pet_type: boardingPetType,
          capacity_daily: capacityDaily ? parseInt(capacityDaily) : null,
          capacity_overnight: capacityOvernight ? parseInt(capacityOvernight) : null,
          capacity_weekend: capacityWeekend ? parseInt(capacityWeekend) : null,
          capacity_weekly: capacityWeekly ? parseInt(capacityWeekly) : null,
          price_daily: priceDaily ? parseFloat(priceDaily) : null,
          price_overnight: priceOvernight ? parseFloat(priceOvernight) : null,
          price_weekend: priceWeekend ? parseFloat(priceWeekend) : null,
          price_weekly: priceWeekly ? parseFloat(priceWeekly) : null,
          images: allImages,
          currency: currency,
          currency_code_dgi: currencyCodeDgi,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
          .from('partner_services')
          .update(serviceData)
          .eq('id', serviceId);

        if (error) throw error;

      } else {
        // Update regular service
        const serviceData = {
          name: serviceName.trim(),
          description: description.trim() || '',
          category: category.trim(),
          price: parseFloat(price),
          duration: parseInt(duration) || 60,
          images: allImages,
          currency: currency,
          currency_code_dgi: currencyCodeDgi,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
          .from('partner_services')
          .update(serviceData)
          .eq('id', serviceId);

        if (error) throw error;
      }

      Alert.alert(
        'Éxito',
        `${isProduct ? 'Producto' : 'Servicio'} actualizado correctamente`,
        [{
          text: 'OK',
          onPress: () => router.replace(`/services/partner/${partnerId}?refresh=${Date.now()}`)
        }]
      );
    } catch (error) {
      console.error('Error updating service:', error);

      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      Alert.alert(
        'Error al actualizar',
        `No se pudo actualizar el ${businessType === 'shop' ? 'producto' : 'servicio'}.\n\nDetalle: ${errorMessage}`
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const renderBoardingFields = () => {
    if (businessType !== 'boarding') return null;

    return (
      <>
        <View style={styles.boardingSection}>
          <Text style={styles.sectionTitle}>Tipo de Mascota Aceptada</Text>
          <View style={styles.petTypeSelector}>
            <TouchableOpacity
              style={[
                styles.petTypeButton,
                boardingPetType === 'dog' && styles.selectedPetType
              ]}
              onPress={() => setBoardingPetType('dog')}
            >
              <Text style={[
                styles.petTypeText,
                boardingPetType === 'dog' && styles.selectedPetTypeText
              ]}>
                🐕 Perros
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.petTypeButton,
                boardingPetType === 'cat' && styles.selectedPetType
              ]}
              onPress={() => setBoardingPetType('cat')}
            >
              <Text style={[
                styles.petTypeText,
                boardingPetType === 'cat' && styles.selectedPetTypeText
              ]}>
                🐈 Gatos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.petTypeButton,
                boardingPetType === 'both' && styles.selectedPetType
              ]}
              onPress={() => setBoardingPetType('both')}
            >
              <Text style={[
                styles.petTypeText,
                boardingPetType === 'both' && styles.selectedPetTypeText
              ]}>
                🐾 Ambos
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.capacityPriceSection}>
          <Text style={styles.sectionTitle}>Categorías de Hospedaje</Text>
          <Text style={styles.sectionSubtitle}>
            Configura la capacidad y precio para cada categoría que ofreces
          </Text>

          {/* Diario */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>☀️ Hospedaje Diario</Text>
            <Text style={styles.categoryConfigDesc}>Cuidado durante el día (sin pernoctar)</Text>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 10"
                  value={capacityDaily}
                  onChangeText={setCapacityDaily}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color="#6B7280" />}
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label="Precio"
                  placeholder="0.00"
                  value={priceDaily}
                  onChangeText={setPriceDaily}
                  keyboardType="numeric"
                  leftIcon={<DollarSign size={20} color="#6B7280" />}
                />
              </View>
            </View>
          </View>

          {/* Nocturno */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>🌙 Hospedaje Nocturno</Text>
            <Text style={styles.categoryConfigDesc}>Pernocta (incluye noche)</Text>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 8"
                  value={capacityOvernight}
                  onChangeText={setCapacityOvernight}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color="#6B7280" />}
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label="Precio"
                  placeholder="0.00"
                  value={priceOvernight}
                  onChangeText={setPriceOvernight}
                  keyboardType="numeric"
                  leftIcon={<DollarSign size={20} color="#6B7280" />}
                />
              </View>
            </View>
          </View>

          {/* Fin de semana */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>🎉 Fin de Semana</Text>
            <Text style={styles.categoryConfigDesc}>Viernes a domingo (2-3 días)</Text>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 6"
                  value={capacityWeekend}
                  onChangeText={setCapacityWeekend}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color="#6B7280" />}
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label="Precio"
                  placeholder="0.00"
                  value={priceWeekend}
                  onChangeText={setPriceWeekend}
                  keyboardType="numeric"
                  leftIcon={<DollarSign size={20} color="#6B7280" />}
                />
              </View>
            </View>
          </View>

          {/* Semanal */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>📅 Semanal</Text>
            <Text style={styles.categoryConfigDesc}>7 días completos</Text>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 5"
                  value={capacityWeekly}
                  onChangeText={setCapacityWeekly}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color="#6B7280" />}
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label="Precio"
                  placeholder="0.00"
                  value={priceWeekly}
                  onChangeText={setPriceWeekly}
                  keyboardType="numeric"
                  leftIcon={<DollarSign size={20} color="#6B7280" />}
                />
              </View>
            </View>
          </View>
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
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
        <Text style={styles.title}>Editar {businessType === 'shop' ? 'Producto' : 'Servicio'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Editar Información</Text>
            <Text style={styles.headerSubtitle}>
              {businessType === 'shop'
                ? 'Actualiza la información de tu producto'
                : businessType === 'boarding'
                ? 'Actualiza las capacidades y precios de tu servicio de hospedaje'
                : 'Actualiza la información del servicio'}
            </Text>
          </View>

          <Input
            label={businessType === 'shop' ? 'Nombre del producto *' : 'Nombre del servicio *'}
            placeholder="Nombre"
            value={serviceName}
            onChangeText={setServiceName}
          />

          <Input
            label="Descripción *"
            placeholder="Describe detalladamente..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          {businessType !== 'boarding' && (
            <>
              <Input
                label="Categoría"
                placeholder="Categoría"
                value={category}
                onChangeText={setCategory}
              />

              <Input
                label="Precio *"
                placeholder="0.00"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                leftIcon={<DollarSign size={20} color="#6B7280" />}
              />

              {/* Selector de Moneda */}
              <View style={styles.categorySection}>
                <Text style={styles.categoryLabel}>Moneda 💰</Text>
                <Text style={styles.categoryHint}>Selecciona la moneda en la que se vende este {businessType === 'shop' ? 'producto' : 'servicio'}</Text>
                <View style={styles.categories}>
                  {CURRENCY_OPTIONS.map((curr) => (
                    <TouchableOpacity
                      key={curr.code}
                      style={[
                        styles.currencyButton,
                        currency === curr.code && styles.selectedCurrency
                      ]}
                      onPress={() => handleCurrencyChange(curr.code)}
                    >
                      <Text style={[
                        styles.currencyText,
                        currency === curr.code && styles.selectedCurrencyText
                      ]}>
                        {curr.symbol} {curr.code}
                      </Text>
                      <Text style={[
                        styles.currencyName,
                        currency === curr.code && styles.selectedCurrencyName
                      ]}>
                        {curr.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {renderBoardingFields()}

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
                placeholder="Ej: Royal Canin"
                value={brand}
                onChangeText={setBrand}
                leftIcon={<Tag size={20} color="#6B7280" />}
              />

              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Input
                    label="Peso/Volumen"
                    placeholder="Ej: 1kg"
                    value={weight}
                    onChangeText={setWeight}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Input
                    label="Tamaño"
                    placeholder="Ej: S, M, L"
                    value={size}
                    onChangeText={setSize}
                  />
                </View>
              </View>
            </>
          )}

          {businessType !== 'boarding' && businessType !== 'shop' && (
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
            <Text style={styles.sectionTitle}>Imágenes (máx. 5)</Text>
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={[styles.imageAction, (existingImages.length + newImages.length) >= 5 && styles.disabledAction]}
                onPress={handleTakePhoto}
                disabled={(existingImages.length + newImages.length) >= 5}
              >
                <Camera size={24} color={(existingImages.length + newImages.length) >= 5 ? "#9CA3AF" : "#3B82F6"} />
                <Text style={[styles.imageActionText, (existingImages.length + newImages.length) >= 5 && styles.disabledActionText]}>
                  Tomar Foto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.imageAction, (existingImages.length + newImages.length) >= 5 && styles.disabledAction]}
                onPress={handleSelectImages}
                disabled={(existingImages.length + newImages.length) >= 5}
              >
                <Upload size={24} color={(existingImages.length + newImages.length) >= 5 ? "#9CA3AF" : "#3B82F6"} />
                <Text style={[styles.imageActionText, (existingImages.length + newImages.length) >= 5 && styles.disabledActionText]}>
                  Galería
                </Text>
              </TouchableOpacity>
            </View>

            {(existingImages.length > 0 || newImages.length > 0) && (
              <>
                <Text style={styles.selectedImagesTitle}>
                  Imágenes ({existingImages.length + newImages.length}/5):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreview}>
                  {existingImages.map((image, index) => (
                    <View key={`existing-${index}`} style={styles.imageContainer}>
                      <Image source={{ uri: image }} style={styles.previewImage} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveExistingImage(index)}
                      >
                        <X size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {newImages.map((image, index) => (
                    <View key={`new-${index}`} style={styles.imageContainer}>
                      <Image source={{ uri: image.uri }} style={styles.previewImage} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveNewImage(index)}
                      >
                        <X size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <View style={styles.newImageBadge}>
                        <Text style={styles.newImageBadgeText}>Nueva</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.imageCount}>
              {existingImages.length + newImages.length}/5 imágenes
            </Text>
          </View>

          <Button
            title="Guardar Cambios"
            onPress={handleSubmit}
            loading={saveLoading}
            size="large"
            disabled={saveLoading}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
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
  boardingSection: {
    marginBottom: 20,
  },
  petTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  petTypeButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedPetType: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
  },
  petTypeText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  selectedPetTypeText: {
    color: '#3B82F6',
  },
  capacityPriceSection: {
    marginBottom: 20,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 16,
  },
  categoryConfig: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryConfigTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  categoryConfigDesc: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
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
  newImageBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newImageBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
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
  categoryHint: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  currencyButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: '30%',
  },
  selectedCurrency: {
    backgroundColor: '#EBF8FF',
    borderColor: '#10B981',
  },
  currencyText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#374151',
    marginBottom: 4,
  },
  selectedCurrencyText: {
    color: '#10B981',
  },
  currencyName: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  selectedCurrencyName: {
    color: '#059669',
  }
});
