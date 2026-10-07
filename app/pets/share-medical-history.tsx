import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Share, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Clock, QrCode, Share2, Copy, Mail, MessageCircle } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors, spacing, radius, fontSize } from '../../constants/theme';
import { HealthHeader } from '../../components/health';
import { Badge } from '../../components/ui/Badge';

export default function ShareMedicalHistory() {
  const { petId, petName, qrCodeUrl, shareUrl, shortUrl, expiresAt } = useLocalSearchParams<{
    petId: string;
    petName: string;
    qrCodeUrl: string;
    shareUrl: string;
    shortUrl: string;
    expiresAt?: string;
  }>();

  const [copying, setCopying] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (expiresAt) {
      const updateTimeRemaining = () => {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry.getTime() - now.getTime();
        
        if (diff <= 0) {
          setTimeRemaining('Expirado');
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeRemaining(`${hours}h ${minutes}m restantes`);
        }
      };
      
      updateTimeRemaining();
      const interval = setInterval(updateTimeRemaining, 60000); // Update every minute
      
      return () => clearInterval(interval);
    }
  }, [expiresAt]);

  const handleCopyUrl = async () => {
    setCopying(true);
    try {
      // For mobile, show the URL to copy manually
      Alert.alert(
        'Enlace para el veterinario',
        shareUrl,
        [
          { text: 'Cerrar' },
          { text: 'Compartir', onPress: () => handleShare() }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo copiar el enlace');
    } finally {
      setCopying(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareContent = {
        title: `Historia clínica de ${petName}`,
        message: `Historia clínica veterinaria de ${petName}\n\nAccede aquí: ${shareUrl}`,
        url: shareUrl
      };

      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('cancelled')) {
        Alert.alert('Error', 'No se pudo compartir el enlace');
      }
    }
  };

  const handleEmailVet = () => {
    const subject = `Historia clínica de ${petName}`;
    const body = `Estimado/a Doctor/a,

Adjunto la historia clínica completa de mi mascota ${petName}.

Podés acceder a la información médica completa en este enlace:
${shareUrl}

También puede escanear el código QR adjunto para acceso rápido.

Saludos cordiales.`;

    const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    try {
      const { Linking } = require('react-native');
      Linking.openURL(emailUrl);
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la aplicación de correo');
    }
  };

  const handleWhatsAppShare = () => {
    const message = `Historia clínica de ${petName}\n\nPodés acceder a la información médica completa acá: ${shareUrl}`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    
    try {
      const { Linking } = require('react-native');
      Linking.openURL(whatsappUrl);
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir WhatsApp');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <HealthHeader title="Compartir historia clínica" subtitle={petName} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pet Info */}
        <Card style={styles.petCard}>
          <Text style={styles.petName}>🐾 {petName}</Text>
          <Text style={styles.petDescription}>
            Historia clínica completa lista para compartir con veterinarios
          </Text>
        </Card>

        {/* QR Code */}
        <Card style={styles.qrCard}>
          <Text style={styles.qrTitle}>Código QR para el veterinario</Text>
          {timeRemaining && (
            <View style={styles.expirationContainer}>
              <Badge
                label={timeRemaining}
                tone={timeRemaining === 'Expirado' ? 'danger' : 'warning'}
                icon={<Clock size={12} color={timeRemaining === 'Expirado' ? colors.danger : colors.warning} />}
              />
            </View>
          )}
          <Text style={styles.qrDescription}>
            El veterinario puede escanear este código para acceder a la historia clínica. El enlace expira en 2 horas por seguridad.
          </Text>
          
          <View style={styles.qrContainer}>
            <Image 
              source={{ uri: qrCodeUrl }} 
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>
          
          <View style={styles.urlContainer}>
            <Text style={styles.urlLabel}>Enlace directo:</Text>
            <Text style={styles.shortUrl}>{shortUrl}</Text>
          </View>
        </Card>

        {/* Sharing Options */}
        <Card style={styles.sharingCard}>
          <Text style={styles.sharingTitle}>Compartir</Text>
          
          <View style={styles.sharingButtons}>
            <TouchableOpacity style={styles.sharingButton} onPress={handleCopyUrl} accessibilityRole="button">
              <Copy size={24} color={colors.primary} />
              <Text style={styles.sharingButtonText}>Copiar enlace</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sharingButton} onPress={handleEmailVet} accessibilityRole="button">
              <Mail size={24} color={colors.primary} />
              <Text style={styles.sharingButtonText}>Enviar por correo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sharingButton} onPress={handleWhatsAppShare} accessibilityRole="button">
              <MessageCircle size={24} color="#25D366" />
              <Text style={styles.sharingButtonText}>WhatsApp</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sharingButton} onPress={handleShare} accessibilityRole="button">
              <Share2 size={24} color={colors.primary} />
              <Text style={styles.sharingButtonText}>Más opciones</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Instructions */}
        <Card style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Instrucciones para el veterinario</Text>
          <View style={styles.instructionsList}>
            <Text style={styles.instructionItem}>
              1. Escaneá el código QR con la cámara del teléfono
            </Text>
            <Text style={styles.instructionItem}>
              2. O entrá directamente al enlace: {shortUrl}
            </Text>
            <Text style={styles.instructionItem}>
              3. Podrá ver toda la información médica actualizada
            </Text>
            <Text style={styles.instructionItem}>
              4. Incluye vacunas, enfermedades, alergias y peso
            </Text>
          </View>
        </Card>

        {/* Preview Button */}
        <View style={styles.previewContainer}>
          <Button
            title="Vista previa de la historia"
            onPress={() => router.push(`/medical-history/${petId}`)}
            variant="outline"
            size="large"
          />
        </View>
      </ScrollView>
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
    padding: spacing.lg,
  },
  petCard: {
    marginBottom: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  petName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  petDescription: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  qrCard: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  qrDescription: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  qrContainer: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  urlContainer: {
    alignItems: 'center',
  },
  urlLabel: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  shortUrl: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary,
  },
  tokenContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tokenLabel: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  tokenValue: {
    fontSize: fontSize.xs,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  expirationContainer: {

    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  expirationText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-SemiBold',
    color: colors.warning,
    textAlign: 'center',
  },
  expiredText: {
    color: colors.danger,
  },
  sharingCard: {
    marginBottom: spacing.lg,
  },
  sharingTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  sharingButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  sharingButton: {
    width: '48%',
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primarySoft,
    minHeight: 88,
    justifyContent: 'center',
  },
  sharingButtonText: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  instructionsCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successSoft,
  },
  instructionsTitle: {
    fontSize: fontSize.md,
    fontFamily: 'Inter-SemiBold',
    color: colors.success,
    marginBottom: spacing.md,
  },
  instructionsList: {
    gap: spacing.sm,
  },
  instructionItem: {
    fontSize: fontSize.sm,
    fontFamily: 'Inter-Regular',
    color: colors.success,
    lineHeight: 20,
  },
  previewContainer: {
    marginBottom: spacing.xxl,
  },
});
