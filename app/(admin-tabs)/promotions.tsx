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
          throw error;
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
        () => {
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
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPromoImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
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
    if (!promoTitle || !promoDescription || !promoStartDate || !promoEndDate) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = null;
      if (promoImage) {
        imageUrl = await uploadImage(promoImage);
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
        created_at: new Date().toISOString(),
        created_by: currentUser?.id,
      };

      const { error } = await supabaseClient
        .from('promotions')
        .insert([promotionData]);

      if (error) throw error;
      
      // Reset form
      setPromoTitle('');
      setPromoDescription('');
      setPromoImage(null);
      setPromoStartDate('');
      setPromoEndDate('');
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
      const { error } = await supabaseClient
        .from('promotions')
        .update({
          is_active: !isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', promotionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling promotion:', error);
      Alert.alert('Error', 'No se pudo actualizar la promoción');
    }
  };

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
                    <Text style={styles.promotionAudience}>
                      {getTargetAudienceText(promotion.targetAudience)}
                    </Text>
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
                placeholder="Ej: ¡Descuento especial en servicios!"
                value={promoTitle}
                onChangeText={setPromoTitle}
              />
              
              <Input
                label="Descripción"
                placeholder="Describe la promoción..."
                value={promoDescription}
                onChangeText={setPromoDescription}
                multiline
                numberOfLines={3}
              />

              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>Imagen promocional</Text>
                <TouchableOpacity style={styles.imageSelector} onPress={handleSelectImage}>
                  {promoImage ? (
                    <Image source={{ uri: promoImage }} style={styles.selectedImage} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Megaphone size={32} color="#9CA3AF" />
                      <Text style={styles.imagePlaceholderText}>Seleccionar imagen</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              
              <Input
                label="Fecha de inicio"
                placeholder="YYYY-MM-DD"
                value={promoStartDate}
                onChangeText={setPromoStartDate}
                leftIcon={<Calendar size={20} color="#6B7280" />}
              />
              
              <Input
                label="Fecha de fin"
                placeholder="YYYY-MM-DD"
                value={promoEndDate}
                onChangeText={setPromoEndDate}
                leftIcon={<Calendar size={20} color="#6B7280" />}
              />

              <View style={styles.audienceSection}>
                <Text style={styles.audienceLabel}>Audiencia objetivo</Text>
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
                <Button
                  title="Cancelar"
                  onPress={() => setShowPromotionModal(false)}
                  variant="outline"
                  size="medium"
                />
                <Button
                  title="Crear Promoción"
                  onPress={handleCreatePromotion}
                  loading={loading}
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
  imageSection: {
    marginBottom: 16,
  },
  imageLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  imageSelector: {
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 8,
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
    flexDirection: 'row',
    gap: 12,
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