import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Package, Heart, Settings, Clock, Users } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { canAccessPartnerModule, getPartnerLockedActionLabel, getPartnerPlan, resolvePartnerPlanTier } from '../../utils/partnerPlans';

interface BusinessConfig {
  id: string;
  businessName: string;
  businessType: string;
  subscriptionPlanTier: string;
  subscriptionPlanStatus?: string | null;
  subscriptionPlanExpiresAt?: string | null;
  features: {
    agenda?: boolean;
    products?: boolean;
    adoptions?: boolean;
  };
}

export default function ConfigureBusiness() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { currentUser } = useAuth();
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    fetchBusiness();
  }, [businessId]);

  const fetchBusiness = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', businessId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setBusiness({
          id: data.id,
          businessName: data.business_name,
          businessType: data.business_type,
          subscriptionPlanTier: resolvePartnerPlanTier(
            data.subscription_plan_tier,
            data.subscription_plan_status,
            data.subscription_plan_expires_at,
          ),
          subscriptionPlanStatus: data.subscription_plan_status || null,
          subscriptionPlanExpiresAt: data.subscription_plan_expires_at || null,
          features: data.features || {}
        });
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar la información del negocio');
    } finally {
      setLoading(false);
    }
  };

  const getBusinessTypeConfig = (type: string) => {
    switch (type) {
      case 'veterinary':
        return {
          name: 'Veterinaria',
          icon: '🏥',
          services: [
            'Consulta general',
            'Vacunación',
            'Cirugía',
            'Emergencias',
            'Diagnóstico',
            'Desparasitación'
          ],
          products: [
            'Medicamentos',
            'Alimentos especiales',
            'Suplementos',
            'Antiparasitarios',
            'Vitaminas'
          ]
        };
      case 'grooming':
        return {
          name: 'Peluquería',
          icon: '✂️',
          services: [
            'Baño completo',
            'Corte de pelo',
            'Corte de uñas',
            'Limpieza de oídos',
            'Desenredado',
            'Tratamiento antipulgas'
          ],
          products: [
            'Champús',
            'Acondicionadores',
            'Cepillos',
            'Perfumes',
            'Accesorios de aseo'
          ]
        };
      case 'walking':
        return {
          name: 'Paseador',
          icon: '🚶',
          services: [
            'Paseo corto (30min)',
            'Paseo largo (60min)',
            'Ejercicio en parque',
            'Cuidado por horas',
            'Socialización'
          ],
          products: [
            'Correas',
            'Arneses',
            'Juguetes',
            'Snacks',
            'Accesorios para paseo'
          ]
        };
      case 'boarding':
        return {
          name: 'Pensión',
          icon: '🏠',
          services: [
            'Hospedaje diario',
            'Hospedaje nocturno',
            'Cuidado fin de semana',
            'Hospedaje semanal'
          ],
          products: [
            'Camas',
            'Juguetes',
            'Alimentos',
            'Accesorios',
            'Snacks'
          ]
        };
      case 'shop':
        return {
          name: 'Tienda',
          icon: '🛍️',
          categories: [
            'Comida',
            'Juguetes',
            'Accesorios',
            'Salud',
            'Higiene',
            'Camas y Casas',
            'Snacks',
            'Vitaminas',
            'Antiparasitarios'
          ],
          services: [
            'Asesoría nutricional',
            'Consulta de productos',
            'Pedidos personalizados'
          ]
        };
      case 'shelter':
        return {
          name: 'Refugio',
          icon: '🐾',
          adoptionTypes: [
            'Perros',
            'Gatos',
            'Cachorros',
            'Adultos',
            'Seniors'
          ],
          services: [
            'Visitas al refugio',
            'Entrevistas de adopción',
            'Seguimiento post adopción',
            'Entrega de mascota'
          ],
          products: [
            'Alimentos',
            'Accesorios',
            'Medicamentos',
            'Kits de adopción'
          ]
        };
      default:
        return {
          name: 'Negocio',
          icon: '🏢',
          services: []
        };
    }
  };

  const handleConfigureAgenda = () => {
    router.push(`/partner/configure-schedule-page?partnerId=${business?.id}`);
  };

  const handleConfigureProducts = () => {
    router.push({
      pathname: '/(partner-tabs)/products',
      params: { businessId: businessId }
    });
  };

  const handleConfigureAdoptions = () => {
    if (!business || !canAccessPartnerModule(business.subscriptionPlanTier, 'adoptions', business.businessType)) {
      Alert.alert(
        'Plan requerido',
        'La gestion de adopciones esta disponible solo para refugios con plan Pro.'
      );
      return;
    }

    router.push(`/partner/manage-adoptions?partnerId=${businessId}`);
  };

  const handleAddService = () => {
    if (business?.businessType === 'shelter') {
      router.push({
        pathname: '/partner/add-adoption-pet',
        params: { partnerId: business?.id }
      });
      return;
    }

    router.push({
      pathname: '/partner/add-service',
      params: {
        partnerId: business?.id,
        businessType: business?.businessType
      }
    });
  };

  const handleAddProduct = () => {
    router.push({
      pathname: '/partner/add-service',
      params: {
        partnerId: business?.id,
        businessType: 'shop'
      }
    });
  };

  const handleViewOrders = () => {
    router.push({
      pathname: '/partner/orders',
      params: { partnerId: business?.id }
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando configuración...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!business) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se pudo cargar la información del negocio</Text>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const config = getBusinessTypeConfig(business.businessType);
  const plan = getPartnerPlan(business.subscriptionPlanTier);
  const canManageAdoptions = business.businessType === 'shelter';
  const adoptionPlanAllowed = canAccessPartnerModule(
    business.subscriptionPlanTier,
    'adoptions',
    business.businessType,
    business.subscriptionPlanStatus,
    business.subscriptionPlanExpiresAt,
  );
  const showAgendaSection = business.businessType !== 'shop' && business.features?.agenda !== false;
  const agendaTitle = business.businessType === 'shelter'
    ? 'Agenda de Adopciones'
    : 'Gestión de Agenda';
  const agendaDescription = business.businessType === 'shelter'
    ? 'Coordina visitas, entrevistas y entregas de adopción'
    : 'Configura horarios, duración de citas y disponibilidad';
  const agendaItemsTitle = business.businessType === 'shelter'
    ? 'Citas disponibles:'
    : 'Servicios disponibles:';
  const agendaItems = business.businessType === 'shelter'
    ? (config.services || [])
    : (config.services || []);

  return (
    <SafeAreaView style={styles.container}> 
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Configurar Negocio</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.businessCard}>
          <View style={styles.businessHeader}>
            <Text style={styles.businessIcon}>{config.icon}</Text>
            <View style={styles.businessInfo}> 
              <Text style={styles.businessName}>{business.businessName}</Text> 
              <Text style={styles.businessType}>{config.name}</Text> 
              <View style={[styles.planBadge, { backgroundColor: plan.surface, borderColor: plan.border }]}>
                <Text style={[styles.planBadgeText, { color: plan.accent }]}>
                  Plan {plan.name}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Configuración de Agenda */}
        {showAgendaSection && (
          <Card style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <Calendar size={24} color="#3B82F6" />
            <Text style={styles.featureTitle}>{agendaTitle}</Text>
          </View>
          <Text style={styles.featureDescription}>
            {agendaDescription}
          </Text>
          
          <View style={styles.servicesList}>
            <Text style={styles.servicesTitle}>{agendaItemsTitle}</Text>
            {agendaItems.map((service, index) => (
              <View key={index} style={styles.serviceItem}>
                <Text style={styles.serviceText}>• {service}</Text>
              </View>
            ))}
          </View>

          <View style={styles.featureActions}>
            <View style={styles.actionButtonContainer}>
              <Button
                title="Configurar Horarios"
                onPress={handleConfigureAgenda}
                variant="outline"
                size="medium"
              />
            </View>
            <View style={styles.actionButtonContainer}>
                <Button
                  title={business.businessType === 'shelter' ? 'Agregar Mascota' : 'Agregar Servicio'}
                  onPress={handleAddService}
                  size="medium"
                />
            </View>
          </View>
          </Card>
        )}

        {/* Configuración de Productos - Solo para tiendas */}
        {business.businessType === 'shop' && (
          <Card style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <Package size={24} color="#10B981" />
              <Text style={styles.featureTitle}>Gestión de Productos</Text>
            </View>
            <Text style={styles.featureDescription}>
              Administra tu inventario, precios y categorías de productos
            </Text>

            <View style={styles.servicesList}>
              <Text style={styles.servicesTitle}>Categorías disponibles:</Text>
              {(config.categories || config.products || []).map((category, index) => (
                <View key={index} style={styles.serviceItem}>
                  <Text style={styles.serviceText}>• {category}</Text>
                </View>
              ))}
            </View>

            <View style={styles.featureActions}>
              <View style={styles.actionButtonContainer}>
                <Button
                  title="Gestionar Productos"
                  onPress={handleConfigureProducts}
                  variant="outline"
                  size="medium"
                />
              </View>
              <View style={styles.actionButtonContainer}>
                <Button
                  title="Agregar Producto"
                  onPress={handleAddProduct}
                  size="medium"
                />
              </View>
            </View>
          </Card>
        )}

        {/* Gestión de Pedidos - Solo para tiendas */}
        {business.businessType === 'shop' && (
          <Card style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <Package size={24} color="#F59E0B" />
              <Text style={styles.featureTitle}>Gestión de Pedidos</Text>
            </View>
            <Text style={styles.featureDescription}>
              Administra los pedidos de tus clientes
            </Text>

            <View style={styles.featureActions}>
              <View style={styles.actionButtonContainer}>
                <Button
                  title="Ver Pedidos"
                  onPress={handleViewOrders}
                  size="large"
                />
              </View>
            </View>
          </Card>
        )}

        {/* Configuración de Adopciones */}
        {canManageAdoptions && (
          <Card style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <Heart size={24} color="#EF4444" />
              <Text style={styles.featureTitle}>Gestión de Adopciones</Text>
            </View>
            <Text style={styles.featureDescription}>
              Administra las mascotas disponibles para adopción
            </Text>

            {!adoptionPlanAllowed && (
              <View style={styles.lockedNotice}>
                <Text style={styles.lockedNoticeTitle}>Disponible en plan Pro</Text>
                <Text style={styles.lockedNoticeText}>
                  {getPartnerLockedActionLabel('adoptions')}
                </Text>
              </View>
            )}
            
            <View style={styles.servicesList}>
              <Text style={styles.servicesTitle}>Tipos de adopción:</Text>
              {(config.adoptionTypes || []).map((type, index) => (
                <View key={index} style={styles.serviceItem}>
                  <Text style={styles.serviceText}>• {type}</Text>
                </View>
              ))}
            </View>

            <View style={styles.featureActions}>
              <View style={{ flex: 1 }}>
                <Button
                  title={adoptionPlanAllowed ? 'Ver Adopciones' : 'Plan Pro requerido'}
                  onPress={handleConfigureAdoptions}
                  variant="outline"
                  size="medium"
                  disabled={!adoptionPlanAllowed}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Agregar Mascota"
                  onPress={handleAddService}
                  size="medium"
                  disabled={!adoptionPlanAllowed}
                />
              </View>
            </View>
          </Card>
        )}

        {/* Configuración General - Comentado hasta implementar */}
        {/*
        <Card style={styles.generalCard}>
          <View style={styles.generalHeader}>
            <Settings size={24} color="#6B7280" />
            <Text style={styles.generalTitle}>Configuración General</Text>
          </View>

          <TouchableOpacity style={styles.configOption}>
            <Users size={20} color="#6B7280" />
            <Text style={styles.configOptionText}>Gestionar Equipo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.configOption}>
            <Clock size={20} color="#6B7280" />
            <Text style={styles.configOptionText}>Horarios de Atención</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.configOption}>
            <Settings size={20} color="#6B7280" />
            <Text style={styles.configOptionText}>Configuración Avanzada</Text>
          </TouchableOpacity>
        </Card>
        */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 6,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  businessCard: {
    marginBottom: 16,
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  businessType: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  planBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  planBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  featureCard: {
    marginBottom: 16,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 8,
  },
  featureDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  lockedNotice: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  lockedNoticeTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6D28D9',
    marginBottom: 4,
  },
  lockedNoticeText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  servicesList: {
    marginBottom: 16,
  },
  servicesTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  serviceItem: {
    paddingVertical: 2,
  },
  serviceText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  featureActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  actionButtonContainer: {
    flex: 1,
    minWidth: '45%',
    marginTop: 8,
  },
  generalCard: {
    marginBottom: 16,
  },
  generalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  generalTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 8,
  },
  configOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  configOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  // Estilos para los botones
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
});
