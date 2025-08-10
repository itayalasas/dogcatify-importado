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

  const updateCurrentUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener
    const subscription = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('AuthContext - Auth state changed:', event, session?.user?.email || 'No user');
        
        // Handle different auth events
        if (event === 'SIGNED_UP') {
          console.log('AuthContext - SIGNED_UP event detected, signing out immediately');
          // Since we're not using signUp anymore, this shouldn't happen
          // But if it does, just ignore it
          console.log('Ignoring SIGNED_UP event - using custom registration');
          return;
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
        
        // Only validate email confirmation for SIGNED_IN events (login)
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            // Check email confirmation strictly
            console.log('AuthContext - Checking email confirmation for user:', session.user.email);
            
            // STRICT EMAIL CONFIRMATION VALIDATION
            console.log('=== EMAIL CONFIRMATION VALIDATION START ===');
            console.log('User ID:', session.user.id);
            console.log('User email:', session.user.email);
            
            // Check both our custom confirmation system AND profiles table
            console.log('Checking email_confirmations table...');
            const { data: confirmationData, error: confirmationError } = await supabaseClient
              .from('email_confirmations')
              .select('*')
              .eq('type', 'signup')
              .eq('user_id', session.user.id)
              .eq('is_confirmed', true)
              .maybeSingle();
            
            console.log('Confirmation query result:', {
              hasData: !!confirmationData,
              error: confirmationError?.message,
              errorCode: confirmationError?.code
            });
            
            if (confirmationData) {
              console.log('Confirmation data found:', {
                userId: confirmationData.user_id,
                email: confirmationData.email,
                isConfirmed: confirmationData.is_confirmed,
                type: confirmationData.type,
                confirmedAt: confirmationData.confirmed_at
              });
            }
            
            // Also check profiles table for email_confirmed
            console.log('Checking profiles table for email_confirmed...');
            const { data: profileData, error: profileError } = await supabaseClient
              .from('profiles')
              .select('email_confirmed, email_confirmed_at')
              .eq('id', session.user.id)
              .maybeSingle();
            
            console.log('Profile email confirmation status:', {
              hasData: !!profileData,
              error: profileError?.message,
              emailConfirmed: profileData?.email_confirmed,
              confirmedAt: profileData?.email_confirmed_at
            });
            
            // VALIDATION: Check both systems
            const isConfirmedInEmailTable = confirmationData && 
                                          confirmationData.user_id === session.user.id && 
                                          confirmationData.is_confirmed === true;
            
            const isConfirmedInProfile = profileData && 
                                       profileData.email_confirmed === true;
            
            // Also check Supabase Auth confirmation status
            const isConfirmedInAuth = session.user.email_confirmed_at !== null;
            
            // User is confirmed if ANY system shows confirmation
            const isEmailConfirmed = isConfirmedInEmailTable || isConfirmedInProfile || isConfirmedInAuth;
            
            console.log('Final confirmation status:', {
              emailTableConfirmed: isConfirmedInEmailTable,
              profileTableConfirmed: isConfirmedInProfile,
              authTableConfirmed: isConfirmedInAuth,
              finalResult: isEmailConfirmed
            });
            
            if (!isEmailConfirmed) {
              
              console.log('=== EMAIL NOT CONFIRMED - BLOCKING ACCESS ===');
              console.log('Neither email_confirmations nor profiles show confirmed status');
              
              setIsEmailConfirmed(false);
              setAuthError(`EMAIL_NOT_CONFIRMED:${session.user.email}`);
              await supabaseClient.auth.signOut();
              return;
            }
            
            console.log('=== EMAIL CONFIRMED - ACCESS GRANTED ===');
            console.log('Confirmation validated for user:', session.user.email);
            setIsEmailConfirmed(true);
            setAuthError(null); // Clear any previous auth errors
            
            // Load user profile after email confirmation is validated
            await loadUserProfile(session.user.id, session.user.email!);
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
        else if (session?.user && event !== 'SIGNED_UP') {
          // For other events, load profile without email validation
          try {
            await loadUserProfile(session.user.id, session.user.email!);
          } catch (error: any) {
            console.error('Error loading user profile:', error);
          }
        }
        
        if (!mounted) return;
        setLoading(false);
        setAuthInitialized(true);
      }
    );

    // Helper function to load user profile
    const loadUserProfile = async (userId: string, userEmail: string) => {
      try {
        let profile;
        try {
          profile = await getUserProfile(userId);
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
            id: userId,
            email: userEmail,
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
          console.log('AuthContext - Creating new user profile for:', userEmail);
          if (!mounted) return;
          const newUser: Omit<User, 'id'> = {
            email: userEmail,
            displayName: '',
            photoURL: undefined,
            isOwner: true,
            isPartner: false,
            createdAt: new Date(),
            followers: [],
            following: [],
            followersCount: 0,
            followingCount: 0,
          };
          
          // Create the profile in the database
          await updateUserProfile(userId, {
            display_name: newUser.displayName,
            photo_url: newUser.photoURL,
            is_owner: newUser.isOwner,
            is_partner: newUser.isPartner,
            location: newUser.location,
            bio: newUser.bio,
            phone: newUser.phone,
          });
          
          setCurrentUser({
            id: userId,
            ...newUser,
          });
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        throw error;
      }
    };

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
            // Check email confirmation for initial session
            console.log('AuthContext - Initial session: Checking email confirmation for user:', session.user.email);
            
            // Check both confirmation systems
            const { data: confirmationData, error: confirmationError } = await supabaseClient
              .from('email_confirmations')
              .select('*')
              .eq('type', 'signup')
              .eq('user_id', session.user.id)
              .single();
            
            const { data: profileData, error: profileError } = await supabaseClient
              .from('profiles')
              .select('email_confirmed')
              .eq('id', session.user.id)
              .single();
            
            const isConfirmedInEmailTable = confirmationData && 
                                          !confirmationError && 
                                          confirmationData.user_id === session.user.id && 
                                          confirmationData.is_confirmed === true;
            
            const isConfirmedInProfile = profileData && 
                                       !profileError && 
                                       profileData.email_confirmed === true;
            
            const isEmailConfirmed = isConfirmedInEmailTable || isConfirmedInProfile;
            
            if (!isEmailConfirmed) {
              
              console.log('AuthContext - Initial session: Email not confirmed, signing out');
              setIsEmailConfirmed(false);
              setAuthError(`EMAIL_NOT_CONFIRMED:${session.user.email}`);
              await supabaseClient.auth.signOut();
              return;
            }
            
            console.log('AuthContext - Initial session: Email confirmed, loading profile');
            setIsEmailConfirmed(true);
            await loadUserProfile(session.user.id, session.user.email!);
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
        // STRICT EMAIL CONFIRMATION VALIDATION - Check our custom system ONLY
        console.log('=== STRICT EMAIL CONFIRMATION CHECK ===');
        console.log('User ID:', data.user.id);
        console.log('User email:', data.user.email);
        
        // Check both confirmation systems
        const { data: confirmationData, error: confirmationError } = await supabaseClient
          .from('email_confirmations')
          .select('*')
          .eq('user_id', data.user.id)
          .eq('type', 'signup')
          .single();
        
        const { data: profileData, error: profileError } = await supabaseClient
          .from('profiles')
          .select('email_confirmed')
          .eq('id', data.user.id)
          .single();
        
        console.log('Confirmation query result:', {
          hasData: !!confirmationData,
          error: confirmationError?.message,
          errorCode: confirmationError?.code,
          isConfirmed: confirmationData?.is_confirmed
        });
        
        console.log('Profile confirmation result:', {
          hasData: !!profileData,
          error: profileError?.message,
          emailConfirmed: profileData?.email_confirmed
        });
        
        // Check both systems for confirmation
        const isConfirmedInEmailTable = confirmationData && 
                                      !confirmationError && 
                                      confirmationData.user_id === data.user.id && 
                                      confirmationData.is_confirmed === true;
        
        const isConfirmedInProfile = profileData && 
                                   !profileError && 
                                   profileData.email_confirmed === true;
        
        const isEmailConfirmed = isConfirmedInEmailTable || isConfirmedInProfile;
        
        if (!isEmailConfirmed) {
          
          console.log('=== EMAIL NOT CONFIRMED - BLOCKING LOGIN ===');
          console.log('Neither system shows email as confirmed');
          
          setIsEmailConfirmed(false);
          setAuthError(`EMAIL_NOT_CONFIRMED:${data.user.email}`);
          
          // Sign out the user immediately
          await supabaseClient.auth.signOut();
          
          throw new Error('Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.');
        }
        
        console.log('=== EMAIL CONFIRMED - LOGIN ALLOWED ===');
        setIsEmailConfirmed(true);
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
      
      // Simplificar signUp para evitar comportamientos automáticos
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
      });
      
      if (error) {
        console.error('Registration error:', error);
        throw error;
      }
      
      console.log('AuthContext - Registration successful');
      
      if (data.user) {
        // Crear perfil manualmente después del registro
        try {
          await updateUserProfile(data.user.id, {
            display_name: displayName,
            email: email,
            is_owner: true,
            is_partner: false,
            email_confirmed: false,
            created_at: new Date().toISOString()
          });
          console.log('User profile created successfully');
        } catch (profileError) {
          console.error('Error creating user profile:', profileError);
          // Continue with registration even if profile creation fails
        }
        
        console.log('Creating custom email confirmation token for user:', data.user.id);
        
        // Create our custom email confirmation token
        const { createEmailConfirmationToken, generateConfirmationUrl } = await import('../utils/emailConfirmation');
        const token = await createEmailConfirmationToken(data.user.id, email, 'signup');
        const confirmationUrl = generateConfirmationUrl(token, 'signup');
        
        console.log('Custom confirmation token created:', token);
        
        // Send our custom confirmation email
        const { NotificationService } = await import('../utils/notifications');
        await NotificationService.sendCustomConfirmationEmail(
          email,
          displayName,
          confirmationUrl
        );
        console.log('Custom confirmation email sent successfully');
      }
      
      // Sign out inmediatamente para evitar cualquier modal automático
      await supabaseClient.auth.signOut();
      
      console.log('Registration completed successfully, user needs to confirm email');
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
    updateCurrentUser,
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