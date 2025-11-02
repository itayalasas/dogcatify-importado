import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, User, Calendar, Shield } from 'lucide-react-native';
import { supabaseClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface PetShareInvitation {
  id: string;
  pet_id: string;
  owner_id: string;
  relationship_type: string;
  permission_level: string;
  status: string;
  invited_at: string;
  pet: {
    name: string;
    species: string;
    breed: string;
    photo_url: string;
  };
  owner: {
    display_name: string;
    email: string;
  };
}

export default function PetShareInvitationScreen() {
  const { id: shareId } = useLocalSearchParams();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<PetShareInvitation | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      // Guardar el shareId en el storage para redirigir después del login
      // Esto se manejará en el AuthContext
      router.replace({
        pathname: '/auth/login',
        params: { redirect: `/pet-share/${shareId}` },
      });
      return;
    }

    loadInvitation();
  }, [currentUser, shareId]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabaseClient
        .from('pet_shares')
        .select(`
          id,
          pet_id,
          owner_id,
          relationship_type,
          permission_level,
          status,
          invited_at,
          pet:pet_id (
            name,
            species,
            breed,
            photo_url
          ),
          owner:owner_id (
            display_name,
            email
          )
        `)
        .eq('id', shareId)
        .eq('shared_with_user_id', currentUser?.id)
        .single();

      if (fetchError) {
        console.error('Error loading invitation:', fetchError);
        if (fetchError.code === 'PGRST116') {
          setError('Invitación no encontrada o no tienes acceso a ella');
        } else {
          setError('Error al cargar la invitación');
        }
        return;
      }

      if (!data) {
        setError('Invitación no encontrada');
        return;
      }

      // Verificar que la invitación esté pendiente
      if (data.status !== 'pending') {
        if (data.status === 'accepted') {
          setError('Ya has aceptado esta invitación');
          setTimeout(() => {
            router.replace(`/pets/${data.pet_id}`);
          }, 2000);
        } else if (data.status === 'rejected') {
          setError('Ya has rechazado esta invitación');
        } else {
          setError('Esta invitación ya no está disponible');
        }
        return;
      }

      setInvitation(data as any);
    } catch (error) {
      console.error('Error loading invitation:', error);
      setError('Error al cargar la invitación');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!invitation) return;

    try {
      setProcessing(true);

      const { error: updateError } = await supabaseClient
        .from('pet_shares')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('Error accepting invitation:', updateError);
        Alert.alert('Error', 'No se pudo aceptar la invitación');
        return;
      }

      Alert.alert(
        '¡Invitación aceptada!',
        `Ahora tienes acceso a ${invitation.pet.name}`,
        [
          {
            text: 'Ver mascota',
            onPress: () => router.replace(`/pets/${invitation.pet_id}`),
          },
        ]
      );
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'No se pudo aceptar la invitación');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!invitation) return;

    Alert.alert(
      'Rechazar invitación',
      `¿Estás seguro de que quieres rechazar el acceso a ${invitation.pet.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);

              const { error: updateError } = await supabaseClient
                .from('pet_shares')
                .update({
                  status: 'rejected',
                })
                .eq('id', invitation.id);

              if (updateError) {
                console.error('Error rejecting invitation:', updateError);
                Alert.alert('Error', 'No se pudo rechazar la invitación');
                return;
              }

              Alert.alert(
                'Invitación rechazada',
                'Has rechazado el acceso a esta mascota',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/pets'),
                  },
                ]
              );
            } catch (error) {
              console.error('Error rejecting invitation:', error);
              Alert.alert('Error', 'No se pudo rechazar la invitación');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const getRelationshipLabel = (type: string) => {
    const labels: Record<string, string> = {
      veterinarian: 'Veterinario/a',
      family: 'Familiar',
      friend: 'Amigo/a',
      caretaker: 'Cuidador/a',
      other: 'Otro',
    };
    return labels[type] || type;
  };

  const getPermissionInfo = (level: string) => {
    const info: Record<string, { label: string; description: string; color: string }> = {
      view: {
        label: 'Ver',
        description: 'Solo puedes ver información',
        color: '#10B981',
      },
      edit: {
        label: 'Editar',
        description: 'Puedes ver y editar información',
        color: '#3B82F6',
      },
      admin: {
        label: 'Administrador',
        description: 'Control total (compartir, eliminar)',
        color: '#8B5CF6',
      },
    };
    return info[level] || info.view;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Cargando invitación...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <X size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Button
            onPress={() => router.replace('/(tabs)/pets')}
            style={styles.errorButton}
          >
            Ir a Mis Mascotas
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!invitation) {
    return null;
  }

  const permissionInfo = getPermissionInfo(invitation.permission_level);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <User size={48} color="#3B82F6" />
          </View>
          <Text style={styles.headerTitle}>Invitación para compartir</Text>
          <Text style={styles.headerSubtitle}>
            {invitation.owner.display_name} quiere compartir una mascota contigo
          </Text>
        </View>

        <Card style={styles.petCard}>
          {invitation.pet.photo_url && (
            <Image
              source={{ uri: invitation.pet.photo_url }}
              style={styles.petImage}
              resizeMode="cover"
            />
          )}

          <View style={styles.petInfo}>
            <Text style={styles.petName}>{invitation.pet.name}</Text>
            <Text style={styles.petDetails}>
              {invitation.pet.species} • {invitation.pet.breed || 'Sin raza'}
            </Text>
          </View>
        </Card>

        <Card style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Detalles de la invitación</Text>

          <View style={styles.detailRow}>
            <User size={20} color="#6B7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>De</Text>
              <Text style={styles.detailValue}>{invitation.owner.display_name}</Text>
              <Text style={styles.detailSubvalue}>{invitation.owner.email}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <User size={20} color="#6B7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Como</Text>
              <Text style={styles.detailValue}>
                {getRelationshipLabel(invitation.relationship_type)}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Shield size={20} color={permissionInfo.color} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Nivel de acceso</Text>
              <Text style={[styles.detailValue, { color: permissionInfo.color }]}>
                {permissionInfo.label}
              </Text>
              <Text style={styles.detailSubvalue}>{permissionInfo.description}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Calendar size={20} color="#6B7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Invitado el</Text>
              <Text style={styles.detailValue}>
                {new Date(invitation.invited_at).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Al aceptar, podrás acceder a la información de {invitation.pet.name} según el
            nivel de permisos otorgado.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            onPress={handleAccept}
            loading={processing}
            style={styles.acceptButton}
          >
            <View style={styles.buttonContent}>
              <Check size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Aceptar invitación</Text>
            </View>
          </Button>

          <Button
            onPress={handleReject}
            loading={processing}
            variant="outline"
            style={styles.rejectButton}
          >
            <View style={styles.buttonContent}>
              <X size={20} color="#EF4444" />
              <Text style={[styles.buttonText, styles.rejectButtonText]}>
                Rechazar
              </Text>
            </View>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    minWidth: 200,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EBF8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  petCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  petImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
  },
  petInfo: {
    padding: 16,
  },
  petName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  detailsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  detailSubvalue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  infoBox: {
    backgroundColor: '#EBF8FF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 20,
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  acceptButton: {
    backgroundColor: '#3B82F6',
  },
  rejectButton: {
    borderColor: '#EF4444',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  rejectButtonText: {
    color: '#EF4444',
  },
});
