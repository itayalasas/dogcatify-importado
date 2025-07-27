import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { User, Settings, LogOut, MapPin, Plus, Heart, ShoppingBag, Calendar, Bell, Shield, Globe, HelpCircle, CreditCard } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useBiometric } from '../../contexts/BiometricContext';
import { supabaseClient } from '../../lib/supabase';

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { isBiometricSupported, isBiometricEnabled, disableBiometric } = useBiometric();
  const [userStats, setUserStats] = useState({
    pets: 0,
    posts: 0,
    followers: 0,
    following: 0,
  });

  useEffect(() => {
    if (currentUser) {
      fetchUserStats();
    }
  }, [currentUser]);

  const fetchUserStats = async () => {
    if (!currentUser) return;
    
    try {
      // Fetch pets count
      const { count: petsCount } = await supabaseClient
        .from('pets')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', currentUser.id);

      // Fetch posts count
      const { count: postsCount } = await supabaseClient
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);

      setUserStats({
        pets: petsCount || 0,
        posts: postsCount || 0,
        followers: currentUser.followersCount || 0,
        following: currentUser.followingCount || 0,
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
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
            try {
              await logout();
              router.replace('/auth/login');
            } catch (error) {
              console.error('Error logging out:', error);
            }
          }
        }
      ]
    );
  };

  const handleDisableBiometric = async () => {
    Alert.alert(
      'Desactivar Autenticación Biométrica',
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
  };

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
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image 
              source={{ 
                uri: currentUser.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100' 
              }} 
              style={styles.profileImage} 
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {currentUser.displayName || 'Usuario'}
              </Text>
              <Text style={styles.profileEmail}>{currentUser.email}</Text>
            </View>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => router.push('/profile/edit')}
            >
              <Settings size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
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
              <Text style={styles.statLabel}>{t('followers')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats.following}</Text>
              <Text style={styles.statLabel}>{t('following')}</Text>
            </View>
          </View>
        </Card>

        {/* Contribute Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌟 Contribuir a la Comunidad</Text>
          
          <Card style={styles.contributeCard}>
            <TouchableOpacity 
              style={styles.contributeOption}
              onPress={() => router.push('/places/add')}
            >
              <View style={styles.contributeIcon}>
                <MapPin size={24} color="#10B981" />
              </View>
              <View style={styles.contributeInfo}>
                <Text style={styles.contributeTitle}>Agregar Lugar Pet-Friendly</Text>
                <Text style={styles.contributeDescription}>
                  Ayuda a otros dueños agregando lugares que acepten mascotas
                </Text>
              </View>
              <Plus size={20} color="#6B7280" />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          
          <Card style={styles.actionsCard}>
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => router.push('/orders')}
            >
              <ShoppingBag size={20} color="#6B7280" />
              <Text style={styles.actionText}>{t('myOrders')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => router.push('/cart')}
            >
              <ShoppingBag size={20} color="#6B7280" />
              <Text style={styles.actionText}>Mi Carrito</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>
          
          <Card style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingItem}>
              <Bell size={20} color="#6B7280" />
              <Text style={styles.settingText}>{t('notifications')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <Shield size={20} color="#6B7280" />
              <Text style={styles.settingText}>{t('privacySecurity')}</Text>
            </TouchableOpacity>

            {isBiometricSupported && isBiometricEnabled && (
              <TouchableOpacity 
                style={styles.settingItem}
                onPress={handleDisableBiometric}
              >
                <Shield size={20} color="#6B7280" />
                <Text style={styles.settingText}>{t('biometricAuth')}</Text>
                <Text style={styles.settingStatus}>Activo</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => setLanguage(language === 'es' ? 'en' : 'es')}
            >
              <Globe size={20} color="#6B7280" />
              <Text style={styles.settingText}>{t('language')}</Text>
              <Text style={styles.settingStatus}>
                {language === 'es' ? 'Español' : 'English'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <HelpCircle size={20} color="#6B7280" />
              <Text style={styles.settingText}>{t('helpSupport')}</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Business Registration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Negocio</Text>
          
          <Card style={styles.businessCard}>
            <View style={styles.businessHeader}>
              <View style={styles.businessIcon}>
                <CreditCard size={24} color="#3B82F6" />
              </View>
              <View style={styles.businessInfo}>
                <Text style={styles.businessTitle}>¿Tienes un negocio?</Text>
                <Text style={styles.businessDescription}>
                  Únete como aliado y ofrece servicios a la comunidad
                </Text>
              </View>
            </View>
            <Button
              title="Registrar Negocio"
              onPress={() => router.push('/(tabs)/partner-register')}
              variant="outline"
              size="medium"
            />
          </Card>
        </View>

        {/* Logout */}
        <View style={styles.logoutSection}>
          <Button
            title="Cerrar Sesión"
            onPress={handleLogout}
            variant="outline"
            size="large"
          />
        </View>
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
  content: {
    flex: 1,
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
    margin: 16,
    marginBottom: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
  },
  editButton: {
    padding: 8,
    backgroundColor: '#EBF8FF',
    borderRadius: 8,
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
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  contributeCard: {
    marginHorizontal: 16,
  },
  contributeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  contributeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contributeInfo: {
    flex: 1,
  },
  contributeTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  contributeDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  actionsCard: {
    marginHorizontal: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 16,
  },
  settingsCard: {
    marginHorizontal: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 16,
    flex: 1,
  },
  settingStatus: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  businessCard: {
    marginHorizontal: 16,
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  businessIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EBF8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  businessInfo: {
    flex: 1,
  },
  businessTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  businessDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  logoutSection: {
    margin: 16,
    marginTop: 8,
    marginBottom: 32,
  },
});