// Mercado Pago integration utilities
const MP_BASE_URL = 'https://api.mercadopago.com';

/**
 * Get marketplace access token from admin settings
 */
export const getMarketplaceAccessToken = async (): Promise<string> => {
  try {
    // This would typically fetch from your admin settings
    // For now, return a placeholder or environment variable
    const token = process.env.EXPO_PUBLIC_MP_ACCESS_TOKEN;
    if (!token) {
      throw new Error('Marketplace access token not configured');
    }
    return token;
  } catch (error) {
    console.error('Error getting marketplace access token:', error);
    throw error;
  }
};

/**
 * Create unified payment preference for multiple partners
 */
export const createMultiPartnerOrder = async (
  cartItems: any[],
  customerInfo: any,
  shippingAddress: string,
  shippingCost: number
) => {
  try {
    console.log('Creating multi-partner order...');
    
    // Group items by partner
    const itemsByPartner = cartItems.reduce((acc, item) => {
      const partnerId = item.partnerId;
      if (!acc[partnerId]) {
        acc[partnerId] = [];
      }
      acc[partnerId].push(item);
      return acc;
    }, {});

    const orders = [];
    const paymentPreferences = [];

    // Create order for each partner
    for (const [partnerId, items] of Object.entries(itemsByPartner)) {
      const partnerItems = items as any[];
      const partnerTotal = partnerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Create order in database
      const orderData = {
        partner_id: partnerId,
        customer_id: customerInfo.id,
        items: partnerItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          partner_name: item.partnerName
        })),
        total_amount: partnerTotal + shippingCost,
        shipping_address: shippingAddress,
        status: 'pending',
        payment_method: 'mercadopago'
      };

      // Here you would insert the order into your database
      // const { data: order } = await supabaseClient.from('orders').insert(orderData).select().single();
      
      // For now, create a mock order
      const order = {
        id: `order_${Date.now()}_${partnerId}`,
        ...orderData
      };
      
      orders.push(order);

      // Create payment preference
      const preference = await createPaymentPreference(
        order.id,
        partnerItems,
        customerInfo,
        shippingCost,
        shippingAddress
      );
      
      paymentPreferences.push(preference);
    }

    return { orders, paymentPreferences };
  } catch (error) {
    console.error('Error creating multi-partner order:', error);
    throw error;
  }
};

/**
 * Create payment preference for a single order
 */
export const createPaymentPreference = async (
  orderId: string,
  items: any[],
  customerInfo: any,
  shippingCost: number,
  shippingAddress: string
) => {
  try {
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const preferenceData = {
      items: items.map(item => ({
        id: item.id,
        title: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        currency_id: 'ARS'
      })).concat([{
        id: 'shipping',
        title: 'Envío',
        quantity: 1,
        unit_price: shippingCost,
        currency_id: 'ARS'
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

    // Get marketplace access token
    const accessToken = await getMarketplaceAccessToken();
    
    const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mercado Pago API error:', errorData);
      throw new Error(`Failed to create payment preference: ${errorData.message || response.statusText}`);
    }

    const preference = await response.json();
    console.log('Payment preference created:', preference.id);
    
    return preference;
  } catch (error) {
    console.error('Error creating payment preference:', error);
    throw error;
  }
};

/**
 * Handle OAuth2 callback from Mercado Pago
 */
export const handleOAuth2Callback = async (code: string, state: string) => {
  try {
    // Implementation for OAuth2 callback handling
    console.log('Handling OAuth2 callback:', { code, state });
    
    // This would typically exchange the code for an access token
    // and store it in the partner's configuration
    
    return { success: true };
  } catch (error) {
    console.error('Error handling OAuth2 callback:', error);
    throw error;
  }
};