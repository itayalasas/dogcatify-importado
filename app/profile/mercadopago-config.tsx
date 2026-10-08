import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity, SafeAreaView, Switch, Linking } from 'react-native';
import { router } from 'expo-router';
import { CreditCard, CircleCheck as CheckCircle, CircleAlert as AlertCircle, ExternalLink, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { disconnectPartnerMercadoPago, generateOAuth2AuthorizationUrlWithConfig, validateCredentialsFormat } from '../../utils/mercadoPago';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { toast } from '../../components/ui/Toast';
import { colors, fonts, hitSlop, radius, spacing, typography } from '../../constants/theme';
import { Input } from '../../components/ui/Input';

export default function MercadoPagoConfig() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<any>(null);
  const [mpConfig, setMpConfig] = useState<any>(null);
  const [manualAccessToken, setManualAccessToken] = useState('');
  const [manualPublicKey, setManualPublicKey] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadPartnerData();
    }
  }, [currentUser]);

  const maskCredential = (credential: string): string => {
    if (!credential) return '';
    const firstPart = credential.substring(0, 12);
    const lastPart = credential.substring(credential.length - 6);
    return `${firstPart}...${lastPart}`;
  };

  const loadPartnerData = async () => {
    try {
      console.log('Loading partner data for user:', currentUser?.id);

      const { data: partnersData, error } = await supabaseClient
        .from('partners')
        .select('id, business_name, business_type, user_id, mercadopago_connected')
        .eq('user_id', currentUser!.id)
        .eq('is_verified', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading partner data:', error);
        Alert.alert('Error', 'No se pudo cargar la información del negocio');
        router.back();
        return;
      }

      if (!partnersData || partnersData.length === 0) {
        Alert.alert(
          'Sin negocio verificado',
          'Necesitás tener un negocio verificado para configurar Mercado Pago.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      // Si tiene múltiples negocios, usar el primero (más reciente)
      const partnerData = partnersData[0];
      console.log('Partner data loaded:', partnerData);
      setPartner(partnerData);

      // Las credenciales de Mercado Pago viven en su propia tabla
      // (protegida por RLS: solo el dueño puede leer/escribir su fila).
      const { data: creds, error: credsError } = await supabaseClient
        .from('partner_payment_credentials')
        .select('*')
        .eq('user_id', currentUser!.id)
        .maybeSingle();

      if (credsError) {
        console.error('Error loading MP credentials:', credsError);
      }

      if (creds) {
        console.log('📥 MP config loaded from DB:', {
          access_token_prefix: creds.access_token?.substring(0, 12) + '...',
          public_key_prefix: creds.public_key?.substring(0, 12) + '...',
          is_test_mode: creds.is_test_mode,
          is_oauth: creds.is_oauth,
          connected_at: creds.connected_at
        });
        setMpConfig(creds);
        setIsTestMode(creds.is_test_mode || false);
      } else {
        console.log('No MP config found');
        setMpConfig(null);
      }
    } catch (error) {
      console.error('Error in loadPartnerData:', error);
      Alert.alert('Error', 'No se pudo cargar la información del negocio');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectOAuth = async () => {
    if (!partner?.id) {
      Alert.alert('Error', 'No encontramos un negocio válido para conectar Mercado Pago.');
      return;
    }

    setConnectLoading(true);
    try {
      const authUrl = await generateOAuth2AuthorizationUrlWithConfig(partner.id);
      console.log('Opening Mercado Pago OAuth URL for partner:', partner.id);
      await Linking.openURL(authUrl);
    } catch (error) {
      console.error('Error starting Mercado Pago OAuth flow:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudo iniciar la conexión con Mercado Pago.';
      const isMissingClientId = errorMessage.toLowerCase().includes('client id not configured');
      Alert.alert(
        isMissingClientId ? 'Falta configurar Mercado Pago' : 'Error',
        isMissingClientId
          ? 'El administrador tiene que guardar el N° de aplicación / App ID (client_id) en Configuración del sistema antes de conectar aliados.'
          : errorMessage
      );
    } finally {
      setConnectLoading(false);
    }
  };

  const validateCredentials = async (accessToken: string, publicKey: string) => {
    try {
      // First, validate format using our utility function
      const formatValidation = validateCredentialsFormat(accessToken, publicKey);

      if (!formatValidation.isValid) {
        return {
          isValid: false,
          error: formatValidation.error
        };
      }

      // Try to validate with Mercado Pago API
      try {
        const response = await fetch('https://api.mercadopago.com/users/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
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
          return {
            isValid: true,
            warning: 'No se pudo validar con la API de Mercado Pago, pero el formato es correcto'
          };
        }
      } catch (apiError) {
        console.log('API validation failed, using format validation:', apiError);
        return {
          isValid: true,
          warning: 'No se pudo validar con la API de Mercado Pago, pero el formato es correcto'
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Error al validar credenciales'
      };
    }
  };

  const handleSaveManualConfig = async () => {
    if (!manualAccessToken.trim() || !manualPublicKey.trim()) {
      Alert.alert('Error', 'Completá todos los campos');
      return;
    }

    setSaveLoading(true);
    try {
      const validation = await validateCredentials(
        manualAccessToken.trim(),
        manualPublicKey.trim()
      );

      if (!validation.isValid) {
        Alert.alert(
          'Credenciales inválidas',
          validation.error || 'Las credenciales ingresadas no son válidas. Revisá que sean correctas.'
        );
        setSaveLoading(false);
        return;
      }

      // Show warning if API validation failed but format is correct
      if (validation.warning) {
        console.warn('Validation warning:', validation.warning);
      }

      const config = {
        user_id: partner.user_id,
        public_key: manualPublicKey.trim(),
        access_token: manualAccessToken.trim(),
        connected_at: new Date().toISOString(),
        is_test_mode: isTestMode,
        is_oauth: false,
        updated_at: new Date().toISOString(),
      };

      console.log('💾 Saving NEW MP config:', {
        public_key_prefix: config.public_key.substring(0, 12) + '...',
        access_token_prefix: config.access_token.substring(0, 12) + '...',
        is_test_mode: config.is_test_mode,
        connected_at: config.connected_at,
        partner_id: partner.id,
        partner_name: partner.business_name,
        user_id: partner.user_id
      });

      const { error } = await supabaseClient
        .from('partner_payment_credentials')
        .upsert(config, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving MP credentials:', error);
        throw error;
      }

      const { error: partnerUpdateError } = await supabaseClient
        .from('partners')
        .update({
          mercadopago_connected: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', partner.user_id);

      if (partnerUpdateError) {
        console.error('Error updating partners:', partnerUpdateError);
        throw partnerUpdateError;
      }

      console.log('MP config saved successfully for ALL businesses of this partner');

      // Refresh partner data from database to ensure we have the latest
      await loadPartnerData();

      setManualAccessToken('');
      setManualPublicKey('');

      toast.success(
        'Mercado Pago configurado',
        'Tu cuenta quedó configurada para todos tus negocios. Ya podés recibir pagos.'
      );
    } catch (error) {
      console.error('Error saving MP config:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración. Intentá de nuevo.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Desconectar Mercado Pago',
      '¿Seguro? Vas a dejar de recibir pagos en todos tus negocios.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectPartnerMercadoPago(partner.id);

              // Refresh partner data from database to ensure we have the latest
              await loadPartnerData();

              toast.success('Mercado Pago desconectado', 'Se desconectó de todos tus negocios.');
            } catch (error) {
              Alert.alert('Error', 'No se pudo desconectar la cuenta.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Mercado Pago" subtitle="Configuración de cobros" onBack={() => router.back()} />
        <View style={styles.loadingContainer} accessibilityLabel="Cargando configuración">
          <SkeletonCard imageHeight={64} />
          <SkeletonCard imageHeight={180} />
        </View>
      </SafeAreaView>
    );
  }

  if (!partner) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Mercado Pago" subtitle="Configuración de cobros" onBack={() => router.back()} />
        <View style={styles.errorContainer}>
          <AlertCircle size={56} color={colors.warning} />
          <Text style={styles.errorTitle}>Sin negocio verificado</Text>
          <Text style={styles.errorText}>
            Necesitás tener un negocio verificado para configurar Mercado Pago.
          </Text>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Mercado Pago" subtitle="Configuración de cobros" onBack={() => router.back()} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Business Info */}
        <Card style={styles.businessCard}>
          <View style={styles.businessHeader}>
            <CreditCard size={24} color={colors.primary} />
            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>{partner.business_name}</Text>
              <Text style={styles.businessType}>
                {partner.business_type === 'shop' ? 'Tienda' : 
                 partner.business_type === 'veterinary' ? 'Veterinaria' : 
                 partner.business_type === 'grooming' ? 'Peluquería' : 
                 partner.business_type}
              </Text>
            </View>
          </View>
        </Card>

        {/* Connection Status */}
        {mpConfig ? (
          <Card style={styles.statusCard}>
            <View style={styles.connectedHeader}>
              <CheckCircle size={28} color={colors.success} />
              <Text style={styles.connectedTitle}>Cuenta conectada</Text>
            </View>

            <View style={styles.configDetails}>
              <View style={styles.configRow}>
                <Text style={styles.configLabel}>Estado:</Text>
                <Text style={styles.configValue}>Conectado</Text>
              </View>

              <View style={styles.configRow}>
                <Text style={styles.configLabel}>Modo:</Text>
                <Text style={styles.configValue}>
                  {mpConfig.is_test_mode ? '🧪 Prueba' : '🚀 Producción'}
                </Text>
              </View>

              <View style={styles.configRow}>
                <Text style={styles.configLabel}>Conexión:</Text>
                <Text style={styles.configValue}>
                  {mpConfig.is_oauth ? 'OAuth del aliado' : 'Configuración legacy'}
                </Text>
              </View>

              <View style={styles.configRow}>
                <Text style={styles.configLabel}>Conectado:</Text>
                <Text style={styles.configValue}>
                  {new Date(mpConfig.connected_at).toLocaleDateString()}
                </Text>
              </View>
            </View>

            <View style={styles.credentialsSection}>
              <View style={styles.credentialsSectionHeader}>
                <Text style={styles.credentialsSectionTitle}>Credenciales</Text>
                <TouchableOpacity
                  onPress={() => setShowCredentials(!showCredentials)}
                  style={styles.toggleButton}
                  hitSlop={hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel={showCredentials ? 'Ocultar credenciales' : 'Mostrar credenciales'}
                >
                  {showCredentials ? (
                    <EyeOff size={20} color={colors.textTertiary} />
                  ) : (
                    <Eye size={20} color={colors.textTertiary} />
                  )}
                  <Text style={styles.toggleButtonText}>
                    {showCredentials ? 'Ocultar' : 'Mostrar'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.credentialItem}>
                <Text style={styles.credentialLabel}>Public Key:</Text>
                <Text style={styles.credentialValue} selectable={showCredentials}>
                  {showCredentials ? mpConfig.public_key : maskCredential(mpConfig.public_key)}
                </Text>
              </View>

              {mpConfig.mp_user_id && (
                <View style={styles.credentialItem}>
                  <Text style={styles.credentialLabel}>User ID:</Text>
                  <Text style={styles.credentialValue} selectable>
                    {String(mpConfig.mp_user_id)}
                  </Text>
                </View>
              )}

              {mpConfig.access_token && (
                <View style={styles.credentialItem}>
                  <Text style={styles.credentialLabel}>Access Token:</Text>
                  <Text style={styles.credentialValue} selectable={showCredentials}>
                    {showCredentials ? mpConfig.access_token : maskCredential(mpConfig.access_token)}
                  </Text>
                </View>
              )}

              {mpConfig.refresh_token && (
                <View style={styles.credentialItem}>
                  <Text style={styles.credentialLabel}>Refresh Token:</Text>
                  <Text style={styles.credentialValue} selectable={showCredentials}>
                    {showCredentials ? mpConfig.refresh_token : maskCredential(mpConfig.refresh_token)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>¿Cómo funciona?</Text>
              <Text style={styles.infoText}>
                • Los clientes pagan a través de Mercado Pago{'\n'}
                • El cobro queda asociado a la cuenta del aliado{'\n'}
                • DogCatiFy aplica su comisión automáticamente{'\n'}
                • Los fondos llegan directamente a tu cuenta MP
              </Text>
            </View>

            <Button
              title={mpConfig.is_oauth ? 'Reautorizar conexión' : 'Conectar con OAuth'}
              onPress={handleConnectOAuth}
              loading={connectLoading}
              variant="outline"
              size="large"
            />

            <Button
              title="Desconectar cuenta"
              onPress={handleDisconnect}
              variant="ghost"
              textStyle={{ color: colors.danger }}
              size="large"
            />
          </Card>
        ) : (
          <>
            <Card style={styles.statusCard}>
              <View style={styles.disconnectedHeader}>
                <AlertCircle size={28} color={colors.warning} />
                <Text style={styles.disconnectedTitle}>Sin configurar</Text>
              </View>

              <Text style={styles.disconnectedText}>
                Para recibir pagos, tenés que conectar tu cuenta de Mercado Pago.
              </Text>

              <Button
                title="Conectar con OAuth"
                onPress={handleConnectOAuth}
                loading={connectLoading}
                size="large"
              />

              <View style={styles.benefitsList}>
                <Text style={styles.benefitItem}>• Recibí pagos directamente en tu cuenta</Text>
                <Text style={styles.benefitItem}>• Comisión automática de DogCatiFy</Text>
                <Text style={styles.benefitItem}>• Proceso seguro y confiable</Text>
                <Text style={styles.benefitItem}>• Compatible con tarjetas, transferencias y más</Text>
              </View>
            </Card>

            <Card style={styles.manualConfigCard}>
              <Text style={styles.manualConfigTitle}>Configuración manual (anterior)</Text>

              <View style={styles.helpSection}>
                <Text style={styles.helpTitle}>¿Cómo obtengo las credenciales?</Text>
                <Text style={styles.helpStep}>1. Entrá a developers.mercadopago.com</Text>
                <Text style={styles.helpStep}>2. Ingresá con tu cuenta de Mercado Pago</Text>
                <Text style={styles.helpStep}>3. Andá a &quot;Tus integraciones&quot; → &quot;Credenciales&quot;</Text>
                <Text style={styles.helpStep}>4. Copiá el Access Token y la Public Key</Text>
              </View>

              <Input
                label="Access Token *"
                placeholder="APP_USR-xxxxxxxx o TEST-xxxxxxxx"
                value={manualAccessToken}
                onChangeText={setManualAccessToken}
              />

              <Input
                label="Public Key *"
                placeholder="APP_USR-xxxxxxxx o TEST-xxxxxxxx"
                value={manualPublicKey}
                onChangeText={setManualPublicKey}
              />

              <View style={styles.testModeSection}>
                <View style={styles.testModeHeader}>
                  <Text style={styles.testModeTitle}>Modo de prueba</Text>
                  <Switch
                    value={isTestMode}
                    onValueChange={setIsTestMode}
                    trackColor={{ false: colors.borderStrong, true: colors.primary }}
                    thumbColor={colors.white}
                    accessibilityLabel="Modo de prueba"
                  />
                </View>
                <Text style={styles.testModeDescription}>
                  {isTestMode
                    ? 'Modo de prueba activo: usá credenciales TEST-'
                    : 'Modo producción: usá credenciales APP_USR- reales'
                  }
                </Text>
              </View>

              <View style={styles.manualConfigActions}>
                <Button
                  title="Cancelar"
                  onPress={() => {
                    setManualAccessToken('');
                    setManualPublicKey('');
                    setIsTestMode(false);
                  }}
                  variant="outline"
                  style={styles.actionButton}
                />
                <Button
                  title="Guardar"
                  onPress={handleSaveManualConfig}
                  loading={saveLoading}
                  style={styles.actionButton}
                />
              </View>
            </Card>
          </>
        )}

        {/* Help Section */}
        <Card style={styles.helpCard}>
          <Text style={styles.helpCardTitle}>¿Necesitás ayuda?</Text>
          <Text style={styles.helpCardText}>
            Si tenés problemas para configurar Mercado Pago, escribile a nuestro equipo de soporte.
          </Text>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => router.push('/profile/help-support')}
            accessibilityRole="button"
          >
            <ExternalLink size={16} color={colors.primary} />
            <Text style={styles.helpButtonText}>Contactar a soporte</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.danger,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  businessCard: {
    marginBottom: spacing.lg,
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  businessType: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
  },
  statusCard: {
    marginBottom: spacing.lg,
  },
  connectedHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  connectedTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.success,
    marginTop: spacing.sm,
  },
  disconnectedHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  disconnectedTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.warning,
    marginTop: spacing.sm,
  },
  disconnectedText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  configDetails: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  configLabel: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
  },
  configValue: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  benefitsList: {
    marginBottom: spacing.xxl,
  },
  benefitItem: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  infoBox: {
    backgroundColor: colors.successSoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.success,
    lineHeight: 20,
  },
  manualConfigCard: {
    marginBottom: spacing.lg,
  },
  manualConfigTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  helpSection: {
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  helpTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primaryStrong,
    marginBottom: spacing.md,
  },
  helpStep: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.primaryStrong,
    marginBottom: spacing.xs,
    paddingLeft: spacing.sm,
  },
  testModeSection: {
    marginBottom: spacing.xl,
  },
  testModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  testModeTitle: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  testModeDescription: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    lineHeight: 16,
  },
  manualConfigActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  credentialText: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  credentialsSection: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  credentialsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  credentialsSectionTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButtonText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
    marginLeft: 6,
  },
  credentialItem: {
    marginBottom: spacing.md,
  },
  credentialLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  credentialValue: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpCard: {
    marginBottom: spacing.lg,
  },
  helpCardTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  helpCardText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  helpButtonText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.primary,
    marginLeft: 6,
  },
});
