import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Switch, Alert, Modal } from 'react-native';
import { Bell, Shield, DollarSign, Mail, Globe, Database, LogOut, Send } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { Input } from '../../components/ui/Input';

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
    setSettings(prev => ({ ...prev, globalCommission: value }));
  };

  const handleCommissionTypeChange = (type: string) => {
    setSettings(prev => ({ ...prev, commissionType: type }));
  };

  const handleFixedCommissionChange = (value: string) => {
    setSettings(prev => ({ ...prev, fixedCommission: value }));
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

        {/* Payment Configuration */}
        <Text style={styles.sectionTitle}>💳 Configuración de Comisiones</Text>
        
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
            onPress={() => Alert.alert('Configuración', 'Configuración de comisiones guardada correctamente')}
            variant="primary"
            size="large"
            style={styles.saveButton}
          />
        </Card>

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
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
   width: '85%',
    maxHeight: '80%',
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
});