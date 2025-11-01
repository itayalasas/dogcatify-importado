import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, UserPlus, Mail, Check, Clock, UserX } from 'lucide-react-native';
import { supabaseClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface PetShare {
  id: string;
  shared_with_user_id: string;
  relationship_type: string;
  permission_level: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  profiles: {
    display_name: string;
    email: string;
  };
}

export default function SharePetScreen() {
  const { petId } = useLocalSearchParams();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [petName, setPetName] = useState('');
  const [email, setEmail] = useState('');
  const [relationshipType, setRelationshipType] = useState<string>('friend');
  const [permissionLevel, setPermissionLevel] = useState<string>('view');
  const [shares, setShares] = useState<PetShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(true);

  const relationshipTypes = [
    { value: 'veterinarian', label: 'Veterinario/a', icon: '🩺' },
    { value: 'family', label: 'Familiar', icon: '👨‍👩‍👧' },
    { value: 'friend', label: 'Amigo/a', icon: '🤝' },
    { value: 'caretaker', label: 'Cuidador/a', icon: '🏠' },
    { value: 'other', label: 'Otro', icon: '👤' },
  ];

  const permissionLevels = [
    { value: 'view', label: 'Ver', description: 'Solo puede ver información' },
    { value: 'edit', label: 'Editar', description: 'Puede ver y editar información' },
    { value: 'admin', label: 'Administrador', description: 'Control total (compartir, eliminar)' },
  ];

  useEffect(() => {
    loadPetInfo();
    loadShares();
  }, []);

  const loadPetInfo = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pets')
        .select('name')
        .eq('id', petId)
        .single();

      if (error) throw error;
      if (data) setPetName(data.name);
    } catch (error) {
      console.error('Error loading pet:', error);
    }
  };

  const loadShares = async () => {
    try {
      setLoadingShares(true);
      const { data, error } = await supabaseClient
        .from('pet_shares')
        .select(`
          *,
          profiles!pet_shares_shared_with_user_id_fkey (
            display_name,
            email
          )
        `)
        .eq('pet_id', petId)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShares(data || []);
    } catch (error) {
      console.error('Error loading shares:', error);
    } finally {
      setLoadingShares(false);
    }
  };

  const handleShare = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa un email');
      return;
    }

    try {
      setLoading(true);

      const { data: targetUser, error: userError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (userError || !targetUser) {
        Alert.alert('Error', 'No se encontró un usuario con ese email');
        return;
      }

      if (targetUser.id === currentUser?.id) {
        Alert.alert('Error', 'No puedes compartir una mascota contigo mismo');
        return;
      }

      const { error: shareError } = await supabaseClient
        .from('pet_shares')
        .insert({
          pet_id: petId,
          owner_id: currentUser?.id,
          shared_with_user_id: targetUser.id,
          relationship_type: relationshipType,
          permission_level: permissionLevel,
          status: 'pending',
        });

      if (shareError) {
        if (shareError.code === '23505') {
          Alert.alert('Error', 'Ya has compartido esta mascota con este usuario');
        } else {
          throw shareError;
        }
        return;
      }

      Alert.alert(
        'Invitación enviada',
        `Se ha enviado una invitación a ${email}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setEmail('');
              loadShares();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error sharing pet:', error);
      Alert.alert('Error', 'No se pudo compartir la mascota');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeShare = async (shareId: string, userName: string) => {
    Alert.alert(
      'Revocar acceso',
      `¿Estás seguro de que quieres revocar el acceso de ${userName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseClient
                .from('pet_shares')
                .update({ status: 'revoked', revoked_at: new Date().toISOString() })
                .eq('id', shareId);

              if (error) throw error;
              loadShares();
            } catch (error) {
              console.error('Error revoking share:', error);
              Alert.alert('Error', 'No se pudo revocar el acceso');
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return { icon: Check, color: '#10B981', label: 'Aceptada' };
      case 'pending':
        return { icon: Clock, color: '#F59E0B', label: 'Pendiente' };
      case 'revoked':
        return { icon: UserX, color: '#EF4444', label: 'Revocada' };
      default:
        return { icon: Clock, color: '#6B7280', label: status };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <X size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compartir {petName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Invitar a alguien</Text>
          <Text style={styles.sectionDescription}>
            La persona recibirá una invitación y podrá ver/gestionar esta mascota
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email del usuario</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="usuario@ejemplo.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo de relación</Text>
            <View style={styles.optionsGrid}>
              {relationshipTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.optionButton,
                    relationshipType === type.value && styles.optionButtonActive,
                  ]}
                  onPress={() => setRelationshipType(type.value)}
                >
                  <Text style={styles.optionIcon}>{type.icon}</Text>
                  <Text
                    style={[
                      styles.optionLabel,
                      relationshipType === type.value && styles.optionLabelActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nivel de permisos</Text>
            {permissionLevels.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.permissionOption,
                  permissionLevel === level.value && styles.permissionOptionActive,
                ]}
                onPress={() => setPermissionLevel(level.value)}
              >
                <View style={styles.permissionInfo}>
                  <Text
                    style={[
                      styles.permissionLabel,
                      permissionLevel === level.value && styles.permissionLabelActive,
                    ]}
                  >
                    {level.label}
                  </Text>
                  <Text style={styles.permissionDescription}>{level.description}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    permissionLevel === level.value && styles.radioActive,
                  ]}
                >
                  {permissionLevel === level.value && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            onPress={handleShare}
            loading={loading}
            style={styles.shareButton}
          >
            <UserPlus size={20} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Enviar invitación</Text>
          </Button>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Personas con acceso</Text>

          {loadingShares ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : shares.length === 0 ? (
            <View style={styles.emptyContainer}>
              <UserPlus size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                Aún no has compartido esta mascota
              </Text>
            </View>
          ) : (
            <View style={styles.sharesList}>
              {shares.map((share) => {
                const statusBadge = getStatusBadge(share.status);
                const StatusIcon = statusBadge.icon;

                return (
                  <View key={share.id} style={styles.shareItem}>
                    <View style={styles.shareInfo}>
                      <Text style={styles.shareName}>
                        {share.profiles?.display_name || 'Usuario'}
                      </Text>
                      <Text style={styles.shareEmail}>{share.profiles?.email}</Text>
                      <View style={styles.shareDetails}>
                        <Text style={styles.shareDetailText}>
                          {relationshipTypes.find((t) => t.value === share.relationship_type)
                            ?.label || share.relationship_type}
                        </Text>
                        <Text style={styles.shareDetailSeparator}>•</Text>
                        <Text style={styles.shareDetailText}>
                          {permissionLevels.find((l) => l.value === share.permission_level)
                            ?.label || share.permission_level}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.shareActions}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusBadge.color + '20' },
                        ]}
                      >
                        <StatusIcon size={14} color={statusBadge.color} />
                        <Text style={[styles.statusText, { color: statusBadge.color }]}>
                          {statusBadge.label}
                        </Text>
                      </View>

                      {share.status !== 'revoked' && (
                        <TouchableOpacity
                          onPress={() =>
                            handleRevokeShare(share.id, share.profiles?.display_name)
                          }
                          style={styles.revokeButton}
                        >
                          <UserX size={18} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  card: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonActive: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
  },
  optionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  optionLabelActive: {
    color: '#3B82F6',
  },
  permissionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  permissionOptionActive: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
  },
  permissionInfo: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 2,
  },
  permissionLabelActive: {
    color: '#3B82F6',
  },
  permissionDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: '#3B82F6',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  shareButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 12,
  },
  sharesList: {
    gap: 12,
  },
  shareItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  shareInfo: {
    flex: 1,
  },
  shareName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  shareEmail: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  shareDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareDetailText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  shareDetailSeparator: {
    marginHorizontal: 6,
    color: '#D1D5DB',
  },
  shareActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  revokeButton: {
    padding: 6,
  },
});
