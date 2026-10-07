import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, Image, Switch, RefreshControl } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Clock, DollarSign, X, Edit, Package, Trash2 } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { IconButton } from '../../components/ui/IconButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { colors, radius, spacing, typography } from '../../constants/theme';

interface Activity {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  price: number;
  isActive: boolean;
  category?: string;
  images?: string[];
  stock?: number; // Para productos
  brand?: string; // Para productos
  weight?: string; // Presentación (ej: 2kg)
  variantGroupId?: string | null; // Presentaciones del mismo producto
}

export default function ConfigureActivities() {
  const { partnerId, businessType } = useLocalSearchParams<{ partnerId: string; businessType: string }>();
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Form state
  const [activityName, setActivityName] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityDuration, setActivityDuration] = useState('');
  const [activityPrice, setActivityPrice] = useState('');

  useEffect(() => {
    if (!partnerId) return;
    
    // Fetch partner profile using Supabase
    const fetchPartnerProfile = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('id', partnerId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setPartnerProfile({
            id: data.id,
            businessName: data.business_name,
            businessType: data.business_type,
            ...data
          });
        }
        
        fetchActivities();
      } catch (error) {
        console.error('Error fetching partner profile:', error);
      }
    };
    
    fetchPartnerProfile();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('partner-profile-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'partners',
          filter: `id=eq.${partnerId}`
        }, 
        () => {
          fetchPartnerProfile();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [partnerId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchActivities();
    } finally {
      setRefreshing(false);
    }
  };

  const fetchActivities = async () => {
    try {
      console.log('Fetching activities for partner:', partnerId);
      console.log('Business type:', businessType);

      // Para tiendas, buscar en partner_products; para otros, en partner_services
      const tableName = businessType === 'shop' ? 'partner_products' : 'partner_services';

      const { data, error } = await supabaseClient
        .from(tableName)
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Activities/Products fetched:', data?.length || 0);

      // Mapear datos según el tipo de tabla
      const activitiesData = data.map(item => {
        if (businessType === 'shop') {
          // Mapeo para productos
          return {
            id: item.id,
            name: item.name,
            description: item.description || '',
            duration: 0, // Los productos no tienen duración
            price: item.price || 0,
            isActive: item.is_active,
            category: item.category || '',
            images: item.images || [],
            stock: item.stock || 0, // Agregar stock para productos
            brand: item.brand || '',
            weight: item.weight || '',
            variantGroupId: item.variant_group_id || null,
          };
        } else {
          // Mapeo para servicios
          return {
            id: item.id,
            name: item.name,
            description: item.description || '',
            duration: item.duration || 0,
            price: item.price || 0,
            isActive: item.is_active,
            category: item.category || '',
            images: item.images || []
          };
        }
      }) as Activity[];

      setActivities(activitiesData);
      console.log('Activities/Products state updated with:', activitiesData.length, 'items');
    } catch (error) {
      console.error('Error fetching activities:', error);
    }

  };

  // Re-read the list every time this screen regains focus (e.g. coming back
  // from adding/editing a product), and keep it live while it is open. The
  // subscription used to be created inside fetchActivities itself, so it was
  // never cleaned up and a new channel piled up on every refresh.
  useFocusEffect(
    useCallback(() => {
      if (partnerId) {
        fetchActivities();
      }
    }, [partnerId, businessType]),
  );

  useEffect(() => {
    if (!partnerId) return;

    const tableName = businessType === 'shop' ? 'partner_products' : 'partner_services';
    const subscription = supabaseClient
      .channel(`activities-changes-${partnerId}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `partner_id=eq.${partnerId}`
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [partnerId, businessType]);

  const getBusinessTypeConfig = (type: string) => {
    switch (type) {
      case 'veterinary':
        return {
          title: 'Servicios Veterinarios',
          suggestions: [
            { name: 'Consulta General', duration: 30, price: 5000 },
            { name: 'Vacunación', duration: 15, price: 3000 },
            { name: 'Cirugía Menor', duration: 60, price: 15000 },
            { name: 'Emergencia', duration: 45, price: 8000 },
            { name: 'Control de Salud', duration: 20, price: 4000 },
          ]
        };
      case 'grooming':
        return {
          title: 'Servicios de Peluquería',
          suggestions: [
            { name: 'Baño Completo', duration: 45, price: 4000 },
            { name: 'Corte de Pelo', duration: 60, price: 6000 },
            { name: 'Corte de Uñas', duration: 15, price: 1500 },
            { name: 'Limpieza de Oídos', duration: 10, price: 1000 },
            { name: 'Desenredado', duration: 30, price: 3000 },
          ]
        };
      case 'walking':
        return {
          title: 'Servicios de Paseo',
          suggestions: [
            { name: 'Paseo Corto (30min)', duration: 30, price: 2000 },
            { name: 'Paseo Largo (60min)', duration: 60, price: 3500 },
            { name: 'Ejercicio en Parque', duration: 45, price: 3000 },
            { name: 'Cuidado por Horas', duration: 120, price: 6000 },
            { name: 'Socialización', duration: 90, price: 4500 },
          ]
        };
      case 'boarding':
        return {
          title: 'Servicios de Pensión',
          suggestions: [
            { name: 'Hospedaje Diario', duration: 1440, price: 8000 }, // 24 hours
            { name: 'Hospedaje Nocturno', duration: 720, price: 5000 }, // 12 hours
            { name: 'Fin de Semana', duration: 2880, price: 15000 }, // 48 hours
            { name: 'Hospedaje Semanal', duration: 10080, price: 50000 }, // 7 days
          ]
        };
      default:
        return {
          title: 'Actividades del Negocio',
          suggestions: []
        };
    }
  };

  const handleAddActivity = async () => {
    if (partnerProfile && partnerProfile.id) {
      // Si es un refugio, redirigir al formulario de adopción
      if (partnerProfile.businessType === 'shelter') {
        console.log('Redirecting to adoption form for shelter');
        router.push({
          pathname: '/partner/add-adoption-pet',
          params: {
            partnerId: partnerProfile.id
          }
        });
      } else {
        // Para otros tipos de negocio, usar el formulario normal
        console.log('Redirecting to service form for business type:', partnerProfile.businessType);
        router.push({
          pathname: '/partner/add-service',
          params: {
            partnerId: partnerProfile.id,
            businessType: partnerProfile.businessType
          }
        });
      }
    } else {
      Alert.alert('Error', 'No se pudo obtener la información del negocio');
    }
  };

  const handleToggleActivity = async (activityId: string, isActive: boolean) => {
    try {
      const tableName = businessType === 'shop' ? 'partner_products' : 'partner_services';
      const updatePayload: Record<string, any> = {
        is_active: !isActive,
      };

      if (tableName === 'partner_products') {
        updatePayload.updated_at = new Date().toISOString();
      }

      const { error } = await supabaseClient
        .from(tableName)
        .update(updatePayload)
        .eq('id', activityId);

      if (error) throw error;
      await fetchActivities();
    } catch (error) {
      console.error('Error toggling activity:', error);
      Alert.alert('Error', `No se pudo actualizar ${businessType === 'shop' ? 'el producto' : isShelterBusiness ? 'la mascota' : 'el servicio'}`);
    }
  };

  const handleEditActivity = (activityId: string) => {
    if (businessType === 'shop') {
      router.push({
        pathname: '/partner/edit-product',
        params: {
          productId: activityId
        }
      });
    } else {
      router.push({
        pathname: '/partner/edit-service',
        params: {
          serviceId: activityId,
          partnerId: partnerId || '',
          businessType: businessType || ''
        }
      });
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    const isProduct = businessType === 'shop';
    Alert.alert(
      `Eliminar ${entityLabelCapitalized}`,
      `¿Seguro que querés eliminar ${isProduct ? 'este producto' : isShelterBusiness ? 'esta mascota' : 'este servicio'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const tableName = businessType === 'shop' ? 'partner_products' : 'partner_services';
              const { error } = await supabaseClient
                .from(tableName)
                .delete()
                .eq('id', activityId);

              if (error) throw error;

              await fetchActivities();
              toast.success(`${entityLabelCapitalized} eliminado`);
            } catch (error) {
              console.error('Error deleting activity:', error);
              Alert.alert('Error', `No se pudo eliminar ${isProduct ? 'el producto' : isShelterBusiness ? 'la mascota' : 'el servicio'}`);
            }
          }
        }
      ]
    );
  };

  const handleUseSuggestion = (suggestion: any) => {
    setActivityName(suggestion.name);
    const suggestionPrefix = businessType === 'shop'
      ? 'Producto'
      : businessType === 'shelter'
        ? 'Mascota en adopción'
        : 'Servicio';
    setActivityDescription(`${suggestionPrefix} de ${suggestion.name.toLowerCase()}`);
    setActivityDuration(suggestion.duration.toString());
    setActivityPrice(suggestion.price.toString());
  };

  const config = getBusinessTypeConfig(businessType || '');
  const isShopBusiness = businessType === 'shop';
  const isShelterBusiness = businessType === 'shelter';
  const isServiceBusiness = !isShopBusiness && !isShelterBusiness;
  const screenTitle = isShopBusiness
    ? 'Productos'
    : isShelterBusiness
      ? 'Adopciones'
      : businessType === 'veterinary'
        ? 'Servicios veterinarios'
        : businessType === 'grooming'
          ? 'Servicios de peluquería'
          : businessType === 'walking'
            ? 'Servicios de paseo'
            : businessType === 'boarding'
              ? 'Servicios de pensión'
              : 'Servicios';
  const infoTitle = isShopBusiness
    ? 'Productos de la tienda'
    : isShelterBusiness
      ? 'Mascotas en adopción'
      : config.title;
  const infoDescription = isShopBusiness
    ? 'Administrá los productos de tu tienda para que los clientes puedan comprar'
    : isShelterBusiness
      ? 'Publicá las mascotas disponibles para adopción y administrá sus fichas'
      : businessType === 'boarding'
        ? 'Gestioná reservas, estadías y cupos de hospedaje'
        : isServiceBusiness
          ? 'Definí los servicios que ofrecés para que los clientes puedan hacer reservas'
          : 'Definí las actividades que ofrecés para que los clientes puedan hacer reservas';
  const emptyTitle = isShopBusiness
    ? 'No hay productos configurados'
    : isShelterBusiness
      ? 'No hay mascotas en adopción'
      : 'No hay servicios configurados';
  const emptySubtitle = isShopBusiness
    ? 'Agregá tu primer producto para comenzar a vender'
    : isShelterBusiness
      ? 'Agregá tu primera mascota para comenzar a recibir consultas'
      : 'Agregá tu primer servicio para comenzar a recibir reservas';
  const addButtonTitle = isShopBusiness
    ? 'Agregar producto'
    : isShelterBusiness
      ? 'Agregar mascota'
      : 'Agregar servicio';
  const nameLabel = isShopBusiness
    ? 'Nombre del producto *'
    : isShelterBusiness
      ? 'Nombre de la mascota *'
      : 'Nombre del servicio *';
  const namePlaceholder = isShopBusiness
    ? 'Ej: Alimento premium para perros'
    : isShelterBusiness
      ? 'Ej: Luna'
      : 'Ej: Consulta general, Baño completo...';
  const descriptionLabel = isShopBusiness
    ? 'Descripción del producto *'
    : isShelterBusiness
      ? 'Descripción de la mascota *'
      : 'Descripción del servicio *';
  const descriptionPlaceholder = isShopBusiness
    ? 'Describí características, presentaciones y beneficios...'
    : isShelterBusiness
      ? 'Describí su personalidad, cuidados y requisitos...'
      : 'Describí brevemente el servicio...';
  const entityLabel = isShopBusiness
    ? 'producto'
    : isShelterBusiness
      ? 'mascota'
      : 'servicio';
  const entityLabelCapitalized = isShopBusiness
    ? 'Producto'
    : isShelterBusiness
      ? 'Mascota'
      : 'Servicio';

  // Presentations of one product (same variant_group_id) are shown together
  // in a single card, cheapest first.
  const productGroups: Activity[][] = (() => {
    if (!isShopBusiness) return [];

    const groups = new Map<string, Activity[]>();
    activities.forEach((item) => {
      const key = item.variantGroupId || item.id;
      groups.set(key, [...(groups.get(key) || []), item]);
    });

    return Array.from(groups.values()).map((group) => [...group].sort((a, b) => a.price - b.price));
  })();

  const renderProductGroup = (group: Activity[]) => {
    const first = group[0];
    const anyActive = group.some((item) => item.isActive);
    const metaLine = [first.brand, first.category, group.length > 1 ? `${group.length} presentaciones` : '']
      .filter(Boolean)
      .join(' · ');

    return (
      <Card key={first.variantGroupId || first.id} style={styles.productGroupCard}>
        <View style={styles.productGroupTop}>
          {first.images && first.images.length > 0 ? (
            <Image source={{ uri: first.images[0] }} style={styles.productThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.productThumb, styles.productThumbPlaceholder]}>
              <Package size={24} color={colors.textTertiary} />
            </View>
          )}

          <View style={styles.productGroupInfo}>
            <Text style={styles.productGroupName} numberOfLines={2}>{first.name}</Text>
            {!!metaLine && <Text style={styles.productGroupMeta} numberOfLines={1}>{metaLine}</Text>}
            {!!first.description && (
              <Text style={styles.productGroupDescription} numberOfLines={2}>{first.description}</Text>
            )}
          </View>

          <View style={[styles.activityStatus, { backgroundColor: anyActive ? colors.successSoft : colors.dangerSoft }]}>
            <Text style={[styles.activityStatusText, { color: anyActive ? colors.success : colors.danger }]}>
              {anyActive ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </View>

        <View style={styles.presentationList}>
          {group.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.presentationRow,
                index > 0 && styles.presentationRowBorder,
                !item.isActive && styles.presentationRowInactive,
              ]}
            >
              <View style={styles.presentationMain}>
                <Text style={styles.presentationWeight}>
                  {item.weight || (group.length > 1 ? 'Estándar' : 'Presentación única')}
                </Text>
                <Text style={styles.presentationMeta}>
                  ${item.price.toLocaleString('es-UY')} · Stock {item.stock || 0}
                </Text>
              </View>

              <Switch
                value={item.isActive}
                onValueChange={() => handleToggleActivity(item.id, item.isActive)}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.white}
                accessibilityLabel={`${item.weight || first.name} visible para clientes`}
              />
              <TouchableOpacity
                style={styles.presentationIconButton}
                onPress={() => handleEditActivity(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${item.weight || first.name}`}
              >
                <Edit size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presentationIconButton}
                onPress={() => handleDeleteActivity(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar ${item.weight || first.name}`}
              >
                <Trash2 size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={screenTitle}
        subtitle={partnerProfile?.businessName}
        right={
          <IconButton
            icon={<Plus size={22} color={colors.onPrimary} />}
            onPress={handleAddActivity}
            accessibilityLabel={addButtonTitle}
            variant="filled"
          />
        }
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>{infoTitle}</Text>
          <Text style={styles.infoDescription}>{infoDescription}</Text>
        </Card>

        {activities.length === 0 ? (
          <EmptyState
            icon={<Package size={32} color={colors.primary} />}
            title={emptyTitle}
            description={emptySubtitle}
            actionLabel={addButtonTitle}
            onAction={handleAddActivity}
          />
        ) : (
          <View style={styles.activitiesList}>
            {isShopBusiness ? productGroups.map((group) => renderProductGroup(group)) : activities.map((activity) => (
              <Card key={activity.id} style={styles.activityCard}>
                {/* Service Image Background */}
                {activity.images && activity.images.length > 0 && (
                  <View style={styles.activityImageContainer}>
                    <Image 
                      source={{ uri: activity.images[0] }} 
                      style={styles.activityImage}
                      resizeMode="cover"
                    />
                    <View style={styles.activityImageOverlay} />
                  </View>
                )}
                
                <View style={styles.activityHeader}>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>{activity.name}</Text>
                    {activity.description && (
                      <Text style={styles.activityDescription}>{activity.description}</Text>
                    )}
                  </View>
                  <View style={styles.activityToggle}>
                    <Text style={[styles.activityStatusText, { color: activity.isActive ? colors.success : colors.textTertiary }]}>
                      {activity.isActive ? 'Activa' : 'Inactiva'}
                    </Text>
                    <Switch
                      value={activity.isActive}
                      onValueChange={() => handleToggleActivity(activity.id, activity.isActive)}
                      trackColor={{ false: colors.borderStrong, true: colors.primary }}
                      thumbColor={colors.white}
                      accessibilityLabel={`${activity.name} visible para clientes`}
                    />
                  </View>
                </View>

                {/* Mostrar duración y precio para servicios, stock y precio para productos */}
                {businessType === 'shop' ? (
                  <View style={styles.activityDetails}>
                    <View style={styles.activityDetail}>
                      <Package size={16} color={colors.textTertiary} />
                      <Text style={styles.activityDetailText}>
                        Stock: {activity.stock || 0}
                      </Text>
                    </View>
                    <View style={styles.activityDetail}>
                      <DollarSign size={16} color={colors.success} />
                      <Text style={styles.activityDetailText}>
                        ${activity.price.toLocaleString('es-UY')}
                      </Text>
                    </View>
                  </View>
                ) : businessType !== 'boarding' && (
                  <View style={styles.activityDetails}>
                    <View style={styles.activityDetail}>
                      <Clock size={16} color={colors.textTertiary} />
                      <Text style={styles.activityDetailText}>
                        {activity.duration} min
                      </Text>
                    </View>
                    <View style={styles.activityDetail}>
                      <DollarSign size={16} color={colors.success} />
                      <Text style={styles.activityDetailText}>
                        ${activity.price.toLocaleString('es-UY')}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Mostrar info de capacidad para Pensión */}
                {businessType === 'boarding' && activity.category === 'Pensión' && (
                  <View style={styles.boardingInfo}>
                    <Text style={styles.boardingInfoText}>🏠 Hotel para mascotas</Text>
                    <Text style={styles.boardingInfoSubtext}>Capacidad configurada por categoría</Text>
                  </View>
                )}

                <View style={styles.activityActions}>
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditActivity(activity.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${activity.name}`}
                    >
                      <Edit size={16} color={colors.primary} />
                      <Text style={styles.editButtonText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteActivity(activity.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Eliminar ${activity.name}`}
                    >
                      <Trash2 size={16} color={colors.danger} />
                      <Text style={styles.deleteButtonText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Activity Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{addButtonTitle}</Text>
              <IconButton
                icon={<X size={24} color={colors.textSecondary} />}
                onPress={() => setShowAddModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              {config.suggestions && config.suggestions.length > 0 && (
                <View style={styles.suggestionsSection}>
                  <Text style={styles.suggestionsTitle}>Sugerencias</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {config.suggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionCard}
                        onPress={() => handleUseSuggestion(suggestion)}
                      >
                        <Text style={styles.suggestionName}>{suggestion.name}</Text>
                        <Text style={styles.suggestionDetails}>
                          {suggestion.duration}min • ${suggestion.price.toLocaleString('es-UY')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Input
                label={nameLabel}
                placeholder={namePlaceholder}
                value={activityName}
                onChangeText={setActivityName}
              />

              <Input
                label={descriptionLabel}
                placeholder={descriptionPlaceholder}
                value={activityDescription}
                onChangeText={setActivityDescription}
                multiline
                numberOfLines={2}
              />

              <Input
                label="Duración (minutos) *"
                placeholder="30"
                value={activityDuration}
                onChangeText={setActivityDuration}
                keyboardType="numeric"
                leftIcon={<Clock size={20} color={colors.textTertiary} />}
              />

              <Input
                label="Precio *"
                placeholder="5000"
                value={activityPrice}
                onChangeText={setActivityPrice}
                keyboardType="numeric"
                leftIcon={<DollarSign size={20} color={colors.textTertiary} />}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={() => setShowAddModal(false)}
                variant="outline"
                size="medium"
              />
              <Button
                title={addButtonTitle}
                onPress={handleAddActivity}
                loading={loading}
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  productGroupCard: {
    marginBottom: spacing.md,
    padding: 14,
  },
  productGroupTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  productThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  productThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productGroupInfo: {
    flex: 1,
  },
  productGroupName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  productGroupMeta: {
    ...typography.captionStrong,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  productGroupDescription: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  presentationList: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presentationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    gap: 6,
  },
  presentationRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  presentationRowInactive: {
    opacity: 0.6,
  },
  presentationMain: {
    flex: 1,
  },
  presentationWeight: {
    ...typography.label,
    color: colors.text,
  },
  presentationMeta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  presentationIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginRight: spacing.md,
  },
  logoPlaceholderText: {
    ...typography.title,
  },
  businessName: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.success,
    padding: spacing.sm,
    borderRadius: radius.xl,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  infoCard: {
    marginBottom: spacing.lg,
  },
  infoTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  infoDescription: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  activitiesList: {
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  activityCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  activityImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  activityImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  activityImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    zIndex: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    position: 'relative',
    zIndex: 3,
  },
  activityInfo: {
    flex: 1,
    marginRight: spacing.md,
    position: 'relative',
    zIndex: 3,
  },
  activityName: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  activityDescription: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  activityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    position: 'relative',
    zIndex: 3,
  },
  activityStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    position: 'relative',
    zIndex: 3,
  },
  activityStatusText: {
    ...typography.captionStrong,
  },
  activityDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
    position: 'relative',
    zIndex: 3,
  },
  activityDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDetailText: {
    ...typography.label,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  activityActions: {
    flexDirection: 'column',
    gap: spacing.sm,
    marginTop: spacing.sm,
    position: 'relative',
    zIndex: 3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  editButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  editButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  deleteButtonText: {
    ...typography.label,
    color: colors.danger,
  },
  deleteButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  boardingInfo: {
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  boardingInfoText: {
    ...typography.label,
    color: colors.success,
    marginBottom: spacing.xxs,
  },
  boardingInfoSubtext: {
    ...typography.caption,
    color: colors.success,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.heading,
    color: colors.text,
  },
  modalForm: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  suggestionsSection: {
    marginVertical: spacing.lg,
  },
  suggestionsTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  suggestionCard: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
    minWidth: 120,
  },
  suggestionName: {
    ...typography.captionStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  suggestionDetails: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
});
