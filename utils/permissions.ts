import { supabaseClient } from '../lib/supabase';

export type PermissionLevel = 'view' | 'edit' | 'admin';

const permissionHierarchy: Record<PermissionLevel, number> = {
  'view': 1,
  'edit': 2,
  'admin': 3
};

export const checkPetPermission = async (
  userId: string,
  petId: string,
  requiredPermission: PermissionLevel
): Promise<boolean> => {
  try {
    const { data: pet, error: petError } = await supabaseClient
      .from('pets')
      .select('owner_id')
      .eq('id', petId)
      .single();

    if (petError) {
      console.error('Error checking pet ownership:', petError);
      return false;
    }

    if (pet?.owner_id === userId) {
      return true;
    }

    const { data: share, error: shareError } = await supabaseClient
      .from('pet_shares')
      .select('permission_level')
      .eq('pet_id', petId)
      .eq('shared_with_user_id', userId)
      .eq('status', 'accepted')
      .maybeSingle();

    if (shareError) {
      console.error('Error checking pet share:', shareError);
      return false;
    }

    if (!share) {
      return false;
    }

    return permissionHierarchy[share.permission_level as PermissionLevel] >=
           permissionHierarchy[requiredPermission];
  } catch (error) {
    console.error('Error in checkPetPermission:', error);
    return false;
  }
};

export const getPetPermissionLevel = async (
  userId: string,
  petId: string
): Promise<PermissionLevel | null> => {
  try {
    const { data: pet, error: petError } = await supabaseClient
      .from('pets')
      .select('owner_id')
      .eq('id', petId)
      .single();

    if (petError) {
      console.error('Error checking pet ownership:', petError);
      return null;
    }

    if (pet?.owner_id === userId) {
      return 'admin';
    }

    const { data: share, error: shareError } = await supabaseClient
      .from('pet_shares')
      .select('permission_level')
      .eq('pet_id', petId)
      .eq('shared_with_user_id', userId)
      .eq('status', 'accepted')
      .maybeSingle();

    if (shareError) {
      console.error('Error checking pet share:', shareError);
      return null;
    }

    return share?.permission_level as PermissionLevel || null;
  } catch (error) {
    console.error('Error in getPetPermissionLevel:', error);
    return null;
  }
};

export const isPetOwner = async (
  userId: string,
  petId: string
): Promise<boolean> => {
  try {
    const { data: pet, error } = await supabaseClient
      .from('pets')
      .select('owner_id')
      .eq('id', petId)
      .single();

    if (error) {
      console.error('Error checking pet ownership:', error);
      return false;
    }

    return pet?.owner_id === userId;
  } catch (error) {
    console.error('Error in isPetOwner:', error);
    return false;
  }
};

export const canViewPet = (userId: string, petId: string) =>
  checkPetPermission(userId, petId, 'view');

export const canEditPet = (userId: string, petId: string) =>
  checkPetPermission(userId, petId, 'edit');

export const canAdminPet = (userId: string, petId: string) =>
  checkPetPermission(userId, petId, 'admin');

export const getPermissionLabel = (level: PermissionLevel): string => {
  const labels: Record<PermissionLevel, string> = {
    'view': 'Ver',
    'edit': 'Editar',
    'admin': 'Administrador'
  };
  return labels[level];
};

export const getPermissionDescription = (level: PermissionLevel): string => {
  const descriptions: Record<PermissionLevel, string> = {
    'view': 'Solo puede ver información',
    'edit': 'Puede ver y editar información',
    'admin': 'Control total (compartir, eliminar)'
  };
  return descriptions[level];
};
