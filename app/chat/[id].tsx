import { Platform } from 'react-native';
import { EmailTemplates } from './emailTemplates';

/**
 * Utility functions placeholder for notification service (sin envío de correos)
 */
export const NotificationService = {
  sendEmail: async (): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    return { success: false, error: 'Función deshabilitada' };
  },

  sendWelcomeEmail: async (email: string, name: string, activationLink?: string): Promise<void> => {
    // Función deshabilitada
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
    // Función deshabilitada
  },

  sendBookingCancellationEmail: async (
    email: string, 
    name: string,
    serviceName: string,
    partnerName: string,
    date: string,
    time: string
  ): Promise<void> => {
    // Función deshabilitada
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
    // Función deshabilitada
  },

  sendPartnerVerificationEmail: async (
    email: string,
    businessName: string
  ): Promise<void> => {
    // Función deshabilitada
  },

  sendPartnerRegistrationEmail: async (
    email: string,
    businessName: string,
    businessType: string
  ): Promise<void> => {
    // Función deshabilitada
  },

  sendPartnerRejectionEmail: async (
    email: string,
    businessName: string,
    reason: string
  ): Promise<void> => {
    // Función deshabilitada
  },

  sendChatMessageNotification: async (
    recipientEmail: string,
    senderName: string,
    petName: string,
    messagePreview: string,
    conversationId: string
  ): Promise<void> => {
    // Función deshabilitada
  }
};
