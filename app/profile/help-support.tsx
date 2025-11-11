import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Mail, MessageCircle, Phone, CircleHelp as HelpCircle, FileText, Bug, Star, BookOpen, Users } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';

export default function HelpSupport() {
  const { currentUser } = useAuth();
  const [appVersion, setAppVersion] = useState('15.0.0');
  const [isPartner, setIsPartner] = useState(false);

  useEffect(() => {
    const version = Constants.expoConfig?.version || '15.0.0';
    setAppVersion(version);

    if (currentUser?.role === 'partner' || currentUser?.role === 'admin') {
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
          'Contacto por Email',
          'admin@dogcatify.com\n\nPuedes copiar este email y contactarnos desde tu aplicación de correo.',
          [
            {
              text: 'Copiar Email',
              onPress: () => {
                // En React Native no hay clipboard API nativo, pero podemos mostrar el email
                Alert.alert('Email de Soporte', 'admin@dogcatify.com');
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
        'No se pudo abrir WhatsApp. Verifica que esté instalado en tu dispositivo.',
        [
          { text: 'OK' }
        ]
      );
    }
  };

  const handleReportBug = () => {
    Alert.alert(
      'Reportar Error',
      'Para reportar un error, por favor contacta con nosotros por email o WhatsApp e incluye:\n\n• Descripción del problema\n• Pasos para reproducirlo\n• Modelo de dispositivo\n• Capturas de pantalla si es posible',
      [
        { text: 'Contactar por Email', onPress: handleEmailSupport },
        { text: 'Contactar por WhatsApp', onPress: handleWhatsAppSupport },
        { text: 'Cerrar', style: 'cancel' }
      ]
    );
  };

  const handleRateApp = () => {
    Alert.alert(
      'Calificar App',
      '¡Nos encantaría conocer tu opinión! Tu feedback nos ayuda a mejorar DogCatiFy.',
      [
        { text: 'Más tarde' },
        { text: 'Calificar', onPress: () => {
          // En una app real, esto abriría la tienda de apps
          Alert.alert('¡Gracias!', 'Pronto podrás calificar DogCatiFy en las tiendas de aplicaciones.');
        }}
      ]
    );
  };

  const handleUserManual = () => {
    Alert.alert(
      '📖 Manual de Usuario',
      'Manual completo de DogCatiFy:\n\n' +
      '🐾 GESTIÓN DE MASCOTAS\n' +
      '• Agregar y editar mascotas\n' +
      '• Historial médico completo\n' +
      '• Álbumes de fotos y videos\n' +
      '• Compartir mascotas\n\n' +
      '🏥 SERVICIOS\n' +
      '• Buscar veterinarios\n' +
      '• Reservar consultas\n' +
      '• Servicios de pensión\n' +
      '• Seguimiento de citas\n\n' +
      '🛒 TIENDA\n' +
      '• Explorar productos\n' +
      '• Carrito de compras\n' +
      '• Historial de pedidos\n' +
      '• Seguimiento de envíos\n\n' +
      '📍 LUGARES\n' +
      '• Guardar lugares favoritos\n' +
      '• Ubicar servicios cercanos\n\n' +
      '💳 PAGOS\n' +
      '• Mercado Pago integrado\n' +
      '• Pago seguro y fácil\n\n' +
      'Para ayuda adicional, contacta con soporte.',
      [
        { text: 'Contactar Soporte', onPress: handleEmailSupport },
        { text: 'Cerrar' }
      ]
    );
  };

  const handlePartnerManual = () => {
    Alert.alert(
      '📚 Manual para Aliados',
      'Guía completa para aliados comerciales:\n\n' +
      '🏢 GESTIÓN DE NEGOCIO\n' +
      '• Configurar perfil de negocio\n' +
      '• Horarios y disponibilidad\n' +
      '• Información de contacto\n\n' +
      '💼 SERVICIOS\n' +
      '• Crear y editar servicios\n' +
      '• Gestionar precios\n' +
      '• Configurar pensión\n' +
      '• Aceptar reservas\n\n' +
      '📦 PRODUCTOS\n' +
      '• Agregar productos a la tienda\n' +
      '• Gestionar inventario\n' +
      '• Control de stock\n' +
      '• Actualizar precios\n\n' +
      '📅 RESERVAS\n' +
      '• Ver reservas pendientes\n' +
      '• Confirmar citas\n' +
      '• Gestionar agenda\n\n' +
      '💰 PAGOS\n' +
      '• Configurar Mercado Pago\n' +
      '• Recibir pagos\n' +
      '• Ver transacciones\n\n' +
      '📊 ANÁLISIS\n' +
      '• Panel de ventas\n' +
      '• Estadísticas de negocio\n' +
      '• Historial de pedidos\n\n' +
      'Para soporte técnico, contacta con nuestro equipo.',
      [
        { text: 'Contactar Soporte', onPress: handleEmailSupport },
        { text: 'Cerrar' }
      ]
    );
  };

  const handleFAQ = () => {
    Alert.alert(
      'Preguntas Frecuentes',
      '❓ PREGUNTAS COMUNES\n\n' +
      '¿Cómo agregar una mascota?\n' +
      'Ve a la pestaña Mascotas y toca el botón +\n\n' +
      '¿Cómo reservar servicios?\n' +
      'Busca el servicio en la pestaña Servicios y selecciona fecha/hora\n\n' +
      '¿Cómo funciona la tienda?\n' +
      'Navega productos, agrégalos al carrito y paga con Mercado Pago\n\n' +
      '¿Cómo ser aliado comercial?\n' +
      'Regístrate como partner desde el menú perfil\n\n' +
      '¿Es seguro el pago?\n' +
      'Sí, usamos Mercado Pago para transacciones seguras\n\n' +
      'Para más información, contacta con soporte.',
      [
        { text: 'Contactar Soporte', onPress: handleEmailSupport },
        { text: 'Cerrar' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Ayuda y Soporte</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Info */}
        <Card style={styles.headerCard}>
          <View style={styles.headerInfo}>
            <HelpCircle size={48} color="#2D6A6F" />
            <Text style={styles.headerTitle}>¿Necesitas ayuda?</Text>
            <Text style={styles.headerSubtitle}>
              Estamos aquí para ayudarte. Elige la opción que prefieras para contactarnos.
            </Text>
          </View>
        </Card>

        {/* Contact Options */}
        <Card style={styles.contactCard}>
          <Text style={styles.sectionTitle}>📞 Opciones de Contacto</Text>
          
          <TouchableOpacity style={styles.contactOption} onPress={handleWhatsAppSupport}>
            <View style={styles.contactOptionLeft}>
              <View style={[styles.contactIcon, styles.whatsappIcon]}>
                <MessageCircle size={24} color="#FFFFFF" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>WhatsApp</Text>
                <Text style={styles.contactSubtitle}>Respuesta rápida • +598 92 519 111</Text>
                <Text style={styles.contactDescription}>Ideal para consultas urgentes</Text>
              </View>
            </View>
            <Text style={styles.contactArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactOption} onPress={handleEmailSupport}>
            <View style={styles.contactOptionLeft}>
              <View style={[styles.contactIcon, styles.emailIcon]}>
                <Mail size={24} color="#FFFFFF" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>Email</Text>
                <Text style={styles.contactSubtitle}>admin@dogcatify.com</Text>
                <Text style={styles.contactDescription}>Para consultas detalladas</Text>
              </View>
            </View>
            <Text style={styles.contactArrow}>→</Text>
          </TouchableOpacity>
        </Card>

        {/* Help Topics */}
        <Card style={styles.helpCard}>
          <Text style={styles.sectionTitle}>❓ Temas de Ayuda</Text>
          
          <TouchableOpacity style={styles.helpOption} onPress={handleUserManual}>
            <View style={styles.helpOptionLeft}>
              <BookOpen size={20} color="#3B82F6" />
              <Text style={styles.helpOptionText}>Manual de Usuario</Text>
            </View>
            <Text style={styles.helpArrow}>→</Text>
          </TouchableOpacity>

          {isPartner && (
            <TouchableOpacity style={styles.helpOption} onPress={handlePartnerManual}>
              <View style={styles.helpOptionLeft}>
                <Users size={20} color="#10B981" />
                <Text style={styles.helpOptionText}>Manual para Aliados</Text>
              </View>
              <Text style={styles.helpArrow}>→</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.helpOption} onPress={handleFAQ}>
            <View style={styles.helpOptionLeft}>
              <FileText size={20} color="#6B7280" />
              <Text style={styles.helpOptionText}>Preguntas Frecuentes</Text>
            </View>
            <Text style={styles.helpArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.helpOption} onPress={handleReportBug}>
            <View style={styles.helpOptionLeft}>
              <Bug size={20} color="#6B7280" />
              <Text style={styles.helpOptionText}>Reportar un Error</Text>
            </View>
            <Text style={styles.helpArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.helpOption} onPress={handleRateApp}>
            <View style={styles.helpOptionLeft}>
              <Star size={20} color="#6B7280" />
              <Text style={styles.helpOptionText}>Calificar la App</Text>
            </View>
            <Text style={styles.helpArrow}>→</Text>
          </TouchableOpacity>
        </Card>

        {/* App Info */}
        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>ℹ️ Información de la App</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Versión:</Text>
            <Text style={styles.infoValue}>{appVersion}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Desarrollado por:</Text>
            <Text style={styles.infoValue}>Equipo DogCatiFy</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Horario de soporte:</Text>
            <Text style={styles.infoValue}>Lun-Vie 9:00-18:00</Text>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            title="📧 Enviar Email"
            onPress={handleEmailSupport}
            variant="outline"
            size="large"
          />
          <Button
            title="💬 Abrir WhatsApp"
            onPress={handleWhatsAppSupport}
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
  headerCard: {
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 24,
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  contactCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  whatsappIcon: {
    backgroundColor: '#25D366',
  },
  emailIcon: {
    backgroundColor: '#3B82F6',
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
    marginBottom: 2,
  },
  contactDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  contactArrow: {
    fontSize: 18,
    color: '#6B7280',
  },
  helpCard: {
    marginBottom: 16,
  },
  helpOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  helpOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  helpOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    marginLeft: 12,
  },
  helpArrow: {
    fontSize: 16,
    color: '#6B7280',
  },
  infoCard: {
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  quickActions: {
    gap: 12,
    marginBottom: 32,
  },
});