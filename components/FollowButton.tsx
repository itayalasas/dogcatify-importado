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
        // Get current following list
        const { data: currentUserData, error: currentUserError } = await supabaseClient
          .from('profiles')
          .select('following')
          .eq('id', currentUser.id)
          .single();
        
        if (currentUserError) throw currentUserError;
        
        // Get target user followers list
        const { data: targetUserData, error: targetUserError } = await supabaseClient
          .from('profiles')
          .select('followers')
          .eq('id', userId)
          .single();
        
        if (targetUserError) throw targetUserError;
        
        // Update current user following list
        const newFollowing = (currentUserData.following || []).filter((id: string) => id !== userId);
        const { error: updateCurrentError } = await supabaseClient
          .from('profiles')
          .update({ following: newFollowing })
          .eq('id', currentUser.id);
        
        if (updateCurrentError) throw updateCurrentError;
        
        // Update target user followers list
        const newFollowers = (targetUserData.followers || []).filter((id: string) => id !== currentUser.id);
        const { error: updateTargetError } = await supabaseClient
          .from('profiles')
          .update({ followers: newFollowers })
          .eq('id', userId);
        
        if (updateTargetError) throw updateTargetError;
      } else {
        // Follow
        // Get current following list
        const { data: currentUserData, error: currentUserError } = await supabaseClient
          .from('profiles')
          .select('following')
          .eq('id', currentUser.id)
          .single();
        
        if (currentUserError) throw currentUserError;
        
        // Get target user followers list
        const { data: targetUserData, error: targetUserError } = await supabaseClient
          .from('profiles')
          .select('followers')
          .eq('id', userId)
          .single();
        
        if (targetUserError) throw targetUserError;
        
        // Update current user following list
        const newFollowing = [...(currentUserData.following || []), userId];
        const { error: updateCurrentError } = await supabaseClient
          .from('profiles')
          .update({ following: newFollowing })
          .eq('id', currentUser.id);
        
        if (updateCurrentError) throw updateCurrentError;
        
        // Update target user followers list
        const newFollowers = [...(targetUserData.followers || []), currentUser.id];
        const { error: updateTargetError } = await supabaseClient
          .from('profiles')
          .update({ followers: newFollowers })
          .eq('id', userId);
        
        if (updateTargetError) throw updateTargetError;
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado de seguimiento');
    } finally {
      setLoading(false);
    }
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