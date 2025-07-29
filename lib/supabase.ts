import { Platform } from 'react-native';
import { EmailTemplates } from './emailTemplates';

/**
 * Utility functions for sending notifications via email
 */
export const NotificationService = {
  /**
   * Send an email notification
   * @param to Recipient email address
   * @param subject Email subject
   * @param text Plain text content (optional if html is provided)
   * @param html HTML content (optional if text is provided)
   * @param attachment Optional attachment
   * @returns Promise with the result of the email sending operation
   */
  sendEmail: async (
    to: string,
    subject: string,
    text?: string,
    html?: string,
    attachment?: any
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      // Get the Supabase URL from environment variables
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
      
      // Construct the Edge Function URL
      const apiUrl = `${supabaseUrl}/functions/v1/send-email`;
      
      console.log('Sending email to:', to);
      console.log('Subject:', subject);
      
      // Make the request to the Edge Function
      console.log('Enviando solicitud a:', apiUrl);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          to,
          subject,
          text,
          html,
          attachment,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from email API:', errorText);
        return { 
          success: false, 
          error: `API responded with status ${response.status}: ${errorText}` 
        };
      }
      
      // Parse the response
      const result = await response.json();
      
      if (!response.ok) {
        console.error('Error sending email:', result);
        return { 
          success: false, 
          error: result.error || 'Failed to send email' 
        };
      }
      
      console.log('Email sent successfully:', result);
      return { 
        success: true, 
        messageId: result.messageId 
      };
    } catch (error) {
      console.error('Error in sendEmail:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred' 
      };
    }
  },
  
  /**
   * Send a welcome email to a new user
   * @param email User's email address
   * @param name User's display name
   * @param activationLink Optional activation link
   */
  sendWelcomeEmail: async (email: string, name: string, activationLink?: string): Promise<void> => {
    const subject = '¡Bienvenido a DogCatiFy!';
    const text = `Hola ${name},\n\nBienvenido a DogCatiFy, la plataforma para amantes de mascotas.\n\nGracias por unirte a nuestra comunidad.\n\nEl equipo de DogCatiFy`;
    const html = EmailTemplates.welcome(name, activationLink);
    
    await NotificationService.sendEmail(email, subject, text, html);
  },
  
  /**
   * Send a booking confirmation email
   * @param email User's email address
   * @param name User's display name
   * @param serviceName Name of the booked service
   * @param partnerName Name of the service provider
   * @param date Date of the appointment
   * @param time Time of the appointment
   */
  sendBookingConfirmationEmail: async (
    email: string, 
    name: string,
    serviceName: string,
    partnerName: string,
    date: string,
    time: string,
    petName: string
  ): Promise<void> => {
    const subject = 'Confirmación de Reserva - DogCatiFy';
    const text = `Hola ${name},\n\nTu reserva ha sido confirmada:\n\nServicio: ${serviceName}\nProveedor: ${partnerName}\nFecha: ${date}\nHora: ${time}\nMascota: ${petName}\n\nGracias por usar DogCatiFy.`;
    const html = EmailTemplates.bookingConfirmation(name, serviceName, partnerName, date, time, petName);
    
    await NotificationService.sendEmail(email, subject, text, html);
  },
  
  /**
   * Send a booking cancellation email
   * @param email User's email address
   * @param name User's display name
   * @param serviceName Name of the cancelled service
   * @param partnerName Name of the service provider
   * @param date Date of the appointment
   * @param time Time of the appointment
   */
  sendBookingCancellationEmail: async (
    email: string, 
    name: string,
    serviceName: string,
    partnerName: string,
    date: string,
    time: string
  ): Promise<void> => {
    const subject = 'Reserva Cancelada - DogCatiFy';
    const text = `Hola ${name},\n\nTu reserva ha sido cancelada:\n\nServicio: ${serviceName}\nProveedor: ${partnerName}\nFecha: ${date}\nHora: ${time}\n\nGracias por usar DogCatiFy.`;
    const html = EmailTemplates.bookingCancellation(name, serviceName, partnerName, date, time);
    
    await NotificationService.sendEmail(email, subject, text, html);
  },
  
  /**
   * Send a booking reminder email
   * @param email User's email address
   * @param name User's display name
   * @param serviceName Name of the booked service
   * @param partnerName Name of the service provider
   * @param date Date of the appointment
   * @param time Time of the appointment
   * @param petName Name of the pet
   */
  sendBookingReminderEmail: async (
    email: string, 
    name: string,
    serviceName: string,
    partnerName: string,
    date: string,
    time: string,
    petName: string
  ): Promise<void> => {
    const subject = 'Recordatorio de Cita - DogCatiFy';
    const text = `Hola ${name},\n\nTe recordamos que tienes una cita programada para mañana:\n\nServicio: ${serviceName}\nProveedor: ${partnerName}\nFecha: ${date}\nHora: ${time}\nMascota: ${petName}\n\nGracias por usar DogCatiFy.`;
    const html = EmailTemplates.bookingReminder(name, serviceName, partnerName, date, time, petName);
    
    await NotificationService.sendEmail(email, subject, text, html);
  },
  
  /**
   * Send a partner verification email
   * @param email Partner's email address
   * @param businessName Business name
   */
  sendPartnerVerificationEmail: async (
    email: string,
    businessName: string
  ): Promise<void> => {
    const subject = 'Tu negocio ha sido verificado - DogCatiFy';
    const text = `Felicidades,\n\nTu negocio "${businessName}" ha sido verificado en DogCatiFy. Ahora puedes comenzar a ofrecer tus servicios a nuestra comunidad de amantes de mascotas.\n\nGracias por unirte a DogCatiFy.`;
    const html = EmailTemplates.partnerApproved(businessName, '');
    
    await NotificationService.sendEmail(email, subject, text, html);
  },
  
  /**
   * Send a partner registration confirmation email
   * @param email Partner's email address
   * @param businessName Business name
   * @param businessType Business type
   */
  sendPartnerRegistrationEmail: async (
    email: string,
    businessName: string,
    businessType: string
  ): Promise<void> => {
    const subject = 'Solicitud de Registro Recibida - DogCatiFy';
    const text = `Hola,\n\nHemos recibido tu solicitud para registrar "${businessName}" como ${businessType} en DogCatiFy. Nuestro equipo revisará tu solicitud y te notificaremos cuando sea aprobada.\n\nGracias por elegir DogCatiFy para hacer crecer tu negocio.`;
    const html = EmailTemplates.partnerRegistration(businessName, businessType);
    
    await NotificationService.sendEmail(email, subject, text, html);
  },
  
  /**
   * Send a partner rejection email
   * @param email Partner's email address
   * @param businessName Business name
   * @param reason Reason for rejection
   */
  sendPartnerRejectionEmail: async (
    email: string,
    businessName: string,
    reason: string
  ): Promise<void> => {
    const subject = 'Solicitud No Aprobada - DogCatiFy';
    const text = `Hola,\n\nLamentamos informarte que tu solicitud para registrar "${businessName}" en DogCatiFy no ha sido aprobada en esta ocasión.\n\nMotivo: ${reason || 'No cumple con los requisitos necesarios para ser parte de nuestra plataforma en este momento.'}\n\nSi deseas obtener más información o volver a intentarlo con los ajustes necesarios, por favor contacta con nuestro equipo de soporte.\n\nAgradecemos tu interés en DogCatiFy.`;
    const html = EmailTemplates.partnerRejected(businessName, reason);
    
    await NotificationService.sendEmail(email, subject, text, html);
  },
  
  /**
   * Send a chat message notification
   * @param recipientEmail Recipient's email address
   * @param senderName Name of the message sender
   * @param petName Name of the pet being discussed
   * @param messagePreview Preview of the message content
   * @param conversationId ID of the conversation for deep linking
   */
  sendChatMessageNotification: async (
    recipientEmail: string,
    senderName: string,
    petName: string,
    messagePreview: string,
    conversationId: string
  ): Promise<void> => {
    const subject = `Nuevo mensaje sobre adopción de ${petName} - DogCatiFy`;
    const text = `${senderName} te ha enviado un mensaje sobre la adopción de ${petName}:\n\n"${messagePreview}"\n\nResponde desde la app DogCatiFy.`;
    const html = `
  },
  
  /**
   * Send a chat message notification
   * @param recipientEmail Recipient's email address
   * @param senderName Name of the message sender
   * @param petName Name of the pet being discussed
   * @param messagePreview Preview of the message content
   * @param conversationId ID of the conversation for deep linking
   */
  sendChatMessageNotification: async (
    recipientEmail: string,
    senderName: string,
    petName: string,
    messagePreview: string,
    conversationId: string
  ): Promise<void> => {
    const subject = `Nuevo mensaje sobre adopción de ${petName} - DogCatiFy`;
    const messageText = `${senderName} te ha enviado un mensaje sobre la adopción de ${petName}:\n\n"${messagePreview}"\n\nResponde desde la app DogCatiFy.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">