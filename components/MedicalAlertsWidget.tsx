import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Calendar, Syringe, Pill, Heart, CircleCheck as CheckCircle, X } from 'lucide-react-native';
import { Card } from './ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabaseClient } from '../lib/supabase';

interface MedicalAlert {
  id: string;
  pet_id: string;
  alert_type: string;
  title: string;
  description: string;
  due_date: string;
  priority: string;
  status: string;
  pet_name?: string;
}

export const MedicalAlertsWidget: React.FC = () => {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState<MedicalAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchAlerts();
    }
  }, [currentUser]);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('medical_alerts')
        .select(`
          *,
          pets!inner(name)
        `)
        .eq('user_id', currentUser!.id)
        .eq('status', 'pending')
        .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Next 7 days
        .order('due_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      const alertsWithPetNames = data?.map(alert => ({
        ...alert,
        pet_name: alert.pets?.name || 'Mascota'
      })) || [];

      setAlerts(alertsWithPetNames);
    } catch (error) {
      console.error('Error fetching medical alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabaseClient
        .from('medical_alerts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
      
      fetchAlerts(); // Refresh alerts
    } catch (error) {
      console.error('Error completing alert:', error);
      Alert.alert('Error', 'No se pudo marcar como completada');
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabaseClient
        .from('medical_alerts')
        .update({
          status: 'dismissed',
          completed_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
      
      fetchAlerts(); // Refresh alerts
    } catch (error) {
      console.error('Error dismissing alert:', error);
      Alert.alert('Error', 'No se pudo descartar la alerta');
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'vaccine': return <Syringe size={16} color="#3B82F6" />;
      case 'deworming': return <Pill size={16} color="#10B981" />;
      case 'checkup': return <Heart size={16} color="#EF4444" />;
      default: return <Calendar size={16} color="#6B7280" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#DC2626';
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const formatAlertDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return '🔴 Vencida';
    if (diffDays === 0) return '🟡 Hoy';
    if (diffDays === 1) return '🟠 Mañana';
    if (diffDays <= 7) return `🟢 En ${diffDays} días`;
    return date.toLocaleDateString();
  };

  if (loading || alerts.length === 0) return null;

  return (
    <Card style={styles.container}>
      <Text style={styles.title}>🚨 Alertas Médicas</Text>
      <Text style={styles.subtitle}>Próximos cuidados para tus mascotas</Text>
      
      {alerts.map((alert) => (
        <View key={alert.id} style={[
          styles.alertItem,
          { borderLeftColor: getPriorityColor(alert.priority) }
        ]}>
          <View style={styles.alertHeader}>
            <View style={styles.alertInfo}>
              {getAlertIcon(alert.alert_type)}
              <View style={styles.alertText}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertPet}>Para: {alert.pet_name}</Text>
              </View>
            </View>
            
            <View style={styles.alertActions}>
              <TouchableOpacity 
                style={styles.completeButton}
                onPress={() => handleCompleteAlert(alert.id)}
              >
                <CheckCircle size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.dismissButton}
                onPress={() => handleDismissAlert(alert.id)}
              >
                <X size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.alertDescription}>{alert.description}</Text>
          <Text style={styles.alertDate}>{formatAlertDate(alert.due_date)}</Text>
        </View>
      ))}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#92400E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    marginBottom: 16,
  },
  alertItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertText: {
    marginLeft: 8,
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  alertPet: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  completeButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    backgroundColor: '#6B7280',
    borderRadius: 12,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 8,
    lineHeight: 18,
  },
  alertDate: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
  },
});