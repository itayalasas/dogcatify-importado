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
      case 'low': return '#2D6A6F';
      default: return '#6B7280';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return { text: 'URGENTE', color: '#DC2626' };
      case 'high': return { text: 'ALTA', color: '#EF4444' };
      case 'medium': return { text: 'MEDIA', color: '#F59E0B' };
      case 'low': return { text: 'BAJA', color: '#2D6A6F' };
      default: return { text: 'NORMAL', color: '#6B7280' };
    }
  };

  const formatAlertDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alertDate = new Date(date);
    alertDate.setHours(0, 0, 0, 0);
    const diffTime = alertDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Vencida', color: '#DC2626', icon: '⚠️' };
    if (diffDays === 0) return { text: 'Hoy', color: '#F59E0B', icon: '📅' };
    if (diffDays === 1) return { text: 'Mañana', color: '#F59E0B', icon: '📅' };
    if (diffDays <= 7) return { text: `En ${diffDays} días`, color: '#2D6A6F', icon: '📅' };

    const formatted = date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
    return { text: formatted, color: '#6B7280', icon: '📅' };
  };

  if (loading || alerts.length === 0) return null;

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Heart size={24} color="#2D6A6F" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Alertas Médicas</Text>
          <Text style={styles.subtitle}>Cuidados próximos para tus mascotas</Text>
        </View>
      </View>

      {alerts.map((alert) => {
        const dateInfo = formatAlertDate(alert.due_date);
        const priorityBadge = getPriorityBadge(alert.priority);

        return (
          <View key={alert.id} style={[
            styles.alertItem,
            { borderLeftColor: getPriorityColor(alert.priority) }
          ]}>
            <View style={styles.alertHeader}>
              <View style={styles.alertInfo}>
                {getAlertIcon(alert.alert_type)}
                <View style={styles.alertText}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertPet}>{alert.pet_name}</Text>
                </View>
              </View>

              <View style={styles.alertActions}>
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => handleCompleteAlert(alert.id)}
                >
                  <CheckCircle size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => handleDismissAlert(alert.id)}
                >
                  <X size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.alertDescription}>{alert.description}</Text>

            <View style={styles.alertFooter}>
              <View style={[styles.dateChip, { backgroundColor: dateInfo.color + '15' }]}>
                <Text style={styles.dateIcon}>{dateInfo.icon}</Text>
                <Text style={[styles.dateText, { color: dateInfo.color }]}>
                  {dateInfo.text}
                </Text>
              </View>

              <View style={[styles.priorityBadge, { backgroundColor: priorityBadge.color + '15' }]}>
                <Text style={[styles.priorityText, { color: priorityBadge.color }]}>
                  {priorityBadge.text}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    backgroundColor: '#F0FDFA',
    borderWidth: 2,
    borderColor: '#2D6A6F',
    shadowColor: '#2D6A6F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F766E',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#14B8A6',
  },
  alertItem: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  alertInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  alertText: {
    marginLeft: 10,
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 20,
  },
  alertPet: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 6,
  },
  completeButton: {
    backgroundColor: '#2D6A6F',
    borderRadius: 16,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D6A6F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  dismissButton: {
    backgroundColor: '#94A3B8',
    borderRadius: 16,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  alertDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  dateIcon: {
    fontSize: 14,
  },
  dateText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
  },
});