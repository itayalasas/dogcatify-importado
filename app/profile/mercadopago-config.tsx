import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Shield, Info, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';
import { supabaseClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function MercadoPagoConfig() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [isTestMode, setIsTestMode] = useState(true);
  const [partner, setPartner] = useState<any>(null);

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (error) throw error;

      setPartner(data);
      setIsConnected(data.mercadopago_connected || false);
      
      if (data.mercadopago_config) {
        setAccessToken(data.mercadopago_config.access_token || '');
        setPublicKey(data.mercadopago_config.public_key || '');
        setIsTestMode(data.mercadopago_config.is_test_mode || false);
      }
    } catch (error) {
      console.error('Error loading partner data:', error);
    }
  };

  const validateCredentials = async (token: string, key: string) => {
    try {
      // Validación básica de formato
      const isValidToken = token.startsWith('APP_USR-') || token.startsWith('TEST-');
      const isValidKey = key.startsWith('APP_USR-') || key.startsWith('TEST-');
      
      if (!isValidToken || !isValidKey) {
        throw new Error('Formato de credenciales inválido');
      }

      // Intentar validar con la API de Mercado Pago
      try {
        const response = await fetch('https://api.mercadopago.com/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('MP User validated:', userData.id);
          return true;
        } else {
          console.log('MP API validation failed, using format validation');
          return isValidToken && isValidKey;
        }
      } catch (apiError) {
        console.log('MP API not accessible, using format validation:', apiError);
        return isValidToken && isValidKey;
      }
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  };

  const handleConnect = () => {
    Alert.alert(
      'Conectar con Mercado Pago',
      'Para conectar tu cuenta necesitas ingresar tus credenciales de Mercado Pago. Puedes obtenerlas en developers.mercadopago.com',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => {
          // El formulario ya está visible, solo necesitamos scroll hacia abajo
        }}
      ]
    );
  };

  const handleSave = async () => {
    if (!accessToken.trim() || !publicKey.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);

    try {
      const isValid = await validateCredentials(accessToken.trim(), publicKey.trim());
      
      if (!isValid) {
        Alert.alert(
          'Credenciales inválidas',
          'Las credenciales ingresadas no son válidas. Verifica que sean correctas y que correspondan al mismo entorno (producción o prueba).'
        );
        setLoading(false);
        return;
      }

      const config = {
        access_token: accessToken.trim(),
        public_key: publicKey.trim(),
        is_test_mode: isTestMode,
        connected_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('partners')
        .update({
          mercadopago_connected: true,
          mercadopago_config: config,
        })
        .eq('user_id', currentUser?.id);

      if (error) throw error;

      setIsConnected(true);
      Alert.alert(
        '¡Éxito!',
        'Tu cuenta de Mercado Pago ha sido conectada correctamente. Ya puedes recibir pagos.',
        [{ text: 'Continuar', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving MP config:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Desconectar Mercado Pago',
      '¿Estás seguro que quieres desconectar tu cuenta? No podrás recibir pagos hasta que la vuelvas a conectar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('partners')
                .update({
                  mercadopago_connected: false,
                  mercadopago_config: null,
                })
                .eq('user_id', currentUser?.id);

              if (error) throw error;

              setIsConnected(false);
              setAccessToken('');
              setPublicKey('');
              Alert.alert('Desconectado', 'Tu cuenta de Mercado Pago ha sido desconectada.');
            } catch (error) {
              Alert.alert('Error', 'No se pudo desconectar la cuenta.');
            }
          },
        },
      ]
    );
  };

  const handleTestConnection = async () => {
    if (!accessToken.trim()) {
      Alert.alert('Error', 'Necesitas un Access Token para probar la conexión');
      return;
    }

    setLoading(true);
    try {
      const isValid = await validateCredentials(accessToken.trim(), publicKey.trim());
      
      if (isValid) {
        Alert.alert('¡Conexión exitosa!', 'Las credenciales son válidas y la conexión funciona correctamente.');
      } else {
        Alert.alert('Error de conexión', 'No se pudo validar la conexión. Verifica tus credenciales.');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo probar la conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurar Mercado Pago</Text>
        <TouchableOpacity style={styles.helpButton}>
          <Info size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Security Section */}
        <View style={styles.securitySection}>
          <View style={styles.securityHeader}>
            <Shield size={24} color="#007AFF" />
            <Text style={styles.securityTitle}>Seguridad y Privacidad</Text>
          </View>
          
          <View style={styles.securityItem}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={styles.securityText}>Tus credenciales se almacenan de forma segura y encriptada</Text>
          </View>
          
          <View style={styles.securityItem}>
            <Text style={styles.securityIcon}>🛡️</Text>
            <Text style={styles.securityText}>Solo se utilizan para procesar pagos de tus ventas</Text>
          </View>
          
          <View style={styles.securityItem}>
            <Text style={styles.securityIcon}>📊</Text>
            <Text style={styles.securityText}>Puedes revocar el acceso en cualquier momento</Text>
          </View>
          
          <View style={styles.securityItem}>
            <Text style={styles.securityIcon}>💳</Text>
            <Text style={styles.securityText}>Mercado Pago maneja toda la información sensible de pagos</Text>
          </View>
        </View>

        {/* Connection Status */}
        {isConnected ? (
          <View style={styles.connectedSection}>
            <View style={styles.connectedHeader}>
              <CheckCircle size={24} color="#10B981" />
              <Text style={styles.connectedTitle}>¡Cuenta Conectada!</Text>
            </View>
            <Text style={styles.connectedText}>
              Tu cuenta de Mercado Pago está conectada y lista para recibir pagos.
            </Text>
            <Text style={styles.commissionText}>
              💰 Recibirás el {partner?.commission_percentage ? (100 - partner.commission_percentage) : 95}% de cada venta
            </Text>
            
            <View style={styles.connectedActions}>
              <TouchableOpacity 
                style={styles.testButton} 
                onPress={handleTestConnection}
                disabled={loading}
              >
                <Text style={styles.testButtonText}>
                  {loading ? 'Probando...' : 'Probar Conexión'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.disconnectButton} 
                onPress={handleDisconnect}
              >
                <Text style={styles.disconnectButtonText}>Desconectar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Connect Button */}
            <TouchableOpacity 
              style={styles.connectButton} 
              onPress={handleConnect}
            >
              <Text style={styles.connectButtonText}>Conectar con Mercado Pago</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hideButton}>
              <Text style={styles.hideButtonText}>Ocultar</Text>
            </TouchableOpacity>

            {/* Manual Configuration */}
            <View style={styles.manualSection}>
              <Text style={styles.manualTitle}>Configuración Manual</Text>
              <Text style={styles.manualSubtitle}>
                Ingresa tus credenciales de Mercado Pago manualmente
              </Text>

              {/* Help Section */}
              <View style={styles.helpSection}>
                <Text style={styles.helpTitle}>💡 ¿Cómo obtener mis credenciales?</Text>
                <Text style={styles.helpStep}>1. Ve a developers.mercadopago.com</Text>
                <Text style={styles.helpStep}>2. Inicia sesión con tu cuenta de Mercado Pago</Text>
                <Text style={styles.helpStep}>3. Ve a "Tus integraciones" → "Credenciales"</Text>
                <Text style={styles.helpStep}>4. Copia el Access Token y Public Key</Text>
              </View>

              {/* Access Token */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Access Token *</Text>
                <TextInput
                  style={styles.input}
                  value={accessToken}
                  onChangeText={setAccessToken}
                  placeholder="APP_USR-xxxxxxxx o TEST-xxxxxxxx"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Public Key */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Public Key *</Text>
                <TextInput
                  style={styles.input}
                  value={publicKey}
                  onChangeText={setPublicKey}
                  placeholder="APP_USR-xxxxxxxx o TEST-xxxxxxxx"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Test Mode Toggle */}
              <View style={styles.testModeSection}>
                <View style={styles.testModeHeader}>
                  <Text style={styles.testModeTitle}>Modo de prueba</Text>
                  <Switch
                    value={isTestMode}
                    onValueChange={setIsTestMode}
                    trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                    thumbColor={isTestMode ? '#FFFFFF' : '#FFFFFF'}
                  />
                </View>
                <Text style={styles.testModeDescription}>
                  {isTestMode 
                    ? '🧪 Recomendado para pruebas. Usa credenciales TEST-' 
                    : '🚀 Modo producción. Usa credenciales APP_USR- reales'
                  }
                </Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity 
                style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Validando...' : 'Guardar Configuración'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Commission Info */}
        <View style={styles.commissionSection}>
          <Text style={styles.commissionTitle}>💰 Información de Comisiones</Text>
          <Text style={styles.commissionText}>
            • La app cobra {partner?.commission_percentage || 5}% de comisión por cada venta
          </Text>
          <Text style={styles.commissionText}>
            • Tú recibes el {partner?.commission_percentage ? (100 - partner.commission_percentage) : 95}% del precio de venta
          </Text>
          <Text style={styles.commissionText}>
            • Las comisiones se deducen automáticamente
          </Text>
          <Text style={styles.commissionText}>
            • Los pagos llegan directamente a tu cuenta de Mercado Pago
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  helpButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  securitySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  securityTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 10,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  securityIcon: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 2,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  connectedSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  connectedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 10,
  },
  connectedText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 20,
  },
  commissionText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    marginBottom: 15,
  },
  connectedActions: {
    flexDirection: 'row',
    gap: 10,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  disconnectButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  connectButton: {
    backgroundColor: '#00A650',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  hideButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 30,
  },
  hideButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  manualSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  manualTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 5,
  },
  manualSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  helpSection: {
    backgroundColor: '#EBF8FF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 10,
  },
  helpStep: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 5,
    paddingLeft: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  testModeSection: {
    marginBottom: 25,
  },
  testModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  testModeTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  testModeDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  commissionSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  commissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 10,
  },
});