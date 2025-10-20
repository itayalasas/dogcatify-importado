import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Crown, Check, ExternalLink } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function Subscription() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    loadPlans();
    loadUserSubscription();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Error', 'No se pudieron cargar los planes de suscripción');
    } finally {
      setLoading(false);
    }
  };

  const loadUserSubscription = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            name,
            description,
            features
          )
        `)
        .eq('user_id', currentUser.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUserSubscription(data);
      }
    } catch (error) {
      console.error('Error loading user subscription:', error);
    }
  };

  const handleSelectPlan = (plan: any) => {
    Alert.alert(
      'Gestión de Suscripción',
      `Para suscribirte al plan ${plan.name}, serás redirigido a nuestro sistema de gestión. ¿Deseas continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => {
            // Aquí se integraría con el CRM para gestionar la suscripción
            Alert.alert(
              'Próximamente',
              'La integración con el CRM estará disponible próximamente. Por ahora, contacta al administrador para gestionar tu suscripción.'
            );
          }
        }
      ]
    );
  };

  const formatPrice = (price: number, currency: string) => {
    const currencySymbol = currency === 'USD' ? '$' : currency;
    return `${currencySymbol}${price.toFixed(2)}`;
  };

  const getYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
    const monthlyCost = monthlyPrice * 12;
    const savings = monthlyCost - yearlyPrice;
    const percentage = (savings / monthlyCost) * 100;
    return `Ahorra ${percentage.toFixed(0)}%`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Cargando planes...</Text>
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
        <Text style={styles.title}>Suscripción Premium</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Subscription Status */}
        {userSubscription && (
          <Card style={styles.currentSubscriptionCard}>
            <View style={styles.currentSubscriptionHeader}>
              <Crown size={32} color="#F59E0B" />
              <View style={styles.currentSubscriptionInfo}>
                <Text style={styles.currentSubscriptionTitle}>Suscripción Activa</Text>
                <Text style={styles.currentSubscriptionPlan}>
                  {userSubscription.subscription_plans?.name || 'Premium'}
                </Text>
              </View>
            </View>
            <View style={styles.currentSubscriptionDetails}>
              <Text style={styles.subscriptionDetailText}>
                Estado: <Text style={styles.subscriptionDetailValue}>Activa</Text>
              </Text>
              {userSubscription.expires_at && (
                <Text style={styles.subscriptionDetailText}>
                  Renovación: {' '}
                  <Text style={styles.subscriptionDetailValue}>
                    {new Date(userSubscription.expires_at).toLocaleDateString()}
                  </Text>
                </Text>
              )}
              <Text style={styles.subscriptionDetailText}>
                Ciclo: {' '}
                <Text style={styles.subscriptionDetailValue}>
                  {userSubscription.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'}
                </Text>
              </Text>
            </View>
            <Button
              title="Gestionar Suscripción en CRM"
              onPress={() => Alert.alert('CRM', 'Serás redirigido al CRM para gestionar tu suscripción.')}
              variant="outline"
              size="medium"
              style={styles.manageCrmButton}
            />
          </Card>
        )}

        {/* Billing Cycle Toggle */}
        {!userSubscription && (
          <View style={styles.billingCycleContainer}>
            <TouchableOpacity
              style={[
                styles.billingCycleOption,
                selectedBillingCycle === 'monthly' && styles.billingCycleOptionActive
              ]}
              onPress={() => setSelectedBillingCycle('monthly')}
            >
              <Text
                style={[
                  styles.billingCycleText,
                  selectedBillingCycle === 'monthly' && styles.billingCycleTextActive
                ]}
              >
                Mensual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.billingCycleOption,
                selectedBillingCycle === 'yearly' && styles.billingCycleOptionActive
              ]}
              onPress={() => setSelectedBillingCycle('yearly')}
            >
              <Text
                style={[
                  styles.billingCycleText,
                  selectedBillingCycle === 'yearly' && styles.billingCycleTextActive
                ]}
              >
                Anual
              </Text>
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>-20%</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Subscription Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan, index) => {
            const isCurrentPlan = userSubscription?.plan_id === plan.id;
            const price = selectedBillingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
            const features = plan.features || [];

            return (
              <Card
                key={plan.id}
                style={[
                  styles.planCard,
                  isCurrentPlan && styles.currentPlanCard,
                  index === 1 && styles.recommendedPlan
                ]}
              >
                {index === 1 && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>Recomendado</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                </View>

                <View style={styles.planPricing}>
                  <Text style={styles.planPrice}>
                    {formatPrice(price, plan.currency)}
                  </Text>
                  <Text style={styles.planPricePeriod}>
                    / {selectedBillingCycle === 'monthly' ? 'mes' : 'año'}
                  </Text>
                </View>

                {selectedBillingCycle === 'yearly' && (
                  <Text style={styles.savingsText}>
                    {getYearlySavings(plan.price_monthly, plan.price_yearly)}
                  </Text>
                )}

                <View style={styles.featuresContainer}>
                  {features.map((feature: string, idx: number) => (
                    <View key={idx} style={styles.featureItem}>
                      <Check size={16} color="#10B981" />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                {isCurrentPlan ? (
                  <View style={styles.currentPlanBadge}>
                    <Text style={styles.currentPlanBadgeText}>Plan Actual</Text>
                  </View>
                ) : (
                  <Button
                    title={userSubscription ? 'Cambiar Plan' : 'Seleccionar Plan'}
                    onPress={() => handleSelectPlan(plan)}
                    variant={index === 1 ? 'primary' : 'outline'}
                    size="medium"
                    style={styles.selectPlanButton}
                  />
                )}
              </Card>
            );
          })}
        </View>

        {/* Info Section */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Información Importante</Text>
          <Text style={styles.infoText}>
            • Las suscripciones se gestionan a través de nuestro CRM integrado{'\n'}
            • Los pagos son procesados de forma segura{'\n'}
            • Puedes cancelar tu suscripción en cualquier momento{'\n'}
            • Las características premium se activan inmediatamente{'\n'}
            • Soporte prioritario disponible 24/7 para suscriptores
          </Text>
        </Card>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  currentSubscriptionCard: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  currentSubscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentSubscriptionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  currentSubscriptionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
    marginBottom: 4,
  },
  currentSubscriptionPlan: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#92400E',
  },
  currentSubscriptionDetails: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#FED7AA',
  },
  subscriptionDetailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    marginBottom: 6,
  },
  subscriptionDetailValue: {
    fontFamily: 'Inter-SemiBold',
  },
  manageCrmButton: {
    marginTop: 8,
  },
  billingCycleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  billingCycleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  billingCycleOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  billingCycleText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  billingCycleTextActive: {
    color: '#111827',
    fontFamily: 'Inter-SemiBold',
  },
  savingsBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  savingsBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  plansContainer: {
    marginBottom: 24,
  },
  planCard: {
    marginBottom: 16,
    padding: 20,
    position: 'relative',
  },
  currentPlanCard: {
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  recommendedPlan: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    transform: [{ scale: 1.02 }],
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendedBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  planHeader: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  planPricePeriod: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  savingsText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
    marginBottom: 16,
  },
  featuresContainer: {
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  currentPlanBadge: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  currentPlanBadgeText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  selectPlanButton: {
    marginTop: 8,
  },
  infoCard: {
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 22,
  },
});
