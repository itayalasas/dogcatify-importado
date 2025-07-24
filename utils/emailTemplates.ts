// Email templates for various notifications
// These templates use HTML and inline CSS for maximum compatibility across email clients

export const EmailTemplates = { 
  /**
   * Welcome email sent to new users upon registration
   * @param name User's display name
   * @param activationLink Link to activate the account (optional)
   */
  welcome: (name: string, activationLink?: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
        <img src="https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/system/nuevo%20logo%20fondo%20blanco.png" alt="DogCatiFy Logo" style="max-width: 150px; height: auto;" />
        <h1 style="color: white; margin: 10px 0;">¡Bienvenido a DogCatiFy!</h1>
      </div>
      <div style="padding: 20px; background-color: #f9f9f9;">
        <p>Hola <strong>${name}</strong>,</p>
        <p>¡Estamos emocionados de que te hayas unido a nuestra comunidad de amantes de mascotas!</p>
        <p>Con DogCatiFy, puedes:</p>
        <ul>
          <li>Crear perfiles para tus mascotas</li>
          <li>Conectar con otros dueños de mascotas</li>
          <li>Encontrar servicios para tus compañeros peludos</li>
          <li>Compartir momentos especiales con la comunidad</li>
        </ul>
        ${activationLink ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${activationLink}" style="background-color: #2D6A6F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Activar mi cuenta
          </a>
        </div>
        ` : ''}
        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
        <p>¡Gracias por unirte!</p>
        <p>El equipo de DogCatiFy</p>
      </div>
      <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
        <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
        <p>Av. Siempreviva 742, Springfield</p>
      </div>
    </div>
  `,

  /**
   * Booking confirmation email
   * @param name User's display name
   * @param serviceName Name of the booked service
   * @param partnerName Name of the service provider
   * @param date Date of the appointment
   * @param time Time of the appointment
   * @param petName Name of the pet
   */
  bookingConfirmation: (name: string, serviceName: string, partnerName: string, date: string, time: string, petName: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
        <img src="https://i.imgur.com/XYZ123.png" alt="DogCatiFy Logo" style="max-width: 150px; height: auto;" />
        <h1 style="color: white; margin: 10px 0;">Confirmación de Reserva</h1>
      </div>
      <div style="padding: 20px; background-color: #f9f9f9;">
        <p>Hola <strong>${name}</strong>,</p>
        <p>Tu reserva ha sido confirmada con los siguientes detalles:</p>
        <div style="background-color: white; border-left: 4px solid #2D6A6F; padding: 15px; margin: 20px 0;">
          <p><strong>Servicio:</strong> ${serviceName}</p>
          <p><strong>Proveedor:</strong> ${partnerName}</p>
          <p><strong>Fecha:</strong> ${date}</p>
          <p><strong>Hora:</strong> ${time}</p>
          <p><strong>Mascota:</strong> ${petName}</p>
        </div>
        <p>Si necesitas hacer algún cambio, por favor contacta directamente con el proveedor.</p>
        <p>¡Gracias por usar DogCatiFy!</p>
      </div>
      <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
        <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
      </div>
    </div>
  `,

  /**
   * Booking cancellation email
   * @param name User's display name
   * @param serviceName Name of the cancelled service
   * @param partnerName Name of the service provider
   * @param date Date of the appointment
   * @param time Time of the appointment
   */
  bookingCancellation: (name: string, serviceName: string, partnerName: string, date: string, time: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
        <img src="https://i.imgur.com/XYZ123.png" alt="DogCatiFy Logo" style="max-width: 150px; height: auto;" />
        <h1 style="color: white; margin: 10px 0;">Reserva Cancelada</h1>
      </div>
      <div style="padding: 20px; background-color: #f9f9f9;">
        <p>Hola <strong>${name}</strong>,</p>
        <p>Te informamos que la siguiente reserva ha sido cancelada:</p>
        <div style="background-color: white; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0;">
          <p><strong>Servicio:</strong> ${serviceName}</p>
          <p><strong>Proveedor:</strong> ${partnerName}</p>
          <p><strong>Fecha:</strong> ${date}</p>
          <p><strong>Hora:</strong> ${time}</p>
        </div>
        <p>Si tienes alguna pregunta, por favor contacta con el proveedor o con nuestro equipo de soporte.</p>
        <p>¡Gracias por usar DogCatiFy!</p>
      </div>
      <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
        <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
      </div>
    </div>
  `,

  /**
   * Booking reminder email
   * @param name User's display name
   * @param serviceName Name of the booked service
   * @param partnerName Name of the service provider
   * @param date Date of the appointment
   * @param time Time of the appointment
   * @param petName Name of the pet
   */
  bookingReminder: (name: string, serviceName: string, partnerName: string, date: string, time: string, petName: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
        <img src="https://i.imgur.com/XYZ123.png" alt="DogCatiFy Logo" style="max-width: 150px; height: auto;" />
        <h1 style="color: white; margin: 10px 0;">Recordatorio de Cita</h1>
      </div>
      <div style="padding: 20px; background-color: #f9f9f9;">
        <p>Hola <strong>${name}</strong>,</p>
        <p>Te recordamos que tienes una cita programada para mañana:</p>
        <div style="background-color: white; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
          <p><strong>Servicio:</strong> ${serviceName}</p>
          <p><strong>Proveedor:</strong> ${partnerName}</p>
          <p><strong>Fecha:</strong> ${date}</p>
          <p><strong>Hora:</strong> ${time}</p>
          <p><strong>Mascota:</strong> ${petName}</p>
        </div>
        <p>Si necesitas reprogramar o cancelar, por favor contacta directamente con el proveedor lo antes posible.</p>
        <p>¡Gracias por usar DogCatiFy!</p>
      </div>
      <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
        <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
      </div>
    </div>
  `,

  /**
   * Partner registration confirmation email
   * @param businessName Name of the business
   * @param businessType Type of the business
   */
  partnerRegistration: (businessName: string, businessType: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
        <img src="https://i.imgur.com/XYZ123.png" alt="DogCatiFy Logo" style="max-width: 150px; height: auto;" />
        <h1 style="color: white; margin: 10px 0;">Solicitud de Registro Recibida</h1>
      </div>
      <div style="padding: 20px; background-color: #f9f9f9;">
        <p>Hola,</p>
        <p>Hemos recibido tu solicitud para registrar <strong>${businessName}</strong> como ${businessType} en DogCatiFy.</p>
        <p>Nuestro equipo revisará tu solicitud y te notificaremos cuando sea aprobada. Este proceso generalmente toma entre 24 y 48 horas hábiles.</p>
        <p>Mientras tanto, puedes ir preparando la información de los servicios que ofrecerás y los horarios de atención.</p>
        <p>¡Gracias por elegir DogCatiFy para hacer crecer tu negocio!</p>
      </div>
      <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
        <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
      </div>
    </div>
  `,

  /**
   * Partner verification approved email
   * @param businessName Name of the business
   * @param businessType Type of the business
   */
  partnerApproved: (businessName: string, businessType: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
        <img src="https://i.imgur.com/XYZ123.png" alt="DogCatiFy Logo" style="max-width: 150px; height: auto;" />
        <h1 style="color: white; margin: 10px 0;">¡Negocio Verificado!</h1>
      </div>
      <div style="padding: 20px; background-color: #f9f9f9;">
        <p>¡Felicidades!</p>
        <p>Tu negocio <strong>${businessName}</strong> ha sido verificado en DogCatiFy.</p>
        <p>Ahora puedes comenzar a:</p>
        <ul>
          <li>Configurar tus servicios</li>
          <li>Establecer tu disponibilidad</li>
          <li>Recibir reservas de clientes</li>
          <li>Gestionar tu negocio desde el panel de control</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://dogcatify.com/partner" style="background-color: #2D6A6F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Acceder al Panel de Aliado
          </a>
        </div>
        <p>¡Gracias por unirte a DogCatiFy!</p>
      </div>
      <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
        <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
      </div>
    </div>
  `,

  /**
   * Partner verification rejected email
   * @param businessName Name of the business
   * @param reason Reason for rejection
   */
  partnerRejected: (businessName: string, reason: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
        <img src="https://i.imgur.com/XYZ123.png" alt="DogCatiFy Logo" style="max-width: 150px; height: auto;" />
        <h1 style="color: white; margin: 10px 0;">Solicitud No Aprobada</h1>
      </div>
      <div style="padding: 20px; background-color: #f9f9f9;">
        <p>Hola,</p>
        <p>Lamentamos informarte que tu solicitud para registrar <strong>${businessName}</strong> en DogCatiFy no ha sido aprobada en esta ocasión.</p>
        <div style="background-color: white; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0;">
          <p><strong>Motivo:</strong> ${reason || 'No cumple con los requisitos necesarios para ser parte de nuestra plataforma en este momento.'}</p>
        </div>
        <p>Si deseas obtener más información o volver a intentarlo con los ajustes necesarios, por favor contacta con nuestro equipo de soporte.</p>
        <p>Agradecemos tu interés en DogCatiFy.</p>
      </div>
      <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
        <p>© 2025 DogCatiFy. Todos los derechos reservados.</p>
      </div>
    </div>
  `
};