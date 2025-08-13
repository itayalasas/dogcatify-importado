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
      console.log('=== FOLLOW/UNFOLLOW ACTION START ===');
      console.log('Current user:', currentUser.id, currentUser.displayName);
      console.log('Target user:', userId, authorName);
      console.log('Current status - isFollowing:', isFollowing);
      
      if (isFollowing) {
        // Unfollow
        console.log('Executing UNFOLLOW action...');
        await unfollowUser(currentUser.id, userId);
      } else {
        // Follow
        console.log('Executing FOLLOW action...');
        await followUser(currentUser.id, userId);
      }
      
      // Update local state immediately
      const newFollowingStatus = !isFollowing;
      console.log('Updating local state to:', newFollowingStatus);
      setIsFollowing(!isFollowing);
      
      console.log('=== FOLLOW/UNFOLLOW ACTION COMPLETED ===');
    } catch (error) {
      console.error('Error updating follow status:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado de seguimiento');
    } finally {
      setLoading(false);
    }
  };

  const followUser = async (followerId: string, followingId: string) => {
    console.log('=== FOLLOW USER FUNCTION ===');
    console.log('Follower ID:', followerId);
    console.log('Following ID:', followingId);
    
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
    
    console.log('Current user following before:', currentUserResult.data.following);
    console.log('Target user followers before:', targetUserResult.data.followers);
    
    // Update following list for current user
    const newFollowing = [...(currentUserResult.data.following || []), followingId];
    
    // Update followers list for target user
    const newFollowers = [...(targetUserResult.data.followers || []), followerId];
    
    console.log('New following array:', newFollowing);
    console.log('New followers array:', newFollowers);
    
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
    
    console.log('Both users updated successfully');
    console.log('=== FOLLOW USER FUNCTION COMPLETED ===');
  };

  const unfollowUser = async (followerId: string, followingId: string) => {
    console.log('=== UNFOLLOW USER FUNCTION ===');
    console.log('Follower ID:', followerId);
    console.log('Following ID:', followingId);
    
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
    
    console.log('Current user following before:', currentUserResult.data.following);
    console.log('Target user followers before:', targetUserResult.data.followers);
    
    // Remove from following list for current user
    const newFollowing = (currentUserResult.data.following || []).filter((id: string) => id !== followingId);
    
    // Remove from followers list for target user
    const newFollowers = (targetUserResult.data.followers || []).filter((id: string) => id !== followerId);
    
    console.log('New following array:', newFollowing);
    console.log('New followers array:', newFollowers);
    
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
    
    console.log('Both users updated successfully');
    console.log('=== UNFOLLOW USER FUNCTION COMPLETED ===');
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