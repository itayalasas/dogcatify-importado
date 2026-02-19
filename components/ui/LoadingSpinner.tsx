import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export function LoadingSpinner({ message, size = 'medium' }: LoadingSpinnerProps) {
  const logoSize = size === 'small' ? 50 : size === 'large' ? 100 : 70;

  return (
    <View style={styles.container}>
      <View style={styles.loaderContainer}>
        <View
          style={[
            styles.logoContainer,
            {
              width: logoSize,
              height: logoSize,
            },
          ]}
        >
          <Image
            source={require('../../assets/images/logo-transp.png')}
            style={[styles.logo, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
          />
        </View>
      </View>
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loaderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 20,
  },
  logo: {
    opacity: 1,
    backgroundColor: 'transparent',
  },
  message: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});
