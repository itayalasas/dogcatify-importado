// Función fetchPromotions
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

// Función handleTogglePromotion CORREGIDA
const handleTogglePromotion = async (promotionId, isActive) => {
  try {
    const { error } = await supabaseClient
      .from('promotions')
      .update({ is_active: !isActive })
      .eq('id', promotionId);
    
    if (error) {
      throw error;
    }
    
    // Refrescar la lista después de la actualización
    fetchPromotions();
  } catch (error) {
    console.error('Error toggling promotion:', error);
    Alert.alert('Error', 'No se pudo actualizar la promoción');
  }
};

// Función handleCreatePromotion
const handleCreatePromotion = async () => {
  if (!promoTitle || !promoDescription || !promoStartDate || !promoEndDate || !promoImage) {
    Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
    return;
  }
  setLoading(true);
  try {
    let imageUrl = null;
    if (promoImage) imageUrl = await uploadImage(promoImage);
    
    const promotionData = {
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
    Alert.alert('Error', 'No se pudo crear la promoción');
  } finally {
    setLoading(false);
  }
};

// Función resetForm
const resetForm = () => {
  setPromoTitle('');
  setPromoDescription('');
  setPromoImage(null);
  setPromoUrl('');
  setPromoStartDate('');
  setPromoEndDate('');
  setPromoTargetAudience('all');
  setSelectedPartnerId(null);
  setPartnerSearchQuery('');
};

// Función uploadImage
const uploadImage = async (imageUri) => {
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

// Función isPromotionActive
function isPromotionActive(startDate, endDate) {
  const now = new Date();
  return now >= startDate && now <= endDate;
}

// Función getBusinessTypeIcon
function getBusinessTypeIcon(type) {
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