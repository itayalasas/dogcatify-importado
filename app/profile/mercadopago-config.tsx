import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import { Linking } from 'react-native';

export default function MercadoPagoConfig() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const [adminConfig, setAdminConfig] = useState<any>(null);

  useEffect(() => {
    loadPartnerData();
    loadAdminConfig();
  }, []);

  const loadPartnerData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setPartner(data);
    } catch (error) {
      console.error('Error loading partner data:', error);
    }
  };

  const loadAdminConfig = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('admin_settings')
        .select('*')
        .eq('key', 'mercadopago_config')
        .single();

      if (error) throw error;
      setAdminConfig(data?.value);
    } catch (error) {
      console.error('Error loading admin config:', error);
    }
  };

  const connectMercadoPago = async () => {
    if (!adminConfig?.client_id) {
      Alert.alert('Error', 'Configuración de Mercado Pago no disponible. Contacta al administrador.');
      return;
    }

    try {
      setLoading(true);
      
      const redirectUri = 'https://dogcatify.com/auth/mercadopago/callback';
      const authUrl = `https://auth.mercadopago.com.uy/authorization?client_id=${adminConfig.client_id}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}&state=${partner?.id}`;
      
      await Linking.openURL(authUrl);
    } catch (error) {
      console.error('Error connecting to Mercado Pago:', error);
      Alert.alert('Error', 'No se pudo conectar con Mercado Pago');
    } finally {
      setLoading(false);
    }
  };

  const disconnectMercadoPago = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabaseClient
        .from('partners')
        .update({
          mercadopago_connected: false,
          mercadopago_config: {}
        })
        .eq('id', partner.id);

      if (error) throw error;
      
      setPartner({ ...partner, mercadopago_connected: false, mercadopago_config: {} });
      Alert.alert('Éxito', 'Mercado Pago desconectado correctamente');
    } catch (error) {
      console.error('Error disconnecting Mercado Pago:', error);
      Alert.alert('Error', 'No se pudo desconectar Mercado Pago');
    } finally {
      setLoading(false);
    }
  };

  if (!partner) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Configuración de Mercado Pago</Text>
        <Text style={styles.subtitle}>
          Conecta tu cuenta de Mercado Pago para recibir pagos
        </Text>
      </View>

      <View style={styles.card}>
        {partner.mercadopago_connected ? (
          <View style={styles.connectedState}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>✅ Conectado</Text>
            </View>
            <Text style={styles.connectedText}>
              Tu cuenta de Mercado Pago está conectada y lista para recibir pagos.
            </Text>
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={disconnectMercadoPago}
              disabled={loading}
            >
              <Text style={styles.disconnectButtonText}>
                {loading ? 'Desconectando...' : 'Desconectar'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.disconnectedState}>
            <Text style={styles.disconnectedText}>
              Para recibir pagos, necesitas conectar tu cuenta de Mercado Pago.
            </Text>
            <View style={styles.benefitsList}>
              <Text style={styles.benefitItem}>• Recibe pagos directamente en tu cuenta</Text>
              <Text style={styles.benefitItem}>• Comisión automática para la plataforma</Text>
              <Text style={styles.benefitItem}>• Proceso seguro y confiable</Text>
            </View>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={connectMercadoPago}
              disabled={loading || !adminConfig?.client_id}
            >
              <Text style={styles.connectButtonText}>
                {loading ? 'Conectando...' : 'Conectar con Mercado Pago'}
              </Text>
            </TouchableOpacity>
            {!adminConfig?.client_id && (
              <Text style={styles.warningText}>
                La configuración de Mercado Pago no está disponible. Contacta al administrador.
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>¿Cómo funciona?</Text>
        <Text style={styles.infoText}>
          1. Conectas tu cuenta de Mercado Pago de forma segura
        </Text>
        <Text style={styles.infoText}>
          2. Los clientes pagan a través de la plataforma
        </Text>
        <Text style={styles.infoText}>
          3. Recibes el dinero directamente en tu cuenta MP
        </Text>
        <Text style={styles.infoText}>
          4. La plataforma retiene automáticamente su comisión
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#6c757d',
  },
  card: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectedState: {
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#d4edda',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusText: {
    color: '#155724',
    fontWeight: '600',
  },
  connectedText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#495057',
    marginBottom: 20,
  },
  disconnectButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  disconnectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  disconnectedState: {
    alignItems: 'center',
  },
  disconnectedText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#495057',
    marginBottom: 20,
  },
  benefitsList: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  benefitItem: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
  connectButton: {
    backgroundColor: '#009ee3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  warningText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#dc3545',
    fontStyle: 'italic',
  },
  infoCard: {
    margin: 20,
    marginTop: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
});