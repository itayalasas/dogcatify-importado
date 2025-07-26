import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Image } from 'react-native';
import { Plus, Megaphone, Calendar, Eye, Target } from 'lucide-react-native';
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
  
  // Promotion form
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoImage, setPromoImage] = useState<string | null>(null);
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate, setPromoEndDate] = useState('');
  const [promoTargetAudience, setPromoTargetAudience] = useState('all');
  
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
  }, [currentUser]);

  const fetchPromotions = () => {
    const fetchData = async () => {
      try {
        console.log('Starting to fetch promotions...');
        const { data, error } = await supabaseClient
          .from('promotions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching promotions:', error);
          return;
        }

        console.log('Promotions data:', data?.length || 0, 'records found');
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
        })) || [];

        setPromotions(promotionsData);
        console.log('Promotions state updated in admin panel');
      } catch (error) {
        console.error('Error fetching promotions:', error);
      }
    };

    fetchData();

    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('promotions_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'promotions' },
        (payload) => {
          console.log('Promotion change detected in admin:', payload);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleSelectImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
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
      
      if (permissionResult.granted === false) {
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
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const filename = `promotions/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      
      const { data, error } = await supabaseClient.storage
        .from('dogcatify')
        .upload(filename, blob);

      if (error) throw error;

      const { data: { publicUrl } } = supabaseClient.storage
        .from('dogcatify')
        .getPublicUrl(filename);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleCreatePromotion = async () => {
    if (!promoTitle || !promoDescription || !promoStartDate || !promoEndDate || !promoImage) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      console.log('Creating promotion...');
      let imageUrl = null;
      if (promoImage) {
        console.log('Uploading image...');
        imageUrl = await uploadImage(promoImage);
        console.log('Image uploaded:', imageUrl);
      }

      const promotionData = {
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

      console.log('Inserting promotion data:', promotionData);
      const { error } = await supabaseClient
        .from('promotions')
        .insert([promotionData]);

      if (error) {
        console.error('Error creating promotion:', error);
        Alert.alert('Error', `No se pudo crear la promoción: ${error.message}`);
        return;
      }
      
      console.log('Promotion created successfully');
      // Reset form
      setPromoTitle('');
      setPromoDescription('');
      setPromoImage(null);
      setPromoStartDate('');
          .select(`
            *,
            partners:partner_id(business_name, business_type, logo)
          `)
      setPromoTargetAudience('all');
      setShowPromotionModal(false);
      
      Alert.alert('Éxito', 'Promoción creada correctamente');
    } catch (error) {
      console.error('Error creating promotion:', error);
      Alert.alert('Error', 'No se pudo crear la promoción');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePromotion = async (promotionId: string, isActive: boolean) => {
    try {
      // Update local state FIRST for immediate UI feedback
      setPromotions(prev => prev.map(promo => 
        promo.id === promotionId 
          ? { ...promo, isActive: !isActive }
          : promo
      ));
      setPromotions(prev => prev.map(promo => 
        promo.id === promotionId 
          ? { ...promo, isActive: !isActive }
          : promo
      ));
      setPromotions(prev => prev.map(promo => 
        promo.id === promotionId 
          ? { ...promo, isActive: !isActive }
          : promo
      ));
      setPromotions(prev => prev.map(promo => 
        promo.id === promotionId 
          ? { ...promo, isActive: !isActive }
          : promo
      ));
      
          partnerId: item.partner_id,
          partnerInfo: item.partners ? {
            businessName: item.partners.business_name,
            businessType: item.partners.business_type,
        partner_id: selectedPartnerId,
            logo: item.partners.logo,
          } : null,
      const { error } = await supabaseClient
        // Revert local state if database update fails
        setPromotions(prev => prev.map(promo => 
          promo.id === promotionId 
            ? { ...promo, isActive: isActive }
            : promo
        ));
        setPromotions(prev => prev.map(promo => 
          promo.id === promotionId 
            ? { ...promo, isActive: isActive }
            : promo
        ));
        setPromotions(prev => prev.map(promo => 
          promo.id === promotionId 
            ? { ...promo, isActive: isActive }
            : promo
        ));
        .update({
          is_active: !isActive
        })
        .eq('id', promotionId);

      if (error) {
        // Revert local state if database update fails
        setPromotions(prev => prev.map(promo => 
          promo.id === promotionId 
            ? { ...promo, isActive: isActive }
            : promo
        ));
        throw error;
      }

  const getTargetAudienceText = (audience: string) => {
    switch (audience) {
      case 'users': return 'Solo usuarios';
      case 'partners': return 'Solo aliados';
      case 'all': return 'Todos';
      default: return audience;
    }
  };

  const isPromotionActive = (startDate: Date, endDate: Date) => {
    const now = new Date();
    return now >= startDate && now <= endDate;
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
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 Estadísticas Generales</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{promotions.length}</Text>
              <Text style={styles.statLabel}>Total Promociones</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {promotions.filter(p => p.isActive).length}
              </Text>
              <Text style={styles.statLabel}>Activas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {promotions.reduce((sum, p) => sum + (p.views || 0), 0)}
              </Text>
              <Text style={styles.statLabel}>Total Vistas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {promotions.reduce((sum, p) => sum + (p.clicks || 0), 0)}
              </Text>
              <Text style={styles.statLabel}>Total Clicks</Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Promociones Activas</Text>
          
          {promotions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Megaphone size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No hay promociones</Text>
              <Text style={styles.emptySubtitle}>
                Crea tu primera promoción para llegar a más usuarios
              </Text>
            </Card>
          ) : (
            promotions.map((promotion) => (
              <Card key={promotion.id} style={styles.promotionCard}>
                <View style={styles.promotionHeader}>
                  <View style={styles.promotionInfo}>
                    <Text style={styles.promotionTitle}>{promotion.title}</Text>
                    {promotion.partnerInfo ? (
                      <View style={styles.partnerInfo}>
                        <Text style={styles.partnerIcon}>
                          {getBusinessTypeIcon(promotion.partnerInfo.businessType)}
                        </Text>
                        <Text style={styles.partnerName}>
                          {promotion.partnerInfo.businessName}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.promotionAudience}>
                        Promoción general • {getTargetAudienceText(promotion.targetAudience)}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.promotionStatus}>
                    <View style={[
                      styles.statusBadge,
                      { 
                        backgroundColor: promotion.isActive && isPromotionActive(promotion.startDate, promotion.endDate)
                          ? '#D1FAE5' 
                          : '#FEE2E2' 
                      }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { 
                          color: promotion.isActive && isPromotionActive(promotion.startDate, promotion.endDate)
                            ? '#065F46' 
                            : '#991B1B' 
                        }
                      ]}>
                        {promotion.isActive && isPromotionActive(promotion.startDate, promotion.endDate)
                          ? 'Activa' 
                          : 'Inactiva'
                        }
                      </Text>
                    </View>
                  </View>
                </View>

                {promotion.imageURL && (
                  <Image source={{ uri: promotion.imageURL }} style={styles.promotionImage} />
                )}

                <Text style={styles.promotionDescription} numberOfLines={2}>
                  {promotion.description}
                </Text>

                <View style={styles.promotionDetails}>
                  <View style={styles.promotionDetail}>
                    <Calendar size={16} color="#6B7280" />
                    <Text style={styles.promotionDetailText}>
                      {promotion.startDate.toLocaleDateString()} - {promotion.endDate.toLocaleDateString()}
                    </Text>
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
                </View>

                <View style={styles.promotionActions}>
                  <Button
                    title={promotion.isActive && isPromotionActive(promotion.startDate, promotion.endDate) ? 'Desactivar' : 'Activar'}
                    onPress={() => handleTogglePromotion(promotion.id, promotion.isActive)}
                    variant={promotion.isActive && isPromotionActive(promotion.startDate, promotion.endDate) ? 'outline' : 'primary'}
                    size="medium"
                  />
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Promotion Modal */}
      <Modal
        visible={showPromotionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPromotionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Crear Nueva Promoción</Text>
              
              <Input
                label="Título de la promoción"
                placeholder="Ej: ¡Descuento especial en servicios para mascotas!"
                value={promoTitle}
                onChangeText={setPromoTitle}
              />
              
              <Input
                label="Descripción"
                placeholder="Describe la promoción detalladamente..."
                value={promoDescription}
                onChangeText={setPromoDescription}
                multiline
                numberOfLines={4}
              />

              {/* Partner Selector */}
              <View style={styles.partnerSection}>
                <Text style={styles.partnerLabel}>Aliado (opcional)</Text>
                <Text style={styles.partnerDescription}>
                  Selecciona un aliado específico para esta promoción
                </Text>
                
                <TouchableOpacity 
                  style={styles.partnerSelector}
                  onPress={() => setShowPartnerSelector(true)}
                >
                  {getSelectedPartner() ? (
                    <View style={styles.selectedPartnerInfo}>
                      <Text style={styles.selectedPartnerIcon}>
                        {getBusinessTypeIcon(getSelectedPartner()!.businessType)}
                      </Text>
                      <View style={styles.selectedPartnerDetails}>
                        <Text style={styles.selectedPartnerName}>
                          {getSelectedPartner()!.businessName}
                        </Text>
                        <Text style={styles.selectedPartnerType}>
                          {getSelectedPartner()!.businessType}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.partnerSelectorPlaceholder}>
                      Seleccionar aliado (opcional)
                    </Text>
                  )}
                </TouchableOpacity>
                
                {getSelectedPartner() && (
                  <TouchableOpacity 
                    style={styles.clearPartnerButton}
                    onPress={() => {
                      setSelectedPartnerId(null);
                      setPartnerSearchQuery('');
                    }}
                  >
                    <Text style={styles.clearPartnerText}>Quitar aliado</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>Imagen promocional *</Text>
                
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
                      <Text style={styles.imageActionText}>📷 Tomar foto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageActionButton} onPress={handleSelectImage}>
                      <Text style={styles.imageActionText}>🖼️ Galería</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                <Text style={styles.imageHint}>
                  Recomendado: 1080x1080px o 16:9 para mejor visualización
                </Text>
              </View>
              
              <Input
                label="Fecha de inicio"
                placeholder="2025-01-01"
                value={promoStartDate}
                onChangeText={setPromoStartDate}
                leftIcon={<Calendar size={20} color="#6B7280" />}
              />
              
              <Input
                label="Fecha de fin"
                placeholder="2025-01-31"
                value={promoEndDate}
                onChangeText={setPromoEndDate}
                leftIcon={<Calendar size={20} color="#6B7280" />}
              />

              <View style={styles.audienceSection}>
                <Text style={styles.audienceLabel}>Audiencia objetivo</Text>
                <Text style={styles.audienceDescription}>
                  Selecciona quién verá esta promoción en su feed
                </Text>
                <View style={styles.audienceOptions}>
                  {[
                    { value: 'all', label: 'Todos los usuarios' },
                    { value: 'users', label: 'Solo usuarios' },
                    { value: 'partners', label: 'Solo aliados' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.audienceOption,
                        promoTargetAudience === option.value && styles.selectedAudience
                      ]}
                      onPress={() => setPromoTargetAudience(option.value)}
                    >
                      <Text style={[
                        styles.audienceOptionText,
                        promoTargetAudience === option.value && styles.selectedAudienceText
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.modalActions}>
                <View style={styles.modalButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.cancelModalButton}
                    onPress={() => {
                      setShowPromotionModal(false);
                      // Reset form
                      setPromoTitle('');
                      setPromoDescription('');
                      setPromoImage(null);
                      setPromoStartDate('');
                      setPromoEndDate('');
                      setPromoTargetAudience('all');
                      setSelectedPartnerId(null);
                      setPartnerSearchQuery('');
                    }}
                  >
                    <Text style={styles.cancelModalButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.createModalButton, loading && styles.disabledButton]}
                    onPress={handleCreatePromotion}
                    disabled={loading}
                  >
                    <Text style={styles.createModalButtonText}>
                      {loading ? 'Creando...' : 'Crear Promoción'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

      {/* Partner Selector Modal */}
      <Modal
        visible={showPartnerSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPartnerSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.partnerModalContent}>
            <View style={styles.partnerModalHeader}>
              <Text style={styles.partnerModalTitle}>Seleccionar Aliado</Text>
              <TouchableOpacity onPress={() => setShowPartnerSelector(false)}>
                <Text style={styles.partnerModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Input
              placeholder="Buscar aliado por nombre o tipo..."
              value={partnerSearchQuery}
              onChangeText={setPartnerSearchQuery}
              leftIcon={<Search size={20} color="#9CA3AF" />}
            />
            
            <ScrollView style={styles.partnersList} showsVerticalScrollIndicator={false}>
              {getFilteredPartners().length === 0 ? (
                <View style={styles.noPartnersContainer}>
                  <Text style={styles.noPartnersText}>
                    {partnerSearchQuery ? 'No se encontraron aliados' : 'No hay aliados disponibles'}
                  </Text>
                </View>
              ) : (
                getFilteredPartners().map((partner) => (
                  <TouchableOpacity
                    key={partner.id}
                    style={[
                      styles.partnerItem,
                      selectedPartnerId === partner.id && styles.selectedPartnerItem
                    ]}
                    onPress={() => {
                      setSelectedPartnerId(partner.id);
                      setShowPartnerSelector(false);
                      setPartnerSearchQuery('');
                    }}
                  >
                    <View style={styles.partnerItemInfo}>
                      <Text style={styles.partnerItemIcon}>
                        {getBusinessTypeIcon(partner.businessType)}
                      </Text>
                      <View style={styles.partnerItemDetails}>
                        <Text style={styles.partnerItemName}>
                          {partner.businessName}
                        </Text>
                        <Text style={styles.partnerItemType}>
                          {partner.businessType}
                        </Text>
                      </View>
                    </View>
                    {selectedPartnerId === partner.id && (
                      <Text style={styles.selectedIndicator}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  partnerSection: {
    marginBottom: 16,
  },
  partnerLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 4,
  },
  partnerDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  partnerSelector: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    minHeight: 50,
  },
  selectedPartnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedPartnerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  selectedPartnerDetails: {
    flex: 1,
  },
  selectedPartnerName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  selectedPartnerType: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  partnerSelectorPlaceholder: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  clearPartnerButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearPartnerText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#EF4444',
  },
  partnerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    marginTop: 100,
    flex: 1,
  },
  partnerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  partnerModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  partnerModalClose: {
    fontSize: 18,
    color: '#6B7280',
    padding: 4,
  },
  partnersList: {
    flex: 1,
    marginTop: 16,
  },
  noPartnersContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noPartnersText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  partnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedPartnerItem: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  partnerItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  partnerItemIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  partnerItemDetails: {
    flex: 1,
  },
  partnerItemName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  partnerItemType: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  selectedIndicator: {
    fontSize: 18,
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  imageSection: {
    marginBottom: 16,
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
  imageActionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  imageHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  audienceSection: {
    marginBottom: 20,
  },
  audienceLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  audienceDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  audienceOptions: {
    gap: 8,
  },
  audienceOption: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedAudience: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  audienceOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  selectedAudienceText: {
    color: '#FFFFFF',
  },
  modalActions: {
    marginTop: 20,
  },
  modalButtonsContainer: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
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