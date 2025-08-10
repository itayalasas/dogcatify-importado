import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Switch } from 'react-native';
import { router } from 'expo-router';
import { User, Settings, Heart, ShoppingBag, Calendar, LogOut, CreditCard as Edit, Bell, Shield, CircleHelp as HelpCircle, Globe, Building, CreditCard, Fingerprint, ChevronRight, ArrowRight, Trash2 } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useBiometric } from '../../contexts/BiometricContext';
import { supabaseClient } from '../../lib/supabase';

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { 
    isBiometricSupported, 
    isBiometricEnabled, 
    biometricType, 
    disableBiometric,
    enableBiometric
  } = useBiometric();
  
  const [userStats, setUserStats] = useState({
    petsCount: 0,
    postsCount: 0,
    followersCount: 0,
    followingCount: 0
  });
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchUserStats();
      fetchPartnerProfile();
    }
  }, [currentUser?.id, currentUser?.displayName, currentUser?.photoURL]);

  // Set up real-time subscription for profile updates
  useEffect(() => {
    if (!currentUser) return;
    
    const subscription = supabaseClient
      .channel('profile-updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`
        }, 
        (payload) => {
          console.log('Profile updated, refreshing stats...');
          fetchUserStats();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser]);
  const fetchUserStats = async () => {
    try {
      console.log('Fetching user stats for:', currentUser!.id);
      
      // Fetch pets count
      const { count: petsCount } = await supabaseClient
        .from('pets')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', currentUser!.id);

      // Fetch posts count
      const { count: postsCount } = await supabaseClient
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser!.id);

      // Fetch updated profile data to get current followers/following
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('followers, following')
        .eq('id', currentUser!.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile data:', profileError);
      }
      
      const followersCount = profileData?.followers?.length || 0;
      const followingCount = profileData?.following?.length || 0;
      
      console.log('Updated stats:', {
        petsCount: petsCount || 0,
        postsCount: postsCount || 0,
        followersCount,
        followingCount
      });
      setUserStats({
        petsCount: petsCount || 0,
        postsCount: postsCount || 0,
        followersCount,
        followingCount
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPartnerProfile = async () => {
    try {
      console.log('Fetching partner profile for user:', currentUser!.id);
      
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('user_id', currentUser!.id)
        .eq('is_verified', true);
      
      console.log('Partner query result:', { data, error });

      if (data && data.length > 0 && !error) {
        console.log('Partner profile found:', data[0]);
        setPartnerProfile({
          id: data[0].id,
          businessName: data[0].business_name,
          businessType: data[0].business_type,
          isVerified: data[0].is_verified,
          isActive: data[0].is_active
        });
      } else {
        console.log('No partner profile found or error:', error);
        setPartnerProfile(null);
      }
    } catch (error) {
      console.error('Error fetching partner profile:', error);
      setPartnerProfile(null);
    }
  };

  const handleEditProfile = () => {
    router.push('/profile/edit');
  };

  const handlePartnerMode = () => {
    if (partnerProfile) {
      router.push({
        pathname: '/(partner-tabs)/business-selector',
        params: { businessId: partnerProfile.id }
      });
    } else {
      router.push('/(tabs)/partner-register');
    }
  };

  const handleAdminMode = () => {
    router.push('/(admin-tabs)/requests');
  };

  const handleMyOrders = () => {
    router.push('/orders');
  };

  const handleToggleBiometric = async () => {
    try {
      if (isBiometricEnabled) {
        Alert.alert(
          'Desactivar autenticación biométrica',
          '¿Estás seguro de que quieres desactivar la autenticación biométrica?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Desactivar',
              style: 'destructive',
              onPress: async () => {
                try {
                  await disableBiometric();
                  Alert.alert('Desactivado', 'La autenticación biométrica ha sido desactivada');
                } catch (error) {
                  Alert.alert('Error', 'No se pudo desactivar la autenticación biométrica');
                }
              }
            }
          ]
        );
      } else {
        // Habilitar biometría directamente desde el perfil
        Alert.alert(
          'Habilitar autenticación biométrica',
          `¿Quieres usar tu ${biometricType || 'biometría'} para iniciar sesión más rápido?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Habilitar',
              onPress: async () => {
                try {
                  if (!currentUser?.email) {
                    Alert.alert('Error', 'No se pudo obtener la información del usuario');
                    return;
                  }

                  // Solicitar la contraseña actual para habilitar biometría
                  Alert.prompt(
                    'Confirmar identidad',
                    'Ingresa tu contraseña actual para habilitar la autenticación biométrica:',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Confirmar',
                        onPress: async (password) => {
                          if (!password) {
                            Alert.alert('Error', 'La contraseña es requerida');
                            return;
                          }

                          try {
                            // Verificar la contraseña con Supabase
                            const { error: signInError } = await supabaseClient.auth.signInWithPassword({
                              email: currentUser.email,
                              password: password
                            });

                            if (signInError) {
                              Alert.alert('Error', 'Contraseña incorrecta');
                              return;
                            }

                            // Habilitar biometría con las credenciales verificadas
                            const { enableBiometric } = useBiometric();
                            const success = await enableBiometric(currentUser.email, password);
                            
                            if (success) {
                              Alert.alert(
                                'Biometría habilitada',
                                `${biometricType || 'La autenticación biométrica'} ha sido configurada correctamente. Ahora puedes usarla para iniciar sesión.`
                              );
                            } else {
                              Alert.alert('Error', 'No se pudo habilitar la autenticación biométrica');
                            }
                          } catch (enableError) {
                            console.error('Error enabling biometric:', enableError);
                            Alert.alert('Error', 'No se pudo habilitar la autenticación biométrica');
                          }
                        }
                      }
                    ],
                    'secure-text'
                  );
                } catch (error) {
                  console.error('Error in biometric setup:', error);
                  Alert.alert('Error', 'No se pudo configurar la autenticación biométrica');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error toggling biometric:', error);
    }
  };

  const handleLanguageChange = () => {
    Alert.alert(
      'Cambiar idioma',
      'Selecciona tu idioma preferido',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Español', 
          onPress: () => setLanguage('es'),
          style: language === 'es' ? 'default' : 'default'
        },
        { 
          text: 'English', 
          onPress: () => setLanguage('en'),
          style: language === 'en' ? 'default' : 'default'
        }
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/auth/login');
            } catch (error) {
              Alert.alert('Error', 'No se pudo cerrar sesión');
            }
          }
        }
      ]
    );
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

  const isAdmin = currentUser?.email?.toLowerCase() === 'admin@dogcatify.com';

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image
              source={{ 
                uri: currentUser.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=200' 
              }}
              style={styles.avatar}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {currentUser.displayName || 'Usuario'}
              </Text>
              <Text style={styles.profileEmail}>{currentUser.email}</Text>
              {currentUser.bio && (
                <Text style={styles.profileBio}>{currentUser.bio}</Text>
              )}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats.petsCount}</Text>
              <Text style={styles.statLabel}>{t('pets')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats.postsCount}</Text>
              <Text style={styles.statLabel}>{t('posts')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats.followersCount}</Text>
              <Text style={styles.statLabel}>{t('followers')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats.followingCount}</Text>
              <Text style={styles.statLabel}>{t('following')}</Text>
            </View>
          </View>
        </Card>

        {/* Admin Mode - Solo para administradores */}
        {isAdmin && (
          <Card style={styles.adminCard}>
            <TouchableOpacity style={styles.adminOption} onPress={handleAdminMode}>
              <View style={styles.adminInfo}>
                <Shield size={24} color="#DC2626" />
                <View style={styles.adminDetails}>
                  <Text style={styles.adminTitle}>{t('adminMode')}</Text>
                  <Text style={styles.adminDescription}>
                    {t('adminModeDescription')}
                  </Text>
                </View>
              </View>
              <ArrowRight size={20} color="#DC2626" />
            </TouchableOpacity>
          </Card>
        )}

        {/* Partner Mode Card */}
        <Card style={styles.partnerCard}>
          <View style={styles.partnerHeader}>
            <Building size={24} color="#2D6A6F" />
            <Text style={styles.partnerTitle}>{t('partnerMode')}</Text>
          </View>
          
          {partnerProfile ? (
            <View style={styles.partnerActive}>
              <View style={styles.partnerButtons}>
                <Button
                  title="Ir al Dashboard de Aliado"
                  onPress={handlePartnerMode}
                  size="large"
                  style={styles.partnerButton}
                />
                <Button
                  title="Registrar Otro Negocio"
                  onPress={() => router.push('/(tabs)/partner-register')}
                  variant="outline"
                  size="large"
                  style={styles.partnerButton}
                />
              </View>
            </View>
          ) : (
            <View style={styles.partnerInactive}>
              <Button
                title={t('registerBusiness')}
                onPress={handlePartnerMode}
                size="large"
              />
            </View>
          )}
        </Card>

        {/* Menu Options */}
        <Card style={styles.menuCard}>
          <TouchableOpacity style={styles.menuOption} onPress={handleEditProfile}>
            <View style={styles.menuOptionLeft}>
              <Edit size={20} color="#6B7280" />
              <Text style={styles.menuOptionText}>Editar perfil</Text>
            </View>
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuOption} onPress={handleMyOrders}>
            <View style={styles.menuOptionLeft}>
              <ShoppingBag size={20} color="#6B7280" />
              <Text style={styles.menuOptionText}>{t('myOrders')}</Text>
            </View>
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuOption} onPress={() => router.push('/cart')}>
            <View style={styles.menuOptionLeft}>
              <ShoppingBag size={20} color="#6B7280" />
              <Text style={styles.menuOptionText}>Mi Carrito</Text>
            </View>
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>

          {partnerProfile && (
            <TouchableOpacity 
              style={styles.menuOption} 
              onPress={() => router.push('/profile/mercadopago-config')}
            >
              <View style={styles.menuOptionLeft}>
                <CreditCard size={20} color="#6B7280" />
                <Text style={styles.menuOptionText}>Configurar Mercado Pago</Text>
              </View>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </Card>

        {/* Settings */}
        <Card style={styles.menuCard}>
          {/* Biometric Authentication Setup */}
          {isBiometricSupported && (
            <Card style={styles.biometricCard}>
              <View style={styles.biometricHeader}>
                <View style={styles.biometricIconContainer}>
                  <Fingerprint size={24} color="#2D6A6F" />
                </View>
                <View style={styles.biometricInfo}>
                  <Text style={styles.biometricTitle}>
                    Autenticación {biometricType || 'Biométrica'}
                  </Text>
                  <Text style={styles.biometricDescription}>
                    {isBiometricEnabled ? 
                      '✅ Acceso rápido y seguro habilitado' :
                      '🔒 Habilita para acceso instantáneo'
                    }
                  </Text>
                </View>
                <Switch
                  value={isBiometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: '#E5E7EB', true: '#2D6A6F' }}
                  thumbColor="#FFFFFF"
                  style={styles.biometricSwitch}
                />
              </View>
              
              {!isBiometricEnabled && (
                <View style={styles.biometricBenefits}>
                  <Text style={styles.benefitsTitle}>Beneficios:</Text>
                  <Text style={styles.benefitItem}>• Acceso instantáneo sin contraseñas</Text>
                  <Text style={styles.benefitItem}>• Máxima seguridad con tu {biometricType?.toLowerCase() || 'biometría'}</Text>
                  <Text style={styles.benefitItem}>• Credenciales protegidas en tu dispositivo</Text>
                </View>
              )}
            </Card>
          )}

          <View style={styles.menuOption}>
            <View style={styles.menuOptionLeft}>
              <Bell size={20} color="#6B7280" />
              <Text style={styles.menuOptionText}>{t('notifications')}</Text>
            </View>
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: '#E5E7EB', true: '#2D6A6F' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity style={styles.menuOption} onPress={handleLanguageChange}>
            <View style={styles.menuOptionLeft}>
              <Globe size={20} color="#6B7280" />
              <Text style={styles.menuOptionText}>{t('language')}</Text>
            </View>
            <View style={styles.languageIndicator}>
              <Text style={styles.languageText}>
                {language === 'es' ? t('spanish') : t('english')}
              </Text>
              <ChevronRight size={16} color="#6B7280" />
            </View>
          </TouchableOpacity>        

          <TouchableOpacity 
            style={styles.menuOption} 
            onPress={() => router.push('/profile/help-support')}
          >
            <View style={styles.menuOptionLeft}>
              <HelpCircle size={20} color="#6B7280" />
              <Text style={styles.menuOptionText}>{t('helpSupport')}</Text>
            </View>
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>

        </Card>

        {/* Advanced Settings */}
        <Card style={styles.menuCard}>
          <TouchableOpacity 
            style={styles.menuOption} 
            onPress={() => router.push('/profile/delete-account')}
          >
            <View style={styles.menuOptionLeft}>
              <Trash2 size={20} color="#EF4444" />
              <Text style={[styles.menuOptionText, styles.dangerText]}>Eliminar cuenta</Text>
            </View>
            <ChevronRight size={16} color="#EF4444" />
          </TouchableOpacity>
        </Card>
        {/* Logout */}
        <Card style={styles.logoutCard}>
          <TouchableOpacity style={styles.logoutOption} onPress={handleLogout}>
            <LogOut size={20} color="#10B981" />
            <Text style={[styles.logoutText, styles.logoutTextGreen]}>{t('signOut')}</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 30,
  },
  header: {
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
  editButton: {
    padding: 8,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  profileCard: {
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
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
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  profileBio: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  adminCard: {
    marginBottom: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  adminOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  adminInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  adminDetails: {
    marginLeft: 12,
    flex: 1,
  },
  adminTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
    marginBottom: 2,
  },
  adminDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#991B1B',
    lineHeight: 18,
  },
  partnerCard: {
    marginBottom: 16,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  partnerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
    marginLeft: 8,
  },
  partnerButtons: {
    gap: 12,
    width: '100%',
  },
  partnerButton: {
    width: '100%',
  },
  partnerActive: {
    alignItems: 'center',
  },
  partnerActiveText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#059669',
    textAlign: 'center',
    marginBottom: 12,
  },
  businessInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  verifiedBadge: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#10B981',
  },
  partnerInactive: {
    alignItems: 'center',
  },
  partnerInactiveText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  partnerDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  menuCard: {
    marginBottom: 16,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 12,
  },
  languageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginRight: 8,
  },
  logoutCard: {
    marginBottom: 32,
  },
  logoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
    marginLeft: 8,
  },
  logoutTextGreen: {
    color: '#10B981',
  },
  dangerText: {
    color: '#EF4444',
  },
  biometricTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  biometricSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  biometricCard: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  biometricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  biometricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  biometricInfo: {
    flex: 1,
  },
  biometricTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  biometricDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  biometricSwitch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  biometricBenefits: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  benefitsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0369A1',
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0369A1',
    marginBottom: 4,
    lineHeight: 18,
  },
});