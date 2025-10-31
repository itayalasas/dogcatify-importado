import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { supabaseClient, getUserProfile, updateUserProfile, signIn as supabaseSignIn, signUp as supabaseSignUp, signOut as supabaseSignOut, setTokenExpirationCallback } from '../lib/supabase';
import { User } from '../types';
import { logger } from '@/utils/datadogLogger';

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
  const tokenCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const isHandlingExpirationRef = useRef(false);
  const lastValidationRef = useRef<number>(0);

  const updateCurrentUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  useEffect(() => {
    let mounted = true;
    let initializationComplete = false;

    setTokenExpirationCallback(() => {
      console.log('Token expiration detected from global error handler');
      if (mounted && !isHandlingExpirationRef.current) {
        handleTokenExpiration();
      }
    });

    const safetyTimeout = setTimeout(() => {
      if (!initializationComplete && mounted) {
        console.warn('Auth initialization timed out after 10 seconds');
        setLoading(false);
        setAuthInitialized(true);
      }
    }, 10000);

    // Set up auth state listener
    const subscription = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        // Handle different auth events
        if (event === 'SIGNED_UP') {
          // Since we're not using signUp anymore, this shouldn't happen
          // But if it does, just ignore it
          return;
        }
        
        if (event === 'SIGNED_OUT' || !session) {
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
        initializationComplete = true;
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
          const user = {
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
            followers: profile.followers || [],
            following: profile.following || [],
            followersCount: (profile.followers || []).length,
            followingCount: (profile.following || []).length,
          };
          setCurrentUser(user);

          logger.setUser(userId, {
            email: userEmail,
            displayName: profile.display_name || '',
            isPartner: profile.is_partner || false,
          });
          logger.info('User logged in', {
            userId,
            isPartner: profile.is_partner || false,
          });
        } else {
          // Create user profile if it doesn't exist
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
          
          const user = {
            id: userId,
            ...newUser,
          };
          setCurrentUser(user);

          logger.setUser(userId, {
            email: userEmail,
            displayName: '',
            isPartner: false,
          });
          logger.info('New user profile created and logged in', { userId });
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
      } finally {
        // ALWAYS complete initialization, even if there were errors
        if (mounted) {
          setAuthInitialized(true);
          setLoading(false);
          initializationComplete = true;
        }
      }
    };
    
    checkSession();
    
    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      if (tokenCheckIntervalRef.current) {
        clearInterval(tokenCheckIntervalRef.current);
      }
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Set up periodic token validation and app state monitoring
  useEffect(() => {
    if (currentUser && session) {
      console.log('Setting up token validation for user:', currentUser.email);

      if (tokenCheckIntervalRef.current) {
        clearInterval(tokenCheckIntervalRef.current);
      }

      tokenCheckIntervalRef.current = setInterval(async () => {
        if (!isHandlingExpirationRef.current) {
          const now = Date.now();
          if (now - lastValidationRef.current < 30000) {
            return;
          }
          lastValidationRef.current = now;
          const isValid = await checkTokenValidity();
          if (!isValid) {
            console.log('Token expired in periodic check, redirecting to login...');
            await handleTokenExpiration();
          }
        }
      }, 60 * 1000);

      const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active' &&
          currentUser &&
          !isHandlingExpirationRef.current
        ) {
          console.log('App returned to foreground, checking token validity...');
          const isValid = await checkTokenValidity();
          if (!isValid) {
            console.log('Token expired on app resume, redirecting to login...');
            await handleTokenExpiration();
          }
        }
        appState.current = nextAppState;
      });

      return () => {
        if (tokenCheckIntervalRef.current) {
          clearInterval(tokenCheckIntervalRef.current);
          tokenCheckIntervalRef.current = null;
        }
        subscription?.remove();
      };
    } else {
      if (tokenCheckIntervalRef.current) {
        clearInterval(tokenCheckIntervalRef.current);
        tokenCheckIntervalRef.current = null;
      }
    }
  }, [currentUser, session]);

  const checkTokenValidity = async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();

      if (error) {
        console.error('Error checking session:', error);
        if (error.message?.includes('refresh_token_not_found') ||
            error.message?.includes('session_not_found') ||
            error.message?.includes('Invalid Refresh Token')) {
          console.log('Session completely invalid, cannot refresh');
          return false;
        }
        return false;
      }

      if (!session) {
        console.log('No active session found');
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      const tokenExp = session.expires_at || 0;
      const timeUntilExpiry = tokenExp - now;

      if (now >= tokenExp) {
        console.log('Token has expired, attempting refresh...');
        try {
          const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();

          if (refreshError) {
            console.error('Failed to refresh expired session:', refreshError);
            if (refreshError.message?.includes('refresh_token_not_found') ||
                refreshError.message?.includes('Invalid Refresh Token')) {
              console.log('Refresh token invalid, session cannot be recovered');
              return false;
            }
            return false;
          }

          if (!refreshData.session) {
            console.log('No session returned after refresh');
            return false;
          }

          console.log('Session refreshed successfully after expiration');
          setSession(refreshData.session);
          return true;
        } catch (refreshError) {
          console.error('Exception during session refresh:', refreshError);
          return false;
        }
      }

      if (timeUntilExpiry < 300) {
        console.log('Token expires soon (< 5 min), attempting preemptive refresh...');
        try {
          const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();

          if (refreshError) {
            console.error('Failed to preemptively refresh session:', refreshError);
            if (timeUntilExpiry > 60) {
              console.log('Still have time, continuing with current session');
              return true;
            }
            return false;
          }

          if (refreshData.session) {
            console.log('Session preemptively refreshed successfully');
            setSession(refreshData.session);
          }
          return true;
        } catch (refreshError) {
          console.error('Exception during preemptive refresh:', refreshError);
          if (timeUntilExpiry > 60) {
            return true;
          }
          return false;
        }
      }

      const { error: testError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .limit(1);

      if (testError) {
        console.error('Token validation API call failed:', testError);

        if (testError.message?.includes('JWT') ||
            testError.message?.includes('expired') ||
            testError.message?.includes('invalid') ||
            testError.code === 'PGRST301') {
          console.log('JWT error detected during validation, token is invalid');
          return false;
        }
      }

      return true;
    } catch (error: any) {
      console.error('Error in checkTokenValidity:', error);
      if (error?.message?.includes('JWT') ||
          error?.message?.includes('expired') ||
          error?.message?.includes('session_not_found')) {
        console.log('Critical session error detected');
        return false;
      }
      return false;
    }
  };

  const handleTokenExpiration = async () => {
    if (isHandlingExpirationRef.current) {
      console.log('Already handling token expiration, skipping...');
      return;
    }

    isHandlingExpirationRef.current = true;

    try {
      console.log('Handling token expiration...');

      if (tokenCheckIntervalRef.current) {
        clearInterval(tokenCheckIntervalRef.current);
        tokenCheckIntervalRef.current = null;
      }

      setLoading(false);
      setCurrentUser(null);
      setSession(null);
      setIsEmailConfirmed(false);

      try {
        await supabaseClient.auth.signOut();
      } catch (signOutError) {
        console.error('Error during sign out:', signOutError);
      }

      setTimeout(() => {
        try {
          router.replace('/auth/login');
        } catch (routerError) {
          console.error('Error navigating to login:', routerError);
        }
      }, 100);

      Alert.alert(
        'Sesión expirada',
        'Tu sesión ha expirado por seguridad. Por favor inicia sesión nuevamente.',
        [
          {
            text: 'OK',
            onPress: () => {
              isHandlingExpirationRef.current = false;
            }
          }
        ],
        {
          cancelable: false,
          onDismiss: () => {
            isHandlingExpirationRef.current = false;
          }
        }
      );
    } catch (error) {
      console.error('Error handling token expiration:', error);
      isHandlingExpirationRef.current = false;
      setTimeout(() => {
        try {
          router.replace('/auth/login');
        } catch (routerError) {
          console.error('Error in fallback navigation:', routerError);
        }
      }, 100);
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
            followers: profile.followers || [],
            following: profile.following || [],
            followersCount: (profile.followers || []).length,
            followingCount: (profile.following || []).length,
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
      console.log('AuthContext - Register function called, but registration is now handled in register.tsx');
      console.log('This function should not be called anymore. Throwing error to prevent duplicate registration.');
      throw new Error('Register function in AuthContext is deprecated. Use the registration flow in register.tsx instead.');
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      logger.info('User logging out', { userId: currentUser?.id });
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

      logger.clearUser();

      setCurrentUser(null);
      setSession(null);
      setIsEmailConfirmed(false);
    } catch (error) {
      logger.error('Logout error', error as Error);
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