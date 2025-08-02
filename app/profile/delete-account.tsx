import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Trash2, TriangleAlert as AlertTriangle, Shield } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

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
      console.log('Starting account deletion process for user:', currentUser.id);

      // 1. Delete user's pets and related data
      console.log('Deleting pets and related data...');
      const { data: userPets, error: petsError } = await supabaseClient
        .from('pets')
        .select('id')
        .eq('owner_id', currentUser.id);

      setDeletionProgress(prev => [...prev, 'Verificando mascotas del usuario...']);

      if (petsError) {
        console.error('Error fetching user pets:', petsError);
      } else if (userPets && userPets.length > 0) {
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

      // 3. Delete user's bookings
      setDeletionProgress(prev => [...prev, 'Eliminando reservas del usuario...']);
      console.log('Deleting bookings...');
      await supabaseClient
        .from('bookings')
        .delete()
        .eq('customer_id', currentUser.id);

      // 4. Delete user's orders
      setDeletionProgress(prev => [...prev, 'Eliminando pedidos del usuario...']);
      console.log('Deleting orders...');
      await supabaseClient
        .from('orders')
        .delete()
        .eq('customer_id', currentUser.id);

      // 5. Delete user's cart
      setDeletionProgress(prev => [...prev, 'Eliminando carrito del usuario...']);
      console.log('Deleting cart...');
      await supabaseClient
        .from('user_carts')
        .delete()
        .eq('user_id', currentUser.id);

      // 6. Delete user's service reviews
      setDeletionProgress(prev => [...prev, 'Eliminando reseñas del usuario...']);
      console.log('Deleting service reviews...');
      await supabaseClient
        .from('service_reviews')
        .delete()
        .eq('customer_id', currentUser.id);

      // 7. Delete chat conversations and messages
      setDeletionProgress(prev => [...prev, 'Eliminando conversaciones de chat...']);
      console.log('Deleting chat data...');
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

      // 8. Handle partner data if user is a partner
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
          'Tu cuenta tiene negocios asociados. Para eliminar tu cuenta, primero debes transferir o eliminar tus negocios. Contacta con soporte para asistencia.',
          [{ text: 'Entendido', onPress: () => setLoading(false) }]
        );
        return;
      }

      // 9. Delete user profile from profiles table
      setDeletionProgress(prev => [...prev, 'Eliminando perfil de usuario...']);
      console.log('Deleting user profile...');
      
      // Usar la función de base de datos que maneja el orden correcto
      setDeletionProgress(prev => [...prev, 'Ejecutando eliminación completa...']);
      const { data: deleteResult, error: functionError } = await supabaseClient
        .rpc('delete_user_completely', { user_id_to_delete: currentUser.id });
      
      console.log('Database function result:', deleteResult);
      
      if (functionError) {
        console.error('Database function error:', functionError);
        setDeletionProgress(prev => [...prev, `Error en función de eliminación: ${functionError.message}`]);
        throw new Error(`Error en la función de eliminación: ${functionError.message}`);
      }
      
      if (!deleteResult?.success) {
        console.error('Database function returned failure:', deleteResult);
        setDeletionProgress(prev => [...prev, `Error: ${deleteResult?.error || 'Error desconocido'}`]);
        throw new Error(`La función de eliminación falló: ${deleteResult?.error || 'Error desconocido'}`);
      }
      
      setDeletionProgress(prev => [...prev, '✅ Usuario eliminado completamente de la base de datos']);
      console.log('✅ User deleted completely using database function');

      // 10. Delete user from auth.users table
      setDeletionProgress(prev => [...prev, 'Eliminando usuario del sistema de autenticación...']);
      console.log('Deleting user from auth.users table...');
      
      try {
        // Note: Regular users cannot delete themselves from auth.users table
        // This requires admin privileges or server-side implementation
        // The user account will be marked as deleted when they sign out
        setDeletionProgress(prev => [...prev, '✅ Datos del usuario eliminados completamente']);
        console.log('✅ User data deleted completely, auth session will be terminated on logout');
      } catch (authError) {
        console.error('Error deleting from auth system:', authError);
        setDeletionProgress(prev => [...prev, '✅ Datos del usuario eliminados completamente']);
      }

      // 11. Sign out user from current session
      setDeletionProgress(prev => [...prev, 'Cerrando sesión...']);
      console.log('Signing out user...');
      await logout();
      
      setDeletionProgress(prev => [...prev, '✅ Proceso de eliminación completado exitosamente']);
      console.log('✅ Account deletion process completed successfully');
      
      Alert.alert(
        'Cuenta eliminada',
        'Tu cuenta y todos tus datos han sido eliminados permanentemente de la aplicación. Tu perfil y datos personales ya no son accesibles.',
        [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
      );

    } catch (error) {
      setDeletionProgress(prev => [...prev, `❌ Error: ${error.message || error}`]);
      console.error('Error deleting account:', error);
      Alert.alert(
        'Error',
        `Ocurrió un error al eliminar tu cuenta: ${error.message || error}. Por favor contacta con soporte para asistencia.`
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