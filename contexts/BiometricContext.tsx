import React, { createContext, useContext, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Alert, AppState } from 'react-native';
import { supabaseClient, getCurrentUser } from '../lib/supabase';

interface BiometricContextType {
  isBiometricSupported: boolean;
  isBiometricEnabled: boolean;
  biometricType: string | null;
  enableBiometric: (email: string, password: string) => Promise<boolean>;
  enableBiometricFromProfile: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<{ email: string; password: string } | null>;
  checkBiometricStatus: () => Promise<void>;
}

const BiometricContext = createContext<BiometricContextType | undefined>(undefined);

export const useBiometric = () => {
  const context = useContext(BiometricContext);
  if (!context) {
    throw new Error('useBiometric must be used within a BiometricProvider');
  }
  return context;
};

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_EMAIL_KEY = 'biometric_email';
const BIOMETRIC_PASSWORD_KEY = 'biometric_password';

export const BiometricProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children
}) => {
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    checkBiometricSupport();
    checkBiometricStatus();
    setIsInitialized(true);
    
    // Get current user ID
    const getCurrentUserId = async () => {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    
    getCurrentUserId();
  }, []);

  // Listen to user's biometric settings from Firebase
  useEffect(() => {
    if (!currentUserId || !isInitialized) return;
    
    // Use a ref to track if we're already listening
    let isSubscribed = true;

    const fetchBiometricStatus = async () => {
      try {
        if (Platform.OS === 'web') {
          return;
        }
        
        // Get user document
        const { data: userDoc } = await supabaseClient.from('profiles').select('*').eq('id', currentUserId).single();
        
        if (userDoc && isSubscribed) {
          const firebaseBiometricEnabled = userDoc.biometric_enabled || false;
          
          // Sync local state with Firebase
          if (firebaseBiometricEnabled !== isBiometricEnabled) {
            setIsBiometricEnabled(firebaseBiometricEnabled);
            
            // Update local storage to match Firebase
            if (Platform.OS !== 'web') {
              SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, firebaseBiometricEnabled.toString());
            }
          }
        }
      } catch (error) {
        console.error('Error fetching biometric status:', error);
      }
    };
    
    // Initial fetch
    fetchBiometricStatus();
    
    // Set up listener for app state changes to refresh data
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchBiometricStatus();
      }
    });
    
    return () => {
      isSubscribed = false;
      subscription.remove();
    };
  }, [currentUserId, isBiometricEnabled, isInitialized]);

  const checkBiometricSupport = async () => {
    // Biometric authentication is not supported on web
    if (Platform.OS === 'web') {
      setIsBiometricSupported(false);
      setBiometricType(null);
      return;
    }

    try {
      // Check if device supports biometric authentication
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        setIsBiometricSupported(false);
        return;
      }

      // Check if biometric records are enrolled
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        setIsBiometricSupported(false);
        return;
      }

      // Get available authentication types
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      let typeString = null;
      
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        typeString = Platform.OS === 'ios' ? 'Face ID' : 'Reconocimiento facial';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        typeString = Platform.OS === 'ios' ? 'Touch ID' : 'Huella dactilar';
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        typeString = 'Reconocimiento de iris';
      }

      setIsBiometricSupported(true);
      setBiometricType(typeString);
    } catch (error) {
      console.error('Error checking biometric support:', error);
      setIsBiometricSupported(false);
    }
  };

  const checkBiometricStatus = async () => {
    // Biometric authentication is not supported on web
    if (Platform.OS === 'web') {
      setIsBiometricEnabled(false);
      return;
    }

    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      setIsBiometricEnabled(enabled === 'true');
    } catch (error) {
      console.error('Error checking biometric status:', error);
      setIsBiometricEnabled(false);
    }
  };

  const updateFirebaseBiometricStatus = async (enabled: boolean) => {
    if (!currentUserId) return;

    try {      
      if (Platform.OS === 'web') return;
      
      await supabaseClient
        .from('profiles')
        .update({
          biometric_enabled: enabled,
          updated_at: new Date()
        })
        .eq('id', currentUserId);
    } catch (error) {
      console.error('Error updating biometric status in Firebase:', error);
    }
  };

  const enableBiometric = async (email: string, password: string): Promise<boolean> => {
    // Biometric authentication is not supported on web
    if (Platform.OS === 'web') {
      console.log('Biometric authentication not available on web');
      return false;
    }

    try {
      if (!isBiometricSupported) {
        console.log('Device does not support biometric authentication');
        return false;
      }

      // Verify credentials first
      try {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) {
          console.error('Error verifying credentials:', error);
          return false;
        }
      } catch (credError) {
        console.error('Error during credential verification:', credError);
        return false;
      }

      // Authenticate user with biometric before enabling
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirma tu identidad',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar contraseña',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Store credentials securely in device
        await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
        await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password);
        await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
        
        // Update Firebase with biometric status
        await updateFirebaseBiometricStatus(true);
        
        setIsBiometricEnabled(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return false;
    }
  };

  const enableBiometricFromProfile = async (): Promise<boolean> => {
    // Biometric authentication is not supported on web
    if (Platform.OS === 'web') {
      Alert.alert('No disponible', 'La autenticación biométrica no está disponible en la web');
      return false;
    }

    try {
      if (!isBiometricSupported) {
        Alert.alert('No disponible', 'Tu dispositivo no soporta autenticación biométrica');
        return false;
      }

      // Show alert asking for credentials
      return new Promise((resolve) => {
        Alert.alert(
          'Habilitar autenticación biométrica',
          'Para habilitar el acceso biométrico, necesitamos verificar tu identidad. Por favor ingresa tus credenciales.',
          [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => resolve(false)
            },
            {
              text: 'Continuar',
              onPress: () => {
                // Show input modal for credentials
                showCredentialsModal(resolve);
              }
            }
          ]
        );
      });
    } catch (error) {
      console.error('Error enabling biometric from profile:', error);
      return false;
    }
  };

  const showCredentialsModal = (resolve: (value: boolean) => void) => {
    // This will be handled by the profile component
    // For now, we'll return false and let the profile handle the flow
    resolve(false);
  };

  const disableBiometric = async (): Promise<void> => {
    try {
      // Remove from device storage
      if (Platform.OS !== 'web') {
        await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      }
      
      // Update Firebase
      await updateFirebaseBiometricStatus(false);
      
      setIsBiometricEnabled(false);
    } catch (error) {
      console.error('Error disabling biometric:', error);
    }
  };

  const authenticateWithBiometric = async (): Promise<{ email: string; password: string } | null> => {
    try {
      if (!isBiometricSupported || !isBiometricEnabled) {
        console.log('Biometric not supported or not enabled');
        return null;
      }

      console.log('Attempting biometric authentication with type:', biometricType);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Usa tu ${biometricType || 'biometría'} para iniciar sesión`,
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar contraseña',
        disableDeviceFallback: false,
      });

      if (result.success) {
        console.log('Biometric authentication successful');
        const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
        const password = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY);
        
        if (email && password) {
          console.log('Retrieved stored credentials for:', email);
          return { email, password };
        } else {
          // If credentials are missing, disable biometric and ask user to re-enable
          await disableBiometric();
          Alert.alert(
            'Credenciales no encontradas',
            'Por favor, vuelve a habilitar la autenticación biométrica en tu perfil.'
          );
        }
      } else {
        console.log('Biometric authentication failed:', result.error);
      }
      
      return null;
    } catch (error) {
      console.error('Error authenticating with biometric:', error);
      return null;
    }
  };

  const value = {
    isBiometricSupported,
    isBiometricEnabled,
    biometricType,
    enableBiometric,
    enableBiometricFromProfile,
    disableBiometric,
    authenticateWithBiometric,
    checkBiometricStatus,
  };

  return <BiometricContext.Provider value={value}>{children}</BiometricContext.Provider>;
};