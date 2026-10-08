import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { MapPin, X, Navigation, Sparkles } from 'lucide-react-native';
import * as Location from 'expo-location';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { toast } from './ui/Toast';
import { colors, typography, spacing, radius, touchTarget, hitSlop } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_PROMPT_KEY = '@location_prompt_shown';

export const LocationPermissionPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    checkLocationPermissions();
  }, []);

  const checkLocationPermissions = async () => {
    try {
      // Verificar permisos actuales
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status === 'granted') {
        setHasLocationPermission(true);
        // Si ya tiene permisos, obtener ubicación actual
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCurrentLocation(location);
          console.log('Ubicación actual obtenida:', location.coords);
        } catch (locationError) {
          console.error('Error obteniendo ubicación:', locationError);
        }
        return;
      }
      
      const hasShown = await AsyncStorage.getItem(LOCATION_PROMPT_KEY);
      
      // Mostrar si no se ha mostrado antes y no tiene permisos
      if (!hasShown) {
        // Esperar un poco antes de mostrar para mejor UX
        setTimeout(() => {
          setShowPrompt(true);
        }, 4000); // Mostrar después del prompt de notificaciones
      }
    } catch (error) {
      console.error('Error checking location prompt:', error);
    }
  };

  const handleRequestLocationPermission = async () => {
    try {
      console.log('Solicitando permisos de ubicación...');
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        console.log('Permisos de ubicación concedidos');
        setHasLocationPermission(true);
        
        // Obtener ubicación actual
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCurrentLocation(location);
          console.log('Ubicación obtenida:', location.coords);
          
          await AsyncStorage.setItem(LOCATION_PROMPT_KEY, 'true');
          setShowPrompt(false);
          
          toast.success(
            'Ubicación activada',
            'Ya podés ver lugares pet-friendly cerca tuyo.'
          );
        } catch (locationError) {
          console.error('Error obteniendo ubicación:', locationError);
          await AsyncStorage.setItem(LOCATION_PROMPT_KEY, 'true');
          setShowPrompt(false);
          
          toast.success(
            'Permiso concedido',
            'Vamos a usar tu ubicación cuando haga falta.'
          );
        }
      } else {
        console.log('Permisos de ubicación denegados');
        await AsyncStorage.setItem(LOCATION_PROMPT_KEY, 'true');
        setShowPrompt(false);
        
        Alert.alert(
          'Ubicación desactivada',
          'Sin permiso de ubicación no podemos mostrarte lugares cercanos. Podés activarlo más tarde desde la configuración del dispositivo.',
          [{ text: 'Entendido' }]
        );
      }
    } catch (error) {
      console.error('Error enabling location:', error);
      
      await AsyncStorage.setItem(LOCATION_PROMPT_KEY, 'true');
      setShowPrompt(false);
      
      Alert.alert(
        'Error',
        'Hubo un problema al pedir el permiso de ubicación. Podés activarlo más tarde desde la configuración del dispositivo.',
        [{ text: 'Entendido' }]
      );
    }
  };

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(LOCATION_PROMPT_KEY, 'true');
      setShowPrompt(false);
    } catch (error) {
      console.error('Error dismissing location prompt:', error);
    }
  };

  if (!showPrompt) return null;

  const benefits = [
    { icon: MapPin, text: 'Lugares cercanos a vos' },
    { icon: Sparkles, text: 'Recomendaciones personalizadas' },
    { icon: Navigation, text: 'Cómo llegar en un toque' },
  ];

  return (
    <Modal
      visible={showPrompt}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.container} pointerEvents="box-none">
          <Card style={styles.card} padding={false} pointerEvents="auto">
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleDismiss}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <MapPin size={40} color={colors.primary} />
              </View>

              <Text style={styles.title} accessibilityRole="header">
                Encontrá lugares pet-friendly cerca
              </Text>

              <Text style={styles.description}>
                Activá la ubicación para descubrir parques, veterinarias, tiendas y lugares que aceptan mascotas en tu zona.
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
            </View>

            <View style={styles.actions}>
              <Button
                title="Activar ubicación"
                onPress={handleRequestLocationPermission}
                size="large"
              />

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleDismiss}
                accessibilityRole="button"
              >
                <Text style={styles.skipText}>Ahora no</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
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
  container: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    position: 'relative',
    borderRadius: radius.xl,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.xxl,
    paddingTop: spacing.huge,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  benefits: {
    alignSelf: 'stretch',
    gap: spacing.sm,
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
    padding: spacing.xxl,
    paddingTop: 0,
  },
  skipButton: {
    marginTop: spacing.sm,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
});
