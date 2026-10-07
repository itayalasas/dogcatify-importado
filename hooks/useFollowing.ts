import { useCallback, useEffect, useReducer } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import {
  followUser,
  getCachedFollowing,
  loadFollowing,
  subscribeToFollowing,
  unfollowUser,
} from '../utils/followService';

export const useFollowing = (targetUserId?: string | null) => {
  const { currentUser } = useAuth();
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    const unsubscribe = subscribeToFollowing(rerender);

    if (currentUser?.id) {
      loadFollowing(currentUser.id).catch((error) => {
        console.warn('Could not load following list:', error);
      });
    }

    return unsubscribe;
  }, [currentUser?.id]);

  const canFollow = !!currentUser && !!targetUserId && targetUserId !== currentUser.id;
  const { ready, isFollowing } = getCachedFollowing(currentUser?.id, targetUserId);

  const follow = useCallback(async () => {
    if (!currentUser || !targetUserId) return;
    try {
      await followUser(currentUser.id, targetUserId);
    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Error', 'No se pudo seguir al usuario');
    }
  }, [currentUser?.id, targetUserId]);

  const unfollow = useCallback(async () => {
    if (!currentUser || !targetUserId) return;
    try {
      await unfollowUser(currentUser.id, targetUserId);
    } catch (error) {
      console.error('Error unfollowing user:', error);
      Alert.alert('Error', 'No se pudo dejar de seguir al usuario');
    }
  }, [currentUser?.id, targetUserId]);

  return { canFollow, ready, isFollowing, follow, unfollow };
};
