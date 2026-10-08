import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, TextInput, Platform } from 'react-native';
import { router } from 'expo-router';
import { TriangleAlert as AlertTriangle, Shield, PawPrint, Image as ImageIcon, FileText, Stethoscope, Calendar, ShoppingBag, MessageCircle, UserRound, LifeBuoy } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { colors, typography, spacing, radius } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient, setSuppressTokenExpirationAlerts } from '../../lib/supabase';
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

const removeDogcatifyStorageObjects = async (values: (string | null | undefined)[]) => {
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
    console.warn('Could not remove some user storage objects during account deletion:', error);
  }
};

const clearLocalAuthArtifacts = async () => {
  try {
    await AsyncStorage.removeItem(SAVED_CREDENTIALS_KEY);
  } catch (error) {
    console.warn('Could not clear saved credentials during account deletion:', error);
  }

  if (Platform.OS === 'web') {
    return;
  }

  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
  } catch (error) {
    console.warn('Could not clear biometric credentials during account deletion:', error);
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
      Alert.alert('Error', 'Tenés que escribir exactamente "ELIMINAR MI CUENTA" para confirmar');
      return;
    }

    setLoading(true);
    try {
      setDeletionProgress(['Iniciando proceso de eliminación...']);
      console.log('Starting account deletion process for user:', currentUser.id);

      setDeletionProgress(prev => [...prev, 'Verificando datos de negocio...']);
      console.log('Checking for partner data before deleting anything...');
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
          'Tu cuenta tiene negocios asociados. Para eliminarla, primero tenés que transferir o eliminar tus negocios. Escribinos a soporte si necesitás ayuda.',
          [{ text: 'Entendido', onPress: () => setLoading(false) }]
        );
        return;
      }

      // 1. Delete user's pets and related data
      console.log('Deleting pets and related data...');
      const { data: userPets, error: petsError } = await supabaseClient
        .from('pets')
        .select('id, photo_url')
        .eq('owner_id', currentUser.id);

      setDeletionProgress(prev => [...prev, 'Verificando mascotas del usuario...']);

      if (petsError) {
        console.error('Error fetching user pets:', petsError);
      } else {
        await removeDogcatifyStorageObjects((userPets || []).map((pet: any) => pet.photo_url));
      }

      setDeletionProgress(prev => [...prev, 'Eliminando archivos y álbumes del usuario...']);
      const { data: userAlbums, error: userAlbumsError } = await supabaseClient
        .from('pet_albums')
        .select('id, images')
        .eq('user_id', currentUser.id);

      if (userAlbumsError) {
        console.warn('Could not load user albums before account deletion:', userAlbumsError);
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
          console.warn('Could not delete every comment on user-owned posts before account deletion:', postCommentsDeleteError);
        }

        const { error: postsDeleteError } = await supabaseClient
          .from('posts')
          .delete()
          .in('id', postIds);

        if (postsDeleteError) {
          console.warn('Could not delete every user/pet/album post before account deletion:', postsDeleteError);
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

          console.log('Step 7: Deleting service reviews...');
          const { error: reviewsError } = await supabaseClient
            .from('service_reviews')
            .delete()
            .eq('pet_id', pet.id);
          
          if (reviewsError) {
            console.error('Error deleting service reviews:', reviewsError);
            console.log('Continuing despite service reviews deletion error...');
          } else {
            console.log('Service reviews deleted successfully');
          }

          console.log('Step 8: Deleting behavior records...');
          const { error: behaviorError } = await supabaseClient
            .from('pet_behavior')
            .delete()
            .eq('pet_id', pet.id);
          
          if (behaviorError) {
            console.error('Error deleting behavior records:', behaviorError);
            console.log('Continuing despite behavior records deletion error...');
          } else {
            console.log('Behavior records deleted successfully');
          }
          
          console.log('Step 9: Deleting medical alerts...');
          const { error: alertsError } = await supabaseClient
            .from('medical_alerts')
            .delete()
            .eq('pet_id', pet.id);
          
          if (alertsError) {
            console.error('Error deleting medical alerts:', alertsError);
            console.log('Continuing despite medical alerts deletion error...');
          } else {
            console.log('Medical alerts deleted successfully');
          }
          
          console.log('Step 10: Deleting medical history tokens...');
          const { error: tokensError } = await supabaseClient
            .from('medical_history_tokens')
            .delete()
            .eq('pet_id', pet.id);
          
          if (tokensError) {
            console.error('Error deleting medical history tokens:', tokensError);
            console.log('Continuing despite tokens deletion error...');
          } else {
            console.log('Medical history tokens deleted successfully');
          }
        }

        console.log('Step 11: Now deleting the pet...');
        // Delete all pets
        await supabaseClient
          .from('pets')
          .delete()
          .eq('owner_id', currentUser.id);

        setDeletionProgress(prev => [...prev, 'Eliminando perfiles de mascotas...']);
      }

      // 2. Delete user's posts and comments
      setDeletionProgress(prev => [...prev, 'Eliminando publicaciones y comentarios...']);
      console.log('Deleting posts and comments...');
      
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
      setDeletionProgress(prev => [...prev, 'Eliminando enlaces de confirmación de correo...']);
      console.log('Step 12: Deleting email confirmations...');
      const { error: emailConfirmationsError } = await supabaseClient
        .from('email_confirmations')
        .delete()
        .eq('user_id', currentUser.id);
      
      if (emailConfirmationsError) {
        console.error('Error deleting email confirmations:', emailConfirmationsError);
        setDeletionProgress(prev => [...prev, `Error eliminando confirmaciones: ${emailConfirmationsError.message}`]);
      } else {
        console.log('Email confirmations deleted successfully');
        setDeletionProgress(prev => [...prev, 'Tokens de confirmación eliminados']);
      }
      
      console.log('Step 13: Deleting chat conversations and messages...');
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
      
      console.log('Step 14: Deleting adoption chats and messages...');
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
      console.log('Step 15: Deleting user bookings...');
      const { error: bookingsError } = await supabaseClient
        .from('bookings')
        .delete()
        .eq('customer_id', currentUser.id);
      
      if (bookingsError) {
        console.error('Error deleting bookings:', bookingsError);
        console.log('Continuing despite bookings deletion error...');
      } else {
        console.log('User bookings deleted successfully');
      }

      console.log('Step 16: Deleting orders...');
      const { error: ordersError } = await supabaseClient
        .from('orders')
        .delete()
        .eq('customer_id', currentUser.id);
      
      if (ordersError) {
        console.error('Error deleting orders:', ordersError);
        console.log('Continuing despite orders deletion error...');
      } else {
        console.log('Orders deleted successfully');
      }

      console.log('Step 17: Deleting cart...');
      const { error: cartError } = await supabaseClient
        .from('user_carts')
        .delete()
        .eq('user_id', currentUser.id);
      
      if (cartError) {
        console.error('Error deleting cart:', cartError);
        console.log('Continuing despite cart deletion error...');
      } else {
        console.log('Cart deleted successfully');
      }

      console.log('Step 18: Deleting service reviews...');
      const { error: reviewsError } = await supabaseClient
        .from('service_reviews')
        .delete()
        .eq('customer_id', currentUser.id);
      
      if (reviewsError) {
        console.error('Error deleting service reviews:', reviewsError);
        console.log('Continuing despite service reviews deletion error...');
      } else {
        console.log('Service reviews deleted successfully');
      }

      // Handle partner data if user is a partner
      setDeletionProgress(prev => [...prev, 'Verificando datos de negocio...']);
      console.log('Checking for partner data...');
      const { data: partnerData } = await supabaseClient
        .from('partners')
        .select('id')
        .eq('user_id', currentUser.id);

      if (partnerData && partnerData.length > 0) {
        setDeletionProgress(prev => [...prev, 'Error: Usuario tiene negocios asociados']);
        Alert.alert(
          'Cuenta con negocio',
          'Tu cuenta tiene negocios asociados. Para eliminarla, primero tenés que transferir o eliminar tus negocios. Escribinos a soporte si necesitás ayuda.',
          [{ text: 'Entendido', onPress: () => setLoading(false) }]
        );
        return;
      }

      // Delete user profile from profiles table
      setDeletionProgress(prev => [...prev, 'Eliminando perfil de usuario...']);
      console.log('Deleting user profile...');
      
      // Delete user profile directly
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .delete()
        .eq('id', currentUser.id);
      
      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        if (profileError.message?.includes('JWT expired')) {
          Alert.alert('Sesión vencida', 'Volvé a ingresar para continuar.');
          router.replace('/auth/login');
          return;
        }
        setDeletionProgress(prev => [...prev, `Error eliminando perfil: ${profileError.message}`]);
        throw new Error(`No se pudo eliminar el perfil: ${profileError.message}`);
      }
      
      setDeletionProgress(prev => [...prev, 'Perfil de usuario eliminado correctamente']);
      console.log('User profile deleted successfully');

      // Delete user from auth.users table (this requires admin privileges)
      setDeletionProgress(prev => [...prev, 'Eliminando usuario del sistema de autenticación...']);
      console.log('Deleting user from auth.users table...');
      
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

        console.log('Delete user API response status:', response.status);
        
        if (response.ok) {
          const result = await response.json();
          console.log('Delete user API result:', result);
          
          if (result.success) {
            setDeletionProgress(prev => [...prev, 'Usuario eliminado del sistema de autenticación']);
            console.log('✅ User deleted from auth.users table');
          } else {
            console.warn('Could not delete from auth.users:', result.error);
            setDeletionProgress(prev => [...prev, `No se pudo eliminar de auth: ${result.error}`]);
            setDeletionProgress(prev => [...prev, 'Continuando con el cierre de sesión...']);
          }
        } else {
          const errorText = await response.text();
          console.warn('Auth deletion API error:', response.status, errorText);
          setDeletionProgress(prev => [...prev, `Error API auth (${response.status})`]);
          setDeletionProgress(prev => [...prev, 'Continuando con el cierre de sesión...']);
        }
      } catch (authError) {
        console.warn('Error deleting from auth system:', authError);
        setDeletionProgress(prev => [...prev, `Error eliminando de auth: ${getErrorMessage(authError)}`]);
        setDeletionProgress(prev => [...prev, 'Continuando con el cierre de sesión...']);
      }

      // From here on the account may already be gone from auth.users (the
      // delete-user call above), so the remaining authenticated calls below
      // (clearing push tokens, auth.signOut() itself, inside logout()) can
      // legitimately 401 — that's expected for a just-deleted account, not a
      // real session expiration, so stop the global interceptor from
      // showing its own "sesión expirada" alert and redirect on top of the
      // success message below.
      setSuppressTokenExpirationAlerts(true);

      // Sign out user from current session
      setDeletionProgress(prev => [...prev, 'Cerrando sesión...']);
      console.log('Signing out user...');
      await clearLocalAuthArtifacts();
      await logout();
      
      setDeletionProgress(prev => [...prev, 'Datos del usuario eliminados exitosamente']);
      setDeletionProgress(prev => [...prev, 'Sesión cerrada - Cuenta desactivada']);
      console.log('✅ Account deletion process completed successfully');
      
      Alert.alert(
        'Datos eliminados',
        'Eliminamos todos tus datos de DogCatiFy. Tu cuenta quedó desactivada y, si querés, podés crear una cuenta nueva con el mismo correo.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setDeletionProgress(prev => [...prev, `Error: ${errorMessage}`]);
      console.error('Error deleting account:', error);
      Alert.alert(
        'Error',
        `Ocurrió un error durante la eliminación: ${errorMessage}. Es posible que algunos datos ya se hayan eliminado. Escribinos a soporte para completar el proceso.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToConfirmation = () => {
    setStep(2);
  };

  if (step === 1) {
    const dataItems = [
      { icon: PawPrint, text: 'Todos los perfiles de tus mascotas' },
      { icon: ImageIcon, text: 'Todas las fotos y álbumes' },
      { icon: FileText, text: 'Todas tus publicaciones y comentarios' },
      { icon: Stethoscope, text: 'Registros médicos y de salud' },
      { icon: Calendar, text: 'Historial de reservas y citas' },
      { icon: ShoppingBag, text: 'Historial de compras y pedidos' },
      { icon: MessageCircle, text: 'Conversaciones y mensajes' },
      { icon: UserRound, text: 'Tu perfil y tu información personal' },
    ];

    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Eliminar cuenta" />

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.warningCard} accessibilityRole="alert">
            <View style={styles.warningIcon}>
              <AlertTriangle size={28} color={colors.danger} />
            </View>
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Esta acción no se puede deshacer</Text>
              <Text style={styles.warningText}>
                Vas a eliminar de forma permanente tu cuenta de DogCatiFy y toda la información asociada.
              </Text>
            </View>
          </View>

          <Card style={styles.dataCard}>
            <Text style={styles.dataTitle}>Se van a eliminar estos datos</Text>

            <View style={styles.dataList}>
              {dataItems.map(({ icon: Icon, text }) => (
                <View key={text} style={styles.dataItem}>
                  <Icon size={18} color={colors.textSecondary} />
                  <Text style={styles.dataText}>{text}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card style={styles.alternativeCard} variant="outlined">
            <Text style={styles.alternativeTitle}>Antes de seguir, ¿probaste estas alternativas?</Text>

            <View style={styles.alternativeList}>
              <Text style={styles.alternativeItem}>• Desactivar temporalmente tu cuenta</Text>
              <Text style={styles.alternativeItem}>• Cambiar tu configuración de privacidad</Text>
              <Text style={styles.alternativeItem}>• Contactar a soporte para resolver un problema</Text>
            </View>

            <TouchableOpacity
              style={styles.supportLink}
              onPress={() => router.push('/profile/help-support')}
              accessibilityRole="link"
            >
              <LifeBuoy size={16} color={colors.primary} />
              <Text style={styles.supportLinkText}>Ir a Ayuda y soporte</Text>
            </TouchableOpacity>
          </Card>

          <View style={styles.actionButtons}>
            <Button
              title="Continuar con la eliminación"
              onPress={handleContinueToConfirmation}
              variant="danger"
              size="large"
            />
            <Button
              title="Cancelar"
              onPress={() => router.back()}
              variant="ghost"
              size="large"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const phraseMatches = confirmationText === 'ELIMINAR MI CUENTA';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Confirmar eliminación" onBack={() => setStep(1)} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.confirmationCard}>
          <View style={styles.confirmationHeader}>
            <View style={styles.confirmationIcon}>
              <Shield size={28} color={colors.danger} />
            </View>
            <Text style={styles.confirmationTitle} accessibilityRole="header">Confirmación final</Text>
          </View>

          <Text style={styles.confirmationText}>
            Para confirmar que querés eliminar tu cuenta de forma permanente, escribí exactamente:
          </Text>

          <View style={styles.confirmationPhrase}>
            <Text style={styles.phraseText} selectable>ELIMINAR MI CUENTA</Text>
          </View>

          <TextInput
            style={[styles.confirmationInput, phraseMatches && styles.confirmationInputMatch]}
            placeholder="Escribí la frase acá"
            placeholderTextColor={colors.placeholder}
            value={confirmationText}
            onChangeText={setConfirmationText}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="Frase de confirmación"
            accessibilityHint="Escribí ELIMINAR MI CUENTA para habilitar el botón"
          />

          {/* Progress indicator during deletion */}
          {loading && deletionProgress.length > 0 && (
            <View style={styles.progressContainer} accessibilityLiveRegion="polite">
              <Text style={styles.progressTitle}>Progreso de la eliminación</Text>
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
            Una vez eliminada, no vas a poder recuperar tu cuenta ni tus datos.
          </Text>
        </Card>

        <View style={styles.finalActions}>
          <Button
            title={loading ? 'Eliminando...' : 'Eliminar mi cuenta permanentemente'}
            onPress={handleDeleteAccount}
            loading={loading}
            disabled={!phraseMatches || loading}
            variant="danger"
            size="large"
          />
          <Button
            title="Cancelar"
            onPress={() => router.back()}
            variant="ghost"
            size="large"
            disabled={loading}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingTop: 50,
  },
  // El fondo gris va en el contenido; el blanco de arriba acompaña al encabezado.
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentInner: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  warningIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCopy: {
    flex: 1,
  },
  warningTitle: {
    ...typography.bodyStrong,
    color: colors.danger,
    marginBottom: spacing.xxs,
  },
  warningText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  dataCard: {
    marginBottom: spacing.lg,
  },
  dataTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.md,
  },
  dataList: {
    gap: spacing.md,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dataText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  alternativeCard: {
    marginBottom: spacing.xxl,
  },
  alternativeTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  alternativeList: {
    gap: spacing.xs,
  },
  alternativeItem: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    marginTop: spacing.sm,
  },
  supportLinkText: {
    ...typography.label,
    color: colors.primary,
  },
  actionButtons: {
    gap: spacing.sm,
  },
  confirmationCard: {
    marginBottom: spacing.xxl,
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  confirmationIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmationTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  confirmationText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  confirmationPhrase: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  phraseText: {
    ...typography.bodyStrong,
    color: colors.text,
    letterSpacing: 1,
  },
  confirmationInput: {
    ...typography.body,
    lineHeight: undefined,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 50,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  confirmationInputMatch: {
    borderColor: colors.danger,
  },
  confirmationNote: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  finalActions: {
    gap: spacing.sm,
  },
  progressContainer: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  progressTitle: {
    ...typography.captionStrong,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  progressScroll: {
    maxHeight: 160,
  },
  progressStep: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});
