import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, DollarSign, Clock, Camera, Package, Upload, X, Tag, Users } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { toast } from '../../components/ui/Toast';
import { FormSection } from '../../components/partner-setup/FormSection';
import { FormFooter } from '../../components/partner-setup/FormFooter';
import { FormSkeleton } from '../../components/partner-setup/FormSkeleton';
import { launchImageLibraryAsync, launchCameraAsync, MediaTypeOptions, requestMediaLibraryPermissionsAsync, requestCameraPermissionsAsync, ImagePickerAsset } from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';
import { colors, radius, spacing, typography } from '../../constants/theme';

export default function EditService() {
  const { serviceId, partnerId, businessType } = useLocalSearchParams<{ serviceId: string; partnerId: string; businessType: string }>();
  const { currentUser } = useAuth();
  const isShopBusiness = businessType === 'shop';
  const isBoardingBusiness = businessType === 'boarding';
  const isWalkingBusiness = businessType === 'walking';

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
        Alert.alert('Límite alcanzado', 'Podés tener máximo 5 imágenes');
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
        Alert.alert('Límite alcanzado', 'Podés tener máximo 5 imágenes');
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
      Alert.alert('Error', 'Completá el nombre y descripción');
      return;
    }

    // Validación específica para Pensión
    if (isBoardingBusiness) {
      if (!priceDaily && !priceOvernight && !priceWeekend && !priceWeekly) {
        Alert.alert('Error', 'Indicá al menos un precio para una categoría');
        return;
      }
      if (!capacityDaily && !capacityOvernight && !capacityWeekend && !capacityWeekly) {
        Alert.alert('Error', 'Indicá al menos una capacidad para una categoría');
        return;
      }
    } else if (isShopBusiness) {
      if (!category.trim()) {
        Alert.alert('Error', 'Seleccioná una categoría del producto');
        return;
      }
      if (!price) {
        Alert.alert('Error', 'Indicá el precio del producto');
        return;
      }
    } else {
      // Validación para otros servicios
      if (!category || !price) {
        Alert.alert('Error', 'Completá todos los campos obligatorios');
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

        const isProduct = isShopBusiness;
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
        };

        const { error } = await supabaseClient
          .from('partner_services')
          .update(serviceData)
          .eq('id', serviceId);

        if (error) throw error;
      }

      toast.success(`${isProduct ? 'Producto' : 'Servicio'} actualizado`);
      router.back();
    } catch (error) {
      console.error('Error updating service:', error);

      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      Alert.alert(
        'Error al actualizar',
        `No se pudo actualizar el ${isShopBusiness ? 'producto' : 'servicio'}.\n\nDetalle: ${errorMessage}`
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const renderBoardingFields = () => {
    if (businessType !== 'boarding') return null;

    return (
      <FormSection title="Hospedaje">
        <View style={styles.boardingSection}>
          <Text style={styles.sectionTitle}>Tipo de mascota aceptada</Text>
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
          <Text style={styles.sectionTitle}>Categorías de hospedaje</Text>
          <Text style={styles.sectionSubtitle}>
            Configurá la capacidad y precio para cada categoría que ofreces
          </Text>

          {/* Diario */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>☀️ Hospedaje diario</Text>
            <Text style={styles.categoryConfigDesc}>Cuidado durante el día (sin pernoctar)</Text>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 10"
                  value={capacityDaily}
                  onChangeText={setCapacityDaily}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color={colors.textTertiary} />}
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label="Precio"
                  placeholder="0.00"
                  value={priceDaily}
                  onChangeText={setPriceDaily}
                  keyboardType="numeric"
                  leftIcon={<DollarSign size={20} color={colors.textTertiary} />}
                />
              </View>
            </View>
          </View>

          {/* Nocturno */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>🌙 Hospedaje nocturno</Text>
            <Text style={styles.categoryConfigDesc}>Pernocta (incluye noche)</Text>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 8"
                  value={capacityOvernight}
                  onChangeText={setCapacityOvernight}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color={colors.textTertiary} />}
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label="Precio"
                  placeholder="0.00"
                  value={priceOvernight}
                  onChangeText={setPriceOvernight}
                  keyboardType="numeric"
                  leftIcon={<DollarSign size={20} color={colors.textTertiary} />}
                />
              </View>
            </View>
          </View>

          {/* Fin de semana */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>🎉 Fin de semana</Text>
            <Text style={styles.categoryConfigDesc}>Viernes a domingo (2-3 días)</Text>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 6"
                  value={capacityWeekend}
                  onChangeText={setCapacityWeekend}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color={colors.textTertiary} />}
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label="Precio"
                  placeholder="0.00"
                  value={priceWeekend}
                  onChangeText={setPriceWeekend}
                  keyboardType="numeric"
                  leftIcon={<DollarSign size={20} color={colors.textTertiary} />}
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
                  leftIcon={<Users size={20} color={colors.textTertiary} />}
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label="Precio"
                  placeholder="0.00"
                  value={priceWeekly}
                  onChangeText={setPriceWeekly}
                  keyboardType="numeric"
                  leftIcon={<DollarSign size={20} color={colors.textTertiary} />}
                />
              </View>
            </View>
          </View>
        </View>
      </FormSection>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Editar" />
        <FormSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={`Editar ${businessType === 'shop' ? 'producto' : 'servicio'}`} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
          <View style={styles.headerInfo}>
            <Text style={styles.headerSubtitle}>
              {businessType === 'shop'
                ? 'Actualizá la información de tu producto'
                : businessType === 'boarding'
                ? 'Actualizá las capacidades y precios de tu servicio de hospedaje'
                : isWalkingBusiness
                ? 'Actualizá tu servicio de paseo y recordá que los cupos por horario se configuran en la agenda'
                : 'Actualizá la información del servicio'}
            </Text>
          </View>

        <FormSection title="Datos básicos">

          <Input
            label={businessType === 'shop' ? 'Nombre del producto *' : 'Nombre del servicio *'}
            placeholder="Nombre"
            value={serviceName}
            onChangeText={setServiceName}
          />

          <Input
            label={isShopBusiness ? 'Descripción del producto *' : 'Descripción del servicio *'}
            placeholder={isShopBusiness
              ? 'Describí en detalle el producto...'
              : 'Describí en detalle el servicio...'}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          {!isBoardingBusiness && (
              <Input
                label={isShopBusiness ? 'Categoría del producto *' : 'Categoría *'}
                placeholder={isShopBusiness ? 'Categoría del producto' : 'Categoría'}
                value={category}
                onChangeText={setCategory}
              />
          )}
        </FormSection>

          {!isBoardingBusiness && (
            <FormSection title="Precio">

              <Input
                label={isShopBusiness ? 'Precio del producto *' : 'Precio *'}
                placeholder="0.00"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                leftIcon={<DollarSign size={20} color={colors.textTertiary} />}
              />

              {/* Selector de Moneda */}
              <View style={styles.categorySection}>
                <Text style={styles.categoryLabel}>Moneda</Text>
                <Text style={styles.categoryHint}>Seleccioná la moneda en la que se vende este {isShopBusiness ? 'producto' : 'servicio'}</Text>
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
            </FormSection>
          )}

          {renderBoardingFields()}

          {businessType === 'shop' && (
            <FormSection title="Stock y detalles">
              <Input
                label="Stock disponible *"
                placeholder="10"
                value={stock}
                onChangeText={setStock}
                keyboardType="numeric"
                leftIcon={<Package size={20} color={colors.textTertiary} />}
              />

              <Input
                label="Marca"
                placeholder="Ej: Royal Canin"
                value={brand}
                onChangeText={setBrand}
                leftIcon={<Tag size={20} color={colors.textTertiary} />}
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
            </FormSection>
          )}

          {businessType !== 'boarding' && businessType !== 'shop' && (
            <FormSection title="Duración">
              <Input
                label="Duración (minutos) *"
                placeholder="60"
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                leftIcon={<Clock size={20} color={colors.textTertiary} />}
              />

              {isWalkingBusiness && (
                <View style={styles.walkingHint}>
                  <Text style={styles.walkingHintTitle}>Cupos por horario</Text>
                  <Text style={styles.walkingHintText}>
                    Ajustá la agenda para definir cuántos perros podés atender en la misma franja.
                  </Text>
                </View>
              )}
            </FormSection>
          )}

        <FormSection title="Fotos" subtitle="Hasta 5 imágenes. La primera es la principal.">
          <View style={styles.imageSection}>
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={[styles.imageAction, (existingImages.length + newImages.length) >= 5 && styles.disabledAction]}
                onPress={handleTakePhoto}
                disabled={(existingImages.length + newImages.length) >= 5}
                accessibilityRole="button"
                accessibilityLabel="Tomar foto"
                accessibilityState={{ disabled: (existingImages.length + newImages.length) >= 5 }}
              >
                <Camera size={24} color={(existingImages.length + newImages.length) >= 5 ? colors.textDisabled : colors.primary} />
                <Text style={[styles.imageActionText, (existingImages.length + newImages.length) >= 5 && styles.disabledActionText]}>
                  Tomar foto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.imageAction, (existingImages.length + newImages.length) >= 5 && styles.disabledAction]}
                onPress={handleSelectImages}
                disabled={(existingImages.length + newImages.length) >= 5}
                accessibilityRole="button"
                accessibilityLabel="Elegir fotos de la galería"
                accessibilityState={{ disabled: (existingImages.length + newImages.length) >= 5 }}
              >
                <Upload size={24} color={(existingImages.length + newImages.length) >= 5 ? colors.textDisabled : colors.primary} />
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
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel="Quitar foto"
                      >
                        <X size={16} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {newImages.map((image, index) => (
                    <View key={`new-${index}`} style={styles.imageContainer}>
                      <Image source={{ uri: image.uri }} style={styles.previewImage} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveNewImage(index)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel="Quitar foto"
                      >
                        <X size={16} color={colors.white} />
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

        </FormSection>
      </ScrollView>

      <FormFooter>
        <Button
          title="Guardar cambios"
          onPress={handleSubmit}
          loading={saveLoading}
          size="large"
          disabled={saveLoading}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodyStrong,
    color: colors.textTertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  },
  headerInfo: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  walkingHint: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walkingHintTitle: {
    ...typography.bodyStrong,
    color: colors.success,
    marginBottom: 6,
  },
  walkingHintText: {
    ...typography.bodySmall,
    color: colors.success,
  },
  formCard: {
    margin: spacing.lg,
  },
  boardingSection: {
    marginBottom: spacing.xl,
  },
  petTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  petTypeButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  selectedPetType: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  petTypeText: {
    ...typography.label,
    color: colors.textTertiary,
  },
  selectedPetTypeText: {
    color: colors.primary,
  },
  capacityPriceSection: {
    marginBottom: spacing.xl,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  categoryConfig: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryConfigTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  categoryConfigDesc: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  imageSection: {
    marginBottom: spacing.xl,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  selectedImagesTitle: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  imageContainer: {
    position: 'relative',
    marginRight: spacing.sm,
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
  newImageBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  newImageBadgeText: {
    ...typography.captionStrong,
    color: colors.white,
  },
  sectionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.md,
  },
  imagePreview: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: radius.sm,
  },
  imageCount: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
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
  categoryHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  currencyButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: '30%',
  },
  selectedCurrency: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.success,
  },
  currencyText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  selectedCurrencyText: {
    color: colors.success,
  },
  currencyName: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  selectedCurrencyName: {
    color: colors.success,
  }
});
