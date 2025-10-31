import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { LoadingScreen } from './ui/LoadingScreen';

interface ProtectedScreenProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requirePartner?: boolean;
  redirectTo?: string;
}

export const ProtectedScreen: React.FC<ProtectedScreenProps> = ({
  children,
  requireAuth = true,
  requirePartner = false,
  redirectTo = '/auth/login',
}) => {
  const { currentUser, loading, authInitialized, checkTokenValidity } = useAuth();
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateAndRender = async () => {
      if (!authInitialized || loading) {
        return;
      }

      if (requireAuth && !currentUser) {
        console.log('ProtectedScreen: No user, redirecting to login');
        router.replace(redirectTo);
        return;
      }

      if (requirePartner && currentUser && !currentUser.isPartner) {
        console.log('ProtectedScreen: User is not a partner, redirecting');
        router.replace('/(tabs)');
        return;
      }

      if (currentUser) {
        console.log('ProtectedScreen: Validating token...');
        const tokenValid = await checkTokenValidity();

        if (!tokenValid) {
          console.log('ProtectedScreen: Token invalid, redirecting to login');
          router.replace(redirectTo);
          setIsValid(false);
          return;
        }

        console.log('ProtectedScreen: Token valid, rendering content');
        setIsValid(true);
      } else if (!requireAuth) {
        setIsValid(true);
      }

      setIsValidating(false);
    };

    validateAndRender();
  }, [currentUser, loading, authInitialized, requireAuth, requirePartner]);

  if (loading || !authInitialized || isValidating) {
    return <LoadingScreen />;
  }

  if (!isValid) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
