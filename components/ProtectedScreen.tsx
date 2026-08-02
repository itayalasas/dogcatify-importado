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
    let mounted = true;

    const validateAndRender = async () => {
      if (!authInitialized || loading) {
        return;
      }

      try {
        if (requireAuth && !currentUser) {
          setIsValid(false);
          router.replace(redirectTo as any);
          return;
        }

        if (requirePartner && currentUser && !currentUser.isPartner) {
          setIsValid(false);
          router.replace('/(tabs)' as any);
          return;
        }

        if (currentUser) {
          const tokenValid = await checkTokenValidity();

          if (!tokenValid) {
            setIsValid(false);
            router.replace(redirectTo as any);
            return;
          }

          setIsValid(true);
        } else if (!requireAuth) {
          setIsValid(true);
        }
      } finally {
        if (mounted) {
          setIsValidating(false);
        }
      }
    };

    validateAndRender();

    return () => {
      mounted = false;
    };
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
