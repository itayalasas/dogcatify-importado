import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, TextInput, Platform } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Trash2, TriangleAlert as AlertTriangle, Shield } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';
import { envConfig } from '../../utils/envConfig';

const DOGCATIFY_STORAGE_BUCKET = 'dogcatify';
const SAVED_CREDENTIALS_KEY = '@saved_credentials';
const BIOMETRIC_EMAIL_KEY = 'biometric_email';
const BIOMETRIC_PASSWORD_KEY = 'biometric_password';

const extractDogcatifyStoragePath = (value?: string | null) => {
  const rawValue = String(value || '').replace(/^VIDEO:/, '');
  const marker = `/storage/v1/object/public/${DOGCATIFY_STORAGE_BUCKET}/`;
  const markerIndex = rawValue.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const pathWithQuery = rawValue.slice(markerIndex + marker.length);
  const path = pathWithQuery.split('?')[0];

  return path ? decodeURIComponent(path) : null;
};

const removeDogcatifyStorageObjects = async (values: Array<string | null | undefined>) => {
  const paths = Array.from(
    new Set(
      values
        .map(extractDogcatifyStoragePath)
        .filter((path): path is string => Boolean(path))
    )
  );

  if (paths.length === 0) {
    return;
  }

  const { error } = await supabaseClient.storage
    .from(DOGCATIFY_STORAGE_BUCKET)
    .remove(paths);

  if (error) {
  }
};

const clearLocalAuthArtifacts = async () => {
  try {
    await AsyncStorage.removeItem(SAVED_CREDENTIALS_KEY);
  } catch (error) {
  }

  if (Platform.OS === 'web') {
    return;
  }

  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
  } catch (error) {
  }
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export default function DeleteAccount() {
  const { currentUser, logout } = useAuth();
  const [confirmationText, setConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Warning, 2: Confirmation
  const [deletionProgress, setDeletionProgress] = useState<string[]>([]);

  const handleDeleteAccount = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'No hay usuario autenticado');
      return;
    }

    if (confirmationText !== 'ELIMINAR MI CUENTA') {
      Alert.alert('Error', 'Debes escribir exactamente "ELIMINAR MI CUENTA" para confirmar');
      return;
    }

    setLoading(true);
    try {
      setDeletionProgress(['Iniciando proceso de eliminación...']);

      setDeletionProgress(prev => [...prev, 'Verificando datos de negocio...']);
      const { data: existingPartnerData, error: existingPartnerError } = await supabaseClient
        .from('partners')
        .select('id')
        .eq('user_id', currentUser.id);

      if (existingPartnerError) {
        throw new Error(`No se pudo verificar si hay negocios asociados: ${existingPartnerError.message}`);
      }

      if (existingPartnerData && existingPartnerData.length > 0) {
        setDeletionProgress(prev => [...prev, 'Error: Usuario tiene negocios asociados']);
        Alert.alert(
          'Cuenta con negocio',
          'Tu cuenta tiene negocios asociados. Para eliminar tu cuenta, primero debes transferir o eliminar tus negocios. Contacta con soporte para asistencia.',
          [{ text: 'Entendido', onPress: () => setLoading(false) }]
        );
        return;
      }

      // 1. Delete user's pets and related data
      const { data: userPets, error: petsError } = await supabaseClient
        .from('pets')
        .select('id, photo_url')
        .eq('owner_id', currentUser.id);

      setDeletionProgress(prev => [...prev, 'Verificando mascotas del usuario...']);

      if (petsError) {
      } else {
        await removeDogcatifyStorageObjects((userPets || []).map((pet: any) => pet.photo_url));
      }

      setDeletionProgress(prev => [...prev, 'Eliminando archivos y albumes del usuario...']);
      const { data: userAlbums, error: userAlbumsError } = await supabaseClient
        .from('pet_albums')
        .select('id, images')
        .eq('user_id', currentUser.id);

      if (userAlbumsError) {
      } else {
        const albumMedia = (userAlbums || []).flatMap((album: any) =>
          Array.isArray(album.images) ? album.images : []
        );
        await removeDogcatifyStorageObjects(albumMedia);
      }

      const petIds = (userPets || []).map((pet: any) => pet.id).filter(Boolean);
      const albumIds = (userAlbums || []).map((album: any) => album.id).filter(Boolean);
      const postsToDeleteById = new Set<string>();

      const { data: postsByUser, error: postsByUserError } = await supabaseClient
        .from('posts')
        .select('id')
        .eq('user_id', currentUser.id);

      if (postsByUserError) {
        throw new Error(`No se pudieron cargar las publicaciones del usuario: ${postsByUserError.message}`);
      }

      (postsByUser || []).forEach((post: any) => postsToDeleteById.add(post.id));

      if (petIds.length > 0) {
        const { data: postsByPet, error: postsByPetError } = await supabaseClient
          .from('posts')
          .select('id')
          .in('pet_id', petIds);

        if (postsByPetError) {
          throw new Error(`No se pudieron cargar publicaciones de mascotas: ${postsByPetError.message}`);
        }

        (postsByPet || []).forEach((post: any) => postsToDeleteById.add(post.id));
      }

      if (albumIds.length > 0) {
        const { data: postsByAlbum, error: postsByAlbumError } = await supabaseClient
          .from('posts')
          .select('id')
          .in('album_id', albumIds);

        if (postsByAlbumError) {
          throw new Error(`No se pudieron cargar publicaciones de albumes: ${postsByAlbumError.message}`);
        }

        (postsByAlbum || []).forEach((post: any) => postsToDeleteById.add(post.id));
      }

      const postIds = Array.from(postsToDeleteById);

      if (postIds.length > 0) {
        const { error: postCommentsDeleteError } = await supabaseClient
          .from('comments')
          .delete()
          .in('post_id', postIds);

        if (postCommentsDeleteError) {
        }

        const { error: postsDeleteError } = await supabaseClient
          .from('posts')
          .delete()
          .in('id', postIds);

        if (postsDeleteError) {
        }

        setDeletionProgress(prev => [...prev, 'Eliminando publicaciones y comentarios asociados a mascotas...']);
      }

      const { error: userAlbumsDeleteError } = await supabaseClient
        .from('pet_albums')
        .delete()
        .eq('user_id', currentUser.id);

      if (userAlbumsDeleteError) {
        throw new Error(`No se pudieron eliminar los albumes del usuario: ${userAlbumsDeleteError.message}`);
      }

      if (userPets && userPets.length > 0) {
        for (const pet of userPets) {
          // Delete pet health records
          await supabaseClient
            .from('pet_health')
            .delete()
            .eq('pet_id', pet.id);

          setDeletionProgress(prev => [...prev, `Eliminando registros de salud de ${pet.id}...`]);

          // Delete pet albums
          await supabaseClient
            .from('pet_albums')
            .delete()
            .eq('pet_id', pet.id);

          setDeletionProgress(prev => [...prev, `Eliminando álbumes de ${pet.id}...`]);

          // Delete pet behavior records
          await supabaseClient
            .from('pet_behavior')
            .delete()
            .eq('pet_id', pet.id);

          setDeletionProgress(prev => [...prev, `Eliminando registros de comportamiento de ${pet.id}...`]);

          // Delete bookings related to this pet
          await supabaseClient
            .from('bookings')
            .delete()
            .eq('pet_id', pet.id);

          setDeletionProgress(prev => [...prev, `Eliminando reservas de ${pet.id}...`]);

          const { error: reviewsError } = await supabaseClient
            .from('service_reviews')
            .delete()
            .eq('pet_id', pet.id);
          
          if (reviewsError) {
          } else {
          }

          const { error: behaviorError } = await supabaseClient
            .from('pet_behavior')
            .delete()
            .eq('pet_id', pet.id);
          
          if (behaviorError) {
          } else {
          }
          
          const { error: alertsError } = await supabaseClient
            .from('medical_alerts')
            .delete()
            .eq('pet_id', pet.id);
          
          if (alertsError) {
          } else {
          }
          
          const { error: tokensError } = await supabaseClient
            .from('medical_history_tokens')
            .delete()
            .eq('pet_id', pet.id);
          
          if (tokensError) {
          } else {
          }
        }

        // Delete all pets
        await supabaseClient
          .from('pets')
          .delete()
          .eq('owner_id', currentUser.id);

        setDeletionProgress(prev => [...prev, 'Eliminando perfiles de mascotas...']);
      }

      // 2. Delete user's posts and comments
      setDeletionProgress(prev => [...prev, 'Eliminando publicaciones y comentarios...']);
      
      // Get user's posts to delete related comments
      const { data: userPosts } = await supabaseClient
        .from('posts')
        .select('id')
        .eq('user_id', currentUser.id);

      if (userPosts && userPosts.length > 0) {
        for (const post of userPosts) {
          // Delete comments on this post
          await supabaseClient
            .from('comments')
            .delete()
            .eq('post_id', post.id);

          setDeletionProgress(prev => [...prev, `Eliminando comentarios del post ${post.id}...`]);
        }
      }

      // Delete user's posts
      await supabaseClient
        .from('posts')
        .delete()
        .eq('user_id', currentUser.id);

      setDeletionProgress(prev => [...prev, 'Eliminando publicaciones del usuario...']);

      // Delete user's comments on other posts
      await supabaseClient
        .from('comments')
        .delete()
        .eq('user_id', currentUser.id);

      setDeletionProgress(prev => [...prev, 'Eliminando comentarios en otras publicaciones...']);

      // Delete user-level data (not pet-specific)
      setDeletionProgress(prev => [...prev, 'Eliminando tokens de confirmación de email...']);
      const { error: emailConfirmationsError } = await supabaseClient
        .from('email_confirmations')
        .delete()
        .eq('user_id', currentUser.id);
      
      if (emailConfirmationsError) {
        setDeletionProgress(prev => [...prev, `⚠️ Error eliminando confirmaciones: ${emailConfirmationsError.message}`]);
      } else {
        setDeletionProgress(prev => [...prev, '✅ Tokens de confirmación eliminados']);
      }
      
      const { data: userConversations } = await supabaseClient
        .from('chat_conversations')
        .select('id')
        .eq('user_id', currentUser.id);

      if (userConversations && userConversations.length > 0) {
        for (const conversation of userConversations) {
          // Delete messages in this conversation
          setDeletionProgress(prev => [...prev, `Eliminando mensajes de conversación ${conversation.id}...`]);
          await supabaseClient
            .from('chat_messages')
            .delete()
            .eq('conversation_id', conversation.id);
        }

        // Delete conversations
        await supabaseClient
          .from('chat_conversations')
          .delete()
          .eq('user_id', currentUser.id);
      }
      
      const { data: adoptionChats } = await supabaseClient
        .from('adoption_chats')
        .select('id')
        .eq('customer_id', currentUser.id);

      if (adoptionChats && adoptionChats.length > 0) {
        for (const chat of adoptionChats) {
          // Delete adoption messages
          setDeletionProgress(prev => [...prev, `Eliminando mensajes de adopción ${chat.id}...`]);
          await supabaseClient
            .from('adoption_messages')
            .delete()
            .eq('chat_id', chat.id);
        }

        // Delete adoption chats
        await supabaseClient
          .from('adoption_chats')
          .delete()
          .eq('customer_id', currentUser.id);
      }
      
      // Delete user-level data (not pet-specific)
      const { error: bookingsError } = await supabaseClient
        .from('bookings')
        .delete()
        .eq('customer_id', currentUser.id);
      
      if (bookingsError) {
      } else {
      }

      const { error: ordersError } = await supabaseClient
        .from('orders')
        .delete()
        .eq('customer_id', currentUser.id);
      
      if (ordersError) {
      } else {
      }

      const { error: cartError } = await supabaseClient
        .from('user_carts')
        .delete()
        .eq('user_id', currentUser.id);
      
      if (cartError) {
      } else {
      }

      const { error: reviewsError } = await supabaseClient
        .from('service_reviews')
        .delete()
        .eq('customer_id', currentUser.id);
      
      if (reviewsError) {
      } else {
      }

      // Handle partner data if user is a partner
      setDeletionProgress(prev => [...prev, 'Verificando datos de negocio...']);
      const { data: partnerData } = await supabaseClient
        .from('partners')
        .select('id')
        .eq('user_id', currentUser.id);

      if (partnerData && partnerData.length > 0) {
        setDeletionProgress(prev => [...prev, '❌ Error: Usuario tiene negocios asociados']);
        Alert.alert(
          'Cuenta con negocio',
          'Tu cuenta tiene negocios asociados. Para eliminar tu cuenta, primero debes transferir o eliminar tus negocios. Contacta con soporte para asistencia.',
          [{ text: 'Entendido', onPress: () => setLoading(false) }]
        );
        return;
      }

      // Delete user profile from profiles table
      setDeletionProgress(prev => [...prev, 'Eliminando perfil de usuario...']);
      
      // Delete user profile directly
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .delete()
        .eq('id', currentUser.id);
      
      if (profileError) {
        if (profileError.message?.includes('JWT expired')) {
          Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente.');
          router.replace('/auth/login');
          return;
        }
        setDeletionProgress(prev => [...prev, `❌ Error eliminando perfil: ${profileError.message}`]);
        throw new Error(`No se pudo eliminar el perfil: ${profileError.message}`);
      }
      
      setDeletionProgress(prev => [...prev, '✅ Perfil de usuario eliminado correctamente']);

      // Delete user from auth.users table (this requires admin privileges)
      setDeletionProgress(prev => [...prev, 'Eliminando usuario del sistema de autenticación...']);
      
      try {
        // Try to delete from auth.users table
        const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error('No hay sesion activa para eliminar el usuario de autenticacion');
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            userId: currentUser.id
          }),
        });

        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success) {
            setDeletionProgress(prev => [...prev, '✅ Usuario eliminado del sistema de autenticación']);
          } else {
            setDeletionProgress(prev => [...prev, `⚠️ No se pudo eliminar de auth: ${result.error}`]);
            setDeletionProgress(prev => [...prev, '⚠️ Continuando con logout forzado...']);
          }
        } else {
          const errorText = await response.text();
          setDeletionProgress(prev => [...prev, `⚠️ Error API auth (${response.status})`]);
          setDeletionProgress(prev => [...prev, '⚠️ Continuando con logout forzado...']);
        }
      } catch (authError) {
        setDeletionProgress(prev => [...prev, `⚠️ Error eliminando de auth: ${getErrorMessage(authError)}`]);
        setDeletionProgress(prev => [...prev, '⚠️ Continuando con logout forzado...']);
      }

      // Sign out user from current session
      setDeletionProgress(prev => [...prev, 'Cerrando sesión...']);
      await clearLocalAuthArtifacts();
      await logout();
      
      setDeletionProgress(prev => [...prev, '✅ Datos del usuario eliminados exitosamente']);
      setDeletionProgress(prev => [...prev, '✅ Sesión cerrada - Cuenta desactivada']);
      
      Alert.alert(
        'Datos eliminados',
        'Todos tus datos han sido eliminados de DogCatiFy. Tu cuenta ha sido desactivada y puedes crear una nueva cuenta con el mismo email si lo deseas.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setDeletionProgress(prev => [...prev, `❌ Error: ${errorMessage}`]);
      Alert.alert(
        'Error',
        `Ocurrió un error durante la eliminación: ${errorMessage}. Algunos datos pueden haber sido eliminados. Por favor contacta con soporte para completar el proceso.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToConfirmation = () => {
    setStep(2);
  };

  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Eliminar Cuenta</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={48} color="#EF4444" />
              <Text style={styles.warningTitle}>¡Atención!</Text>
            </View>
            
            <Text style={styles.warningText}>
              Estás a punto de eliminar permanentemente tu cuenta de DogCatiFy. Esta acción no se puede deshacer.
            </Text>
          </Card>

          <Card style={styles.dataCard}>
            <Text style={styles.dataTitle}>Se eliminarán los siguientes datos:</Text>
            
            <View style={styles.dataList}>
              <View style={styles.dataItem}>
                <Text style={styles.dataIcon}>🐾</Text>
                <Text style={styles.dataText}>Todos los perfiles de tus mascotas</Text>
              </View>
              
              <View style={styles.dataItem}>
                <Text style={styles.dataIcon}>📸</Text>
                <Text style={styles.dataText}>Todas las fotos y álbumes</Text>
              </View>
              
              <View style={styles.dataItem}>
                <Text style={styles.dataIcon}>📝</Text>
                <Text style={styles.dataText}>Todas tus publicaciones y comentarios</Text>
              </View>
              
              <View style={styles.dataItem}>
                <Text style={styles.dataIcon}>🏥</Text>
                <Text style={styles.dataText}>Registros médicos y de salud</Text>
              </View>
              
              <View style={styles.dataItem}>
                <Text style={styles.dataIcon}>📅</Text>
                <Text style={styles.dataText}>Historial de reservas y citas</Text>
              </View>
              
              <View style={styles.dataItem}>
                <Text style={styles.dataIcon}>🛒</Text>
                <Text style={styles.dataText}>Historial de compras y pedidos</Text>
              </View>
              
              <View style={styles.dataItem}>
                <Text style={styles.dataIcon}>💬</Text>
                <Text style={styles.dataText}>Conversaciones y mensajes</Text>
              </View>
              
              <View style={styles.dataItem}>
                <Text style={styles.dataIcon}>👤</Text>
                <Text style={styles.dataText}>Tu perfil y información personal</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.alternativeCard}>
            <Text style={styles.alternativeTitle}>¿Consideraste estas alternativas?</Text>
            
            <View style={styles.alternativeList}>
              <Text style={styles.alternativeItem}>
                • Desactivar temporalmente tu cuenta
              </Text>
              <Text style={styles.alternativeItem}>
                • Cambiar tu configuración de privacidad
              </Text>
              <Text style={styles.alternativeItem}>
                • Contactar con soporte para resolver problemas
              </Text>
            </View>
          </Card>

          <View style={styles.actionButtons}>
            <Button
              title="Cancelar"
              onPress={() => router.back()}
              variant="outline"
              size="large"
            />
            
            <Button
              title="Continuar con la eliminación"
              onPress={handleContinueToConfirmation}
              size="large"
              style={styles.dangerButton}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Confirmar Eliminación</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.confirmationCard}>
          <View style={styles.confirmationHeader}>
            <Shield size={48} color="#EF4444" />
            <Text style={styles.confirmationTitle}>Confirmación Final</Text>
          </View>
          
          <Text style={styles.confirmationText}>
            Para confirmar que deseas eliminar permanentemente tu cuenta, escribe exactamente:
          </Text>
          
          <View style={styles.confirmationPhrase}>
            <Text style={styles.phraseText}>ELIMINAR MI CUENTA</Text>
          </View>
          
          <TextInput
            style={styles.confirmationInput}
            placeholder="Escribe la frase exacta aquí"
            value={confirmationText}
            onChangeText={setConfirmationText}
            autoCapitalize="characters"
          />
          
          {/* Progress indicator during deletion */}
          {loading && deletionProgress.length > 0 && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressTitle}>Progreso de eliminación:</Text>
              <ScrollView style={styles.progressScroll} showsVerticalScrollIndicator={false}>
                {deletionProgress.map((step, index) => (
                  <Text key={index} style={styles.progressStep}>
                    {step}
                  </Text>
                ))}
              </ScrollView>
            </View>
          )}
          
          <Text style={styles.confirmationNote}>
            Esta acción es irreversible. Una vez eliminada, no podrás recuperar tu cuenta ni tus datos.
          </Text>
        </Card>

        <View style={styles.finalActions}>
          <Button
            title="Cancelar"
            onPress={() => router.back()}
            variant="outline" 
            size="large"
          />
          
          <Button
            title={loading ? "Eliminando..." : "Eliminar mi cuenta permanentemente"}
            onPress={handleDeleteAccount}
            loading={loading}
            disabled={confirmationText !== 'ELIMINAR MI CUENTA' || loading}
            size="large"
            style={styles.deleteButton}
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
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  warningCard: {
    marginBottom: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  warningHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginTop: 8,
  },
  warningText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#991B1B',
    textAlign: 'center',
    lineHeight: 24,
  },
  dataCard: {
    marginBottom: 16,
  },
  dataTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  dataList: {
    gap: 12,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
  },
  dataText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
  alternativeCard: {
    marginBottom: 24,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  alternativeTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0369A1',
    marginBottom: 12,
  },
  alternativeList: {
    gap: 8,
  },
  alternativeItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#0369A1',
    lineHeight: 20,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 24,
  },
  dangerButton: {
    backgroundColor: '#EF4444',
  },
  confirmationCard: {
    marginBottom: 24,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmationTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginTop: 8,
  },
  confirmationText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#991B1B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  confirmationPhrase: {
    backgroundColor: '#991B1B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  phraseText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  confirmationInput: {
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  confirmationNote: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#991B1B',
    textAlign: 'center',
    lineHeight: 20,
  },
  finalActions: {
    gap: 12,
    marginBottom: 24,
  },
  deleteButton: {
    backgroundColor: '#991B1B',
  },
  progressContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    maxHeight: 200,
  },
  progressTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  progressScroll: {
    maxHeight: 150,
  },
  progressStep: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
});
