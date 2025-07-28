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
        // Determine recipient ID
   * @param date Date of the appointment
        const recipientId = conversation.user_id === currentUser!.id 
   * @param serviceName Name of the cancelled service
          ? conversation.partner_id 
   * @param partnerName Name of the service provider
          : conversation.user_id;
   * @param date Date of the appointment
        
   * @param time Time of the appointment
        // Send push notification
   */
        await sendChatNotification(
  sendBookingCancellationEmail: async (
          recipientId,
    email: string, 
          currentUser!.displayName || 'Usuario',
    name: string,
          petName || 'mascota',
    serviceName: string,
          newMessage.trim(),
    partnerName: string,
          conversation.id
    date: string,
        );
    time: string
        console.error('Error sending push notification:', notificationError);
  ): Promise<void> => {
    const text = `Hola ${name},\n\nTu reserva ha sido cancelada:\n\nServicio: ${serviceName}\nProveedor: ${partnerName}\nFecha: ${date}\nHora: ${time}\n\nGracias por usar DogCatiFy.`;
    const html = EmailTemplates.bookingCancellation(name, serviceName, partnerName, date, time);
    
    await NotificationService.sendEmail(email, subject, text, html);
  },
  
  /**
   * Send a booking reminder email
  const { sendChatNotification } = useNotifications();