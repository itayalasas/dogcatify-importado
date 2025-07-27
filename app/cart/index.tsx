import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Image } from 'react-native';
import { Plus, Megaphone, Calendar, Eye, Target, Search } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

export default function AdminPromotions() {
  const { currentUser } = useAuth();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showPartnerSelector, setShowPartnerSelector] = useState(false);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  // Promotion form
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoImage, setPromoImage] = useState<string | null>(null);
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate, setPromoEndDate] = useState('');
  const [promoTargetAudience, setPromoTargetAudience] = useState('all');
  const [loading, setLoading] = useState(false);

  // Dummy partners for selector (replace with your fetch logic)
  const partners = [
    { id: '1', businessName: 'PetShop', businessType: 'Tienda', logo: '' },
    { id: '2', businessName: 'VetClinic', businessType: 'Veterinaria', logo: '' },
  ];

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

  function isPromotionActive(startDate: Date, endDate: Date) {
    const now = new Date();
    return now >= startDate && now <= endDate;
  }

  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.email?.toLowerCase() === 'admin@dogcatify.com';
    if (!isAdmin) return;
    fetchPromotions();
  }, [currentUser]);

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
    if (!promoTitle || !promoDescription || !promoStartDate || !promoEndDate || !promoImage) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }
    setLoading(true);
    try {
      let imageUrl = null;
      if (promoImage) imageUrl = await uploadImage(promoImage);
      const promotionData: any = {
        title: promoTitle.trim(),
        description: promoDescription.trim(),
        image_url: imageUrl,
        start_date: new Date(promoStartDate).toISOString(),
        end_date: new Date(promoEndDate).toISOString(),
        target_audience: promoTargetAudience,
        is_active: true,
        views: 0,
        clicks: 0,
        promotion_type: 'feed',
        cta_text: 'Más información',
        created_at: new Date().toISOString(),
        created_by: currentUser?.id,
      };
      if (selectedPartnerId) {
        promotionData.partner_id = selectedPartnerId;
      }
      const { error } = await supabaseClient
        .from('promotions')
        .insert([promotionData])
        .select(`
          *,
          partners:partner_id(business_name, business_type, logo)
        `);
      if (error) {
        Alert.alert('Error', `No se pudo crear la promoción: ${error.message}`);
        return;
      }
      setPromoTitle('');
      setPromoDescription('');
      setPromoImage(null);
      setPromoStartDate('');
      setPromoEndDate('');
      setPromoTargetAudience('all');
      setSelectedPartnerId(null);
      setPartnerSearchQuery('');
      setShowPromotionModal(false);
      Alert.alert('Éxito', 'Promoción creada correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear la promoción');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text>Admin Promotions</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  cancelModalButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
  },
  createModalButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  createModalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.6,
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
});