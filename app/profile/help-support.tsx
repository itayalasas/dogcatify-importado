import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { Mail, MessageCircle, CircleHelp as HelpCircle, FileText, Bug, Star, BookOpen, Users, Clock, Info, Code } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SettingsRow, SettingsGroup } from '../../components/account/SettingsRow';
import { colors, typography, spacing, radius } from '../../constants/theme';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';

export default function HelpSupport() {
  const { currentUser } = useAuth();
  const [appVersion, setAppVersion] = useState('15.0.0');
  const [isPartner, setIsPartner] = useState(false);

  useEffect(() => {
    const version = Constants.expoConfig?.version || '15.0.0';
    setAppVersion(version);

    if (currentUser?.isPartner || currentUser?.isAdmin) {
      setIsPartner(true);
    }
  }, [currentUser]);
  const handleEmailSupport = async () => {
    try {
      const emailUrl = 'mailto:admin@dogcatify.com?subject=Soporte DogCatiFy - Consulta&body=Hola, necesito ayuda con:';
      const canOpen = await Linking.canOpenURL(emailUrl);
      
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        // Fallback: mostrar el email para copiar
        Alert.alert(
          'Contacto por correo',
          'admin@dogcatify.com\n\nPodés copiar esta dirección y escribirnos desde tu aplicación de correo.',
          [
            {
              text: 'Ver correo',
              onPress: () => {
                // En React Native no hay clipboard API nativo, pero podemos mostrar el email
                Alert.alert('Correo de soporte', 'admin@dogcatify.com');
              }
            },
            { text: 'Cerrar' }
          ]
        );
      }
    } catch (error) {
      console.error('Error opening email:', error);
      Alert.alert('Error', 'No se pudo abrir la aplicación de correo');
    }
  };

  const handleWhatsAppSupport = async () => {
    try {
      const phoneNumber = '59892519111';
      const message = 'Hola, necesito ayuda con DogCatiFy';

      const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;

      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        const webUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      Alert.alert(
        'Error',
        'No se pudo abrir WhatsApp. Revisá que esté instalado en tu dispositivo.',
        [
          { text: 'OK' }
        ]
      );
    }
  };

  const handleReportBug = () => {
    Alert.alert(
      'Reportar un error',
      'Para reportar un error, escribinos por correo o WhatsApp e incluí:\n\n• Descripción del problema\n• Pasos para reproducirlo\n• Modelo de dispositivo\n• Capturas de pantalla si es posible',
      [
        { text: 'Escribir por correo', onPress: handleEmailSupport },
        { text: 'Escribir por WhatsApp', onPress: handleWhatsAppSupport },
        { text: 'Cerrar', style: 'cancel' }
      ]
    );
  };

  const handleRateApp = () => {
    Alert.alert(
      'Calificar la app',
      '¡Nos encantaría conocer tu opinión! Tu feedback nos ayuda a mejorar DogCatiFy.',
      [
        { text: 'Más tarde' },
        { text: 'Calificar', onPress: () => {
          // En una app real, esto abriría la tienda de apps
          Alert.alert('¡Gracias!', 'Muy pronto vas a poder calificar DogCatiFy en las tiendas de aplicaciones.');
        }}
      ]
    );
  };

  const handleUserManual = () => {
    Alert.alert(
      '📖 Manual de Usuario',
      'Funciones actuales de DogCatiFy:\n\n' +
      '🏠 INICIO\n' +
      '• Feed con publicaciones y promociones\n' +
      '• Me gusta y comentarios\n\n' +
      '🐾 MASCOTAS\n' +
      '• Alta/edición de mascotas\n' +
      '• Compartir mascota con otros usuarios\n' +
      '• Salud: vacunas, enfermedades, alergias, desparasitaciones y peso\n' +
      '• Álbumes y contenido de cada mascota\n\n' +
      '🛒 TIENDA\n' +
      '• Buscar y filtrar productos por categoría\n' +
      '• Ver detalle de producto\n' +
      '• Agregar al carrito y gestionar cantidades\n' +
      '• Checkout y estados de pedido\n\n' +
      '🏥 SERVICIOS\n' +
      '• Buscar negocios por nombre/zona\n' +
      '• Filtrar por tipo de servicio\n' +
      '• Ver detalle, reseñas y disponibilidad\n' +
      '• Reservar servicio seleccionando mascota\n\n' +
      '📍 LUGARES PET-FRIENDLY\n' +
      '• Explorar lugares y ver detalle\n' +
      '• Registrar nuevos lugares\n\n' +
      '👤 PERFIL Y CUENTA\n' +
      '• Editar perfil\n' +
      '• Ver pedidos y carrito\n' +
      '• Configurar biometría/notificaciones\n' +
      '• Ayuda/soporte y eliminación de cuenta\n\n' +
      '💳 PAGOS\n' +
      '• Integración con Mercado Pago\n\n' +
      'Si necesitás ayuda paso a paso, escribinos por WhatsApp o correo.',
      [
        { text: 'Contactar a soporte', onPress: handleEmailSupport },
        { text: 'Cerrar' }
      ]
    );
  };

  const handlePartnerManual = () => {
    Alert.alert(
      '📚 Manual para Aliados',
      'Funciones actuales para aliados comerciales:\n\n' +
      '🏢 GESTIÓN DE NEGOCIO\n' +
      '• Registro y configuración del negocio\n' +
      '• Actividades, horarios y datos de contacto\n\n' +
      '💼 SERVICIOS\n' +
      '• Crear, editar y publicar servicios\n' +
      '• Configurar precios y capacidades (incluye pensión)\n' +
      '• Gestión de reservas y agenda\n\n' +
      '📦 PRODUCTOS\n' +
      '• Alta/edición de productos\n' +
      '• Control de stock y precios\n' +
      '• Gestión de pedidos\n\n' +
      '📅 RESERVAS\n' +
      '• Ver pendientes y estados\n' +
      '• Confirmar/gestionar citas\n\n' +
      '💰 PAGOS\n' +
      '• Configurar Mercado Pago\n' +
      '• Recibir pagos\n' +
      '• Seguimiento de operaciones\n\n' +
      '📊 ANÁLISIS\n' +
      '• Panel de ventas\n' +
      '• Métricas del negocio\n\n' +
      'Para soporte técnico, contactá a nuestro equipo.',
      [
        { text: 'Contactar a soporte', onPress: handleEmailSupport },
        { text: 'Cerrar' }
      ]
    );
  };

  const handleFAQ = () => {
    Alert.alert(
      'Preguntas frecuentes',
      '❓ PREGUNTAS COMUNES\n\n' +
      '¿Cómo agrego mi mascota?\n' +
      'En Mascotas, tocá el botón + y completá los datos.\n\n' +
      '¿Dónde cargo vacunas o desparasitaciones?\n' +
      'En el detalle de tu mascota, sección Salud.\n\n' +
      '¿Cómo reservo un servicio?\n' +
      'En Servicios, elegí el negocio y el servicio, tocá Reservar y seleccioná tu mascota.\n\n' +
      '¿Cómo compro en la tienda?\n' +
      'Buscá productos, agregalos al carrito y finalizá el pago.\n\n' +
      '¿Dónde veo mis pedidos?\n' +
      'En Perfil > Mis pedidos.\n\n' +
      '¿Cómo contacto al soporte?\n' +
      'Desde esta pantalla, por WhatsApp o correo.\n\n' +
      '¿La app tiene inicio con biometría?\n' +
      'Sí, podés activarlo si tu dispositivo lo permite.\n\n' +
      '¿Cómo me registro como aliado?\n' +
      'Desde Perfil, opción de registro de negocio/aliado.\n\n' +
      '¿Los pagos son seguros?\n' +
      'Sí, la app utiliza integración con Mercado Pago.',
      [
        { text: 'Contactar a soporte', onPress: handleEmailSupport },
        { text: 'Cerrar' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Ayuda y soporte" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Info */}
        <View style={styles.headerInfo}>
          <View style={styles.headerIcon}>
            <HelpCircle size={32} color={colors.primary} />
          </View>
          <Text style={styles.headerTitle} accessibilityRole="header">¿Necesitás ayuda?</Text>
          <Text style={styles.headerSubtitle}>
            Estamos para ayudarte. Elegí cómo preferís contactarnos.
          </Text>
        </View>

        {/* Contact Options */}
        <SettingsGroup title="Contacto">
          <SettingsRow
            icon={<MessageCircle size={20} color={colors.primary} />}
            label="WhatsApp · +598 92 519 111"
            description="Respuesta rápida, ideal para consultas urgentes"
            onPress={handleWhatsAppSupport}
          />
          <SettingsRow
            icon={<Mail size={20} color={colors.primary} />}
            label="Correo · admin@dogcatify.com"
            description="Para consultas detalladas"
            onPress={handleEmailSupport}
            isLast
          />
        </SettingsGroup>

        {/* Help Topics */}
        <SettingsGroup title="Temas de ayuda">
          <SettingsRow
            icon={<BookOpen size={20} color={colors.primary} />}
            label="Manual de usuario"
            onPress={handleUserManual}
          />
          {isPartner && (
            <SettingsRow
              icon={<Users size={20} color={colors.primary} />}
              label="Manual para aliados"
              onPress={handlePartnerManual}
            />
          )}
          <SettingsRow
            icon={<FileText size={20} color={colors.primary} />}
            label="Preguntas frecuentes"
            onPress={handleFAQ}
          />
          <SettingsRow
            icon={<Bug size={20} color={colors.primary} />}
            label="Reportar un error"
            onPress={handleReportBug}
          />
          <SettingsRow
            icon={<Star size={20} color={colors.primary} />}
            label="Calificar la app"
            onPress={handleRateApp}
            isLast
          />
        </SettingsGroup>

        {/* App Info */}
        <SettingsGroup title="Información de la app">
          <SettingsRow icon={<Info size={20} color={colors.primary} />} label="Versión" value={appVersion} />
          <SettingsRow icon={<Code size={20} color={colors.primary} />} label="Desarrollado por" value="Equipo DogCatiFy" />
          <SettingsRow icon={<Clock size={20} color={colors.primary} />} label="Horario de soporte" value="Lun a vie, 9 a 18 h" isLast />
        </SettingsGroup>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            title="Abrir WhatsApp"
            onPress={handleWhatsAppSupport}
            size="large"
            icon={<MessageCircle size={20} color={colors.onPrimary} />}
          />
          <Button
            title="Enviar correo"
            onPress={handleEmailSupport}
            variant="outline"
            size="large"
            icon={<Mail size={20} color={colors.primary} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingTop: 50,
  },
  // El fondo gris va en el contenido; el blanco de arriba acompaña al encabezado.
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentInner: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },
  headerInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  quickActions: {
    gap: spacing.sm,
  },
});
