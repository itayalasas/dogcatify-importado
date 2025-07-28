import React, { createContext, useContext, ReactNode } from 'react';
import { NotificationService } from '../utils/notifications';

interface NotificationContextType {
  sendEmail: typeof NotificationService.sendEmail;
  sendWelcomeEmail: typeof NotificationService.sendWelcomeEmail;
  sendBookingConfirmationEmail: typeof NotificationService.sendBookingConfirmationEmail;
  sendBookingCancellationEmail: typeof NotificationService.sendBookingCancellationEmail;
  sendBookingReminderEmail: typeof NotificationService.sendBookingReminderEmail;
  sendPartnerVerificationEmail: typeof NotificationService.sendPartnerVerificationEmail;
  sendPartnerRegistrationEmail: typeof NotificationService.sendPartnerRegistrationEmail;
  sendPartnerRejectionEmail: typeof NotificationService.sendPartnerRejectionEmail;
  sendChatMessageNotification: typeof NotificationService.sendChatMessageNotification;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const contextValue: NotificationContextType = {
    sendEmail: NotificationService.sendEmail,
    sendWelcomeEmail: NotificationService.sendWelcomeEmail,
    sendBookingConfirmationEmail: NotificationService.sendBookingConfirmationEmail,
    sendBookingCancellationEmail: NotificationService.sendBookingCancellationEmail,
    sendBookingReminderEmail: NotificationService.sendBookingReminderEmail,
    sendPartnerVerificationEmail: NotificationService.sendPartnerVerificationEmail,
    sendPartnerRegistrationEmail: NotificationService.sendPartnerRegistrationEmail,
    sendPartnerRejectionEmail: NotificationService.sendPartnerRejectionEmail,
    sendChatMessageNotification: NotificationService.sendChatMessageNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};