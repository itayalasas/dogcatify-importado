import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Image, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Plus, Volume2, Search, Calendar, ExternalLink, Building, X, FileText, Pencil, Trash2, Send } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AdminPromotions() {
  console.log('🚀 [AdminPromotions] Component loaded!');

  const { currentUser } = useAuth();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [filteredPromotions, setFilteredPromotions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);
  const [resendingApprovalPromotionId, setResendingApprovalPromotionId] = useState<string | null>(null);
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
  const [costPerLike, setCostPerLike] = useState('0');
  const [costPerView, setCostPerView] = useState('');
  const [costPerClick, setCostPerClick] = useState('');

  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showIOSDateModal, setShowIOSDateModal] = useState(false);
  const [iosDateField, setIosDateField] = useState<'start' | 'end' | null>(null);
  const [iosSelectedDate, setIosSelectedDate] = useState(new Date());

  const [loading, setLoading] = useState(false);

  // Invoice modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedPromotionForInvoice, setSelectedPromotionForInvoice] = useState<any>(null);
  const [invoiceType, setInvoiceType] = useState<'views' | 'clicks' | 'both'>('both');
  const [pricePerView, setPricePerView] = useState('');
  const [pricePerClick, setPricePerClick] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [invoicePartnerSearchQuery, setInvoicePartnerSearchQuery] = useState('');

  useEffect(() => {
    console.log('📋 [AdminPromotions useEffect] Running...');
    if (!currentUser) {
      console.log('⚠️ [AdminPromotions] No user logged in');
      return;
    }

    console.log('✅ [AdminPromotions] Current user email:', currentUser.email);
    const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
    console.log('🔐 [AdminPromotions] Is admin:', isAdmin);

    if (!isAdmin) {
      console.log('❌ [AdminPromotions] User is not admin, skipping fetch');
      return;
    }

    console.log('📡 [AdminPromotions] Starting data fetch...');
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
    console.log('📥 [fetchPromotions] Starting...');
    try {
      const { data, error } = await supabaseClient
        .from('promotions')
        .select(`
          *,
          partners:partner_id(business_name, business_type, logo, email)
        `)
        .order('created_at', { ascending: false });

      console.log('📊 [fetchPromotions] Response:', { data, error });

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
        promotionType: item.promotion_type,
        isActive: item.is_active,
        hasDiscount: Boolean(item.has_discount),
        discountPercentage: item.discount_percentage,
        views: item.views,
        clicks: item.clicks,
        viewsInvoiced: Boolean(item.views_invoiced),
        clicksInvoiced: Boolean(item.clicks_invoiced),
        viewsInvoicedAt: item.views_invoiced_at ? new Date(item.views_invoiced_at) : null,
        clicksInvoicedAt: item.clicks_invoiced_at ? new Date(item.clicks_invoiced_at) : null,
        approvalStatus: item.approval_status || 'approved',
        costPerLike: Number(item.cost_per_like || 0),
        costPerView: Number(item.cost_per_view || 0),
        costPerClick: Number(item.cost_per_click || 0),
        createdAt: new Date(item.created_at),
        createdBy: item.created_by,
        partnerId: item.partner_id,
        partnerInfo: item.partners ? {
          businessName: item.partners.business_name,
          businessType: item.partners.business_type,
          logo: item.partners.logo,
          email: item.partners.email,
        } : null,
      })) || [];

      console.log('✅ [fetchPromotions] Promotions data prepared:', promotionsData.length, 'items');
      setPromotions(promotionsData);
      setFilteredPromotions(promotionsData);
      console.log('✅ [fetchPromotions] State updated successfully');
    } catch (error) {
      console.error('❌ [fetchPromotions] Error:', error);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('id, business_name, business_type, logo, email')
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
        .select('id, name, price, partner_id, images, is_active')
        .order('name', { ascending: true });

      if (error) throw error;

      const visibleProducts = (data || []).filter((item: any) => item?.is_active !== false);
      setProducts(visibleProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partner_services')
        .select('id, name, price, partner_id, images, is_active')
        .order('name', { ascending: true });

      if (error) throw error;

      const visibleServices = (data || []).filter((item: any) => item?.is_active !== false);
      setServices(visibleServices);
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

    if (selectedPartnerId && (!costPerView || !costPerClick)) {
      Alert.alert('Error', 'Para enviar a aprobación debes ingresar costo por vista y costo por clic');
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

      const basePromotionData: any = {
        title: promoTitle.trim(),
        description: promoDescription.trim(),
        cta_url: ctaUrl,
        start_date: promoStartDate ? new Date(promoStartDate).toISOString() : new Date().toISOString(),
        end_date: promoEndDate ? new Date(promoEndDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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

      const approvalAndBillingData: any = {
        cost_per_like: parseFloat(costPerLike || '0') || 0,
        cost_per_view: parseFloat(costPerView || '0') || 0,
        cost_per_click: parseFloat(costPerClick || '0') || 0,
        approval_status: selectedPartnerId ? 'pending' : 'approved',
        approval_requested_at: selectedPartnerId ? new Date().toISOString() : null,
        is_active: selectedPartnerId ? false : true,
      };

      const promotionData: any = {
        ...basePromotionData,
        ...approvalAndBillingData,
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

      const isEditMode = Boolean(editingPromotionId);
      console.log(`Step 3: ${isEditMode ? 'Updating' : 'Inserting'} in database...`);
      console.log(`Using Supabase client to ${isEditMode ? 'update' : 'insert'} promotion...`);

      let createdPromotion: any = null;
      let error: any = null;

      if (isEditMode) {
        const updateResult = await supabaseClient
          .from('promotions')
          .update(promotionData)
          .eq('id', editingPromotionId)
          .select('id')
          .single();

        createdPromotion = updateResult.data;
        error = updateResult.error;
      } else {
        const insertResult = await supabaseClient
          .from('promotions')
          .insert([promotionData])
          .select('id')
          .single();

        createdPromotion = insertResult.data;
        error = insertResult.error;
      }

      const isMissingColumnError =
        error?.code === 'PGRST204' ||
        String(error?.message || '').toLowerCase().includes('could not find') ||
        String(error?.message || '').toLowerCase().includes('column');

      if (error && isMissingColumnError) {
        console.warn('⚠️ Missing column in promotions schema. Retrying insert with base fields only...');

        const fallbackInsertData: any = {
          ...basePromotionData,
          is_active: selectedPartnerId ? false : true,
        };

        if (selectedPartnerId) {
          fallbackInsertData.partner_id = selectedPartnerId;
        }

        if (isEditMode) {
          const fallbackUpdate = await supabaseClient
            .from('promotions')
            .update(fallbackInsertData)
            .eq('id', editingPromotionId)
            .select('id')
            .single();

          createdPromotion = fallbackUpdate.data;
          error = fallbackUpdate.error;
        } else {
          const fallbackInsert = await supabaseClient
            .from('promotions')
            .insert([fallbackInsertData])
            .select('id')
            .single();

          createdPromotion = fallbackInsert.data;
          error = fallbackInsert.error;
        }
      }

      if (error) {
        console.error('Database insert error:', error);
        console.error('❌ Database insertion error:', error);
        console.error('Database error details:', JSON.stringify(error, null, 2));
        Alert.alert('Error', isEditMode ? 'No se pudo editar la promoción' : 'No se pudo crear la promoción');
        return;
      }

      if (!isEditMode && selectedPartnerId && createdPromotion?.id) {
        const relationType: 'service' | 'product' | 'partner' = promoLinkType === 'internal' ? promoInternalType : 'partner';

        const relationId =
          relationType === 'service'
            ? (selectedServiceId || promoInternalId || null)
            : relationType === 'product'
              ? (selectedProductId || promoInternalId || null)
              : (selectedPartnerId || promoInternalId || null);

        const relationName =
          relationType === 'service'
            ? (selectedService?.name || promoTitle)
            : relationType === 'product'
              ? (selectedProduct?.name || promoTitle)
              : (selectedPartner?.business_name || promoTitle);

        const { data: approvalData, error: approvalError } = await supabaseClient.functions.invoke(
          'send-promotion-approval-request',
          {
            body: {
              promotionId: createdPromotion.id,
              relationType,
              relationId,
              relationName,
              requestedBy: currentUser?.id,
              billing: {
                currency: 'UYU',
                costPerLike: parseFloat(costPerLike || '0') || 0,
                costPerView: parseFloat(costPerView || '0') || 0,
                costPerClick: parseFloat(costPerClick || '0') || 0,
              },
            },
          }
        );

        if (approvalError || !approvalData?.success) {
          let detail = approvalData?.error || approvalError?.message || 'No se pudo enviar la solicitud de aprobación';

          try {
            const approvalErrorWithContext = approvalError as any;
            if (approvalErrorWithContext?.context) {
              let errorBody: any = null;
              try {
                errorBody = await approvalErrorWithContext.context.json();
              } catch {
                try {
                  errorBody = await approvalErrorWithContext.context.text();
                } catch {
                  errorBody = null;
                }
              }

              if (errorBody?.error) {
                detail = errorBody.error;
              } else if (errorBody?.message) {
                detail = errorBody.message;
              } else if (typeof errorBody === 'string' && errorBody.trim()) {
                detail = errorBody;
              }
            }
          } catch (parseApprovalError) {
            console.error('❌ [Promotion Approval] Could not parse error body:', parseApprovalError);
          }

          Alert.alert(
            'Promoción creada con advertencia',
            `Se creó la promoción, pero falló el envío de aprobación al partner: ${detail}`
          );
        }
      }

      console.log('Promotion created successfully in database');

      console.log('✅ Promotion inserted successfully into database');
      console.log('Step 4: Cleaning up form...');
      resetForm();
      setShowPromotionModal(false);
      console.log('Step 5: Refreshing promotions list...');
      fetchPromotions();
      Alert.alert('Éxito', selectedPartnerId
        ? (isEditMode ? 'Promoción editada correctamente' : 'Promoción creada y solicitud de aprobación enviada al partner')
        : (isEditMode ? 'Promoción editada correctamente' : 'Promoción creada correctamente'));
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

      fetchPromotions();
    } catch (error) {
      console.error('Error toggling promotion:', error);
      Alert.alert('Error', 'No se pudo actualizar la promoción');
    }
  };

  const handleInvoicePromotion = (promotion: any) => {
    if (isPromotionFullyInvoiced(promotion)) {
      Alert.alert('Ya facturada', 'Esta promoción ya tiene facturadas las vistas y los clics.');
      return;
    }

    setSelectedPromotionForInvoice(promotion);
    setInvoiceType(getDefaultInvoiceTypeForPromotion(promotion));
    // Pre-fill email with partner email if available
    if (promotion.partnerInfo) {
      setInvoiceEmail(promotion.partnerInfo.email || '');
      setInvoicePartnerSearchQuery(promotion.partnerInfo.businessName || '');
    }
    setShowInvoiceModal(true);
  };

  const handleSelectInvoicePartner = (partner: any) => {
    setInvoicePartnerSearchQuery(partner.business_name || '');
    setInvoiceEmail(partner.email || '');

    if (!partner.email) {
      Alert.alert('Sin email', 'El aliado seleccionado no tiene email configurado');
    }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedPromotionForInvoice) return;

    if (invoiceType === 'views' && selectedViewsInvoiced) {
      Alert.alert('Ya facturado', 'Las vistas de esta promoción ya fueron facturadas.');
      return;
    }

    if (invoiceType === 'clicks' && selectedClicksInvoiced) {
      Alert.alert('Ya facturado', 'Los clics de esta promoción ya fueron facturados.');
      return;
    }

    if (invoiceType === 'both' && !canInvoiceBoth) {
      Alert.alert('Selección inválida', 'No puedes facturar ambos si vistas o clics ya fueron facturados.');
      return;
    }

    // Validate inputs
    if (invoiceType === 'views' && !pricePerView) {
      Alert.alert('Error', 'Por favor ingresa el precio por vista');
      return;
    }
    if (invoiceType === 'clicks' && !pricePerClick) {
      Alert.alert('Error', 'Por favor ingresa el precio por clic');
      return;
    }
    if (invoiceType === 'both' && (!pricePerView || !pricePerClick)) {
      Alert.alert('Error', 'Por favor ingresa ambos precios');
      return;
    }
    if (!invoiceEmail) {
      Alert.alert('Error', 'Por favor ingresa un email');
      return;
    }

    try {
      setLoading(true);

      // Calculate totals
      const viewsTotal = invoiceType !== 'clicks' ? selectedPromotionForInvoice.views * parseFloat(pricePerView || '0') : 0;
      const clicksTotal = invoiceType !== 'views' ? selectedPromotionForInvoice.clicks * parseFloat(pricePerClick || '0') : 0;
      const total = viewsTotal + clicksTotal;

      console.log('📧 [Invoice] Calling Edge Function...');
      console.log('📧 [Invoice] Data:', {
        promotionId: selectedPromotionForInvoice.id,
        invoiceType,
        email: invoiceEmail,
        total,
      });

      const { data: responseData, error: invokeError } = await supabaseClient.functions.invoke(
        'generate-promotion-invoice',
        {
          body: {
            promotion: {
              id: selectedPromotionForInvoice.id,
              title: selectedPromotionForInvoice.title,
              views: selectedPromotionForInvoice.views,
              clicks: selectedPromotionForInvoice.clicks,
              startDate: selectedPromotionForInvoice.startDate,
              endDate: selectedPromotionForInvoice.endDate,
              partnerId: selectedPromotionForInvoice.partnerId,
            },
            invoiceType,
            pricePerView: parseFloat(pricePerView || '0'),
            pricePerClick: parseFloat(pricePerClick || '0'),
            viewsTotal,
            clicksTotal,
            total,
            email: invoiceEmail,
            partnerInfo: selectedPromotionForInvoice.partnerInfo,
          },
        }
      );

      if (invokeError) {
        let detailedMessage = invokeError.message || 'Error al invocar generate-promotion-invoice';
        try {
          const errorWithContext = invokeError as any;
          if (errorWithContext?.context) {
            let errorBody: any = null;
            try {
              errorBody = await errorWithContext.context.json();
            } catch {
              try {
                errorBody = await errorWithContext.context.text();
              } catch {
                errorBody = null;
              }
            }

            if (errorBody?.error) {
              detailedMessage = errorBody.error;
            } else if (errorBody?.message) {
              detailedMessage = errorBody.message;
            } else if (typeof errorBody === 'string' && errorBody.trim()) {
              detailedMessage = errorBody;
            }

            console.error('❌ [Invoice] Edge Function error body:', errorBody);
          }
        } catch (parseError) {
          console.error('❌ [Invoice] Could not parse Edge Function error body:', parseError);
        }

        throw new Error(detailedMessage);
      }

      console.log('📧 [Invoice] Response data:', responseData);

      if (!responseData?.success) {
        throw new Error(responseData?.error || 'Error al generar la factura');
      }

      setPromotions((prev) => prev.map((promotion) => {
        if (promotion.id !== selectedPromotionForInvoice.id) return promotion;

        const updatedPromotion = { ...promotion };

        if (invoiceType !== 'clicks') {
          updatedPromotion.viewsInvoiced = true;
          updatedPromotion.viewsInvoicedAt = new Date();
        }

        if (invoiceType !== 'views') {
          updatedPromotion.clicksInvoiced = true;
          updatedPromotion.clicksInvoicedAt = new Date();
        }

        return updatedPromotion;
      }));

      Alert.alert('Éxito', `Factura generada y enviada a ${invoiceEmail}`);
      setShowInvoiceModal(false);
      setPricePerView('');
      setPricePerClick('');
      setInvoiceEmail('');
      setInvoicePartnerSearchQuery('');
      setInvoiceType('both');
    } catch (error: any) {
      console.error('❌ [Invoice] Error generating invoice:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo generar la factura. Por favor intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingPromotionId(null);
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
    setCostPerLike('0');
    setCostPerView('');
    setCostPerClick('');
    setManualId('');
  };

  const handleEditPromotion = (promotion: any) => {
    setEditingPromotionId(promotion.id);
    setPromoTitle(promotion.title || '');
    setPromoDescription(promotion.description || '');
    setPromoImage(promotion.imageURL || null);
    setPromoStartDate(promotion.startDate ? new Date(promotion.startDate).toISOString() : '');
    setPromoEndDate(promotion.endDate ? new Date(promotion.endDate).toISOString() : '');
    setPromoTargetAudience(promotion.targetAudience || 'all');
    setPromoType(promotion.promotionType || 'feed');
    setHasDiscount(Boolean(promotion.hasDiscount));
    setDiscountPercentage(promotion.discountPercentage ? String(promotion.discountPercentage) : '');
    setSelectedPartnerId(promotion.partnerId || null);
    setCostPerLike(String(promotion.costPerLike ?? 0));
    setCostPerView(String(promotion.costPerView ?? ''));
    setCostPerClick(String(promotion.costPerClick ?? ''));

    const ctaUrl = promotion.ctaUrl || '';
    if (!ctaUrl) {
      setPromoLinkType('none');
      setPromoUrl('');
      setPromoInternalId('');
      setSelectedProductId(null);
      setSelectedServiceId(null);
    } else if (ctaUrl.startsWith('dogcatify://')) {
      setPromoLinkType('internal');
      setPromoUrl('');

      const serviceMatch = ctaUrl.match(/^dogcatify:\/\/services\/(.+)$/);
      const productMatch = ctaUrl.match(/^dogcatify:\/\/products\/(.+)$/);
      const partnerMatch = ctaUrl.match(/^dogcatify:\/\/partners\/(.+)$/);

      if (serviceMatch?.[1]) {
        setPromoInternalType('service');
        setPromoInternalId(serviceMatch[1]);
        setSelectedServiceId(serviceMatch[1]);
        setSelectedProductId(null);
      } else if (productMatch?.[1]) {
        setPromoInternalType('product');
        setPromoInternalId(productMatch[1]);
        setSelectedProductId(productMatch[1]);
        setSelectedServiceId(null);
      } else if (partnerMatch?.[1]) {
        setPromoInternalType('partner');
        setPromoInternalId(partnerMatch[1]);
        setSelectedProductId(null);
        setSelectedServiceId(null);
      }
    } else {
      setPromoLinkType('external');
      setPromoUrl(ctaUrl);
      setPromoInternalId('');
      setSelectedProductId(null);
      setSelectedServiceId(null);
    }

    setShowPromotionModal(true);
  };

  const handleDeletePromotion = async (promotionId: string) => {
    Alert.alert(
      'Eliminar promoción',
      '¿Seguro que quieres eliminar esta promoción? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('promotions')
                .delete()
                .eq('id', promotionId);

              if (error) throw error;
              fetchPromotions();
              Alert.alert('Éxito', 'Promoción eliminada correctamente');
            } catch (error) {
              console.error('Error deleting promotion:', error);
              Alert.alert('Error', 'No se pudo eliminar la promoción');
            }
          },
        },
      ]
    );
  };

  const handleResendApproval = async (promotion: any) => {
    try {
      if (!promotion?.partnerId) {
        Alert.alert('Error', 'La promoción no tiene partner asociado para reenviar aprobación');
        return;
      }

      setResendingApprovalPromotionId(promotion.id);

      const { data: approvalData, error: approvalError } = await supabaseClient.functions.invoke(
        'send-promotion-approval-request',
        {
          body: {
            promotionId: promotion.id,
            relationType: 'partner',
            relationId: promotion.partnerId,
            relationName: promotion?.partnerInfo?.businessName || promotion.title,
            requestedBy: currentUser?.id,
            billing: {
              currency: 'UYU',
              costPerLike: Number(promotion?.costPerLike || 0),
              costPerView: Number(promotion?.costPerView || 0),
              costPerClick: Number(promotion?.costPerClick || 0),
            },
          },
        }
      );

      if (approvalError || !approvalData?.success) {
        let detail = approvalData?.error || approvalError?.message || 'No se pudo reenviar la solicitud';

        try {
          const errorWithContext = approvalError as any;
          if (errorWithContext?.context) {
            const contextBody = await errorWithContext.context.json();
            detail = contextBody?.error || contextBody?.message || detail;
          }
        } catch {
        }

        Alert.alert('Error', `No se pudo reenviar aprobación: ${detail}`);
        return;
      }

      Alert.alert('Éxito', 'Se reenvió la solicitud de aprobación al partner');
      fetchPromotions();
    } catch (error: any) {
      console.error('Error resending approval:', error);
      Alert.alert('Error', error?.message || 'No se pudo reenviar aprobación');
    } finally {
      setResendingApprovalPromotionId(null);
    }
  };

  const filteredInvoicePartners = partners.filter((partner) => {
    if (!invoicePartnerSearchQuery.trim()) return false;
    return (partner.business_name || '').toLowerCase().includes(invoicePartnerSearchQuery.toLowerCase());
  }).slice(0, 8);

  const isViewsInvoiced = (promotion: any) => Boolean(promotion?.viewsInvoiced);
  const isClicksInvoiced = (promotion: any) => Boolean(promotion?.clicksInvoiced);
  const isPromotionFullyInvoiced = (promotion: any) => isViewsInvoiced(promotion) && isClicksInvoiced(promotion);

  const getDefaultInvoiceTypeForPromotion = (promotion: any): 'views' | 'clicks' | 'both' => {
    if (isViewsInvoiced(promotion) && !isClicksInvoiced(promotion)) return 'clicks';
    if (!isViewsInvoiced(promotion) && isClicksInvoiced(promotion)) return 'views';
    return 'both';
  };

  const selectedViewsInvoiced = isViewsInvoiced(selectedPromotionForInvoice);
  const selectedClicksInvoiced = isClicksInvoiced(selectedPromotionForInvoice);
  const canInvoiceViews = !selectedViewsInvoiced;
  const canInvoiceClicks = !selectedClicksInvoiced;
  const canInvoiceBoth = canInvoiceViews && canInvoiceClicks;

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
    setShowPromotionModal(true);
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProductId(product.id);
    setPromoInternalId(product.id);
    setShowProductModal(false);
    setShowPromotionModal(true);
  };

  const handleSelectService = (service: any) => {
    setSelectedServiceId(service.id);
    setPromoInternalId(service.id);
    setShowServiceModal(false);
    setShowPromotionModal(true);
  };

  const openPartnerSelector = () => {
    setShowPromotionModal(false);
    setTimeout(() => setShowPartnerModal(true), 50);
  };

  const openProductSelector = () => {
    setShowPromotionModal(false);
    setTimeout(() => setShowProductModal(true), 50);
  };

  const openServiceSelector = () => {
    setShowPromotionModal(false);
    setTimeout(() => setShowServiceModal(true), 50);
  };

  const closePartnerSelector = () => {
    setShowPartnerModal(false);
    setShowPromotionModal(true);
  };

  const closeProductSelector = () => {
    setShowProductModal(false);
    setShowPromotionModal(true);
  };

  const closeServiceSelector = () => {
    setShowServiceModal(false);
    setShowPromotionModal(true);
  };

  const openDatePicker = (field: 'start' | 'end') => {
    const baseDate =
      field === 'start'
        ? (promoStartDate ? new Date(promoStartDate) : new Date())
        : (promoEndDate ? new Date(promoEndDate) : (promoStartDate ? new Date(promoStartDate) : new Date()));

    if (Platform.OS === 'ios') {
      setIosDateField(field);
      setIosSelectedDate(baseDate);
      setShowPromotionModal(false);
      setTimeout(() => setShowIOSDateModal(true), 50);
      return;
    }

    if (field === 'start') {
      setShowStartDatePicker(true);
    } else {
      setShowEndDatePicker(true);
    }
  };

  const closeIOSDatePicker = () => {
    setShowIOSDateModal(false);
    setIosDateField(null);
    setShowPromotionModal(true);
  };

  const applyIOSDatePicker = () => {
    if (!iosDateField) {
      closeIOSDatePicker();
      return;
    }

    if (iosDateField === 'start') {
      setPromoStartDate(iosSelectedDate.toISOString());
      if (promoEndDate && new Date(promoEndDate) < iosSelectedDate) {
        setPromoEndDate(iosSelectedDate.toISOString());
      }
    } else {
      setPromoEndDate(iosSelectedDate.toISOString());
    }

    closeIOSDatePicker();
  };

  const filteredPartners = partners.filter(partner =>
    partner.business_name.toLowerCase().includes(partnerSearchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(product =>
    (product?.name || '').toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const filteredServices = services.filter(service =>
    (service?.name || '').toLowerCase().includes(serviceSearchQuery.toLowerCase())
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
          onPress={() => {
            resetForm();
            setShowPromotionModal(true);
          }}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Input
            placeholder="Buscar promociones..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={20} color="#9CA3AF" />}
          />
        </View>

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
                      <Text style={styles.statText}>🧾 {isPromotionFullyInvoiced(promotion) ? 'Facturada' : 'Pendiente'}</Text>
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
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.invoiceButton, isPromotionFullyInvoiced(promotion) && styles.invoiceButtonDisabled]}
                      onPress={() => handleInvoicePromotion(promotion)}
                      disabled={isPromotionFullyInvoiced(promotion)}
                    >
                      <FileText size={16} color="#FFFFFF" />
                      <Text style={styles.invoiceButtonText}>{isPromotionFullyInvoiced(promotion) ? 'Facturada' : 'Facturar'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        promotion.isActive ? styles.toggleButtonOutline : styles.toggleButtonPrimary
                      ]}
                      onPress={() => handleTogglePromotion(promotion.id, promotion.isActive)}
                    >
                      <Text style={[
                        styles.toggleButtonText,
                        promotion.isActive ? styles.toggleButtonTextOutline : styles.toggleButtonTextPrimary
                      ]}>
                        {promotion.isActive ? 'Desactivar' : 'Activar'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.secondaryActionButton}
                      onPress={() => handleEditPromotion(promotion)}
                    >
                      <Pencil size={16} color="#374151" />
                      <Text style={styles.secondaryActionText}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.secondaryActionButton,
                        resendingApprovalPromotionId === promotion.id && styles.secondaryActionButtonDisabled,
                      ]}
                      onPress={() => handleResendApproval(promotion)}
                      disabled={resendingApprovalPromotionId === promotion.id}
                    >
                      {resendingApprovalPromotionId === promotion.id ? (
                        <>
                          <ActivityIndicator size="small" color="#374151" />
                          <Text style={styles.secondaryActionText}>Reenviando...</Text>
                        </>
                      ) : (
                        <>
                          <Send size={16} color="#374151" />
                          <Text style={styles.secondaryActionText}>Reenviar mail</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryActionDangerButton}
                      onPress={() => handleDeletePromotion(promotion.id)}
                    >
                      <Trash2 size={16} color="#FFFFFF" />
                      <Text style={styles.secondaryActionDangerText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Nueva Promoción</Text>
              <TouchableOpacity onPress={() => setShowPromotionModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
            >

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
                      onPress={() => openDatePicker('start')}
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
                      onPress={() => openDatePicker('end')}
                    >
                      <Calendar size={16} color="#6B7280" />
                      <Text style={styles.dateButtonText}>
                        {promoEndDate ? new Date(promoEndDate).toLocaleDateString() : 'Seleccionar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {Platform.OS !== 'ios' && showStartDatePicker && (
                  <DateTimePicker
                    value={promoStartDate ? new Date(promoStartDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowStartDatePicker(false);
                      if (selectedDate) {
                        setPromoStartDate(selectedDate.toISOString());
                        if (promoEndDate && new Date(promoEndDate) < selectedDate) {
                          setPromoEndDate(selectedDate.toISOString());
                        }
                      }
                    }}
                  />
                )}

                {Platform.OS !== 'ios' && showEndDatePicker && (
                  <DateTimePicker
                    value={promoEndDate ? new Date(promoEndDate) : new Date()}
                    mode="date"
                    display="default"
                    minimumDate={promoStartDate ? new Date(promoStartDate) : undefined}
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
                          onPress={openServiceSelector}
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
                          onPress={openProductSelector}
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
                          onPress={openPartnerSelector}
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

                    <Input
                      label={`ID del ${promoInternalType} (manual)`}
                      placeholder={`O ingresa manualmente el ID del ${promoInternalType}`}
                      value={promoInternalId}
                      onChangeText={setPromoInternalId}
                    />
                  </View>
                )}
              </View>

              {/* Partner Association */}
              <View style={styles.partnerSection}>
                <Text style={styles.partnerLabel}>Aliado asociado (opcional)</Text>
                <TouchableOpacity
                  style={styles.partnerSelector}
                  onPress={openPartnerSelector}
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
                <Input
                  label="Costo por vista (UYU)"
                  placeholder="Ej: 3.0"
                  value={costPerView}
                  onChangeText={setCostPerView}
                  keyboardType="numeric"
                />

                <Input
                  label="Costo por clic (UYU)"
                  placeholder="Ej: 35.0"
                  value={costPerClick}
                  onChangeText={setCostPerClick}
                  keyboardType="numeric"
                />

                <Input
                  label="Costo por like (UYU)"
                  placeholder="Ej: 12.5"
                  value={costPerLike}
                  onChangeText={setCostPerLike}
                  keyboardType="numeric"
                />

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
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.modalActions}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Cancelar"
                    onPress={() => {
                      setShowPromotionModal(false);
                      resetForm();
                    }}
                    variant="outline"
                    size="large"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                      title={editingPromotionId ? 'Guardar cambios' : 'Crear Promoción'}
                    onPress={handleCreatePromotion}
                    size="large"
                    loading={loading}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showIOSDateModal}
        transparent
        animationType="fade"
        onRequestClose={closeIOSDatePicker}
      >
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerCard}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>
                {iosDateField === 'start' ? 'Seleccionar fecha de inicio' : 'Seleccionar fecha de fin'}
              </Text>
            </View>

            <DateTimePicker
              value={iosSelectedDate}
              mode="date"
              display="inline"
              minimumDate={iosDateField === 'end' && promoStartDate ? new Date(promoStartDate) : undefined}
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setIosSelectedDate(selectedDate);
                }
              }}
            />

            <View style={styles.datePickerActions}>
              <View style={{ flex: 1 }}>
                <Button title="Cancelar" onPress={closeIOSDatePicker} variant="outline" />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Confirmar" onPress={applyIOSDatePicker} variant="primary" />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Partner Selection Modal */}
      <Modal
        visible={showPartnerModal}
        transparent
        animationType="slide"
        onRequestClose={closePartnerSelector}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectorModalContent}>
            <View style={styles.selectorModalHeader}>
              <Text style={styles.selectorModalTitle}>Seleccionar Aliado</Text>
              <TouchableOpacity onPress={closePartnerSelector}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.selectorSearchContainer}>
              <Input
                placeholder="Buscar aliado..."
                value={partnerSearchQuery}
                onChangeText={setPartnerSearchQuery}
                leftIcon={<Search size={20} color="#9CA3AF" />}
              />
            </View>

            <ScrollView
              style={styles.selectorList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.selectorListContent}
            >
              <TouchableOpacity
                style={styles.partnerOption}
                onPress={() => {
                  setSelectedPartnerId(null);
                  setPartnerSearchQuery('');
                  setShowPartnerModal(false);
                  setShowPromotionModal(true);
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
        onRequestClose={closeProductSelector}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectorModalContent}>
            <View style={styles.selectorModalHeader}>
              <Text style={styles.selectorModalTitle}>Seleccionar Producto</Text>
              <TouchableOpacity onPress={closeProductSelector}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.selectorSearchContainer}>
              <Input
                placeholder="Buscar producto..."
                value={productSearchQuery}
                onChangeText={setProductSearchQuery}
                leftIcon={<Search size={20} color="#9CA3AF" />}
              />
            </View>

            <ScrollView
              style={styles.selectorList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.selectorListContent}
            >
              {filteredProducts.length === 0 ? (
                <View style={styles.emptySelectorState}>
                  <Text style={styles.emptySelectorText}>No se encontraron productos</Text>
                </View>
              ) : (
                filteredProducts.map((product) => (
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
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Service Selection Modal */}
      <Modal
        visible={showServiceModal}
        transparent
        animationType="slide"
        onRequestClose={closeServiceSelector}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectorModalContent}>
            <View style={styles.selectorModalHeader}>
              <Text style={styles.selectorModalTitle}>Seleccionar Servicio</Text>
              <TouchableOpacity onPress={closeServiceSelector}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.selectorSearchContainer}>
              <Input
                placeholder="Buscar servicio..."
                value={serviceSearchQuery}
                onChangeText={setServiceSearchQuery}
                leftIcon={<Search size={20} color="#9CA3AF" />}
              />
            </View>

            <ScrollView
              style={styles.selectorList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.selectorListContent}
            >
              {filteredServices.length === 0 ? (
                <View style={styles.emptySelectorState}>
                  <Text style={styles.emptySelectorText}>No se encontraron servicios</Text>
                </View>
              ) : (
                filteredServices.map((service) => (
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
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Invoice Modal */}
      <Modal
        visible={showInvoiceModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowInvoiceModal(false);
          setInvoicePartnerSearchQuery('');
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generar Factura</Text>
              <TouchableOpacity onPress={() => {
                setShowInvoiceModal(false);
                setInvoicePartnerSearchQuery('');
              }}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedPromotionForInvoice && (
              <>
                <ScrollView
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.modalBodyContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.invoiceSection}>
                    <Text style={styles.invoiceSectionTitle}>Promoción</Text>
                    <Text style={styles.invoiceSectionValue}>{selectedPromotionForInvoice.title}</Text>
                  </View>

                  <View style={styles.invoiceSection}>
                    <Text style={styles.invoiceSectionTitle}>Estadísticas</Text>
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Vistas</Text>
                        <Text style={styles.statValue}>{selectedPromotionForInvoice.views || 0}</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Clics</Text>
                        <Text style={styles.statValue}>{selectedPromotionForInvoice.clicks || 0}</Text>
                      </View>
                    </View>
                    <View style={styles.invoiceStatusRow}>
                      {selectedViewsInvoiced && (
                        <View style={styles.invoiceStatusBadge}>
                          <Text style={styles.invoiceStatusText}>Vistas facturadas</Text>
                        </View>
                      )}
                      {selectedClicksInvoiced && (
                        <View style={styles.invoiceStatusBadge}>
                          <Text style={styles.invoiceStatusText}>Clics facturados</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.invoiceSection}>
                    <Text style={styles.invoiceSectionTitle}>Tipo de Facturación</Text>
                    <View style={styles.invoiceTypeContainer}>
                    <TouchableOpacity
                      style={[
                        styles.invoiceTypeButton,
                        invoiceType === 'views' && styles.invoiceTypeButtonActive,
                        !canInvoiceViews && styles.invoiceTypeButtonDisabled
                      ]}
                      onPress={() => setInvoiceType('views')}
                      disabled={!canInvoiceViews}
                    >
                      <Text style={[
                        styles.invoiceTypeButtonText,
                        invoiceType === 'views' && styles.invoiceTypeButtonTextActive,
                        !canInvoiceViews && styles.invoiceTypeButtonTextDisabled
                      ]}>Solo Vistas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.invoiceTypeButton,
                        invoiceType === 'clicks' && styles.invoiceTypeButtonActive,
                        !canInvoiceClicks && styles.invoiceTypeButtonDisabled
                      ]}
                      onPress={() => setInvoiceType('clicks')}
                      disabled={!canInvoiceClicks}
                    >
                      <Text style={[
                        styles.invoiceTypeButtonText,
                        invoiceType === 'clicks' && styles.invoiceTypeButtonTextActive,
                        !canInvoiceClicks && styles.invoiceTypeButtonTextDisabled
                      ]}>Solo Clics</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.invoiceTypeButton,
                        invoiceType === 'both' && styles.invoiceTypeButtonActive,
                        !canInvoiceBoth && styles.invoiceTypeButtonDisabled
                      ]}
                      onPress={() => setInvoiceType('both')}
                      disabled={!canInvoiceBoth}
                    >
                      <Text style={[
                        styles.invoiceTypeButtonText,
                        invoiceType === 'both' && styles.invoiceTypeButtonTextActive,
                        !canInvoiceBoth && styles.invoiceTypeButtonTextDisabled
                      ]}>Ambos</Text>
                    </TouchableOpacity>
                    </View>
                  </View>

                  {invoiceType !== 'clicks' && (
                    <View style={styles.invoiceSection}>
                    <Text style={styles.invoiceSectionTitle}>Precio por Vista ($)</Text>
                    <Input
                      value={pricePerView}
                      onChangeText={setPricePerView}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                    </View>
                  )}

                  {invoiceType !== 'views' && (
                    <View style={styles.invoiceSection}>
                    <Text style={styles.invoiceSectionTitle}>Precio por Clic ($)</Text>
                    <Input
                      value={pricePerClick}
                      onChangeText={setPricePerClick}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                    </View>
                  )}

                  <View style={styles.invoiceSection}>
                  <Text style={styles.invoiceSectionTitle}>Buscar aliado/partner</Text>
                  <Input
                    value={invoicePartnerSearchQuery}
                    onChangeText={setInvoicePartnerSearchQuery}
                    placeholder="Buscar por nombre del aliado"
                    leftIcon={<Search size={18} color="#9CA3AF" />}
                    autoCapitalize="none"
                  />
                  {filteredInvoicePartners.length > 0 && (
                    <View style={styles.invoicePartnerSuggestions}>
                      {filteredInvoicePartners.map((partner) => (
                        <TouchableOpacity
                          key={partner.id}
                          style={styles.invoicePartnerOption}
                          onPress={() => handleSelectInvoicePartner(partner)}
                        >
                          <Text style={styles.invoicePartnerName}>{partner.business_name}</Text>
                          <Text style={styles.invoicePartnerEmail}>{partner.email || 'Sin email configurado'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  </View>

                  <View style={styles.invoiceSection}>
                  <Text style={styles.invoiceSectionTitle}>Email del destinatario</Text>
                  <Input
                    value={invoiceEmail}
                    onChangeText={setInvoiceEmail}
                    placeholder="email@ejemplo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  </View>

                  {pricePerView && invoiceType !== 'clicks' && (
                    <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>Subtotal Vistas:</Text>
                    <Text style={styles.totalValue}>
                      ${((selectedPromotionForInvoice.views || 0) * parseFloat(pricePerView)).toFixed(2)}
                    </Text>
                    </View>
                  )}

                  {pricePerClick && invoiceType !== 'views' && (
                    <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>Subtotal Clics:</Text>
                    <Text style={styles.totalValue}>
                      ${((selectedPromotionForInvoice.clicks || 0) * parseFloat(pricePerClick)).toFixed(2)}
                    </Text>
                    </View>
                  )}

                  {((pricePerView && invoiceType !== 'clicks') || (pricePerClick && invoiceType !== 'views')) && (
                    <View style={styles.totalSectionMain}>
                    <Text style={styles.totalLabelMain}>Total:</Text>
                    <Text style={styles.totalValueMain}>
                      ${(
                        (invoiceType !== 'clicks' ? (selectedPromotionForInvoice.views || 0) * parseFloat(pricePerView || '0') : 0) +
                        (invoiceType !== 'views' ? (selectedPromotionForInvoice.clicks || 0) * parseFloat(pricePerClick || '0') : 0)
                      ).toFixed(2)}
                    </Text>
                    </View>
                  )}
                </ScrollView>

              <View style={styles.modalFooter}>
                <View style={styles.modalActions}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Cancelar"
                      onPress={() => {
                        setShowInvoiceModal(false);
                        setInvoicePartnerSearchQuery('');
                      }}
                      variant="outline"
                      disabled={loading}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={loading ? "Generando..." : "Generar y Enviar"}
                      onPress={handleGenerateInvoice}
                      variant="primary"
                      disabled={loading}
                    />
                  </View>
                </View>
              </View>
            </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      )}
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
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  secondaryActionButtonDisabled: {
    opacity: 0.7,
  },
  secondaryActionText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  secondaryActionDangerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  secondaryActionDangerText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  invoiceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  invoiceButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  invoiceButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleButtonPrimary: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  toggleButtonOutline: {
    backgroundColor: 'transparent',
    borderColor: '#DC2626',
  },
  toggleButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  toggleButtonTextPrimary: {
    color: '#FFFFFF',
  },
  toggleButtonTextOutline: {
    color: '#DC2626',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
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
    width: '100%',
    maxWidth: 500,
    height: '90%',
    alignSelf: 'center',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalBody: {
    flex: 1,
    minHeight: 200,
  },
  modalBodyContent: {
    padding: 20,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  partnerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '80%',
    marginTop: '20%',
  },
  selectorModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    width: '100%',
    maxWidth: 560,
    height: '78%',
    minHeight: 420,
    maxHeight: '82%',
    overflow: 'hidden',
  },
  selectorModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  selectorModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  selectorSearchContainer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  selectorList: {
    flex: 1,
    minHeight: 220,
  },
  selectorListContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  datePickerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  datePickerHeader: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  partnersList: {
    maxHeight: 400,
    marginTop: 16,
  },
  partnerOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
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
    fontSize: 15,
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
  emptySelectorState: {
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  emptySelectorText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
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
  invoiceSection: {
    marginBottom: 20,
  },
  invoiceSectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  invoiceSectionValue: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  invoiceStatusRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  invoiceStatusBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  invoiceStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
  },
  statItem: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  invoiceTypeContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  invoiceTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  invoiceTypeButtonActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  invoiceTypeButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  invoiceTypeButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  invoiceTypeButtonTextActive: {
    color: '#DC2626',
    fontFamily: 'Inter-SemiBold',
  },
  invoiceTypeButtonTextDisabled: {
    color: '#9CA3AF',
  },
  invoicePartnerSuggestions: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginTop: -8,
    overflow: 'hidden',
  },
  invoicePartnerOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  invoicePartnerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  invoicePartnerEmail: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  totalSectionMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  totalLabelMain: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  totalValueMain: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
