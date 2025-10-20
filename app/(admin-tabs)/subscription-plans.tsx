import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput } from 'react-native';
import { ArrowLeft, Crown, Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react-native';
import { router } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export default function SubscriptionPlans() {
  const { currentUser } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    currency: 'USD',
    features: '',
    is_active: true,
  });

  const isAdmin = currentUser?.email === 'admin@dogcatify.com';

  useEffect(() => {
    if (isAdmin) {
      loadPlans();
    }
  }, [isAdmin]);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Error', 'No se pudieron cargar los planes');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price_monthly: plan.price_monthly.toString(),
      price_yearly: plan.price_yearly.toString(),
      currency: plan.currency,
      features: plan.features.join('\n'),
      is_active: plan.is_active,
    });
    setShowEditModal(true);
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;

    try {
      // Validar datos
      if (!formData.name || !formData.price_monthly || !formData.price_yearly) {
        Alert.alert('Error', 'Por favor completa todos los campos requeridos');
        return;
      }

      const featuresArray = formData.features
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      const { error } = await supabaseClient
        .from('subscription_plans')
        .update({
          name: formData.name,
          description: formData.description,
          price_monthly: parseFloat(formData.price_monthly),
          price_yearly: parseFloat(formData.price_yearly),
          currency: formData.currency,
          features: featuresArray,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingPlan.id);

      if (error) throw error;

      Alert.alert('Éxito', 'Plan actualizado correctamente');
      setShowEditModal(false);
      loadPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      Alert.alert('Error', 'No se pudo guardar el plan');
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      const { error } = await supabaseClient
        .from('subscription_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id);

      if (error) throw error;

      Alert.alert('Éxito', `Plan ${!plan.is_active ? 'activado' : 'desactivado'} correctamente`);
      loadPlans();
    } catch (error) {
      console.error('Error toggling plan:', error);
      Alert.alert('Error', 'No se pudo actualizar el plan');
    }
  };

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Gestionar Planes</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Información</Text>
          <Text style={styles.infoText}>
            Aquí puedes editar los planes de suscripción que verán los usuarios.{'\n\n'}
            • Edita precios, descripción y características{'\n'}
            • Activa/desactiva planes según necesites{'\n'}
            • Los usuarios solo verán planes activos{'\n'}
            • Los cambios se reflejan inmediatamente
          </Text>
        </View>

        {plans.map((plan, index) => (
          <Card key={plan.id} style={[styles.planCard, !plan.is_active && styles.inactivePlanCard]}>
            <View style={styles.planHeader}>
              <View style={styles.planTitleContainer}>
                <Crown
                  size={24}
                  color={plan.is_active ? '#F59E0B' : '#9CA3AF'}
                />
                <View style={styles.planInfo}>
                  <Text style={[styles.planName, !plan.is_active && styles.inactiveText]}>
                    {plan.name}
                  </Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                </View>
              </View>

              <View style={styles.statusBadge}>
                {plan.is_active ? (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Activo</Text>
                  </View>
                ) : (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>Inactivo</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.priceSection}>
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Mensual</Text>
                <Text style={styles.priceValue}>${plan.price_monthly} {plan.currency}</Text>
              </View>
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Anual</Text>
                <Text style={styles.priceValue}>${plan.price_yearly} {plan.currency}</Text>
              </View>
            </View>

            <View style={styles.featuresSection}>
              <Text style={styles.featuresTitle}>Características:</Text>
              {plan.features.map((feature, idx) => (
                <Text key={idx} style={styles.featureText}>
                  • {feature}
                </Text>
              ))}
            </View>

            <View style={styles.actionsContainer}>
              <Button
                title="Editar Plan"
                onPress={() => handleEditPlan(plan)}
                variant="outline"
                size="small"
                style={styles.actionButton}
              />
              <Button
                title={plan.is_active ? 'Desactivar' : 'Activar'}
                onPress={() => handleToggleActive(plan)}
                variant={plan.is_active ? 'outline' : 'primary'}
                size="small"
                style={styles.actionButton}
              />
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Edit Plan Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Editar Plan: {editingPlan?.name}</Text>

              <Input
                label="Nombre del Plan"
                value={formData.name}
                onChangeText={(value) => setFormData({ ...formData, name: value })}
                placeholder="Ej: Premium"
              />

              <Input
                label="Descripción"
                value={formData.description}
                onChangeText={(value) => setFormData({ ...formData, description: value })}
                placeholder="Descripción del plan"
                multiline
                numberOfLines={2}
              />

              <Input
                label="Precio Mensual (USD)"
                value={formData.price_monthly}
                onChangeText={(value) => setFormData({ ...formData, price_monthly: value })}
                placeholder="9.99"
                keyboardType="decimal-pad"
              />

              <Input
                label="Precio Anual (USD)"
                value={formData.price_yearly}
                onChangeText={(value) => setFormData({ ...formData, price_yearly: value })}
                placeholder="99.99"
                keyboardType="decimal-pad"
              />

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Características (una por línea)</Text>
                <TextInput
                  style={styles.featuresInput}
                  value={formData.features}
                  onChangeText={(value) => setFormData({ ...formData, features: value })}
                  placeholder="Escribe cada característica en una línea nueva"
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancelar"
                  onPress={() => setShowEditModal(false)}
                  variant="outline"
                  size="medium"
                  style={styles.modalButton}
                />
                <Button
                  title="Guardar Cambios"
                  onPress={handleSavePlan}
                  variant="primary"
                  size="medium"
                  style={styles.modalButton}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 20,
  },
  planCard: {
    marginBottom: 16,
    padding: 16,
  },
  inactivePlanCard: {
    opacity: 0.6,
    backgroundColor: '#F3F4F6',
  },
  planHeader: {
    marginBottom: 16,
  },
  planTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  planInfo: {
    marginLeft: 12,
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  inactiveText: {
    color: '#6B7280',
  },
  planDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  statusBadge: {
    marginTop: 8,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#065F46',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  inactiveBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#991B1B',
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  priceItem: {
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  featuresSection: {
    marginBottom: 16,
  },
  featuresTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 4,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#DC2626',
    marginBottom: 12,
  },
  accessDeniedText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  featuresInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    minHeight: 160,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
  },
});
