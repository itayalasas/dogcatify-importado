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
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, FileText, CheckCircle, AlertCircle, DollarSign, Scale, Mail, Phone, MessageSquare } from 'lucide-react-native';

export default function TermsOfService() {
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#2D6A6F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Términos de Servicio</Text>
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
          <FileText size={48} color="#2D6A6F" />
          <Text style={styles.introTitle}>Términos y Condiciones</Text>
          <Text style={styles.introSubtitle}>
            Conoce los términos y condiciones que rigen el uso de DogCatify y nuestros servicios para el cuidado integral de mascotas.
          </Text>
          <Text style={styles.updateDate}>Última actualización: 15/10/2025</Text>
        </View>

        {/* Aceptación */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CheckCircle size={24} color="#2D6A6F" />
            <Text style={styles.sectionTitle}>Aceptación de los Términos</Text>
          </View>
          <Text style={styles.paragraph}>
            Al descargar, instalar o utilizar la aplicación DogCatify, aceptas estar sujeto a estos Términos de Servicio. Si no estás de acuerdo con alguno de estos términos, no debes utilizar nuestra aplicación o servicios.
          </Text>
          <Text style={styles.paragraph}>
            Estos términos constituyen un acuerdo legal vinculante entre tú (el "Usuario") y DogCatify (la "Empresa") con respecto al uso de nuestra plataforma de gestión integral de mascotas.
          </Text>
        </View>

        {/* Descripción de Servicios */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción de los Servicios</Text>

          <Text style={styles.subsectionTitle}>Servicios Principales</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Gestión de perfiles de mascotas</Text>
            <Text style={styles.bulletItem}>• Historial médico y de salud</Text>
            <Text style={styles.bulletItem}>• Agenda de citas veterinarias</Text>
            <Text style={styles.bulletItem}>• Servicios de peluquería y baño</Text>
            <Text style={styles.bulletItem}>• Tienda online especializada</Text>
            <Text style={styles.bulletItem}>• Red de lugares pet-friendly</Text>
          </View>

          <Text style={styles.subsectionTitle}>Servicios Adicionales</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Consultas veterinarias virtuales</Text>
            <Text style={styles.bulletItem}>• Recordatorios de medicamentos</Text>
            <Text style={styles.bulletItem}>• Galería de fotos de mascotas</Text>
            <Text style={styles.bulletItem}>• Red de profesionales aliados</Text>
            <Text style={styles.bulletItem}>• Soporte técnico especializado</Text>
            <Text style={styles.bulletItem}>• Actualizaciones de la aplicación</Text>
          </View>
        </View>

        {/* Responsabilidades del Usuario */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Responsabilidades del Usuario</Text>

          <Text style={styles.subsectionTitle}>Uso Apropiado</Text>
          <Text style={styles.paragraph}>
            Te comprometes a utilizar DogCatify únicamente para fines legítimos relacionados con el cuidado de mascotas. No debes usar la aplicación para actividades ilegales, fraudulentas o que puedan dañar a otros usuarios o mascotas.
          </Text>

          <Text style={styles.subsectionTitle}>Información Veraz</Text>
          <Text style={styles.paragraph}>
            Debes proporcionar información precisa y actualizada sobre ti y tus mascotas. La información médica incorrecta puede afectar la calidad de los servicios veterinarios y el bienestar de tu mascota.
          </Text>

          <Text style={styles.subsectionTitle}>Seguridad de la Cuenta</Text>
          <Text style={styles.paragraph}>
            Eres responsable de mantener la confidencialidad de tu cuenta y contraseña. Debes notificarnos inmediatamente sobre cualquier uso no autorizado de tu cuenta.
          </Text>
        </View>

        {/* Servicios Profesionales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Servicios Profesionales</Text>

          <Text style={styles.subsectionTitle}>Servicios Veterinarios</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Los veterinarios son profesionales independientes</Text>
            <Text style={styles.bulletItem}>• DogCatify facilita la conexión, no presta servicios médicos</Text>
            <Text style={styles.bulletItem}>• Las decisiones médicas son responsabilidad del veterinario</Text>
            <Text style={styles.bulletItem}>• En emergencias, contacta servicios de urgencia locales</Text>
          </View>

          <Text style={styles.subsectionTitle}>Otros Servicios</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Peluquerías y servicios de estética</Text>
            <Text style={styles.bulletItem}>• Servicios de cuidado y paseo</Text>
            <Text style={styles.bulletItem}>• Productos de la tienda online</Text>
            <Text style={styles.bulletItem}>• Lugares y establecimientos pet-friendly</Text>
          </View>
        </View>

        {/* Pagos y Reembolsos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <DollarSign size={24} color="#2D6A6F" />
            <Text style={styles.sectionTitle}>Pagos y Reembolsos</Text>
          </View>

          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Pagos Seguros</Text>
            <Text style={styles.paymentDescription}>
              Procesamos pagos a través de plataformas seguras y certificadas
            </Text>
          </View>

          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Política de Reembolso</Text>
            <Text style={styles.paymentDescription}>
              Reembolsos según políticas específicas de cada servicio
            </Text>
          </View>

          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Disputas</Text>
            <Text style={styles.paymentDescription}>
              Mediamos en disputas entre usuarios y proveedores de servicios
            </Text>
          </View>
        </View>

        {/* Limitaciones */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AlertCircle size={24} color="#DC2626" />
            <Text style={styles.sectionTitle}>Limitaciones de Responsabilidad</Text>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Importante</Text>
            <View style={styles.bulletList}>
              <Text style={styles.warningItem}>• DogCatify no es responsable por servicios prestados por terceros</Text>
              <Text style={styles.warningItem}>• No garantizamos la disponibilidad continua de la aplicación</Text>
              <Text style={styles.warningItem}>• Los usuarios asumen riesgos al utilizar servicios de terceros</Text>
              <Text style={styles.warningItem}>• En caso de emergencias médicas, contacta servicios de urgencia directamente</Text>
              <Text style={styles.warningItem}>• La información en la app no reemplaza el consejo veterinario profesional</Text>
            </View>
          </View>
        </View>

        {/* Modificaciones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Modificaciones de los Términos</Text>
          <Text style={styles.paragraph}>
            Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios significativos serán notificados a través de:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Notificaciones dentro de la aplicación</Text>
            <Text style={styles.bulletItem}>• Correo electrónico a usuarios registrados</Text>
            <Text style={styles.bulletItem}>• Actualización de la fecha en esta página</Text>
          </View>
          <Text style={styles.paragraph}>
            El uso continuado de la aplicación después de las modificaciones constituye la aceptación de los nuevos términos.
          </Text>
        </View>

        {/* Contacto Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contacto Legal</Text>
          <Text style={styles.paragraph}>
            Para consultas legales, disputas o preguntas sobre estos términos de servicio:
          </Text>

          <View style={styles.contactCard}>
            <View style={styles.contactItem}>
              <Mail size={20} color="#2D6A6F" />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email Legal</Text>
                <Text style={styles.contactValue}>legal@dogcatify.com</Text>
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

        {/* Ley Aplicable */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Scale size={24} color="#2D6A6F" />
            <Text style={styles.sectionTitle}>Ley Aplicable</Text>
          </View>
          <Text style={styles.paragraph}>
            Estos términos se rigen por las leyes de Uruguay. Cualquier disputa relacionada con estos términos será resuelta en los tribunales competentes de Uruguay. Si alguna disposición de estos términos es considerada inválida, las disposiciones restantes permanecerán en pleno vigor y efecto.
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
    paddingVertical: 12,
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
  paymentCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  paymentTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  paymentDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666',
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  warningTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#DC2626',
    marginBottom: 12,
  },
  warningItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#991B1B',
    lineHeight: 24,
    paddingLeft: 8,
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
