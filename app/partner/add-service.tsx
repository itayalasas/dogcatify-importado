import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, DollarSign, Clock, Camera, Package, Upload, X, ShoppingBag, Tag, Users, Plus, Trash2 } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { toast } from '../../components/ui/Toast';
import { launchImageLibraryAsync, launchCameraAsync, MediaTypeOptions, requestMediaLibraryPermissionsAsync, requestCameraPermissionsAsync, ImagePickerAsset } from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';
import { generateVariantGroupId } from '../../utils/productVariants';
import { colors, radius, spacing, typography } from '../../constants/theme';

type Presentation = { key: string; weight: string; price: string; stock: string };
const MAX_EXTRA_PRESENTATIONS = 8;

export default function AddService() {
  const { partnerId, businessType } = useLocalSearchParams<{ partnerId: string; businessType: string }>();
  const { currentUser } = useAuth();

  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [ivaRate, setIvaRate] = useState('22');
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
  // Extra presentations of the same product (e.g. 2 kg, 10 kg), each with its
  // own price and stock. The main fields above are the first presentation.
  const [presentations, setPresentations] = useState<Presentation[]>([]);

  const addPresentation = () => {
    setPresentations((prev) => prev.length >= MAX_EXTRA_PRESENTATIONS
      ? prev
      : [...prev, { key: `${Date.now()}-${prev.length}`, weight: '', price: '', stock: '10' }]);
  };

  const updatePresentation = (key: string, field: 'weight' | 'price' | 'stock', value: string) => {
    setPresentations((prev) => prev.map((item) => item.key === key ? { ...item, [field]: value } : item));
  };

  const removePresentation = (key: string) => {
    setPresentations((prev) => prev.filter((item) => item.key !== key));
  };

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

  const [images, setImages] = useState<ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [hasCost, setHasCost] = useState(true);

  const [cancellationHours, setCancellationHours] = useState('24');
  const [confirmationHours, setConfirmationHours] = useState('');

  useEffect(() => {
    if (partnerId) {
      fetchPartnerProfile();
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
          title: 'Agregar servicio veterinario',
          titleIcon: '🏥',
          categories: ['Consulta', 'Vacunación', 'Cirugía', 'Emergencia', 'Diagnóstico'],
          needsDuration: true,
          needsStock: false,
          priceLabel: 'Precio de consulta'
        };
      case 'grooming':
        return {
          title: 'Agregar servicio de peluquería',
          titleIcon: '✂️',
          categories: ['Baño', 'Corte', 'Uñas', 'Oídos', 'Completo'],
          needsDuration: true,
          needsStock: false,
          priceLabel: 'Precio del servicio'
        };
      case 'walking':
        return {
          title: 'Agregar servicio de paseo',
          titleIcon: '🚶',
          categories: ['Paseo corto', 'Paseo largo', 'Ejercicio', 'Cuidado'],
          needsDuration: true,
          needsStock: false,
          priceLabel: 'Precio por hora'
        };
      case 'boarding':
        return {
          title: 'Agregar servicio de pensión',
          titleIcon: '🏠',
          categories: ['Diario', 'Nocturno', 'Fin de semana', 'Semanal'],
          needsDuration: false,
          needsStock: false,
          needsCapacity: true,
          priceLabel: 'Precio por categoría'
        };
      case 'shop':
        return {
          title: 'Agregar producto',
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
          title: 'Agregar mascota en adopción',
          titleIcon: '🐾',
          categories: ['Perro', 'Gato', 'Cachorro', 'Adulto', 'Senior'],
          needsDuration: false,
          needsStock: false,
          priceLabel: 'Costo de adopción'
        };
      default:
        return {
          title: 'Agregar servicio',
          titleIcon: '⚙️',
          categories: ['General'],
          needsDuration: false,
          needsStock: false,
          priceLabel: 'Precio'
        };
    }
  };

  const config = getServiceConfig(businessType || '');
  const isShopBusiness = businessType === 'shop';
  const isBoardingBusiness = businessType === 'boarding';
  const isWalkingBusiness = businessType === 'walking';
  const showServicePolicyFields = !isShopBusiness && !isBoardingBusiness;
  const showPricingFields = isShopBusiness || hasCost;

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
          Alert.alert('Límite alcanzado', 'Podés seleccionar máximo 5 imágenes');
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
    if (businessType === 'boarding') {
      if (hasCost) {
        if (!priceDaily && !priceOvernight && !priceWeekend && !priceWeekly) {
          Alert.alert('Error', 'Indicá al menos un precio para una categoría');
          return;
        }
      }
      if (!capacityDaily && !capacityOvernight && !capacityWeekend && !capacityWeekly) {
        Alert.alert('Error', 'Indicá al menos una capacidad para una categoría');
        return;
      }
    } else {
      // Validación para otros servicios
      if (!category) {
        Alert.alert('Error', 'Seleccioná una categoría');
        return;
      }
      if (hasCost && !price) {
        Alert.alert('Error', 'Indicá el precio del servicio');
        return;
      }
    }

    if (config.needsDuration && !duration) {
      Alert.alert('Error', 'Indicá la duración del servicio');
      return;
    }

    if (showServicePolicyFields) {
      if (!cancellationHours || parseInt(cancellationHours) < 1) {
        Alert.alert('Error', 'Indicá las horas mínimas para cancelar (mínimo 1 hora)');
        return;
      }

      if (!hasCost && (!confirmationHours || parseInt(confirmationHours) < 1)) {
        Alert.alert('Error', 'Para servicios sin costo, tenés que especificar las horas para enviar confirmación (mínimo 1 hora)');
        return;
      }
    }

    if (config.needsStock && !stock) {
      Alert.alert('Error', 'Indicá el stock disponible');
      return;
    }

    if (businessType === 'shop' && presentations.length > 0) {
      if (!weight.trim()) {
        Alert.alert('Error', 'Indicá el peso/volumen de la presentación principal para poder diferenciarla de las otras');
        return;
      }

      if (presentations.some((item) => !item.weight.trim())) {
        Alert.alert('Error', 'Cada presentación adicional necesita su peso/volumen (ej: 2kg)');
        return;
      }

      if (presentations.some((item) => !(parseFloat(item.price) > 0))) {
        Alert.alert('Error', 'Cada presentación adicional necesita un precio mayor a 0');
        return;
      }

      if (presentations.some((item) => item.stock.trim() === '' || isNaN(parseInt(item.stock)) || parseInt(item.stock) < 0)) {
        Alert.alert('Error', 'Cada presentación adicional necesita un stock válido (0 o más)');
        return;
      }

      const labels = [weight, ...presentations.map((item) => item.weight)].map((label) => label.trim().toLowerCase());
      if (new Set(labels).size !== labels.length) {
        Alert.alert('Error', 'Hay presentaciones con el mismo peso/volumen. Cada una debe ser distinta.');
        return;
      }
    }

    if (images.length === 0 && businessType === 'shop') {
      Alert.alert('Error', 'Agregá al menos una imagen del producto');
      return;
    }

    if (!currentUser || !partnerId) {
      Alert.alert('Error', 'Información de usuario o aliado no disponible');
      return;
    }

    setLoading(true);
    try {
      // Upload images
      let imageUrls: string[] = [];

      if (images.length > 0) {
        console.log(`Subiendo ${images.length} imágenes...`);

        for (let i = 0; i < images.length; i++) {
          console.log(`Subiendo imagen ${i + 1} de ${images.length}...`);
          const path = `partners/${partnerId}/${businessType === 'shop' ? 'products' : 'services'}/${Date.now()}-${i}.jpg`;
          const imageUrl = await uploadImage(images[i].uri, path);
          imageUrls.push(imageUrl);
        }
      }

      if (businessType === 'shop') {
        // Create product data
        const productData = {
          partner_id: partnerId,
          name: serviceName.trim(),
          description: description.trim() || '',
          category: category.trim(),
          price: parseFloat(price),
          iva_rate: ivaRate ? parseFloat(ivaRate) : 0,
          stock: parseInt(stock) || 10,
          brand: brand.trim() || null,
          weight: weight.trim() || null,
          size: size.trim() || null,
          color: color.trim() || null,
          age_range: ageRange.trim() || null,
          pet_type: petType.trim() || null,
          partner_name: partnerProfile?.businessName || 'Tienda',
          images: imageUrls,
          currency: currency,
          currency_code_dgi: currencyCodeDgi,
          is_active: true,
          created_at: new Date().toISOString()
        };

        // One row per presentation, linked by a shared group id so carts,
        // orders and stock keep working per presentation.
        const variantGroupId = presentations.length > 0 ? generateVariantGroupId() : null;
        const productRows = [
          variantGroupId ? { ...productData, variant_group_id: variantGroupId } : productData,
          ...presentations.map((item) => ({
            ...productData,
            variant_group_id: variantGroupId,
            weight: item.weight.trim(),
            price: parseFloat(item.price),
            stock: parseInt(item.stock) || 0,
          })),
        ];

        const { error } = await supabaseClient
          .from('partner_products')
          .insert(productRows);

        if (error) throw error;

      } else if (businessType === 'boarding') {
        // Create boarding service data with capacity
        const serviceData = {
          partner_id: partnerId,
          name: serviceName.trim(),
          description: description.trim() || '',
          category: 'Pensión', // Categoría general
          pet_type: boardingPetType,
          capacity_daily: capacityDaily ? parseInt(capacityDaily) : null,
          capacity_overnight: capacityOvernight ? parseInt(capacityOvernight) : null,
          capacity_weekend: capacityWeekend ? parseInt(capacityWeekend) : null,
          capacity_weekly: capacityWeekly ? parseInt(capacityWeekly) : null,
          price_daily: hasCost && priceDaily ? parseFloat(priceDaily) : null,
          price_overnight: hasCost && priceOvernight ? parseFloat(priceOvernight) : null,
          price_weekend: hasCost && priceWeekend ? parseFloat(priceWeekend) : null,
          price_weekly: hasCost && priceWeekly ? parseFloat(priceWeekly) : null,
          iva_rate: hasCost && ivaRate ? parseFloat(ivaRate) : 0,
          price: 0, // Legacy field
          duration: 0, // No aplica para pensión
          images: imageUrls,
          currency: currency,
          currency_code_dgi: currencyCodeDgi,
          has_cost: hasCost,
          cancellation_hours: parseInt(cancellationHours) || 24,
          confirmation_hours: !hasCost && confirmationHours ? parseInt(confirmationHours) : null,
          is_active: true,
          created_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
          .from('partner_services')
          .insert(serviceData);

        if (error) throw error;

      } else {
        // Create regular service data
        const serviceData = {
          partner_id: partnerId,
          name: serviceName.trim(),
          description: description.trim() || '',
          category: category.trim(),
          price: hasCost ? parseFloat(price) : 0,
          iva_rate: hasCost && ivaRate ? parseFloat(ivaRate) : 0,
          duration: parseInt(duration) || 60,
          images: imageUrls,
          currency: currency,
          currency_code_dgi: currencyCodeDgi,
          has_cost: hasCost,
          cancellation_hours: parseInt(cancellationHours) || 24,
          confirmation_hours: !hasCost && confirmationHours ? parseInt(confirmationHours) : null,
          is_active: true,
          created_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
          .from('partner_services')
          .insert(serviceData);

        if (error) throw error;
      }

      toast.success(`${businessType === 'shop' ? 'Producto' : 'Servicio'} agregado`);
      router.back();
    } catch (error) {
      console.error('Error adding service:', error);

      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      Alert.alert(
        'Error al guardar',
        `No se pudo agregar el ${businessType === 'shop' ? 'producto' : 'servicio'}.\n\nDetalle: ${errorMessage}`
      );
    } finally {
      setLoading(false);
    }
  };

  const renderBoardingFields = () => {
    if (businessType !== 'boarding') return null;

    return (
      <Card style={styles.formCard}>
        <Text style={styles.cardTitle}>Hospedaje</Text>
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

        {/* Switch para indicar si el servicio tiene costo */}
        <View style={styles.switchContainer}>
          <View style={styles.switchLabelContainer}>
            <Text style={styles.switchLabel}>¿El servicio tiene costo?</Text>
            <Text style={styles.switchHint}>
              Desactivá esta opción si el servicio es gratuito
            </Text>
          </View>
          <Switch
            value={hasCost}
            onValueChange={setHasCost}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={hasCost ? colors.white : colors.surfaceAlt}
          />
        </View>

        <View style={styles.capacityPriceSection}>
          <Text style={styles.sectionTitle}>Categorías de hospedaje</Text>
          <Text style={styles.sectionSubtitle}>
            Configurá la capacidad{hasCost ? ' y precio' : ''} para cada categoría que ofreces
          </Text>

          {/* Diario */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>☀️ Hospedaje diario</Text>
            <Text style={styles.categoryConfigDesc}>Cuidado durante el día (sin pernoctar)</Text>
            <View style={styles.row}>
              <View style={hasCost ? styles.halfWidth : { flex: 1 }}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 10"
                  value={capacityDaily}
                  onChangeText={setCapacityDaily}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color={colors.textTertiary} />}
                />
              </View>
              {hasCost && (
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
              )}
            </View>
          </View>

          {/* Nocturno */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>🌙 Hospedaje nocturno</Text>
            <Text style={styles.categoryConfigDesc}>Pernocta (incluye noche)</Text>
            <View style={styles.row}>
              <View style={hasCost ? styles.halfWidth : { flex: 1 }}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 8"
                  value={capacityOvernight}
                  onChangeText={setCapacityOvernight}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color={colors.textTertiary} />}
                />
              </View>
              {hasCost && (
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
              )}
            </View>
          </View>

          {/* Fin de semana */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>🎉 Fin de semana</Text>
            <Text style={styles.categoryConfigDesc}>Viernes a domingo (2-3 días)</Text>
            <View style={styles.row}>
              <View style={hasCost ? styles.halfWidth : { flex: 1 }}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 6"
                  value={capacityWeekend}
                  onChangeText={setCapacityWeekend}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color={colors.textTertiary} />}
                />
              </View>
              {hasCost && (
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
              )}
            </View>
          </View>

          {/* Semanal */}
          <View style={styles.categoryConfig}>
            <Text style={styles.categoryConfigTitle}>📅 Semanal</Text>
            <Text style={styles.categoryConfigDesc}>7 días completos</Text>
            <View style={styles.row}>
              <View style={hasCost ? styles.halfWidth : { flex: 1 }}>
                <Input
                  label="Capacidad"
                  placeholder="Ej: 5"
                  value={capacityWeekly}
                  onChangeText={setCapacityWeekly}
                  keyboardType="numeric"
                  leftIcon={<Users size={20} color={colors.textTertiary} />}
                />
              </View>
              {hasCost && (
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
              )}
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={config.title} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
          <View style={styles.headerInfo}>
            <Text style={styles.headerSubtitle}>
              {businessType === 'shop'
                ? 'Completá la información de tu producto para agregarlo a tu tienda'
                : businessType === 'boarding'
                ? 'Configurá las capacidades y precios de tu servicio de hospedaje'
                : isWalkingBusiness
                ? 'Configurá tu servicio de paseo y definí luego los cupos por horario en la agenda'
                : 'Completá la información del servicio que ofrecés a tus clientes'}
            </Text>
          </View>

        <Card style={styles.formCard}>
          <Text style={styles.cardTitle}>Datos básicos</Text>

          <Input
            label={businessType === 'shop' ? 'Nombre del producto *' : 'Nombre del servicio *'}
            placeholder={businessType === 'shop'
              ? "Ej: Alimento premium para perros"
              : businessType === 'boarding'
              ? "Ej: Hotel canino premium"
              : "Ej: Consulta general, Baño completo..."}
            value={serviceName}
            onChangeText={setServiceName}
          />

          <Input
            label={businessType === 'shop' ? 'Descripción del producto *' : 'Descripción del servicio *'}
            placeholder={businessType === 'shop'
              ? 'Describí en detalle el producto...'
              : 'Describí en detalle el servicio...'}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          {businessType !== 'boarding' && (
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
          )}
        </Card>

              {businessType !== 'boarding' && showServicePolicyFields && (
                <Card style={styles.formCard}>
                  <Text style={styles.cardTitle}>Costo y cancelación</Text>
                  {/* Switch para indicar si el servicio tiene costo */}
                  <View style={styles.switchContainer}>
                    <View style={styles.switchLabelContainer}>
                      <Text style={styles.switchLabel}>¿El servicio tiene costo?</Text>
                      <Text style={styles.switchHint}>
                        Desactivá esta opción si el servicio es gratuito
                      </Text>
                    </View>
                    <Switch
                      value={hasCost}
                      onValueChange={setHasCost}
                      trackColor={{ false: colors.borderStrong, true: colors.primary }}
                      thumbColor={hasCost ? colors.white : colors.surfaceAlt}
                    />
                  </View>

                  {/* Campos de política de cancelación y confirmación */}
                  <Input
                    label="Horas para cancelar cita *"
                    placeholder="24"
                    value={cancellationHours}
                    onChangeText={setCancellationHours}
                    keyboardType="numeric"
                    leftIcon={<Clock size={20} color={colors.textTertiary} />}
                    helperText="Tiempo mínimo (en horas) para que el cliente pueda cancelar la cita"
                  />

                  {!hasCost && (
                    <>
                      <Input
                        label="Horas para confirmar reserva *"
                        placeholder="48"
                        value={confirmationHours}
                        onChangeText={setConfirmationHours}
                        keyboardType="numeric"
                        leftIcon={<Clock size={20} color={colors.textTertiary} />}
                        helperText="Se enviará un email de confirmación con este tiempo de anticipación (solo para servicios sin costo)"
                      />
                    </>
                  )}
                </Card>
              )}

              {businessType !== 'boarding' && showPricingFields && (
                <Card style={styles.formCard}>
                  <Text style={styles.cardTitle}>Precio</Text>
                  <Input
                    label={config.priceLabel + ' *'}
                    placeholder="0.00"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                    leftIcon={<DollarSign size={20} color={colors.textTertiary} />}
                  />

                  <Input
                    label="IVA % (opcional)"
                    placeholder="22"
                    value={ivaRate}
                    onChangeText={setIvaRate}
                    keyboardType="numeric"
                    leftIcon={<Tag size={20} color={colors.textTertiary} />}
                  />

                  {/* Selector de Moneda */}
                  <View style={styles.categorySection}>
                    <Text style={styles.categoryLabel}>Moneda</Text>
                    <Text style={styles.categoryHint}>Seleccioná la moneda en la que se vende este {businessType === 'shop' ? 'producto' : 'servicio'}</Text>
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
                </Card>
              )}

          {renderBoardingFields()}

          {businessType === 'shop' && (
            <Card style={styles.formCard}>
              <Text style={styles.cardTitle}>Stock y detalles</Text>
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
                placeholder="Ej: Royal Canin, Pedigree"
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
                    placeholder="Ej: S, M, L"
                    value={size}
                    onChangeText={setSize}
                  />
                </View>
              </View>

              <View style={styles.presentationsBox}>
                <Text style={styles.presentationsTitle}>Otras presentaciones</Text>
                <Text style={styles.presentationsHint}>
                  ¿Se vende en más de un peso (ej: 1kg, 2kg, 10kg)? Agregá cada uno con su precio y stock. La
                  presentación de arriba es la principal.
                </Text>

                {presentations.map((item, index) => (
                  <View key={item.key} style={styles.presentationCard}>
                    <View style={styles.presentationCardHeader}>
                      <Text style={styles.presentationCardTitle}>Presentación {index + 2}</Text>
                      <TouchableOpacity
                        onPress={() => removePresentation(item.key)}
                        hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar presentación ${index + 2}`}
                      >
                        <Trash2 size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.row}>
                      <View style={styles.halfWidth}>
                        <Input
                          label="Peso/Volumen *"
                          placeholder="Ej: 2kg"
                          value={item.weight}
                          onChangeText={(value) => updatePresentation(item.key, 'weight', value)}
                        />
                      </View>
                      <View style={styles.halfWidth}>
                        <Input
                          label="Precio *"
                          placeholder="0"
                          value={item.price}
                          onChangeText={(value) => updatePresentation(item.key, 'price', value)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <Input
                      label="Stock *"
                      placeholder="10"
                      value={item.stock}
                      onChangeText={(value) => updatePresentation(item.key, 'stock', value)}
                      keyboardType="numeric"
                      leftIcon={<Package size={20} color={colors.textTertiary} />}
                    />
                  </View>
                ))}

                {presentations.length < MAX_EXTRA_PRESENTATIONS && (
                  <TouchableOpacity style={styles.addPresentationButton} onPress={addPresentation}>
                    <Plus size={18} color={colors.primary} />
                    <Text style={styles.addPresentationText}>Agregar presentación</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Input
                    label="Color"
                    placeholder="Ej: Rojo, Azul"
                    value={color}
                    onChangeText={setColor}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Input
                    label="Edad recomendada"
                    placeholder="Ej: Cachorro"
                    value={ageRange}
                    onChangeText={setAgeRange}
                  />
                </View>
              </View>

              <Input
                label="Tipo de mascota"
                placeholder="Ej: Perro, Gato"
                value={petType}
                onChangeText={setPetType}
              />
            </Card>
          )}

          {(config.needsDuration || isWalkingBusiness) && (
            <Card style={styles.formCard}>
              <Text style={styles.cardTitle}>Duración</Text>
          {config.needsDuration && (
            <Input
              label="Duración (minutos) *"
              placeholder="60"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              leftIcon={<Clock size={20} color={colors.textTertiary} />}
            />
          )}

          {isWalkingBusiness && (
            <View style={styles.walkingHint}>
              <Text style={styles.walkingHintTitle}>Cupos por horario</Text>
              <Text style={styles.walkingHintText}>
                La cantidad de perros que podés aceptar en una misma franja se define en la agenda de horarios.
              </Text>
            </View>
          )}
            </Card>
          )}

        <Card style={styles.formCard}>
          <View style={styles.imageSection}>
            <Text style={styles.cardTitle}>Fotos (máx. 5){businessType === 'shop' ? ' *' : ''}</Text>
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={[styles.imageAction, images.length >= 5 && styles.disabledAction]}
                onPress={handleTakePhoto}
                disabled={images.length >= 5}
                accessibilityRole="button"
                accessibilityLabel="Tomar foto"
                accessibilityState={{ disabled: images.length >= 5 }}
              >
                <Camera size={24} color={images.length >= 5 ? colors.textDisabled : colors.primary} />
                <Text style={[styles.imageActionText, images.length >= 5 && styles.disabledActionText]}>
                  Tomar foto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.imageAction, images.length >= 5 && styles.disabledAction]}
                onPress={handleSelectImages}
                disabled={images.length >= 5}
                accessibilityRole="button"
                accessibilityLabel="Elegir fotos de la galería"
                accessibilityState={{ disabled: images.length >= 5 }}
              >
                <Upload size={24} color={images.length >= 5 ? colors.textDisabled : colors.primary} />
                <Text style={[styles.imageActionText, images.length >= 5 && styles.disabledActionText]}>
                  Galería
                </Text>
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
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar foto ${index + 1}`}
                      >
                        <X size={16} color={colors.white} />
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
                    ? 'Agregá al menos una imagen de tu producto'
                    : 'Las imágenes ayudan a mostrar tu servicio (opcional)'}
                </Text>
              </View>
            )}

            <Text style={styles.imageCount}>
              {images.length}/5 imágenes {businessType === 'shop' ? '(requerido)' : '(opcional)'}
            </Text>
          </View>

        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={`Guardar ${businessType === 'shop' ? 'producto' : 'servicio'}`}
            onPress={handleSubmit}
            loading={loading}
            size="large"
            disabled={loading || (businessType === 'shop' && images.length === 0)}
          />
      </View>
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
  formCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
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
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: spacing.lg,
  },
  switchLabel: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  switchHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  walkingHint: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
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
  presentationCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presentationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  presentationCardTitle: {
    ...typography.label,
    color: colors.textSecondary,
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
  noImagesContainer: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  noImagesText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
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
  },
  imageCount: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  fieldHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: -12,
    marginBottom: spacing.lg,
    paddingLeft: spacing.xs,
  }
});
