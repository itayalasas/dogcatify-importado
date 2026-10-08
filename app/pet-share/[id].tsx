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
import { EmptyState, Skeleton, SkeletonCard, toast } from '../../components/ui';

import { colors, radius, spacing, typography } from '../../constants/theme';
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
          setError('Invitación no encontrada o no tenés acceso a ella');
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

      toast.success(`¡Invitación aceptada! Ahora tenés acceso a ${invitation.pet.name}`);
      router.replace(`/pets/${invitation.pet_id}`);
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
      `¿Seguro que querés rechazar el acceso a ${invitation.pet.name}?`,
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

              toast.success('Rechazaste el acceso a esta mascota');
              router.replace('/(tabs)/pets');
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
        description: 'Solo podés ver información',
        color: colors.success,
      },
      edit: {
        label: 'Editar',
        description: 'Podés ver y editar información',
        color: colors.primary,
      },
      admin: {
        label: 'Administrador',
        description: 'Control total (compartir, eliminar)',
        color: colors.info,
      },
    };
    return info[level] || info.view;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content} accessibilityLabel="Cargando invitación">
          <Skeleton width={96} height={96} borderRadius={48} style={styles.skeletonCenter} />
          <Skeleton width="70%" height={22} style={styles.skeletonCenter} />
          <SkeletonCard imageHeight={180} style={styles.skeletonCard} />
          <Skeleton height={180} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon={<X size={32} color={colors.danger} />}
          title="No pudimos abrir la invitación"
          description={error}
          actionLabel="Ir a Mis mascotas"
          onAction={() => router.replace('/(tabs)/pets')}
        />
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
            <User size={48} color={colors.primary} />
          </View>
          <Text style={styles.headerTitle}>Invitación para compartir</Text>
          <Text style={styles.headerSubtitle}>
            {invitation.owner.display_name} quiere compartir una mascota con vos 🐾
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
              {invitation.pet.species === 'dog' ? 'Perro' : invitation.pet.species === 'cat' ? 'Gato' : invitation.pet.species} • {invitation.pet.breed || 'Sin raza'}
            </Text>
          </View>
        </Card>

        <Card style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Detalles de la invitación</Text>

          <View style={styles.detailRow}>
            <User size={20} color={colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>De</Text>
              <Text style={styles.detailValue}>{invitation.owner.display_name}</Text>
              <Text style={styles.detailSubvalue}>{invitation.owner.email}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <User size={20} color={colors.textSecondary} />
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
            <Calendar size={20} color={colors.textSecondary} />
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
              <Check size={20} color={colors.white} />
              <Text style={styles.buttonText}>Aceptar invitación</Text>
            </View>
          </Button>

          <Button
            onPress={handleReject}
            loading={processing}
            variant="ghost"
            style={styles.rejectButton}
          >
            <View style={styles.buttonContent}>
              <X size={20} color={colors.danger} />
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
  skeletonCenter: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  petCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  petImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.surfaceAlt,
  },
  petInfo: {
    padding: spacing.lg,
  },
  petName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petDetails: {
    ...typography.body,
    color: colors.textSecondary,
  },
  detailsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  detailContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  detailValue: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  detailSubvalue: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  infoBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.primaryStrong,
    lineHeight: 20,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  acceptButton: {
    backgroundColor: colors.primary,
  },
  rejectButton: {
    borderColor: colors.danger,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonText: {
    ...typography.bodyStrong,
    color: colors.white,
  },
  rejectButtonText: {
    color: colors.danger,
  },
});
