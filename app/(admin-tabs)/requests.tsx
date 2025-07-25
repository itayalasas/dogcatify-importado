import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, ActivityIndicator } from 'react-native';
import { Eye, Clock, CircleCheck as CheckCircle, Circle as XCircle } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { NotificationService } from '../../utils/notifications';

const replicateMercadoPagoConfigOnApproval = async (userId: string, newPartnerId: string) => {
  try {
    console.log('Checking for existing Mercado Pago configuration for user on approval:', userId);
    
    // Find any existing verified business from this user with Mercado Pago configured
    const { data: existingPartners, error } = await supabaseClient
      .from('partners')
      .select('*')
      .eq('user_id', userId)
      .eq('is_verified', true)
      .eq('mercadopago_connected', true)
      .neq('id', newPartnerId) // Exclude the newly approved partner
      .limit(1);
    
    if (error) {
      console.error('Error checking existing partners on approval:', error);
      return;
    }
    
    if (existingPartners && existingPartners.length > 0) {
      const sourcePartner = existingPartners[0];
      console.log('Found existing partner with MP config on approval:', sourcePartner.business_name);
      
      if (sourcePartner.mercadopago_config) {
        console.log('Replicating Mercado Pago configuration to newly approved business...');
        
        // Replicate the Mercado Pago configuration to the newly approved partner
        const { error: updateError } = await supabaseClient
          .from('partners')
          .update({
            mercadopago_connected: true,
            mercadopago_config: sourcePartner.mercadopago_config,
            commission_percentage: sourcePartner.commission_percentage || 5.0,
            updated_at: new Date().toISOString()
          })
          .eq('id', newPartnerId);
        
        if (updateError) {
          console.error('Error replicating MP config on approval:', updateError);
        } else {
          console.log('Mercado Pago configuration replicated successfully on approval');
        }
      }
    } else {
      console.log('No existing Mercado Pago configuration found for user on approval');
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
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [processedRequests, setProcessedRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending');
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.email?.toLowerCase() === 'admin@dogcatify.com') {
      logDebug('User is admin, fetching requests data...');
      fetchRequests();
    } else {
      logDebug('User is not admin or not logged in');
      setLoading(false);
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
      const errorMessage = `Error al cargar solicitudes: ${error.message || 'Error desconocido'}`;
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
        .select('user_id, business_name')
        .eq('id', requestId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const { error } = await supabaseClient
        .from('partners')
        .update({
          is_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      // After approval, check if user has other businesses with MP config
      await replicateMercadoPagoConfigOnApproval(partnerData.user_id, requestId);
      // Get partner details to send email
      const { data: emailPartnerData, error: emailFetchError } = await supabaseClient
        .from('partners')
        .select('email, business_name')
        .eq('id', requestId)
        .single();

      if (emailFetchError) throw emailFetchError;

      // Send verification email
      if (emailPartnerData) {
        try {
          await NotificationService.sendPartnerVerificationEmail(
            emailPartnerData.email,
            emailPartnerData.business_name
          );
        } catch (emailError) {
          console.error('Error sending partner verification email:', emailError);
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

  const isAdmin = currentUser?.email?.toLowerCase() === 'admin@dogcatify.com';
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

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pendientes ({pendingRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'processed' && styles.activeTab]}
          onPress={() => setActiveTab('processed')}
        >
          <Text style={[styles.tabText, activeTab === 'processed' && styles.activeTabText]}>
            Procesadas ({processedRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
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
        )}
      </ScrollView>
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
});