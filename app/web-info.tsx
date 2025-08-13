import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { Card } from '../components/ui/Card';

export default function WebInfo() {
  // Solo mostrar en web
  if (Platform.OS !== 'web') {
    return null;
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