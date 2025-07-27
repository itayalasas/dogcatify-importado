import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
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
      const hasShown = await AsyncStorage.getItem(NOTIFICATION_PROMPT_KEY);
      
      // Mostrar si no se ha mostrado antes y no tiene token
      if (!hasShown && !expoPushToken) {
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
      const token = await registerForPushNotifications();
      if (token) {
        await AsyncStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true');
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    }
  };

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true');
      setShowPrompt(false);
    } catch (error) {
      console.error('Error dismissing prompt:', error);
    }
  };

  if (!showPrompt) return null;

  return (
    <Modal
      visible={showPrompt}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Card style={styles.promptCard}>
          <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
            <X size={20} color="#6B7280" />
          </TouchableOpacity>
          
          <View style={styles.iconContainer}>
            <Bell size={48} color="#3B82F6" />
          </View>
          
          <Text style={styles.title}>¡Mantente al día!</Text>
          <Text style={styles.description}>
            Recibe notificaciones importantes sobre tus reservas, pedidos y actualizaciones de DogCatiFy.
          </Text>
          
          <View style={styles.benefits}>
            <Text style={styles.benefit}>• Confirmaciones de reservas</Text>
            <Text style={styles.benefit}>• Actualizaciones de pedidos</Text>
            <Text style={styles.benefit}>• Ofertas especiales</Text>
            <Text style={styles.benefit}>• Recordatorios importantes</Text>
          </View>
          
          <View style={styles.actions}>
            <Button
              title="Habilitar Notificaciones"
              onPress={handleEnableNotifications}
              size="large"
            />
            <TouchableOpacity style={styles.laterButton} onPress={handleDismiss}>
              <Text style={styles.laterText}>Tal vez después</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  promptCard: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  benefits: {
    marginBottom: 24,
  },
  benefit: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 8,
    paddingLeft: 8,
  },
  actions: {
    gap: 12,
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  laterText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
});