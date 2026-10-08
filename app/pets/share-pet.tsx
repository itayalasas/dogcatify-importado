import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, UserPlus, Mail, Check, Clock, UserX, Search, Eye, Edit3, Shield } from 'lucide-react-native';
import { supabaseClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ScreenHeader, EmptyState, Badge, SkeletonListItem, toast } from '../../components/ui';
import type { BadgeTone } from '../../components/ui';

import { colors, radius, spacing, typography, hitSlop } from '../../constants/theme';
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

interface UserSuggestion {
  id: string;
  display_name: string;
  email: string;
}

export default function SharePetScreen() {
  const { petId } = useLocalSearchParams();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [petName, setPetName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [relationshipType, setRelationshipType] = useState<string>('friend');
  const [permissionLevel, setPermissionLevel] = useState<string>('view');
  const [shares, setShares] = useState<PetShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const relationshipTypes = [
    { value: 'veterinarian', label: 'Veterinario/a', icon: '🩺' },
    { value: 'family', label: 'Familiar', icon: '👨‍👩‍👧' },
    { value: 'friend', label: 'Amigo/a', icon: '🤝' },
    { value: 'caretaker', label: 'Cuidador/a', icon: '🏠' },
    { value: 'other', label: 'Otro', icon: '👤' },
  ];

  const permissionLevels = [
    {
      value: 'view',
      label: 'Ver',
      description: 'Solo puede ver información',
      icon: Eye,
      color: colors.success,
      bgColor: colors.successSoft,
      borderColor: colors.success
    },
    {
      value: 'edit',
      label: 'Editar',
      description: 'Puede ver y editar información',
      icon: Edit3,
      color: colors.primary,
      bgColor: '#D5E8E9',
      borderColor: colors.primary
    },
    {
      value: 'admin',
      label: 'Administrador',
      description: 'Control total (compartir, eliminar)',
      icon: Shield,
      color: '#8B5CF6',
      bgColor: '#EDE9FE',
      borderColor: '#8B5CF6'
    },
  ];

  useEffect(() => {
    loadPetInfo();
    loadShares();
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setUserSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const searchUsers = async (query: string) => {
    try {
      setSearchingUsers(true);
      const searchTerm = query.trim().toLowerCase();

      // Buscar usuarios vía RPC (authenticated-only; ya excluye a quienes
      // ya tienen acceso a esta mascota)
      const { data: users, error: usersError } = await supabaseClient
        .rpc('search_users_for_sharing', { p_query: searchTerm, p_pet_id: petId });

      if (usersError) throw usersError;

      setUserSuggestions(users || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching users:', error);
      setUserSuggestions([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleSelectUser = (user: UserSuggestion) => {
    setSelectedUser(user);
    setSearchQuery(user.display_name);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleSearchQueryChange = (text: string) => {
    setSearchQuery(text);
    setSelectedUser(null);
  };

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
      // Vía RPC: el join embebido de PostgREST contra profiles ya no puede
      // leer display_name/email de otro usuario ahora que profiles está
      // restringido — la función server-side verifica que el caller sea el
      // dueño de la mascota antes de devolver esos datos.
      const { data, error } = await supabaseClient
        .rpc('get_pet_share_contacts', { p_pet_id: petId });

      if (error) throw error;

      // The RPC already orders by created_at DESC.
      const shares = (data || [])
        .filter((row: any) => row.status !== 'rejected')
        .map((row: any) => ({
          ...row,
          profiles: { display_name: row.display_name, email: row.email },
        }));

      setShares(shares);
    } catch (error) {
      console.error('Error loading shares:', error);
    } finally {
      setLoadingShares(false);
    }
  };

  const handleShare = async () => {
    if (!selectedUser) {
      Alert.alert('Error', 'Por favor seleccioná un usuario');
      return;
    }

    try {
      setLoading(true);

      // Verificar si ya existe una invitación o acceso activo
      const { data: existingShare, error: checkError } = await supabaseClient
        .from('pet_shares')
        .select('id, status')
        .eq('pet_id', petId)
        .eq('shared_with_user_id', selectedUser.id)
        .neq('status', 'rejected')
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing share:', checkError);
        throw checkError;
      }

      if (existingShare) {
        if (existingShare.status === 'pending') {
          Alert.alert(
            'Invitación pendiente',
            `Ya existe una invitación pendiente para ${selectedUser.display_name}. Esperá a que la acepte o la rechace.`
          );
        } else if (existingShare.status === 'accepted') {
          Alert.alert(
            'Ya compartido',
            `${selectedUser.display_name} ya tiene acceso a esta mascota.`
          );
        }
        return;
      }

      // Insertar nueva invitación
      const { error: shareError } = await supabaseClient
        .from('pet_shares')
        .insert({
          pet_id: petId,
          owner_id: currentUser?.id,
          shared_with_user_id: selectedUser.id,
          relationship_type: relationshipType,
          permission_level: permissionLevel,
          status: 'pending',
        });

      if (shareError) {
        if (shareError.code === '23505') {
          Alert.alert('Error', 'Ya compartiste esta mascota con este usuario');
        } else {
          throw shareError;
        }
        return;
      }

      toast.success(`Le enviamos una invitación a ${selectedUser.display_name}`);
      setSearchQuery('');
      setSelectedUser(null);
      setUserSuggestions([]);
      loadShares();
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
      `¿Seguro que querés revocar el acceso de ${userName}?`,
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
        return { icon: Check, color: colors.success, tone: 'success' as BadgeTone, label: 'Aceptada' };
      case 'pending':
        return { icon: Clock, color: colors.warning, tone: 'warning' as BadgeTone, label: 'Pendiente' };
      case 'revoked':
        return { icon: UserX, color: colors.danger, tone: 'danger' as BadgeTone, label: 'Revocada' };
      default:
        return { icon: Clock, color: colors.textSecondary, tone: 'neutral' as BadgeTone, label: status };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={`Compartir ${petName ?? ''}`.trim()} onBack={() => router.back()} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Invitar a alguien</Text>
          <Text style={styles.sectionDescription}>
            La persona recibirá una invitación y podrá ver/gestionar esta mascota
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Buscar usuario</Text>
            <View style={styles.autocompleteContainer}>
              <View style={styles.inputContainer}>
                <Search size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Buscar por nombre o email..."
                  value={searchQuery}
                  onChangeText={handleSearchQueryChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => {
                    if (userSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                />
                {searchingUsers && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={styles.searchLoader}
                  />
                )}
              </View>

              {showSuggestions && userSuggestions.length > 0 && !selectedUser && (
                <View style={styles.suggestionsContainer}>
                  {userSuggestions.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectUser(user)}
                    >
                      <View style={styles.suggestionAvatar}>
                        <Text style={styles.suggestionAvatarText}>
                          {user.display_name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionName}>{user.display_name}</Text>
                        <Text style={styles.suggestionEmail}>{user.email}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {showSuggestions &&
                !searchingUsers &&
                searchQuery.trim().length >= 2 &&
                userSuggestions.length === 0 &&
                !selectedUser && (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      No se encontraron usuarios disponibles con &quot;{searchQuery}&quot;
                    </Text>
                    <Text style={styles.noResultsSubtext}>
                      Es posible que ya tengan acceso a esta mascota
                    </Text>
                  </View>
                )}

              {selectedUser && (
                <View style={styles.selectedUserContainer}>
                  <View style={styles.selectedUserBadge}>
                    <View style={styles.selectedUserAvatar}>
                      <Text style={styles.selectedUserAvatarText}>
                        {selectedUser.display_name?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.selectedUserInfo}>
                      <Text style={styles.selectedUserName}>
                        {selectedUser.display_name}
                      </Text>
                      <Text style={styles.selectedUserEmail}>{selectedUser.email}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedUser(null);
                        setSearchQuery('');
                      }}
                      style={styles.removeSelectedButton}
                      accessibilityRole="button"
                      accessibilityLabel="Quitar usuario seleccionado"
                      hitSlop={hitSlop}
                    >
                      <X size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
                  accessibilityRole="radio"
                  accessibilityState={{ selected: relationshipType === type.value }}
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
            {permissionLevels.map((level) => {
              const Icon = level.icon;
              const isSelected = permissionLevel === level.value;

              return (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.permissionOption,
                    isSelected && {
                      backgroundColor: level.bgColor,
                      borderColor: level.borderColor,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => setPermissionLevel(level.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View
                    style={[
                      styles.permissionIconContainer,
                      { backgroundColor: isSelected ? level.color : colors.surfaceAlt },
                    ]}
                  >
                    <Icon
                      size={20}
                      color={isSelected ? colors.white : colors.icon}
                    />
                  </View>
                  <View style={styles.permissionInfo}>
                    <Text
                      style={[
                        styles.permissionLabel,
                        isSelected && { color: level.color },
                      ]}
                    >
                      {level.label}
                    </Text>
                    <Text
                      style={[
                        styles.permissionDescription,
                        isSelected && { color: level.color, opacity: 0.8 },
                      ]}
                    >
                      {level.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkMark, { backgroundColor: level.color }]}>
                      <Check size={16} color={colors.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            onPress={handleShare}
            loading={loading}
            style={styles.shareButton}
          >
            <View style={styles.shareButtonContent}>
              <UserPlus size={20} color={colors.white} />
              <Text style={styles.shareButtonText}>Enviar invitación</Text>
            </View>
          </Button>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Personas con acceso</Text>

          {loadingShares ? (
            <View accessibilityLabel="Cargando personas con acceso">
              <SkeletonListItem />
              <SkeletonListItem />
            </View>
          ) : shares.length === 0 ? (
            <EmptyState
              icon={<UserPlus size={32} color={colors.primary} />}
              title="Todavía no la compartiste"
              description="Invitá a tu familia, cuidador o veterinario para que puedan ver o gestionar su ficha."
              style={styles.emptyState}
            />
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
                      <Badge
                        label={statusBadge.label}
                        tone={statusBadge.tone}
                        icon={<StatusIcon size={14} color={statusBadge.color} />}
                      />

                      {share.status !== 'revoked' && (
                        <TouchableOpacity
                          onPress={() =>
                            handleRevokeShare(share.id, share.profiles?.display_name)
                          }
                          style={styles.revokeButton}
                          accessibilityRole="button"
                          accessibilityLabel={`Revocar acceso de ${share.profiles?.display_name || 'usuario'}`}
                          hitSlop={hitSlop}
                        >
                          <UserX size={18} color={colors.danger} />
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
  emptyState: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.sm,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  card: {
    margin: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  searchLoader: {
    marginLeft: spacing.sm,
  },
  autocompleteContainer: {
    position: 'relative',
  },
  suggestionsContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 250,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  suggestionAvatarText: {
    ...typography.bodyStrong,
    color: colors.white,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  suggestionEmail: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  noResultsContainer: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  noResultsText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  noResultsSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  selectedUserContainer: {
    marginTop: spacing.md,
  },
  selectedUserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectedUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedUserAvatarText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.white,
  },
  selectedUserInfo: {
    flex: 1,
  },
  selectedUserName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: colors.primaryStrong,
    marginBottom: spacing.xxs,
  },
  selectedUserEmail: {
    ...typography.caption,
    color: colors.primary,
  },
  removeSelectedButton: {
    padding: spacing.xs,
  },
  input: {
    flex: 1,
    height: 48,
    ...typography.body,
    color: colors.text,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  optionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  optionLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  optionLabelActive: {
    color: colors.primary,
  },
  permissionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: radius.lg,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  permissionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: 3,
  },
  permissionDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  shareButton: {
    marginTop: spacing.sm,
  },
  shareButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  shareButtonText: {
    ...typography.bodyStrong,
    color: colors.white,
  },
  sharesList: {
    gap: spacing.md,
  },
  shareItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  shareInfo: {
    flex: 1,
  },
  shareName: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  shareEmail: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  shareDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareDetailText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  shareDetailSeparator: {
    marginHorizontal: 6,
    color: colors.borderStrong,
  },
  shareActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  revokeButton: {
    padding: 6,
  },
});
