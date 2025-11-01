import { logger } from './datadogLogger';
import { Platform } from 'react-native';

/**
 * Servicio de Analytics para Datadog
 *
 * Proporciona métodos específicos para trackear eventos de negocio
 * que aparecerán en el dashboard de Product Analytics de Datadog
 */

export class Analytics {
  /**
   * Track user engagement
   */
  static trackUserEngagement(eventName: string, properties?: Record<string, any>) {
    logger.info(`Engagement: ${eventName}`, {
      category: 'engagement',
      event: eventName,
      platform: Platform.OS,
      ...properties,
    });
  }

  /**
   * Track e-commerce events
   */
  static trackProductView(productId: string, productName: string, price: number) {
    logger.info('Product Viewed', {
      category: 'ecommerce',
      event: 'product_view',
      product_id: productId,
      product_name: productName,
      price,
    });
  }

  static trackAddToCart(productId: string, productName: string, price: number, quantity: number) {
    logger.info('Added to Cart', {
      category: 'ecommerce',
      event: 'add_to_cart',
      product_id: productId,
      product_name: productName,
      price,
      quantity,
      total: price * quantity,
    });
  }

  static trackRemoveFromCart(productId: string, productName: string) {
    logger.info('Removed from Cart', {
      category: 'ecommerce',
      event: 'remove_from_cart',
      product_id: productId,
      product_name: productName,
    });
  }

  static trackCheckoutStarted(cartTotal: number, itemCount: number) {
    logger.info('Checkout Started', {
      category: 'ecommerce',
      event: 'checkout_start',
      cart_total: cartTotal,
      item_count: itemCount,
    });
  }

  static trackPurchase(
    orderId: string,
    total: number,
    itemCount: number,
    paymentMethod: string
  ) {
    logger.info('Purchase Completed', {
      category: 'ecommerce',
      event: 'purchase',
      order_id: orderId,
      total,
      item_count: itemCount,
      payment_method: paymentMethod,
    });
  }

  /**
   * Track service bookings
   */
  static trackServiceView(serviceId: string, serviceName: string, price: number) {
    logger.info('Service Viewed', {
      category: 'services',
      event: 'service_view',
      service_id: serviceId,
      service_name: serviceName,
      price,
    });
  }

  static trackBookingStarted(serviceId: string, serviceName: string) {
    logger.info('Booking Started', {
      category: 'services',
      event: 'booking_start',
      service_id: serviceId,
      service_name: serviceName,
    });
  }

  static trackBookingCompleted(
    bookingId: string,
    serviceId: string,
    serviceName: string,
    date: string
  ) {
    logger.info('Booking Completed', {
      category: 'services',
      event: 'booking_complete',
      booking_id: bookingId,
      service_id: serviceId,
      service_name: serviceName,
      booking_date: date,
    });
  }

  /**
   * Track pet management
   */
  static trackPetAdded(petId: string, species: string, breed: string) {
    logger.info('Pet Added', {
      category: 'pets',
      event: 'pet_add',
      pet_id: petId,
      species,
      breed,
    });
  }

  static trackPetProfileView(petId: string) {
    logger.info('Pet Profile Viewed', {
      category: 'pets',
      event: 'pet_view',
      pet_id: petId,
    });
  }

  static trackMedicalRecordAdded(petId: string, recordType: string) {
    logger.info('Medical Record Added', {
      category: 'pets',
      event: 'medical_record_add',
      pet_id: petId,
      record_type: recordType,
    });
  }

  /**
   * Track user behavior
   */
  static trackSearch(query: string, resultCount: number, category?: string) {
    logger.info('Search Performed', {
      category: 'search',
      event: 'search',
      query,
      result_count: resultCount,
      search_category: category,
    });
  }

  static trackFilter(filterType: string, filterValue: string) {
    logger.info('Filter Applied', {
      category: 'navigation',
      event: 'filter',
      filter_type: filterType,
      filter_value: filterValue,
    });
  }

  static trackShare(contentType: string, contentId: string, method: string) {
    logger.info('Content Shared', {
      category: 'social',
      event: 'share',
      content_type: contentType,
      content_id: contentId,
      share_method: method,
    });
  }

  /**
   * Track partner actions
   */
  static trackPartnerOnboarding(step: string, completed: boolean) {
    logger.info('Partner Onboarding', {
      category: 'partner',
      event: 'onboarding',
      step,
      completed,
    });
  }

  static trackPartnerProductAdded(partnerId: string, productName: string, price: number) {
    logger.info('Partner Product Added', {
      category: 'partner',
      event: 'product_add',
      partner_id: partnerId,
      product_name: productName,
      price,
    });
  }

  static trackPartnerServiceAdded(partnerId: string, serviceName: string) {
    logger.info('Partner Service Added', {
      category: 'partner',
      event: 'service_add',
      partner_id: partnerId,
      service_name: serviceName,
    });
  }

  /**
   * Track app health metrics
   */
  static trackAppStart(coldStart: boolean) {
    logger.info('App Started', {
      category: 'lifecycle',
      event: 'app_start',
      cold_start: coldStart,
      platform: Platform.OS,
      platform_version: Platform.Version,
    });
  }

  static trackAppBackground() {
    logger.info('App Backgrounded', {
      category: 'lifecycle',
      event: 'app_background',
    });
  }

  static trackAppForeground() {
    logger.info('App Foregrounded', {
      category: 'lifecycle',
      event: 'app_foreground',
    });
  }

  /**
   * Track feature usage
   */
  static trackFeatureUsed(featureName: string, properties?: Record<string, any>) {
    logger.info(`Feature Used: ${featureName}`, {
      category: 'feature',
      event: 'feature_use',
      feature: featureName,
      ...properties,
    });
  }

  static trackFeatureDiscovered(featureName: string) {
    logger.info(`Feature Discovered: ${featureName}`, {
      category: 'feature',
      event: 'feature_discover',
      feature: featureName,
    });
  }

  /**
   * Track errors from user perspective
   */
  static trackUserError(errorType: string, errorMessage: string, context?: Record<string, any>) {
    logger.error('User Error', new Error(errorMessage), {
      category: 'error',
      error_type: errorType,
      user_facing: true,
      ...context,
    });
  }

  /**
   * Track performance metrics
   */
  static trackPerformance(metric: string, value: number, unit: string = 'ms') {
    logger.info(`Performance: ${metric}`, {
      category: 'performance',
      metric,
      value,
      unit,
    });
  }

  /**
   * Track user feedback
   */
  static trackFeedback(rating: number, comment?: string, category?: string) {
    logger.info('User Feedback', {
      category: 'feedback',
      event: 'feedback',
      rating,
      comment,
      feedback_category: category,
    });
  }

  /**
   * Track notifications
   */
  static trackNotificationReceived(notificationType: string) {
    logger.info('Notification Received', {
      category: 'notification',
      event: 'notification_receive',
      notification_type: notificationType,
    });
  }

  static trackNotificationOpened(notificationType: string) {
    logger.info('Notification Opened', {
      category: 'notification',
      event: 'notification_open',
      notification_type: notificationType,
    });
  }

  /**
   * Track authentication events
   */
  static trackLogin(method: string, success: boolean) {
    logger.info('User Login', {
      category: 'auth',
      event: 'login',
      method,
      success,
    });
  }

  static trackLogout() {
    logger.info('User Logout', {
      category: 'auth',
      event: 'logout',
    });
  }

  static trackSignup(method: string, success: boolean) {
    logger.info('User Signup', {
      category: 'auth',
      event: 'signup',
      method,
      success,
    });
  }

  /**
   * Custom events
   */
  static trackCustomEvent(eventName: string, properties?: Record<string, any>) {
    logger.info(`Custom: ${eventName}`, {
      category: 'custom',
      event: eventName,
      ...properties,
    });
  }
}

// Export para uso en toda la app
export default Analytics;
