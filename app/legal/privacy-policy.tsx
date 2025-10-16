import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StatusBar,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Shield, Lock, Eye, FileText, Mail, Phone, MessageSquare } from 'lucide-react-native';

export default function PrivacyPolicy() {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#2D6A6F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Política de Privacidad</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        {/* Intro Banner */}
        <View style={styles.introBanner}>
          <Shield size={48} color="#2D6A6F" />
          <Text style={styles.introTitle}>Tu privacidad es nuestra prioridad</Text>
          <Text style={styles.introSubtitle}>
            En DogCatify, tu privacidad y la de tus mascotas es nuestra prioridad. Conoce cómo protegemos y utilizamos tu información.
          </Text>
          <Text style={styles.updateDate}>Última actualización: 15/10/2025</Text>
        </View>

        {/* Introducción */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Introducción</Text>
          <Text style={styles.paragraph}>
            DogCatify se compromete a proteger la privacidad de nuestros usuarios y sus mascotas. Esta política describe cómo recopilamos, utilizamos, almacenamos y protegemos tu información personal cuando utilizas nuestra aplicación integral de gestión de mascotas.
          </Text>
        </View>

        {/* Información que Recopilamos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Eye size={24} color="#2D6A6F" />
            <Text style={styles.sectionTitle}>Información que Recopilamos</Text>
          </View>

          <Text style={styles.subsectionTitle}>Información Personal</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Nombre y apellidos</Text>
            <Text style={styles.bulletItem}>• Correo electrónico</Text>
            <Text style={styles.bulletItem}>• Número de teléfono personal</Text>
            <Text style={styles.bulletItem}>• Dirección de residencia</Text>
            <Text style={styles.bulletItem}>• Fotografía de perfil</Text>
          </View>

          <Text style={styles.subsectionTitle}>Información de Mascotas</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Datos básicos (nombre, raza, edad)</Text>
            <Text style={styles.bulletItem}>• Fotografías de mascotas</Text>
            <Text style={styles.bulletItem}>• Historial médico y de salud</Text>
            <Text style={styles.bulletItem}>• Registros de comportamiento</Text>
            <Text style={styles.bulletItem}>• Historial de citas y servicios</Text>
          </View>
        </View>

        {/* Cómo Utilizamos tu Información */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText size={24} color="#2D6A6F" />
            <Text style={styles.sectionTitle}>Cómo Utilizamos tu Información</Text>
          </View>

          <Text style={styles.subsectionTitle}>Gestión de Perfil y Mascotas</Text>
          <Text style={styles.paragraph}>
            Utilizamos tu información para crear y mantener tu perfil de usuario, gestionar los perfiles de tus mascotas, y permitirte agregar, modificar o eliminar información según sea necesario.
          </Text>

          <Text style={styles.subsectionTitle}>Servicios de Salud y Citas</Text>
          <Text style={styles.paragraph}>
            Procesamos la información de salud de tus mascotas para ayudarte a gestionar citas veterinarias, servicios de peluquería, baño, y mantener un registro completo del bienestar de tus mascotas.
          </Text>

          <Text style={styles.subsectionTitle}>Tienda Online y Servicios</Text>
          <Text style={styles.paragraph}>
            Tu información se utiliza para procesar compras en nuestra tienda online, gestionar contratación de servicios, y proporcionar recomendaciones personalizadas de productos.
          </Text>

          <Text style={styles.subsectionTitle}>Red de Aliados y Lugares Pet-Friendly</Text>
          <Text style={styles.paragraph}>
            Facilitamos conexiones con negocios aliados y te ayudamos a descubrir lugares pet-friendly basados en tu ubicación y preferencias.
          </Text>
        </View>

        {/* Protección de Datos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Lock size={24} color="#2D6A6F" />
            <Text style={styles.sectionTitle}>Protección de Datos</Text>
          </View>

          <Text style={styles.subsectionTitle}>Medidas de Seguridad</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Encriptación de datos en tránsito y reposo</Text>
            <Text style={styles.bulletItem}>• Autenticación de dos factores</Text>
            <Text style={styles.bulletItem}>• Auditorías de seguridad regulares</Text>
            <Text style={styles.bulletItem}>• Acceso restringido a información sensible</Text>
          </View>

          <Text style={styles.subsectionTitle}>Almacenamiento</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Servidores seguros certificados</Text>
            <Text style={styles.bulletItem}>• Respaldos automáticos encriptados</Text>
            <Text style={styles.bulletItem}>• Retención de datos según normativas</Text>
            <Text style={styles.bulletItem}>• Eliminación segura cuando corresponda</Text>
          </View>
        </View>

        {/* Tus Derechos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tus Derechos</Text>

          <View style={styles.rightCard}>
            <Text style={styles.rightTitle}>Acceso</Text>
            <Text style={styles.rightDescription}>Solicitar una copia de tus datos personales</Text>
          </View>

          <View style={styles.rightCard}>
            <Text style={styles.rightTitle}>Rectificación</Text>
            <Text style={styles.rightDescription}>Corregir información inexacta o incompleta</Text>
          </View>

          <View style={styles.rightCard}>
            <Text style={styles.rightTitle}>Eliminación</Text>
            <Text style={styles.rightDescription}>Solicitar la eliminación de tus datos</Text>
          </View>
        </View>

        {/* Contacto */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contacto</Text>
          <Text style={styles.paragraph}>
            Si tienes preguntas sobre esta política de privacidad o deseas ejercer tus derechos, no dudes en contactarnos:
          </Text>

          <View style={styles.contactCard}>
            <View style={styles.contactItem}>
              <Mail size={20} color="#2D6A6F" />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>info@dogcatify.com</Text>
              </View>
            </View>

            <View style={styles.contactItem}>
              <Phone size={20} color="#2D6A6F" />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Teléfono</Text>
                <Text style={styles.contactValue}>+598 92519111</Text>
              </View>
            </View>

            <View style={styles.contactItem}>
              <MessageSquare size={20} color="#2D6A6F" />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Soporte</Text>
                <Text style={styles.contactValue}>Soporte en la app</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Actualizaciones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actualizaciones de la Política</Text>
          <Text style={styles.paragraph}>
            Nos reservamos el derecho de actualizar esta política de privacidad periódicamente. Te notificaremos sobre cambios significativos a través de la aplicación o por correo electrónico. Te recomendamos revisar esta política regularmente para mantenerte informado sobre cómo protegemos tu información.
          </Text>
        </View>

        {/* Scroll indicator */}
        {!hasScrolledToBottom && (
          <View style={styles.scrollIndicator}>
            <Text style={styles.scrollIndicatorText}>
              Desplázate hasta el final para continuar
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Accept Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.acceptButton, !hasScrolledToBottom && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={!hasScrolledToBottom}
        >
          <Text style={[styles.acceptButtonText, !hasScrolledToBottom && styles.acceptButtonTextDisabled]}>
            {hasScrolledToBottom ? 'Entendido' : 'Lee hasta el final para continuar'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  introBanner: {
    backgroundColor: '#E8F4F5',
    padding: 24,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1A1A1A',
    marginTop: 16,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  updateDate: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
    marginTop: 12,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666',
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletList: {
    marginTop: 8,
  },
  bulletItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666',
    lineHeight: 24,
    paddingLeft: 8,
  },
  rightCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2D6A6F',
  },
  rightTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  rightDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666',
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#999',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1A1A1A',
  },
  scrollIndicator: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  scrollIndicatorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#856404',
    textAlign: 'center',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  acceptButton: {
    backgroundColor: '#2D6A6F',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  acceptButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  acceptButtonTextDisabled: {
    color: '#999',
  },
});
