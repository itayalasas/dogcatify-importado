import { supabaseClient } from '@/lib/supabase';

/**
 * Mercado Pago OAuth2 Marketplace Implementation
 * This implements the complete OAuth2 flow for marketplace with commission splits
 */

// Mercado Pago OAuth2 Configuration
const MP_BASE_URL = process.env.EXPO_PUBLIC_MERCADOPAGO_BASE_URL || 'https://api.mercadopago.com';
const MP_REDIRECT_URI = 'https://dogcatify.com/auth/mercadopago/callback';

/**
 * Get admin Mercado Pago configuration from database
 */
const getAdminMercadoPagoConfig = async () => {
  try {
    const { data, error } = await supabaseClient
      .from('admin_settings')
      .select('value')
      .eq('key', 'mercadopago_config')
      .single();

    if (error) throw error;

    if (!data?.value?.access_token) {
      throw new Error('Admin Mercado Pago configuration not found');
    }

    return {
      client_id: data.value.client_id,
      client_secret: data.value.client_secret,
      access_token: data.value.access_token,
      public_key: data.value.public_key,
      is_test_mode: data.value.is_test_mode || false
    };
  } catch (error) {
    console.error('Error getting admin MP config:', error);
    throw error;
  }
};

/**
 * Generate OAuth2 authorization URL for partner
 */
export const generateOAuth2AuthorizationUrl = (partnerId: string): string => {
  // Note: This will need the client_id from admin config
  // For now, we'll use a placeholder that gets replaced when called
  return `https://auth.mercadopago.com/authorization?client_id=PLACEHOLDER&response_type=code&platform_id=mp&redirect_uri=${MP_REDIRECT_URI}&state=${partnerId}`;
};

/**
 * Generate OAuth2 authorization URL with admin config
 */
export const generateOAuth2AuthorizationUrlWithConfig = async (partnerId: string): Promise<string> => {
  try {
    const adminConfig = await getAdminMercadoPagoConfig();
    
    if (!adminConfig.client_id) {
      throw new Error('Mercado Pago Client ID not configured in admin settings');
    }

    const params = new URLSearchParams({
      client_id: adminConfig.client_id,
      response_type: 'code',
      platform_id: 'mp',
      redirect_uri: MP_REDIRECT_URI,
      state: partnerId
    });

    return `https://auth.mercadopago.com/authorization?${params.toString()}`;
  } catch (error) {
    console.error('Error generating OAuth2 URL:', error);
    throw error;
  }
};

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForTokens = async (
  code: string,
  partnerId: string
): Promise<{
  access_token: string;
  refresh_token: string;
  user_id: string;
  public_key: string;
}> => {
  try {
    const adminConfig = await getAdminMercadoPagoConfig();
    
    const response = await fetch(`${MP_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: adminConfig.client_id,
        client_secret: adminConfig.client_secret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: MP_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OAuth2 token exchange failed: ${errorData.message || response.statusText}`);
    }

    const tokenData = await response.json();

    // Store tokens in database for the partner
    await storePartnerTokens(partnerId, tokenData);

    return tokenData;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw error;
  }
};

/**
 * Store partner's Mercado Pago tokens in database
 */
const storePartnerTokens = async (partnerId: string, tokenData: any) => {
  try {
    const { error } = await supabaseClient
      .from('partners')
      .update({
        mercadopago_connected: true,
        mercadopago_config: {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          user_id: tokenData.user_id,
          public_key: tokenData.public_key,
          connected_at: new Date().toISOString(),
          is_oauth: true
        }
      })
      .eq('id', partnerId);

    if (error) throw error;
  } catch (error) {
    console.error('Error storing partner tokens:', error);
    throw error;
  }
};

/**
 * Get marketplace access token (admin's token)
 */
const getMarketplaceAccessToken = async (): Promise<string> => {
  try {
    const { data, error } = await supabaseClient
      .from('admin_settings')
      .select('value')
      .eq('key', 'mercadopago_config')
      .single();

    if (error) throw error;

    if (!data?.value?.access_token) {
      throw new Error('Marketplace access token not configured');
    }

    return data.value.access_token;
  } catch (error) {
    console.error('Error getting marketplace access token:', error);
    throw error;
  }
};

/**
 * Get partner's Mercado Pago configuration
 */
export const getPartnerMercadoPagoConfig = async (partnerId: string) => {
  try {
    console.log('Getting MP config for partner:', partnerId);
    
    const { data, error } = await supabaseClient
      .from('partners')
      .select('*')
      .eq('id', partnerId)
      .single();

    if (error) throw error;
    
    console.log('Partner data found:', data);

    if (!data?.mercadopago_connected || !data?.mercadopago_config) {
      console.log('Partner MP status:', {
        mercadopago_connected: data?.mercadopago_connected,
        has_config: !!data?.mercadopago_config,
        has_access_token: !!data?.mercadopago_config?.access_token
      });
      throw new Error(`Partner "${data?.business_name || partnerId}" no tiene Mercado Pago configurado`);
    }

    // Verificar que tenga access_token
    if (!data.mercadopago_config.access_token) {
      throw new Error(`Partner "${data.business_name}" no tiene access_token configurado`);
    }

    console.log('MP config validation passed for partner:', data.business_name);

    return {
      ...data.mercadopago_config,
      commission_percentage: data.commission_percentage || 5.0,
      business_name: data.business_name,
      // Para configuraciones manuales, usar el partner_id como user_id si no existe
      user_id: data.mercadopago_config.user_id || data.mercadopago_config.account_id || partnerId
    };
  } catch (error) {
    console.error('Error getting partner MP config:', error);
    throw error;
  }
};

/**
 * Create order in database
 */
export const createOrder = async (
  partnerId: string,
  customerInfo: any,
  items: any[],
  totalAmount: number,
  commissionAmount: number,
  partnerAmount: number,
  shippingAddress: string
) => {
  try {
    const orderData = {
      partner_id: partnerId,
      customer_id: customerInfo.id,
      items,
      total_amount: totalAmount,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount,
      shipping_address: shippingAddress,
      payment_method: 'mercadopago',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const insertResult = await supabaseClient
      .from('orders')
      .insert(orderData);
    
    const { data, error } = insertResult;

    if (error) throw error;
    
    // Since our custom implementation doesn't support .select().single(), 
    // we'll return the orderData with a generated ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return { ...orderData, id: orderId };
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

/**
 * Create payment preference with marketplace split
 */
export const createPaymentPreference = async (
  orderId: string,
  items: any[],
  customerInfo: any,
  partnerConfig: any,
  commissionAmount: number,
  partnerAmount: number,
  shippingCost: number = 500
) => {
  try {
    const marketplaceAccessToken = await getMarketplaceAccessToken();

    // Calculate totals including shipping
    const itemsSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalAmount = itemsSubtotal + shippingCost;
    
    console.log('Creating payment preference with config:', {
      partner_user_id: partnerConfig.user_id,
      commission: commissionAmount,
      partner_amount: partnerAmount,
      shipping_cost: shippingCost,
      total_amount: totalAmount,
      is_oauth: partnerConfig.is_oauth
    });

    const preferenceData = {
      items: items.map(item => ({
        id: item.id,
        title: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        currency_id: 'UYU'
      })).concat([{
        id: 'shipping',
        title: 'Envío',
        quantity: 1,
        unit_price: shippingCost,
        currency_id: 'UYU'
      }]),
      payer: {
        name: customerInfo.displayName || 'Cliente',
        email: customerInfo.email,
        phone: {
          area_code: '11',
          number: customerInfo.phone || '1234567890'
        }
      },
      back_urls: {
        success: `${process.env.EXPO_PUBLIC_APP_URL || 'https://dogcatify.com'}/payment/success?order_id=${orderId}`,
        failure: `${process.env.EXPO_PUBLIC_APP_URL || 'https://dogcatify.com'}/payment/failure?order_id=${orderId}`,
        pending: `${process.env.EXPO_PUBLIC_APP_URL || 'https://dogcatify.com'}/payment/pending?order_id=${orderId}`
      },
      auto_return: 'approved',
      external_reference: orderId,
      notification_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      marketplace: 'DogCatiFy',
      statement_descriptor: 'DOGCATIFY'
    };

    // Solo agregar marketplace_fee y collector_id si es configuración OAuth
    if (partnerConfig.is_oauth && partnerConfig.user_id && !isNaN(parseInt(partnerConfig.user_id))) {
      preferenceData.marketplace_fee = commissionAmount;
      preferenceData.collector_id = parseInt(partnerConfig.user_id);
      console.log('Using OAuth marketplace split with collector_id:', partnerConfig.user_id);
    } else {
      console.log('Using manual configuration - no marketplace split');
    }

    const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${marketplaceAccessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mercado Pago API error:', errorData);
      throw new Error(`Failed to create payment preference: ${errorData.message || response.statusText}`);
    }

    const preference = await response.json();
    
    // Update order with payment preference ID
    await supabaseClient
      .from('orders')
      .update({
        payment_preference_id: preference.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    return preference;
  } catch (error) {
    console.error('Error creating payment preference:', error);
    throw error;
  }
};

/**
 * Create orders and payment preferences for multiple partners (marketplace)
 */
export const createMultiPartnerOrder = async (
  cartItems: any[],
  customerInfo: any,
  shippingAddress: string,
  totalShippingCost: number
): Promise<{ orders: any[], paymentPreferences: any[] }> => {
  try {
    console.log('Creating multi-partner order with marketplace split...');
    console.log('Cart items received:', cartItems.map(item => ({
      id: item.id,
      name: item.name,
      partnerId: item.partnerId,
      partnerName: item.partnerName
    })));
    
    // Calculate totals for the unified order
    const itemsSubtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalAmount = itemsSubtotal + totalShippingCost;

    console.log('Unified order totals:', {
      itemsSubtotal,
      shippingCost: totalShippingCost,
      totalAmount
    });

    // Use the first partner as the primary partner for the unified order
    const primaryPartnerId = cartItems[0].partnerId;
    
    // Get primary partner's configuration including commission percentage
    const primaryPartnerConfig = await getPartnerMercadoPagoConfig(primaryPartnerId);
    
    // Calculate commission using partner's configured percentage
    const commissionAmount = totalAmount * ((primaryPartnerConfig.commission_percentage || 5.0) / 100);
    const partnerAmount = totalAmount - commissionAmount;

    console.log('Commission calculation:', {
      commission_percentage: primaryPartnerConfig.commission_percentage || 5.0,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount
    });

    // Generate a simple unique ID for temporary use
    const tempOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Prepare order data
    const orderData = {
      partner_id: primaryPartnerId,
      customer_id: customerInfo.id,
      items: cartItems,
      total_amount: totalAmount,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount,
      shipping_address: shippingAddress,
      payment_method: 'mercadopago',
      status: 'pending',
      created_at: new Date().toISOString(),
      partner_breakdown: {
        partners: cartItems.reduce((acc, item) => {
          if (!acc[item.partnerId]) {
            acc[item.partnerId] = {
              partner_id: item.partnerId,
              partner_name: item.partnerName,
              items: [],
              subtotal: 0
            };
          }
          acc[item.partnerId].items.push({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
          });
          acc[item.partnerId].subtotal += item.price * item.quantity;
          return acc;
        }, {}),
        total_partners: [...new Set(cartItems.map(item => item.partnerId))].length,
        commission_split: commissionAmount,
        shipping_cost: totalShippingCost
      }
    };

    // Insert the unified order into database (let PostgreSQL generate the UUID)
    const insertResult = await supabaseClient
      .from('orders')
      .insert([orderData]);

    if (insertResult.error) {
      console.error('Error creating unified order:', insertResult.error);
      throw insertResult.error;
    }

    console.log('Unified order created successfully');
    
    // Since we can't get the generated ID easily, we'll use the temp ID for the payment preference
    // The webhook will match by external_reference
    const orderIdForPayment = tempOrderId;

    // Create the unified order object for return
    const unifiedOrder = {
      ...orderData,
      id: orderIdForPayment,
      customerId: orderData.customer_id,
      totalAmount: orderData.total_amount,
      commissionAmount: orderData.commission_amount,
      partnerAmount: orderData.partner_amount,
      shippingAddress: orderData.shipping_address,
      createdAt: new Date(orderData.created_at),
      updatedAt: null
    };

    // Create a single payment preference for the unified order
    const preference = await createUnifiedPaymentPreference(
      orderIdForPayment,
      cartItems,
      customerInfo,
      primaryPartnerConfig,
      totalAmount,
      totalShippingCost,
      shippingAddress
    );

    console.log('Unified payment preference created:', preference.id);

    const orders = [unifiedOrder];
    const paymentPreferences = [preference];

    return { orders, paymentPreferences };
  } catch (error) {
    console.error('Error creating unified order:', error);
    throw error;
  }
};

/**
 * Create unified payment preference for all items (single invoice)
 */
export const createUnifiedPaymentPreference = async (
  orderId: string,
  allItems: any[],
  customerInfo: any,
  partnerConfig: any,
  totalAmount: number,
  shippingCost: number,
  shippingAddress: string
): Promise<any> => {
  try {
    // Validate partner has MP configured
    if (!partnerConfig.access_token) {
      throw new Error(`Partner "${partnerConfig.business_name}" no tiene access_token configurado`);
    }
    
    console.log('Creating unified payment preference for order:', orderId);
    console.log('Partner config:', {
      business_name: partnerConfig.business_name,
      commission_percentage: partnerConfig.commission_percentage || 5.0,
      has_access_token: !!partnerConfig.access_token
    });
    
    // Calculate commission using partner's configured percentage
    const commissionAmount = totalAmount * ((partnerConfig.commission_percentage || 5.0) / 100);
    
    const preferenceData = {
      items: allItems.map(item => ({
        id: item.id,
        title: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        currency_id: 'UYU'
      })).concat([{
        id: 'shipping',
        title: 'Envío',
        quantity: 1,
        unit_price: shippingCost,
        currency_id: 'UYU'
      }]),
      payer: {
        name: customerInfo.displayName || 'Cliente',
        email: customerInfo.email,
        phone: {
          area_code: '11',
          number: customerInfo.phone || '1234567890'
        }
      },
      back_urls: {
        success: `${process.env.EXPO_PUBLIC_APP_URL || 'https://dogcatify.com'}/payment/success?order_id=${orderId}`,
        failure: `${process.env.EXPO_PUBLIC_APP_URL || 'https://dogcatify.com'}/payment/failure?order_id=${orderId}`,
        pending: `${process.env.EXPO_PUBLIC_APP_URL || 'https://dogcatify.com'}/payment/pending?order_id=${orderId}`
      },
      auto_return: 'approved',
      external_reference: orderId,
      notification_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      statement_descriptor: 'DOGCATIFY',
      // Application fee - comisión que va para DogCatiFy (marketplace)
      application_fee: commissionAmount
    };
    
    console.log('Final unified preference data:', {
      items_count: preferenceData.items.length,
      total_amount: totalAmount,
      application_fee: commissionAmount,
      commission_percentage: partnerConfig.commission_percentage || 5.0,
      partner_receives: totalAmount - commissionAmount,
      external_reference: preferenceData.external_reference
    });

    // Use partner's token to create preference (partner receives payment minus application_fee)
    const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${partnerConfig.access_token}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mercado Pago API error:', errorData);
      throw new Error(`Failed to create payment preference: ${errorData.message || response.statusText}`);
    }

    const preference = await response.json();
    
    console.log('Split payment preference created successfully:', {
      id: preference.id,
      application_fee: commissionAmount,
      partner_receives: totalAmount - commissionAmount,
      commission_percentage: partnerConfig.commission_percentage || 5.0
    });
    
    return preference;
  } catch (error) {
    console.error('Error creating split payment preference:', error);
    throw error;
  }
};

/**
 * Create service booking order with Mercado Pago payment
 */
export const createServiceBookingOrder = async (bookingData: {
  serviceId: string;
  partnerId: string;
  customerId: string;
  petId: string;
  date: Date;
  time: string;
  notes: string | null;
  serviceName: string;
  partnerName: string;
  petName: string;
  totalAmount: number;
  customerInfo: any;
}): Promise<{ success: boolean; paymentUrl?: string; orderId?: string; error?: string }> => {
  try {
    console.log('Creating service booking order...');
    console.log('Booking data:', bookingData);
    
    // Get partner's Mercado Pago configuration
    const partnerConfig = await getPartnerMercadoPagoConfig(bookingData.partnerId);
    console.log('Partner MP config loaded for:', partnerConfig.business_name);
    
    // Calculate commission
    const commissionAmount = bookingData.totalAmount * ((partnerConfig.commission_percentage || 5.0) / 100);
    const partnerAmount = bookingData.totalAmount - commissionAmount;
    
    console.log('Commission calculation:', {
      total: bookingData.totalAmount,
      commission_rate: partnerConfig.commission_percentage || 5.0,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount
    });
    
    // Create booking record in database
    const bookingRecord = {
      service_id: bookingData.serviceId,
      partner_id: bookingData.partnerId,
      customer_id: bookingData.customerId,
      pet_id: bookingData.petId,
      date: bookingData.date.toISOString(),
      time: bookingData.time,
      status: 'pending_payment',
      notes: bookingData.notes,
      total_amount: bookingData.totalAmount,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount,
      service_name: bookingData.serviceName,
      partner_name: bookingData.partnerName,
      pet_name: bookingData.petName,
      payment_method: 'mercadopago',
      created_at: new Date().toISOString()
    };
    
    console.log('Inserting booking record...');
    const { data: insertedBooking, error: bookingError } = await supabaseClient
      .from('bookings')
      .insert([bookingRecord])
      .select()
      .single();
    
    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      throw new Error('No se pudo crear la reserva en la base de datos');
    }
    
    console.log('Booking created with ID:', insertedBooking.id);
    
    // Create order record for payment tracking
    const orderData = {
      partner_id: bookingData.partnerId,
      customer_id: bookingData.customerId,
      booking_id: insertedBooking.id,
      items: [{
        id: bookingData.serviceId,
        name: bookingData.serviceName,
        price: bookingData.totalAmount,
        quantity: 1,
        type: 'service'
      }],
      total_amount: bookingData.totalAmount,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount,
      payment_method: 'mercadopago',
      status: 'pending',
      order_type: 'service_booking',
      created_at: new Date().toISOString()
    };
    
    console.log('Creating order record...');
    const { data: insertedOrder, error: orderError } = await supabaseClient
      .from('orders')
      .insert([orderData])
      .select()
      .single();
    
    if (orderError) {
      console.error('Error creating order:', orderError);
      throw new Error('No se pudo crear la orden de pago');
    }
    
    console.log('Order created with ID:', insertedOrder.id);
    
    // Create Mercado Pago payment preference
    const preference = await createServicePaymentPreference(
      insertedOrder.id,
      bookingData,
      partnerConfig,
      commissionAmount
    );
    
    console.log('Payment preference created:', preference.id);
    
    // Update order with payment preference ID
    await supabaseClient
      .from('orders')
      .update({
        payment_preference_id: preference.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', insertedOrder.id);
    
    // Get payment URL
    const paymentUrl = preference.sandbox_init_point || preference.init_point;
    
    if (!paymentUrl) {
      throw new Error('No se pudo obtener la URL de pago');
    }
    
    console.log('Payment URL generated successfully');
    
    return {
      success: true,
      paymentUrl: paymentUrl,
      orderId: insertedOrder.id
    };
  } catch (error) {
    console.error('Error creating service booking order:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido'
    };
  }
};

/**
 * Create payment preference for service booking
 */
export const createServicePaymentPreference = async (
  orderId: string,
  bookingData: any,
  partnerConfig: any,
  commissionAmount: number
): Promise<any> => {
  try {
    const marketplaceAccessToken = await getMarketplaceAccessToken();
    
    const preferenceData = {
      items: [{
        id: bookingData.serviceId,
        title: bookingData.serviceName,
        quantity: 1,
        unit_price: bookingData.totalAmount,
        currency_id: 'UYU'
      }],
      payer: {
        name: bookingData.customerInfo.displayName || 'Cliente',
        email: bookingData.customerInfo.email,
        phone: {
          area_code: '598',
          number: bookingData.customerInfo.phone || '99999999'
        }
      },
      back_urls: {
        success: `dogcatify://payment/success?order_id=${orderId}&type=booking`,
        failure: `dogcatify://payment/failure?order_id=${orderId}&type=booking`,
        pending: `dogcatify://payment/pending?order_id=${orderId}&type=booking`
      },
      auto_return: 'approved',
      external_reference: orderId,
      notification_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      statement_descriptor: 'DOGCATIFY',
      metadata: {
        order_type: 'service_booking',
        service_name: bookingData.serviceName,
        partner_name: bookingData.partnerName,
        pet_name: bookingData.petName,
        appointment_date: bookingData.date.toISOString(),
        appointment_time: bookingData.time
      }
    };
    
    // Add marketplace fee if partner has OAuth configuration
    if (partnerConfig.is_oauth && partnerConfig.user_id && !isNaN(parseInt(partnerConfig.user_id))) {
      preferenceData.application_fee = commissionAmount;
      console.log('Using OAuth marketplace split for service booking');
    } else {
      console.log('Using manual configuration for service booking');
    }
    
    console.log('Creating service payment preference...');
    const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${partnerConfig.access_token}`,
      },
      body: JSON.stringify(preferenceData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mercado Pago API error for service booking:', errorData);
      throw new Error(`Failed to create payment preference: ${errorData.message || response.statusText}`);
    }
    
    const preference = await response.json();
    console.log('Service payment preference created successfully');
    
    return preference;
  } catch (error) {
    console.error('Error creating service payment preference:', error);
    throw error;
  }
};

/**
 * Refresh partner's access token using refresh token
 */
export const refreshPartnerToken = async (partnerId: string): Promise<string> => {
  try {
    const adminConfig = await getAdminMercadoPagoConfig();
    
    const { data: partnerData, error } = await supabaseClient
      .from('partners')
      .select('mercadopago_config')
      .eq('id', partnerId)
      .single();

    if (error) throw error;

    const config = partnerData.mercadopago_config;
    if (!config?.refresh_token) {
      throw new Error('No refresh token available for partner');
    }

    const response = await fetch(`${MP_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: adminConfig.client_id,
        client_secret: adminConfig.client_secret,
        grant_type: 'refresh_token',
        refresh_token: config.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token refresh failed: ${errorData.message || response.statusText}`);
    }

    const tokenData = await response.json();

    // Update stored tokens
    await supabaseClient
      .from('partners')
      .update({
        mercadopago_config: {
          ...config,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          updated_at: new Date().toISOString()
        }
      })
      .eq('id', partnerId);

    return tokenData.access_token;
  } catch (error) {
    console.error('Error refreshing partner token:', error);
    throw error;
  }
};

/**
 * Create a marketplace payment with commission split
 */
export const createMarketplacePayment = async (
  orderId: string,
  paymentData: any,
  partnerConfig: any,
  commissionAmount: number
): Promise<any> => {
  try {
    const marketplaceAccessToken = await getMarketplaceAccessToken();

    const paymentRequest = {
      transaction_amount: paymentData.transaction_amount,
      description: paymentData.description || 'Compra en DogCatiFy',
      payment_method_id: paymentData.payment_method_id,
      payer: paymentData.payer,
      statement_descriptor: 'DOGCATIFY',
      external_reference: orderId,
      application_fee: commissionAmount, // Commission for marketplace
      collector_id: parseInt(partnerConfig.user_id), // Partner's MP user ID
      binary_mode: true,
      notification_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mercadopago-webhook`
    };

    console.log('Creating marketplace payment:', {
      amount: paymentData.transaction_amount,
      commission: commissionAmount,
      collector_id: partnerConfig.user_id
    });

    const response = await fetch(`${MP_BASE_URL}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${marketplaceAccessToken}`,
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mercado Pago payment error:', errorData);
      throw new Error(`Payment creation failed: ${errorData.message || response.statusText}`);
    }

    const payment = await response.json();
    
    // Update order with payment information
    await supabaseClient
      .from('orders')
      .update({
        payment_id: payment.id,
        payment_status: payment.status,
        payment_data: payment,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    return payment;
  } catch (error) {
    console.error('Error creating marketplace payment:', error);
    throw error;
  }
};

/**
 * Get partner's OAuth2 authorization status
 */
export const getPartnerOAuthStatus = async (partnerId: string): Promise<{
  isConnected: boolean;
  needsReauthorization: boolean;
  authorizationUrl?: string;
}> => {
  try {
    const { data, error } = await supabaseClient
      .from('partners')
      .select('mercadopago_config')
      .eq('id', partnerId)
      .single();

    if (error) throw error;

    const config = data?.mercadopago_config;
    
    if (!config?.access_token || !config?.user_id) {
      return {
        isConnected: false,
        needsReauthorization: true,
        authorizationUrl: generateOAuth2AuthorizationUrl(partnerId)
      };
    }

    // Check if token is still valid (you might want to make a test API call)
    const isTokenValid = await validatePartnerToken(config.access_token);
    
    if (!isTokenValid) {
      // Try to refresh token
      try {
        await refreshPartnerToken(partnerId);
        return {
          isConnected: true,
          needsReauthorization: false
        };
      } catch (refreshError) {
        return {
          isConnected: false,
          needsReauthorization: true,
          authorizationUrl: generateOAuth2AuthorizationUrl(partnerId)
        };
      }
    }

    return {
      isConnected: true,
      needsReauthorization: false
    };
  } catch (error) {
    console.error('Error checking partner OAuth status:', error);
    return {
      isConnected: false,
      needsReauthorization: true,
      authorizationUrl: generateOAuth2AuthorizationUrl(partnerId)
    };
  }
};

/**
 * Validate if partner's access token is still valid
 */
const validatePartnerToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch(`${MP_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error validating partner token:', error);
    return false;
  }
};

/**
 * Handle OAuth2 callback and complete authorization
 */
export const handleOAuth2Callback = async (
  code: string,
  state: string // This should be the partnerId
): Promise<{ success: boolean; partnerId: string; error?: string }> => {
  try {
    if (!code || !state) {
      throw new Error('Missing authorization code or state parameter');
    }

    const partnerId = state;
    console.log(`Handling OAuth2 callback for partner ${partnerId}`);

    // Exchange code for tokens
    const tokenData = await exchangeCodeForTokens(code, partnerId);

    console.log(`OAuth2 authorization completed for partner ${partnerId}`);

    return {
      success: true,
      partnerId: partnerId
    };
  } catch (error) {
    console.error('Error handling OAuth2 callback:', error);
    return {
      success: false,
      partnerId: state || 'unknown',
      error: error.message
    };
  }
};

/**
 * Disconnect partner from Mercado Pago
 */
export const disconnectPartnerMercadoPago = async (partnerId: string): Promise<void> => {
  try {
    await supabaseClient
      .from('partners')
      .update({
        mercadopago_connected: false,
        mercadopago_config: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', partnerId);

    console.log(`Partner ${partnerId} disconnected from Mercado Pago`);
  } catch (error) {
    console.error('Error disconnecting partner from Mercado Pago:', error);
    throw error;
  }
};