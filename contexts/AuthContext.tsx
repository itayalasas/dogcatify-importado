import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
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
  authError: string | null;
  clearAuthError: () => void;
  checkTokenValidity: () => Promise<boolean>;
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
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokenCheckInterval, setTokenCheckInterval] = useState<NodeJS.Timeout | null>(null);

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
            if (!session.user.email_confirmed_at && session.user.app_metadata?.provider !== 'email') {
              console.log('AuthContext - Email not confirmed for user:', session.user.email);
              setAuthError('Debes confirmar tu correo electrónico antes de acceder a la aplicación. Revisa tu bandeja de entrada.');
              await supabaseClient.auth.signOut();
              return;
            }
            
            setIsEmailConfirmed(session.user.email_confirmed_at !== null);
            
            let profile;
            try {
              profile = await getUserProfile(session.user.id);
            } catch (profileError: any) {
              // Handle case where user exists in auth.users but not in profiles (deleted account)
              if (profileError.code === 'PGRST116' && profileError.message?.includes('0 rows')) {
                console.log('AuthContext - User exists in auth but not in profiles (deleted account)');
                // Sign out the user and throw error
                await supabaseClient.auth.signOut();
                setAuthError('Esta cuenta fue eliminada previamente. Por favor crea una nueva cuenta o contacta con soporte.');
                return;
              }
              throw profileError;
            }
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
                followers: [],
                following: [],
                followersCount: 0,
                followingCount: 0,
              };
              
              // Create the profile in the database
              await updateUserProfile(session.user.id, {
                display_name: newUser.displayName,
                photo_url: newUser.photoURL,
                is_owner: newUser.isOwner,
                is_partner: newUser.isPartner,
                location: newUser.location,
                bio: newUser.bio,
                phone: newUser.phone,
              });
              
              setCurrentUser({
                id: session.user.id,
                ...newUser,
              });
            }
          } catch (error: any) {
            console.error('Error loading user profile after login:', error);
            
            // Set auth error for display in UI
            if (error.message?.includes('perfil válido') || error.message?.includes('eliminada')) {
              setAuthError(error.message);
            }
            
            if (error.message?.includes('session_not_found') || error.message?.includes('JWT')) {
              console.log('AuthContext - Session error after login, signing out');
              await supabaseClient.auth.signOut();
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
        console.log('AuthContext - Checking initial session...');
        const { data } = await supabaseClient.auth.getSession();
        const session = data?.session;
        
        console.log('AuthContext - Initial session check result:', session?.user?.email || 'No session');
        setSession(session);
        
        if (session?.user) {
          try {
            let profile;
            try {
              profile = await getUserProfile(session.user.id);
            } catch (profileError: any) {
              // Handle case where user exists in auth.users but not in profiles (deleted account)
              if (profileError.code === 'PGRST116' && profileError.message?.includes('0 rows')) {
                console.log('AuthContext - Initial check: User exists in auth but not in profiles (deleted account)');
                // Sign out the user and show error
                await supabaseClient.auth.signOut();
                setAuthError('Esta cuenta fue eliminada previamente. Por favor crea una nueva cuenta o contacta con soporte.');
                return;
              }
              throw profileError;
            }
            
            if (!mounted) return;
            if (profile) {
              console.log('AuthContext - Initial profile loaded:', profile.display_name);
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
          } catch (error) {
            console.error('AuthContext - Error loading profile:', error);
          }
        } else {
          console.log('AuthContext - No initial session found');
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
      // Clear token check interval
      if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
      }
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Set up periodic token validation when user is authenticated
  useEffect(() => {
    if (currentUser && session) {
      console.log('Setting up token validation interval for user:', currentUser.email);
      
      // Clear any existing interval
      if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
      }
      
      // Check token validity every 5 minutes
      const interval = setInterval(async () => {
        const isValid = await checkTokenValidity();
        if (!isValid) {
          console.log('Token expired, redirecting to login...');
          await handleTokenExpiration();
        }
      }, 5 * 60 * 1000); // 5 minutes
      
      setTokenCheckInterval(interval);
    } else {
      // Clear interval when user logs out
      if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
        setTokenCheckInterval(null);
      }
    }
    
    return () => {
      if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
      }
    };
  }, [currentUser, session]);

  const checkTokenValidity = async (): Promise<boolean> => {
    try {
      // Get current session
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      
      if (error) {
        console.error('Error checking session:', error);
        return false;
      }
      
      if (!session) {
        console.log('No active session found');
        return false;
      }
      
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      const tokenExp = session.expires_at || 0;
      
      console.log('Token validation:', {
        now,
        expires_at: tokenExp,
        isExpired: now >= tokenExp,
        timeUntilExpiry: tokenExp - now
      });
      
      if (now >= tokenExp) {
        console.log('Token has expired');
        return false;
      }
      
      // Try to make a simple API call to verify token works
      const { data, error: testError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .limit(1);
      
      if (testError) {
        console.error('Token validation API call failed:', testError);
        
        // Check for specific JWT errors
        if (testError.message?.includes('JWT') || 
            testError.message?.includes('expired') ||
            testError.message?.includes('invalid')) {
          console.log('JWT error detected, token is invalid');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error in checkTokenValidity:', error);
      return false;
    }
  };

  const handleTokenExpiration = async () => {
    try {
      console.log('Handling token expiration...');
      
      // Clear local state
      setCurrentUser(null);
      setSession(null);
      setIsEmailConfirmed(false);
      
      // Clear token check interval
      if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
        setTokenCheckInterval(null);
      }
      
      // Sign out from Supabase
      await supabaseClient.auth.signOut();
      
      // Show alert and redirect to login
      Alert.alert(
        'Sesión expirada',
        'Tu sesión ha expirado por seguridad. Por favor inicia sesión nuevamente.',
        [
          {
            text: 'Iniciar sesión',
            onPress: () => {
              try {
                router.replace('/auth/login');
              } catch (routerError) {
                console.error('Error navigating to login:', routerError);
                // Fallback navigation
                setTimeout(() => {
                  router.replace('/auth/login');
                }, 100);
              }
            }
          }
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error handling token expiration:', error);
      // Force navigation to login even if there's an error
      try {
        router.replace('/auth/login');
      } catch (routerError) {
        console.error('Error in fallback navigation:', routerError);
      }
    }
  };
  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      console.log('AuthContext - Attempting login with Supabase for:', email);

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('AuthContext - Login error:', error.message); 
        
        // Handle specific session errors
        if (error.message?.includes('session_not_found') || error.message?.includes('JWT')) {
          console.log('AuthContext - Session error during login, clearing state');
          await supabaseClient.auth.signOut();
        }
        
        // Mejorar mensajes de error específicos
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid login credentials');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Email not confirmed');
        } else if (error.message.includes('Too many requests')) {
          throw new Error('Too many requests');
        } else if (error.message.includes('User not found')) {
          throw new Error('User not found');
        }
        
        throw error;
      }
      
      if (data.user) {
        // Check email confirmation using our custom system
        const { isEmailConfirmed: checkEmailConfirmed } = await import('../utils/emailConfirmation');
        const emailConfirmed = await checkEmailConfirmed(data.user.id);
        
        if (!emailConfirmed) {
          console.warn('AuthContext - Email not confirmed for user:', email);
          setIsEmailConfirmed(false);
          throw new Error('Email not confirmed');
        }
        
        setIsEmailConfirmed(emailConfirmed);
        try {
          // Check if user profile exists
          const profile = await getUserProfile(data.user.id);
          
          if (!profile) {
            // Profile doesn't exist, sign out and throw error
            await supabaseClient.auth.signOut();
            throw new Error('Esta cuenta fue eliminada previamente. Por favor crea una nueva cuenta o contacta con soporte.');
          }
          
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
          
          console.log('AuthContext - Login successful, setting user:', user.email);
          setCurrentUser(user);
          return user;
        } catch (error: any) {
          // Handle case where user exists in auth.users but not in profiles
          if (error.code === 'PGRST116' && error.message?.includes('0 rows')) {
            console.log('AuthContext - Login: User exists in auth but not in profiles (deleted account)');
            // Sign out the user and throw clear error message
            await supabaseClient.auth.signOut();
            throw new Error('Esta cuenta fue eliminada previamente. Por favor crea una nueva cuenta o contacta con soporte.');
          }
          throw error;
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
      console.log('AuthContext - Attempting registration for:', email);
      
      // First create the user without email confirmation
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
          // Disable automatic email confirmation
          emailRedirectTo: undefined,
        }
      });
      
      if (error) throw error;
      console.log('AuthContext - Registration successful, user created');
      
      if (data.user) {
        // Create our custom email confirmation token
        const { createEmailConfirmationToken, generateConfirmationUrl } = await import('../utils/emailConfirmation');
        const token = await createEmailConfirmationToken(data.user.id, email, 'signup');
        const confirmationUrl = generateConfirmationUrl(token, 'signup');
        
        console.log('Custom confirmation token created:', token);
        console.log('Confirmation URL:', confirmationUrl);
        
        // Send our custom confirmation email
        const { NotificationService } = await import('../utils/notifications');
        await NotificationService.sendCustomConfirmationEmail(
          email,
          displayName,
          confirmationUrl
        );
        console.log('Custom confirmation email sent successfully');
      }
      
      try {
      } catch (emailError) {
        console.error('Error sending custom confirmation email:', emailError);
        // Don't throw error, registration was successful
      }
      
      // Don't sign out, just set user to null and show confirmation message
      setCurrentUser(null);
      setSession(null);
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('AuthContext - Logging out user');
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      
      // Clear local state
      setCurrentUser(null);
      setSession(null);
      setIsEmailConfirmed(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const value = {
    currentUser,
    loading,
    authInitialized,
    login,
    register,
    logout,
    updateCurrentUser: (updatedUser: User) => setCurrentUser(updatedUser),
    isEmailConfirmed,
    authError,
    clearAuthError,
    checkTokenValidity,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};