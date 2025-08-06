import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Share, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, QrCode, Share2, Copy, Mail, MessageCircle } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

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
        'Enlace para Veterinario',
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
        title: `Historia Clínica de ${petName}`,
        message: `Historia clínica veterinaria de ${petName}\n\nAccede aquí: ${shareUrl}`,
        url: shareUrl
      };

      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing:', error);
      if (!error.message?.includes('cancelled')) {
        Alert.alert('Error', 'No se pudo compartir el enlace');
      }
    }
  };

  const handleEmailVet = () => {
    const subject = `Historia Clínica de ${petName}`;
    const body = `Estimado/a Doctor/a,

Adjunto la historia clínica completa de mi mascota ${petName}.

Puede acceder a la información médica completa a través del siguiente enlace:
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
    const message = `Historia clínica de ${petName}\n\nPuede acceder a la información médica completa aquí: ${shareUrl}`;
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Compartir Historia Clínica</Text>
        <View style={styles.placeholder} />
      </View>

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
          <Text style={styles.qrTitle}>📱 Código QR para Veterinario</Text>
          {timeRemaining && (
            <View style={styles.expirationContainer}>
              <Text style={[
                styles.expirationText,
                timeRemaining === 'Expirado' && styles.expiredText
              ]}>
                🕒 {timeRemaining}
              </Text>
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
          <Text style={styles.sharingTitle}>📤 Opciones de Compartir</Text>
          
          <View style={styles.sharingButtons}>
            <TouchableOpacity style={styles.sharingButton} onPress={handleCopyUrl}>
              <Copy size={24} color="#3B82F6" />
              <Text style={styles.sharingButtonText}>Copiar Enlace</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sharingButton} onPress={handleEmailVet}>
              <Mail size={24} color="#10B981" />
              <Text style={styles.sharingButtonText}>Enviar por Email</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sharingButton} onPress={handleWhatsAppShare}>
              <MessageCircle size={24} color="#25D366" />
              <Text style={styles.sharingButtonText}>Compartir WhatsApp</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sharingButton} onPress={handleShare}>
              <Share2 size={24} color="#6B7280" />
              <Text style={styles.sharingButtonText}>Más Opciones</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Instructions */}
        <Card style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>💡 Instrucciones para el Veterinario</Text>
          <View style={styles.instructionsList}>
            <Text style={styles.instructionItem}>
              1. Escanea el código QR con la cámara del teléfono
            </Text>
            <Text style={styles.instructionItem}>
              2. O accede directamente al enlace: {shortUrl}
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
            title="Vista Previa de la Historia"
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
    padding: 16,
  },
  petCard: {
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 20,
  },
  petName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  petDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  qrCard: {
    marginBottom: 16,
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  qrDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  urlContainer: {
    alignItems: 'center',
  },
  urlLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  shortUrl: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
  },
  tokenContainer: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tokenLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  tokenValue: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  expirationContainer: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  expirationText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    textAlign: 'center',
  },
  expiredText: {
    color: '#DC2626',
  },
  sharingCard: {
    marginBottom: 16,
  },
  sharingTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  sharingButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  sharingButton: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sharingButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  instructionsCard: {
    marginBottom: 16,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  instructionsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 12,
  },
  instructionsList: {
    gap: 8,
  },
  instructionItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    lineHeight: 20,
  },
  previewContainer: {
    marginBottom: 24,
  },
});