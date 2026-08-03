import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '../components/ui/Card';

export default function WebInfo() {
  const params = useLocalSearchParams<{
    status?: string | string[];
    title?: string | string[];
    message?: string | string[];
    code?: string | string[];
  }>();

  const getFirst = (value?: string | string[]) =>
    Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

  const status = getFirst(params.status);
  const title = getFirst(params.title);
  const message = getFirst(params.message);
  const code = getFirst(params.code);

  const hasApprovalResult = Boolean(status || title || message || code);

  const statusTheme = {
    success: { badge: 'OK', color: '#0f766e', bg: '#E6F4F2', border: '#4B9991' },
    warning: { badge: 'ATENCIÓN', color: '#9a3412', bg: '#FFF7ED', border: '#fdba74' },
    danger: { badge: 'ERROR', color: '#991b1b', bg: '#FEF2F2', border: '#fecaca' },
    info: { badge: 'INFO', color: '#1d4ed8', bg: '#EEF6FF', border: '#93c5fd' },
  }[status as 'success' | 'warning' | 'danger' | 'info'] || {
    badge: 'INFO',
    color: '#1d4ed8',
    bg: '#EEF6FF',
    border: '#93c5fd',
  };

  // Solo mostrar en web
  if (Platform.OS !== 'web') {
    return null;
  }

  if (hasApprovalResult) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Card style={styles.infoCard}>
            <View style={styles.header}>
              <Text style={styles.logo}>🐾</Text>
              <Text style={styles.title}>DogCatiFy</Text>
            </View>

            <View style={[styles.resultBadge, { backgroundColor: statusTheme.bg, borderColor: statusTheme.border }]}> 
              <Text style={[styles.resultBadgeText, { color: statusTheme.color }]}>{statusTheme.badge}</Text>
            </View>

            <Text style={styles.resultTitle}>{title || 'Resultado de aprobación'}</Text>
            <Text style={styles.resultMessage}>{message || 'Tu solicitud fue procesada.'}</Text>

            <View style={[styles.resultCodeBox, { backgroundColor: statusTheme.bg, borderColor: statusTheme.border }]}>
              <Text style={styles.resultCodeText}>Código: {code || '200'}</Text>
            </View>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.infoCard}>
          <View style={styles.header}>
            <Text style={styles.logo}>🐾</Text>
            <Text style={styles.title}>DogCatiFy</Text>
          </View>
          
          <Text style={styles.subtitle}>
            Aplicación Móvil para Amantes de las Mascotas
          </Text>
          
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>📱 Aplicación Móvil</Text>
            <Text style={styles.infoText}>
              DogCatiFy está diseñada como una aplicación móvil nativa. 
              Para la mejor experiencia, descarga la app en tu dispositivo móvil.
            </Text>
          </View>
          
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>✉️ Confirmación de Email</Text>
            <Text style={styles.infoText}>
              Si llegaste aquí desde un enlace de confirmación de email, 
              el proceso se completará automáticamente. Luego podrás usar 
              la aplicación móvil con tu cuenta confirmada.
            </Text>
          </View>
          
        
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoCard: {
    width: '100%',
    maxWidth: 500,
    padding: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  infoSection: {
    width: '100%',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 24,
    textAlign: 'left',
  },
  resultBadge: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  resultBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  resultTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  resultMessage: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  resultCodeBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  resultCodeText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    textAlign: 'center',
  },
  downloadSection: {
    width: '100%',
    backgroundColor: '#F0F9FF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  downloadTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#0369A1',
    marginBottom: 8,
  },
  downloadText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#0369A1',
    textAlign: 'center',
  },
});