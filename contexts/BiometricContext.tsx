import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { supabaseClient } from '../lib/supabase';

const SAVED_CREDENTIALS_KEY = '@saved_credentials';

interface BiometricContextType {
  isBiometricAvailable: boolean;
  isBiometricSupported: boolean;
  isBiometricEnabled: boolean;
  biometricType: string | null;
  checkBiometricStatus: () => Promise<void>;
  enableBiometric: (email: string, password: string) => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<{ email: string; password: string } | null>;
  getStoredCredentials: () => Promise<{ email: string; password: string } | null>;
}

const BiometricContext = createContext<BiometricContextType | undefined>(undefined);

export const useBiometric = () => {
  const context = useContext(BiometricContext);
  if (!context) {
    throw new Error('useBiometric must be used within a BiometricProvider');
  }
  return context;
};

export const BiometricProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    // Check biometric availability immediately when context loads
    checkBiometricAvailability();
    
    // Check if biometric is enabled regardless of user authentication status
    checkBiometricEnabledFromDevice();
  }, []);

  // Separate effect for when user changes
  useEffect(() => {
    if (currentUser) {
      // When user is authenticated, sync with database
      syncBiometricWithDatabase();
    }
  }, [currentUser]);

  const checkBiometricAvailability = async () => {
    try {
      // Check if running in Expo Go
      const isExpoGo = __DEV__ && !LocalAuthentication;
      if (isExpoGo) {
        console.log('Biometric authentication not available in Expo Go');
        setIsBiometricAvailable(false);
        setIsBiometricSupported(false);
        setBiometricType(null);
        return;
      }

      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const available = compatible && enrolled;
      setIsBiometricAvailable(available);
      setIsBiometricSupported(available);
      
      if (available) {
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        } else {
          setBiometricType('biometría');
        }
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setIsBiometricAvailable(false);
      setIsBiometricSupported(false);
      setBiometricType(null);
    }
  };

  // Check biometric enabled status from device storage only (no database dependency)
  const checkBiometricEnabledFromDevice = async () => {
    try {
      console.log('Checking biometric enabled from device storage...');
      const storedCredentials = await getStoredCredentials();
      
      if (!storedCredentials) {
        console.log('No stored credentials found, biometric disabled');
        setIsBiometricEnabled(false);
        return;
      }

      console.log('Stored credentials found, biometric enabled');
      setIsBiometricEnabled(true);
    } catch (error) {
      console.error('Error checking biometric from device:', error);
      setIsBiometricEnabled(false);
    }
  };

  // Sync biometric status with database when user is authenticated
  const syncBiometricWithDatabase = async () => {
    if (!currentUser) return;
    
    try {
      console.log('Syncing biometric status with database...');
      const storedCredentials = await getStoredCredentials();
      
      try {
        // Check if biometric is enabled in user profile
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('biometric_enabled')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          // If column doesn't exist, gracefully handle it
          if (error.code === '42703' || error.code === 'PGRST204') {
            console.log('Biometric columns not yet available in database');
            return;
          }
          console.error('Error checking biometric status:', error);
          return;
        }

        const dbEnabled = data?.biometric_enabled || false;
        const hasLocalCredentials = !!storedCredentials;
        
        // Sync database with local storage state
        if (dbEnabled && !hasLocalCredentials) {
          console.log('Database shows biometric enabled but no local credentials found, updating database...');
          await supabaseClient
            .from('profiles')
            .update({ 
              biometric_enabled: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
        } else if (!dbEnabled && hasLocalCredentials) {
          console.log('Local credentials found but database shows disabled, updating database...');
          await supabaseClient
            .from('profiles')
            .update({ 
              biometric_enabled: true,
              biometric_enabled_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
        }
      } catch (dbError) {
        console.log('Database sync failed, but local credentials determine biometric status:', dbError);
      }
    } catch (error) {
      console.error('Error syncing biometric with database:', error);
    }
  };

  const checkBiometricStatus = async () => {
    await checkBiometricAvailability();
    await checkBiometricEnabledFromDevice();
    if (currentUser) {
      await syncBiometricWithDatabase();
    }
  };

  const enableBiometric = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('Starting biometric setup...');
      
      // Biometric authentication is not available on web
      if (Platform.OS === 'web') {
        console.log('Biometric authentication not available on web');
        return false;
      }

      // Check if running in Expo Go
      if (!LocalAuthentication || !SecureStore) {
        console.log('Biometric authentication not available in Expo Go');
        return false;
      }

      if (!isBiometricAvailable) {
        Alert.alert('No disponible', 'La autenticación biométrica no está disponible en este dispositivo');
        return false;
      }

      if (!email || !password) {
        // Try to get credentials from saved credentials
        try {
          const savedCredentials = await AsyncStorage.getItem(SAVED_CREDENTIALS_KEY);
          if (savedCredentials) {
            const { email: savedEmail, password: savedPassword } = JSON.parse(savedCredentials);
            if (savedEmail && savedPassword) {
              email = savedEmail;
              password = savedPassword;
            } else {
              Alert.alert('Error', 'No se encontraron credenciales guardadas. Inicia sesión primero.');
              return false;
            }
          } else {
            Alert.alert('Error', 'No se encontraron credenciales guardadas. Inicia sesión primero.');
            return false;
          }
        } catch (storageError) {
          Alert.alert('Error', 'No se pudieron obtener las credenciales guardadas.');
          return false;
        }
      }

      if (!currentUser) {
        Alert.alert('Error', 'Usuario no autenticado');
        return false;
      }

      // Authenticate with biometric first
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Configura tu ${biometricType || 'autenticación biométrica'}`,
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar contraseña',
      });

      if (!result.success) {
        console.log('Biometric authentication failed or cancelled');
        return false;
      }

      console.log('Biometric authentication successful, storing credentials...');

      // Store credentials securely
      await SecureStore.setItemAsync('biometric_email', email);
      await SecureStore.setItemAsync('biometric_password', password);
      
      console.log('Credentials stored, updating user profile...');

      // Update user profile in Supabase (gracefully handle missing columns)
      try {
        const { error } = await supabaseClient
          .from('profiles')
          .update({
            biometric_enabled: true,
            biometric_enabled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentUser.id);

        if (error) {
          // If columns don't exist yet, continue anyway (credentials are stored locally)
          if (error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST116') {
            console.log('Biometric columns not available in database yet, but credentials stored locally');
            setIsBiometricEnabled(true);
            return true;
          }
          console.error('Error updating biometric status in Supabase:', error);
          // Clean up stored credentials if database update fails
          await SecureStore.deleteItemAsync('biometric_email');
          await SecureStore.deleteItemAsync('biometric_password');
          Alert.alert('Error', 'No se pudo actualizar la configuración biométrica');
          return false;
        }
        
        console.log('Biometric status updated in database successfully');
      } catch (dbError) {
        console.log('Database update failed, but credentials stored locally:', dbError);
        // If database update fails but credentials are stored, still consider it enabled
        setIsBiometricEnabled(true);
        return true;
      }

      console.log('Biometric setup completed successfully');
      setIsBiometricEnabled(true);
      return true;
    } catch (error) {
      console.error('Error enabling biometric:', error);
      // Clean up any stored credentials on error
      try {
        await SecureStore.deleteItemAsync('biometric_email');
        await SecureStore.deleteItemAsync('biometric_password');
      } catch (cleanupError) {
        console.error('Error cleaning up credentials:', cleanupError);
      }
      Alert.alert('Error', 'No se pudo configurar la autenticación biométrica');
      return false;
    }
  };

  const disableBiometric = async (): Promise<void> => {
    try {
      // SecureStore is not available on web
      if (Platform.OS === 'web') {
        return;
      }

      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Remove stored credentials
      await SecureStore.deleteItemAsync('biometric_email');
      await SecureStore.deleteItemAsync('biometric_password');

      // Update user profile (gracefully handle missing column)
      try {
        const { error } = await supabaseClient
          .from('profiles')
          .update({
            biometric_enabled: false,
            biometric_enabled_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentUser.id);

        if (error && (error.code === '42703' || error.code === 'PGRST204')) {
          console.log('Biometric column not available, credentials removed locally');
          // Column doesn't exist yet, but credentials are already removed locally
        } else if (error) {
          throw error;
        }
      } catch (updateError) {
        if (updateError.code !== '42703' && updateError.code !== 'PGRST204') {
          throw updateError;
        }
      }

      setIsBiometricEnabled(false);
    } catch (error) {
      console.error('Error disabling biometric:', error);
      throw error;
    }
  };

  const authenticateWithBiometric = async (): Promise<{ email: string; password: string } | null> => {
    try {
      // Biometric authentication is not available on web
      if (Platform.OS === 'web') {
        return null;
      }

      if (!isBiometricAvailable || !isBiometricEnabled) {
        return null;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autentícate para iniciar sesión',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar contraseña',
      });

      if (result.success) {
        return await getStoredCredentials();
      }
      
      return null;
    } catch (error) {
      console.error('Error authenticating with biometric:', error);
      return null;
    }
  };

  const getStoredCredentials = async (): Promise<{ email: string; password: string } | null> => {
    try {
      // SecureStore is not available on web
      if (Platform.OS === 'web') {
        return null;
      }

      const email = await SecureStore.getItemAsync('biometric_email');
      const password = await SecureStore.getItemAsync('biometric_password');

      if (email && password) {
        return { email, password };
      }

      return null;
    } catch (error) {
      console.error('Error getting stored credentials:', error);
      return null;
    }
  };

  return (
    <BiometricContext.Provider
      value={{
        isBiometricAvailable,
        isBiometricSupported,
        isBiometricEnabled,
        biometricType,
        checkBiometricStatus,
        enableBiometric,
        disableBiometric,
        authenticateWithBiometric,
        getStoredCredentials,
      }}
    >
      {children}
    </BiometricContext.Provider>
  );
};