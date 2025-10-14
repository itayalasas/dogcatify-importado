import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Image, TextInput } from 'react-native';
import { Plus, Volume2, Search, Calendar, ExternalLink, Building, X } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AdminPromotions() {
  const { currentUser } = useAuth();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [filteredPromotions, setFilteredPromotions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState('');
  
  // Promotion form state
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoDiscountPercentage, setPromoDiscountPercentage] = useState('');
  const [promoImage, setPromoImage] = useState<string | null>(null);
  const [promoUrl, setPromoUrl] = useState('');
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate, setPromoEndDate] = useState('');
  const [promoTargetAudience, setPromoTargetAudience] = useState('all');
  const [promoType, setPromoType] = useState('feed');
  const [ctaText, setCtaText] = useState('Más información');
  const [promoLinkType, setPromoLinkType] = useState<'none' | 'external' | 'internal'>('none');
  const [promoInternalType, setPromoInternalType] = useState<'service' | 'product' | 'partner'>('service');
  const [promoInternalId, setPromoInternalId] = useState('');
  const [manualId, setManualId] = useState('');
  
  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      console.log('No user logged in');
      return;
    }

    console.log('Current user email:', currentUser.email);
    const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
    if (!isAdmin) {
      console.log('User is not admin');
      return;
    }

    console.log('Fetching promotions data...');
    fetchPromotions();
    fetchPartners();
    fetchProducts();
    fetchServices();
  }, [currentUser]);

  useEffect(() => {
    // Filter promotions based on search query
    if (searchQuery.trim()) {
      setFilteredPromotions(
        promotions.filter(promotion => 
          promotion.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          promotion.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredPromotions(promotions);
    }
  }, [searchQuery, promotions]);

  const fetchPromotions = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('promotions')
        .select(`
          *,
          partners:partner_id(business_name, business_type, logo)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const promotionsData = data?.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        imageURL: item.image_url,
        ctaUrl: item.cta_url,
        startDate: new Date(item.start_date),
        endDate: new Date(item.end_date),
        targetAudience: item.target_audience,
        isActive: item.is_active,
        views: item.views,
        clicks: item.clicks,
        createdAt: new Date(item.created_at),
        createdBy: item.created_by,
        partnerId: item.partner_id,
        partnerInfo: item.partners ? {
          businessName: item.partners.business_name,
          businessType: item.partners.business_type,
          logo: item.partners.logo,
        } : null,
      })) || [];

      setPromotions(promotionsData);
      setFilteredPromotions(promotionsData);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('id, business_name, business_type, logo')
        .eq('is_verified', true)
        .eq('is_active', true)
        .order('business_name', { ascending: true });

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partner_products')
        .select('id, name, price, partner_id, images')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partner_services')
        .select('id, name, price, partner_id, images')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleSelectImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPromoImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para usar la cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPromoImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
    console.log('=== IMAGE UPLOAD DEBUG START ===');
    console.log('Image URI to upload:', imageUri);
    
    console.log('Step 1: Fetching image from URI...');
    const response = await fetch(imageUri);
    const filename = `promotions/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    console.log('Generated filename:', filename);
    
    console.log('Step 4: Uploading to Supabase Storage...');
    
      // Create FormData for React Native
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: filename,
      } as any);
      
      console.log('FormData created for upload');
      
      const { data, error } = await supabaseClient.storage
        .from('dogcatify')
        .upload(filename, formData, {
          upsert: false,
        });
    if (error) {
      console.error('Supabase storage upload error:', error);
      throw error;
    }
    
    console.log('Upload successful, getting public URL...');
    
    const { data: { publicUrl } } = supabaseClient.storage
      .from('dogcatify')
      .getPublicUrl(filename);
    
    console.log('Generated public URL:', publicUrl);
    
    if (!publicUrl) {
      throw new Error('No se pudo generar la URL pública de la imagen');
    }
    
    return publicUrl;
  };

  const handleCreatePromotion = async () => {
    console.log('=== CREATING PROMOTION DEBUG START ===');
    console.log('Form validation check...');
    console.log('promoTitle:', promoTitle);
    console.log('promoDescription:', promoDescription);
    console.log('promoStartDate:', promoStartDate);
    console.log('promoEndDate:', promoEndDate);
    console.log('promoImage:', promoImage ? 'Image selected' : 'No image');
    
    if (!promoTitle || !promoDescription || !promoStartDate || !promoEndDate || !promoImage) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      console.log('❌ Validation failed - missing required fields');
      return;
    }
    
    console.log('✅ Validation passed, starting creation process...');

    setLoading(true);
    try {
      console.log('Creating promotion with image:', promoImage ? 'Yes' : 'No');
      
      console.log('Step 1: Uploading image...');
      let imageUrl = null;
      if (promoImage) {
        console.log('Uploading promotion image...');
        console.log('Image URI:', promoImage);
        try {
          imageUrl = await uploadImage(promoImage);
          console.log('✅ Image uploaded successfully, URL:', imageUrl);
        } catch (uploadError) {
          console.error('❌ Image upload failed:', uploadError);
          Alert.alert('Error', 'No se pudo subir la imagen');
          return;
        }
      }

      console.log('Step 2: Preparing promotion data...');
      // Determine CTA URL based on link type
      let ctaUrl = null;
      if (promoLinkType === 'external') {
        ctaUrl = promoUrl.trim();
      } else if (promoLinkType === 'internal') {
        if (promoInternalType === 'service' && selectedServiceId) {
          ctaUrl = `dogcatify://services/${selectedServiceId}`;
        } else if (promoInternalType === 'product' && selectedProductId) {
          ctaUrl = `dogcatify://products/${selectedProductId}`;
        } else if (promoInternalId) {
          ctaUrl = `dogcatify://${promoInternalType}s/${promoInternalId}`;
        }
        console.log('Image uploaded successfully, URL:', imageUrl);
      } else {
        console.log('No image to upload');
      }

      const promotionData = {
        title: promoTitle.trim(),
        description: promoDescription.trim(),
        discount_percentage: promoDiscountPercentage ? parseFloat(promoDiscountPercentage) : null,
        cta_url: ctaUrl,
        start_date: promoStartDate ? new Date(promoStartDate).toISOString() : new Date().toISOString(),
        end_date: promoEndDate ? new Date(promoEndDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now if not set
        target_audience: promoTargetAudience,
        promotion_type: promoType,
        views: 0,
        clicks: 0,
        likes: [],
        has_discount: hasDiscount,
        discount_percentage: hasDiscount ? parseFloat(discountPercentage) || 0 : null,
        created_at: new Date().toISOString(),
        created_by: currentUser?.id,
        image_url: imageUrl,
      };

      console.log('Promotion data prepared:', promotionData);
      console.log('Date validation:');
      console.log('Start date valid:', !isNaN(new Date(promotionData.start_date).getTime()));
      console.log('End date valid:', !isNaN(new Date(promotionData.end_date).getTime()));
      console.log('Start date:', promotionData.start_date);
      console.log('End date:', promotionData.end_date);
      
      console.log('Final promotion data to insert:', {
        ...promotionData,
        image_url: imageUrl ? 'URL_PROVIDED' : 'NULL'
      });
      if (selectedPartnerId) {
        promotionData.partner_id = selectedPartnerId;
        console.log('Partner ID added:', selectedPartnerId);
      }

      console.log('Step 3: Inserting into database...');
      console.log('Using Supabase client to insert promotion...');
      const { error } = await supabaseClient
        .from('promotions')
        .insert([promotionData]);

      if (error) {
        console.error('Database insert error:', error);
        console.error('❌ Database insertion error:', error);
        console.error('Database error details:', JSON.stringify(error, null, 2));
        Alert.alert('Error', 'No se pudo crear la promoción');
        return;
      }
      
      console.log('Promotion created successfully in database');

      console.log('✅ Promotion inserted successfully into database');
      console.log('Step 4: Cleaning up form...');
      resetForm();
      setShowPromotionModal(false);
      console.log('Step 5: Refreshing promotions list...');
      fetchPromotions();
      console.log('✅ Promotion creation completed successfully');
    } catch (error) {
      console.error('ERROR in handleCreatePromotion:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      Alert.alert('Error', 'Ocurrió un error inesperado');
    } finally {
      console.log('Finally: Cleaning up loading state');
      setLoading(false);
    }
  };

  const handleTogglePromotion = async (promotionId: string, isActive: boolean) => {
    try {
      const { error } = await supabaseClient
        .from('promotions')
        .update({ is_active: !isActive })
        .eq('id', promotionId);

      if (error) throw error;

      // Refresh the list after the update
      fetchPromotions();
    } catch (error) {
      console.error('Error toggling promotion:', error);
      Alert.alert('Error', 'No se pudo actualizar la promoción');
    }
  };

  const resetForm = () => {
    setPromoTitle('');
    setPromoDescription('');
    setPromoDiscountPercentage('');
    setPromoImage(null);
    setPromoUrl('');
    setCtaText('Más información');
    setPromoStartDate('');
    setPromoEndDate('');
    setPromoTargetAudience('all');
    setPromoType('feed');
    setPromoLinkType('none');
    setPromoInternalType('service');
    setPromoInternalId('');
    setSelectedPartnerId(null);
    setSelectedServiceId(null);
    setPartnerSearchQuery('');
    setProductSearchQuery('');
    setServiceSearchQuery('');
    setHasDiscount(false);
    setDiscountPercentage('');
    setManualId('');
  };

  const isPromotionActive = (startDate: Date, endDate: Date) => {
    const now = new Date();
    return now >= startDate && now <= endDate;
  };

  const getBusinessTypeIcon = (type: string) => {
    switch (type) {
      case 'veterinary': return '🏥';
      case 'grooming': return '✂️';
      case 'walking': return '🚶';
      case 'boarding': return '🏠';
      case 'shop': return '🛍️';
      case 'shelter': return '🐾';
      default: return '🏢';
    }
  };

  const handleSelectPartner = (partner: any) => {
    setSelectedPartnerId(partner.id);
    setPartnerSearchQuery(partner.business_name);
    setShowPartnerModal(false);
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProductId(product.id);
    setPromoInternalId(product.id);
    setShowProductModal(false);
  };

  const handleSelectService = (service: any) => {
    setSelectedServiceId(service.id);
    setPromoInternalId(service.id);
    setShowServiceModal(false);
  };

  const filteredPartners = partners.filter(partner =>
    partner.business_name.toLowerCase().includes(partnerSearchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())
  );

  const selectedPartner = partners.find(p => p.id === selectedPartnerId);
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedService = services.find(s => s.id === selectedServiceId);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  const isAdmin = currentUser?.email?.toLowerCase() === 'admin@dogcatify.com';
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedTitle}>Acceso Denegado</Text>
          <Text style={styles.accessDeniedText}>
            No tienes permisos para acceder a esta sección
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📢 Gestión de Promociones</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowPromotionModal(true)}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Buscar promociones..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={20} color="#9CA3AF" />}
          />
        </View>
        {/* Promotions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Promociones Activas ({filteredPromotions.length})</Text>
          
          {filteredPromotions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Volume2 size={48} color="#DC2626" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No se encontraron promociones' : 'No hay promociones'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Crea la primera promoción para la plataforma'
                }
              </Text>
            </Card>
          ) : (
            filteredPromotions.map((promotion) => (
              <Card key={promotion.id} style={styles.promotionCard}>
                <View style={styles.promotionHeader}>
                  <View style={styles.promotionInfo}>
                    <Text style={styles.promotionTitle}>{promotion.title}</Text>
                    <Text style={styles.promotionDescription} numberOfLines={2}>
                      {promotion.description}
                    </Text>
                    {promotion.partnerInfo && (
                      <View style={styles.partnerInfo}>
                        <Text style={styles.partnerIcon}>
                          {getBusinessTypeIcon(promotion.partnerInfo.businessType)}
                        </Text>
                        <Text style={styles.partnerName}>
                          {promotion.partnerInfo.businessName}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.promotionStatus}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: promotion.isActive ? '#DCFCE7' : '#F3F4F6' }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: promotion.isActive ? '#22C55E' : '#6B7280' }
                      ]}>
                        {promotion.isActive ? 'Activa' : 'Inactiva'}
                      </Text>
                    </View>
                    
                    <View style={styles.promotionStats}>
                      <Text style={styles.statText}>👁️ {promotion.views || 0}</Text>
                      <Text style={styles.statText}>🔗 {promotion.clicks || 0}</Text>
                    </View>
                  </View>
                </View>

                {promotion.imageURL && (
                  <Image source={{ uri: promotion.imageURL }} style={styles.promotionImage} />
                )}

                <View style={styles.promotionDates}>
                  <Text style={styles.dateText}>
                    📅 {promotion.startDate.toLocaleDateString()} - {promotion.endDate.toLocaleDateString()}
                  </Text>
                  <Text style={[
                    styles.activeStatus,
                    { color: isPromotionActive(promotion.startDate, promotion.endDate) ? '#22C55E' : '#EF4444' }
                  ]}>
                    {isPromotionActive(promotion.startDate, promotion.endDate) ? 'En período activo' : 'Fuera de período'}
                  </Text>
                </View>

                <View style={styles.promotionActions}>
                  <Button
                    title={promotion.isActive ? 'Desactivar' : 'Activar'}
                    onPress={() => handleTogglePromotion(promotion.id, promotion.isActive)}
                    variant={promotion.isActive ? 'outline' : 'primary'}
                    size="medium"
                  />
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Promotion Modal */}
      <Modal
        visible={showPromotionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPromotionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Crear Nueva Promoción</Text>
                <TouchableOpacity onPress={() => setShowPromotionModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <Input
                label="Título de la promoción *"
                placeholder="Ej: ¡50% de descuento en consultas!"
                value={promoTitle}
                onChangeText={setPromoTitle}
              />

              <Input
                label="Descripción *"
                placeholder="Describe la promoción..."
                value={promoDescription}
                onChangeText={setPromoDescription}
                multiline
                numberOfLines={3}
              />

              <Input
                label="Porcentaje de descuento"
                placeholder="Ej: 20 (opcional)"
                value={promoDiscountPercentage}
                onChangeText={setPromoDiscountPercentage}
                keyboardType="numeric"
              />

              <Input
                label="Texto del botón (CTA)"
                placeholder="Ej: Ver oferta, Comprar ahora, Más información"
                value={ctaText}
                onChangeText={setCtaText}
              />

              {/* Image Selection */}
              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>Imagen de la promoción *</Text>
                
                {promoImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: promoImage }} style={styles.selectedImage} />
                    <TouchableOpacity 
                      style={styles.changeImageButton}
                      onPress={() => setPromoImage(null)}
                    >
                      <Text style={styles.changeImageText}>Cambiar imagen</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imageActions}>
                    <TouchableOpacity style={styles.imageActionButton} onPress={handleTakePhoto}>
                      <Text style={styles.imageActionIcon}>📷</Text>
                      <Text style={styles.imageActionText}>Tomar foto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageActionButton} onPress={handleSelectImage}>
                      <Text style={styles.imageActionIcon}>🖼️</Text>
                      <Text style={styles.imageActionText}>Galería</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Date Selection */}
              <View style={styles.dateSection}>
                <Text style={styles.dateLabel}>Período de la promoción *</Text>
                
                <View style={styles.dateRow}>
                  <View style={styles.dateInput}>
                    <Text style={styles.dateInputLabel}>Fecha de inicio</Text>
                    <TouchableOpacity 
                      style={styles.dateButton}
                      onPress={() => setShowStartDatePicker(true)}
                    >
                      <Calendar size={16} color="#6B7280" />
                      <Text style={styles.dateButtonText}>
                        {promoStartDate ? new Date(promoStartDate).toLocaleDateString() : 'Seleccionar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.dateInput}>
                    <Text style={styles.dateInputLabel}>Fecha de fin</Text>
                    <TouchableOpacity 
                      style={styles.dateButton}
                      onPress={() => setShowEndDatePicker(true)}
                    >
                      <Calendar size={16} color="#6B7280" />
                      <Text style={styles.dateButtonText}>
                        {promoEndDate ? new Date(promoEndDate).toLocaleDateString() : 'Seleccionar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {showStartDatePicker && (
                  <DateTimePicker
                    value={promoStartDate ? new Date(promoStartDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowStartDatePicker(false);
                      if (selectedDate) {
                        setPromoStartDate(selectedDate.toISOString());
                      }
                    }}
                  />
                )}

                {showEndDatePicker && (
                  <DateTimePicker
                    value={promoEndDate ? new Date(promoEndDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowEndDatePicker(false);
                      if (selectedDate) {
                        setPromoEndDate(selectedDate.toISOString());
                      }
                    }}
                  />
                )}
              </View>

              {/* Link Configuration */}
              <View style={styles.linkSection}>
                <Text style={styles.linkLabel}>Configuración de enlace</Text>
                
                <View style={styles.linkTypeSelector}>
                  <TouchableOpacity
                    style={[styles.linkTypeOption, promoLinkType === 'none' && styles.selectedLinkType]}
                    onPress={() => setPromoLinkType('none')}
                  >
                    <Text style={[styles.linkTypeText, promoLinkType === 'none' && styles.selectedLinkTypeText]}>
                      Sin enlace
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.linkTypeOption, promoLinkType === 'external' && styles.selectedLinkType]}
                    onPress={() => setPromoLinkType('external')}
                  >
                    <Text style={[styles.linkTypeText, promoLinkType === 'external' && styles.selectedLinkTypeText]}>
                      Enlace externo
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.linkTypeOption, promoLinkType === 'internal' && styles.selectedLinkType]}
                    onPress={() => setPromoLinkType('internal')}
                  >
                    <Text style={[styles.linkTypeText, promoLinkType === 'internal' && styles.selectedLinkTypeText]}>
                      Enlace interno
                    </Text>
                  </TouchableOpacity>
                </View>

                {promoLinkType === 'external' && (
                  <Input
                    label="URL externa"
                    placeholder="https://ejemplo.com"
                    value={promoUrl}
                    onChangeText={setPromoUrl}
                    leftIcon={<ExternalLink size={20} color="#6B7280" />}
                  />
                )}

                {promoLinkType === 'internal' && (
                  <View style={styles.internalLinkSection}>
                    <Text style={styles.internalLinkLabel}>Tipo de enlace interno</Text>
                    <View style={styles.internalTypeSelector}>
                      <TouchableOpacity
                        style={[styles.internalTypeOption, promoInternalType === 'service' && styles.selectedInternalType]}
                        onPress={() => {
                          setPromoInternalType('service');
                          setSelectedProductId(null);
                          setSelectedServiceId(null);
                          setPromoInternalId('');
                        }}
                      >
                        <Text style={[styles.internalTypeText, promoInternalType === 'service' && styles.selectedInternalTypeText]}>Servicio</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.internalTypeOption, promoInternalType === 'product' && styles.selectedInternalType]}
                        onPress={() => {
                          setPromoInternalType('product');
                          setSelectedProductId(null);
                          setSelectedServiceId(null);
                          setPromoInternalId('');
                        }}
                      >
                        <Text style={[styles.internalTypeText, promoInternalType === 'product' && styles.selectedInternalTypeText]}>Producto</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.internalTypeOption, promoInternalType === 'partner' && styles.selectedInternalType]}
                        onPress={() => {
                          setPromoInternalType('partner');
                          setSelectedProductId(null);
                          setSelectedServiceId(null);
                          setPromoInternalId('');
                        }}
                      >
                        <Text style={[styles.internalTypeText, promoInternalType === 'partner' && styles.selectedInternalTypeText]}>Aliado</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Service Selector */}
                    {promoInternalType === 'service' && (
                      <View style={styles.selectorSection}>
                        <TouchableOpacity 
                          style={styles.selectorButton}
                          onPress={() => setShowServiceModal(true)}
                        >
                          <Text style={styles.selectorButtonText}>
                            {selectedService ? selectedService.name : 'Buscar y seleccionar servicio'}
                          </Text>
                          <Search size={16} color="#6B7280" />
                        </TouchableOpacity>
                        
                        {selectedService && (
                          <View style={styles.selectedItemInfo}>
                            <Text style={styles.selectedItemName}>{selectedService.name}</Text>
                            <Text style={styles.selectedItemPrice}>{formatPrice(selectedService.price)}</Text>
                            <TouchableOpacity onPress={() => {
                              setSelectedServiceId(null);
                              setPromoInternalId('');
                            }}>
                              <Text style={styles.removeItemText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Product Selector */}
                    {promoInternalType === 'product' && (
                      <View style={styles.selectorSection}>
                        <TouchableOpacity 
                          style={styles.selectorButton}
                          onPress={() => setShowProductModal(true)}
                        >
                          <Text style={styles.selectorButtonText}>
                            {selectedProduct ? selectedProduct.name : 'Buscar y seleccionar producto'}
                          </Text>
                          <Search size={16} color="#6B7280" />
                        </TouchableOpacity>
                        
                        {selectedProduct && (
                          <View style={styles.selectedItemInfo}>
                            <Text style={styles.selectedItemName}>{selectedProduct.name}</Text>
                            <Text style={styles.selectedItemPrice}>{formatPrice(selectedProduct.price)}</Text>
                            <TouchableOpacity onPress={() => {
                              setSelectedProductId(null);
                              setPromoInternalId('');
                            }}>
                              <Text style={styles.removeItemText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Partner Selector for Internal Links */}
                    {promoInternalType === 'partner' && (
                      <View style={styles.selectorSection}>
                        <TouchableOpacity 
                          style={styles.selectorButton}
                          onPress={() => setShowPartnerModal(true)}
                        >
                          <Text style={styles.selectorButtonText}>
                            {selectedPartner ? selectedPartner.business_name : 'Buscar y seleccionar aliado'}
                          </Text>
                          <Search size={16} color="#6B7280" />
                        </TouchableOpacity>
                        
                        {selectedPartner && (
                          <View style={styles.selectedItemInfo}>
                            <Text style={styles.selectedItemIcon}>
                              {getBusinessTypeIcon(selectedPartner.business_type)}
                            </Text>
                            <Text style={styles.selectedItemName}>{selectedPartner.business_name}</Text>
                            <TouchableOpacity onPress={() => {
                              setSelectedPartnerId(null);
                              setPromoInternalId('');
                            }}>
                              <Text style={styles.removeItemText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Manual ID Input as fallback */}
                    <Input
                      label={`ID del ${promoInternalType} (manual)`}
                      placeholder={`O ingresa manualmente el ID del ${promoInternalType}`}
                      value={promoInternalId}
                      onChangeText={setPromoInternalId}
                    />
                  </View>
                )}
              </View>

              {/* Partner Association (for promotion attribution) */}
              <View style={styles.partnerSection}>
                <Text style={styles.partnerLabel}>Aliado asociado (opcional)</Text>
                <TouchableOpacity 
                  style={styles.partnerSelector}
                  onPress={() => setShowPartnerModal(true)}
                >
                  <Building size={20} color="#6B7280" />
                  <Text style={styles.partnerSelectorText}>
                    {selectedPartner ? selectedPartner.business_name : 'Seleccionar aliado'}
                  </Text>
                </TouchableOpacity>
                
                {selectedPartner && (
                  <View style={styles.selectedPartnerInfo}>
                    <Text style={styles.selectedPartnerIcon}>
                      {getBusinessTypeIcon(selectedPartner.business_type)}
                    </Text>
                    <Text style={styles.selectedPartnerName}>
                      {selectedPartner.business_name}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedPartnerId(null)}>
                      <Text style={styles.removePartnerText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Descuento */}
              <View style={styles.discountSection}>
                <TouchableOpacity 
                  style={styles.discountCheckbox}
                  onPress={() => setHasDiscount(!hasDiscount)}
                >
                  <View style={[styles.checkbox, hasDiscount && styles.checkedCheckbox]}>
                    {hasDiscount && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.discountCheckboxLabel}>Esta promoción incluye descuento</Text>
                </TouchableOpacity>
                
                {hasDiscount && (
                  <View style={styles.discountInputContainer}>
                    <Input
                      label="Porcentaje de descuento"
                      placeholder="Ej: 15"
                      value={discountPercentage}
                      onChangeText={setDiscountPercentage}
                      keyboardType="numeric"
                    />
                    <Text style={styles.discountHint}>
                      Ingresa solo el número (ej: 15 para 15% de descuento)
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.modalActions}>
                <Button
                  title="Cancelar"
                  onPress={() => {
                    setShowPromotionModal(false);
                    resetForm();
                  }}
                  variant="outline"
                  size="large"
                />
                <Button
                  title="Crear Promoción"
                  onPress={handleCreatePromotion}
                  size="large"
                  loading={loading}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Partner Selection Modal */}
      <Modal
        visible={showPartnerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPartnerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.partnerModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Aliado</Text>
              <TouchableOpacity onPress={() => setShowPartnerModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <Input
              placeholder="Buscar aliado..."
              value={partnerSearchQuery}
              onChangeText={setPartnerSearchQuery}
              leftIcon={<Search size={20} color="#9CA3AF" />}
            />
            
            <ScrollView style={styles.partnersList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                style={styles.partnerOption}
                onPress={() => {
                  setSelectedPartnerId(null);
                  setPartnerSearchQuery('');
                  setShowPartnerModal(false);
                }}
              >
                <Text style={styles.partnerOptionText}>Sin aliado asociado</Text>
              </TouchableOpacity>
              
              {filteredPartners.map((partner) => (
                <TouchableOpacity
                  key={partner.id}
                  style={styles.partnerOption}
                  onPress={() => handleSelectPartner(partner)}
                >
                  <View style={styles.partnerOptionContent}>
                    <Text style={styles.partnerOptionIcon}>
                      {getBusinessTypeIcon(partner.business_type)}
                    </Text>
                    <View style={styles.partnerOptionInfo}>
                      <Text style={styles.partnerOptionName}>{partner.business_name}</Text>
                      <Text style={styles.partnerOptionType}>
                        {partner.business_type === 'veterinary' ? 'Veterinaria' :
                         partner.business_type === 'grooming' ? 'Peluquería' :
                         partner.business_type === 'walking' ? 'Paseador' :
                         partner.business_type === 'boarding' ? 'Pensión' :
                         partner.business_type === 'shop' ? 'Tienda' :
                         partner.business_type === 'shelter' ? 'Refugio' : partner.business_type}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Product Selection Modal */}
      <Modal
        visible={showProductModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.partnerModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Producto</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <Input
              placeholder="Buscar producto..."
              value={productSearchQuery}
              onChangeText={setProductSearchQuery}
              leftIcon={<Search size={20} color="#9CA3AF" />}
            />
            
            <ScrollView style={styles.partnersList} showsVerticalScrollIndicator={false}>
              {filteredProducts.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.partnerOption}
                  onPress={() => handleSelectProduct(product)}
                >
                  <View style={styles.partnerOptionContent}>
                    {product.images && product.images.length > 0 ? (
                      <Image source={{ uri: product.images[0] }} style={styles.productImage} />
                    ) : (
                      <View style={styles.productImagePlaceholder}>
                        <Text style={styles.productImagePlaceholderText}>📦</Text>
                      </View>
                    )}
                    <View style={styles.partnerOptionInfo}>
                      <Text style={styles.partnerOptionName}>{product.name}</Text>
                      <Text style={styles.partnerOptionType}>
                        {formatPrice(product.price)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Service Selection Modal */}
      <Modal
        visible={showServiceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowServiceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.partnerModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Servicio</Text>
              <TouchableOpacity onPress={() => setShowServiceModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <Input
              placeholder="Buscar servicio..."
              value={serviceSearchQuery}
              onChangeText={setServiceSearchQuery}
              leftIcon={<Search size={20} color="#9CA3AF" />}
            />
            
            <ScrollView style={styles.partnersList} showsVerticalScrollIndicator={false}>
              {filteredServices.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.partnerOption}
                  onPress={() => handleSelectService(service)}
                >
                  <View style={styles.partnerOptionContent}>
                    {service.images && service.images.length > 0 ? (
                      <Image source={{ uri: service.images[0] }} style={styles.productImage} />
                    ) : (
                      <View style={styles.productImagePlaceholder}>
                        <Text style={styles.productImagePlaceholderText}>🛠️</Text>
                      </View>
                    )}
                    <View style={styles.partnerOptionInfo}>
                      <Text style={styles.partnerOptionName}>{service.name}</Text>
                      <Text style={styles.partnerOptionType}>
                        {formatPrice(service.price)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#DC2626',
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  promotionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  promotionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  promotionInfo: {
    flex: 1,
    marginRight: 12,
  },
  promotionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  promotionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  partnerName: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  promotionStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  promotionStats: {
    flexDirection: 'row',
    gap: 8,
  },
  statText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  promotionImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  promotionDates: {
    marginBottom: 12,
  },
  dateText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  activeStatus: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  promotionActions: {
    alignItems: 'flex-end',
  },
  emptyCard: {
    marginHorizontal: 16,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  partnerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '80%',
    marginTop: '20%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  imageSection: {
    marginBottom: 20,
  },
  imageLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  imagePreviewContainer: {
    marginBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  changeImageButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'center',
  },
  changeImageText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  imageActionButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  imageActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  imageActionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  dateSection: {
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 6,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 8,
  },
  linkSection: {
    marginBottom: 20,
  },
  linkLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  linkTypeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  linkTypeOption: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedLinkType: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  linkTypeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedLinkTypeText: {
    color: '#FFFFFF',
  },
  internalLinkSection: {
    marginTop: 12,
  },
  internalLinkLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  internalTypeSelector: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 6,
  },
  internalTypeOption: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedInternalType: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  internalTypeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedInternalTypeText: {
    color: '#FFFFFF',
  },
  selectorSection: {
    marginBottom: 16,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectorButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
  selectedItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  selectedItemIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  selectedItemName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    flex: 1,
  },
  selectedItemPrice: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
    marginRight: 8,
  },
  removeItemText: {
    fontSize: 16,
    color: '#6B7280',
    padding: 4,
  },
  partnerSection: {
    marginBottom: 20,
  },
  partnerLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  partnerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  partnerSelectorText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  selectedPartnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  selectedPartnerIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  selectedPartnerName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    flex: 1,
  },
  removePartnerText: {
    fontSize: 16,
    color: '#6B7280',
    padding: 4,
  },
  modalActions: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 20,
  },
  partnersList: {
    maxHeight: 400,
    marginTop: 16,
  },
  partnerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  partnerOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerOptionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  partnerOptionInfo: {
    flex: 1,
  },
  partnerOptionName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  partnerOptionType: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  partnerOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  productImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productImagePlaceholderText: {
    fontSize: 20,
  },
  partnerSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  discountSection: {
    marginBottom: 20,
  },
  discountCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  discountCheckboxLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 12,
  },
  discountInputContainer: {
    marginTop: 8,
  },
  discountHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  disabledInput: {
    backgroundColor: '#F9FAFB',
    opacity: 0.6,
  },
  comingSoonText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    color: 'black',
    paddingRight: 30,
    backgroundColor: '#fff',
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    color: 'black',
    paddingRight: 30,
    backgroundColor: '#fff',
  },
});