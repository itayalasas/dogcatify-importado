import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, ActivityIndicator, Modal } from 'react-native';
import { Eye, Clock, CircleCheck as CheckCircle, Circle as XCircle, Camera, MapPin, Phone, Star } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { supabaseClient } from '../../lib/supabase';
import { NotificationService } from '../../utils/notifications';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
};

const PLACE_CATEGORIES = [
  { value: 'park', label: 'Parque', icon: '🌳' },
  { value: 'restaurant', label: 'Restaurante', icon: '🍽️' },
  { value: 'hotel', label: 'Hotel', icon: '🏨' },
  { value: 'store', label: 'Tienda', icon: '🏪' },
  { value: 'beach', label: 'Playa', icon: '🏖️' },
  { value: 'cafe', label: 'Cafetería', icon: '☕' },
  { value: 'vet', label: 'Veterinaria', icon: '🐾' },
];

const PLACE_PET_AMENITIES = [
  'Área de juegos para mascotas',
  'Bebederos para mascotas',
  'Menú especial para mascotas',
  'Área de descanso para mascotas',
  'Servicio de cuidado de mascotas',
  'Bolsas para desechos',
  'Correas disponibles',
  'Juguetes para mascotas',
];

// Mercado Pago credentials now live in partner_payment_credentials, keyed by
// user_id — every business of that user already shares the same row, so
// there's nothing to copy anymore. Just flip mercadopago_connected on the
// newly approved business if the user already has credentials on file.
// (No access_token/refresh_token ever passes through this admin screen.)
const replicateMercadoPagoConfigOnApproval = async (userId: string, newPartnerId: string) => {
  try {
    const [{ data: creds, error }, { data: existingPartners }] = await Promise.all([
      supabaseClient
        .from('partner_payment_credentials')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle(),
      supabaseClient
        .from('partners')
        .select('commission_percentage')
        .eq('user_id', userId)
        .eq('is_verified', true)
        .eq('mercadopago_connected', true)
        .neq('id', newPartnerId)
        .limit(1),
    ]);

    if (error) {
      console.error('Error checking existing MP credentials on approval:', error);
      return;
    }

    if (!creds) {
      console.log('No existing Mercado Pago configuration found for user on approval');
      return;
    }

    const { error: updateError } = await supabaseClient
      .from('partners')
      .update({
        mercadopago_connected: true,
        commission_percentage: existingPartners?.[0]?.commission_percentage ?? 5.0,
        updated_at: new Date().toISOString()
      })
      .eq('id', newPartnerId);

    if (updateError) {
      console.error('Error marking new partner as MP-connected on approval:', updateError);
    } else {
      console.log('New partner marked as Mercado Pago connected on approval');
    }
  } catch (error) {
    console.error('Error in replicateMercadoPagoConfigOnApproval:', error);
    // Don't throw error to avoid breaking the approval process
  }
};

// Función para añadir logs detallados
const logDebug = (message: string, data?: any) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[DEBUG AdminRequests ${timestamp}] ${message}`, data || '');
};

export default function AdminRequests() {
  const { currentUser } = useAuth();
  const { sendNotificationToUser } = useNotifications();
  const [requestType, setRequestType] = useState<'partner' | 'place'>('partner');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [processedRequests, setProcessedRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending');
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendingPlaceRequests, setPendingPlaceRequests] = useState<any[]>([]);
  const [processedPlaceRequests, setProcessedPlaceRequests] = useState<any[]>([]);
  const [placeLoading, setPlaceLoading] = useState(true);
  const [rejectingPlaceId, setRejectingPlaceId] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);

  // Review-and-approve modal: lets the admin fill in whatever the user's
  // submission is missing (address, phone, photos, amenities) before the
  // place goes live, instead of publishing exactly what was submitted.
  const [reviewingRequest, setReviewingRequest] = useState<any | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewCategory, setReviewCategory] = useState('park');
  const [reviewAddress, setReviewAddress] = useState('');
  const [reviewPhone, setReviewPhone] = useState('');
  const [reviewDescription, setReviewDescription] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewAmenities, setReviewAmenities] = useState<string[]>([]);
  const [reviewCustomAmenity, setReviewCustomAmenity] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);

  useEffect(() => {
    if (currentUser?.isAdmin === true) {
      logDebug('User is admin, fetching requests data...');
      fetchRequests();
      fetchPlaceRequests();
    } else {
      logDebug('User is not admin or not logged in');
      setLoading(false);
      setPlaceLoading(false);
    }
  }, [currentUser]);

  const fetchRequests = async () => {
    logDebug('Starting to fetch requests');
    setError(null);
    setLoading(true);
    try {
      // Fetch pending requests - explicitly looking for is_verified = false
      logDebug('Fetching pending requests...');
      const { data: pendingData, error: pendingError, count } = await supabaseClient
        .from('partners')
        .select('*', { count: 'exact' })
        .eq('is_verified', false)
        .order('created_at', { ascending: false });

      if (pendingError) {
        logDebug('Error fetching pending requests:', pendingError);
        throw pendingError;
      }
      
      logDebug(`Found ${pendingData?.length || 0} pending requests, count: ${count}`);
      if (pendingData && pendingData.length > 0) {
        logDebug('Pending requests raw data sample:', pendingData[0]);
      } else {
        logDebug('No pending requests found');
      }
      
      const requests = pendingData?.map(partner => ({
        id: partner.id,
        businessName: partner.business_name,
        businessType: partner.business_type,
        description: partner.description,
        address: partner.address,
        phone: partner.phone,
        email: partner.email,
        logo: partner.logo,
        isVerified: partner.is_verified,
        isActive: partner.is_active,
        createdAt: new Date(partner.created_at),
      })) || [];
      
      setPendingRequests(requests);
      logDebug(`Processed ${requests.length} pending requests`);

      // Fetch processed requests
      logDebug('Fetching processed requests...');
      const { data: processedData, error: processedError, count: processedCount } = await supabaseClient
        .from('partners')
        .select('*', { count: 'exact' })
        .eq('is_verified', true)
        .order('created_at', { ascending: false });

      if (processedError) {
        logDebug('Error fetching processed requests:', processedError);
        throw processedError;
      }
      
      logDebug(`Found ${processedData?.length || 0} processed requests, count: ${processedCount}`);
      
      const processedRequests = processedData?.map(partner => ({
        id: partner.id,
        businessName: partner.business_name,
        businessType: partner.business_type,
        description: partner.description,
        address: partner.address,
        phone: partner.phone,
        email: partner.email,
        logo: partner.logo,
        isVerified: partner.is_verified,
        isActive: partner.is_active,
        createdAt: new Date(partner.created_at),
        updatedAt: partner.updated_at ? new Date(partner.updated_at) : undefined,
      })) || [];
      
      setProcessedRequests(processedRequests);
      logDebug(`Processed ${processedRequests.length} approved requests`);
      
      // Forzar actualización de la UI
      setTimeout(() => {
        setLoading(false);
      }, 100);
    } catch (error) {
      const errorMessage = `Error al cargar solicitudes: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      setError(errorMessage);
      logDebug('Error in fetchRequests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    setApprovingId(requestId);
    try {
      // Get the partner data before approval to check user_id
      const { data: partnerData, error: fetchError } = await supabaseClient
        .from('partners')
        .select('user_id, business_name, business_type, email')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Get the user's display name from profiles
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('display_name')
        .eq('id', partnerData.user_id)
        .single();

      if (profileError) {
        console.error('Error fetching profile data:', profileError);
      }
      
      const { error } = await supabaseClient
        .from('partners')
        .update({
          is_verified: true,
          approval_status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      // After approval, check if user has other businesses with MP config
      await replicateMercadoPagoConfigOnApproval(partnerData.user_id, requestId);

      // Enviar notificación push al usuario
      try {
        const businessTypeName = getBusinessTypeName(partnerData.business_type);
        await sendNotificationToUser(
          partnerData.user_id,
          '¡Negocio aprobado! 🎉',
          `Tu ${businessTypeName} "${partnerData.business_name}" ha sido verificado y ya está activo`,
          {
            type: 'partner_approved',
            businessName: partnerData.business_name,
            businessType: partnerData.business_type,
            partnerId: requestId,
            deepLink: '(tabs)/profile'
          }
        );
        console.log('Approval notification sent to user');
      } catch (notificationError) {
        console.error('Error sending approval notification:', notificationError);
        // No interrumpir el flujo si falla la notificación
      }

      // Send partner welcome email using new API
      if (partnerData.email) {
        try {
          const { sendPartnerWelcomeEmailAPI } = await import('../../utils/emailConfirmation');

          // Get partner name - try from profile first, then from partner email username
          let partnerName = profileData?.display_name;

          if (!partnerName || partnerName.trim() === '') {
            // Extract name from email as fallback (e.g., "john.doe@email.com" -> "John Doe")
            const emailUsername = partnerData.email.split('@')[0];
            partnerName = emailUsername
              .split(/[._-]/)
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
          }

          console.log('Sending partner welcome email to:', partnerData.email);
          console.log('Partner name:', partnerName);
          console.log('Business name:', partnerData.business_name);

          const emailResult = await sendPartnerWelcomeEmailAPI(
            partnerData.email,
            partnerName,
            partnerData.business_name
          );

          if (emailResult.success) {
            console.log('✅ Partner welcome email sent successfully!');
            if (emailResult.log_id) {
              console.log('Email log ID:', emailResult.log_id);
            }
          } else {
            console.error('❌ Partner welcome email failed:', emailResult.error);
          }
        } catch (emailError) {
          console.error('Error sending partner welcome email:', emailError);
          // Continue with approval process even if email fails
        }
      }

      Alert.alert('Éxito', 'Solicitud aprobada correctamente');
      
      // Actualizar las listas localmente sin necesidad de recargar
      const approvedRequest = pendingRequests.find(req => req.id === requestId);
      if (approvedRequest) {
        // Quitar de pendientes
        setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        
        // Añadir a procesadas con is_verified = true
        const updatedRequest = {
          ...approvedRequest,
          isVerified: true,
          updatedAt: new Date()
        };
        setProcessedRequests(prev => [updatedRequest, ...prev]);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      Alert.alert('Error', 'No se pudo aprobar la solicitud');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectRequest = (requestId: string) => {
    setRejectingId(requestId);
    Alert.alert(
      'Rechazar Solicitud',
      '¿Estás seguro de que quieres rechazar esta solicitud?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {            
            try {
              // Get partner details first
              const { data: partnerData, error: fetchError } = await supabaseClient
                .from('partners')
                .select('email, business_name')
                .eq('id', requestId)
                .single();

              if (fetchError) throw fetchError;

              const { error } = await supabaseClient
                .from('partners')
                .update({
                  is_verified: false,
                  approval_status: 'rejected',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', requestId);

              if (error) throw error;

              // Send rejection email
              if (partnerData) {
                try {
                  await NotificationService.sendPartnerRejectionEmail(
                    partnerData.email,
                    partnerData.business_name,
                    'No cumple con los requisitos necesarios para ser parte de nuestra plataforma en este momento.'
                  );
                } catch (emailError) {
                  console.error('Error sending partner rejection email:', emailError);
                  // Continue with rejection process even if email fails
                }
              }

              Alert.alert('Solicitud rechazada', 'La solicitud ha sido rechazada');
              
              // Actualizar las listas localmente
              const rejectedRequest = pendingRequests.find(req => req.id === requestId);
              if (rejectedRequest) {
                // Quitar de pendientes
                setPendingRequests(prev => prev.filter(req => req.id !== requestId));
              }
            } catch (error) {
              console.error('Error rejecting request:', error);
              Alert.alert('Error', 'No se pudo rechazar la solicitud');
            } finally {
              setRejectingId(null);
            }
          }
        }
      ]
    );
  };

  const fetchPlaceRequests = async () => {
    setPlaceError(null);
    setPlaceLoading(true);
    try {
      const { data: pendingData, error: pendingError } = await supabaseClient
        .from('place_requests')
        .select('*, requester:requested_by(display_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      setPendingPlaceRequests(pendingData || []);

      const { data: processedData, error: processedError } = await supabaseClient
        .from('place_requests')
        .select('*, requester:requested_by(display_name, email)')
        .neq('status', 'pending')
        .order('updated_at', { ascending: false });

      if (processedError) throw processedError;

      setProcessedPlaceRequests(processedData || []);
    } catch (error) {
      const errorMessage = `Error al cargar solicitudes de lugares: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      setPlaceError(errorMessage);
      console.error('Error fetching place requests:', error);
    } finally {
      setPlaceLoading(false);
    }
  };

  const openReviewModal = (request: any) => {
    setReviewingRequest(request);
    setReviewName(request.name || '');
    setReviewCategory(request.category || 'park');
    setReviewAddress(request.address || '');
    setReviewPhone(request.phone || '');
    setReviewDescription(request.description || '');
    setReviewRating(request.rating || 5);
    setReviewAmenities(request.pet_amenities || []);
    setReviewCustomAmenity('');
    setReviewImages(
      request.images && request.images.length > 0
        ? request.images
        : (request.source_photo_url ? [request.source_photo_url] : [])
    );
  };

  const closeReviewModal = () => {
    setReviewingRequest(null);
  };

  const toggleReviewAmenity = (amenity: string) => {
    setReviewAmenities(prev =>
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  const handleAddReviewCustomAmenity = () => {
    if (reviewCustomAmenity.trim() && !reviewAmenities.includes(reviewCustomAmenity.trim())) {
      setReviewAmenities(prev => [...prev, reviewCustomAmenity.trim()]);
      setReviewCustomAmenity('');
    }
  };

  const handleAddReviewImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permisos requeridos', fromCamera
        ? 'Se necesitan permisos para usar la cámara'
        : 'Se necesitan permisos para acceder a la galería');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      setReviewImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const handleRemoveReviewImage = (index: number) => {
    setReviewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirmApprovePlace = async () => {
    if (!reviewingRequest) return;

    if (!reviewName.trim() || !reviewAddress.trim() || !reviewDescription.trim()) {
      Alert.alert('Faltan datos', 'Completa al menos nombre, dirección y descripción antes de aprobar.');
      return;
    }

    setReviewSubmitting(true);
    try {
      // Anything already an https URL was uploaded when the user submitted;
      // only local file:// URIs the admin just added need uploading now.
      const finalImageUrls = await Promise.all(
        reviewImages.map(async (uri) => {
          if (uri.startsWith('http')) return uri;
          const filename = `places/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          return uploadImageUtil(uri, filename);
        })
      );

      const { data: newPlace, error: insertError } = await supabaseClient
        .from('places')
        .insert([{
          name: reviewName.trim(),
          category: reviewCategory,
          address: reviewAddress.trim(),
          phone: reviewPhone.trim() || null,
          description: reviewDescription.trim(),
          pet_amenities: reviewAmenities,
          coordinates: reviewingRequest.coordinates,
          rating: reviewRating,
          image_url: finalImageUrls[0] || null,
          images: finalImageUrls,
          is_active: true,
          created_by: reviewingRequest.requested_by,
          place_request_id: reviewingRequest.id,
        }])
        .select('id')
        .single();

      if (insertError) throw insertError;

      const { error: updateError } = await supabaseClient
        .from('place_requests')
        .update({
          status: 'approved',
          reviewed_by: currentUser?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewingRequest.id);

      if (updateError) throw updateError;

      try {
        await sendNotificationToUser(
          reviewingRequest.requested_by,
          '¡Tu lugar fue aprobado! 🎉',
          `"${reviewName.trim()}" ya está visible en Lugares Pet-Friendly`,
          {
            type: 'place_approved',
            placeId: newPlace?.id,
            deepLink: '(tabs)/places',
          }
        );
      } catch (notificationError) {
        console.error('Error sending place approval notification:', notificationError);
      }

      Alert.alert('Éxito', 'Lugar aprobado y publicado correctamente');

      setPendingPlaceRequests(prev => prev.filter(r => r.id !== reviewingRequest.id));
      setProcessedPlaceRequests(prev => [{ ...reviewingRequest, status: 'approved', reviewed_at: new Date().toISOString() }, ...prev]);
      closeReviewModal();
    } catch (error) {
      console.error('Error approving place request:', error);
      Alert.alert('Error', `No se pudo aprobar el lugar: ${getErrorMessage(error)}`);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleRejectPlaceRequest = (request: any) => {
    setRejectingPlaceId(request.id);
    Alert.alert(
      'Rechazar Lugar',
      '¿Estás seguro de que quieres rechazar esta propuesta de lugar?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => setRejectingPlaceId(null) },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            try {
              const rejectionReason = 'El lugar propuesto no cumple con los requisitos necesarios para publicarse en este momento.';

              const { error } = await supabaseClient
                .from('place_requests')
                .update({
                  status: 'rejected',
                  rejection_reason: rejectionReason,
                  reviewed_by: currentUser?.id,
                  reviewed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', request.id);

              if (error) throw error;

              try {
                await sendNotificationToUser(
                  request.requested_by,
                  'Tu lugar no fue aprobado',
                  rejectionReason,
                  { type: 'place_rejected' }
                );
              } catch (notificationError) {
                console.error('Error sending place rejection notification:', notificationError);
              }

              Alert.alert('Solicitud rechazada', 'La propuesta de lugar ha sido rechazada');

              setPendingPlaceRequests(prev => prev.filter(r => r.id !== request.id));
            } catch (error) {
              console.error('Error rejecting place request:', error);
              Alert.alert('Error', 'No se pudo rechazar el lugar');
            } finally {
              setRejectingPlaceId(null);
            }
          }
        }
      ]
    );
  };

  const renderPlaceRequest = (request: any, isPending: boolean = true) => (
    <Card key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.businessInfo}>
          <Text style={styles.businessIcon}>📍</Text>
          <View style={styles.businessDetails}>
            <Text style={styles.businessName}>{request.name}</Text>
            <Text style={styles.businessType}>{request.category}</Text>
          </View>
        </View>

        {isPending ? (
          <View style={styles.pendingBadge}>
            <Clock size={16} color="#92400E" />
            <Text style={styles.pendingText}>Pendiente</Text>
          </View>
        ) : request.status === 'approved' ? (
          <View style={styles.approvedBadge}>
            <CheckCircle size={16} color="#10B981" />
            <Text style={styles.approvedText}>Aprobado</Text>
          </View>
        ) : (
          <View style={styles.rejectedBadge}>
            <XCircle size={16} color="#DC2626" />
            <Text style={styles.rejectedText}>Rechazado</Text>
          </View>
        )}
      </View>

      <View style={styles.methodBadge}>
        {request.submission_method === 'photo_ai' ? (
          <Camera size={14} color="#6B7280" />
        ) : (
          <MapPin size={14} color="#6B7280" />
        )}
        <Text style={styles.methodBadgeText}>
          {request.submission_method === 'photo_ai' ? 'Enviado con foto (IA)' : 'Enviado manualmente'}
        </Text>
      </View>

      <Text style={styles.requestDescription} numberOfLines={2}>
        {request.description}
      </Text>

      <View style={styles.requestDetails}>
        <Text style={styles.requestDetail}>📍 {request.address}</Text>
        {request.phone && <Text style={styles.requestDetail}>📞 {request.phone}</Text>}
        <Text style={styles.requestDetail}>
          👤 {request.requester?.display_name || request.requester?.email || 'Usuario'}
        </Text>
        <Text style={styles.requestDetail}>
          📅 {new Date(request.created_at).toLocaleDateString()}
        </Text>
      </View>

      {request.source_photo_url && (
        <Image source={{ uri: request.source_photo_url }} style={styles.businessLogo} />
      )}

      {isPending && (
        <View style={styles.requestActionsContainer}>
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.rejectButton, rejectingPlaceId === request.id && styles.disabledButton]}
              onPress={() => handleRejectPlaceRequest(request)}
              disabled={rejectingPlaceId === request.id}
            >
              {rejectingPlaceId === request.id ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Text style={styles.rejectButtonText}>Rechazar</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => openReviewModal(request)}
              disabled={rejectingPlaceId === request.id}
            >
              <Text style={styles.approveButtonText}>Revisar y aprobar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );

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

  const getBusinessTypeName = (type: string) => {
    const types: Record<string, string> = {
      veterinary: 'Veterinaria',
      grooming: 'Peluquería',
      walking: 'Paseador',
      boarding: 'Pensión',
      shop: 'Tienda',
      shelter: 'Refugio'
    };
    return types[type] || type;
  };

  const renderRequest = (request: any, isPending: boolean = true) => (
    <Card key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.businessInfo}>
          <Text style={styles.businessIcon}>
            {getBusinessTypeIcon(request.businessType)}
          </Text>
          <View style={styles.businessDetails}>
            <Text style={styles.businessName}>{request.businessName}</Text>
            <Text style={styles.businessType}>{getBusinessTypeName(request.businessType)}</Text>
          </View>
        </View>
        
        {isPending ? (
          <View style={styles.pendingBadge}>
            <Clock size={16} color="#92400E" />
            <Text style={styles.pendingText}>Pendiente</Text>
          </View>
        ) : (
          <View style={styles.approvedBadge}>
            <CheckCircle size={16} color="#10B981" />
            <Text style={styles.approvedText}>Aprobado</Text>
          </View>
        )}
      </View>

      <Text style={styles.requestDescription} numberOfLines={2}>
        {request.description}
      </Text>

      <View style={styles.requestDetails}>
        <Text style={styles.requestDetail}>📍 {request.address}</Text>
        <Text style={styles.requestDetail}>📞 {request.phone}</Text>
        <Text style={styles.requestDetail}>📧 {request.email}</Text>
        <Text style={styles.requestDetail}>
          📅 {request.createdAt.toLocaleDateString()}
        </Text>
      </View>

      {request.logo && (
        <Image source={{ uri: request.logo }} style={styles.businessLogo} />
      )}

      {isPending && (
        <View style={styles.requestActionsContainer}>
          <View style={styles.requestActions}>
            <TouchableOpacity 
              style={[styles.rejectButton, rejectingId === request.id && styles.disabledButton]}
              onPress={() => handleRejectRequest(request.id)}
              disabled={rejectingId === request.id || approvingId === request.id}
            >
              {rejectingId === request.id ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Text style={styles.rejectButtonText}>Rechazar</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.approveButton, approvingId === request.id && styles.disabledButton]}
              onPress={() => handleApproveRequest(request.id)}
              disabled={approvingId === request.id || rejectingId === request.id}
            >
              {approvingId === request.id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.approveButtonText}>Aprobar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );

  const isAdmin = currentUser?.isAdmin === true;
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <XCircle size={64} color="#EF4444" />
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
        <Text style={styles.title}>Panel de Administración</Text>
        <Text style={styles.subtitle}>Gestión de Solicitudes</Text>
      </View>

      <View style={styles.typeBar}>
        <TouchableOpacity
          style={[styles.typeChip, requestType === 'partner' && styles.activeTypeChip]}
          onPress={() => setRequestType('partner')}
        >
          <Text style={[styles.typeChipText, requestType === 'partner' && styles.activeTypeChipText]}>
            Negocios
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeChip, requestType === 'place' && styles.activeTypeChip]}
          onPress={() => setRequestType('place')}
        >
          <Text style={[styles.typeChipText, requestType === 'place' && styles.activeTypeChipText]}>
            Lugares
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pendientes ({requestType === 'partner' ? pendingRequests.length : pendingPlaceRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'processed' && styles.activeTab]}
          onPress={() => setActiveTab('processed')}
        >
          <Text style={[styles.tabText, activeTab === 'processed' && styles.activeTabText]}>
            Procesadas ({requestType === 'partner' ? processedRequests.length : processedPlaceRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {requestType === 'partner' ? (
          loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Cargando solicitudes...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Button
                title="Reintentar"
                onPress={fetchRequests}
                size="medium"
              />
            </View>
          ) : activeTab === 'pending' ? (
            pendingRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckCircle size={48} color="#10B981" />
                <Text style={styles.emptyTitle}>¡Todo al día!</Text>
                <Text style={styles.emptySubtitle}>
                  No hay solicitudes pendientes de revisión o hubo un error al cargarlas
                </Text>
                <Button
                  title="Actualizar"
                  onPress={() => {
                    setLoading(true);
                    logDebug('Manual refresh triggered by user for pending requests');
                    fetchRequests();
                  }}
                  size="medium"
                />
              </View>
            ) : (
              pendingRequests.map(request => renderRequest(request, true))
            )
          ) : (
            processedRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Eye size={48} color="#6B7280" />
                <Text style={styles.emptyTitle}>Sin historial</Text>
                <Text style={styles.emptySubtitle}>
                  No hay solicitudes procesadas aún o hubo un error al cargarlas
                </Text>
                <Button
                  title="Actualizar"
                  onPress={() => {
                    setLoading(true);
                    logDebug('Manual refresh triggered by user for processed requests');
                    fetchRequests();
                  }}
                  size="medium"
                />
              </View>
            ) : (
              processedRequests.map(request => renderRequest(request, false))
            )
          )
        ) : placeLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando solicitudes...</Text>
          </View>
        ) : placeError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{placeError}</Text>
            <Button
              title="Reintentar"
              onPress={fetchPlaceRequests}
              size="medium"
            />
          </View>
        ) : activeTab === 'pending' ? (
          pendingPlaceRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <CheckCircle size={48} color="#10B981" />
              <Text style={styles.emptyTitle}>¡Todo al día!</Text>
              <Text style={styles.emptySubtitle}>
                No hay lugares pendientes de revisión
              </Text>
              <Button
                title="Actualizar"
                onPress={() => {
                  setPlaceLoading(true);
                  fetchPlaceRequests();
                }}
                size="medium"
              />
            </View>
          ) : (
            pendingPlaceRequests.map(request => renderPlaceRequest(request, true))
          )
        ) : (
          processedPlaceRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Eye size={48} color="#6B7280" />
              <Text style={styles.emptyTitle}>Sin historial</Text>
              <Text style={styles.emptySubtitle}>
                No hay lugares procesados aún
              </Text>
              <Button
                title="Actualizar"
                onPress={() => {
                  setPlaceLoading(true);
                  fetchPlaceRequests();
                }}
                size="medium"
              />
            </View>
          ) : (
            processedPlaceRequests.map(request => renderPlaceRequest(request, false))
          )
        )}
      </ScrollView>

      <Modal
        visible={!!reviewingRequest}
        transparent
        animationType="slide"
        onRequestClose={closeReviewModal}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Revisar y aprobar lugar</Text>
              <Text style={styles.modalSubtitle}>
                Completá o corregí lo que haga falta antes de publicarlo. Lo que envió el usuario ya está precargado.
              </Text>

              <Input
                label="Nombre del lugar *"
                placeholder="Ej: Parque Central Pet-Friendly"
                value={reviewName}
                onChangeText={setReviewName}
              />

              <View style={styles.categorySection}>
                <Text style={styles.categoryLabel}>Categoría *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.categoryOptions}>
                    {PLACE_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.value}
                        style={[styles.categoryOption, reviewCategory === cat.value && styles.selectedCategoryOption]}
                        onPress={() => setReviewCategory(cat.value)}
                      >
                        <Text style={styles.categoryOptionIcon}>{cat.icon}</Text>
                        <Text style={[styles.categoryOptionText, reviewCategory === cat.value && styles.selectedCategoryOptionText]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <Input
                label="Dirección *"
                placeholder="Ej: Av. Principal 123, Ciudad"
                value={reviewAddress}
                onChangeText={setReviewAddress}
                leftIcon={<MapPin size={20} color="#6B7280" />}
              />

              <Input
                label="Teléfono"
                placeholder="Ej: +1234567890"
                value={reviewPhone}
                onChangeText={setReviewPhone}
                leftIcon={<Phone size={20} color="#6B7280" />}
              />

              <View style={styles.ratingSection}>
                <Text style={styles.categoryLabel}>Rating (qué tan pet-friendly es) *</Text>
                <View style={styles.ratingSelector}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <TouchableOpacity key={rating} onPress={() => setReviewRating(rating)}>
                      <Star
                        size={28}
                        color={rating <= reviewRating ? '#FCD34D' : '#E5E7EB'}
                        fill={rating <= reviewRating ? '#FCD34D' : 'transparent'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Input
                label="Descripción *"
                placeholder="Describe por qué este lugar es pet-friendly..."
                value={reviewDescription}
                onChangeText={setReviewDescription}
                multiline
                numberOfLines={4}
              />

              <View style={styles.imageSection}>
                <Text style={styles.categoryLabel}>Fotos del lugar ({reviewImages.length})</Text>

                {reviewImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesPreviewScroll}>
                    {reviewImages.map((imageUri, index) => (
                      <View key={`${imageUri}-${index}`} style={styles.imagePreviewContainer}>
                        <Image source={{ uri: imageUri }} style={styles.selectedImage} />
                        <TouchableOpacity style={styles.removeImageButton} onPress={() => handleRemoveReviewImage(index)}>
                          <Text style={styles.removeImageText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.imageActions}>
                  <TouchableOpacity style={styles.imageActionButton} onPress={() => handleAddReviewImage(true)}>
                    <Camera size={24} color="#6B7280" />
                    <Text style={styles.imageActionText}>Tomar foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imageActionButton} onPress={() => handleAddReviewImage(false)}>
                    <Text style={styles.imageActionText}>📷 Galería</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.amenitiesSection}>
                <Text style={styles.categoryLabel}>Servicios para mascotas</Text>
                <View style={styles.amenitiesGrid}>
                  {PLACE_PET_AMENITIES.map((amenity) => (
                    <TouchableOpacity
                      key={amenity}
                      style={[styles.amenityOption, reviewAmenities.includes(amenity) && styles.selectedAmenityOption]}
                      onPress={() => toggleReviewAmenity(amenity)}
                    >
                      <Text style={[styles.amenityOptionText, reviewAmenities.includes(amenity) && styles.selectedAmenityOptionText]}>
                        {amenity}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.customAmenityContainer}>
                  <Input
                    label="¿Falta algún servicio? Agrégalo aquí"
                    placeholder="Ej: Peluquería canina"
                    value={reviewCustomAmenity}
                    onChangeText={setReviewCustomAmenity}
                  />
                  <TouchableOpacity style={styles.addAmenityButton} onPress={handleAddReviewCustomAmenity}>
                    <Text style={styles.addAmenityButtonText}>Agregar</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity style={styles.cancelModalButton} onPress={closeReviewModal} disabled={reviewSubmitting}>
                  <Text style={styles.cancelModalButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <Button
                  title={reviewSubmitting ? 'Publicando...' : 'Confirmar y publicar'}
                  onPress={handleConfirmApprovePlace}
                  loading={reviewSubmitting}
                  disabled={reviewSubmitting}
                  size="large"
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  typeBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  activeTypeChip: {
    backgroundColor: '#DC2626',
  },
  typeChipText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeTypeChipText: {
    color: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#DC2626',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#DC2626',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  requestCard: {
    marginBottom: 16,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  businessType: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
    marginLeft: 4,
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  approvedText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#065F46',
    marginLeft: 4,
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rejectedText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#991B1B',
    marginLeft: 4,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  methodBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  requestDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  requestDetails: {
    marginBottom: 12,
  },
  requestDetail: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  businessLogo: {
    width: 60,
    height: 60,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    width: '100%',
  },
  requestActionsContainer: {
    marginTop: 12,
    width: '100%',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginRight: 6,
  },
  rejectButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginLeft: 6,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280', 
    textAlign: 'center',
    marginBottom: 16,
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
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  categoryOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryOption: {
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 80,
  },
  selectedCategoryOption: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  categoryOptionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  categoryOptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  selectedCategoryOptionText: {
    color: '#FFFFFF',
  },
  ratingSection: {
    marginBottom: 16,
  },
  ratingSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  imageSection: {
    marginBottom: 16,
  },
  imagesPreviewScroll: {
    marginBottom: 12,
  },
  imagePreviewContainer: {
    marginRight: 12,
    position: 'relative',
  },
  selectedImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
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
    marginTop: 8,
  },
  amenitiesSection: {
    marginBottom: 8,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityOption: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedAmenityOption: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  amenityOptionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedAmenityOptionText: {
    color: '#FFFFFF',
  },
  customAmenityContainer: {
    marginTop: 16,
    gap: 8,
  },
  addAmenityButton: {
    backgroundColor: '#2D6A6F',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addAmenityButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  modalButtonsContainer: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
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
});
