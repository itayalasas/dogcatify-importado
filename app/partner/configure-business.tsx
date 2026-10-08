import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Package, Heart, Settings, Clock, Users } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormSkeleton } from '../../components/partner-setup/FormSkeleton';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { canAccessPartnerModule, getPartnerLockedActionLabel, getPartnerPlan, resolvePartnerPlanTier } from '../../utils/partnerPlans';
import { colors, radius, spacing, typography } from '../../constants/theme';

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
      console.error('Error fetching business:', error);
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
        'La gestión de adopciones está disponible solo para refugios con plan Pro.'
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
        <ScreenHeader title="Configurar negocio" />
        <FormSkeleton />
      </SafeAreaView>
    );
  }

  if (!business) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Configurar negocio" />
        <EmptyState
          title="No se pudo cargar la información del negocio"
          description="Revisá tu conexión e intentá de nuevo."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
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
    ? 'Agenda de adopciones'
    : 'Gestión de agenda';
  const agendaDescription = business.businessType === 'shelter'
    ? 'Coordiná visitas, entrevistas y entregas de adopción'
    : 'Configurá horarios, duración de citas y disponibilidad';
  const agendaItemsTitle = business.businessType === 'shelter'
    ? 'Citas disponibles:'
    : 'Servicios disponibles:';
  const agendaItems = business.businessType === 'shelter'
    ? (config.services || [])
    : (config.services || []);

  return (
    <SafeAreaView style={styles.container}> 
      <ScreenHeader title={"Configurar negocio"} />

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
            <Calendar size={24} color={colors.primary} />
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
                title="Configurar horarios"
                onPress={handleConfigureAgenda}
                variant="outline"
                size="medium"
              />
            </View>
            <View style={styles.actionButtonContainer}>
                <Button
                  title={business.businessType === 'shelter' ? 'Agregar mascota' : 'Agregar servicio'}
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
              <Package size={24} color={colors.success} />
              <Text style={styles.featureTitle}>Gestión de productos</Text>
            </View>
            <Text style={styles.featureDescription}>
              Administrá tu inventario, precios y categorías de productos
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
                  title="Gestionar productos"
                  onPress={handleConfigureProducts}
                  variant="outline"
                  size="medium"
                />
              </View>
              <View style={styles.actionButtonContainer}>
                <Button
                  title="Agregar producto"
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
              <Package size={24} color={colors.warning} />
              <Text style={styles.featureTitle}>Gestión de pedidos</Text>
            </View>
            <Text style={styles.featureDescription}>
              Administrá los pedidos de tus clientes
            </Text>

            <View style={styles.featureActions}>
              <View style={styles.actionButtonContainer}>
                <Button
                  title="Ver pedidos"
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
              <Heart size={24} color={colors.danger} />
              <Text style={styles.featureTitle}>Gestión de adopciones</Text>
            </View>
            <Text style={styles.featureDescription}>
              Administrá las mascotas disponibles para adopción
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
                  title={adoptionPlanAllowed ? 'Ver adopciones' : 'Plan Pro requerido'}
                  onPress={handleConfigureAdoptions}
                  variant="outline"
                  size="medium"
                  disabled={!adoptionPlanAllowed}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Agregar mascota"
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
            <Settings size={24} color={colors.textTertiary} />
            <Text style={styles.generalTitle}>Configuración General</Text>
          </View>

          <TouchableOpacity style={styles.configOption}>
            <Users size={20} color={colors.textTertiary} />
            <Text style={styles.configOptionText}>Gestionar Equipo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.configOption}>
            <Clock size={20} color={colors.textTertiary} />
            <Text style={styles.configOptionText}>Horarios de Atención</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.configOption}>
            <Settings size={20} color={colors.textTertiary} />
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
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 6,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  businessCard: {
    marginBottom: spacing.lg,
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  businessType: {
    ...typography.label,
    color: colors.primary,
  },
  planBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  planBadgeText: {
    ...typography.captionStrong,
  },
  featureCard: {
    marginBottom: spacing.lg,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  featureTitle: {
    ...typography.heading,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  featureDescription: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  lockedNotice: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  lockedNoticeTitle: {
    ...typography.label,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  lockedNoticeText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  servicesList: {
    marginBottom: spacing.lg,
  },
  servicesTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  serviceItem: {
    paddingVertical: spacing.xxs,
  },
  serviceText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  featureActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  actionButtonContainer: {
    flex: 1,
    minWidth: '45%',
    marginTop: spacing.sm,
  },
  generalCard: {
    marginBottom: spacing.lg,
  },
  generalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  generalTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  configOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  configOptionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  // Estilos para los botones
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
});
