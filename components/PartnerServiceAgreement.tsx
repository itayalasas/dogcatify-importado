import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { FileText, X } from 'lucide-react-native';
import { Button } from './ui/Button';

interface PartnerServiceAgreementProps {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const PartnerServiceAgreement: React.FC<PartnerServiceAgreementProps> = ({
  visible,
  onClose,
  onAccept,
}) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;

    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = () => {
    onAccept();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <FileText size={24} color="#2D6A6F" />
            <Text style={styles.headerTitle}>Contrato de Servicio para Aliados</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. OBJETO DEL CONTRATO</Text>
            <Text style={styles.paragraph}>
              El presente contrato tiene por objeto establecer los términos y condiciones bajo los cuales
              <Text style={styles.bold}> DogCatiFy</Text> (en adelante "LA PLATAFORMA") permite al
              <Text style={styles.bold}> ALIADO</Text> ofrecer sus servicios y/o productos relacionados con
              mascotas a través de la aplicación móvil y plataforma web.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. DEFINICIONES</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>2.1 ALIADO:</Text> Persona física o jurídica que ofrece servicios
              y/o productos para mascotas a través de LA PLATAFORMA.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>2.2 USUARIO:</Text> Persona que utiliza LA PLATAFORMA para contratar
              servicios o adquirir productos del ALIADO.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>2.3 COMISIÓN:</Text> Porcentaje que LA PLATAFORMA retiene de cada
              transacción realizada a través de la aplicación.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. OBLIGACIONES DEL ALIADO</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>3.1 Información Veraz:</Text> El ALIADO se compromete a proporcionar
              información veraz, completa y actualizada sobre sus servicios, productos, precios y disponibilidad.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>3.2 Calidad del Servicio:</Text> El ALIADO se compromete a prestar
              sus servicios con la máxima calidad profesional y respetando los estándares de bienestar animal.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>3.3 Documentación:</Text> El ALIADO deberá contar con todas las
              licencias, permisos y habilitaciones necesarias para operar legalmente su negocio.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>3.4 Atención al Cliente:</Text> El ALIADO se compromete a responder
              consultas y brindar atención a los USUARIOS de manera oportuna y profesional.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>3.5 Facturación:</Text> El ALIADO se compromete a generar la factura
              correspondiente a nombre de DogCatiFy por los servicios prestados, según las normativas fiscales
              vigentes.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. OBLIGACIONES DE LA PLATAFORMA</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>4.1 Visibilidad:</Text> LA PLATAFORMA se compromete a dar visibilidad
              al ALIADO dentro de la aplicación, permitiendo que los USUARIOS accedan a sus servicios y productos.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>4.2 Soporte Técnico:</Text> LA PLATAFORMA proporcionará soporte técnico
              para el uso de la aplicación y resolución de problemas técnicos.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>4.3 Procesamiento de Pagos:</Text> LA PLATAFORMA facilitará el
              procesamiento de pagos entre USUARIOS y ALIADOS a través de sistemas seguros.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. SISTEMA DE COMISIONES Y PAGOS</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>5.1 Comisión:</Text> LA PLATAFORMA aplicará una comisión sobre cada
              transacción realizada. El porcentaje de comisión será informado al ALIADO antes de confirmar
              su registro.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>5.2 Periodicidad de Pago:</Text> Los pagos al ALIADO se realizarán cada
              <Text style={styles.bold}> 15 días hábiles</Text>, descontando la comisión correspondiente y
              cualquier cargo aplicable.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>5.3 Requisito de Facturación:</Text> Para recibir cada pago, el ALIADO
              deberá presentar la factura correspondiente a nombre de DogCatiFy SRL (o razón social vigente)
              por los servicios prestados durante el período correspondiente.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>5.4 Método de Pago:</Text> Los pagos se realizarán mediante transferencia
              bancaria a la cuenta designada por el ALIADO.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>5.5 Retención de Fondos:</Text> LA PLATAFORMA podrá retener fondos en
              caso de disputas, reclamos o investigaciones relacionadas con la calidad del servicio prestado.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. POLÍTICA DE CANCELACIÓN Y REEMBOLSOS</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>6.1 Cancelación por el USUARIO:</Text> En caso de cancelación por parte
              del USUARIO, se aplicarán las políticas de cancelación establecidas por el ALIADO y aceptadas al
              momento de la reserva.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>6.2 Cancelación por el ALIADO:</Text> El ALIADO podrá cancelar una reserva
              con causa justificada, debiendo notificar inmediatamente al USUARIO y a LA PLATAFORMA.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>6.3 Reembolsos:</Text> Los reembolsos serán procesados según la política
              de cancelación aplicable, siendo LA PLATAFORMA responsable de gestionar el proceso.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. RESPONSABILIDAD Y GARANTÍAS</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>7.1 Responsabilidad del Servicio:</Text> El ALIADO es el único responsable
              de los servicios prestados y productos vendidos a través de LA PLATAFORMA.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>7.2 Seguros:</Text> El ALIADO deberá contar con los seguros necesarios
              para cubrir responsabilidad civil y cualquier daño que pueda ocasionarse durante la prestación del servicio.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>7.3 Exoneración de LA PLATAFORMA:</Text> LA PLATAFORMA actúa únicamente
              como intermediaria y no se responsabiliza por la calidad, seguridad o legalidad de los servicios
              prestados por el ALIADO.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. PROPIEDAD INTELECTUAL</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>8.1 Licencia de Uso:</Text> El ALIADO otorga a LA PLATAFORMA una licencia
              no exclusiva para usar su logo, imágenes y contenido con fines de promoción dentro de la aplicación.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>8.2 Derechos de LA PLATAFORMA:</Text> El ALIADO reconoce que todos los
              derechos sobre la aplicación, marca y sistema pertenecen a DogCatiFy.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. PROTECCIÓN DE DATOS</Text>
            <Text style={styles.paragraph}>
              Ambas partes se comprometen a cumplir con la normativa vigente en materia de protección de datos
              personales, garantizando la confidencialidad de la información de los USUARIOS.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. CAUSALES DE SUSPENSIÓN O TERMINACIÓN</Text>
            <Text style={styles.paragraph}>
              LA PLATAFORMA podrá suspender o dar de baja al ALIADO en los siguientes casos:
            </Text>
            <Text style={styles.listItem}>• Incumplimiento de los términos de este contrato</Text>
            <Text style={styles.listItem}>• Quejas reiteradas de USUARIOS</Text>
            <Text style={styles.listItem}>• Actividades fraudulentas o ilegales</Text>
            <Text style={styles.listItem}>• Información falsa o engañosa</Text>
            <Text style={styles.listItem}>• Falta de presentación de facturas requeridas</Text>
            <Text style={styles.listItem}>• Violación de normativas de bienestar animal</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. DURACIÓN Y TERMINACIÓN</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>11.1 Vigencia:</Text> Este contrato tiene vigencia indefinida desde
              la fecha de aceptación.
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>11.2 Terminación:</Text> Cualquiera de las partes podrá dar por
              terminado este contrato con un preaviso de 15 días hábiles.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>12. MODIFICACIONES</Text>
            <Text style={styles.paragraph}>
              LA PLATAFORMA se reserva el derecho de modificar estos términos y condiciones, notificando
              al ALIADO con 15 días de anticipación. La continuidad en el uso de LA PLATAFORMA implica
              la aceptación de las modificaciones.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>13. LEY APLICABLE Y JURISDICCIÓN</Text>
            <Text style={styles.paragraph}>
              Este contrato se rige por las leyes de la República Oriental del Uruguay. Cualquier controversia
              será sometida a la jurisdicción de los tribunales competentes de Montevideo, Uruguay.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Al aceptar este contrato, el ALIADO declara haber leído, comprendido y aceptado todos los
              términos y condiciones aquí establecidos.
            </Text>
            <Text style={styles.footerDate}>
              Última actualización: Octubre 2025
            </Text>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>

        <View style={styles.buttonContainer}>
          {!hasScrolledToBottom && (
            <Text style={styles.scrollHint}>
              Desplázate hasta el final para aceptar el contrato
            </Text>
          )}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <View style={styles.buttonSpacer} />
            <Button
              title="Aceptar Contrato"
              onPress={handleAccept}
              disabled={!hasScrolledToBottom}
              size="medium"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  listItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 22,
    marginBottom: 8,
    marginLeft: 16,
  },
  footer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#0369A1',
    lineHeight: 20,
    marginBottom: 8,
  },
  footerDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  scrollHint: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#F59E0B',
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  buttonSpacer: {
    width: 12,
  },
});
