import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Switch, Alert, Modal, ActivityIndicator } from 'react-native';
import { Bell, Shield, Globe, Database, LogOut, CreditCard, Crown, X, CircleCheck, Info, Users, Monitor, User } from 'lucide-react-native';
import { Badge, toast } from '../../components/ui';
import { Card } from '../../components/ui/Card';
import { GamePromotionsAdminCard } from '../../components/admin/GamePromotionsAdminCard';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '../../components/ui/Input';
import { supabaseClient } from '../../lib/supabase';
import { envConfig } from '../../utils/envConfig';
import { colors, radius, spacing, typography } from '../../constants/theme';

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
      console.error('Error loading system settings:', error);
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
      toast.success(
        value ? 'Suscripciones habilitadas' : 'Suscripciones deshabilitadas',
        value
          ? 'Los usuarios ahora pueden ver los planes.'
          : 'Ya no serán visibles para los usuarios.'
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
      console.error('Error loading admin MP config:', error);
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
      Alert.alert('Error', 'Completá todos los campos');
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
          'Las credenciales ingresadas no son válidas. Verificá que sean correctas.'
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

      toast.success('Configuración guardada', 'La configuración legacy de Mercado Pago quedó guardada.');
      setShowMercadoPagoModal(false);
    } catch (error) {
      console.error('Error saving admin MP config:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración. Intentá nuevamente.');
    } finally {
      setMpLoading(false);
    }
  };

  const handleSaveMercadoPagoClientId = async () => {
    const clientId = adminMpConfig.clientId.trim();

    if (!clientId) {
      Alert.alert('Error', 'Completá el Client ID / N° de aplicación');
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

      toast.success('Client ID guardado correctamente');
    } catch (error) {
      console.error('Error saving Mercado Pago client ID:', error);
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

              toast.success('Cuenta desconectada', 'La cuenta de Mercado Pago se desconectó.');
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
      console.error(`Error saving system setting ${key}:`, error);
      setSettings(previousSettings);
      Alert.alert('Error', 'No se pudo guardar la configuración. Intentá nuevamente.');
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
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
      Alert.alert('Error', error?.message || 'No se pudo cerrar sesión. Intentá nuevamente.');
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que querés cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: performLogout
        }
      ]
    );
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      Alert.alert('Error', 'Ingresá un correo electrónico');
      return;
    }
    
    setTestEmailLoading(true);
    try {
      console.log('Sending test email to:', testEmail);
      // Llamar a la función de prueba
      const result = await sendTestEmail(testEmail);
      
      if (result.success) {
        toast.success('Correo de prueba enviado', `Revisá la bandeja de entrada de ${testEmail}.`);
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
      'Modo mantenimiento',
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
              toast.success(`Modo mantenimiento ${!settings.maintenanceMode ? 'activado' : 'desactivado'}`);
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
        'Activá primero las notificaciones push del sistema para poder programar envíos masivos.'
      );
      return;
    }

    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      Alert.alert('Error', 'Completá el título y el mensaje');
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
                  console.error('Error inserting batch:', insertError);
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

              toast.success('Notificaciones programadas', `Se programaron ${inserted}. Se enviarán en los próximos minutos.`);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error broadcasting notifications:', error);
      Alert.alert('Error', 'No se pudieron programar las notificaciones');
      setBroadcastLoading(false);
    }
  };

  console.log('Current user email:', currentUser?.email);
  console.log('Is admin check result:', isAdmin);
  
  if (!currentUser || !isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedTitle}>Acceso denegado</Text>
          <Text style={styles.accessDeniedText}>
            No tenés permisos para acceder a esta sección
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title} accessibilityRole="header">Ajustes del sistema</Text>
          <Text style={styles.subtitle}>Administración y configuraciones globales</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Game Promos Config Section */}
          <GamePromotionsAdminCard />
          
          {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Notificaciones</Text>

          <Card style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Bell size={20} color={colors.textTertiary} />
                <View style={styles.settingCopy}>
                  <Text style={styles.settingLabel}>Notificaciones push</Text>
                  <Text style={styles.settingDescription}>
                    Se usan para avisos masivos y mensajes operativos en tiempo real.
                  </Text>
                </View>
              </View>
              <Switch
                accessibilityLabel="Notificaciones push"
                value={settings.pushNotifications}
                onValueChange={(value) => handleSystemSettingChange('pushNotifications', value)}
                disabled={savingSystemSetting === 'pushNotifications'}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            {settings.pushNotifications && (
              <TouchableOpacity
                style={styles.broadcastButton}
                onPress={() => setShowBroadcastModal(true)}
                accessibilityRole="button"
              >
                <Bell size={16} color={colors.primary} />
                <Text style={styles.broadcastButtonText}>Enviar notificación masiva</Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>

        {/* System Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Sistema</Text>
          
          <Card style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Shield size={20} color={colors.textTertiary} />
                <View style={styles.settingCopy}>
                  <Text style={styles.settingLabel}>Modo mantenimiento</Text>
                  <Text style={styles.settingDescription}>
                    Bloquea la app para usuarios normales y muestra una pantalla de mantenimiento.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.maintenanceButton,
                  { backgroundColor: settings.maintenanceMode ? colors.dangerSoft : colors.surfaceAlt }
                ]}
                onPress={handleSystemMaintenance}
                accessibilityRole="button"
                accessibilityLabel={`Modo mantenimiento: ${settings.maintenanceMode ? 'activo' : 'inactivo'}. Tocá para cambiarlo`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[
                  styles.maintenanceButtonText,
                  { color: settings.maintenanceMode ? colors.danger : colors.textSecondary }
                ]}>
                  {settings.maintenanceMode ? 'Activo' : 'Inactivo'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Globe size={20} color={colors.textTertiary} />
                <View style={styles.settingCopy}>
                  <Text style={styles.settingLabel}>Acceso de invitados</Text>
                  <Text style={styles.settingDescription}>
                    Pensado para navegar sin cuenta. Por ahora se guarda a nivel global.
                  </Text>
                </View>
              </View>
              <Switch
                accessibilityLabel="Acceso de invitados"
                value={settings.allowGuestAccess}
                onValueChange={(value) => handleSystemSettingChange('allowGuestAccess', value)}
                disabled={savingSystemSetting === 'allowGuestAccess'}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Database size={20} color={colors.textTertiary} />
                <Text style={styles.settingLabel}>Estadísticas avanzadas</Text>
              </View>
              <Switch
                accessibilityLabel="Estadísticas avanzadas"
                value={settings.enableAnalytics}
                onValueChange={(value) => handleSystemSettingChange('enableAnalytics', value)}
                disabled={savingSystemSetting === 'enableAnalytics'}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </Card>
        </View>

        {/* Partners Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Gestión de aliados</Text>
          
          <Card style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Shield size={20} color={colors.textTertiary} />
                <View style={styles.settingCopy}>
                  <Text style={styles.settingLabel}>Aprobar aliados automáticamente</Text>
                  <Text style={styles.settingDescription}>
                    Las nuevas solicitudes de aliados quedarán aprobadas automáticamente al registrarse.
                  </Text>
                </View>
              </View>
              <Switch
                accessibilityLabel="Aprobar aliados automáticamente"
                value={settings.autoApprovePartners}
                onValueChange={(value) => handleSystemSettingChange('autoApprovePartners', value)}
                disabled={savingSystemSetting === 'autoApprovePartners'}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Pagos</Text>
          
          <Card style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <CreditCard size={20} color="#00A650" />
                <Text style={styles.settingLabel}>Cuenta Mercado Pago (legacy)</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.mpStatusButton,
                  { backgroundColor: adminMpConfig.isConnected ? colors.successSoft : colors.dangerSoft }
                ]}
                onPress={() => setShowMercadoPagoModal(true)}
                accessibilityRole="button"
                accessibilityLabel={`Mercado Pago: ${adminMpConfig.isConnected ? 'conectado' : 'desconectado'}. Tocá para gestionar`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[
                  styles.mpStatusText,
                  { color: adminMpConfig.isConnected ? colors.success : colors.danger }
                ]}>
                  {adminMpConfig.isConnected ? 'Conectado' : 'Desconectado'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {adminMpConfig.isConnected && (
              <View style={styles.mpConnectedInfo}>
                <Text style={styles.mpConnectedText}>
                  Cuenta: {adminMpConfig.email || 'Configurada'}
                </Text>
                <Text style={styles.mpConnectedText}>
                  ID: {adminMpConfig.accountId || 'N/A'}
                </Text>
                <Text style={styles.mpConnectedText}>
                  Modo: {adminMpConfig.isTestMode ? 'Prueba' : 'Producción'}
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* Subscriptions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Suscripciones premium</Text>

          <Card style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionTitleContainer}>
                <Crown size={24} color={colors.warning} style={styles.subscriptionIcon} />
                <View>
                  <Text style={styles.subscriptionTitle}>Membresías premium</Text>
                  <Text style={styles.subscriptionDescription}>
                    Permite a los usuarios acceder a funciones premium mediante suscripciones
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.subscriptionToggleContainer}>
              <View style={styles.subscriptionToggleInfo}>
                <Text style={styles.subscriptionToggleLabel}>Habilitar suscripciones</Text>
                <Text style={styles.subscriptionToggleDescription}>
                  {subscriptionsEnabled
                    ? 'Los usuarios pueden ver y gestionar suscripciones desde su perfil'
                    : 'El sistema de suscripciones está oculto para los usuarios'}
                </Text>
              </View>
              <Switch
                accessibilityLabel="Habilitar suscripciones"
                value={subscriptionsEnabled}
                onValueChange={handleToggleSubscriptions}
                disabled={loadingSubscriptions}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            {subscriptionsEnabled && (
              <View style={styles.subscriptionStatusContainer}>
                <Badge
                  tone="success"
                  label="Sistema activo"
                  icon={<CircleCheck size={14} color={colors.success} />}
                  style={styles.subscriptionStatusBadge}
                />
                <Text style={styles.subscriptionStatusInfo}>
                  Los usuarios pueden ver los planes de suscripción desde su perfil y gestionar su membresía a través de Mercado Pago.
                </Text>
              </View>
            )}

            <View style={styles.subscriptionActionsContainer}>
              <Button
                title="Gestionar planes de suscripción"
                onPress={handleManageSubscriptionPlans}
                variant="outline"
                size="medium"
                style={styles.manageSubscriptionPlansButton}
              />

              <View style={styles.subscriptionInfoBox}>
                <Text style={styles.subscriptionInfoTitle}>Información</Text>
                <Text style={styles.subscriptionInfoText}>
                  • Los planes pagos se conectan con Mercado Pago{'\n'}
                  • Los usuarios verán los planes configurados acá{'\n'}
                  • Los pagos recurrentes se procesan mediante Mercado Pago{'\n'}
                  • Las suscripciones se sincronizan automáticamente
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Admin Actions */}
        <Text style={styles.sectionTitle} accessibilityRole="header">Cuenta de administrador</Text>
          
        <Card style={styles.adminCard}>  
          <View style={styles.adminInfo}>
            <Text style={styles.adminEmail}>{currentUser?.email}</Text>
            <Text style={styles.adminRole}>Administrador de DogCatiFy</Text>
          </View>
          
          <Button
            title="Cerrar sesión"
            onPress={handleLogout}
            disabled={isLoggingOut}
            loading={isLoggingOut}
            variant="outline"
            icon={<LogOut size={18} color={colors.primary} />}
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
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.logoutOverlayTitle}>Cerrando sesión</Text>
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
            <Text style={styles.modalTitle}>Configuración de correo</Text>
            
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
                  toast.success('Configuración de correo guardada');
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
              <TouchableOpacity
                onPress={() => setShowMercadoPagoModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {adminMpConfig.isConnected ? (
              <View style={styles.mpConnectedSection}>
                <View style={styles.mpConnectedHeader}>
                  <Text style={styles.mpConnectedTitle}>Cuenta conectada</Text>
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
                  Si el Client ID no aparece acá, podés completarlo sin desconectar la cuenta.
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
                    {adminMpConfig.isTestMode ? 'Prueba' : 'Producción'}
                  </Text>
                </View>
                
                <View style={styles.mpWarning}>
                  <Text style={styles.mpWarningText}>
                    Esta cuenta quedó como respaldo de compatibilidad y ya no debería usarse para cobrar a clientes.
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.mpDisconnectButton}
                  onPress={handleDisconnectAdminMp}
                >
                  <Text style={styles.mpDisconnectText}>Desconectar cuenta</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mpConfigSection}>
                <View style={styles.mpInfoSection}>
                  <Text style={styles.mpInfoTitle}>Configuración legacy de comisiones</Text>
                  <Text style={styles.mpInfoText}>
                    Esta configuración quedó como respaldo de compatibilidad y no es el flujo principal para cobrar a los clientes.
                  </Text>
                </View>
                
                <View style={styles.mpHelpSection}>
                  <Text style={styles.mpHelpTitle}>¿Cómo obtener las credenciales legacy?</Text>
                  <Text style={styles.mpHelpStep}>1. Entrá a developers.mercadopago.com</Text>
                  <Text style={styles.mpHelpStep}>2. Iniciá sesión con tu cuenta de Mercado Pago</Text>
                  <Text style={styles.mpHelpStep}>3. Andá a &quot;Tus integraciones&quot; → &quot;Credenciales&quot;</Text>
                  <Text style={styles.mpHelpStep}>4. Copiá el Access Token y la Public Key si necesitás respaldo legacy</Text>
                  <Text style={styles.mpHelpStep}>5. Completá el N° de aplicación / App ID si vas a usar OAuth para aliados</Text>
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
                      accessibilityLabel="Modo de prueba"
                      value={adminMpConfig.isTestMode}
                      onValueChange={(value) => setAdminMpConfig(prev => ({ ...prev, isTestMode: value }))}
                      trackColor={{ false: colors.borderStrong, true: colors.primary }}
                      thumbColor={colors.white}
                    />
                  </View>
                  <Text style={styles.mpTestModeDescription}>
                    {adminMpConfig.isTestMode 
                      ? 'Modo prueba activo: usá credenciales TEST-' 
                      : 'Modo producción: usá credenciales APP_USR- reales'
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
              <TouchableOpacity
                onPress={() => setShowMercadoPagoModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {adminMpConfig.isConnected ? (
              <View style={styles.mpConnectedSection}>
                <View style={styles.mpConnectedHeader}>
                  <Text style={styles.mpConnectedTitle}>Cuenta conectada</Text>
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
                    {adminMpConfig.isTestMode ? 'Prueba' : 'Producción'}
                  </Text>
                </View>
                
                <View style={styles.mpWarning}>
                  <Text style={styles.mpWarningText}>
                    Esta cuenta quedó como respaldo de compatibilidad y ya no debería usarse para cobrar a clientes.
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.mpDisconnectButton}
                  onPress={handleDisconnectAdminMp}
                >
                  <Text style={styles.mpDisconnectText}>Desconectar cuenta</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mpConfigSection}>
                <View style={styles.mpInfoSection}>
                  <Text style={styles.mpInfoTitle}>Configuración legacy de comisiones</Text>
                  <Text style={styles.mpInfoText}>
                    Esta configuración quedó como respaldo de compatibilidad y no es el flujo principal para cobrar a los clientes.
                  </Text>
                </View>
                
                <View style={styles.mpHelpSection}>
                  <Text style={styles.mpHelpTitle}>¿Cómo obtener las credenciales?</Text>
                  <Text style={styles.mpHelpStep}>1. Entrá a developers.mercadopago.com</Text>
                  <Text style={styles.mpHelpStep}>2. Iniciá sesión con tu cuenta de Mercado Pago</Text>
                  <Text style={styles.mpHelpStep}>3. Andá a &quot;Tus integraciones&quot; → &quot;Credenciales&quot;</Text>
                  <Text style={styles.mpHelpStep}>4. Copiá el Access Token y la Public Key si necesitás respaldo legacy</Text>
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
                      accessibilityLabel="Modo de prueba"
                      value={adminMpConfig.isTestMode}
                      onValueChange={(value) => setAdminMpConfig(prev => ({ ...prev, isTestMode: value }))}
                      trackColor={{ false: colors.borderStrong, true: colors.primary }}
                      thumbColor={colors.white}
                    />
                  </View>
                  <Text style={styles.mpTestModeDescription}>
                    {adminMpConfig.isTestMode 
                      ? 'Modo prueba activo: usá credenciales TEST-' 
                      : 'Modo producción: usá credenciales APP_USR- reales'
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
                <Text style={styles.modalTitle}>Enviar notificación masiva</Text>
                {!broadcastLoading && (
                  <TouchableOpacity
                    onPress={() => setShowBroadcastModal(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <X size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.broadcastInfo}>
                <Bell size={20} color={colors.primary} />
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
                placeholder="Ej: Sumamos nuevas funciones..."
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
                  Se enviarán {batchSize || '20'} notificaciones a la vez. Un número más bajo es más seguro pero más lento.
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
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    width: '100%',
  },
  title: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    marginTop: spacing.xxl,
  },
  settingsCard: {
    marginHorizontal: spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },
  settingLabel: {
    ...typography.body,
    color: colors.text,
  },
  settingDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  maintenanceButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  maintenanceButtonText: {
    ...typography.label,
  },
  commissionCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  commissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commissionTitleContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  commissionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  commissionTitleCopy: {
    flex: 1,
  },
  commissionTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  commissionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    lineHeight: 20,
  },
  commissionSummaryBadge: {
    minWidth: 82,
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  commissionSummaryLabel: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 15,
    color: colors.success,
    marginBottom: spacing.xxs,
  },
  commissionSummaryValue: {
    ...typography.heading,
    color: colors.success,
  },
  commissionTypesTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.md,
  },
  commissionOptionsGrid: {
    gap: spacing.md,
  },
  commissionOption: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commissionOptionSelected: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  commissionOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  commissionRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    marginRight: 10,
  },
  commissionRadioSelected: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  commissionOptionTitle: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  commissionOptionText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  commissionFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  commissionFieldPrefix: {
    ...typography.bodyStrong,
    color: colors.success,
    marginRight: spacing.xs,
  },
  commissionFieldSuffix: {
    ...typography.bodyStrong,
    color: colors.success,
    marginLeft: 6,
  },
  commissionInput: {
    width: 88,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: spacing.lg,
  },
  subscriptionCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  subscriptionHeader: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subscriptionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionIcon: {
    marginRight: spacing.md,
  },
  subscriptionTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subscriptionDescription: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  subscriptionToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
  },
  subscriptionToggleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  subscriptionToggleLabel: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subscriptionToggleDescription: {
    ...typography.bodySmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
  },
  subscriptionStatusContainer: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  subscriptionStatusBadge: {
    marginBottom: spacing.sm,
  },
  subscriptionStatusText: {
    ...typography.captionStrong,
    color: colors.white,
  },
  subscriptionStatusInfo: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.success,
    lineHeight: 18,
  },
  subscriptionActionsContainer: {
    marginTop: spacing.sm,
  },
  manageSubscriptionPlansButton: {
    marginBottom: spacing.lg,
  },
  subscriptionInfoBox: {
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  subscriptionInfoTitle: {
    ...typography.label,
    color: colors.primaryStrong,
    marginBottom: spacing.sm,
  },
  subscriptionInfoText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.primaryStrong,
    lineHeight: 20,
  },
  adminCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    padding: spacing.lg,
  },
  adminInfo: {
    marginBottom: spacing.lg,
  },
  logoutButton: {
    marginTop: spacing.sm,
  },
  logoutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  logoutOverlayCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.xxl,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  logoutOverlayTitle: {
    ...typography.heading,
    marginTop: spacing.lg,
    color: colors.text,
  },
  logoutOverlayText: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  adminEmail: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  adminRole: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  accessDeniedTitle: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 32,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  accessDeniedText: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  emailConfigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    marginLeft: 40,
  },
  emailConfigText: {
    ...typography.label,
    color: colors.danger,
    marginLeft: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalScrollContainer: {
    flex: 1,
    marginTop: 60,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalCloseText: {
    ...typography.heading,
    color: colors.textTertiary,
  },
  modalTitle: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  emailTestSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
   padding: 12,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
  },
  emailTestTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  mpStatusButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  mpStatusText: {
    ...typography.captionStrong,
  },
  mpConnectedInfo: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  mpConnectedText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  mpConnectedSection: {
    padding: spacing.lg,
  },
  mpConnectedHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  mpConnectedTitle: {
    ...typography.heading,
    color: colors.success,
  },
  mpAccountInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mpAccountLabel: {
    ...typography.label,
    color: colors.textTertiary,
  },
  mpAccountValue: {
    ...typography.label,
    color: colors.text,
  },
  mpWarning: {
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginVertical: spacing.lg,
  },
  mpWarningText: {
    ...typography.caption,
    color: colors.warning,
    textAlign: 'center',
  },
  mpConfigSection: {
    paddingVertical: spacing.sm,
  },
  mpInfoSection: {
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  mpInfoTitle: {
    ...typography.bodyStrong,
    color: colors.primaryStrong,
    marginBottom: spacing.sm,
  },
  mpInfoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.primaryStrong,
    lineHeight: 20,
  },
  mpHelpSection: {
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  mpHelpTitle: {
    ...typography.label,
    color: colors.primaryStrong,
    marginBottom: spacing.md,
  },
  mpHelpStep: {
    ...typography.bodySmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primaryStrong,
    marginBottom: spacing.xs,
    paddingLeft: spacing.sm,
  },
  mpTestModeSection: {
    marginBottom: spacing.xl,
  },
  mpTestModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  mpTestModeTitle: {
    ...typography.label,
    color: colors.textSecondary,
  },
  mpTestModeDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textTertiary,
    lineHeight: 16,
  },
  mpDisconnectButton: {
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  mpDisconnectText: {
    ...typography.label,
    color: colors.danger,
  },
  mpSaveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  mpSaveButtonDisabled: {
    opacity: 0.6,
  },
  mpSaveButtonText: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.white,
  },
  mpSaveActionButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  broadcastButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    marginLeft: 40,
  },
  broadcastButtonText: {
    ...typography.label,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  broadcastInfo: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  broadcastInfoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.primaryStrong,
    marginLeft: spacing.sm,
    lineHeight: 18,
  },
  broadcastMessageInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  broadcastProgressContainer: {
    marginVertical: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  broadcastProgressText: {
    ...typography.label,
    color: colors.success,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  broadcastProgressBar: {
    height: 8,
    backgroundColor: colors.successSoft,
    borderRadius: 4,
    overflow: 'hidden',
  },
  broadcastProgressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  batchSizeInfo: {
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  batchSizeInfoText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.warning,
    lineHeight: 18,
  },
  broadcastModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  broadcastCancelButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastCancelButtonText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  broadcastSendButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastSendButtonText: {
    ...typography.bodyStrong,
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

