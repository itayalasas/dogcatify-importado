import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Plus,
  X,
  Search,
  Volume2,
  Eye,
  MousePointer,
  FileText,
  ImageIcon,
  Store,
  ChevronRight,
} from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { generatePromotionInvoice } from '../../utils/promotionInvoicing';

interface Promotion {
  id: string;
  title: string;
  description: string;
  imageURL: string | null;
  ctaUrl: string | null;
  startDate: Date;
  endDate: Date;
  targetAudience: string;
  isActive: boolean;
  views: number;
  clicks: number;
  createdAt: Date;
  createdBy: string;
  partnerId: string | null;
  partnerInfo: {
    businessName: string;
    businessType: string;
    logo: string | null;
  } | null;
}

interface Partner {
  id: string;
  business_name: string;
  business_type: string;
  logo: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  partner_id: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  partner_id: string;
}

export default function AdminPromotions() {
  const { currentUser } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showPartnerSelector, setShowPartnerSelector] = useState(false);

  // Form states
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoImage, setPromoImage] = useState<string | null>(null);
  const [promoUrl, setPromoUrl] = useState('');
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate, setPromoEndDate] = useState('');
  const [promoTargetAudience, setPromoTargetAudience] = useState('all');

  // Partner selection states
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [selectedPartnerInfo, setSelectedPartnerInfo] = useState<Partner | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    fetchPromotions();
    fetchPartners();
  }, [currentUser]);

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
    } catch (error) {
      console.error('Error fetching promotions:', error);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('id, business_name, business_type, logo')
        .eq('status', 'approved')
        .order('business_name');

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('Error fetching partners:', error);
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

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permisos necesarios', 'Se necesitan permisos para acceder a la galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPromoImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (imageUri: string) => {
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
      if (promoImage) {
        imageUrl = await uploadImage(promoImage);
      }

      const promotionData: any = {
        title: promoTitle.trim(),
        description: promoDescription.trim(),
        image_url: imageUrl,
        cta_url: promoUrl.trim() || null,
        start_date: new Date(promoStartDate).toISOString(),
        end_date: new Date(promoEndDate).toISOString(),
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

      const { error } = await supabaseClient
        .from('promotions')
        .insert([promotionData]);

      if (error) {
        Alert.alert('Error', `No se pudo crear la promoción: ${error.message}`);
        return;
      }

      resetForm();
      setShowPromotionModal(false);
      fetchPromotions();
      Alert.alert('Éxito', 'Promoción creada correctamente');
    } catch (error) {
      console.error('Error creating promotion:', error);
      Alert.alert('Error', 'No se pudo crear la promoción');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPromoTitle('');
    setPromoDescription('');
    setPromoImage(null);
    setPromoUrl('');
    setPromoStartDate('');
    setPromoEndDate('');
    setPromoTargetAudience('all');
    setSelectedPartnerId(null);
    setSelectedPartnerInfo(null);
    setPartnerSearchQuery('');
  };

  const handleSelectPartner = (partner: Partner) => {
    setSelectedPartnerId(partner.id);
    setSelectedPartnerInfo(partner);
    setShowPartnerSelector(false);
  };

  const handleInvoicePromotion = async (promotion: Promotion) => {
    try {
      setLoading(true);

      await generatePromotionInvoice({
        promotionId: promotion.id,
        promotionTitle: promotion.title,
        partnerInfo: promotion.partnerInfo || {
          businessName: 'Sin aliado',
          businessType: 'general',
          logo: null,
        },
        items: [],
        discount: 0,
        invoiceDate: new Date(),
      });

      Alert.alert('Éxito', 'Factura generada correctamente');
    } catch (error) {
      console.error('Error generating invoice:', error);
      Alert.alert('Error', 'No se pudo generar la factura');
    } finally {
      setLoading(false);
    }
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

  const filteredPromotions = promotions.filter(promo =>
    promo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    promo.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    promo.partnerInfo?.businessName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPartners = partners.filter(partner =>
    partner.business_name.toLowerCase().includes(partnerSearchQuery.toLowerCase())
  );

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
                  : 'Crea tu primera promoción para empezar'}
              </Text>
            </Card>
          ) : (
            filteredPromotions.map((promo) => (
              <Card key={promo.id} style={styles.promotionCard}>
                {promo.partnerInfo && (
                  <View style={styles.partnerInfoHeader}>
                    <Text style={styles.partnerIcon}>
                      {getBusinessTypeIcon(promo.partnerInfo.businessType)}
                    </Text>
                    <Text style={styles.partnerName}>
                      {promo.partnerInfo.businessName}
                    </Text>
                  </View>
                )}

                <Text style={styles.promotionTitle}>{promo.title}</Text>
                <Text style={styles.promotionDescription}>{promo.description}</Text>

                <View style={styles.promotionStats}>
                  <View style={styles.statItem}>
                    <Eye size={14} color="#6B7280" />
                    <Text style={styles.statText}>{promo.views} vistas</Text>
                  </View>
                  <View style={styles.statItem}>
                    <MousePointer size={14} color="#6B7280" />
                    <Text style={styles.statText}>{promo.clicks} clics</Text>
                  </View>
                </View>

                {promo.imageURL && (
                  <Image
                    source={{ uri: promo.imageURL }}
                    style={styles.promotionImage}
                  />
                )}

                <View style={styles.promotionDates}>
                  <Text style={styles.dateText}>
                    📅 {promo.startDate.toLocaleDateString()} - {promo.endDate.toLocaleDateString()}
                  </Text>
                  <Text style={[
                    styles.activeStatus,
                    { color: isPromotionActive(promo.startDate, promo.endDate) ? '#10B981' : '#6B7280' }
                  ]}>
                    {isPromotionActive(promo.startDate, promo.endDate) ? 'En período activo' : 'Fuera de período'}
                  </Text>
                </View>

                <View style={styles.promotionActions}>
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.invoiceButton}
                      onPress={() => handleInvoicePromotion(promo)}
                    >
                      <FileText size={16} color="#FFFFFF" />
                      <Text style={styles.invoiceButtonText}>Facturar</Text>
                    </TouchableOpacity>

                    <Button
                      title={promo.isActive ? 'Desactivar' : 'Activar'}
                      onPress={() => handleTogglePromotion(promo.id, promo.isActive)}
                      variant={promo.isActive ? 'outline' : 'primary'}
                    />
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showPromotionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPromotionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nueva Promoción</Text>
                <TouchableOpacity onPress={() => setShowPromotionModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.partnerSection}>
                <Text style={styles.partnerLabel}>Aliado (opcional)</Text>
                <TouchableOpacity
                  style={styles.partnerSelector}
                  onPress={() => setShowPartnerSelector(true)}
                >
                  <Store size={20} color="#6B7280" />
                  <Text style={styles.partnerSelectorText}>
                    {selectedPartnerInfo?.business_name || 'Seleccionar aliado'}
                  </Text>
                  <ChevronRight size={20} color="#6B7280" />
                </TouchableOpacity>

                {selectedPartnerInfo && (
                  <View style={styles.selectedPartnerInfo}>
                    <Text style={styles.selectedPartnerIcon}>
                      {getBusinessTypeIcon(selectedPartnerInfo.business_type)}
                    </Text>
                    <Text style={styles.selectedPartnerName}>
                      {selectedPartnerInfo.business_name}
                    </Text>
                    <TouchableOpacity onPress={() => {
                      setSelectedPartnerId(null);
                      setSelectedPartnerInfo(null);
                    }}>
                      <Text style={styles.removePartnerText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Input
                label="Título"
                value={promoTitle}
                onChangeText={setPromoTitle}
                placeholder="Ej: Gran descuento en productos"
              />

              <Input
                label="Descripción"
                value={promoDescription}
                onChangeText={setPromoDescription}
                placeholder="Describe la promoción"
                multiline
                numberOfLines={4}
              />

              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>Imagen de la promoción</Text>
                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={handlePickImage}
                >
                  <ImageIcon size={20} color="#DC2626" />
                  <Text style={styles.imageButtonText}>
                    {promoImage ? 'Cambiar imagen' : 'Seleccionar imagen'}
                  </Text>
                </TouchableOpacity>

                {promoImage && (
                  <Image source={{ uri: promoImage }} style={styles.previewImage} />
                )}
              </View>

              <Input
                label="URL de destino (opcional)"
                value={promoUrl}
                onChangeText={setPromoUrl}
                placeholder="https://ejemplo.com"
              />

              <Input
                label="Fecha de inicio"
                value={promoStartDate}
                onChangeText={setPromoStartDate}
                placeholder="YYYY-MM-DD"
              />

              <Input
                label="Fecha de fin"
                value={promoEndDate}
                onChangeText={setPromoEndDate}
                placeholder="YYYY-MM-DD"
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancelar"
                  onPress={() => setShowPromotionModal(false)}
                  variant="outline"
                />
                <Button
                  title={loading ? 'Creando...' : 'Crear Promoción'}
                  onPress={handleCreatePromotion}
                  disabled={loading}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showPartnerSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPartnerSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Aliado</Text>
              <TouchableOpacity onPress={() => setShowPartnerSelector(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Input
              placeholder="Buscar aliado..."
              value={partnerSearchQuery}
              onChangeText={setPartnerSearchQuery}
              leftIcon={<Search size={20} color="#9CA3AF" />}
            />

            <ScrollView style={styles.partnersList}>
              {filteredPartners.length === 0 ? (
                <Text style={styles.emptyText}>No se encontraron aliados</Text>
              ) : (
                filteredPartners.map(partner => (
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
                        <Text style={styles.partnerOptionName}>
                          {partner.business_name}
                        </Text>
                        <Text style={styles.partnerOptionType}>
                          {partner.business_type}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#DC2626',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  promotionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  partnerInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  partnerIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  partnerName: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  promotionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  promotionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  promotionStats: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    gap: 12,
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  invoiceButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
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
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    padding: 20,
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
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
  imageSection: {
    marginBottom: 20,
  },
  imageLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  imageButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 12,
    resizeMode: 'cover',
  },
  modalActions: {
    flexDirection: 'row',
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
