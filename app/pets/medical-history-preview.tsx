import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Download, Share2, FileText, Printer } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function MedicalHistoryPreview() {
  const { petId, petName, htmlContent } = useLocalSearchParams<{
    petId: string;
    petName: string;
    htmlContent: string;
  }>();

  // Decode base64 content safely
  const decodedHtml = htmlContent ? 
    decodeURIComponent(escape(atob(htmlContent))) : '';

  const handleShare = async () => {
    try {
      const shareContent = {
        title: `Historia Clínica de ${petName}`,
        message: `Historia clínica veterinaria de ${petName}\n\nGenerada por DogCatiFy`,
      };

      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing:', error);
      if (!error.message?.includes('cancelled')) {
        Alert.alert('Error', 'No se pudo compartir la historia clínica');
      }
    }
  };

  const handlePrint = () => {
    Alert.alert(
      'Imprimir',
      'Para imprimir, comparte la historia clínica y ábrela en un navegador.',
      [
        { text: 'Entendido' },
        { text: 'Compartir', onPress: handleShare }
      ]
    );
  };

  const handleGenerateQR = () => {
    router.push({
      pathname: '/pets/share-medical-history',
      params: {
        petId,
        petName,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${process.env.EXPO_PUBLIC_APP_DOMAIN || process.env.EXPO_PUBLIC_APP_URL || 'https://app-dogcatify.netlify.app'}/medical-history/${petId}`)}&format=png&margin=20&ecc=M&color=2D6A6F&bgcolor=FFFFFF`,
        shareUrl: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/medical-history/${petId}`,
        shortUrl: `dogcatify.com/vet/${petId.slice(-8)}`
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Historia Clínica - {petName}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {decodedHtml ? (
          <WebView
            source={{ html: decodedHtml }}
            style={styles.webview}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>No se pudo cargar la historia clínica</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Card style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>📋 Opciones</Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handlePrint}>
              <Printer size={24} color="#3B82F6" />
              <Text style={styles.actionButtonText}>Imprimir/PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Share2 size={24} color="#10B981" />
              <Text style={styles.actionButtonText}>Compartir</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleGenerateQR}>
              <FileText size={24} color="#F59E0B" />
              <Text style={styles.actionButtonText}>QR Veterinario</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    textAlign: 'center',
  },
  actions: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
  },
  actionsCard: {
    padding: 16,
  },
  actionsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    minWidth: 80,
  },
  actionButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
});