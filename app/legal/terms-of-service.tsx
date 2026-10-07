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
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { router } from 'expo-router';
import { ArrowLeft, FileText, CheckCircle, AlertCircle, DollarSign, Scale, Mail, Phone, MessageSquare } from 'lucide-react-native';
import { setTermsAccepted } from '../../utils/legalAcceptance';
import { colors, fonts, radius, spacing } from '../../constants/theme';

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
    setTermsAccepted();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      {/* Header */}
      <ScreenHeader title="Términos de servicio" onBack={() => router.back()} />

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
          <FileText size={48} color={colors.primary} />
          <Text style={styles.introTitle}>Términos y Condiciones</Text>
          <Text style={styles.introSubtitle}>
            Conocé los términos y condiciones que rigen el uso de DogCatify y nuestros servicios para el cuidado integral de mascotas.
          </Text>
          <Text style={styles.updateDate}>Última actualización: 15/10/2025</Text>
        </View>

        {/* Aceptación */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CheckCircle size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Aceptación de los términos</Text>
          </View>
          <Text style={styles.paragraph}>
            Al descargar, instalar o utilizar la aplicación DogCatify, aceptas estar sujeto a estos Términos de Servicio. Si no estás de acuerdo con alguno de estos términos, no debes utilizar nuestra aplicación o servicios.
          </Text>
          <Text style={styles.paragraph}>
            Estos términos constituyen un acuerdo legal vinculante entre tú (el &quot;Usuario&quot;) y DogCatify (la &quot;Empresa&quot;) con respecto al uso de nuestra plataforma de gestión integral de mascotas.
          </Text>
        </View>

        {/* Descripción de Servicios */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción de los servicios</Text>

          <Text style={styles.subsectionTitle}>Servicios principales</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Gestión de perfiles de mascotas</Text>
            <Text style={styles.bulletItem}>• Historial médico y de salud</Text>
            <Text style={styles.bulletItem}>• Agenda de citas veterinarias</Text>
            <Text style={styles.bulletItem}>• Servicios de peluquería y baño</Text>
            <Text style={styles.bulletItem}>• Tienda online especializada</Text>
            <Text style={styles.bulletItem}>• Red de lugares pet-friendly</Text>
          </View>

          <Text style={styles.subsectionTitle}>Servicios adicionales</Text>
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
          <Text style={styles.sectionTitle}>Responsabilidades del usuario</Text>

          <Text style={styles.subsectionTitle}>Uso apropiado</Text>
          <Text style={styles.paragraph}>
            Te comprometes a utilizar DogCatify únicamente para fines legítimos relacionados con el cuidado de mascotas. No debes usar la aplicación para actividades ilegales, fraudulentas o que puedan dañar a otros usuarios o mascotas.
          </Text>

          <Text style={styles.subsectionTitle}>Información veraz</Text>
          <Text style={styles.paragraph}>
            Debes proporcionar información precisa y actualizada sobre ti y tus mascotas. La información médica incorrecta puede afectar la calidad de los servicios veterinarios y el bienestar de tu mascota.
          </Text>

          <Text style={styles.subsectionTitle}>Seguridad de la cuenta</Text>
          <Text style={styles.paragraph}>
            Eres responsable de mantener la confidencialidad de tu cuenta y contraseña. Debes notificarnos inmediatamente sobre cualquier uso no autorizado de tu cuenta.
          </Text>
        </View>

        {/* Servicios Profesionales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Servicios profesionales</Text>

          <Text style={styles.subsectionTitle}>Servicios veterinarios</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Los veterinarios son profesionales independientes</Text>
            <Text style={styles.bulletItem}>• DogCatify facilita la conexión, no presta servicios médicos</Text>
            <Text style={styles.bulletItem}>• Las decisiones médicas son responsabilidad del veterinario</Text>
            <Text style={styles.bulletItem}>• En emergencias, contacta servicios de urgencia locales</Text>
          </View>

          <Text style={styles.subsectionTitle}>Otros servicios</Text>
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
            <DollarSign size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Pagos y reembolsos</Text>
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
            <AlertCircle size={24} color={colors.danger} />
            <Text style={styles.sectionTitle}>Limitaciones de responsabilidad</Text>
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
          <Text style={styles.sectionTitle}>Modificaciones de los términos</Text>
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
          <Text style={styles.sectionTitle}>Contacto legal</Text>
          <Text style={styles.paragraph}>
            Para consultas legales, disputas o preguntas sobre estos términos de servicio:
          </Text>

          <View style={styles.contactCard}>
            <View style={styles.contactItem}>
              <Mail size={20} color={colors.primary} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email Legal</Text>
                <Text style={styles.contactValue}>legal@dogcatify.com</Text>
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

        {/* Ley Aplicable */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Scale size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Ley aplicable</Text>
          </View>
          <Text style={styles.paragraph}>
            Estos términos se rigen por las leyes de Uruguay. Cualquier disputa relacionada con estos términos será resuelta en los tribunales competentes de Uruguay. Si alguna disposición de estos términos es considerada inválida, las disposiciones restantes permanecerán en pleno vigor y efecto.
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
  paymentCard: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  paymentTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  paymentDescription: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: colors.dangerSoft,
    padding: spacing.lg,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  warningTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  warningItem: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.danger,
    lineHeight: 24,
    paddingLeft: spacing.sm,
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
