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
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

      const apiUrl = `${supabaseUrl}/functions/v1/send-email`;

      console.log('Sending email to:', to);
      console.log('Subject:', subject);

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

      const result = await response.json();

      console.log('Email sent successfully:', result);
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error: any) {
      console.error('Error in sendEmail:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  },

  sendWelcomeEmail: async (email: string, name: string, activationLink?: string): Promise<void> => {
    const subject = '¡Confirma tu cuenta en DogCatiFy!';
    const text = `Hola ${name},\n\n¡Bienvenido a DogCatiFy!\n\nPara completar tu registro, por favor confirma tu correo electrónico haciendo clic en el enlace que te enviamos por separado.\n\nSi no ves el correo, revisa tu carpeta de spam.\n\nGracias por unirte a nuestra comunidad.\n\nEl equipo de DogCatiFy`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 10px 0;">¡Bienvenido a DogCatiFy!</h1>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <p>Hola <strong>${name}</strong>,</p>
          <p>¡Gracias por registrarte en DogCatiFy!</p>
          <p>Para completar tu registro y acceder a todas las funciones, necesitas confirmar tu correo electrónico haciendo clic en el enlace que Supabase te enviará automáticamente.</p>
          <p>Una vez confirmado tu email, podrás:</p>
          <ul>
            <li>Crear perfiles para tus mascotas</li>
            <li>Conectar con otros dueños de mascotas</li>
            <li>Encontrar servicios para tus compañeros peludos</li>
            <li>Compartir momentos especiales con la comunidad</li>
          </ul>
          <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
            <p><strong>📧 Importante:</strong></p>
            <p>Recibirás un correo separado de Supabase con el enlace de confirmación. Haz clic en ese enlace para activar tu cuenta.</p>
            <p>Si no ves el correo, revisa tu carpeta de spam.</p>
          </div>
          <p>¡Esperamos verte pronto en DogCatiFy!</p>
          <p>El equipo de DogCatiFy</p>
        </div>
        <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
          <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    await NotificationService.sendEmail(email, subject, text, html);
  },

  /**
   * Send custom email confirmation with our own token
   */
  sendCustomConfirmationEmail: async (
    email: string, 
    name: string, 
    confirmationUrl: string
  ): Promise<void> => {
    const subject = '¡Confirma tu cuenta en DogCatiFy!';
    const text = `Hola ${name},\n\n¡Bienvenido a DogCatiFy!\n\nPara completar tu registro, por favor confirma tu correo electrónico haciendo clic en el siguiente enlace:\n\n${confirmationUrl}\n\nEste enlace expira en 24 horas.\n\nSi no solicitaste esta cuenta, puedes ignorar este correo.\n\nGracias por unirte a nuestra comunidad.\n\nEl equipo de DogCatiFy`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 10px 0;">¡Confirma tu cuenta en DogCatiFy!</h1>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <p>Hola <strong>${name}</strong>,</p>
          <p>¡Gracias por registrarte en DogCatiFy!</p>
          <p>Para completar tu registro y acceder a todas las funciones, necesitas confirmar tu correo electrónico.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmationUrl}" style="background-color: #2D6A6F; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              ✅ Confirmar mi correo electrónico
            </a>
          </div>
          
          <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
            <p><strong>📧 Importante:</strong></p>
            <p>Debes hacer clic en el botón de arriba para activar tu cuenta.</p>
            <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
            <p style="word-break: break-all; font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 4px;">
              ${confirmationUrl}
            </p>
            <p>Si no ves el correo, revisa tu carpeta de spam.</p>
            <p><strong>Este enlace expira en 24 horas.</strong></p>
          </div>
          
          <p>Una vez confirmado tu email, podrás:</p>
          <ul>
            <li>Crear perfiles para tus mascotas</li>
            <li>Conectar con otros dueños de mascotas</li>
            <li>Encontrar servicios para tus compañeros peludos</li>
            <li>Compartir momentos especiales con la comunidad</li>
          </ul>
          
          <p>¡Esperamos verte pronto en DogCatiFy!</p>
          <p>El equipo de DogCatiFy</p>
        </div>
        <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
          <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
          <p>Si no solicitaste esta cuenta, puedes ignorar este correo.</p>
        </div>
      </div>
    `;

    await NotificationService.sendEmail(email, subject, text, html);
  },

  /**
   * Send password reset email with custom token
   */
  sendPasswordResetEmail: async (
    email: string,
    name: string,
    resetUrl: string
  ): Promise<void> => {
    const subject = 'Restablecer tu contraseña - DogCatiFy';
    const text = `Hola ${name},\n\nHemos recibido una solicitud para restablecer la contraseña de tu cuenta en DogCatiFy.\n\nPara restablecer tu contraseña, haz clic en el siguiente enlace:\n\n${resetUrl}\n\nEste enlace expira en 24 horas.\n\nSi no solicitaste este cambio, puedes ignorar este correo de forma segura.\n\nEl equipo de DogCatiFy`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f7;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">

                <!-- Header con logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2D6A6F 0%, #1e4d51 100%); padding: 40px 30px; text-align: center;">
                    <img src="https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/system/nuevo%20logo%20fondo%20blanco.png" alt="DogCatiFy" style="max-width: 180px; height: auto; margin-bottom: 20px;" />
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Recuperación de Contraseña</h1>
                  </td>
                </tr>

                <!-- Contenido principal -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hola <strong style="color: #1f2937;">${name}</strong>,</p>

                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Recibimos una solicitud para restablecer la contraseña de tu cuenta en DogCatiFy. Para continuar con el proceso, haz clic en el botón de abajo:
                    </p>

                    <!-- Botón CTA -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #2D6A6F 0%, #1e4d51 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(45, 106, 111, 0.3); transition: all 0.3s;">
                            Restablecer mi contraseña
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Información adicional -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                      <tr>
                        <td style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 20px; border-radius: 6px;">
                          <p style="color: #1e40af; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0; font-weight: 600;">
                            Información importante:
                          </p>
                          <ul style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                            <li style="margin-bottom: 8px;">Este enlace es válido por <strong>24 horas</strong></li>
                            <li style="margin-bottom: 8px;">Solo puedes usar este enlace una vez</li>
                            <li>Si el botón no funciona, copia y pega el enlace de abajo en tu navegador</li>
                          </ul>
                        </td>
                      </tr>
                    </table>

                    <!-- URL alternativa -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
                      <tr>
                        <td style="background-color: #F9FAFB; padding: 15px; border-radius: 6px; border: 1px solid #E5E7EB;">
                          <p style="color: #6B7280; font-size: 12px; margin: 0 0 8px 0;">Enlace alternativo:</p>
                          <p style="color: #374151; font-size: 12px; word-break: break-all; font-family: 'Courier New', monospace; margin: 0; line-height: 1.5;">
                            ${resetUrl}
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Nota de seguridad -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0 0 0;">
                      <tr>
                        <td style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; border-radius: 6px;">
                          <p style="color: #92400E; font-size: 14px; line-height: 1.6; margin: 0; font-weight: 500;">
                            <strong>¿No solicitaste este cambio?</strong><br>
                            Si no realizaste esta solicitud, puedes ignorar este correo de forma segura. Tu contraseña permanecerá sin cambios.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                      Saludos,<br>
                      <strong style="color: #374151;">El equipo de DogCatiFy</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
                    <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0 0 8px 0;">
                      © 2025 DogCatiFy. Todos los derechos reservados.
                    </p>
                    <p style="color: #9CA3AF; font-size: 11px; line-height: 1.5; margin: 0;">
                      Este es un correo automático, por favor no respondas a este mensaje.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await NotificationService.sendEmail(email, subject, text, html);
  },

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

  sendPartnerVerificationEmail: async (
    email: string,
    businessName: string
  ): Promise<void> => {
    const subject = 'Tu negocio ha sido verificado - DogCatiFy';
    const text = `Felicidades,\n\nTu negocio "${businessName}" ha sido verificado en DogCatiFy. Ahora puedes comenzar a ofrecer tus servicios a nuestra comunidad de amantes de mascotas.\n\nGracias por unirte a DogCatiFy.`;
    const html = EmailTemplates.partnerApproved(businessName, '');

    await NotificationService.sendEmail(email, subject, text, html);
  },

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

  sendPartnerRejectionEmail: async (
    email: string,
    businessName: string,
    reason: string
  ): Promise<void> => {
    const subject = 'Solicitud No Aprobada - DogCatiFy';
    const text = `Hola,\n\nLamentamos informarte que tu solicitud para registrar "${businessName}" en DogCatiFy no ha sido aprobada.\n\nMotivo: ${reason}\n\nGracias por tu interés en DogCatiFy.`;
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
    const messageText = `${senderName} te ha enviado un mensaje sobre la adopción de ${petName}:\n\n"${messagePreview}"\n\nResponde desde la app DogCatiFy.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nuevo mensaje sobre adopción</h1>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <p>Hola,</p>
          <p><strong>${senderName}</strong> te ha enviado un mensaje sobre la adopción de <strong>${petName}</strong>:</p>
          <div style="background-color: white; border-left: 4px solid #2D6A6F; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-style: italic;">"${messagePreview}"</p>
          </div>
          <p>Responde desde la app DogCatiFy para continuar la conversación sobre la adopción.</p>
        </div>
        <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
          <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    await NotificationService.sendEmail(recipientEmail, subject, messageText, html);
  },

  sendPushNotification: async (
    pushToken: string,
    title: string,
    body: string,
    data?: any
  ) => {
    try {
      console.log('✅ User has push token, preparing notification...');

      // Validate token format
      if (!pushToken.startsWith('ExponentPushToken[')) {
        console.error('❌ Invalid push token format:', pushToken);
        return;
      }

      // Enhanced notification payload for production
      // Send push notification
      const notificationPayload = {
        to: pushToken,
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: 'normal',
        channelId: 'default',
        badge: 1,
        // Add TTL for better delivery
        ttl: 3600, // 1 hour
        // Add collapse key for grouping
        collapseKey: data?.type || 'general'
      };
      
      console.log('📤 Sending push notification with payload:', {
        to: pushToken.substring(0, 20) + '...',
        title,
        body,
        data
      });

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          'User-Agent': 'DogCatiFy/2.0.0'
        },
        body: JSON.stringify(notificationPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Push notification HTTP error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Push notification sent successfully:', result);

      // Check for errors in the result
      if (result.data && Array.isArray(result.data)) {
        const firstResult = result.data[0];
        if (firstResult && firstResult.status === 'error') {
          console.error('❌ Push notification error in result:', firstResult);
          
          // Handle specific error cases
          if (firstResult.details?.error === 'DeviceNotRegistered') {
            console.log('Device not registered, token may be invalid');
            // Could remove token from database here
            return;
          }
          
          throw new Error(`Push notification error: ${firstResult.message || firstResult.details?.error || 'Unknown error'}`);
        }
      }

      return result;
    } catch (error: any) {
      console.error('❌ Error sending push notification:', error);
      throw error;
    }
  }
};