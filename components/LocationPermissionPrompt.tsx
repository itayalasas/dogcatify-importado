import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { MapPin, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
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
          
          Alert.alert(
            'Ubicación habilitada',
            'Ahora podrás ver lugares pet-friendly cerca de ti y obtener mejores recomendaciones.',
            [{ text: 'Perfecto' }]
          );
        } catch (locationError) {
          console.error('Error obteniendo ubicación:', locationError);
          await AsyncStorage.setItem(LOCATION_PROMPT_KEY, 'true');
          setShowPrompt(false);
          
          Alert.alert(
            'Permisos concedidos',
            'Los permisos de ubicación han sido concedidos. La ubicación se obtendrá cuando sea necesaria.',
            [{ text: 'Entendido' }]
          );
        }
      } else {
        console.log('Permisos de ubicación denegados');
        await AsyncStorage.setItem(LOCATION_PROMPT_KEY, 'true');
        setShowPrompt(false);
        
        Alert.alert(
          'Permisos denegados',
          'Sin permisos de ubicación, no podremos mostrarte lugares cercanos. Puedes habilitarlos más tarde desde la configuración del dispositivo.',
          [{ text: 'Entendido' }]
        );
      }
    } catch (error) {
      console.error('Error enabling location:', error);
      
      await AsyncStorage.setItem(LOCATION_PROMPT_KEY, 'true');
      setShowPrompt(false);
      
      Alert.alert(
        'Error',
        'Hubo un problema al solicitar permisos de ubicación. Puedes intentar habilitarlos más tarde desde la configuración del dispositivo.',
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

  return (
    <Modal
      visible={showPrompt}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Card style={styles.card}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleDismiss}
            >
              <X size={24} color="#666" />
            </TouchableOpacity>

            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <MapPin size={48} color="#FF6B6B" />
              </View>

              <Text style={styles.title}>
                Encuentra lugares pet-friendly cerca
              </Text>

              <Text style={styles.description}>
                Habilita la ubicación para descubrir parques, veterinarias, tiendas y lugares que aceptan mascotas en tu zona.
              </Text>

              <View style={styles.benefits}>
                <Text style={styles.benefit}>• Lugares cercanos a ti</Text>
                <Text style={styles.benefit}>• Recomendaciones personalizadas</Text>
                <Text style={styles.benefit}>• Navegación directa</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title="Habilitar Ubicación"
                onPress={handleRequestLocationPermission}
                size="large"
              />
              
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleDismiss}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    padding: 0,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  content: {
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  benefits: {
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  benefit: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    paddingLeft: 8,
  },
  actions: {
    padding: 24,
    paddingTop: 0,
  },
  skipButton: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
});