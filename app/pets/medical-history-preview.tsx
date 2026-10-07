import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Download, Share2, FileText, Printer } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { envConfig } from '../../utils/envConfig';
import { colors, spacing, radius, fontSize } from '../../constants/theme';
import { HealthHeader } from '../../components/health';
import { EmptyState } from '../../components/ui/EmptyState';

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
        title: `Historia clínica de ${petName}`,
        message: `Historia clínica veterinaria de ${petName}\n\nGenerada por DogCatiFy`,
      };

      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('cancelled')) {
        Alert.alert('Error', 'No se pudo compartir la historia clínica');
      }
    }
  };

  const handlePrint = () => {
    Alert.alert(
      'Imprimir',
      'Para imprimir, compartí la historia clínica y abrila en un navegador.',
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
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${envConfig.getOrDefault('EXPO_PUBLIC_APP_DOMAIN', 'https://app-dogcatify.netlify.app')}/medical-history/${petId}`)}&format=png&margin=20&ecc=M&color=2D6A6F&bgcolor=FFFFFF`,
        shareUrl: `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/medical-history/${petId}`,
        shortUrl: `dogcatify.com/vet/${petId.slice(-8)}`
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader title="Historia clínica" subtitle={petName} />

      <View style={styles.content}>
        {decodedHtml ? (
          <WebView
            source={{ html: decodedHtml }}
            style={styles.webview}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.errorContainer}>
            <EmptyState
              icon={<FileText size={32} color={colors.danger} />}
              title="No se pudo cargar la historia clínica"
              description="Volvé atrás y generala de nuevo."
              actionLabel="Volver"
              onAction={() => router.back()}
            />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Card style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Opciones</Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handlePrint} accessibilityRole="button">
              <Printer size={24} color={colors.primary} />
              <Text style={styles.actionButtonText}>Imprimir/PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleShare} accessibilityRole="button">
              <Share2 size={24} color={colors.primary} />
              <Text style={styles.actionButtonText}>Compartir</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleGenerateQR} accessibilityRole="button">
              <FileText size={24} color={colors.primary} />
              <Text style={styles.actionButtonText}>QR para el veterinario</Text>
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-Regular',
    color: colors.danger,
    textAlign: 'center',
  },
  actions: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
  },
  actionsCard: {
    padding: spacing.lg,
  },
  actionsTitle: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'left',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    minWidth: 80,
    flex: 1,
    minHeight: 72,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
