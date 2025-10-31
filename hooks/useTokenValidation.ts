import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

export const useTokenValidation = (enabled = true) => {
  const { checkTokenValidity, currentUser } = useAuth();
  const router = useRouter();
  const isValidatingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !currentUser || isValidatingRef.current) {
      return;
    }

    const validateToken = async () => {
      if (isValidatingRef.current) {
        return;
      }

      isValidatingRef.current = true;

      try {
        const isValid = await checkTokenValidity();

        if (!isValid) {
          console.log('Token invalid in screen, redirecting to login...');
          router.replace('/auth/login');
        }
      } catch (error) {
        console.error('Error validating token in screen:', error);
      } finally {
        isValidatingRef.current = false;
      }
    };

    validateToken();
  }, [enabled, currentUser, checkTokenValidity]);
};
