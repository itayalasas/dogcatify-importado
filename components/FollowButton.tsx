import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabaseClient } from '../lib/supabase';

interface FollowButtonProps {
  userId: string;
  authorName: string;
  compact?: boolean;
}

export const FollowButton: React.FC<FollowButtonProps> = ({ 
  userId, 
  authorName, 
  compact = false 
}) => {
  const { currentUser } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || userId === currentUser.id) return;

    // Check if current user is following the target user
    const checkFollowStatus = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('following')
          .eq('id', currentUser.id)
          .single();
        
        if (error) throw error;
        
        const following = data.following || [];
        setIsFollowing(following.includes(userId));
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };
    
    checkFollowStatus();
    
    // Set up real-time subscription
    const subscription = supabaseClient
      .channel('profile-changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`
        }, 
        () => {
          checkFollowStatus();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser, userId]);

  const handleFollow = async () => {
    if (!currentUser || userId === currentUser.id) return;

    setLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await unfollowUser(currentUser.id, userId);
      } else {
        // Follow
        await followUser(currentUser.id, userId);
      }
      
      // Update local state immediately
      setIsFollowing(!isFollowing);
    } catch (error) {
      console.error('Error updating follow status:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado de seguimiento');
    } finally {
      setLoading(false);
    }
  };

  const followUser = async (followerId: string, followingId: string) => {
    // Get current data for both users
    const [currentUserResult, targetUserResult] = await Promise.all([
      supabaseClient
        .from('profiles')
        .select('following')
        .eq('id', followerId)
        .single(),
      supabaseClient
        .from('profiles')
        .select('followers')
        .eq('id', followingId)
        .single()
    ]);
    
    if (currentUserResult.error) throw currentUserResult.error;
    if (targetUserResult.error) throw targetUserResult.error;
    
    // Update following list for current user
    const newFollowing = [...(currentUserResult.data.following || []), followingId];
    
    // Update followers list for target user
    const newFollowers = [...(targetUserResult.data.followers || []), followerId];
    
    // Update both users simultaneously
    const [updateCurrentResult, updateTargetResult] = await Promise.all([
      supabaseClient
        .from('profiles')
        .update({ 
          following: newFollowing,
          updated_at: new Date().toISOString()
        })
        .eq('id', followerId),
      supabaseClient
        .from('profiles')
        .update({ 
          followers: newFollowers,
          updated_at: new Date().toISOString()
        })
        .eq('id', followingId)
    ]);
    
    if (updateCurrentResult.error) throw updateCurrentResult.error;
    if (updateTargetResult.error) throw updateTargetResult.error;
  };

  const unfollowUser = async (followerId: string, followingId: string) => {
    // Get current data for both users
    const [currentUserResult, targetUserResult] = await Promise.all([
      supabaseClient
        .from('profiles')
        .select('following')
        .eq('id', followerId)
        .single(),
      supabaseClient
        .from('profiles')
        .select('followers')
        .eq('id', followingId)
        .single()
    ]);
    
    if (currentUserResult.error) throw currentUserResult.error;
    if (targetUserResult.error) throw targetUserResult.error;
    
    // Remove from following list for current user
    const newFollowing = (currentUserResult.data.following || []).filter((id: string) => id !== followingId);
    
    // Remove from followers list for target user
    const newFollowers = (targetUserResult.data.followers || []).filter((id: string) => id !== followerId);
    
    // Update both users simultaneously
    const [updateCurrentResult, updateTargetResult] = await Promise.all([
      supabaseClient
        .from('profiles')
        .update({ 
          following: newFollowing,
          updated_at: new Date().toISOString()
        })
        .eq('id', followerId),
      supabaseClient
        .from('profiles')
        .update({ 
          followers: newFollowers,
          updated_at: new Date().toISOString()
        })
        .eq('id', followingId)
    ]);
    
    if (updateCurrentResult.error) throw updateCurrentResult.error;
    if (updateTargetResult.error) throw updateTargetResult.error;
  };
  // Don't show button for own posts
  if (!currentUser || userId === currentUser.id) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.followButton,
        compact && styles.compactButton,
        isFollowing && styles.followingButton
      ]}
      onPress={handleFollow}
      disabled={loading}
    >
      <Text style={[
        styles.followButtonText,
        compact && styles.compactText,
        isFollowing && styles.followingText
      ]}>
        {isFollowing ? 'Siguiendo' : 'Seguir'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  followButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  compactButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  compactText: {
    fontSize: 12,
  },
  followingText: {
    color: '#374151',
  },
});