import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, TextInput, Dimensions, Modal, Alert, Share, Platform, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Clock, Phone, Star, Search, ChevronRight, User, Heart, MessageCircle, Stethoscope, Scissors, Home, Dog, ShoppingBag, Syringe, Activity, Pill, Droplet, Bath } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { LoadingScreen } from '../../../components/ui/LoadingScreen';
import { IconButton, Badge, EmptyState } from '../../../components/ui';
import { RatingStars } from '../../../components/services/RatingStars';
import { getBusinessTypeLabel } from '../../../components/services/labels';
import { colors, radius, spacing, typography, shadows, hitSlop } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';

const { width } = Dimensions.get('window');

export default function PartnerServices() {
  const { id, refresh, tab } = useLocalSearchParams<{ id: string; refresh?: string; tab?: string }>();
  const { currentUser } = useAuth();
  const [partner, setPartner] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [adoptionPets, setAdoptionPets] = useState<any[]>([]);
  const [partnerReviews, setPartnerReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [detailedReviews, setDetailedReviews] = useState<any[]>([]);
  const [loadingDetailedReviews, setLoadingDetailedReviews] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const [servicesSectionY, setServicesSectionY] = useState(0);
  const [openedReviewsFromLink, setOpenedReviewsFromLink] = useState(false);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/services');
  };

  useEffect(() => {
    fetchPartnerDetails();
  }, [id, refresh]);

  useEffect(() => {
    if (partner) {
      if (partner.business_type === 'shelter') {
        console.log('Partner is shelter, fetching adoption pets...');
        fetchAdoptionPets();
      } else {
        console.log('Partner is not shelter, fetching services...');
        fetchPartnerServices();
      }
      fetchPartnerReviews();
    }
  }, [partner]);

  // Removed auto-navigation - User should manually select service even if only one is available

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredServices(
        services.filter(service => 
          service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          service.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredServices(services);
    }
    fetchPartnerReviews();
  }, [id]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredServices(
        services.filter(service => 
          service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          service.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredServices(services);
    }
  }, [searchQuery, services]);

  const fetchPartnerDetails = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setPartner({
          id: data.id,
          businessName: data.business_name,
          businessType: data.business_type,
          address: data.address,
          phone: data.phone,
          logo: data.logo,
          rating: data.rating,
          reviewsCount: data.reviews_count,
          ...data
        });
      }
    } catch (error) {
      console.error('Error fetching partner details:', error);
    }
  };

  const fetchPartnerServices = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partner_services')
        .select('*')
        .eq('partner_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const servicesData = data?.map(service => ({
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
        duration: service.duration,
        category: service.category,
        images: service.images,
        isActive: service.is_active,
        partnerId: service.partner_id,
        createdAt: new Date(service.created_at)
      })) || [];
      
      setServices(servicesData);
      setFilteredServices(servicesData);
    } catch (error) {
      console.error('Error fetching partner services:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdoptionPets = async () => {
    try {
      console.log('Fetching adoption pets for partner:', id);
      
      // Fetch from adoption_pets table (the correct table)
      const { data, error } = await supabaseClient
        .from('adoption_pets')
        .select('*')
        .eq('partner_id', id)
        .eq('is_available', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching from adoption_pets:', error);
        setAdoptionPets([]);
        return;
      }
      
      console.log('Found adoption pets:', data?.length || 0);
      console.log('Adoption pets data:', data);
      
      // Process adoption pets data
      const adoptionData = data?.map(pet => {
        return {
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          gender: pet.gender,
          age: pet.age,
          ageUnit: pet.age_unit,
          size: pet.size,
          weight: pet.weight,
          color: pet.color,
          description: pet.description,
          
          // Health info
          isVaccinated: pet.is_vaccinated,
          vaccines: pet.vaccines || [],
          isDewormed: pet.is_dewormed,
          isNeutered: pet.is_neutered,
          healthCondition: pet.health_condition,
          lastVetVisit: pet.last_vet_visit,
          
          // Behavior
          temperament: pet.temperament || [],
          goodWithDogs: pet.good_with_dogs,
          goodWithCats: pet.good_with_cats,
          goodWithKids: pet.good_with_kids,
          energyLevel: pet.energy_level,
          specialNeeds: pet.special_needs,
          
          // Adoption
          adoptionRequirements: pet.adoption_requirements || [],
          adoptionFee: pet.adoption_fee || 0,
          adoptionZones: pet.adoption_zones,
          contactInfo: pet.contact_info,
          adoptionProcess: pet.adoption_process,
          
          images: pet.images || [],
          isAvailable: pet.is_available,
          createdAt: new Date(pet.created_at)
        };
      }) || [];
      
      console.log('Processed adoption data:', adoptionData.length, 'pets');
      setAdoptionPets(adoptionData);
    } catch (error) {
      console.error('Error fetching adoption pets:', error);
      setAdoptionPets([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Fallback method for backward compatibility
  const fetchAdoptionPetsFromServices = async () => {
    try {
      console.log('Fetching adoption pets from partner_services (fallback)');
      
      const { data, error } = await supabaseClient
        .from('partner_services')
        .select('*')
        .eq('partner_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Parse adoption pets from services (legacy format)
      const adoptionData = data?.map(service => {
        // Extract adoption info from description
        const description = service.description || '';
        
        // Parse basic info
        const lines = description.split('\n');
        const basicInfo = lines[0] || '';
        const healthInfo = lines.find((line: string) => line.includes('🩺')) || '';
        const temperamentInfo = lines.find((line: string) => line.includes('🧠')) || '';
        const adoptionInfo = lines.find((line: string) => line.includes('🏡')) || '';
        const contactInfo = lines.find((line: string) => line.includes('📞')) || '';
        
        return {
          id: service.id,
          name: service.name,
          category: service.category,
          price: service.price,
          images: service.images || [],
          basicInfo,
          healthInfo,
          temperamentInfo,
          adoptionInfo,
          contactInfo,
          fullDescription: description,
          createdAt: new Date(service.created_at),
          isLegacyFormat: true // Flag to identify legacy data
        };
      }) || [];
      
      setAdoptionPets(adoptionData);
    } catch (error) {
      console.error('Error fetching adoption pets from services:', error);
    }
  };

  const fetchPartnerReviews = async () => {
    try {
      const { data: reviewsData, error } = await supabaseClient
        .from('service_reviews')
        .select(`
          *,
          profiles:customer_id(display_name, photo_url),
          pets:pet_id(name),
          partner_services:service_id(name)
        `)
        .eq('partner_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPartnerReviews(reviewsData || []);
      
      // Calculate average rating
      if (reviewsData && reviewsData.length > 0) {
        const avgRating = reviewsData.reduce((sum, review) => sum + review.rating, 0) / reviewsData.length;
        setAverageRating(avgRating);
        setTotalReviews(reviewsData.length);
      }
    } catch (error) {
      console.error('Error fetching partner reviews:', error);
    }
  };

  const handleServicePress = (serviceId: string) => {
    // Validate service ID before navigation
    if (!serviceId || typeof serviceId !== 'string') {
      console.error('Invalid service ID for navigation:', serviceId);
      Alert.alert('Error', 'No pudimos abrir este servicio.');
      return;
    }
    
    // Check if ID is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(serviceId)) {
      console.error('Service ID is not a valid UUID for navigation:', serviceId);
      Alert.alert('Error', 'No pudimos abrir este servicio.');
      return;
    }
    
    console.log('Navigating to service detail with valid UUID:', serviceId);
    try {
      router.push(`/services/${serviceId}?partnerId=${id}`);
    } catch (navigationError) {
      console.error('Navigation error to service detail:', navigationError);
      Alert.alert('Error', 'No se pudo navegar al detalle del servicio');
    }
  };

  const handleShowReviews = () => {
    setShowReviewsModal(true);
    fetchDetailedReviews();
  };

  // Si se llega con ?tab=reviews (desde la calificación de la tarjeta), abrir las reseñas una vez.
  useEffect(() => {
    if (tab === 'reviews' && partner && !loading && !openedReviewsFromLink) {
      setOpenedReviewsFromLink(true);
      handleShowReviews();
    }
  }, [tab, partner, loading]);

  /** Precio más bajo de los servicios, para la barra inferior. */
  const minPrice = services.reduce((min: number, svc: any) => {
    const price = Number(svc.price) || 0;
    return price > 0 && (min === 0 || price < min) ? price : min;
  }, 0);

  /** Imagen principal: primera foto de un servicio o mascota; si no hay, una foto según el rubro. */
  const getHeroImage = (): string | null => {
    const fromServices = services.find((svc: any) => Array.isArray(svc.images) && svc.images.length > 0);
    if (fromServices) return fromServices.images[0];
    const fromPets = adoptionPets.find((pet: any) => Array.isArray(pet.images) && pet.images.length > 0);
    if (fromPets) return fromPets.images[0];
    const fallback: Record<string, string> = {
      veterinary: 'https://images.pexels.com/photos/6235231/pexels-photo-6235231.jpeg?auto=compress&cs=tinysrgb&w=1200',
      grooming: 'https://images.pexels.com/photos/7788009/pexels-photo-7788009.jpeg?auto=compress&cs=tinysrgb&w=1200',
      boarding: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=1200',
      walking: 'https://images.pexels.com/photos/406014/pexels-photo-406014.jpeg?auto=compress&cs=tinysrgb&w=1200',
      shelter: 'https://images.pexels.com/photos/2253275/pexels-photo-2253275.jpeg?auto=compress&cs=tinysrgb&w=1200',
    };
    const type = partner?.business_type || partner?.businessType;
    return fallback[type] || partner?.logo || null;
  };

  const fetchDetailedReviews = async () => {
    if (detailedReviews.length > 0) return; // Already loaded
    
    setLoadingDetailedReviews(true);
    try {
      console.log('Fetching detailed reviews for partner:', partner?.id);
      
      // Validate partner ID
      if (!partner?.id || typeof partner.id !== 'string') {
        console.error('Invalid partner ID for reviews:', partner?.id);
        return;
      }
      
      const { data: reviewsData, error } = await supabaseClient
        .from('service_reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          customer_id,
          service_id,
          partner_id
        `)
        .eq('partner_id', partner?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching detailed reviews:', error);
        return; // Don't throw, just return
      }

      console.log('Reviews data received:', reviewsData?.length || 0);
      
      // Fetch user profiles and service names for each review
      const enrichedReviews = await Promise.all(
        (reviewsData || []).map(async (review) => {
          try {
            // Fetch user profile (public columns only — other users' rows)
            const { data: userProfile } = await supabaseClient
              .from('profiles_public')
              .select('display_name, photo_url')
              .eq('id', review.customer_id)
              .single();
            
            // Fetch service name
            const { data: serviceData } = await supabaseClient
              .from('partner_services')
              .select('name')
              .eq('id', review.service_id)
              .single();
            
            return {
              ...review,
              user_profile: userProfile,
              service_name: serviceData?.name
            };
          } catch (error) {
            console.error('Error enriching review:', error);
            return {
              ...review,
              user_profile: null,
              service_name: null
            };
          }
        })
      );
      
      console.log('Enriched reviews:', enrichedReviews);
      setDetailedReviews(enrichedReviews);
    } catch (error) {
      console.error('Error fetching detailed reviews:', error);
    } finally {
      setLoadingDetailedReviews(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
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

  const getServiceIcon = (serviceName: string, category?: string) => {
    const name = serviceName.toLowerCase();
    const cat = category?.toLowerCase() || '';

    // Hotel / Hospedaje / Boarding
    if (name.includes('hotel') || name.includes('hospedaje') || name.includes('boarding') || cat.includes('boarding')) {
      return <Home size={24} color={colors.primary} />;
    }

    // Consulta / Veterinaria
    if (name.includes('consulta') || name.includes('veterinaria') || name.includes('revision') || name.includes('examen')) {
      return <Stethoscope size={24} color={colors.primary} />;
    }

    // Vacunación / Vacunas
    if (name.includes('vacun') || name.includes('vaccine')) {
      return <Syringe size={24} color={colors.primary} />;
    }

    // Cirugía
    if (name.includes('cirug') || name.includes('surgery') || name.includes('operación')) {
      return <Activity size={24} color={colors.primary} />;
    }

    // Baño / Grooming / Peluquería
    if (name.includes('baño') || name.includes('bath') || name.includes('grooming') || name.includes('peluque')) {
      return <Bath size={24} color={colors.primary} />;
    }

    // Corte / Tijeras
    if (name.includes('corte') || name.includes('trim') || name.includes('pelo')) {
      return <Scissors size={24} color={colors.primary} />;
    }

    // Paseo / Walking
    if (name.includes('paseo') || name.includes('walk') || name.includes('caminar')) {
      return <Dog size={24} color={colors.primary} />;
    }

    // Medicamentos / Tratamiento
    if (name.includes('medicamento') || name.includes('tratamiento') || name.includes('medicina')) {
      return <Pill size={24} color={colors.primary} />;
    }

    // Desparasitación
    if (name.includes('desparasit') || name.includes('deworm')) {
      return <Droplet size={24} color={colors.primary} />;
    }

    // Tienda / Shop
    if (name.includes('tienda') || name.includes('shop') || name.includes('producto')) {
      return <ShoppingBag size={24} color={colors.primary} />;
    }

    // Default: icono de mascota
    return <Heart size={24} color={colors.primary} />;
  };

  /** Estrellas con medias estrellas (4,5 muestra cuatro y media). */
  const renderStarRating = (rating: number, size: number = 16) => (
    <RatingStars rating={rating} size={size} showValue={false} style={styles.starRating} />
  );

  const calculateReviewPercentages = () => {
    if (detailedReviews.length === 0) return [];
    
    const counts = [0, 0, 0, 0, 0]; // For 1-5 stars
    detailedReviews.forEach(review => {
      if (review.rating >= 1 && review.rating <= 5) {
        counts[review.rating - 1]++;
      }
    });
    
    return counts.map((count, index) => ({
      stars: index + 1,
      count,
      percentage: detailedReviews.length > 0 ? (count / detailedReviews.length) * 100 : 0
    })).reverse(); // Show 5 stars first
  };

  const handlePhoneCall = async (phoneNumber: string) => {
    try {
      if (!phoneNumber || phoneNumber === 'Teléfono no disponible') {
        Alert.alert('Sin teléfono', 'Este negocio no tiene un número de teléfono registrado');
        return;
      }

      // Clean phone number
      const cleanedPhone = phoneNumber.replace(/[\s-]/g, '');
      const phoneUrl = `tel:${cleanedPhone}`;

      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'No se puede realizar la llamada desde este dispositivo');
      }
    } catch (error) {
      console.error('Error making phone call:', error);
      Alert.alert('Error', 'No se pudo realizar la llamada');
    }
  };

  const handleContactShelter = async (contactInfo: string) => {
    try {
      // Extract phone number from contact info
      const phoneMatch = contactInfo.match(/(\+?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4})/);
      const emailMatch = contactInfo.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

      if (phoneMatch) {
        const phoneNumber = phoneMatch[1].replace(/[\s-]/g, '');
        const phoneUrl = `tel:${phoneNumber}`;

        if (await Linking.canOpenURL(phoneUrl)) {
          await Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Error', 'No se puede realizar la llamada');
        }
      } else if (emailMatch) {
        const email = emailMatch[1];
        const emailUrl = `mailto:${email}`;

        if (await Linking.canOpenURL(emailUrl)) {
          await Linking.openURL(emailUrl);
        } else {
          Alert.alert('Error', 'No se puede abrir el email');
        }
      } else {
        Alert.alert('Contacto', contactInfo);
      }
    } catch (error) {
      console.error('Error contacting shelter:', error);
      Alert.alert('Error', 'No se pudo contactar al refugio');
    }
  };

  const handleStartAdoptionChat = (petId: string, petName: string) => {
    if (!currentUser) {
      Alert.alert('Iniciar sesión', 'Tenés que iniciar sesión para consultar sobre adopciones.');
      return;
    }

    console.log('Starting adoption chat with:', { petId, petName, partnerId: id, userId: currentUser.id });
    
    if (!petId || !petName || !id) {
      console.error('Missing required parameters for adoption chat:', { petId, petName, partnerId: id });
      Alert.alert('Error', 'Información incompleta para iniciar la conversación');
      return;
    }

    // Crear o encontrar conversación existente
    createOrFindAdoptionConversation(petId, petName);
  };

  const createOrFindAdoptionConversation = async (petId: string, petName: string) => {
    try {
      console.log('Creating/finding conversation for:', { petId, petName, partnerId: id, userId: currentUser?.id });
      
      if (!currentUser?.id || !id) {
        throw new Error('Usuario o partner ID no disponible');
      }
      
      // Verificar si ya existe una conversación
      const { data: existingConversation, error: checkError } = await supabaseClient
        .from('chat_conversations')
        .select('id')
        .eq('adoption_pet_id', petId)
        .eq('user_id', currentUser!.id)
        .single();

      console.log('Existing conversation check:', { existingConversation, checkError });

      let conversationId;

      if (!existingConversation) {
        // No existe conversación, crear una nueva
        console.log('Creating new conversation...');
        
        // Crear conversación usando insert directo
        const conversationData = {
          adoption_pet_id: petId,
          partner_id: id,
          user_id: currentUser!.id,
          status: 'active',
          created_at: new Date().toISOString()
        };
        
        const { error: createError } = await supabaseClient
          .from('chat_conversations')
          .insert([conversationData]);

        if (createError) {
          console.error('Error creating conversation:', createError);
          throw createError;
        }
        
        console.log('New conversation created successfully');
        
        // Buscar la conversación recién creada para obtener el ID
        const { data: createdConversation, error: fetchError } = await supabaseClient
          .from('chat_conversations')
          .select('id')
          .eq('adoption_pet_id', petId)
          .eq('user_id', currentUser!.id)
          .eq('partner_id', id)
          .single();
        
        if (fetchError || !createdConversation) {
          console.error('Error fetching created conversation:', fetchError);
          throw new Error('No se pudo obtener el ID de la conversación creada');
        }
        
        conversationId = createdConversation.id;
        console.log('Conversation ID obtained:', conversationId);

        // Enviar mensaje inicial
        const messageData = {
          conversation_id: conversationId,
          sender_id: currentUser!.id,
          message: `Hola! Estoy interesado/a en adoptar a ${petName}. ¿Podrían darme más información?`,
          message_type: 'text',
          is_read: false,
          created_at: new Date().toISOString()
        };
        
        const { error: messageError } = await supabaseClient
          .from('chat_messages')
          .insert([messageData]);
        
        if (messageError) {
          console.error('Error sending initial message:', messageError);
          // No lanzar error aquí, la conversación ya se creó
        } else {
          console.log('Initial message sent successfully');
        }
      } else {
        console.log('Using existing conversation:', existingConversation.id);
        conversationId = existingConversation.id;
      }

      console.log('Navigating to chat with conversation ID:', conversationId);
      // Navegar al chat
      router.push(`/chat/${conversationId}?petName=${petName}`);
    } catch (error) {
      console.error('Error starting adoption chat:', error);
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `No se pudo iniciar la conversación: ${message || 'Error desconocido'}`);
    }
  };

  const renderAdoptionPet = (pet: any) => (
    <Card key={pet.id} style={styles.adoptionPetCard}>
      {/* Pet Images */}
      {pet.images && pet.images.length > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.petImagesContainer}
        >
          {pet.images.map((image: string, index: number) => (
            <TouchableOpacity
              key={index}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Ver foto ${index + 1} de ${pet.name}`}
              onPress={() => {
                setViewerImages(pet.images);
                setSelectedImageIndex(index);
                setShowImageViewer(true);
              }}
            >
              <Image
                source={{ uri: image }}
                style={styles.petImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      
      {/* Pet Info */}
      <View style={styles.petInfo}>
        <View style={styles.petHeader}>
          <Text style={styles.petName}>
            {pet.species === 'dog' ? '🐶' : pet.species === 'cat' ? '🐱' : '🐾'} {pet.name}
          </Text>
          {(pet.adoptionFee || pet.price) > 0 && (
            <Text style={styles.adoptionFee}>
              ${(pet.adoptionFee || pet.price).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
          )}
        </View>
        
        {/* Handle both new format and legacy format */}
        {pet.isLegacyFormat ? (
          <>
            <Text style={styles.petBasicInfo}>{pet.basicInfo}</Text>
            {pet.healthInfo && (
              <Text style={styles.petHealthInfo}>{pet.healthInfo}</Text>
            )}
            {pet.temperamentInfo && (
              <Text style={styles.petTemperament}>{pet.temperamentInfo}</Text>
            )}
            {pet.adoptionInfo && (
              <Text style={styles.petAdoptionInfo}>{pet.adoptionInfo}</Text>
            )}
            {pet.contactInfo && (
              <Text style={styles.petContactInfo}>{pet.contactInfo}</Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.petBasicInfo}>
              {pet.breed} • {pet.age} {pet.ageUnit === 'years' ? 'años' : 'meses'} • {pet.size} • {pet.gender === 'male' ? 'Macho' : 'Hembra'}
            </Text>
            
            <Text style={styles.petDescription}>{pet.description}</Text>
            
            {/* Health Status */}
            <View style={styles.healthStatus}>
              {pet.isVaccinated && (
                <View style={styles.healthBadge}>
                  <Text style={styles.healthBadgeText}>Vacunado</Text>
                </View>
              )}
              {pet.isNeutered && (
                <View style={styles.healthBadge}>
                  <Text style={styles.healthBadgeText}>Castrado</Text>
                </View>
              )}
              {pet.isDewormed && (
                <View style={styles.healthBadge}>
                  <Text style={styles.healthBadgeText}>Desparasitado</Text>
                </View>
              )}
            </View>
            
            {/* Temperament */}
            {pet.temperament && pet.temperament.length > 0 && (
              <Text style={styles.petTemperament}>
                🧠 Temperamento: {pet.temperament.slice(0, 3).join(', ')}
                {pet.temperament.length > 3 && '...'}
              </Text>
            )}
            
            {/* Adoption Requirements */}
            {pet.adoptionRequirements && pet.adoptionRequirements.length > 0 && (
              <Text style={styles.petAdoptionInfo}>
                🏡 Requisitos: {pet.adoptionRequirements.slice(0, 2).join(', ')}
                {pet.adoptionRequirements.length > 2 && ` +${pet.adoptionRequirements.length - 2} más`}
              </Text>
            )}
            
            {/* Contact Info */}
            {pet.contactInfo && (
              <Text style={styles.petContactInfo}>
                📞 Contacto: {pet.contactInfo}
              </Text>
            )}
          </>
        )}
        
        {/* Action Buttons */}
        <View style={styles.petActions}>
          <Button
            title="Contactar"
            variant="outline"
            fullWidth={false}
            style={styles.petActionButton}
            icon={<Phone size={16} color={colors.primary} />}
            onPress={() => handleContactShelter(pet.contactInfo || pet.contact_info || partner?.phone || '')}
            accessibilityLabel={`Contactar al refugio por ${pet.name}`}
          />

          <Button
            title="Quiero adoptar"
            variant="primary"
            fullWidth={false}
            style={styles.petActionButton}
            icon={<MessageCircle size={16} color={colors.onPrimary} />}
            accessibilityLabel={`Iniciar adopción de ${pet.name}`}
            onPress={() => {
              console.log('Adoption button pressed for pet:', { id: pet.id, name: pet.name });
              if (pet.id && pet.name) {
                handleStartAdoptionChat(pet.id, pet.name);
              } else {
                console.error('Pet ID or name is missing:', { id: pet.id, name: pet.name });
                Alert.alert('Error', 'Información de la mascota incompleta');
              }
            }}
          />
        </View>
      </View>
    </Card>
  );
  
  if (loading) {
    return <LoadingScreen message="Cargando servicios..." />;
  }

  const partnerName = partner?.business_name || partner?.businessName || 'Negocio';
  const partnerType = partner?.business_type || partner?.businessType;
  const isShelter = partnerType === 'shelter';
  const isBoardingPartner = partnerType === 'boarding';
  const heroImage = getHeroImage();

  const handleStickyPrimary = () => {
    if (isShelter) {
      handleContactShelter(partner?.phone || '');
      return;
    }
    if (filteredServices.length === 1) {
      handleServicePress(filteredServices[0].id);
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(servicesSectionY - spacing.lg, 0), animated: true });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Text style={styles.heroPlaceholderEmoji}>{getBusinessTypeIcon(partnerType)}</Text>
            </View>
          )}
          <View style={styles.heroShade} />
          <SafeAreaView style={styles.heroTopBar}>
            <IconButton
              icon={<ArrowLeft size={22} color={colors.text} />}
              variant="surface"
              onPress={handleBackPress}
              accessibilityLabel="Volver"
              style={styles.heroBackButton}
            />
          </SafeAreaView>
        </View>

        {/* Listing header */}
        <View style={styles.listingHeader}>
          <View style={styles.listingLogoWrap}>
            {(partner?.logo || partner?.business_logo) ? (
              <Image source={{ uri: partner.logo || partner.business_logo }} style={styles.partnerLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>{getBusinessTypeIcon(partnerType)}</Text>
              </View>
            )}
          </View>

          <Text style={styles.partnerName} accessibilityRole="header">{partnerName}</Text>
          <Badge label={getBusinessTypeLabel(partnerType)} tone="primary" style={styles.typeBadge} />

          {averageRating > 0 ? (
            <TouchableOpacity
              style={styles.ratingContainer}
              onPress={handleShowReviews}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={`Calificación ${averageRating.toFixed(1)} de 5, ${totalReviews} reseñas. Ver reseñas`}
            >
              <RatingStars rating={averageRating} size={16} />
              <Text style={styles.reviewsText}>· {totalReviews} {totalReviews === 1 ? 'reseña' : 'reseñas'}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.noRatingText}>Todavía sin reseñas</Text>
          )}
        </View>

        {/* Info rows */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <MapPin size={18} color={colors.primary} />
            </View>
            <View style={styles.infoTextBox}>
              <Text style={styles.infoLabel}>Dirección</Text>
              <Text style={styles.infoValue}>{partner?.address || 'Ubicación no disponible'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => handlePhoneCall(partner?.phone || '')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={partner?.phone ? `Llamar al ${partner.phone}` : 'Teléfono no disponible'}
          >
            <View style={styles.infoIcon}>
              <Phone size={18} color={colors.primary} />
            </View>
            <View style={styles.infoTextBox}>
              <Text style={styles.infoLabel}>Teléfono</Text>
              <Text style={[styles.infoValue, !!partner?.phone && styles.infoLink]}>
                {partner?.phone || 'Teléfono no disponible'}
              </Text>
            </View>
          </TouchableOpacity>

          {!!partner?.description && (
            <Text style={styles.partnerDescription}>{partner.description}</Text>
          )}
        </View>

        <View style={styles.divider} />

        {/* Services or Adoption Pets List */}
        <View onLayout={(e) => setServicesSectionY(e.nativeEvent.layout.y)}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {isShelter ? 'Mascotas en adopción' : 'Servicios disponibles'}
          </Text>

          {/* Search Bar */}
          {!isShelter && services.length > 3 && (
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Search size={20} color={colors.icon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar servicios..."
                  placeholderTextColor={colors.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  accessibilityLabel="Buscar servicios de este negocio"
                />
              </View>
            </View>
          )}

          {isShelter ? (
            adoptionPets.length === 0 ? (
              <EmptyState
                icon={<Heart size={32} color={colors.primary} />}
                title="No hay mascotas en adopción"
                description="Este refugio todavía no tiene mascotas disponibles para adopción."
              />
            ) : (
              <View>
                {adoptionPets.map(renderAdoptionPet)}
              </View>
            )
          ) : (
            filteredServices.length === 0 ? (
              <EmptyState
                icon={<Search size={32} color={colors.primary} />}
                title={searchQuery ? 'No encontramos servicios' : 'No hay servicios disponibles'}
                description={searchQuery ? 'Probá con otra búsqueda.' : 'Este negocio todavía no tiene servicios registrados.'}
                actionLabel={searchQuery ? 'Limpiar búsqueda' : undefined}
                onAction={searchQuery ? () => setSearchQuery('') : undefined}
              />
            ) : (
              filteredServices.map((service) => {
                const isBoarding = isBoardingPartner;

                return (
                  <TouchableOpacity
                    key={service.id}
                    onPress={() => handleServicePress(service.id)}
                    style={styles.modernServiceCard}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`${service.name}${!isBoarding && service.price > 0 ? `, ${formatPrice(service.price)}` : ''}`}
                    accessibilityHint={isBoarding ? 'Ver opciones de hospedaje' : 'Ver detalle y reservar'}
                  >
                    <View style={styles.modernServiceContent}>
                      <View style={styles.serviceIconContainer}>
                        {getServiceIcon(service.name, service.category)}
                      </View>

                      <View style={styles.modernServiceCenter}>
                        <Text style={styles.modernServiceName} numberOfLines={2}>
                          {service.name}
                        </Text>
                        {service.description && (
                          <Text style={styles.modernServiceDescription} numberOfLines={2}>
                            {service.description}
                          </Text>
                        )}

                        {!isBoarding && (
                          <View style={styles.modernServiceInfo}>
                            {service.duration && (
                              <View style={styles.modernInfoItem}>
                                <Clock size={14} color={colors.textTertiary} />
                                <Text style={styles.modernInfoText}>
                                  {service.duration} min
                                </Text>
                              </View>
                            )}
                            {service.price > 0 && (
                              <Text style={styles.modernPriceText}>
                                {formatPrice(service.price)}
                              </Text>
                            )}
                          </View>
                        )}

                        {isBoarding && (
                          <Badge label="Ver opciones de hospedaje" tone="primary" size="small" style={styles.boardingBadge} />
                        )}
                      </View>

                      <ChevronRight size={20} color={colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )
          )}
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      {(isShelter || filteredServices.length > 0) && (
        <View style={styles.stickyBar}>
          <View style={styles.stickyInfo}>
            {!isShelter && !isBoardingPartner && minPrice > 0 ? (
              <>
                <Text style={styles.stickyCaption}>Desde</Text>
                <Text style={styles.stickyPrice}>{formatPrice(minPrice)}</Text>
              </>
            ) : (
              <Text style={styles.stickyName} numberOfLines={2}>{partnerName}</Text>
            )}
          </View>
          <Button
            title={isShelter ? 'Contactar' : 'Reservar'}
            onPress={handleStickyPrimary}
            size="large"
            fullWidth={false}
            style={styles.stickyButton}
            accessibilityHint={
              isShelter
                ? 'Llama o escribe al refugio'
                : filteredServices.length === 1
                  ? 'Abre el servicio para reservar'
                  : 'Muestra los servicios para elegir uno'
            }
          />
        </View>
      )}

      {/* Reviews Modal */}
      <Modal
        visible={showReviewsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Reseñas de {partner?.businessName || partner?.business_name}
              </Text>
              <TouchableOpacity
                onPress={() => setShowReviewsModal(false)}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Cerrar reseñas"
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {averageRating > 0 && (
              <View style={styles.overallRating}>
                <View style={styles.ratingDisplay}>
                  <Text style={styles.averageRatingNumber}>
                    {averageRating.toFixed(1)}
                  </Text>
                  {renderStarRating(averageRating, 24)}
                </View>
                <Text style={styles.totalReviewsText}>
                  Basado en {totalReviews} reseñas
                </Text>
              </View>
            )}

            {/* Rating Breakdown */}
            {detailedReviews.length > 0 && (
              <View style={styles.ratingBreakdown}>
                <Text style={styles.breakdownTitle}>Distribución de calificaciones</Text>
                {calculateReviewPercentages().map((item) => (
                  <View key={item.stars} style={styles.breakdownRow}>
                    <Text style={styles.breakdownStars}>{item.stars} ★</Text>
                    <View style={styles.breakdownBar}>
                      <View 
                        style={[
                          styles.breakdownBarFill, 
                          { width: `${item.percentage}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.breakdownPercentage}>
                      {item.percentage.toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
            
            <ScrollView style={styles.reviewsList} showsVerticalScrollIndicator={false}>
              {loadingDetailedReviews ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Cargando reseñas...</Text>
                </View>
              ) : detailedReviews.length === 0 ? (
                <View style={styles.noReviewsContainer}>
                  <Text style={styles.noReviewsText}>
                    Todavía no hay reseñas para este negocio
                  </Text>
                </View>
              ) : (
                detailedReviews.map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewItemHeader}>
                      <View style={styles.reviewerInfo}>
                        <View style={styles.reviewerAvatar}>
                          {review.user_profile?.photo_url ? (
                            <Image 
                              source={{ uri: review.user_profile.photo_url }} 
                              style={styles.reviewerAvatarImage} 
                            />
                          ) : (
                            <User size={16} color={colors.icon} />
                          )}
                        </View>
                        <View style={styles.reviewerDetails}>
                          <Text style={styles.reviewerName}>
                            {review.user_profile?.display_name || 'Usuario'}
                          </Text>
                          <Text style={styles.reviewServiceInfo}>
                            {review.service_name || 'Servicio'} • {new Date(review.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.reviewRatingContainer}>
                        {renderStarRating(review.rating, 16)}
                      </View>
                    </View>
                    
                    {review.comment && (
                      <Text style={styles.reviewComment}>
                        {review.comment}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal
        visible={showImageViewer}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageViewer(false)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerCloseButton}
            onPress={() => setShowImageViewer(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar fotos"
          >
            <Text style={styles.imageViewerCloseText}>✕</Text>
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: selectedImageIndex * width, y: 0 }}
            style={styles.imageViewerScroll}
          >
            {viewerImages.map((imageUrl: string, index: number) => (
              <View key={index} style={styles.imageViewerSlide}>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.imageViewerImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.imageViewerCounter}>
            <Text style={styles.imageViewerCounterText}>
              {selectedImageIndex + 1} / {viewerImages.length}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    flex: 1,
    maxHeight: '80%',
    marginTop: 60,
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
    color: colors.text,
    flex: 1,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textSecondary,
    padding: 4,
  },
  overallRating: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  averageRatingNumber: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#F59E0B',
  },
  totalReviewsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  reviewsList: {
    flex: 1,
  },
  ratingBreakdown: {
    marginBottom: 20,
  },
  breakdownTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownStars: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    width: 40,
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    marginHorizontal: 12,
  },
  breakdownBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  breakdownPercentage: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    width: 35,
    textAlign: 'right',
  },
  reviewItem: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  reviewerAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: 2,
  },
  reviewServiceInfo: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  reviewRatingContainer: {
    alignItems: 'flex-end',
  },
  reviewComment: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noReviewsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noReviewsText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  partnerCard: {
    marginBottom: 16,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerLogo: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontSize: 30,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    ...typography.display,
    color: colors.text,
  },
  partnerDetails: {
    marginBottom: 8,
    gap: 6,
  },
  partnerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  detailIcon: {
    marginTop: 2,
    marginRight: 6,
    flexShrink: 0,
  },
  partnerDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  partnerAddressText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  partnerPhoneText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: colors.success,
    textDecorationLine: 'underline',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    minHeight: 32,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginLeft: 4,
  },
  reviewsText: {
    ...typography.label,
    color: colors.text,
    marginLeft: spacing.xs,
    textDecorationLine: 'underline',
  },
  searchContainer: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
    color: colors.text,
    paddingVertical: 0,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  serviceCard: {
    marginBottom: 12,
  },
  modernServiceCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  modernServiceContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernServiceLeft: {
    marginRight: 12,
    paddingTop: 4,
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  serviceIcon: {
    fontSize: 24,
  },
  modernServiceCenter: {
    flex: 1,
    marginRight: spacing.sm,
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  serviceTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  modernServiceName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  modernServiceDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  modernServiceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modernInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modernInfoText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modernPriceText: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  boardingBadge: {
    marginTop: spacing.sm,
  },
  boardingBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary,
  },
  modernServiceRight: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    minWidth: 95,
  },
  reserveButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reserveButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: colors.white,
    textAlign: 'center',
  },
  serviceContent: {
    padding: 12,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  servicePrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: colors.success,
    flexShrink: 0,
    maxWidth: '40%',
  },
  serviceDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  serviceDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  // Adoption pets styles
  adoptionPetsList: {
    gap: 16,
  },
  adoptionPetCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    padding: 0,
    overflow: 'hidden',
  },
  petImagesContainer: {
    height: 200,
  },
  petImage: {
    width: width - spacing.xl * 2, // ancho de la tarjeta (sin padding)
    height: 200,
  },
  petInfo: {
    padding: spacing.lg,
  },
  petHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  petName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  adoptionFee: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.success,
  },
  petDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  healthStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  healthBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  healthBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#065F46',
  },
  petBasicInfo: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  petHealthInfo: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.success,
    marginBottom: 6,
    lineHeight: 18,
  },
  petTemperament: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#7C3AED',
    marginBottom: 6,
    lineHeight: 18,
  },
  petAdoptionInfo: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.danger,
    marginBottom: 6,
    lineHeight: 18,
  },
  petContactInfo: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  petActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.sm,
    gap: 6,
  },
  contactButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.white,
  },
  adoptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingVertical: 12,
    borderRadius: radius.sm,
    gap: 6,
  },
  adoptionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.white,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseText: {
    fontSize: 24,
    color: colors.white,
    fontFamily: 'Inter-Bold',
  },
  imageViewerScroll: {
    flex: 1,
  },
  imageViewerSlide: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: width,
    height: '100%',
  },
  imageViewerCounter: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageViewerCounterText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.white,
  },
  contentInner: {
    paddingBottom: 120,
  },
  hero: {
    width: '100%',
    height: 280,
    backgroundColor: colors.surfaceAlt,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  heroPlaceholderEmoji: {
    fontSize: 56,
  },
  heroShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  heroTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'android' ? spacing.xxxl : spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  heroBackButton: {
    marginTop: spacing.sm,
    ...shadows.md,
  },
  listingHeader: {
    paddingHorizontal: spacing.xl,
    marginTop: -36,
  },
  listingLogoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  typeBadge: {
    marginTop: spacing.sm,
  },
  noRatingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  infoSection: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoTextBox: {
    flex: 1,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
  },
  infoLink: {
    color: colors.primary,
  },
  partnerDescription: {
    ...typography.body,
    color: colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xl,
    marginVertical: spacing.xl,
  },
  petActionButton: {
    flex: 1,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxxl : spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  stickyInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  stickyCaption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stickyPrice: {
    ...typography.heading,
    color: colors.text,
  },
  stickyName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  stickyButton: {
    minWidth: 150,
  },
});
