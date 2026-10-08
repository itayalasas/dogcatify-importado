import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Calendar, Syringe, Pill, Heart, CircleCheck as CheckCircle, X } from 'lucide-react-native';
import { Card } from './ui/Card';
import { colors, radius, spacing, typography, touchTarget } from '../constants/theme';
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

interface MedicalAlertsWidgetProps {
  /** Título de la tarjeta (por defecto "Alertas médicas"). */
  title?: string;
  subtitle?: string;
  /** Cambia para volver a leer las alertas (por ejemplo, al tirar para actualizar). */
  refreshKey?: number;
}

export const MedicalAlertsWidget: React.FC<MedicalAlertsWidgetProps> = ({
  title = 'Alertas médicas',
  subtitle = 'Cuidados próximos para tus mascotas',
  refreshKey = 0,
}) => {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState<MedicalAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchAlerts();
    }
  }, [currentUser, refreshKey]);

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
      case 'vaccine': return <Syringe size={16} color={colors.primary} />;
      case 'deworming': return <Pill size={16} color={colors.success} />;
      case 'checkup': return <Heart size={16} color={colors.danger} />;
      default: return <Calendar size={16} color={colors.icon} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return colors.danger;
      case 'high': return colors.danger;
      case 'medium': return colors.warning;
      case 'low': return colors.primary;
      default: return colors.textTertiary;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return { text: 'URGENTE', color: colors.danger };
      case 'high': return { text: 'ALTA', color: colors.danger };
      case 'medium': return { text: 'MEDIA', color: colors.warning };
      case 'low': return { text: 'BAJA', color: colors.primary };
      default: return { text: 'NORMAL', color: colors.textTertiary };
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

    if (diffDays < 0) return { text: 'Vencida', color: colors.danger, icon: '⚠️' };
    if (diffDays === 0) return { text: 'Hoy', color: colors.warning, icon: '📅' };
    if (diffDays === 1) return { text: 'Mañana', color: colors.warning, icon: '📅' };
    if (diffDays <= 7) return { text: `En ${diffDays} días`, color: colors.primary, icon: '📅' };

    const formatted = date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
    return { text: formatted, color: colors.textTertiary, icon: '📅' };
  };

  if (loading || alerts.length === 0) return null;

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Heart size={22} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
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
                  accessibilityRole="button"
                  accessibilityLabel={`Marcar como hecha: ${alert.title}`}
                >
                  <CheckCircle size={20} color={colors.onPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => handleDismissAlert(alert.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Descartar alerta: ${alert.title}`}
                >
                  <X size={20} color={colors.textSecondary} />
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
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  alertItem: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  alertInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: spacing.sm,
  },
  alertText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  alertTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  alertPet: {
    ...typography.label,
    fontSize: 13,
    color: colors.primary,
  },
  alertActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: touchTarget / 2,
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: touchTarget / 2,
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  dateIcon: {
    fontSize: 14,
  },
  dateText: {
    ...typography.captionStrong,
    fontSize: 13,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  priorityText: {
    ...typography.captionStrong,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
