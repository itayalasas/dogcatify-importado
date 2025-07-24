import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabaseClient, getUserProfile, updateUserProfile, signIn as supabaseSignIn, signUp as supabaseSignUp, signOut as supabaseSignOut } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean; 
  login: (email: string, password: string) => Promise<User | null>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  isEmailConfirmed: boolean;
  authInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any | null>(null);
  const [isEmailConfirmed, setIsEmailConfirmed] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener
    const subscription = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('AuthContext - Auth state changed:', event, session?.user?.email || 'No user');
        
        // Handle session expiration
        if (event === 'TOKEN_REFRESHED') {
          console.log('AuthContext - Token refreshed successfully');
        }
        
        if (event === 'SIGNED_OUT' || !session) {
          console.log('AuthContext - User signed out or session expired');
          if (!mounted) return;
          setCurrentUser(null);
          setSession(null);
          setLoading(false);
          setAuthInitialized(true);
          return;
        }
        
        setSession(session);
        
        if (!mounted || !session?.user) return;
        if (session?.user) {
          try {
            // Check if email is confirmed
            setIsEmailConfirmed(session.user.email_confirmed_at !== null);
            
            const profile = await getUserProfile(session.user.id);
            
            if (profile) {
              if (!mounted) return;
              console.log('AuthContext - User profile loaded:', profile.display_name);
              setCurrentUser({
                id: session.user.id,
                email: session.user.email!,
                displayName: profile.display_name || '',
                photoURL: profile.photo_url,
                isOwner: profile.is_owner || true,
                isPartner: profile.is_partner || false,
                location: profile.location,
                bio: profile.bio,
                phone: profile.phone,
                createdAt: new Date(profile.created_at),
                followers: profile.followers,
                following: profile.following,
                followersCount: profile.followers?.length || 0,
                followingCount: profile.following?.length || 0,
              });
            } else {
              // Create user profile if it doesn't exist
              console.log('AuthContext - Creating new user profile for:', session.user.email);
              if (!mounted) return;
              const newUser: Omit<User, 'id'> = {
                email: session.user.email || '',
                displayName: session.user.user_metadata?.display_name || '',
                photoURL: session.user.user_metadata?.photo_url,
                isOwner: true,
                isPartner: false,
                createdAt: new Date(),
              };
              
              await updateUserProfile(session.user.id, {
                display_name: newUser.displayName,
                photo_url: newUser.photoURL,
                is_owner: newUser.isOwner,
                is_partner: newUser.isPartner,
                created_at: new Date(),
              });
              
              setCurrentUser({ id: session.user.id, ...newUser });
            }
          } catch (error: any) {
            if (!mounted) return;
            console.error('Error processing user data:', error);
            
            // If it's a session error, sign out the user
            if (error.message?.includes('session_not_found') || error.message?.includes('JWT')) {
              console.log('AuthContext - Session expired, signing out user');
              await supabaseClient.auth.signOut();
              setCurrentUser(null);
              setSession(null);
            }
          }
        }
        if (!mounted) return;
        setLoading(false);
        setAuthInitialized(true);
      }
    );

    // Initial session check
    const checkSession = async () => {
      try {
        if (!mounted) return;
        const { data } = await supabaseClient.auth.getSession();
        const session = data?.session;
        
        setSession(session);
        
        if (session?.user) {
          try {
            const profile = await getUserProfile(session.user.id);
            
            if (!mounted) return;
            if (profile) {
              setCurrentUser({
                id: session.user.id,
                email: session.user.email!,
                displayName: profile.display_name || '',
                photoURL: profile.photo_url,
                isOwner: profile.is_owner || true,
                isPartner: profile.is_partner || false,
                location: profile.location,
                bio: profile.bio,
                phone: profile.phone,
                createdAt: new Date(profile.created_at),
                followers: profile.followers,
                following: profile.following,
                followersCount: profile.followers?.length || 0,
                followingCount: profile.following?.length || 0,
              });
            }
          } catch (error: any) {
            console.error('Error loading user profile:', error);
            if (!mounted) return;
            if (error.message?.includes('session_not_found') || error.message?.includes('JWT')) {
              console.log('AuthContext - Session expired during profile load, signing out');
              await supabaseClient.auth.signOut();
            }
          }
        }
      } catch (error) {
        console.error('AuthContext - Error in checkSession:', error);
      }
      if (!mounted) return;
      setAuthInitialized(true);
      setLoading(false);
    };
    
    checkSession();
    
    return () => {
      mounted = false;
      if (subscription?.data?.subscription?.unsubscribe) {
        subscription.data.subscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      console.log('AuthContext - Attempting login with Supabase for:', email);

      const { data, error } = await supabaseSignIn(email, password);
      
      if (error) {
        console.error('AuthContext - Login error:', error.message); 
        
        // Handle specific session errors
        if (error.message?.includes('session_not_found') || error.message?.includes('JWT')) {
          console.log('AuthContext - Session error during login, clearing state');
          await supabaseSignOut();
        }
        
        throw error;
      }
      
      if (data.user) {
        // Check if email is confirmed
        if (data.user.email_confirmed_at === null) {
          console.warn('AuthContext - Email not confirmed for user:', email);
          setIsEmailConfirmed(false);
          throw new Error('Por favor confirma tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.');
        }
        
        setIsEmailConfirmed(true);
        try {
          const profile = await getUserProfile(data.user.id);
          
          if (profile) {
            const user: User = {
              id: data.user.id,
              email: data.user.email!,
              displayName: profile.display_name || '',
              photoURL: profile.photo_url,
              isOwner: profile.is_owner || true,
              isPartner: profile.is_partner || false,
              location: profile.location,
              bio: profile.bio,
              phone: profile.phone,
              createdAt: new Date(profile.created_at),
              followers: profile.followers,
              following: profile.following,
              followersCount: profile.followers?.length || 0,
              followingCount: profile.following?.length || 0,
            };
            
            return user;
          }
        } catch (error: any) {
          console.error('Error loading user profile after login:', error);
          if (error.message?.includes('session_not_found') || error.message?.includes('JWT')) {
            console.log('AuthContext - Session error after login, signing out');
            await supabaseSignOut();
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, displayName: string) => {
    try {
      console.log('AuthContext - Starting registration for:', email);
      
      const { data, error } = await supabaseSignUp(email, password, { displayName });
      
      if (error) throw error;
      console.log('AuthContext - Registration successful, user created');
      
      // Sign out after registration to force email confirmation
      await supabaseSignOut();
      setCurrentUser(null);
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('AuthContext - Logging out user');
      const result = await supabaseSignOut();
      if (result.error) throw result.error;
      
      // Clear local state
      setCurrentUser(null);
      setSession(null);
      setIsEmailConfirmed(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const value = {
    currentUser,
    loading,
    authInitialized,
    login,
    register,
    logout,
    isEmailConfirmed,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};