import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { Eye, Clock, CircleCheck as CheckCircle, CircleX as XCircle, Camera, MapPin, Phone, Star, Mail, Calendar, User, Image as ImageIcon, X } from 'lucide-react-native';
import { EmptyState, SkeletonList, toast } from '../../components/ui';
import { BusinessTypeIcon } from '../../components/admin/BusinessTypeIcon';
import { AdminDetailRow } from '../../components/admin/AdminDetailRow';
import { ReviewStatusBadge } from '../../components/admin/ReviewStatusBadge';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { supabaseClient } from '../../lib/supabase';
import { NotificationService } from '../../utils/notifications';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';
import { colors, radius, spacing, typography } from '../../constants/theme';

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
  const [refreshing, setRefreshing] = useState(false);

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

      toast.success('Solicitud aprobada correctamente');
      
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
      'Rechazar solicitud',
      '¿Seguro que querés rechazar esta solicitud?',
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

              toast.success('Solicitud rechazada');
              
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (requestType === 'partner') {
        await fetchRequests();
      } else {
        await fetchPlaceRequests();
      }
    } finally {
      setRefreshing(false);
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
      Alert.alert('Faltan datos', 'Completá al menos nombre, dirección y descripción antes de aprobar.');
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

      toast.success('Lugar aprobado y publicado correctamente');

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
      'Rechazar lugar',
      '¿Seguro que querés rechazar esta propuesta de lugar?',
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

              toast.success('Propuesta de lugar rechazada');

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
          <View style={styles.businessIcon}>
            <BusinessTypeIcon type="place" />
          </View>
          <View style={styles.businessDetails}>
            <Text style={styles.businessName}>{request.name}</Text>
            <Text style={styles.businessType}>{request.category}</Text>
          </View>
        </View>

        <ReviewStatusBadge status={isPending ? 'pending' : request.status === 'approved' ? 'approved' : 'rejected'} />
      </View>

      <View style={styles.methodBadge}>
        {request.submission_method === 'photo_ai' ? (
          <Camera size={14} color={colors.textTertiary} />
        ) : (
          <MapPin size={14} color={colors.textTertiary} />
        )}
        <Text style={styles.methodBadgeText}>
          {request.submission_method === 'photo_ai' ? 'Enviado con foto (IA)' : 'Enviado manualmente'}
        </Text>
      </View>

      <Text style={styles.requestDescription} numberOfLines={2}>
        {request.description}
      </Text>

      <View style={styles.requestDetails}>
        <AdminDetailRow icon={MapPin} text={request.address} numberOfLines={2} />
        <AdminDetailRow icon={Phone} text={request.phone} />
        <AdminDetailRow icon={User} text={request.requester?.display_name || request.requester?.email || 'Usuario'} />
        <AdminDetailRow icon={Calendar} text={new Date(request.created_at).toLocaleDateString()} />
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
              accessibilityRole="button"
              accessibilityLabel={`Rechazar ${request.name || 'lugar'}`}
            >
              {rejectingPlaceId === request.id ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Text style={styles.rejectButtonText}>Rechazar</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => openReviewModal(request)}
              disabled={rejectingPlaceId === request.id}
              accessibilityRole="button"
              accessibilityLabel={`Revisar y aprobar ${request.name || 'lugar'}`}
            >
              <Text style={styles.approveButtonText}>Revisar y aprobar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );

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
          <View style={styles.businessIcon}>
            <BusinessTypeIcon type={request.businessType} />
          </View>
          <View style={styles.businessDetails}>
            <Text style={styles.businessName}>{request.businessName}</Text>
            <Text style={styles.businessType}>{getBusinessTypeName(request.businessType)}</Text>
          </View>
        </View>
        
        <ReviewStatusBadge status={isPending ? 'pending' : 'approved'} />
      </View>

      <Text style={styles.requestDescription} numberOfLines={2}>
        {request.description}
      </Text>

      <View style={styles.requestDetails}>
        <AdminDetailRow icon={MapPin} text={request.address} numberOfLines={2} />
        <AdminDetailRow icon={Phone} text={request.phone} />
        <AdminDetailRow icon={Mail} text={request.email} />
        <AdminDetailRow icon={Calendar} text={request.createdAt.toLocaleDateString()} />
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
              accessibilityRole="button"
              accessibilityLabel={`Rechazar ${request.businessName || 'solicitud'}`}
            >
              {rejectingId === request.id ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Text style={styles.rejectButtonText}>Rechazar</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.approveButton, approvingId === request.id && styles.disabledButton]}
              onPress={() => handleApproveRequest(request.id)}
              disabled={approvingId === request.id || rejectingId === request.id}
              accessibilityRole="button"
              accessibilityLabel={`Aprobar ${request.businessName || 'solicitud'}`}
            >
              {approvingId === request.id ? (
                <ActivityIndicator size="small" color={colors.white} />
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
          <XCircle size={64} color={colors.danger} />
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
        <Text style={styles.title} accessibilityRole="header">Solicitudes</Text>
        <Text style={styles.subtitle}>Revisá y aprobá negocios y lugares nuevos</Text>
      </View>

      <View style={styles.typeBar}>
        <TouchableOpacity
          style={[styles.typeChip, requestType === 'partner' && styles.activeTypeChip]}
          onPress={() => setRequestType('partner')}
          accessibilityRole="tab"
          accessibilityState={{ selected: requestType === 'partner' }}
        >
          <Text style={[styles.typeChipText, requestType === 'partner' && styles.activeTypeChipText]}>
            Negocios
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeChip, requestType === 'place' && styles.activeTypeChip]}
          onPress={() => setRequestType('place')}
          accessibilityRole="tab"
          accessibilityState={{ selected: requestType === 'place' }}
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
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'pending' }}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pendientes ({requestType === 'partner' ? pendingRequests.length : pendingPlaceRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'processed' && styles.activeTab]}
          onPress={() => setActiveTab('processed')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'processed' }}
        >
          <Text style={[styles.tabText, activeTab === 'processed' && styles.activeTabText]}>
            Procesadas ({requestType === 'partner' ? processedRequests.length : processedPlaceRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {requestType === 'partner' ? (
          loading && !refreshing ? (
            <SkeletonList kind="cards" count={3} style={styles.skeleton} />
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
              <EmptyState
                icon={<CheckCircle size={32} color={colors.primary} />}
                title="Todo al día"
                description="No hay solicitudes de negocios pendientes de revisión."
                actionLabel="Actualizar"
                onAction={() => {
                  setLoading(true);
                  logDebug('Manual refresh triggered by user for pending requests');
                  fetchRequests();
                }}
              />
            ) : (
              pendingRequests.map(request => renderRequest(request, true))
            )
          ) : (
            processedRequests.length === 0 ? (
              <EmptyState
                icon={<Eye size={32} color={colors.primary} />}
                title="Sin historial"
                description="Todavía no hay solicitudes de negocios procesadas."
                actionLabel="Actualizar"
                onAction={() => {
                  setLoading(true);
                  logDebug('Manual refresh triggered by user for processed requests');
                  fetchRequests();
                }}
              />
            ) : (
              processedRequests.map(request => renderRequest(request, false))
            )
          )
        ) : placeLoading && !refreshing ? (
          <SkeletonList kind="cards" count={3} style={styles.skeleton} />
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
            <EmptyState
              icon={<CheckCircle size={32} color={colors.primary} />}
              title="Todo al día"
              description="No hay lugares pendientes de revisión."
              actionLabel="Actualizar"
              onAction={() => {
                setPlaceLoading(true);
                fetchPlaceRequests();
              }}
            />
          ) : (
            pendingPlaceRequests.map(request => renderPlaceRequest(request, true))
          )
        ) : (
          processedPlaceRequests.length === 0 ? (
            <EmptyState
              icon={<Eye size={32} color={colors.primary} />}
              title="Sin historial"
              description="Todavía no hay lugares procesados."
              actionLabel="Actualizar"
              onAction={() => {
                setPlaceLoading(true);
                fetchPlaceRequests();
              }}
            />
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
                        accessibilityRole="radio"
                        accessibilityState={{ selected: reviewCategory === cat.value }}
                      >
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
                leftIcon={<MapPin size={20} color={colors.textTertiary} />}
              />

              <Input
                label="Teléfono"
                placeholder="Ej: +1234567890"
                value={reviewPhone}
                onChangeText={setReviewPhone}
                leftIcon={<Phone size={20} color={colors.textTertiary} />}
              />

              <View style={styles.ratingSection}>
                <Text style={styles.categoryLabel}>Rating (qué tan pet-friendly es) *</Text>
                <View style={styles.ratingSelector}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      onPress={() => setReviewRating(rating)}
                      accessibilityRole="button"
                      accessibilityLabel={`${rating} de 5 estrellas`}
                      accessibilityState={{ selected: rating === reviewRating }}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Star
                        size={28}
                        color={rating <= reviewRating ? colors.accent : colors.border}
                        fill={rating <= reviewRating ? colors.accent : 'transparent'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Input
                label="Descripción *"
                placeholder="Describí por qué este lugar es pet-friendly..."
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
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => handleRemoveReviewImage(index)}
                          accessibilityRole="button"
                          accessibilityLabel={`Quitar foto ${index + 1}`}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <X size={14} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.imageActions}>
                  <TouchableOpacity style={styles.imageActionButton} onPress={() => handleAddReviewImage(true)}>
                    <Camera size={24} color={colors.textTertiary} />
                    <Text style={styles.imageActionText}>Tomar foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imageActionButton} onPress={() => handleAddReviewImage(false)}>
                    <ImageIcon size={24} color={colors.textTertiary} />
                    <Text style={styles.imageActionText}>Galería</Text>
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
                    label="¿Falta algún servicio? Agregalo acá"
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
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 32,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  typeBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  typeChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    minHeight: 36,
    justifyContent: 'center',
  },
  activeTypeChip: {
    backgroundColor: colors.primary,
  },
  typeChipText: {
    ...typography.label,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
  },
  activeTypeChipText: {
    color: colors.white,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.label,
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  skeleton: {
    padding: 0,
  },
  requestCard: {
    marginBottom: spacing.lg,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessIcon: {
    marginRight: spacing.md,
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  businessType: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  pendingText: {
    ...typography.caption,
    color: colors.warning,
    marginLeft: spacing.xs,
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  approvedText: {
    ...typography.caption,
    color: colors.success,
    marginLeft: spacing.xs,
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  rejectedText: {
    ...typography.caption,
    color: colors.danger,
    marginLeft: spacing.xs,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  methodBadgeText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  requestDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  requestDetails: {
    marginBottom: spacing.md,
  },
  requestDetail: {
    ...typography.bodySmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  businessLogo: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    width: '100%',
  },
  requestActionsContainer: {
    marginTop: spacing.md,
    width: '100%',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  rejectButtonText: {
    ...typography.label,
    color: colors.danger,
  },
  approveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  approveButtonText: {
    ...typography.label,
    color: colors.white,
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
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
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  accessDeniedText: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  modalTitle: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 18,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryLabel: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  categoryOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryOption: {
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 80,
  },
  selectedCategoryOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryOptionIcon: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    marginBottom: spacing.xs,
  },
  categoryOptionText: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  selectedCategoryOptionText: {
    color: colors.white,
  },
  ratingSection: {
    marginBottom: spacing.lg,
  },
  ratingSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  imageSection: {
    marginBottom: spacing.lg,
  },
  imagesPreviewScroll: {
    marginBottom: spacing.md,
  },
  imagePreviewContainer: {
    marginRight: spacing.md,
    position: 'relative',
  },
  selectedImage: {
    width: 150,
    height: 150,
    borderRadius: radius.sm,
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
    ...typography.bodyStrong,
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
  imageActionText: {
    ...typography.label,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  amenitiesSection: {
    marginBottom: spacing.sm,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  amenityOption: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedAmenityOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  amenityOptionText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  selectedAmenityOptionText: {
    color: colors.white,
  },
  customAmenityContainer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  addAmenityButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  addAmenityButtonText: {
    ...typography.label,
    color: colors.white,
  },
  modalButtonsContainer: {
    flexDirection: 'column',
    gap: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  cancelModalButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    width: '100%',
  },
  cancelModalButtonText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
});
