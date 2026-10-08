import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Image, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { Badge, EmptyState, SkeletonList, toast } from '../../components/ui';
import { BusinessTypeIcon } from '../../components/admin/BusinessTypeIcon';
import { ReviewStatusBadge } from '../../components/admin/ReviewStatusBadge';
import { Plus, Volume2, Search, Calendar, ExternalLink, Building, X, FileText, Pencil, Trash2, Send, Eye, MousePointerClick, Receipt, Camera, Image as ImageIcon, Package, Wrench, Check } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radius, spacing, typography } from '../../constants/theme';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
};

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
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    const isAdmin = currentUser?.isAdmin === true;
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
    } finally {
      setInitialLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPromotions();
    } finally {
      setRefreshing(false);
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
      Alert.alert('Error', 'Completá todos los campos obligatorios');
      console.log('❌ Validation failed - missing required fields');
      return;
    }

    if (selectedPartnerId && (!costPerView || !costPerClick)) {
      Alert.alert('Error', 'Para enviar a aprobación tenés que ingresar el costo por vista y el costo por clic');
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
      toast.success(selectedPartnerId
        ? (isEditMode ? 'Promoción editada correctamente' : 'Promoción creada y solicitud de aprobación enviada al aliado')
        : (isEditMode ? 'Promoción editada correctamente' : 'Promoción creada correctamente'));
      console.log('✅ Promotion creation completed successfully');
    } catch (error) {
      console.error('ERROR in handleCreatePromotion:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', getErrorMessage(error));
      console.error('Error stack:', error instanceof Error ? error.stack : undefined);
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
      Alert.alert('Selección inválida', 'No podés facturar ambos si las vistas o los clics ya fueron facturados.');
      return;
    }

    // Validate inputs
    if (invoiceType === 'views' && !pricePerView) {
      Alert.alert('Error', 'Ingresá el precio por vista');
      return;
    }
    if (invoiceType === 'clicks' && !pricePerClick) {
      Alert.alert('Error', 'Ingresá el precio por clic');
      return;
    }
    if (invoiceType === 'both' && (!pricePerView || !pricePerClick)) {
      Alert.alert('Error', 'Ingresá ambos precios');
      return;
    }
    if (!invoiceEmail) {
      Alert.alert('Error', 'Ingresá un email');
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

      toast.success('Factura generada', `Enviada a ${invoiceEmail}`);
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
        error.message || 'No se pudo generar la factura. Intentá de nuevo.'
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
      '¿Seguro que querés eliminar esta promoción? Esta acción no se puede deshacer.',
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
              toast.success('Promoción eliminada');
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

      toast.success('Solicitud de aprobación reenviada al aliado');
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

  const getBusinessTypeIcon = (type: string, size = 28) => <BusinessTypeIcon type={type} size={size} />;

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

  const isAdmin = currentUser?.isAdmin === true;
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedTitle}>Acceso denegado</Text>
          <Text style={styles.accessDeniedText}>
            No tenés permisos para acceder a esta sección
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Gestión de promociones</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Crear promoción"
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setShowPromotionModal(true);
          }}
        >
          <Plus size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <View style={styles.searchContainer}>
          <Input
            placeholder="Buscar promociones..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={20} color={colors.textTertiary} />}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Promociones ({filteredPromotions.length})</Text>

          {initialLoading ? (
            <SkeletonList kind="cards" count={3} style={styles.skeleton} />
          ) : filteredPromotions.length === 0 ? (
            <EmptyState
              icon={<Volume2 size={32} color={colors.primary} />}
              title={searchQuery ? 'No se encontraron promociones' : 'No hay promociones'}
              description={searchQuery ? 'Probá con otros términos de búsqueda' : 'Creá la primera promoción para la plataforma'}
              actionLabel={searchQuery ? 'Limpiar búsqueda' : 'Crear promoción'}
              onAction={searchQuery ? () => setSearchQuery('') : () => {
                resetForm();
                setShowPromotionModal(true);
              }}
            />
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
                        <View style={styles.bizIconWrap}>{getBusinessTypeIcon(promotion.partnerInfo.businessType)}</View>
                        <Text style={styles.partnerName}>
                          {promotion.partnerInfo.businessName}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.promotionStatus}>
                    <Badge
                      tone={promotion.isActive ? 'success' : 'neutral'}
                      label={promotion.isActive ? 'Activa' : 'Inactiva'}
                      style={styles.statusBadgeSpacing}
                    />
                    {(promotion.approvalStatus === 'pending' || promotion.approvalStatus === 'rejected') && (
                      <View style={styles.statusBadgeSpacing}>
                        <ReviewStatusBadge
                          status={promotion.approvalStatus}
                          label={promotion.approvalStatus === 'pending' ? 'Aprobación pendiente' : 'Rechazada'}
                        />
                      </View>
                    )}

                    <View style={styles.promotionStats}>
                      <View style={styles.statRow} accessibilityLabel={`${promotion.views || 0} vistas`}>
                        <Eye size={14} color={colors.textTertiary} />
                        <Text style={styles.statText}>{promotion.views || 0}</Text>
                      </View>
                      <View style={styles.statRow} accessibilityLabel={`${promotion.clicks || 0} clics`}>
                        <MousePointerClick size={14} color={colors.textTertiary} />
                        <Text style={styles.statText}>{promotion.clicks || 0}</Text>
                      </View>
                      <View style={styles.statRow}>
                        <Receipt size={14} color={colors.textTertiary} />
                        <Text style={styles.statText}>{isPromotionFullyInvoiced(promotion) ? 'Facturada' : 'Sin facturar'}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {promotion.imageURL && (
                  <Image source={{ uri: promotion.imageURL }} style={styles.promotionImage} />
                )}

                <View style={styles.promotionDates}>
                  <View style={styles.statRow}>
                    <Calendar size={14} color={colors.textTertiary} />
                    <Text style={styles.dateText}>
                      {promotion.startDate.toLocaleDateString()} - {promotion.endDate.toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[
                    styles.activeStatus,
                    { color: isPromotionActive(promotion.startDate, promotion.endDate) ? colors.success : colors.danger }
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
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isPromotionFullyInvoiced(promotion) }}
                    >
                      <FileText size={16} color={colors.white} />
                      <Text style={styles.invoiceButtonText}>{isPromotionFullyInvoiced(promotion) ? 'Facturada' : 'Facturar'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        promotion.isActive ? styles.toggleButtonOutline : styles.toggleButtonPrimary
                      ]}
                      onPress={() => handleTogglePromotion(promotion.id, promotion.isActive)}
                      accessibilityRole="button"
                      accessibilityLabel={`${promotion.isActive ? 'Desactivar' : 'Activar'} ${promotion.title}`}
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
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${promotion.title}`}
                    >
                      <Pencil size={16} color={colors.textSecondary} />
                      <Text style={styles.secondaryActionText}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.secondaryActionButton,
                        resendingApprovalPromotionId === promotion.id && styles.secondaryActionButtonDisabled,
                      ]}
                      onPress={() => handleResendApproval(promotion)}
                      disabled={resendingApprovalPromotionId === promotion.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Reenviar mail de aprobación de ${promotion.title}`}
                    >
                      {resendingApprovalPromotionId === promotion.id ? (
                        <>
                          <ActivityIndicator size="small" color={colors.textSecondary} />
                          <Text style={styles.secondaryActionText}>Reenviando...</Text>
                        </>
                      ) : (
                        <>
                          <Send size={16} color={colors.textSecondary} />
                          <Text style={styles.secondaryActionText}>Reenviar mail</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryActionDangerButton}
                      onPress={() => handleDeletePromotion(promotion.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Eliminar ${promotion.title}`}
                    >
                      <Trash2 size={16} color={colors.danger} />
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
              <Text style={styles.modalTitle}>{editingPromotionId ? 'Editar promoción' : 'Crear nueva promoción'}</Text>
              <TouchableOpacity onPress={() => setShowPromotionModal(false)} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color={colors.textTertiary} />
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
                placeholder="Describí la promoción..."
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
                      <Camera size={24} color={colors.textTertiary} />
                      <Text style={styles.imageActionText}>Tomar foto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageActionButton} onPress={handleSelectImage}>
                      <ImageIcon size={24} color={colors.textTertiary} />
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
                      <Calendar size={16} color={colors.textTertiary} />
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
                      <Calendar size={16} color={colors.textTertiary} />
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
                    leftIcon={<ExternalLink size={20} color={colors.textTertiary} />}
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
                          <Search size={16} color={colors.textTertiary} />
                        </TouchableOpacity>

                        {selectedService && (
                          <View style={styles.selectedItemInfo}>
                            <Text style={styles.selectedItemName}>{selectedService.name}</Text>
                            <Text style={styles.selectedItemPrice}>{formatPrice(selectedService.price)}</Text>
                            <TouchableOpacity onPress={() => {
                              setSelectedServiceId(null);
                              setPromoInternalId('');
                            }} accessibilityRole="button" accessibilityLabel="Quitar selección" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              <X size={16} color={colors.textSecondary} />
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
                          <Search size={16} color={colors.textTertiary} />
                        </TouchableOpacity>

                        {selectedProduct && (
                          <View style={styles.selectedItemInfo}>
                            <Text style={styles.selectedItemName}>{selectedProduct.name}</Text>
                            <Text style={styles.selectedItemPrice}>{formatPrice(selectedProduct.price)}</Text>
                            <TouchableOpacity onPress={() => {
                              setSelectedProductId(null);
                              setPromoInternalId('');
                            }} accessibilityRole="button" accessibilityLabel="Quitar selección" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              <X size={16} color={colors.textSecondary} />
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
                          <Search size={16} color={colors.textTertiary} />
                        </TouchableOpacity>

                        {selectedPartner && (
                          <View style={styles.selectedItemInfo}>
                            <View style={styles.bizIconWrap}>{getBusinessTypeIcon(selectedPartner.business_type)}</View>
                            <Text style={styles.selectedItemName}>{selectedPartner.business_name}</Text>
                            <TouchableOpacity onPress={() => {
                              setSelectedPartnerId(null);
                              setPromoInternalId('');
                            }} accessibilityRole="button" accessibilityLabel="Quitar selección" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              <X size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    <Input
                      label={`ID del ${promoInternalType} (manual)`}
                      placeholder={`O ingresá manualmente el ID del ${promoInternalType}`}
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
                  <Building size={20} color={colors.textTertiary} />
                  <Text style={styles.partnerSelectorText}>
                    {selectedPartner ? selectedPartner.business_name : 'Seleccionar aliado'}
                  </Text>
                </TouchableOpacity>

                {selectedPartner && (
                  <View style={styles.selectedPartnerInfo}>
                    <View style={styles.bizIconWrap}>{getBusinessTypeIcon(selectedPartner.business_type)}</View>
                    <Text style={styles.selectedPartnerName}>
                      {selectedPartner.business_name}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedPartnerId(null)} accessibilityRole="button" accessibilityLabel="Quitar selección" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <X size={16} color={colors.textSecondary} />
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
                    {hasDiscount && <Check size={14} color={colors.white} />}
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
                      Ingresá solo el número (ej: 15 para 15% de descuento)
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
              <Text style={styles.selectorModalTitle}>Seleccionar aliado</Text>
              <TouchableOpacity onPress={closePartnerSelector} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.selectorSearchContainer}>
              <Input
                placeholder="Buscar aliado..."
                value={partnerSearchQuery}
                onChangeText={setPartnerSearchQuery}
                leftIcon={<Search size={20} color={colors.textTertiary} />}
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
                    <View style={styles.bizIconWrap}>{getBusinessTypeIcon(partner.business_type)}</View>
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
              <Text style={styles.selectorModalTitle}>Seleccionar producto</Text>
              <TouchableOpacity onPress={closeProductSelector} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.selectorSearchContainer}>
              <Input
                placeholder="Buscar producto..."
                value={productSearchQuery}
                onChangeText={setProductSearchQuery}
                leftIcon={<Search size={20} color={colors.textTertiary} />}
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
                          <Package size={20} color={colors.textTertiary} />
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
              <Text style={styles.selectorModalTitle}>Seleccionar servicio</Text>
              <TouchableOpacity onPress={closeServiceSelector} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.selectorSearchContainer}>
              <Input
                placeholder="Buscar servicio..."
                value={serviceSearchQuery}
                onChangeText={setServiceSearchQuery}
                leftIcon={<Search size={20} color={colors.textTertiary} />}
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
                          <Wrench size={20} color={colors.textTertiary} />
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
              <Text style={styles.modalTitle}>Generar factura</Text>
              <TouchableOpacity onPress={() => {
                setShowInvoiceModal(false);
                setInvoicePartnerSearchQuery('');
              }}>
                <X size={24} color={colors.textTertiary} />
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
                      ]}>Solo vistas</Text>
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
                      ]}>Solo clics</Text>
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
                    leftIcon={<Search size={18} color={colors.textTertiary} />}
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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bizIconWrap: {
    marginRight: spacing.sm,
  },
  skeleton: {
    paddingTop: 0,
  },
  statusBadgeSpacing: {
    alignSelf: 'flex-end',
    marginBottom: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: radius.pill,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  promotionCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  promotionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  promotionInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  promotionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  promotionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerIcon: {
    ...typography.body,
    marginRight: 6,
  },
  partnerName: {
    ...typography.label,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primary,
  },
  promotionStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  statusText: {
    ...typography.caption,
  },
  promotionStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  promotionImage: {
    width: '100%',
    height: 120,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    resizeMode: 'cover',
  },
  promotionDates: {
    marginBottom: spacing.md,
  },
  dateText: {
    ...typography.bodySmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  activeStatus: {
    ...typography.captionStrong,
  },
  promotionActions: {
    marginTop: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: radius.md,
    gap: 6,
    marginTop: spacing.sm,
  },
  secondaryActionButtonDisabled: {
    opacity: 0.7,
  },
  secondaryActionText: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  secondaryActionDangerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: radius.md,
    gap: 6,
    marginTop: spacing.sm,
  },
  secondaryActionDangerText: {
    ...typography.captionStrong,
    color: colors.danger,
  },
  invoiceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    gap: 6,
  },
  invoiceButtonDisabled: {
    backgroundColor: colors.textTertiary,
  },
  invoiceButtonText: {
    ...typography.label,
    color: colors.white,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  toggleButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleButtonOutline: {
    backgroundColor: 'transparent',
    borderColor: colors.primary,
  },
  toggleButtonText: {
    ...typography.label,
  },
  toggleButtonTextPrimary: {
    color: colors.white,
  },
  toggleButtonTextOutline: {
    color: colors.primary,
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  accessDeniedTitle: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 32,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  accessDeniedText: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 40,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 40,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
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
    padding: spacing.xl,
  },
  modalFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  partnerModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    height: '80%',
    marginTop: '20%',
  },
  selectorModalContent: {
    backgroundColor: colors.surface,
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
    borderBottomColor: colors.border,
  },
  selectorModalTitle: {
    ...typography.heading,
    color: colors.text,
  },
  selectorSearchContainer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  selectorList: {
    flex: 1,
    minHeight: 220,
  },
  selectorListContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.heading,
    color: colors.text,
  },
  imageSection: {
    marginBottom: spacing.xl,
  },
  imageLabel: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  imagePreviewContainer: {
    marginBottom: spacing.md,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  changeImageButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    alignSelf: 'center',
  },
  changeImageText: {
    ...typography.label,
    color: colors.white,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  imageActionButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  imageActionIcon: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 43,
    marginBottom: spacing.sm,
  },
  imageActionText: {
    ...typography.label,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  dateSection: {
    marginBottom: spacing.xl,
  },
  dateLabel: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateInput: {
    flex: 1,
  },
  dateInputLabel: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: 6,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  dateButtonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  datePickerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  datePickerHeader: {
    paddingHorizontal: 18,
    paddingTop: spacing.lg,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkSection: {
    marginBottom: spacing.xl,
  },
  linkLabel: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  linkTypeSelector: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  linkTypeOption: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  selectedLinkType: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  linkTypeText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  selectedLinkTypeText: {
    color: colors.white,
  },
  internalLinkSection: {
    marginTop: spacing.md,
  },
  internalLinkLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  internalTypeSelector: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: 6,
  },
  internalTypeOption: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedInternalType: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  internalTypeText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  selectedInternalTypeText: {
    color: colors.white,
  },
  selectorSection: {
    marginBottom: spacing.lg,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  selectorButtonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  selectedItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  selectedItemIcon: {
    ...typography.body,
    marginRight: spacing.sm,
  },
  selectedItemName: {
    ...typography.label,
    color: colors.primaryStrong,
    flex: 1,
  },
  selectedItemPrice: {
    ...typography.captionStrong,
    color: colors.success,
    marginRight: spacing.sm,
  },
  removeItemText: {
    ...typography.body,
    color: colors.textTertiary,
    padding: spacing.xs,
  },
  partnerSection: {
    marginBottom: spacing.xl,
  },
  partnerLabel: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  partnerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  partnerSelectorText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  selectedPartnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  selectedPartnerIcon: {
    ...typography.body,
    marginRight: spacing.sm,
  },
  selectedPartnerName: {
    ...typography.label,
    color: colors.primaryStrong,
    flex: 1,
  },
  removePartnerText: {
    ...typography.body,
    color: colors.textTertiary,
    padding: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  partnersList: {
    maxHeight: 400,
    marginTop: spacing.lg,
  },
  partnerOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  partnerOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerOptionIcon: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    marginRight: spacing.md,
  },
  partnerOptionInfo: {
    flex: 1,
  },
  partnerOptionName: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  partnerOptionType: {
    ...typography.bodySmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
  },
  partnerOptionText: {
    ...typography.body,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  emptySelectorState: {
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
  },
  emptySelectorText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  productImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  productImagePlaceholderText: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
  },
  discountSection: {
    marginBottom: spacing.xl,
  },
  discountCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    ...typography.captionStrong,
    color: colors.white,
  },
  discountCheckboxLabel: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.md,
  },
  discountInputContainer: {
    marginTop: spacing.sm,
  },
  discountHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  invoiceSection: {
    marginBottom: spacing.xl,
  },
  invoiceSectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  invoiceSectionValue: {
    ...typography.body,
    color: colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  invoiceStatusRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  invoiceStatusBadge: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
  },
  invoiceStatusText: {
    ...typography.captionStrong,
    color: colors.warning,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 32,
    color: colors.text,
  },
  invoiceTypeContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  invoiceTypeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  invoiceTypeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  invoiceTypeButtonDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  invoiceTypeButtonText: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  invoiceTypeButtonTextActive: {
    color: colors.primary,
    fontFamily: 'Inter-SemiBold',
  },
  invoiceTypeButtonTextDisabled: {
    color: colors.textTertiary,
  },
  invoicePartnerSuggestions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: -8,
    overflow: 'hidden',
  },
  invoicePartnerOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  invoicePartnerName: {
    ...typography.label,
    color: colors.text,
  },
  invoicePartnerEmail: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  totalLabel: {
    ...typography.label,
    color: colors.textTertiary,
  },
  totalValue: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  totalSectionMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  totalLabelMain: {
    ...typography.bodyStrong,
    color: colors.white,
  },
  totalValueMain: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 32,
    color: colors.white,
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
