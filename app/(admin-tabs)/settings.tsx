import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Switch, Alert, Modal } from 'react-native';
import { Bell, Shield, DollarSign, Mail, Globe, Database, LogOut, Send, CreditCard, Crown } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { supabaseClient } from '../../lib/supabase';

export default function AdminSettings() {
  const { currentUser, logout } = useAuth();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    maintenanceMode: false,
    autoApprovePartners: false,
    allowGuestAccess: true,
    enableAnalytics: true,
    emailNotificationServer: 'smtpout.secureserver.net',
    emailNotificationPort: '465',
    emailNotificationUser: 'info@dogcatify.com',
    globalCommission: '5.0',
    commissionType: 'percentage', // 'percentage', 'fixed', 'subscription'
    fixedCommission: '100',
  });
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [showMercadoPagoModal, setShowMercadoPagoModal] = useState(false);
  const [adminMpConfig, setAdminMpConfig] = useState({
    isConnected: false,
    accessToken: '',
    publicKey: '',
    isTestMode: false,
    accountId: '',
    email: ''
  });
  const [mpLoading, setMpLoading] = useState(false);
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

  useEffect(() => {
    if (currentUser?.email === 'admin@dogcatify.com') {
      loadAdminMpConfig();
      loadCommissionConfig();
      loadSubscriptionSettings();
    }
  }, [currentUser]);

  const loadSubscriptionSettings = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('subscription_settings')
        .select('enabled')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSubscriptionsEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Error loading subscription settings:', error);
    }
  };

  const handleToggleSubscriptions = async (value: boolean) => {
    setLoadingSubscriptions(true);
    try {
      // First get the settings record
      const { data: settingsData, error: fetchError } = await supabaseClient
        .from('subscription_settings')
        .select('id')
        .maybeSingle();

      if (fetchError) throw fetchError;

      // If no settings exist, create one
      if (!settingsData) {
        const { error: insertError } = await supabaseClient
          .from('subscription_settings')
          .insert({
            enabled: value,
            updated_by: currentUser.id
          });

        if (insertError) throw insertError;
      } else {
        // Update existing settings
        const { error: updateError } = await supabaseClient
          .from('subscription_settings')
          .update({
            enabled: value,
            updated_by: currentUser.id
          })
          .eq('id', settingsData.id);

        if (updateError) throw updateError;
      }

      setSubscriptionsEnabled(value);
      Alert.alert(
        'Éxito',
        value
          ? 'Sistema de suscripciones habilitado. Los usuarios ahora pueden ver los planes.'
          : 'Sistema de suscripciones deshabilitado. Ya no será visible para los usuarios.'
      );
    } catch (error) {
      console.error('Error toggling subscriptions:', error);
      Alert.alert('Error', 'No se pudo actualizar la configuración de suscripciones');
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const handleManageSubscriptionPlans = () => {
    router.push('/(admin-tabs)/subscription-plans');
  };

  const loadCommissionConfig = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('admin_settings')
        .select('value')
        .eq('key', 'commission_config')
        .single();
      
      if (data && !error) {
        const config = data.value || {};
        setSettings(prev => ({
          ...prev,
          globalCommission: config.global_commission?.toString() || '5.0',
          commissionType: config.commission_type || 'percentage',
          fixedCommission: config.fixed_commission?.toString() || '100'
        }));
      }
    } catch (error) {
      console.error('Error loading commission config:', error);
    }
  };

  const loadAdminMpConfig = async () => {
    try {
      // Load admin MP configuration from a dedicated table or settings
      const { data, error } = await supabaseClient
        .from('admin_settings')
        .select('*')
        .eq('key', 'mercadopago_config')
        .single();
      
      if (data && !error) {
        const config = data.value || {};
        setAdminMpConfig({
          isConnected: config.is_connected || false,
          accessToken: config.access_token || '',
          publicKey: config.public_key || '',
          isTestMode: config.is_test_mode || false,
          accountId: config.account_id || '',
          email: config.email || ''
        });
      }
    } catch (error) {
      console.error('Error loading admin MP config:', error);
    }
  };

  const validateAdminMpCredentials = async (token: string, key: string) => {
    try {
      const isValidToken = token.startsWith('APP_USR-') || token.startsWith('TEST-');
      const isValidKey = key.startsWith('APP_USR-') || key.startsWith('TEST-');
      
      if (!isValidToken || !isValidKey) {
        throw new Error('Formato de credenciales inválido');
      }

      // Try to validate with Mercado Pago API
      try {
        const response = await fetch('https://api.mercadopago.com/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          return {
            isValid: true,
            accountId: userData.id,
            email: userData.email
          };
        } else {
          return { isValid: isValidToken && isValidKey };
        }
      } catch (apiError) {
        return { isValid: isValidToken && isValidKey };
      }
    } catch (error) {
      return { isValid: false };
    }
  };

  const handleSaveAdminMpConfig = async () => {
    if (!adminMpConfig.accessToken.trim() || !adminMpConfig.publicKey.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setMpLoading(true);
    try {
      const validation = await validateAdminMpCredentials(
        adminMpConfig.accessToken.trim(), 
        adminMpConfig.publicKey.trim()
      );
      
      if (!validation.isValid) {
        Alert.alert(
          'Credenciales inválidas',
          'Las credenciales ingresadas no son válidas. Verifica que sean correctas.'
        );
        setMpLoading(false);
        return;
      }

      const config = {
        is_connected: true,
        access_token: adminMpConfig.accessToken.trim(),
        public_key: adminMpConfig.publicKey.trim(),
        is_test_mode: adminMpConfig.isTestMode,
        account_id: validation.accountId || '',
        email: validation.email || '',
        connected_at: new Date().toISOString(),
      };

      // Save to admin_settings table
      const { error } = await supabaseClient
        .from('admin_settings')
        .upsert({
          key: 'mercadopago_config',
          value: config,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setAdminMpConfig(prev => ({
        ...prev,
        isConnected: true,
        accountId: validation.accountId || '',
        email: validation.email || ''
      }));

      Alert.alert(
        '¡Éxito!',
        'La cuenta de Mercado Pago del administrador ha sido configurada correctamente. Ahora la app puede recibir comisiones automáticamente.',
        [{ text: 'Continuar', onPress: () => setShowMercadoPagoModal(false) }]
      );
    } catch (error) {
      console.error('Error saving admin MP config:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración. Intenta nuevamente.');
    } finally {
      setMpLoading(false);
    }
  };

  const handleDisconnectAdminMp = () => {
    Alert.alert(
      'Desconectar Mercado Pago',
      '¿Estás seguro? Esto deshabilitará la recepción de comisiones en toda la plataforma.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('admin_settings')
                .upsert({
                  key: 'mercadopago_config',
                  value: { is_connected: false },
                  updated_at: new Date().toISOString()
                });

              if (error) throw error;

              setAdminMpConfig(prev => ({
                ...prev,
                isConnected: false,
                accessToken: '',
                publicKey: '',
                accountId: '',
                email: ''
              }));

              Alert.alert('Desconectado', 'La cuenta de Mercado Pago ha sido desconectada.');
            } catch (error) {
              Alert.alert('Error', 'No se pudo desconectar la cuenta.');
            }
          },
        },
      ]
    );
  };

  // Función para enviar un correo de prueba directamente
  const sendTestEmail = async (email: string): Promise<{success: boolean, error?: string}> => {
    try {
      // Construir la URL de la función de Supabase
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
      const apiUrl = `${supabaseUrl}/functions/v1/send-email`;
      
      // Preparar los datos del correo
      const emailData = {
        to: email,
        subject: 'Prueba de configuración SMTP - DogCatiFy',
        text: 'Este es un correo de prueba para verificar la configuración SMTP de DogCatiFy.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Prueba de Correo</h1>
            </div>
            <div style="padding: 20px; background-color: #f9f9f9;">
              <p>Este es un correo de prueba para verificar la configuración SMTP de DogCatiFy.</p>
              <p>Si estás recibiendo este correo, significa que la configuración SMTP está funcionando correctamente.</p>
              <p>Fecha y hora de envío: ${new Date().toLocaleString()}</p>
            </div>
            <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
              <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
            </div>
          </div>
        `
      };
      
      // Realizar la petición a la función de Supabase
      console.log('Enviando solicitud a:', apiUrl);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
         'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(emailData),
      });
      
      // Procesar la respuesta
      const result = await response.json();
      console.log('Respuesta del servidor:', result);
      
      if (response.ok) {
        return { success: true, messageId: result.messageId };
      } else {
        return { success: false, error: result.error || 'Error desconocido' };
      }
    } catch (error) {
      console.error('Error enviando email de prueba:', error);
      return { success: false, error: error.message || 'Error desconocido' };
    }
  };
  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Here you would typically save to Firebase
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          }
        }
      ]
    );
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      Alert.alert('Error', 'Por favor ingresa un correo electrónico');
      return;
    }
    
    setTestEmailLoading(true);
    try {
      console.log('Sending test email to:', testEmail);
      // Llamar a la función de prueba
      const result = await sendTestEmail(testEmail);
      
      if (result.success) {
        Alert.alert(
          'Correo de prueba enviado',
          `Se ha enviado un correo de prueba a ${testEmail}. Por favor verifica tu bandeja de entrada.`
        );
        setTestEmail('');
        setShowEmailModal(false);
      } else {
        Alert.alert(
          'Error al enviar correo',
          `No se pudo enviar el correo de prueba: ${result.error}`
        );
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar el correo de prueba');
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleCommissionChange = (value: string) => {
    // Validate that it's a valid number
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setSettings(prev => ({ ...prev, globalCommission: value }));
    }
  };

  const handleCommissionTypeChange = (type: string) => {
    setSettings(prev => ({ ...prev, commissionType: type }));
  };

  const handleFixedCommissionChange = (value: string) => {
    // Validate that it's a valid number
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setSettings(prev => ({ ...prev, fixedCommission: value }));
    }
  };

  const handleSaveCommissionConfig = async () => {
    try {
      const configData = {
        global_commission: parseFloat(settings.globalCommission),
        commission_type: settings.commissionType,
        fixed_commission: parseFloat(settings.fixedCommission),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabaseClient
        .from('admin_settings')
        .upsert({
          key: 'commission_config',
          value: configData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      Alert.alert('Éxito', 'Configuración de comisiones guardada correctamente');
    } catch (error) {
      console.error('Error saving commission config:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración de comisiones');
    }
  };

  const handleBackupData = () => {
    Alert.alert(
      'Respaldo de Datos',
      'Se iniciará el proceso de respaldo de la base de datos. Esto puede tomar varios minutos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar Respaldo',
          onPress: () => {
            // Implement backup logic
            Alert.alert('Respaldo Iniciado', 'El respaldo se está procesando en segundo plano.');
          }
        }
      ]
    );
  };

  const handleSystemMaintenance = () => {
    Alert.alert(
      'Modo Mantenimiento',
      settings.maintenanceMode 
        ? 'Se desactivará el modo mantenimiento y los usuarios podrán acceder normalmente.'
        : 'Se activará el modo mantenimiento y los usuarios no podrán acceder a la aplicación.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: settings.maintenanceMode ? 'Desactivar' : 'Activar',
          style: settings.maintenanceMode ? 'default' : 'destructive',
          onPress: () => {
            handleSettingChange('maintenanceMode', !settings.maintenanceMode);
            Alert.alert(
              'Modo Mantenimiento',
              `Modo mantenimiento ${!settings.maintenanceMode ? 'activado' : 'desactivado'} correctamente.`
            );
          }
        }
      ]
    );
  };

  const isAdmin = currentUser?.email?.toLowerCase() === 'admin@dogcatify.com';
  
  console.log('Current user email:', currentUser?.email);
  console.log('Is admin check result:', isAdmin);
  
  if (!currentUser || !isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedTitle}>Acceso Denegado</Text>
          <Text style={styles.accessDeniedText}>
            No tienes permisos para acceder a esta sección
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>⚙️ Configuración del Sistema</Text>
          <Text style={styles.subtitle}>Administración y configuraciones globales</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Notificaciones</Text>
          
          <Card style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Mail size={20} color="#DC2626" />
                <Text style={styles.settingLabel}>Notificaciones por Email</Text>
              </View>
              <Switch
                value={settings.emailNotifications}
                onValueChange={(value) => handleSettingChange('emailNotifications', value)}
                trackColor={{ false: '#E5E7EB', true: '#DC2626' }}
                thumbColor={settings.emailNotifications ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
            
            {settings.emailNotifications && (
              <TouchableOpacity 
                style={styles.emailConfigButton}
                onPress={() => setShowEmailModal(true)}
              >
                <Send size={16} color="#DC2626" />
                <Text style={styles.emailConfigText}>Configurar servidor SMTP</Text>
              </TouchableOpacity>
            )}

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Bell size={20} color="#6B7280" />
                <Text style={styles.settingLabel}>Notificaciones Push</Text>
              </View>
              <Switch
                value={settings.pushNotifications}
                onValueChange={(value) => handleSettingChange('pushNotifications', value)}
                trackColor={{ false: '#E5E7EB', true: '#DC2626' }}
                thumbColor={settings.pushNotifications ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
          </Card>
        </View>

        {/* System Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🖥️ Sistema</Text>
          
          <Card style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Shield size={20} color="#6B7280" />
                <Text style={styles.settingLabel}>Modo Mantenimiento</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.maintenanceButton,
                  { backgroundColor: settings.maintenanceMode ? '#FEE2E2' : '#F3F4F6' }
                ]}
                onPress={handleSystemMaintenance}
              >
                <Text style={[
                  styles.maintenanceButtonText,
                  { color: settings.maintenanceMode ? '#991B1B' : '#6B7280' }
                ]}>
                  {settings.maintenanceMode ? 'Activo' : 'Inactivo'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Globe size={20} color="#6B7280" />
                <Text style={styles.settingLabel}>Acceso de Invitados</Text>
              </View>
              <Switch
                value={settings.allowGuestAccess}
                onValueChange={(value) => handleSettingChange('allowGuestAccess', value)}
                trackColor={{ false: '#E5E7EB', true: '#DC2626' }}
                thumbColor={settings.allowGuestAccess ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Database size={20} color="#6B7280" />
                <Text style={styles.settingLabel}>Analíticas Avanzadas</Text>
              </View>
              <Switch
                value={settings.enableAnalytics}
                onValueChange={(value) => handleSettingChange('enableAnalytics', value)}
                trackColor={{ false: '#E5E7EB', true: '#DC2626' }}
                thumbColor={settings.enableAnalytics ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
          </Card>
        </View>

        {/* Partners Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤝 Gestión de Aliados</Text>
          
          <Card style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Shield size={20} color="#6B7280" />
                <Text style={styles.settingLabel}>Auto-aprobar Aliados</Text>
              </View>
              <Switch
                value={settings.autoApprovePartners}
                onValueChange={(value) => handleSettingChange('autoApprovePartners', value)}
                trackColor={{ false: '#E5E7EB', true: '#DC2626' }}
                thumbColor={settings.autoApprovePartners ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 Configuración de Pagos</Text>
          
          <Card style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <CreditCard size={20} color="#00A650" />
                <Text style={styles.settingLabel}>Cuenta Mercado Pago Admin</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.mpStatusButton,
                  { backgroundColor: adminMpConfig.isConnected ? '#D1FAE5' : '#FEE2E2' }
                ]}
                onPress={() => setShowMercadoPagoModal(true)}
              >
                <Text style={[
                  styles.mpStatusText,
                  { color: adminMpConfig.isConnected ? '#065F46' : '#991B1B' }
                ]}>
                  {adminMpConfig.isConnected ? 'Conectado' : 'Desconectado'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {adminMpConfig.isConnected && (
              <View style={styles.mpConnectedInfo}>
                <Text style={styles.mpConnectedText}>
                  ✅ Cuenta: {adminMpConfig.email || 'Configurada'}
                </Text>
                <Text style={styles.mpConnectedText}>
                  🏦 ID: {adminMpConfig.accountId || 'N/A'}
                </Text>
                <Text style={styles.mpConnectedText}>
                  🧪 Modo: {adminMpConfig.isTestMode ? 'Prueba' : 'Producción'}
                </Text>
              </View>
            )}
          </Card>
        </View>

        <Text style={styles.sectionTitle}>💰 Configuración de Comisiones</Text>
        
        <Card style={styles.commissionCard}>
          <View style={styles.commissionHeader}>
            <View style={styles.commissionTitleContainer}>
              <DollarSign size={24} color="#10B981" style={styles.commissionIcon} />
              <View>
                <Text style={styles.commissionTitle}>Comisión Global</Text>
                <Text style={styles.commissionDescription}>
                  Comisión base para todos los aliados
                </Text>
              </View>
            </View>
            
            <View style={styles.commissionInputContainer}>
              <Input
                placeholder="5.0"
                value={settings.globalCommission}
                onChangeText={handleCommissionChange}
                keyboardType="numeric"
                style={styles.commissionInput}
              />
              <Text style={styles.percentSymbol}>%</Text>
            </View>
          </View>
          
          <Text style={styles.commissionTypesTitle}>Tipos de Comisión</Text>
          
          <TouchableOpacity 
            style={[
              styles.commissionOption, 
              settings.commissionType === 'percentage' && styles.commissionOptionSelected
            ]}
            onPress={() => handleCommissionTypeChange('percentage')}
          >
            <DollarSign size={20} color={settings.commissionType === 'percentage' ? "#3B82F6" : "#6B7280"} />
            <Text style={styles.commissionOptionText}>Porcentaje del valor de la transacción</Text>
            <Text style={styles.commissionOptionValue}>{settings.globalCommission}%</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.commissionOption, 
              settings.commissionType === 'fixed' && styles.commissionOptionSelected
            ]}
            onPress={() => handleCommissionTypeChange('fixed')}
          >
            <DollarSign size={20} color={settings.commissionType === 'fixed' ? "#3B82F6" : "#6B7280"} />
            <Text style={styles.commissionOptionText}>Monto fijo por transacción</Text>
            <View style={styles.fixedCommissionContainer}>
              <Text style={styles.fixedCommissionPrefix}>$</Text>
              <Input
                value={settings.fixedCommission}
                onChangeText={handleFixedCommissionChange}
                keyboardType="numeric"
                style={styles.fixedCommissionInput}
              />
            </View>
          </TouchableOpacity>
          
          <Button
            title="Guardar Configuración"
            onPress={handleSaveCommissionConfig}
            variant="primary"
            size="large"
            style={styles.saveButton}
          />
        </Card>

        {/* Subscriptions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👑 Sistema de Suscripciones Premium</Text>

          <Card style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionTitleContainer}>
                <Crown size={24} color="#F59E0B" style={styles.subscriptionIcon} />
                <View>
                  <Text style={styles.subscriptionTitle}>Membresías Premium</Text>
                  <Text style={styles.subscriptionDescription}>
                    Permite a los usuarios acceder a funciones premium mediante suscripciones
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.subscriptionToggleContainer}>
              <View style={styles.subscriptionToggleInfo}>
                <Text style={styles.subscriptionToggleLabel}>Habilitar Suscripciones</Text>
                <Text style={styles.subscriptionToggleDescription}>
                  {subscriptionsEnabled
                    ? 'Los usuarios pueden ver y gestionar suscripciones desde su perfil'
                    : 'El sistema de suscripciones está oculto para los usuarios'}
                </Text>
              </View>
              <Switch
                value={subscriptionsEnabled}
                onValueChange={handleToggleSubscriptions}
                disabled={loadingSubscriptions}
                trackColor={{ false: '#E5E7EB', true: '#F59E0B' }}
                thumbColor={subscriptionsEnabled ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>

            {subscriptionsEnabled && (
              <View style={styles.subscriptionStatusContainer}>
                <View style={styles.subscriptionStatusBadge}>
                  <Text style={styles.subscriptionStatusText}>✅ Sistema Activo</Text>
                </View>
                <Text style={styles.subscriptionStatusInfo}>
                  Los usuarios pueden ver los planes de suscripción desde su perfil y gestionar su membresía a través del CRM integrado.
                </Text>
              </View>
            )}

            <View style={styles.subscriptionActionsContainer}>
              <Button
                title="Gestionar Planes de Suscripción"
                onPress={handleManageSubscriptionPlans}
                variant="outline"
                size="medium"
                style={styles.manageSubscriptionPlansButton}
              />

              <View style={styles.subscriptionInfoBox}>
                <Text style={styles.subscriptionInfoTitle}>ℹ️ Información</Text>
                <Text style={styles.subscriptionInfoText}>
                  • Los planes se gestionan desde el CRM{'\n'}
                  • Los usuarios verán los planes configurados aquí{'\n'}
                  • Los pagos se procesan mediante el CRM{'\n'}
                  • Las suscripciones se sincronizan automáticamente
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Gestión de Datos</Text>
          
          <Card style={styles.dataCard}>
            <TouchableOpacity style={styles.dataAction} onPress={handleBackupData}>
              <Database size={20} color="#3B82F6" />
              <Text style={styles.dataActionText}>Respaldar Base de Datos</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Admin Actions */}
        <Text style={styles.sectionTitle}>👤 Cuenta de Administrador</Text>
          
        <Card style={styles.adminCard}>  
          <View style={styles.adminInfo}>
            <Text style={styles.adminEmail}>{currentUser?.email}</Text>
            <Text style={styles.adminRole}>Administrador de DogCatiFy</Text>
          </View>
          
          <Button
            title="Cerrar Sesión"
            onPress={handleLogout}
            variant="primary"
            size="large"
            style={styles.logoutButton}
          />
        </Card>
      </ScrollView>
      
      {/* Email Configuration Modal */}
      <Modal
        visible={showEmailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configuración de Correo</Text>
            
            <Input
              label="Servidor SMTP"
              placeholder="smtp.example.com"
              value="smtpout.secureserver.net"
              onChangeText={(value) => setSettings(prev => ({ ...prev, emailNotificationServer: value }))}
            />
            
            <Input
              label="Puerto"
              placeholder="587"
              value="465"
              onChangeText={(value) => setSettings(prev => ({ ...prev, emailNotificationPort: value }))}
              keyboardType="numeric"
            />
            
            <Input
              label="Usuario"
              placeholder="notifications@example.com"
              value="info@dogcatify.com"
              onChangeText={(value) => setSettings(prev => ({ ...prev, emailNotificationUser: value }))}
              keyboardType="email-address"
            />
            
            <Input
              label="Contraseña"
              placeholder="••••••••"
              secureTextEntry
            />
            
            <View style={styles.emailTestSection}>
              <Text style={styles.emailTestTitle}>Enviar correo de prueba</Text>
              <Input
                label="Correo de destino"
                placeholder="usuario@example.com"
                value={testEmail}
                onChangeText={setTestEmail}
                keyboardType="email-address"
              />
              <Button
                title="Enviar prueba"
                onPress={handleSendTestEmail}
                variant="primary"
                loading={testEmailLoading}
                size="medium"
              />
            </View>
            
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={() => setShowEmailModal(false)}
                variant="outline"
                size="medium"
              />
              <Button
                title="Guardar"
                onPress={() => {
                  Alert.alert('Configuración guardada', 'La configuración de correo ha sido guardada correctamente');
                  setShowEmailModal(false);
                }}
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Mercado Pago Configuration Modal */}
      <Modal
        visible={showMercadoPagoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMercadoPagoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {adminMpConfig.isConnected ? 'Gestionar Mercado Pago' : 'Configurar Mercado Pago Admin'}
              </Text>
              <TouchableOpacity onPress={() => setShowMercadoPagoModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {adminMpConfig.isConnected ? (
              <View style={styles.mpConnectedSection}>
                <View style={styles.mpConnectedHeader}>
                  <Text style={styles.mpConnectedTitle}>✅ Cuenta Conectada</Text>
                </View>
                
                <View style={styles.mpAccountInfo}>
                  <Text style={styles.mpAccountLabel}>Email:</Text>
                  <Text style={styles.mpAccountValue}>{adminMpConfig.email || 'No disponible'}</Text>
                </View>
                
                <View style={styles.mpAccountInfo}>
                  <Text style={styles.mpAccountLabel}>ID de cuenta:</Text>
                  <Text style={styles.mpAccountValue}>{adminMpConfig.accountId || 'No disponible'}</Text>
                </View>
                
                <View style={styles.mpAccountInfo}>
                  <Text style={styles.mpAccountLabel}>Modo:</Text>
                  <Text style={styles.mpAccountValue}>
                    {adminMpConfig.isTestMode ? '🧪 Prueba' : '🚀 Producción'}
                  </Text>
                </View>
                
                <View style={styles.mpWarning}>
                  <Text style={styles.mpWarningText}>
                    ⚠️ Esta es la cuenta principal donde se reciben todas las comisiones de la plataforma.
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.mpDisconnectButton}
                  onPress={handleDisconnectAdminMp}
                >
                  <Text style={styles.mpDisconnectText}>Desconectar Cuenta</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mpConfigSection}>
                <View style={styles.mpInfoSection}>
                  <Text style={styles.mpInfoTitle}>🏦 Cuenta Principal de Comisiones</Text>
                  <Text style={styles.mpInfoText}>
                    Esta cuenta recibirá automáticamente las comisiones de todas las ventas realizadas en la plataforma.
                  </Text>
                </View>
                
                <View style={styles.mpHelpSection}>
                  <Text style={styles.mpHelpTitle}>💡 ¿Cómo obtener las credenciales?</Text>
                  <Text style={styles.mpHelpStep}>1. Ve a developers.mercadopago.com</Text>
                  <Text style={styles.mpHelpStep}>2. Inicia sesión con la cuenta admin de MP</Text>
                  <Text style={styles.mpHelpStep}>3. Ve a "Tus integraciones" → "Credenciales"</Text>
                  <Text style={styles.mpHelpStep}>4. Copia el Access Token y Public Key</Text>
                </View>

                <Input
                  label="Access Token *"
                  placeholder="APP_USR-xxxxxxxx o TEST-xxxxxxxx"
                  value={adminMpConfig.accessToken}
                  onChangeText={(value) => setAdminMpConfig(prev => ({ ...prev, accessToken: value }))}
                />

                <Input
                  label="Public Key *"
                  placeholder="APP_USR-xxxxxxxx o TEST-xxxxxxxx"
                  value={adminMpConfig.publicKey}
                  onChangeText={(value) => setAdminMpConfig(prev => ({ ...prev, publicKey: value }))}
                />

                <View style={styles.mpTestModeSection}>
                  <View style={styles.mpTestModeHeader}>
                    <Text style={styles.mpTestModeTitle}>Modo de prueba</Text>
                    <Switch
                      value={adminMpConfig.isTestMode}
                      onValueChange={(value) => setAdminMpConfig(prev => ({ ...prev, isTestMode: value }))}
                      trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                      thumbColor={adminMpConfig.isTestMode ? '#FFFFFF' : '#FFFFFF'}
                    />
                  </View>
                  <Text style={styles.mpTestModeDescription}>
                    {adminMpConfig.isTestMode 
                      ? '🧪 Modo prueba activo - Usa credenciales TEST-' 
                      : '🚀 Modo producción - Usa credenciales APP_USR- reales'
                    }
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[styles.mpSaveButton, mpLoading && styles.mpSaveButtonDisabled]} 
                  onPress={handleSaveAdminMpConfig}
                  disabled={mpLoading}
                >
                  <Text style={styles.mpSaveButtonText}>
                    {mpLoading ? 'Validando...' : 'Conectar Cuenta Admin'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={showMercadoPagoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMercadoPagoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {adminMpConfig.isConnected ? 'Gestionar Mercado Pago' : 'Configurar Mercado Pago Admin'}
              </Text>
              <TouchableOpacity onPress={() => setShowMercadoPagoModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {adminMpConfig.isConnected ? (
              <View style={styles.mpConnectedSection}>
                <View style={styles.mpConnectedHeader}>
                  <Text style={styles.mpConnectedTitle}>✅ Cuenta Conectada</Text>
                </View>
                
                <View style={styles.mpAccountInfo}>
                  <Text style={styles.mpAccountLabel}>Email:</Text>
                  <Text style={styles.mpAccountValue}>{adminMpConfig.email || 'No disponible'}</Text>
                </View>
                
                <View style={styles.mpAccountInfo}>
                  <Text style={styles.mpAccountLabel}>ID de cuenta:</Text>
                  <Text style={styles.mpAccountValue}>{adminMpConfig.accountId || 'No disponible'}</Text>
                </View>
                
                <View style={styles.mpAccountInfo}>
                  <Text style={styles.mpAccountLabel}>Modo:</Text>
                  <Text style={styles.mpAccountValue}>
                    {adminMpConfig.isTestMode ? '🧪 Prueba' : '🚀 Producción'}
                  </Text>
                </View>
                
                <View style={styles.mpWarning}>
                  <Text style={styles.mpWarningText}>
                    ⚠️ Esta es la cuenta principal donde se reciben todas las comisiones de la plataforma.
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.mpDisconnectButton}
                  onPress={handleDisconnectAdminMp}
                >
                  <Text style={styles.mpDisconnectText}>Desconectar Cuenta</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mpConfigSection}>
                <View style={styles.mpInfoSection}>
                  <Text style={styles.mpInfoTitle}>🏦 Cuenta Principal de Comisiones</Text>
                  <Text style={styles.mpInfoText}>
                    Esta cuenta recibirá automáticamente las comisiones de todas las ventas realizadas en la plataforma.
                  </Text>
                </View>
                
                <View style={styles.mpHelpSection}>
                  <Text style={styles.mpHelpTitle}>💡 ¿Cómo obtener las credenciales?</Text>
                  <Text style={styles.mpHelpStep}>1. Ve a developers.mercadopago.com</Text>
                  <Text style={styles.mpHelpStep}>2. Inicia sesión con la cuenta admin de MP</Text>
                  <Text style={styles.mpHelpStep}>3. Ve a "Tus integraciones" → "Credenciales"</Text>
                  <Text style={styles.mpHelpStep}>4. Copia el Access Token y Public Key</Text>
                </View>

                <Input
                  label="Access Token *"
                  placeholder="APP_USR-xxxxxxxx o TEST-xxxxxxxx"
                  value={adminMpConfig.accessToken}
                  onChangeText={(value) => setAdminMpConfig(prev => ({ ...prev, accessToken: value }))}
                />

                <Input
                  label="Public Key *"
                  placeholder="APP_USR-xxxxxxxx o TEST-xxxxxxxx"
                  value={adminMpConfig.publicKey}
                  onChangeText={(value) => setAdminMpConfig(prev => ({ ...prev, publicKey: value }))}
                />

                <View style={styles.mpTestModeSection}>
                  <View style={styles.mpTestModeHeader}>
                    <Text style={styles.mpTestModeTitle}>Modo de prueba</Text>
                    <Switch
                      value={adminMpConfig.isTestMode}
                      onValueChange={(value) => setAdminMpConfig(prev => ({ ...prev, isTestMode: value }))}
                      trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                      thumbColor={adminMpConfig.isTestMode ? '#FFFFFF' : '#FFFFFF'}
                    />
                  </View>
                  <Text style={styles.mpTestModeDescription}>
                    {adminMpConfig.isTestMode 
                      ? '🧪 Modo prueba activo - Usa credenciales TEST-' 
                      : '🚀 Modo producción - Usa credenciales APP_USR- reales'
                    }
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[styles.mpSaveButton, mpLoading && styles.mpSaveButtonDisabled]} 
                  onPress={handleSaveAdminMpConfig}
                  disabled={mpLoading}
                >
                  <Text style={styles.mpSaveButtonText}>
                    {mpLoading ? 'Validando...' : 'Conectar Cuenta Admin'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 24,
  },
  settingsCard: {
    marginHorizontal: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 12,
  },
  maintenanceButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  maintenanceButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  commissionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  commissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  commissionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commissionIcon: {
    marginRight: 12,
  },
  commissionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  commissionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  commissionInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commissionInput: {
    width: 60,
    textAlign: 'center',
    marginRight: 0,
    paddingRight: 0,
  },
  percentSymbol: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
    marginLeft: 4,
  },
  commissionTypesTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  commissionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  commissionOptionSelected: {
    backgroundColor: '#EBF8FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  commissionOptionText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  commissionOptionValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
  },
  fixedCommissionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fixedCommissionPrefix: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
    marginRight: 4,
  },
  fixedCommissionInput: {
    width: 60,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 16,
  },
  subscriptionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  subscriptionHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  subscriptionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionIcon: {
    marginRight: 12,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  subscriptionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  subscriptionToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  subscriptionToggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  subscriptionToggleLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  subscriptionToggleDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  subscriptionStatusContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  subscriptionStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  subscriptionStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  subscriptionStatusInfo: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#065F46',
    lineHeight: 18,
  },
  subscriptionActionsContainer: {
    marginTop: 8,
  },
  manageSubscriptionPlansButton: {
    marginBottom: 16,
  },
  subscriptionInfoBox: {
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  subscriptionInfoTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 8,
  },
  subscriptionInfoText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 20,
  },
  dataCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  dataAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dataActionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 12,
  },
  adminCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
  },
  adminInfo: {
    marginBottom: 16,
  },
  logoutButton: {
    marginTop: 8,
  },
  adminEmail: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  adminRole: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 16,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  emailConfigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
    marginLeft: 40,
  },
  emailConfigText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalScrollContainer: {
    flex: 1,
    marginTop: 60,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  emailTestSection: {
    marginTop: 20,
    marginBottom: 20,
   padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  emailTestTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  mpStatusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  mpStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  mpConnectedInfo: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  mpConnectedText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 4,
  },
  mpConnectedSection: {
    padding: 16,
  },
  mpConnectedHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mpConnectedTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  mpAccountInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  mpAccountLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  mpAccountValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  mpWarning: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
  },
  mpWarningText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
    textAlign: 'center',
  },
  mpConfigSection: {
    paddingVertical: 8,
  },
  mpInfoSection: {
    backgroundColor: '#EBF8FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  mpInfoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#1E40AF',
    marginBottom: 8,
  },
  mpInfoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 20,
  },
  mpHelpSection: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  mpHelpTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0369A1',
    marginBottom: 12,
  },
  mpHelpStep: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0369A1',
    marginBottom: 4,
    paddingLeft: 8,
  },
  mpTestModeSection: {
    marginBottom: 20,
  },
  mpTestModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mpTestModeTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  mpTestModeDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 16,
  },
});