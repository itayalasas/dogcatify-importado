import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Settings, Clock, Calendar, MapPin, DollarSign, ArrowLeft } from 'lucide-react-native';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  isActive: boolean;
  createdAt: any;
}

interface ScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface PartnerProfile {
  businessType: string;
  businessName: string;
  logo?: string;
  address: string;
}

const getBusinessTypeConfig = (businessType: string) => {
  const configs = {
    veterinary: { needsSchedule: true, icon: '🏥' },
    grooming: { needsSchedule: true, icon: '✂️' },
    training: { needsSchedule: true, icon: '🎓' },
    boarding: { needsSchedule: true, icon: '🏠' },
    walking: { needsSchedule: false, icon: '🚶' },
    sitting: { needsSchedule: false, icon: '🪑' },
    store: { needsSchedule: true, icon: '🏪' },
  };
  return configs[businessType as keyof typeof configs] || { needsSchedule: false, icon: '🔧' };
};

const getDayName = (dayOfWeek: number) => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[dayOfWeek];
};

export default function PartnerServices() {
  const { currentUser } = useAuth();
  const params = useLocalSearchParams<{ businessId?: string; businessType?: string }>();
  const businessId = params.businessId;
  const businessType = params.businessType;
  const [services, setServices] = useState<Service[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile>({
    businessType: '',
    businessName: '',
    address: '',
  });
  const [loading, setLoading] = useState(true);

  const fetchServices = (partnerId: string) => { 
    const servicesQuery = query(
      collection(db, 'partnerServices'),
      where('partnerId', '==', partnerId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(servicesQuery, (snapshot) => {
      const servicesData = snapshot.docs.map(doc => ({ 
        id: doc.id,
        ...doc.data()
      })) as Service[];
      setServices(servicesData);
    });

    return unsubscribe;
  };

  useEffect(() => {
    if (!currentUser || !businessId) return;

    console.log('Loading services for business ID:', businessId as string);

    // If businessId is provided, use it to fetch the specific partner
    if (businessId) {
      const partnerRef = doc(db, 'partners', businessId as string);
      const unsubscribePartner = onSnapshot(partnerRef, (doc) => {
        if (doc.exists()) {
          const partnerData = doc.data() as PartnerProfile;
          setPartnerProfile({...partnerData, id: doc.id});

          // Fetch services for this partner
          const servicesUnsubscribe = fetchServices(businessId as string);

          // Fetch schedule for this partner
          const scheduleQuery = query(
            collection(db, 'businessSchedule'),
            where('partnerId', '==', businessId as string),
            orderBy('dayOfWeek', 'asc')
          );

          const unsubscribeSchedule = onSnapshot(scheduleQuery, (scheduleSnapshot) => {
            const scheduleData = scheduleSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as ScheduleItem[];
            setSchedule(scheduleData);
          });

          return () => {
            servicesUnsubscribe();
            unsubscribeSchedule();
          };
        }
        setLoading(false);
      });

      return () => unsubscribePartner();
    }
  }, [currentUser, businessId]);

  const handleAddService = () => {
    if (partnerProfile && partnerProfile.id) {
      router.push({
        pathname: '/partner/add-service',
        params: {
          partnerId: businessId,
          businessType: partnerProfile.businessType
        }
      });
    } else {
      Alert.alert('Error', 'No se pudo obtener la información del negocio');
    }
  };

  const handleConfigureSchedule = () => {
    if (partnerProfile && partnerProfile.id) {
      router.push({
        pathname: '/partner/configure-schedule-page',
        params: { partnerId: businessId }
      });
    } else {
      Alert.alert('Error', 'No se pudo obtener la información del negocio');
    }
  };

  const handleEditService = (serviceId: string) => {
    router.push(`/partner/edit-service?serviceId=${serviceId}`);
  };

  const renderScheduleCard = () => {
    const config = getBusinessTypeConfig(partnerProfile.businessType);
    
    if (!config.needsSchedule) return null;

    return ( 
      <Card style={styles.scheduleCard}>
        <View style={styles.scheduleHeader}>
          <Text style={styles.scheduleTitle}>⏰ Horarios de Trabajo</Text>
          <TouchableOpacity onPress={handleConfigureSchedule}>
            <Settings size={20} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {schedule.length === 0 ? (
          <View style={styles.noSchedule}>
            <Clock size={32} color="#9CA3AF" />
            <Text style={styles.noScheduleText}>No hay horarios configurados</Text>
            <Button
              title="Configurar Horarios"
              onPress={handleConfigureSchedule}
              size="medium"
            />
          </View>
        ) : (
          <View style={styles.scheduleList}> 
            {schedule.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.scheduleItem}>
                <Text style={styles.scheduleDay}>{getDayName(item.dayOfWeek)}</Text>
                <Text style={styles.scheduleTime}>
                  {item.startTime} - {item.endTime}
                </Text>
              </View>
            ))}
            {schedule.length > 3 && (
              <Text style={styles.moreSchedule}>
                +{schedule.length - 3} días más
              </Text>
            )}
          </View>
        )}
      </Card>
    );
  };

  const renderServiceCard = (service: Service) => ( 
    <Card key={service.id} style={styles.serviceCard}>
      <TouchableOpacity onPress={() => handleEditService(service.id)}>
        <View style={styles.serviceHeader}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <View style={[styles.statusBadge, service.isActive ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={[styles.statusText, service.isActive ? styles.activeText : styles.inactiveText]}>
              {service.isActive ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </View>

        <Text style={styles.serviceDescription}>{service.description}</Text>
        
        <View style={styles.serviceDetails}>
          <View style={styles.serviceDetail}>
            <DollarSign size={16} color="#6B7280" />
            <Text style={styles.serviceDetailText}>${service.price}</Text>
          </View>
          <View style={styles.serviceDetail}>
            <Clock size={16} color="#6B7280" />
            <Text style={styles.serviceDetailText}>{service.duration} min</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );

  if (loading) { 
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando información del negocio...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}> 
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.businessInfo}>
            {partnerProfile.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {getBusinessTypeConfig(partnerProfile.businessType).icon}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.title}>Gestión de Servicios</Text>
              <Text style={styles.businessName}>{partnerProfile.businessName}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddService}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}> 
        {renderScheduleCard()}

        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Servicios Ofrecidos</Text>
          
          {services.length === 0 ? (
            <Card style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No tienes servicios registrados</Text> 
              <Text style={styles.emptyStateText}>
                Agrega tu primer servicio para comenzar a recibir reservas
              </Text>
              <Button
                title="Agregar Servicio"
                onPress={handleAddService}
                size="medium"
              />
            </Card>
          ) : ( 
            <View style={styles.servicesList}>
              {services.map(renderServiceCard)}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  backButton: {
    padding: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoPlaceholderText: {
    fontSize: 20,
  },
  businessName: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 20,
  },
  scheduleCard: {
    margin: 20,
    marginBottom: 10,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scheduleTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  noSchedule: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noScheduleText: {
    fontSize: 14,
    color: '#6B7280',
    marginVertical: 12,
    textAlign: 'center',
  },
  scheduleList: {
    gap: 8,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  scheduleDay: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  scheduleTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  moreSchedule: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  servicesSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  servicesList: {
    gap: 12,
  },
  serviceCard: {
    padding: 16,
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
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  activeText: {
    color: '#065F46',
  },
  inactiveText: {
    color: '#991B1B',
  },
  serviceDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  serviceDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  serviceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceDetailText: {
    fontSize: 14,
    color: '#6B7280',
  },
});