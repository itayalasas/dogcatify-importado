import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Switch, Alert, Modal, ActivityIndicator } from 'react-native';
import { Bell, Shield, Globe, Database, LogOut, CreditCard, Crown } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '../../components/ui/Input';
import { supabaseClient } from '../../lib/supabase';
import { envConfig } from '../../utils/envConfig';

const SYSTEM_CONFIG_KEY = 'system_config';
type SystemToggleKey =
  | 'pushNotifications'
  | 'maintenanceMode'
  | 'autoApprovePartners'
  | 'allowGuestAccess'
  | 'enableAnalytics';

export default function AdminSettings() {
  const { currentUser, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState({
    pushNotifications: true,
    maintenanceMode: false,
    autoApprovePartners: false,
    allowGuestAccess: true,
    enableAnalytics: true,
    emailNotificationServer: 'smtpout.secureserver.net',
    emailNotificationPort: '465',
    emailNotificationUser: 'info@dogcatify.com',
  });
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showMercadoPagoModal, setShowMercadoPagoModal] = useState(false);
  const [adminMpConfig, setAdminMpConfig] = useState({
    isConnected: false,
    accessToken: '',
    publicKey: '',
    clientId: envConfig.get('EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID') || '',
    isTestMode: false,
    accountId: '',
    email: ''
  });
  const [mpLoading, setMpLoading] = useState(false);
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState({ sent: 0, total: 0 });
  const [batchSize, setBatchSize] = useState('20');
  const [savingSystemSetting, setSavingSystemSetting] = useState<SystemToggleKey | null>(null);
  const isAdmin = currentUser?.isAdmin === true;

  useEffect(() => {
    if (isAdmin) {
      loadSystemSettings();
      loadAdminMpConfig();
      loadSubscriptionSettings();
    }
  }, [isAdmin]);

  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('admin_settings')
        .select('value')
        .eq('key', SYSTEM_CONFIG_KEY)
        .maybeSingle();

      if (error) throw error;

      const config = data?.value || {};
      setSettings((prev) => ({
        ...prev,
        pushNotifications: config.push_notifications_enabled ?? prev.pushNotifications,
        maintenanceMode: config.maintenance_mode ?? prev.maintenanceMode,
        autoApprovePartners: config.auto_approve_partners ?? prev.autoApprovePartners,
        allowGuestAccess: config.allow_guest_access ?? prev.allowGuestAccess,
        enableAnalytics: config.advanced_analytics_enabled ?? prev.enableAnalytics,
      }));
    } catch (error) {
    }
  };

  const saveSystemSettings = async (nextSettings: typeof settings) => {
    const systemConfig = {
      push_notifications_enabled: nextSettings.pushNotifications,
      maintenance_mode: nextSettings.maintenanceMode,
      auto_approve_partners: nextSettings.autoApprovePartners,
      allow_guest_access: nextSettings.allowGuestAccess,
      advanced_analytics_enabled: nextSettings.enableAnalytics,
      updated_by: currentUser?.id || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseClient
      .from('admin_settings')
      .upsert({
        key: SYSTEM_CONFIG_KEY,
        value: systemConfig,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      });

    if (error) throw error;
  };

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
            updated_by: currentUser?.id || null
          });

        if (insertError) throw insertError;
      } else {
        // Update existing settings
        const { error: updateError } = await supabaseClient
          .from('subscription_settings')
          .update({
            enabled: value,
            updated_by: currentUser?.id || null
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
      Alert.alert('Error', 'No se pudo actualizar la configuración de suscripciones');
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const handleManageSubscriptionPlans = () => {
    router.push('/(admin-tabs)/subscription-plans');
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
          clientId: config.client_id || config.clientId || config.app_id || config.oauth_client_id || envConfig.get('EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID') || '',
          isTestMode: config.is_test_mode || false,
          accountId: config.account_id || '',
          email: config.email || ''
        });
      }
    } catch (error) {
    }
  };

  const getMpCredentialMode = (credential: string) => {
    const value = credential.trim();
    if (value.startsWith('TEST-')) return 'test';
    if (value.startsWith('APP_USR-')) return 'production';
    return null;
  };

  const validateAdminMpCredentials = async (token: string, key: string, isTestMode: boolean) => {
    try {
      const tokenMode = getMpCredentialMode(token);
      const keyMode = getMpCredentialMode(key);
      const expectedMode = isTestMode ? 'test' : 'production';

      if (!tokenMode || !keyMode) {
        throw new Error('Formato de credenciales invalido');
      }

      if (tokenMode !== expectedMode || keyMode !== expectedMode) {
        return {
          isValid: false,
          error: isTestMode
            ? 'Modo prueba requiere Access Token y Public Key que empiecen con TEST-.'
            : 'Modo produccion requiere Access Token y Public Key que empiecen con APP_USR-.',
        };
      }

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
            email: userData.email,
            credentialMode: tokenMode,
          };
        }

        return {
          isValid: false,
          error: 'Mercado Pago no pudo validar el Access Token. Verifica que no este vencido o copiado incompleto.',
        };
      } catch (apiError) {
        return {
          isValid: false,
          error: 'No se pudo validar el token contra Mercado Pago. Revisa la conexion e intenta nuevamente.',
        };
      }
    } catch (error) {
      return { isValid: false, error: 'Formato de credenciales invalido.' };
    }
  };

  const handleSaveAdminMpConfig = async () => {
    if (!adminMpConfig.accessToken.trim() || !adminMpConfig.publicKey.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setMpLoading(true);
    try {
      const { data: currentConfigData } = await supabaseClient
        .from('admin_settings')
        .select('value')
        .eq('key', 'mercadopago_config')
        .maybeSingle();

      const currentConfig = currentConfigData?.value || {};
      const {
        client_secret: _legacyClientSecret,
        clientSecret: _legacyClientSecretCamel,
        ...safeCurrentConfig
      } = currentConfig;
      const currentClientId =
        safeCurrentConfig.client_id ||
        safeCurrentConfig.clientId ||
        envConfig.get('EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID') ||
        '';

      const validation = await validateAdminMpCredentials(
        adminMpConfig.accessToken.trim(), 
        adminMpConfig.publicKey.trim(),
        adminMpConfig.isTestMode
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
        ...safeCurrentConfig,
        is_connected: true,
        access_token: adminMpConfig.accessToken.trim(),
        public_key: adminMpConfig.publicKey.trim(),
        client_id: adminMpConfig.clientId.trim() || currentClientId,
        is_test_mode: adminMpConfig.isTestMode,
        credential_mode: validation.credentialMode || (adminMpConfig.isTestMode ? 'test' : 'production'),
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
        }, {
          onConflict: 'key'
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
        'La configuración legacy de Mercado Pago quedó guardada correctamente.',
        [{ text: 'Continuar', onPress: () => setShowMercadoPagoModal(false) }]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la configuración. Intenta nuevamente.');
    } finally {
      setMpLoading(false);
    }
  };

  const handleSaveMercadoPagoClientId = async () => {
    const clientId = adminMpConfig.clientId.trim();

    if (!clientId) {
      Alert.alert('Error', 'Por favor completa el Client ID / N° de aplicación');
      return;
    }

    setMpLoading(true);
    try {
      const { data: currentConfigData } = await supabaseClient
        .from('admin_settings')
        .select('value')
        .eq('key', 'mercadopago_config')
        .maybeSingle();

      const currentConfig = currentConfigData?.value || {};
      const {
        client_secret: _legacyClientSecret,
        clientSecret: _legacyClientSecretCamel,
        ...safeCurrentConfig
      } = currentConfig;

      const config = {
        ...safeCurrentConfig,
        client_id: clientId,
        app_id: clientId,
        oauth_client_id: clientId,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('admin_settings')
        .upsert({
          key: 'mercadopago_config',
          value: config,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      setAdminMpConfig(prev => ({
        ...prev,
        clientId,
      }));

      Alert.alert('¡Éxito!', 'El Client ID quedó guardado correctamente.');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el Client ID.');
    } finally {
      setMpLoading(false);
    }
  };

  const handleDisconnectAdminMp = () => {
    Alert.alert(
      'Desconectar Mercado Pago',
      '¿Estás seguro? Esto deshabilitará la configuración legacy de Mercado Pago.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: currentConfigData } = await supabaseClient
                .from('admin_settings')
                .select('value')
                .eq('key', 'mercadopago_config')
                .maybeSingle();

              const currentConfig = currentConfigData?.value || {};
              const {
                client_secret: _legacyClientSecret,
                clientSecret: _legacyClientSecretCamel,
                ...safeCurrentConfig
              } = currentConfig;

              const { error } = await supabaseClient
                .from('admin_settings')
                .upsert({
                  key: 'mercadopago_config',
                  value: {
                    ...safeCurrentConfig,
                    is_connected: false,
                    access_token: null,
                    public_key: null,
                    account_id: '',
                    email: '',
                    is_test_mode: false,
                  },
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'key'
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
  const sendTestEmail = async (email: string): Promise<{success: boolean, error?: string, messageId?: string}> => {
    try {
      // Construir la URL de la función de Supabase
      const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
      const supabaseAnonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY') || 'your-anon-key';
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
      
      if (response.ok) {
        return { success: true, messageId: result.messageId };
      } else {
        return { success: false, error: result.error || 'Error desconocido' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  };
  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Here you would typically save to Firebase
  };

  const handleSystemSettingChange = async (key: SystemToggleKey, value: boolean) => {
    const previousSettings = settings;
    const nextSettings = { ...previousSettings, [key]: value };

    setSettings(nextSettings);
    setSavingSystemSetting(key);

    try {
      await saveSystemSettings(nextSettings);
    } catch (error) {
      setSettings(previousSettings);
      Alert.alert('Error', 'No se pudo guardar la configuración. Intenta nuevamente.');
      throw error;
    } finally {
      setSavingSystemSetting(null);
    }
  };

  const performLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error: any) {
      setIsLoggingOut(false);
      Alert.alert('Error', error?.message || 'No se pudo cerrar sesion. Intenta nuevamente.');
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: performLogout
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
          onPress: async () => {
            try {
              await handleSystemSettingChange('maintenanceMode', !settings.maintenanceMode);
              Alert.alert(
                'Modo Mantenimiento',
                `Modo mantenimiento ${!settings.maintenanceMode ? 'activado' : 'desactivado'} correctamente.`
              );
            } catch (error) {
              // El aviso ya se muestra dentro del guardado.
            }
          }
        }
      ]
    );
  };

  const handleBroadcastNotification = async () => {
    if (!settings.pushNotifications) {
      Alert.alert(
        'Notificaciones push desactivadas',
        'Activa primero las notificaciones push del sistema para poder programar envíos masivos.'
      );
      return;
    }

    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      Alert.alert('Error', 'Por favor completa el título y el mensaje');
      return;
    }

    const batchSizeNum = parseInt(batchSize);
    if (isNaN(batchSizeNum) || batchSizeNum < 1 || batchSizeNum > 100) {
      Alert.alert('Error', 'El tamaño del lote debe ser un número entre 1 y 100');
      return;
    }

    setBroadcastLoading(true);
    setBroadcastProgress({ sent: 0, total: 0 });

    try {
      const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('id, fcm_token')
        .not('fcm_token', 'is', null);

      if (error) throw error;

      const usersWithTokens = users.filter(u => u.fcm_token);
      const totalUsers = usersWithTokens.length;

      if (totalUsers === 0) {
        Alert.alert('Sin usuarios', 'No hay usuarios con notificaciones habilitadas');
        setBroadcastLoading(false);
        return;
      }

      Alert.alert(
        'Confirmar envío',
        `Se enviarán notificaciones a ${totalUsers} usuarios en lotes de ${batchSizeNum}.\n\n¿Continuar?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => setBroadcastLoading(false) },
          {
            text: 'Enviar',
            onPress: async () => {
              const BATCH_SIZE = batchSizeNum;
              let inserted = 0;

              const broadcastData = {
                type: 'broadcast',
                timestamp: new Date().toISOString()
              };

              for (let i = 0; i < usersWithTokens.length; i += BATCH_SIZE) {
                const batch = usersWithTokens.slice(i, i + BATCH_SIZE);

                const notificationsToInsert = batch.map(user => ({
                  user_id: user.id,
                  notification_type: 'broadcast',
                  reference_id: user.id,
                  reference_type: 'broadcast',
                  title: broadcastTitle,
                  body: broadcastMessage,
                  data: broadcastData,
                  scheduled_for: new Date().toISOString(),
                  status: 'pending'
                }));

                const { error: insertError } = await supabaseClient
                  .from('scheduled_notifications')
                  .insert(notificationsToInsert);

                if (insertError) {
                } else {
                  inserted += batch.length;
                }

                setBroadcastProgress({ sent: inserted, total: totalUsers });

                await new Promise(resolve => setTimeout(resolve, 500));
              }

              setBroadcastLoading(false);
              setBroadcastMessage('');
              setBroadcastTitle('');
              setBatchSize('20');
              setShowBroadcastModal(false);

              Alert.alert(
                'Notificaciones programadas',
                `Se programaron ${inserted} notificaciones. Se enviarán automáticamente en los próximos minutos.`
              );
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudieron programar las notificaciones');
      setBroadcastLoading(false);
    }
  };

  
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Notificaciones</Text>

          <Card style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Bell size={20} color="#6B7280" />
                <View style={styles.settingCopy}>
                  <Text style={styles.settingLabel}>Notificaciones Push</Text>
                  <Text style={styles.settingDescription}>
                    Se usan para avisos masivos y mensajes operativos en tiempo real.
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.pushNotifications}
                onValueChange={(value) => handleSystemSettingChange('pushNotifications', value)}
                disabled={savingSystemSetting === 'pushNotifications'}
                trackColor={{ false: '#E5E7EB', true: '#DC2626' }}
                thumbColor={settings.pushNotifications ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>

            {settings.pushNotifications && (
              <TouchableOpacity
                style={styles.broadcastButton}
                onPress={() => setShowBroadcastModal(true)}
              >
                <Bell size={16} color="#2D6A6F" />
                <Text style={styles.broadcastButtonText}>Enviar notificación masiva</Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>

        {/* System Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🖥️ Sistema</Text>
          
          <Card style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Shield size={20} color="#6B7280" />
                <View style={styles.settingCopy}>
                  <Text style={styles.settingLabel}>Modo Mantenimiento</Text>
                  <Text style={styles.settingDescription}>
                    Bloquea la app para usuarios normales y muestra una pantalla de mantenimiento.
                  </Text>
                </View>
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
                <View style={styles.settingCopy}>
                  <Text style={styles.settingLabel}>Acceso de Invitados</Text>
                  <Text style={styles.settingDescription}>
                    Reserva esta opción para navegación sin cuenta. Por ahora se guarda a nivel global.
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.allowGuestAccess}
                onValueChange={(value) => handleSystemSettingChange('allowGuestAccess', value)}
                disabled={savingSystemSetting === 'allowGuestAccess'}
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
                onValueChange={(value) => handleSystemSettingChange('enableAnalytics', value)}
                disabled={savingSystemSetting === 'enableAnalytics'}
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
                <View style={styles.settingCopy}>
                  <Text style={styles.settingLabel}>Auto-aprobar Aliados</Text>
                  <Text style={styles.settingDescription}>
                    Las nuevas solicitudes de aliados quedarán aprobadas automáticamente al registrarse.
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.autoApprovePartners}
                onValueChange={(value) => handleSystemSettingChange('autoApprovePartners', value)}
                disabled={savingSystemSetting === 'autoApprovePartners'}
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
                <Text style={styles.settingLabel}>Cuenta Mercado Pago Legacy</Text>
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
                  Los usuarios pueden ver los planes de suscripción desde su perfil y gestionar su membresía a través de Mercado Pago.
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
                  • Los planes pagos se conectan con Mercado Pago{'\n'}
                  • Los usuarios verán los planes configurados aquí{'\n'}
                  • Los pagos recurrentes se procesan mediante Mercado Pago{'\n'}
                  • Las suscripciones se sincronizan automáticamente
                </Text>
              </View>
            </View>
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
            disabled={isLoggingOut}
            loading={isLoggingOut}
            variant="primary"
            size="large"
            style={styles.logoutButton}
          />
        </Card>
      </ScrollView>

      <Modal
        visible={isLoggingOut}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutOverlayCard}>
            <ActivityIndicator size="large" color="#2D6A6F" />
            <Text style={styles.logoutOverlayTitle}>Cerrando sesion</Text>
            <Text style={styles.logoutOverlayText}>Estamos cerrando tu cuenta de forma segura.</Text>
          </View>
        </View>
      </Modal>
      
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
              value=""
              onChangeText={() => {}}
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
                {adminMpConfig.isConnected ? 'Gestionar Mercado Pago' : 'Configurar Mercado Pago'}
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
                  <Text style={styles.mpAccountLabel}>Client ID:</Text>
                  <Text style={styles.mpAccountValue}>{adminMpConfig.clientId || 'No disponible'}</Text>
                </View>

                <Text style={styles.mpInfoText}>
                  Si el Client ID no aparece aquí, puedes completarlo sin desconectar la cuenta.
                </Text>

                <Input
                  label="N° de aplicación / App ID (client_id)"
                  placeholder="Tu client_id de Mercado Pago"
                  value={adminMpConfig.clientId}
                  onChangeText={(value) => setAdminMpConfig(prev => ({ ...prev, clientId: value }))}
                  autoCapitalize="none"
                />

                <Button
                  title={mpLoading ? 'Guardando...' : 'Guardar App ID'}
                  onPress={handleSaveMercadoPagoClientId}
                  loading={mpLoading}
                  variant="secondary"
                  size="large"
                  style={styles.mpSaveActionButton}
                />
                
                <View style={styles.mpAccountInfo}>
                  <Text style={styles.mpAccountLabel}>Modo:</Text>
                  <Text style={styles.mpAccountValue}>
                    {adminMpConfig.isTestMode ? '🧪 Prueba' : '🚀 Producción'}
                  </Text>
                </View>
                
                <View style={styles.mpWarning}>
                  <Text style={styles.mpWarningText}>
                    ⚠️ Esta cuenta quedó como respaldo de compatibilidad y ya no debería usarse para cobrar a clientes.
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
                  <Text style={styles.mpInfoTitle}>🏦 Configuración legacy de comisiones</Text>
                  <Text style={styles.mpInfoText}>
                    Esta configuración quedó como respaldo de compatibilidad y no es el flujo principal para cobrar a los clientes.
                  </Text>
                </View>
                
                <View style={styles.mpHelpSection}>
                  <Text style={styles.mpHelpTitle}>💡 ¿Cómo obtener las credenciales legacy?</Text>
                  <Text style={styles.mpHelpStep}>1. Ve a developers.mercadopago.com</Text>
                  <Text style={styles.mpHelpStep}>2. Inicia sesión con tu cuenta de Mercado Pago</Text>
                  <Text style={styles.mpHelpStep}>3. Ve a "Tus integraciones" → "Credenciales"</Text>
                  <Text style={styles.mpHelpStep}>4. Copia el Access Token y Public Key si necesitas respaldo legacy</Text>
                  <Text style={styles.mpHelpStep}>5. Completa el N° de aplicación / App ID si vas a usar OAuth para aliados</Text>
                </View>

                <Input
                  label="N° de aplicación / App ID (client_id)"
                  placeholder="Tu client_id de Mercado Pago"
                  value={adminMpConfig.clientId}
                  onChangeText={(value) => setAdminMpConfig(prev => ({ ...prev, clientId: value }))}
                  autoCapitalize="none"
                />

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
                    {mpLoading ? 'Validando...' : 'Guardar respaldo legacy'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
      {false && (
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
                {adminMpConfig.isConnected ? 'Gestionar Mercado Pago' : 'Configurar Mercado Pago'}
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
                    ⚠️ Esta cuenta quedó como respaldo de compatibilidad y ya no debería usarse para cobrar a clientes.
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
                  <Text style={styles.mpInfoTitle}>🏦 Configuración legacy de comisiones</Text>
                  <Text style={styles.mpInfoText}>
                    Esta configuración quedó como respaldo de compatibilidad y no es el flujo principal para cobrar a los clientes.
                  </Text>
                </View>
                
                <View style={styles.mpHelpSection}>
                  <Text style={styles.mpHelpTitle}>💡 ¿Cómo obtener las credenciales?</Text>
                  <Text style={styles.mpHelpStep}>1. Ve a developers.mercadopago.com</Text>
                  <Text style={styles.mpHelpStep}>2. Inicia sesión con tu cuenta de Mercado Pago</Text>
                  <Text style={styles.mpHelpStep}>3. Ve a "Tus integraciones" → "Credenciales"</Text>
                  <Text style={styles.mpHelpStep}>4. Copia el Access Token y Public Key si necesitas respaldo legacy</Text>
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
                    {mpLoading ? 'Validando...' : 'Guardar respaldo legacy'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
      )}

      {/* Broadcast Notification Modal */}
      <Modal
        visible={showBroadcastModal}
        transparent
        animationType="slide"
        onRequestClose={() => !broadcastLoading && setShowBroadcastModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Enviar Notificación Masiva</Text>
                {!broadcastLoading && (
                  <TouchableOpacity onPress={() => setShowBroadcastModal(false)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.broadcastInfo}>
                <Bell size={20} color="#2D6A6F" />
                <Text style={styles.broadcastInfoText}>
                  Esta notificación se enviará a todos los usuarios con notificaciones habilitadas.
                </Text>
              </View>

              <Input
                label="Título de la notificación *"
                placeholder="Ej: Nueva actualización disponible"
                value={broadcastTitle}
                onChangeText={setBroadcastTitle}
                editable={!broadcastLoading}
              />

              <Input
                label="Mensaje *"
                placeholder="Ej: Hemos agregado nuevas funciones..."
                value={broadcastMessage}
                onChangeText={setBroadcastMessage}
                multiline
                numberOfLines={4}
                style={styles.broadcastMessageInput}
                editable={!broadcastLoading}
              />

              <Input
                label="Tamaño del lote (1-100) *"
                placeholder="20"
                value={batchSize}
                onChangeText={setBatchSize}
                keyboardType="numeric"
                editable={!broadcastLoading}
              />

              <View style={styles.batchSizeInfo}>
                <Text style={styles.batchSizeInfoText}>
                  💡 Se enviarán {batchSize || '20'} notificaciones a la vez. Un número más bajo es más seguro pero más lento.
                </Text>
              </View>

              {broadcastLoading && broadcastProgress.total > 0 && (
                <View style={styles.broadcastProgressContainer}>
                  <Text style={styles.broadcastProgressText}>
                    Programando: {broadcastProgress.sent} / {broadcastProgress.total} notificaciones
                  </Text>
                  <View style={styles.broadcastProgressBar}>
                    <View
                      style={[
                        styles.broadcastProgressFill,
                        { width: `${(broadcastProgress.sent / broadcastProgress.total) * 100}%` }
                      ]}
                    />
                  </View>
                </View>
              )}

              <View style={styles.broadcastModalActions}>
                <TouchableOpacity
                  style={[styles.broadcastCancelButton, broadcastLoading && styles.buttonDisabled]}
                  onPress={() => setShowBroadcastModal(false)}
                  disabled={broadcastLoading}
                >
                  <Text style={styles.broadcastCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.broadcastSendButton,
                    (broadcastLoading || !broadcastTitle.trim() || !broadcastMessage.trim()) && styles.buttonDisabled
                  ]}
                  onPress={handleBroadcastNotification}
                  disabled={broadcastLoading || !broadcastTitle.trim() || !broadcastMessage.trim()}
                >
                  <Text style={styles.broadcastSendButtonText}>
                    {broadcastLoading ? 'Enviando...' : 'Enviar a todos'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  scrollContent: {
    paddingBottom: 16,
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
  settingCopy: {
    flex: 1,
    marginLeft: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  settingDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 18,
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
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  commissionTitleContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  commissionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  commissionTitleCopy: {
    flex: 1,
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
    lineHeight: 20,
  },
  commissionSummaryBadge: {
    minWidth: 82,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  commissionSummaryLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#047857',
    marginBottom: 2,
  },
  commissionSummaryValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#065F46',
  },
  commissionTypesTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  commissionOptionsGrid: {
    gap: 12,
  },
  commissionOption: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  commissionOptionSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  commissionOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commissionRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    marginRight: 10,
  },
  commissionRadioSelected: {
    borderColor: '#059669',
    backgroundColor: '#059669',
  },
  commissionOptionTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  commissionOptionText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  commissionFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  commissionFieldPrefix: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#047857',
    marginRight: 4,
  },
  commissionFieldSuffix: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#047857',
    marginLeft: 6,
  },
  commissionInput: {
    width: 88,
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
  logoutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoutOverlayCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  logoutOverlayTitle: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  logoutOverlayText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
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
  mpDisconnectButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  mpDisconnectText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#B91C1C',
  },
  mpSaveButton: {
    backgroundColor: '#00A650',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  mpSaveButtonDisabled: {
    opacity: 0.6,
  },
  mpSaveButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  mpSaveActionButton: {
    marginTop: 8,
    marginBottom: 12,
  },
  broadcastButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
    marginLeft: 40,
  },
  broadcastButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
    marginLeft: 8,
  },
  broadcastInfo: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  broadcastInfoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0369A1',
    marginLeft: 8,
    lineHeight: 18,
  },
  broadcastMessageInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  broadcastProgressContainer: {
    marginVertical: 16,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  broadcastProgressText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 8,
    textAlign: 'center',
  },
  broadcastProgressBar: {
    height: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  broadcastProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  batchSizeInfo: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  batchSizeInfoText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    lineHeight: 18,
  },
  broadcastModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  broadcastCancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastCancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  broadcastSendButton: {
    flex: 1,
    backgroundColor: '#2D6A6F',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastSendButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

