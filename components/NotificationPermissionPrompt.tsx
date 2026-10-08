import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { Bell, X, CalendarCheck, Package, Tag, AlarmClock } from 'lucide-react-native';
import Constants from 'expo-constants';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { toast } from './ui/Toast';
import { colors, typography, spacing, radius, touchTarget, hitSlop } from '../constants/theme';
import { useNotifications } from '../contexts/NotificationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_PROMPT_KEY = 'notification_prompt_shown';

export const NotificationPermissionPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const { registerForPushNotifications, expoPushToken } = useNotifications();

  useEffect(() => {
    checkShouldShowPrompt();
  }, []);

  const checkShouldShowPrompt = async () => {
    try {
      // Don't show prompt in Expo Go only
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        console.log('Skipping notification prompt in Expo Go');
        return;
      }

      const hasShown = await AsyncStorage.getItem(NOTIFICATION_PROMPT_KEY);
      
      // Show if not shown before and no token, but only in production builds
      if (!hasShown && !expoPushToken && !isExpoGo) {
        // Esperar un poco antes de mostrar para mejor UX
        setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
      }
    } catch (error) {
      console.error('Error checking notification prompt:', error);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      console.log('User clicked enable notifications');
      
      // Additional check for production environment
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        Alert.alert(
          'No disponible en Expo Go',
          'Las notificaciones push no están disponibles en Expo Go. Necesitás una build de desarrollo o producción.',
          [{ text: 'Entendido' }]
        );
        return;
      }
      
      const token = await registerForPushNotifications();
      
      if (token) {
        console.log('Push token obtained successfully:', token);
        await AsyncStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true');
        setShowPrompt(false);
        toast.success(
          'Notificaciones activadas',
          'Te vamos a avisar sobre tus reservas y pedidos.'
        );
      } else {
        console.log('No push token obtained');
        // Si no se pudo obtener token, marcar como mostrado para no volver a preguntar
        await AsyncStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true');
        setShowPrompt(false);
        
        Alert.alert(
          'Notificaciones no disponibles',
          'No se pudieron activar las notificaciones push. Asegurate de usar una build de producción y de que el dispositivo admita notificaciones.',
          [{ text: 'Entendido' }]
        );
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      
      // Marcar como mostrado para no volver a preguntar
      await AsyncStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true');
      setShowPrompt(false);
      
      Alert.alert(
        'No pudimos activar las notificaciones',
        'Hubo un problema al configurar las notificaciones. Podés activarlas más tarde desde la configuración del dispositivo.',
        [{ text: 'Entendido' }]
      );
    }
  };

  const handleDismiss = async () => {
    try {
      console.log('User dismissed notification prompt');
      await AsyncStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true');
      setShowPrompt(false);
    } catch (error) {
      console.error('Error dismissing prompt:', error);
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  const benefits = [
    { icon: CalendarCheck, text: 'Confirmaciones de reservas' },
    { icon: Package, text: 'Novedades de tus pedidos' },
    { icon: Tag, text: 'Ofertas especiales' },
    { icon: AlarmClock, text: 'Recordatorios importantes' },
  ];

  return (
    <Modal
      visible={showPrompt}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <Card style={styles.promptCard} pointerEvents="auto">
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDismiss}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <X size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Bell size={40} color={colors.primary} />
          </View>

          <Text style={styles.title} accessibilityRole="header">¡Enterate de todo!</Text>
          <Text style={styles.description}>
            Recibí avisos importantes sobre tus reservas, pedidos y novedades de DogCatiFy.
          </Text>

          <View style={styles.benefits}>
            {benefits.map(({ icon: Icon, text }) => (
              <View key={text} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Icon size={16} color={colors.primary} />
                </View>
                <Text style={styles.benefit}>{text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              title="Activar notificaciones"
              onPress={handleEnableNotifications}
              size="large"
            />
            <TouchableOpacity
              style={styles.laterButton}
              onPress={handleDismiss}
              accessibilityRole="button"
            >
              <Text style={styles.laterText}>Ahora no</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  promptCard: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.xxl,
    paddingTop: spacing.huge,
    borderRadius: radius.xl,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  benefits: {
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefit: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  actions: {
    gap: spacing.xs,
  },
  laterButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget,
  },
  laterText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
});
