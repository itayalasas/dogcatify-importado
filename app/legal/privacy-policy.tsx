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
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { setPrivacyAccepted } from '../../utils/legalAcceptance';
import { colors, fonts, radius, spacing } from '../../constants/theme';

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
    setPrivacyAccepted();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      {/* Header */}
      <ScreenHeader title="Política de privacidad" onBack={() => router.back()} />

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
          <Shield size={48} color={colors.primary} />
          <Text style={styles.introTitle}>Tu privacidad es nuestra prioridad</Text>
          <Text style={styles.introSubtitle}>
            En DogCatify, tu privacidad y la de tus mascotas es nuestra prioridad. Conocé cómo protegemos y utilizamos tu información.
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
            <Eye size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Información que recopilamos</Text>
          </View>

          <Text style={styles.subsectionTitle}>Información personal</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Nombre y apellidos</Text>
            <Text style={styles.bulletItem}>• Correo electrónico</Text>
            <Text style={styles.bulletItem}>• Número de teléfono personal</Text>
            <Text style={styles.bulletItem}>• Dirección de residencia</Text>
            <Text style={styles.bulletItem}>• Fotografía de perfil</Text>
          </View>

          <Text style={styles.subsectionTitle}>Información de mascotas</Text>
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
            <FileText size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Cómo utilizamos tu información</Text>
          </View>

          <Text style={styles.subsectionTitle}>Gestión de perfil y mascotas</Text>
          <Text style={styles.paragraph}>
            Utilizamos tu información para crear y mantener tu perfil de usuario, gestionar los perfiles de tus mascotas, y permitirte agregar, modificar o eliminar información según sea necesario.
          </Text>

          <Text style={styles.subsectionTitle}>Servicios de salud y citas</Text>
          <Text style={styles.paragraph}>
            Procesamos la información de salud de tus mascotas para ayudarte a gestionar citas veterinarias, servicios de peluquería, baño, y mantener un registro completo del bienestar de tus mascotas.
          </Text>

          <Text style={styles.subsectionTitle}>Tienda online y servicios</Text>
          <Text style={styles.paragraph}>
            Tu información se utiliza para procesar compras en nuestra tienda online, gestionar contratación de servicios, y proporcionar recomendaciones personalizadas de productos.
          </Text>

          <Text style={styles.subsectionTitle}>Red de aliados y lugares pet-friendly</Text>
          <Text style={styles.paragraph}>
            Facilitamos conexiones con negocios aliados y te ayudamos a descubrir lugares pet-friendly basados en tu ubicación y preferencias.
          </Text>
        </View>

        {/* Protección de Datos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Lock size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Protección de datos</Text>
          </View>

          <Text style={styles.subsectionTitle}>Medidas de seguridad</Text>
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
          <Text style={styles.sectionTitle}>Tus derechos</Text>

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
            Si tenés preguntas sobre esta política de privacidad o querés ejercer tus derechos, escribinos:
          </Text>

          <View style={styles.contactCard}>
            <View style={styles.contactItem}>
              <Mail size={20} color={colors.primary} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>info@dogcatify.com</Text>
              </View>
            </View>

            <View style={styles.contactItem}>
              <Phone size={20} color={colors.primary} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Teléfono</Text>
                <Text style={styles.contactValue}>+598 92519111</Text>
              </View>
            </View>

            <View style={styles.contactItem}>
              <MessageSquare size={20} color={colors.primary} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Soporte</Text>
                <Text style={styles.contactValue}>Soporte en la app</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Actualizaciones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actualizaciones de la política</Text>
          <Text style={styles.paragraph}>
            Nos reservamos el derecho de actualizar esta política de privacidad periódicamente. Te notificaremos sobre cambios significativos a través de la aplicación o por correo electrónico. Te recomendamos revisar esta política regularmente para mantenerte informado sobre cómo protegemos tu información.
          </Text>
        </View>

        {/* Scroll indicator */}
        {!hasScrolledToBottom && (
          <View style={styles.scrollIndicator}>
            <Text style={styles.scrollIndicatorText}>
              Deslizá hasta el final para continuar
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Accept Button */}
      <View style={styles.footer}>
        <Button
          title={hasScrolledToBottom ? 'Entendido' : 'Leé hasta el final para continuar'}
          onPress={handleAccept}
          disabled={!hasScrolledToBottom}
          size="large"
        />
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
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing.xxl,
  },
  introBanner: {
    backgroundColor: colors.primarySoft,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  updateDate: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.primary,
    marginTop: spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  bulletList: {
    marginTop: spacing.sm,
  },
  bulletItem: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 24,
    paddingLeft: spacing.sm,
  },
  rightCard: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  rightTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  rightDescription: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  scrollIndicator: {
    backgroundColor: colors.warningSoft,
    padding: spacing.lg,
    margin: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  scrollIndicatorText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.warning,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: colors.border,
  },
  acceptButtonText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  acceptButtonTextDisabled: {
    color: colors.textTertiary,
  },
});
