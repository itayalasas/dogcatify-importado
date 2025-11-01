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
      color: '#10B981',
      bgColor: '#D1FAE5',
      borderColor: '#10B981'
    },
    {
      value: 'edit',
      label: 'Editar',
      description: 'Puede ver y editar información',
      icon: Edit3,
      color: '#3B82F6',
      bgColor: '#DBEAFE',
      borderColor: '#3B82F6'
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

      // Buscar usuarios
      const { data: users, error: usersError } = await supabaseClient
        .from('profiles')
        .select('id, display_name, email')
        .neq('id', currentUser?.id)
        .or(`display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(10);

      if (usersError) throw usersError;

      // Obtener usuarios que ya tienen acceso (pending o accepted)
      const { data: existingShares, error: sharesError } = await supabaseClient
        .from('pet_shares')
        .select('shared_with_user_id')
        .eq('pet_id', petId)
        .neq('status', 'rejected');

      if (sharesError) throw sharesError;

      const sharedUserIds = new Set(existingShares?.map(s => s.shared_with_user_id) || []);

      // Filtrar usuarios que ya tienen acceso
      const availableUsers = users?.filter(user => !sharedUserIds.has(user.id)) || [];

      setUserSuggestions(availableUsers);
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
    if (!selectedUser) {
      Alert.alert('Error', 'Por favor selecciona un usuario');
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
            `Ya existe una invitación pendiente para ${selectedUser.display_name}. Espera a que la acepte o rechace.`
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
          Alert.alert('Error', 'Ya has compartido esta mascota con este usuario');
        } else {
          throw shareError;
        }
        return;
      }

      Alert.alert(
        'Invitación enviada',
        `Se ha enviado una invitación a ${selectedUser.display_name}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSearchQuery('');
              setSelectedUser(null);
              setUserSuggestions([]);
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
            <Text style={styles.label}>Buscar usuario</Text>
            <View style={styles.autocompleteContainer}>
              <View style={styles.inputContainer}>
                <Search size={20} color="#6B7280" style={styles.inputIcon} />
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
                    color="#3B82F6"
                    style={styles.searchLoader}
                  />
                )}
              </View>

              {showSuggestions && userSuggestions.length > 0 && (
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
                userSuggestions.length === 0 && (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      No se encontraron usuarios disponibles con "{searchQuery}"
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
                    >
                      <X size={16} color="#6B7280" />
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
                >
                  <View
                    style={[
                      styles.permissionIconContainer,
                      { backgroundColor: isSelected ? level.color : '#F3F4F6' },
                    ]}
                  >
                    <Icon
                      size={20}
                      color={isSelected ? '#FFFFFF' : '#9CA3AF'}
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
                      <Check size={16} color="#FFFFFF" />
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
              <UserPlus size={20} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Enviar invitación</Text>
            </View>
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
  searchLoader: {
    marginLeft: 8,
  },
  autocompleteContainer: {
    position: 'relative',
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 250,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  suggestionAvatarText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  suggestionEmail: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  noResultsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  noResultsSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  selectedUserContainer: {
    marginTop: 12,
  },
  selectedUserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  selectedUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedUserAvatarText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  selectedUserInfo: {
    flex: 1,
  },
  selectedUserName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 2,
  },
  selectedUserEmail: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#3B82F6',
  },
  removeSelectedButton: {
    padding: 4,
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
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
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
    marginRight: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 3,
  },
  permissionDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  shareButton: {
    marginTop: 8,
  },
  shareButtonContent: {
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
