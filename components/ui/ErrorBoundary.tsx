import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { RefreshCw, LogOut } from 'lucide-react-native';
import { Card } from './Card';
import { Button } from './Button';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
    
    // Check if this is a JWT/session error
    if (error.message?.includes('JWT') || 
        error.message?.includes('expired') ||
        error.message?.includes('session')) {
      console.log('Session error detected in ErrorBoundary');
      this.handleSessionError();
    }
  }

  handleSessionError = () => {
    // Clear any stored session data and redirect to login
    setTimeout(() => {
      router.replace('/auth/login');
    }, 1000);
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Check if this is a session error
      const isSessionError = this.state.error?.message?.includes('JWT') ||
                            this.state.error?.message?.includes('expired') ||
                            this.state.error?.message?.includes('session');

      if (isSessionError) {
        return (
          <View style={styles.container}>
            <Card style={styles.errorCard}>
              <LogOut size={64} color="#EF4444" />
              <Text style={styles.errorTitle}>Sesión Expirada</Text>
              <Text style={styles.errorMessage}>
                Tu sesión ha expirado por seguridad. Serás redirigido al login automáticamente.
              </Text>
              <Button
                title="Ir al Login"
                onPress={() => router.replace('/auth/login')}
                size="large"
              />
            </Card>
          </View>
        );
      }

      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.handleRetry} />;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <Card style={styles.errorCard}>
            <RefreshCw size={64} color="#EF4444" />
            <Text style={styles.errorTitle}>Algo salió mal</Text>
            <Text style={styles.errorMessage}>
              Ocurrió un error inesperado. Por favor intenta nuevamente.
            </Text>
            
            {__DEV__ && this.state.error && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>{this.state.error.message}</Text>
              </View>
            )}
            
            <View style={styles.errorActions}>
              <Button
                title="Reintentar"
                onPress={this.handleRetry}
                size="large"
              />
              <TouchableOpacity
                style={styles.homeButton}
                onPress={() => router.replace('/(tabs)')}
              >
                <Text style={styles.homeButtonText}>Ir al Inicio</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  errorCard: {
    alignItems: 'center',
    paddingVertical: 40,
    width: '100%',
    maxWidth: 400,
  },
  errorTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  debugInfo: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  errorActions: {
    width: '100%',
    gap: 12,
  },
  homeButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  homeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
});