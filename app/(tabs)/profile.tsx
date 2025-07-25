import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Switch, Modal, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { Settings, CreditCard as Edit3, LogOut, Bell, Shield, CircleHelp as HelpCircle, Globe, Fingerprint, Eye, Mail, Lock, Building, Package, CreditCard } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useBiometric } from '../../contexts/BiometricContext';
import { supabaseClient } from '../../lib/supabase';

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { 
    isBiometricSupported, 
    isBiometricEnabled, 
    biometricType, 
    disableBiometric,
    enableBiometric
  } = useBiometric();
  const [isPartnerMode, setIsPartnerMode] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<'none' | 'pending' | 'verified'>('none');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricEmail, setBiometricEmail] = useState('');
  const [biometricPassword, setBiometricPassword] = useState('');
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [userStats, setUserStats] = useState({
    pets: 0,
    posts: 0,
    followers: 0,
    following: 0
  });

  // Define fetchUserStats function outside useEffect but inside component
  const fetchUserStats = async () => {
    if (!currentUser) return;
    
    try {
      // Fetch pets count
      const { count: petsCount, error: petsError } = await supabaseClient
        .from('pets')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', currentUser.id);
      
      if (petsError) throw petsError;
      
      // Fetch posts count
      const { count: postsCount, error: postsError } = await supabaseClient
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);
      
      if (postsError) throw postsError;
      
      // Fetch user profile for followers/following
      const { data: userData, error: userError } = await supabaseClient
        .from('profiles')
        .select('followers, following')
        .eq('id', currentUser.id)
        .single();
      
      if (userError) throw userError;
      
      setUserStats({
        pets: petsCount || 0,
        posts: postsCount || 0,
        followers: userData.followers?.length || 0,
        following: userData.following?.length || 0
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchPartnerProfile = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching partner profile:', error);
        return;
      }
      
      setPartnerProfile(data ? {
        id: data.id,
        userId: data.user_id,
        businessName: data.business_name,
        businessType: data.business_type,
        isVerified: data.is_verified,
        isActive: data.is_active,
        ...data
      } : null);
    } catch (error) {
      console.error('Error fetching partner profile:', error);
    }
  };
  useEffect(() => {
    if (!currentUser) return;

    fetchUserStats();
    fetchPartnerProfile();
    checkPartnerStatus();

    // Set up real-time subscriptions
    const partnerSubscription = supabaseClient
      .channel('partner-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partners',
          filter: `user_id=eq.${currentUser.id}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setPartnerProfile(null);
          } else {
            const data = payload.new;
            setPartnerProfile(data ? {
              id: data.id,
              userId: data.user_id,
              businessName: data.business_name,
              businessType: data.business_type,
              isVerified: data.is_verified,
              isActive: data.is_active,
              ...data
            } : null);
          }
        }
      )
      .subscribe();

    const profileSubscription = supabaseClient
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`
        },
        (payload) => {
          const data = payload.new;
          setUserStats(prev => ({
            ...prev,
            followers: data.followers?.length || 0,
            following: data.following?.length || 0
          }));
        }
      )
      .subscribe();

    return () => {
      partnerSubscription.unsubscribe();
      profileSubscription.unsubscribe();
    };
  }, [currentUser]);

  const checkPartnerStatus = async () => {
    if (!currentUser) return;
    
    try {
      console.log('Checking partner status for user:', currentUser.id);
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Error checking partner status:', error);
        return;
      }
      
      if (data && data.length > 0) {
        console.log('Partner data found:', data[0]);
        if (data[0].is_verified) {
          setPartnerStatus('verified');
        } else {
          setPartnerStatus('pending');
        }
      } else {
        setPartnerStatus('none');
      }
    } catch (error) {
      console.error('Error in checkPartnerStatus:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/auth/login');
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'No se pudo cerrar la sesión');
            }
          }
        }
      ]
    );
  };

  const handleEditProfile = () => {
    router.push('/profile/edit');
  };

  const handleSettings = () => {
    console.log('Settings');
  };

  const handlePartnerModeToggle = () => {
    if (isPartnerMode) {
      // Switch back to user mode
      setIsPartnerMode(false);
    } else {
      // Check if user is admin first
      const isAdmin = currentUser?.email?.toLowerCase() === 'admin@dogcatify.com';
      if (isAdmin) {
        // Switch to admin mode
        setIsPartnerMode(true);
        router.replace('/(admin-tabs)/requests');
        return;
      } else {
        // Check if user has a verified partner status
        if (partnerStatus === 'verified') {
          console.log('Switching to partner mode, redirecting to business selector');
          // Switch to partner mode
          setIsPartnerMode(true);
          router.replace('/(partner-tabs)/business-selector');
        } else {
          Alert.alert(
            'Acceso no disponible',
            partnerStatus === 'pending' 
              ? 'Tu solicitud está siendo revisada por un administrador. Te notificaremos cuando sea aprobada.'
              : 'Debes registrar un negocio y ser verificado por un administrador para acceder al modo aliado.'
          );
        }
      }
    }
  };

  const handleRegisterBusiness = () => {
    router.push('/partner-register');
  };

  const handleLanguageChange = (lang: 'es' | 'en') => {
    setLanguage(lang);
    setShowLanguageModal(false);
  };

  const handleBiometricToggle = async () => {
    if (isBiometricEnabled) {
      Alert.alert(
        `Deshabilitar ${biometricType || 'autenticación biométrica'}`,
        `¿Estás seguro de que quieres deshabilitar el acceso con ${biometricType || 'biometría'}?`,
        [
          {
            text: 'Cancelar',
            style: 'cancel'
          },
          {
            text: 'Deshabilitar',
            style: 'destructive',
            onPress: async () => {
              await disableBiometric();
              Alert.alert('Deshabilitado', 'La autenticación biométrica ha sido deshabilitada');
            }
          }
        ]
      );
    } else {
      // Show modal to enter credentials
      setBiometricEmail(currentUser?.email || '');
      setBiometricPassword('');
      setShowBiometricModal(true);
    }
  };

  const handleEnableBiometric = async () => {
    if (!biometricEmail || !biometricPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setBiometricLoading(true);
    try {
      // Enable biometric authentication
      const success = await enableBiometric(biometricEmail, biometricPassword);
      
      if (success) {
        Alert.alert(
          'Autenticación biométrica habilitada',
          `Ahora puedes usar tu ${biometricType || 'biometría'} para iniciar sesión rápidamente.`
        );
        setShowBiometricModal(false);
        setBiometricPassword('');
      } else {
        Alert.alert('Error', `No se pudo habilitar la autenticación con ${biometricType || 'biometría'}`);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Credenciales incorrectas. Por favor verifica tu email y contraseña.');
    } finally {
      setBiometricLoading(false);
    }
  };

  const getBiometricIcon = () => {
    if (biometricType?.includes('Face') || biometricType?.includes('facial')) {
      return <Eye size={20} color="#6B7280" />;
    }
    return <Fingerprint size={20} color="#6B7280" />;
  };

  const getBusinessTypeName = (type: string) => {
    const types: Record<string, string> = {
      veterinary: 'Veterinaria',
      grooming: 'Peluquería',
      walking: 'Paseador',
      boarding: 'Pensión',
      shop: 'Tienda',
      shelter: 'Refugio'
    };
    return types[type] || type;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('profile')}</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
          <Settings size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>
        {/* Mercado Pago Configuration - Only show if user has verified businesses */}
        {partnerProfile && partnerProfile.isVerified && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/mercadopago-config')}>
            <CreditCard size={20} color="#6B7280" />
            <Text style={styles.menuText}>Configurar Mercado Pago</Text>
            <View style={styles.mpStatusBadge}>
              <Text style={styles.mpStatusText}>
                {partnerProfile.mercadopago_connected ? '✅ Conectado' : '⚠️ Pendiente'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image
              source={{ uri: currentUser?.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=200' }}
              style={styles.avatar}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{currentUser?.displayName || 'Amante de las mascotas'}</Text>
              <Text style={styles.profileEmail}>{currentUser?.email}</Text>
              <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
                <Edit3 size={16} color="#3B82F6" />
                <Text style={styles.editButtonText}>{t('editProfile')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        <Card style={styles.modeCard}>
          <View style={styles.modeHeader}>
            <Text style={styles.modeTitle}>
              {currentUser?.email === 'admin@dogcatify.com' ? t('adminMode') : t('partnerMode')}
            </Text>
            {currentUser?.email === 'admin@dogcatify.com' ? (
              <Button
                title={t('goToAdmin')}
                onPress={handlePartnerModeToggle}
                size="small"
              />
            ) : partnerStatus === 'verified' ? (
              <Switch
                value={isPartnerMode}
                onValueChange={handlePartnerModeToggle}
                trackColor={{ false: '#E5E7EB', true: '#FF6B35' }}
                thumbColor={isPartnerMode ? '#FFFFFF' : '#FFFFFF'}
              />
            ) : (
              <View style={styles.partnerStatusBadge}>
                <Text style={styles.partnerStatusText}>
                  {partnerStatus === 'pending' ? t('pendingVerification') : t('noBusinessRegistered')}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.modeDescription}>
            {currentUser?.email === 'admin@dogcatify.com'
              ? t('adminModeDescription')
              : partnerStatus !== 'none'
                ? (partnerStatus === 'verified'
                    ? (isPartnerMode ? t('partnerModeOn') : t('partnerModeOff'))
                    : t('requestUnderReview')
                  )
                : t('canRegisterBusiness')
            }
          </Text>
          {partnerStatus === 'verified' && currentUser?.email !== 'admin@dogcatify.com' && (
            <View style={styles.partnerInfo}>
              {/* Partner info content */}
            </View>
          )}
        </Card>

        <Card style={styles.statsCard}>
          <Text style={styles.sectionTitle}>{t('myStats')}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats.pets}</Text>
              <Text style={styles.statLabel}>{t('pets')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats.posts}</Text>
              <Text style={styles.statLabel}>{t('posts')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats.followers}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats.following}</Text>
              <Text style={styles.statLabel}>Siguiendo</Text>
            </View>
          </View>
        </Card>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={handleRegisterBusiness}>
            <Building size={20} color="#6B7280" />
            <Text style={styles.menuText}>Registrar Negocio</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/orders')}>
            <Package size={20} color="#6B7280" />
            <Text style={styles.menuText}>Mis Pedidos</Text>
          </TouchableOpacity>
          
          {isBiometricSupported && (
            <TouchableOpacity style={styles.menuItem} onPress={handleBiometricToggle}>
              {getBiometricIcon()}
              <Text style={styles.menuText}>Autenticación biométrica</Text>
              <Switch
                value={isBiometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                thumbColor={isBiometricEnabled ? '#FFFFFF' : '#FFFFFF'}
              />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.menuItem}>
            <Bell size={20} color="#6B7280" />
            <Text style={styles.menuText}>{t('notifications')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Shield size={20} color="#6B7280" />
            <Text style={styles.menuText}>{t('privacySecurity')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowLanguageModal(true)}>
            <Globe size={20} color="#6B7280" />
            <Text style={styles.menuText}>{t('language')}</Text>
            <Text style={styles.languageValue}>
              {language === 'es' ? t('spanish') : t('english')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <HelpCircle size={20} color="#6B7280" />
            <Text style={styles.menuText}>{t('helpSupport')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logoutSection}>
          <Button
            title={t('signOut')}
            onPress={handleLogout}
            variant="outline"
            size="large"
          />
        </View>
      </ScrollView>

      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.biometricModalContent}>
            <Text style={styles.modalTitle}>{t('language')}</Text>
            
            <TouchableOpacity 
              style={[styles.languageOption, language === 'es' && styles.selectedLanguage]}
              onPress={() => handleLanguageChange('es')}
            >
              <Text style={[styles.languageOptionText, language === 'es' && styles.selectedLanguageText]}>
                🇪🇸 {t('spanish')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.languageOption, language === 'en' && styles.selectedLanguage]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text style={[styles.languageOptionText, language === 'en' && styles.selectedLanguageText]}>
                🇺🇸 {t('english')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar / Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Biometric Setup Modal */}
      <Modal
        visible={showBiometricModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBiometricModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.biometricModalContent}>
            <Text style={styles.biometricModalTitle}>
              🔒 Habilitar autenticación biométrica
            </Text>
            <Text style={styles.biometricModalSubtitle}>
              Para habilitar el acceso con {biometricType}, confirma tus credenciales
            </Text>
            
            <View style={styles.biometricForm}>
              <Input
                label="Correo electrónico"
                placeholder="tu@email.com"
                value={biometricEmail}
                onChangeText={setBiometricEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Mail size={20} color="#6B7280" />}
              />

              <Input
                label="Contraseña"
                placeholder="Tu contraseña"
                value={biometricPassword}
                onChangeText={setBiometricPassword}
                secureTextEntry
                leftIcon={<Lock size={20} color="#6B7280" />}
              />
            </View>
            
            <View style={styles.biometricModalButtons}>
              <View style={styles.biometricButtonContainer}>
                <Button
                  title="Cancelar"
                  onPress={() => {
                    setShowBiometricModal(false);
                    setBiometricPassword('');
                  }}
                  variant="outline"
                  size="large"
                />
              </View>
              <View style={styles.biometricButtonContainer}>
                <Button
                  title="Habilitar"
                  onPress={handleEnableBiometric}
                  loading={biometricLoading}
                  size="large"
                />
              </View>
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
    backgroundColor: '#FFFFFF',
    paddingTop: 30, // Add padding at the top to show status bar
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
  },
  settingsButton: {
    padding: 6,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
  },
  profileCard: {
    marginHorizontal: 6,
    marginTop: 12,
    marginBottom: 12,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
    fontFamily: 'Inter-Regular',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  editButtonText: {
    fontSize: 13,
    color: '#3B82F6',
    marginLeft: 4,
    fontFamily: 'Inter-Medium',
  },
  modeCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modeTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
  },
  modeDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
  },
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  menuSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 6,
    minHeight: 50,
  },
  menuText: {
    fontSize: 15,
    color: '#111827',
    marginLeft: 10,
    flex: 1,
    fontFamily: 'Inter-Regular',
  },
  languageValue: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  logoutSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  biometricModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  languageOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F9FAFB',
    minHeight: 44,
    justifyContent: 'center',
  },
  selectedLanguage: {
    backgroundColor: '#FF6B35',
  },
  languageOptionText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    textAlign: 'center',
  },
  selectedLanguageText: {
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 10,
    marginTop: 6,
    minHeight: 40,
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    textAlign: 'center',
  },
  mpStatusBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  mpStatusText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  partnerStatusBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  partnerStatusText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  biometricModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  biometricModalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  biometricModalSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  biometricForm: {
    marginBottom: 24,
  },
  biometricModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  biometricButtonContainer: {
    flex: 1,
    maxWidth: '48%',
  },
});