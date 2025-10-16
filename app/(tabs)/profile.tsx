import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Switch } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { User, Settings, Heart, ShoppingBag, Calendar, LogOut, CreditCard as Edit, Bell, Shield, CircleHelp as HelpCircle, Globe, Building, CreditCard, Fingerprint, ChevronRight, ArrowRight, Trash2 } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useBiometric } from '../../contexts/BiometricContext';
import { supabaseClient } from '../../lib/supabase';

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { expoPushToken, registerForPushNotifications } = useNotifications();
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
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  
  // Computed values for notifications
  const isExpoGo = Constants.appOwnership === 'expo';
  const isPhysicalDevice = Device.isDevice;
  const hasNotificationToken = !!expoPushToken;
  const notificationsSupported = !isExpoGo && isPhysicalDevice;
  const notificationsEnabled = notificationsSupported && hasNotificationToken;

  useEffect(() => {
    if (currentUser) {
      fetchUserStats();
      fetchPartnerProfile();
    }
  }, [currentUser?.id, currentUser?.displayName, currentUser?.photoURL]);

  // Set up real-time subscription for profile updates
  useEffect(() => {
    if (!currentUser) return;
    
    console.log('Setting up real-time subscriptions for user:', currentUser.id);
    
    // Subscribe to changes in the current user's profile
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
          console.log('=== REAL-TIME: Current user profile updated ===');
          console.log('Updated fields:', payload.new);
          fetchUserStats();
        }
      )
      // Also subscribe to ANY profile changes that might affect followers
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public', 
          table: 'profiles'
        },
        (payload) => {
          // Check if the updated profile's following array includes current user
          const updatedFollowing = payload.new?.following || [];
          const oldFollowing = payload.old?.following || [];
          
          const wasFollowing = oldFollowing.includes(currentUser.id);
          const isNowFollowing = updatedFollowing.includes(currentUser.id);
          
          // If someone started or stopped following current user, update stats
          if (wasFollowing !== isNowFollowing) {
            console.log('=== REAL-TIME: Follower status changed ===');
            console.log('User', payload.new?.display_name, isNowFollowing ? 'started following' : 'stopped following', 'current user');
            fetchUserStats();
          }
        }
      )
      .subscribe();
    
    console.log('Real-time subscription established');
    
    return () => {
      console.log('Cleaning up real-time subscription');
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

      // Fetch followers count - buscar usuarios que tienen a este usuario en su array 'following'
      console.log('=== FETCHING FOLLOWERS ===');
      console.log('Looking for users who have', currentUser!.id, 'in their following array');
      const { data: followersData, error: followersError } = await supabaseClient
        .from('profiles')
        .select('id, display_name')
        .contains('following', [currentUser!.id]);
      
      if (followersError) {
        console.error('Error fetching followers:', followersError);
      }
      
      const followersCount = followersData?.length || 0;
      console.log('Followers found:', followersData?.map(f => ({ id: f.id, name: f.display_name })) || []);
      console.log('Total followers count:', followersCount);
      
      // Fetch following count - obtener el array 'following' del usuario actual
      console.log('=== FETCHING FOLLOWING ===');
      console.log('Getting following array for user:', currentUser!.id);
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('following, followers')
        .eq('id', currentUser!.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile data:', profileError);
      }
      
      const followingArray = profileData?.following || [];
      const followersArray = profileData?.followers || [];
      
      // Validate and clean arrays
      const validFollowing = followingArray.filter((id: any) => id && typeof id === 'string' && id.trim() !== '');
      const validFollowers = followersArray.filter((id: any) => id && typeof id === 'string' && id.trim() !== '');
      
      const followingCount = validFollowing.length;
      const localFollowersCount = validFollowers.length;
      
      console.log('Following array from profile:', validFollowing);
      console.log('Followers array from profile:', validFollowers);
      console.log('Following count:', followingCount);
      console.log('Local followers count:', localFollowersCount);
      
      // Use the higher count between database query and local array
      // This handles cases where the arrays might be out of sync
      const finalFollowersCount = Math.max(followersCount, localFollowersCount);
      
      console.log('Updated stats:', {
        petsCount: petsCount || 0,
        postsCount: postsCount || 0,
        followersCount: finalFollowersCount,
        followingCount,
        followersFromQuery: followersData?.map(f => f.display_name) || [],
        followersFromProfile: validFollowers,
        followingArray: validFollowing,
        finalFollowersCount
      });
      
      setUserStats({
        petsCount: petsCount || 0,
        postsCount: postsCount || 0,
        followersCount: finalFollowersCount,
        followingCount
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Set default stats on error
      setUserStats({
        petsCount: 0,
        postsCount: 0,
        followersCount: 0,
        followingCount: 0
      });
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

  const handleToggleNotifications = async () => {
    try {
      if (Constants.appOwnership === 'expo') {
        Alert.alert(
          'No disponible en Expo Go',
          'Las notificaciones push no están disponibles en Expo Go. Necesitas una build de desarrollo o producción.',
          [{ text: 'Entendido' }]
        );
        return;
      }

      if (!Device.isDevice) {
        Alert.alert(
          'Dispositivo no compatible',
          'Las notificaciones push solo funcionan en dispositivos físicos, no en simuladores.',
          [{ text: 'Entendido' }]
        );
        return;
      }

      if (notificationsEnabled) {
        // Notificaciones ya habilitadas - mostrar opciones
        Alert.alert(
          'Notificaciones Habilitadas ✅',
          `Las notificaciones push están funcionando correctamente.\n\n📱 Token configurado\n🔔 Permisos concedidos\n\n¿Qué quieres hacer?`,
          [
            { text: 'Cerrar', style: 'cancel' },
            { 
              text: 'Probar Notificación', 
              onPress: () => testPushNotification()
            },
            {
              text: 'Ver Detalles',
              onPress: () => showNotificationDetails()
            }
          ]
        );
      } else {
        // Intentar habilitar notificaciones
        Alert.alert(
          'Habilitar Notificaciones',
          '¿Quieres habilitar las notificaciones push para recibir actualizaciones importantes sobre reservas, pedidos y mensajes?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Habilitar', 
              onPress: () => enableNotifications()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error in handleToggleNotifications:', error);
      Alert.alert('Error', 'Hubo un problema con la configuración de notificaciones');
    }
  };

  const showNotificationDetails = () => {
    Alert.alert(
      '🔔 Detalles de Notificaciones',
      `Estado: ✅ Activas\n\nTipo de notificaciones que recibirás:\n• Confirmaciones de reservas\n• Actualizaciones de pedidos\n• Mensajes de adopción\n• Recordatorios médicos\n• Ofertas especiales\n\nToken: ${expoPushToken?.substring(0, 30)}...`,
      [
        { text: 'Cerrar', style: 'cancel' },
        { 
          text: 'Probar Ahora', 
          onPress: () => testPushNotification()
        }
      ]
    );
  };

  const enableNotifications = async () => {
    setNotificationsLoading(true);
    try {
      console.log('🔔 Attempting to enable notifications...');
      
      const token = await registerForPushNotifications();
      
      if (token) {
        console.log('✅ Notifications enabled successfully');
        Alert.alert(
          '¡Notificaciones Habilitadas! 🎉',
          `✅ Las notificaciones push han sido configuradas correctamente.\n\n📱 Ahora recibirás notificaciones sobre:\n• Reservas confirmadas\n• Pedidos actualizados\n• Mensajes de adopción\n• Recordatorios médicos\n\n¿Quieres probar enviando una notificación?`,
          [
            { text: 'Más tarde', style: 'cancel' },
            { 
              text: 'Probar Ahora', 
              onPress: () => testPushNotification()
            }
          ]
        );
      } else {
        console.log('❌ Failed to get notification token');
        Alert.alert(
          'No se pudieron habilitar',
          'Las notificaciones no se pudieron configurar.\n\nPosibles causas:\n• Permisos denegados por el usuario\n• Error de configuración del proyecto\n• Problema de conectividad\n\nPuedes intentar habilitarlas desde la configuración del dispositivo o contactar soporte.',
          [{ text: 'Entendido' }]
        );
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      Alert.alert(
        'Error al Habilitar',
        `Hubo un problema técnico al habilitar las notificaciones.\n\nError: ${error.message || 'Desconocido'}\n\nPuedes intentar:\n• Verificar permisos en configuración\n• Reiniciar la app\n• Contactar soporte si persiste`,
        [{ text: 'Entendido' }]
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  const testPushNotification = async () => {
    if (!expoPushToken) {
      Alert.alert('Error', 'No hay token de notificación disponible');
      return;
    }

    try {
      console.log('🧪 Testing push notification...');
      
      // Send test notification using the utility function
      const { NotificationService } = await import('../../utils/notifications');
      
      await NotificationService.sendPushNotification(
        expoPushToken,
        '🐾 Prueba DogCatiFy',
        '¡Las notificaciones están funcionando perfectamente!',
        {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      );
      
      Alert.alert(
        'Notificación Enviada 📤',
        'Se envió una notificación de prueba a tu dispositivo. Deberías recibirla en unos segundos.\n\nSi no la recibes, verifica:\n• Permisos de notificación en configuración\n• Que la app no esté en "No molestar"\n• Tu conexión a internet',
        [{ text: 'Perfecto' }]
      );
    } catch (error) {
      console.error('Error testing notification:', error);
      Alert.alert(
        'Error en la Prueba',
        `No se pudo enviar la notificación de prueba.\n\nError: ${error.message || 'Desconocido'}\n\nVerifica tu conexión e intenta nuevamente.`,
        [{ text: 'Entendido' }]
      );
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

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar sesión', 
          style: 'destructive',
          onPress: logout
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
          <LoadingSpinner message="Cargando perfil..." size="medium" />
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
          {/* Notificaciones Push Card - Estilo consistente con Face ID */}
          <View style={styles.notificationCard}>
            <View style={styles.notificationHeader}>
              <View style={styles.notificationIconContainer}>
                <Bell size={24} color="#2D6A6F" />
              </View>
              <View style={styles.notificationInfo}>
                <Text style={styles.notificationTitle}>Notificaciones Push v2</Text>
                <Text style={styles.notificationDescription}>
                  {notificationsEnabled ? 
                    '🔔 Habilita para recibir actualizaciones importantes' :
                    notificationsSupported ?
                      '🔔 Habilita para recibir notificaciones' :
                      isExpoGo ? 
                        '❌ No disponible en Expo Go' :
                        '❌ Dispositivo no compatible'
                  }
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.notificationToggle,
                  notificationsEnabled && styles.notificationToggleActive,
                  !notificationsSupported && styles.notificationToggleDisabled
                ]}
                onPress={handleToggleNotifications}
                disabled={notificationsLoading || !notificationsSupported}
              >
                <View style={[
                  styles.notificationToggleHandle,
                  notificationsEnabled && styles.notificationToggleHandleActive,
                  notificationsLoading && styles.notificationToggleHandleLoading
                ]} />
              </TouchableOpacity>
            </View>
            
            {notificationsEnabled ? (
              <View style={styles.notificationStatus}>
                <Text style={styles.statusTitle}>Estado de las notificaciones:</Text>
                <Text style={styles.statusItem}>✅ Permisos concedidos</Text>
                <Text style={styles.statusItem}>📱 Token configurado</Text>
                <Text style={styles.statusItem}>🔔 Recibiendo notificaciones</Text>
                <TouchableOpacity style={styles.testButton} onPress={testPushNotification}>
                  <Text style={styles.testButtonText}>Probar notificación</Text>
                </TouchableOpacity>
              </View>
            ) : !notificationsSupported ? (
              <View style={styles.notificationBenefits}>
                <Text style={styles.benefitsTitle}>Limitaciones:</Text>
                <Text style={styles.benefitItem}>
                  {isExpoGo ? 
                    '• Expo Go no soporta notificaciones push' :
                    '• Este dispositivo no soporta notificaciones'
                  }
                </Text>
                <Text style={styles.benefitItem}>
                  {isExpoGo ? 
                    '• Necesitas una build nativa para usar esta función' :
                    '• Usa un dispositivo físico para mejores resultados'
                  }
                </Text>
              </View>
            ) : (
              <View style={styles.notificationBenefits}>
                <Text style={styles.benefitsTitle}>Beneficios:</Text>
                <Text style={styles.benefitItem}>• Confirmaciones de reservas</Text>
                <Text style={styles.benefitItem}>• Actualizaciones de pedidos</Text>
                <Text style={styles.benefitItem}>• Mensajes de adopción</Text>
                <Text style={styles.benefitItem}>• Recordatorios médicos</Text>
                <Text style={styles.benefitItem}>• Ofertas especiales</Text>
              </View>
            )}
          </View>

          {/* Biometric Authentication - Estilo consistente */}
          {isBiometricSupported && (
            <View style={styles.biometricCard}>
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
                <TouchableOpacity
                  style={[
                    styles.biometricToggle,
                    isBiometricEnabled && styles.biometricToggleActive
                  ]}
                  onPress={handleToggleBiometric}
                >
                  <View style={[
                    styles.biometricToggleHandle,
                    isBiometricEnabled && styles.biometricToggleHandleActive
                  ]} />
                </TouchableOpacity>
              </View>
              
              {!isBiometricEnabled && (
                <View style={styles.biometricBenefits}>
                  <Text style={styles.benefitsTitle}>Beneficios:</Text>
                  <Text style={styles.benefitItem}>• Acceso instantáneo sin contraseñas</Text>
                  <Text style={styles.benefitItem}>• Máxima seguridad con tu {biometricType?.toLowerCase() || 'biometría'}</Text>
                  <Text style={styles.benefitItem}>• Credenciales protegidas en tu dispositivo</Text>
                </View>
              )}
            </View>
          )}

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
  // Notification Card Styles (consistente con Face ID)
  notificationCard: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    borderRadius: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  notificationDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  notificationToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    padding: 2,
  },
  notificationToggleActive: {
    backgroundColor: '#2D6A6F',
  },
  notificationToggleDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.5,
  },
  notificationToggleHandle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationToggleHandleActive: {
    transform: [{ translateX: 20 }],
  },
  notificationToggleHandleLoading: {
    opacity: 0.7,
  },
  notificationStatus: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  notificationBenefits: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  statusTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 8,
  },
  statusItem: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    marginBottom: 4,
    lineHeight: 18,
  },
  testButton: {
    backgroundColor: '#2D6A6F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
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
  
  // Biometric Card Styles (consistente con notificaciones)
  biometricCard: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    borderRadius: 12,
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
  biometricToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    padding: 2,
  },
  biometricToggleActive: {
    backgroundColor: '#2D6A6F',
  },
  biometricToggleHandle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  biometricToggleHandleActive: {
    transform: [{ translateX: 20 }],
  },
  biometricBenefits: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
});