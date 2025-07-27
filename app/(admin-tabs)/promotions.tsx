import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Image } from 'react-native';
import { Plus, Megaphone, Calendar, Eye, Target, Search, DollarSign, FileText } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { NotificationService } from '../../utils/notifications';
import jsPDF from 'jspdf';

export default function AdminPromotions() {
  const { currentUser } = useAuth();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showPartnerSelector, setShowPartnerSelector] = useState(false);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  // Promotion form state
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoImage, setPromoImage] = useState<string | null>(null);
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate, setPromoEndDate] = useState('');
  const [promoTargetAudience, setPromoTargetAudience] = useState('all');
  const [loading, setLoading] = useState(false);
  const [promoUrl, setPromoUrl] = useState('');

  // Promotion form
  const [promoLinkType, setPromoLinkType] = useState<'external' | 'internal' | 'none'>('none');
  const [internalLinkType, setInternalLinkType] = useState<'service' | 'product' | 'partner'>('partner');
  const [selectedInternalId, setSelectedInternalId] = useState<string | null>(null);
  const [internalItems, setInternalItems] = useState<any[]>([]);

  // Billing state
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [selectedPromotionForBilling, setSelectedPromotionForBilling] = useState<any>(null);
  const [costPerClick, setCostPerClick] = useState('100');
  const [billingNotes, setBillingNotes] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);

  const [partners, setPartners] = useState<any[]>([]);

  function getSelectedPartner() {
    return partners.find(p => p.id === selectedPartnerId) || null;
  }

  function getFilteredPartners() {
    if (!partnerSearchQuery) return partners;
    return partners.filter(p =>
      p.businessName.toLowerCase().includes(partnerSearchQuery.toLowerCase()) ||
      p.businessType.toLowerCase().includes(partnerSearchQuery.toLowerCase())
    );
  }

  function getBusinessTypeIcon(type: string) {
    if (type === 'Tienda') return '🏪';
    if (type === 'Veterinaria') return '🐾';
    return '🏢';
  }

  useEffect(() => {
    if (!currentUser) {
      console.log('No current user in promotions');
      return;
    }
    const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
    if (!isAdmin) {
      console.log('User is not admin in promotions');
      return;
    }
    fetchPromotions();
    fetchPartners();
  }, [currentUser]);

  useEffect(() => {
    if (promoLinkType === 'internal') {
      fetchInternalItems();
    }
  }, [internalLinkType, promoLinkType]);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('id, business_name, business_type, logo, is_verified, is_active')
        .eq('is_verified', true)
        .eq('is_active', true)
        .order('business_name', { ascending: true });
      
      if (error) throw error;
      
      const partnersData = data?.map(partner => ({
        id: partner.id,
        businessName: partner.business_name,
        businessType: partner.business_type,
        logo: partner.logo
      })) || [];
      
      setPartners(partnersData);
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const fetchInternalItems = async () => {
    try {
      let data, error;
      
      if (internalLinkType === 'service') {
        const result = await supabaseClient
          .from('partner_services')
          .select(`
            id, 
            name, 
            price,
            partners!inner(business_name)
          `)
          .eq('is_active', true)
          .order('name', { ascending: true });
        data = result.data;
        error = result.error;
      } else if (internalLinkType === 'product') {
        const result = await supabaseClient
          .from('partner_products')
          .select(`
            id, 
            name, 
            price,
            partners!inner(business_name)
          `)
          .eq('is_active', true)
          .order('name', { ascending: true });
        data = result.data;
        error = result.error;
      } else if (internalLinkType === 'partner') {
        const result = await supabaseClient
          .from('partners')
          .select('id, business_name, business_type')
          .eq('is_verified', true)
          .eq('is_active', true)
          .order('business_name', { ascending: true });
        data = result.data;
        error = result.error;
      }
      
      if (error) throw error;
      setInternalItems(data || []);
    } catch (error) {
      console.error('Error fetching internal items:', error);
      setInternalItems([]);
    }
  };

  const fetchPromotions = () => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('promotions')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) return;
        const promotionsData = data?.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          imageURL: item.image_url,
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
      } catch (error) {}
    };
    fetchData();
    const subscription = supabaseClient
      .channel('promotions_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'promotions' },
        () => fetchData()
      )
      .subscribe();
    return () => subscription.unsubscribe();
  };

  const handleSelectImage = async () => {
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
  };

  const handleTakePhoto = async () => {
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
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const filename = `promotions/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const { error } = await supabaseClient.storage
      .from('dogcatify')
      .upload(filename, blob);
    if (error) throw error;
    const { data: { publicUrl } } = supabaseClient.storage
      .from('dogcatify')
      .getPublicUrl(filename);
    return publicUrl;
  };

  const handleCreatePromotion = async () => {
    console.log('Starting promotion creation...');
    console.log('Form data:', {
      promoTitle,
      promoDescription,
      promoStartDate,
      promoEndDate,
      promoImage: !!promoImage,
      promoLinkType,
      selectedPartnerId
    });
    
    if (!promoTitle || !promoDescription || !promoStartDate || !promoEndDate) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios: título, descripción, fecha de inicio y fecha de fin');
      return;
    }
    
    // Validate dates
    const startDate = new Date(promoStartDate);
    const endDate = new Date(promoEndDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      Alert.alert('Error', 'Las fechas ingresadas no son válidas. Usa el formato YYYY-MM-DD');
      return;
    }
    
    if (endDate <= startDate) {
      Alert.alert('Error', 'La fecha de fin debe ser posterior a la fecha de inicio');
      return;
    }
    
    // Validate URL if external link is selected
    if (promoLinkType === 'external' && !promoUrl.trim()) {
      Alert.alert('Error', 'Por favor ingresa una URL válida');
      return;
    }
    
    // Validate internal link if selected
    if (promoLinkType === 'internal' && !selectedInternalId) {
      Alert.alert('Error', 'Por favor selecciona un elemento interno');
      return;
    }
    
    setLoading(true);
    try {
      console.log('Uploading image...');
      let imageUrl = null;
      if (promoImage) {
        try {
          imageUrl = await uploadImage(promoImage);
          console.log('Image uploaded successfully:', imageUrl);
        } catch (imageError) {
          console.error('Error uploading image:', imageError);
          Alert.alert('Error', 'No se pudo subir la imagen. Intenta con otra imagen.');
          setLoading(false);
          return;
        }
      }
      
      // Generate CTA URL based on link type
      console.log('Generating CTA URL...');
      let ctaUrl = null;
      if (promoLinkType === 'external') {
        ctaUrl = promoUrl.trim();
      } else if (promoLinkType === 'internal' && selectedInternalId) {
        if (internalLinkType === 'service') {
          ctaUrl = `dogcatify://services/${selectedInternalId}`;
        } else if (internalLinkType === 'product') {
          ctaUrl = `dogcatify://products/${selectedInternalId}`;
        } else if (internalLinkType === 'partner') {
          ctaUrl = `dogcatify://partners/${selectedInternalId}`;
        }
      }
      
      console.log('Creating promotion data...');
      const promotionData: any = {
        title: promoTitle.trim(),
        description: promoDescription.trim(),
        image_url: imageUrl,
        cta_url: ctaUrl,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        target_audience: promoTargetAudience,
        is_active: true,
        views: 0,
        clicks: 0,
        likes: [],
        promotion_type: 'feed',
        cta_text: 'Más información',
        created_at: new Date().toISOString(),
        created_by: currentUser?.id,
      };
      
      if (selectedPartnerId) {
        promotionData.partner_id = selectedPartnerId;
      }
      
      console.log('Inserting promotion into database...', promotionData);
      const { data, error } = await supabaseClient
        .from('promotions')
        .insert([promotionData]);
      
      if (error) {
        console.error('Database error:', error);
        Alert.alert('Error', `Error de base de datos: ${error.message || 'Error desconocido'}`);
        return;
      }
      
      console.log('Promotion created successfully:', data);
      
      // Reset form
      setPromoTitle('');
      setPromoDescription('');
      setPromoImage(null);
      setPromoStartDate('');
      setPromoEndDate('');
      setPromoTargetAudience('all');
      setPromoUrl('');
      setPromoLinkType('none');
      setSelectedInternalId(null);
      setSelectedPartnerId(null);
      setPartnerSearchQuery('');
      setShowPromotionModal(false);
      
      // Refresh promotions list
      fetchPromotions();
      
      Alert.alert('Éxito', 'Promoción creada correctamente');
    } catch (error) {
      console.error('Unexpected error creating promotion:', error);
      Alert.alert('Error', `Error inesperado: ${error.message || 'No se pudo crear la promoción'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePromotion = async (promotionId: string, isActive: boolean) => {
    try {
      const { error } = await supabaseClient
        .from('promotions')
        .update({ is_active: !isActive })
        .eq('id', promotionId);
      
      if (error) {
        throw error;
      }
      
      // Actualiza el estado local después del éxito
      setPromotions(prev => prev.map(promo => 
        promo.id === promotionId 
          ? { ...promo, isActive: !isActive }
          : promo
      ));
    } catch (error) {
      console.error('Error updating promotion status:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado de la promoción');
    }
  };

  const handleGenerateBilling = async (promotion: any) => {
    if (!promotion.partnerId) {
      Alert.alert('Error', 'Esta promoción no tiene un aliado asociado');
      return;
    }

    if (!promotion.clicks || promotion.clicks === 0) {
      Alert.alert('Sin clicks', 'Esta promoción no tiene clicks registrados para facturar');
      return;
    }

    setSelectedPromotionForBilling(promotion);
    setCostPerClick('100'); // Default cost per click
    setBillingNotes('');
    setShowBillingModal(true);
  };

  const handleCreateBilling = async () => {
    if (!selectedPromotionForBilling || !costPerClick) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setBillingLoading(true);
    try {
      console.log('=== BILLING EMAIL DEBUG ===');
      console.log('Selected promotion:', selectedPromotionForBilling.title);
      console.log('Clicks:', selectedPromotionForBilling.clicks);
      
      // Get partner email from database
      const { data: partnerData, error: partnerError } = await supabaseClient
        .from('partners')
        .select('email, business_name')
        .eq('id', selectedPromotionForBilling.partnerId)
        .single();
      
      if (partnerError || !partnerData) {
        console.error('Error fetching partner data:', partnerError);
        Alert.alert('Error', 'No se pudo obtener la información del aliado');
        return;
      }
      
      if (!partnerData.email) {
        Alert.alert('Error', 'El aliado no tiene un correo electrónico registrado');
        return;
      }
      
      console.log('Partner email found:', partnerData.email);
      
      // Calculate billing amount
      const totalClicks = selectedPromotionForBilling.clicks || 0;
      const costPerClickNum = parseFloat(costPerClick) || 100;
      const totalAmount = totalClicks * costPerClickNum;
      
      console.log('Total amount calculated:', totalAmount);
      
      // Generate invoice HTML content for email
      const invoiceHTML = generateInvoiceHTML(selectedPromotionForBilling, totalClicks, costPerClickNum, totalAmount, partnerData.business_name);
      console.log('Invoice HTML generated');
      
      // Send email with invoice content
      const emailResult = await sendBillingEmail(partnerData.email, selectedPromotionForBilling, invoiceHTML, totalAmount, partnerData.business_name);
      
      if (emailResult.success) {
        // Save billing record to database
        await saveBillingRecord(selectedPromotionForBilling, totalClicks, costPerClickNum, totalAmount);
        
        Alert.alert(
          'Factura enviada',
          `Se ha enviado la factura por $${totalAmount.toLocaleString()} a ${partnerData.email}`
        );
        
        setSelectedPromotionForBilling(null);
        setShowBillingModal(false);
      } else {
        throw new Error(emailResult.error || 'Error al enviar el email');
      }
    } catch (error) {
      console.error('Error sending billing email:', error);
      Alert.alert('Error', 'No se pudo enviar la factura: ' + error.message);
    } finally {
      setBillingLoading(false);
    }
  };
  
  const generateInvoiceHTML = (promotion: any, clicks: number, costPerClick: number, totalAmount: number, businessName: string) => {
    const invoiceNumber = `INV-${Date.now()}`;
    const currentDate = new Date().toLocaleDateString('es-ES');
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2D6A6F; padding-bottom: 20px;">
          <h1 style="color: #2D6A6F; margin: 0; font-size: 24px;">DogCatiFy</h1>
          <p style="margin: 5px 0; color: #666;">Plataforma de Servicios para Mascotas</p>
          <h2 style="color: #2D6A6F; margin: 15px 0 0 0; font-size: 20px;">FACTURA DE PROMOCIÓN</h2>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin: 20px 0; flex-wrap: wrap;">
          <div style="width: 45%; min-width: 200px;">
            <h3 style="color: #2D6A6F; margin-bottom: 10px;">Facturar a:</h3>
            <p style="margin: 5px 0;"><strong>Aliado:</strong> ${businessName}</p>
            <p style="margin: 5px 0;"><strong>Promoción:</strong> ${promotion.title}</p>
          </div>
          <div style="width: 45%; min-width: 200px;">
            <h3 style="color: #2D6A6F; margin-bottom: 10px;">Detalles de Factura:</h3>
            <p style="margin: 5px 0;"><strong>Número:</strong> ${invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${currentDate}</p>
            <p style="margin: 5px 0;"><strong>Período:</strong> ${promotion.startDate.toLocaleDateString()} - ${promotion.endDate.toLocaleDateString()}</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold;">Descripción</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: bold;">Cantidad</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold;">Precio Unitario</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px;">Clicks en promoción "${promotion.title}"</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${clicks}</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">$${costPerClick.toLocaleString()}</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">$${totalAmount.toLocaleString()}</td>
            </tr>
            <tr style="background-color: #f0f9ff; font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 12px;" colspan="3"><strong>TOTAL A PAGAR</strong></td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: right;"><strong>$${totalAmount.toLocaleString()}</strong></td>
            </tr>
          </tbody>
        </table>
        
        <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="margin: 5px 0;">DogCatiFy - Plataforma de Servicios para Mascotas</p>
          <p style="margin: 5px 0;">Esta factura fue generada automáticamente el ${currentDate}</p>
          <p style="margin: 5px 0;">Número de factura: ${invoiceNumber}</p>
        </div>
      </div>
    `;
  };
  
  const sendBillingEmail = async (email: string, promotion: any, invoiceHTML: string, totalAmount: number, businessName: string) => {
    try {
      console.log('Sending billing email to:', email);
      
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const apiUrl = `${supabaseUrl}/functions/v1/send-email`;
      
      const emailData = {
        to: email,
        subject: `Factura de Promoción - ${promotion.title}`,
        text: `Estimado ${businessName}, adjunto encontrarás la factura por la promoción "${promotion.title}" por un total de $${totalAmount.toLocaleString()}.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Factura de Promoción</h1>
            </div>
            <div style="padding: 20px; background-color: #f9f9f9;">
              <p>Estimado ${businessName},</p>
              <p>Adjunto encontrarás la factura correspondiente a la promoción <strong>"${promotion.title}"</strong>.</p>
              <div style="background-color: white; border-left: 4px solid #2D6A6F; padding: 15px; margin: 20px 0;">
                <p><strong>Promoción:</strong> ${promotion.title}</p>
                <p><strong>Total de clicks:</strong> ${promotion.clicks || 0}</p>
                <p><strong>Monto total:</strong> $${totalAmount.toLocaleString()}</p>
              </div>
              ${invoiceHTML}
              <p>Gracias por utilizar DogCatiFy para promocionar tu negocio.</p>
              <p>Saludos cordiales,<br>El equipo de DogCatiFy</p>
            </div>
        `
      };
      
      console.log('Making API call to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(emailData),
      });
      
      console.log('Email API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API error:', errorText);
        throw new Error("Error " + response.status + ": " + errorText);
      }
      
      const result = await response.json();
      console.log('Email sent successfully:', result);
      
      return { success: true, result };
    } catch (error) {
      console.error('Error in sendBillingEmail:', error);
      return { success: false, error: error.message };
    }
  };
  
  const saveBillingRecord = async (promotion: any, clicks: number, costPerClick: number, totalAmount: number) => {
    try {
      const billingData = {
        promotion_id: promotion.id,
        partner_id: promotion.partnerId,
        total_clicks: clicks,
        cost_per_click: costPerClick,
        total_amount: totalAmount,
        billing_period_start: promotion.startDate.toISOString(),
        billing_period_end: promotion.endDate.toISOString(),
        status: 'pending',
        invoice_number: `INV-${Date.now()}`,
        notes: billingNotes.trim() || null,
        created_at: new Date().toISOString(),
        created_by: currentUser?.id
      };
      
      const { error } = await supabaseClient
        .from('promotion_billing')
        .insert([billingData]);
      
      if (error) throw error;
      
      console.log('Billing record saved successfully');
    } catch (error) {
      console.error('Error saving billing record:', error);
      throw error;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Promociones</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowPromotionModal(true)}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Estadísticas</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{promotions.length}</Text>
              <Text style={styles.statLabel}>Total{'\n'}Promociones</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {promotions.filter(p => p.isActive && isPromotionActive(p.startDate, p.endDate)).length}
              </Text>
              <Text style={styles.statLabel}>Activas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {promotions.reduce((sum, p) => sum + (p.views || 0), 0)}
              </Text>
              <Text style={styles.statLabel}>Total{'\n'}Vistas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {promotions.reduce((sum, p) => sum + (p.clicks || 0), 0)}
              </Text>
              <Text style={styles.statLabel}>Total{'\n'}Clicks</Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Todas las Promociones</Text>
          {promotions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Megaphone size={32} color="#DC2626" />
              <Text style={styles.emptyTitle}>No hay promociones</Text>
              <Text style={styles.emptySubtitle}>Crea una promoción para los usuarios</Text>
            </View>
          ) : (
            promotions.map((promotion) => (
              <Card key={promotion.id} style={styles.promotionCard}>
                <View style={styles.promotionHeader}>
                  <View style={styles.promotionInfo}>
                    <Text style={styles.promotionTitle}>{promotion.title}</Text>
                    {promotion.partnerInfo && (
                      <View style={styles.partnerInfo}>
                        <Text style={styles.partnerIcon}>
                          {getBusinessTypeIcon(promotion.partnerInfo.businessType)}
                        </Text>
                        <Text style={styles.partnerName}>{promotion.partnerInfo.businessName}</Text>
                      </View>
                    )}
                    <Text style={styles.promotionAudience}>
                      Audiencia: {promotion.targetAudience}
                    </Text>
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
                  </View>
                </View>
                <Image source={{ uri: promotion.imageURL }} style={styles.promotionImage} />
                <Text style={styles.promotionDescription}>{promotion.description}</Text>
                <View style={styles.promotionDetails}>
                  <View style={styles.promotionDetail}>
                    <Calendar size={16} color="#6B7280" />
                    <Text style={styles.promotionDetailText}>
                      {promotion.startDate.toLocaleDateString()} - {promotion.endDate.toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.promotionStats}>
                  <View style={styles.promotionStat}>
                    <Eye size={16} color="#6B7280" />
                    <Text style={styles.promotionStatText}>{promotion.views || 0}</Text>
                  </View>
                  <View style={styles.promotionStat}>
                    <Target size={16} color="#6B7280" />
                    <Text style={styles.promotionStatText}>{promotion.clicks || 0}</Text>
                  </View>
                </View>
                <View style={styles.promotionActions}>
                  <Button
                    title={promotion.isActive && isPromotionActive(promotion.startDate, promotion.endDate) ? 'Desactivar' : 'Activar'}
                    onPress={() => handleTogglePromotion(promotion.id, promotion.isActive)}
                    variant={promotion.isActive && isPromotionActive(promotion.startDate, promotion.endDate) ? 'outline' : 'primary'}
                    size="medium"
                  />
                  {promotion.partnerId && (promotion.clicks || 0) > 0 && (
                    <Button
                      title="Generar Factura"
                      onPress={() => handleGenerateBilling(promotion)}
                      variant="outline"
                      size="medium"
                    />
                  )}
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Billing Modal */}
      <Modal
        visible={showBillingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBillingModal(false)}
      >
        <View style={styles.billingModalOverlay}>
          <ScrollView 
            contentContainerStyle={styles.billingModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.billingModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Generar Factura - {selectedPromotionForBilling?.title}
              </Text>
              <TouchableOpacity onPress={() => setShowBillingModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedPromotionForBilling && (
              <View style={styles.billingInfo}>
                <Text style={styles.billingInfoTitle}>Información de la Promoción</Text>
                <View style={styles.billingInfoRow}>
                  <Text style={styles.billingInfoLabel}>Promoción:</Text>
                  <Text style={styles.billingInfoValue}>{selectedPromotionForBilling.title}</Text>
                </View>
                <View style={styles.billingInfoRow}>
                  <Text style={styles.billingInfoLabel}>Total de clicks:</Text>
                  <Text style={styles.billingInfoValue}>{selectedPromotionForBilling.clicks || 0}</Text>
                </View>
                <View style={styles.billingInfoRow}>
                  <Text style={styles.billingInfoLabel}>Período:</Text>
                  <Text style={styles.billingInfoValue}>
                    {selectedPromotionForBilling.startDate?.toLocaleDateString()} - {selectedPromotionForBilling.endDate?.toLocaleDateString()}
                  </Text>
                </View>
              </View>
            )}
            
            <Input
              label="Costo por click (ARS)"
              placeholder="100"
              value={costPerClick}
              onChangeText={setCostPerClick}
              keyboardType="numeric"
              leftIcon={<DollarSign size={20} color="#6B7280" />}
            />
            
            <Input
              label="Notas adicionales"
              placeholder="Observaciones sobre la facturación..."
              value={billingNotes}
              onChangeText={setBillingNotes}
              multiline
              numberOfLines={3}
              leftIcon={<FileText size={20} color="#6B7280" />}
            />
            
            {selectedPromotionForBilling && costPerClick && (
              <View style={styles.billingCalculation}>
                <Text style={styles.calculationTitle}>Cálculo de Facturación</Text>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Clicks totales:</Text>
                  <Text style={styles.calculationValue}>{selectedPromotionForBilling.clicks || 0}</Text>
                </View>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Costo por click:</Text>
                  <Text style={styles.calculationValue}>${parseFloat(costPerClick || '0').toLocaleString()}</Text>
                </View>
                <View style={[styles.calculationRow, styles.calculationTotal]}>
                  <Text style={styles.calculationTotalLabel}>Total a facturar:</Text>
                  <Text style={styles.calculationTotalValue}>
                    ${((selectedPromotionForBilling.clicks || 0) * parseFloat(costPerClick || '0')).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
            
            <View style={styles.billingModalActions}>
              <Button
                title="Cancelar"
                onPress={() => {
                  setShowBillingModal(false);
                  setSelectedPromotionForBilling(null);
                  setCostPerClick('100');
                  setBillingNotes('');
                }}
                variant="outline"
                size="medium"
              />
              <Button
                title="Generar y Enviar Factura"
                onPress={handleCreateBilling}
                loading={billingLoading}
                size="medium"
              />
            </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function isPromotionActive(startDate: Date, endDate: Date) {
  const now = new Date();
  return now >= startDate && now <= endDate;
}

function getBusinessTypeIcon(type: string) {
  switch (type) {
    case 'veterinary': return '🏥';
    case 'grooming': return '✂️';
    case 'walking': return '🚶';
    case 'boarding': return '🏠';
    case 'shop': return '🛍️';
    case 'shelter': return '🐾';
    default: return '🏢';
  }
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
  statsCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#DC2626',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
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
    alignItems: 'center',
    marginBottom: 12,
  },
  promotionInfo: {
    flex: 1,
  },
  promotionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  partnerIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  partnerName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  promotionAudience: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  promotionStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  promotionImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  promotionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  promotionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  promotionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  promotionDetailText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  promotionStats: {
    flexDirection: 'row',
    gap: 12,
  },
  promotionStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promotionStatText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
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
    flex: 1,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
    padding: 4,
  },
  billingInfo: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  billingInfoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  billingInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billingInfoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  billingInfoValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  billingCalculation: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  calculationTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#065F46',
    marginBottom: 12,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calculationLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#065F46',
  },
  calculationValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#065F46',
  },
  calculationTotal: {
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
    paddingTop: 8,
    marginTop: 8,
  },
  calculationTotalLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#065F46',
  },
  calculationTotalValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  billingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  billingModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  billingModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    marginVertical: 20,
  },
  billingModalActions: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingBottom: 20,
  },
});