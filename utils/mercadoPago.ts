const MP_BASE_URL = 'https://api.mercadopago.com';

/**
 * Get marketplace access token from admin settings
 */
export const getMarketplaceAccessToken = async (): Promise<string | null> => {
  try {
    const { supabaseClient } = await import('../lib/supabase');
    
    const { data, error } = await supabaseClient
      .from('admin_settings')
      .select('value')
      .eq('key', 'mercadopago_config')
      .single();

    if (error || !data) {
      console.error('Error fetching admin MP config:', error);
      return null;
    }

    const config = data.value as any;
    return config?.access_token || null;
  } catch (error) {
    console.error('Error getting marketplace access token:', error);
    return null;
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
    // Get marketplace (admin) access token for split payments
    const marketplaceAccessToken = await getMarketplaceAccessToken();
    
    if (!marketplaceAccessToken) {
      throw new Error('Admin Mercado Pago no configurado');
    }
    
    // Validate partner configuration
    if (!partnerConfig.user_id || !partnerConfig.access_token) {
      throw new Error('Partner no tiene Mercado Pago configurado correctamente');
    }
    
    console.log('Creating unified payment preference for order:', orderId);
    console.log('Partner config:', {
      user_id: partnerConfig.user_id,
      account_id: partnerConfig.account_id,
      commission_percentage: partnerConfig.commission_percentage || 5.0
    });
    
    const preferenceData = {
      items: allItems.map(item => ({
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
      statement_descriptor: 'DOGCATIFY',
      // Configure automatic split payment
      collector_id: parseInt(partnerConfig.user_id),
      marketplace_fee: totalAmount * ((partnerConfig.commission_percentage || 5.0) / 100)
    };
    
    console.log('Split payment configuration:', {
      collector_id: parseInt(partnerConfig.user_id),
      marketplace_fee: totalAmount * ((partnerConfig.commission_percentage || 5.0) / 100),
      commission_percentage: partnerConfig.commission_percentage || 5.0,
      partner_amount: totalAmount - (totalAmount * ((partnerConfig.commission_percentage || 5.0) / 100))
    });
    
    // Always use marketplace token with automatic split
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
    console.log('Split payment preference created successfully:', {
      id: preference.id,
      collector_id: parseInt(partnerConfig.user_id),
      marketplace_fee: totalAmount * ((partnerConfig.commission_percentage || 5.0) / 100)
    });
    
    return preference;
    
  } catch (error) {
    console.error('Error creating unified payment preference:', error);
    throw error;
  }
};

/**
 * Create multi-partner order with unified payment
 */
export const createMultiPartnerOrder = async (cartItems: any[], customerInfo: any, shippingAddress: string) => {
  try {
    const { supabaseClient } = await import('../lib/supabase');
    
    console.log('Creating multi-partner order with items:', cartItems.length);
    
    // Group items by partner
    const itemsByPartner = cartItems.reduce((acc, item) => {
      const partnerId = item.partnerId;
      if (!acc[partnerId]) {
        acc[partnerId] = [];
      }
      acc[partnerId].push(item);
      return acc;
    }, {});

    console.log('Items grouped by partner:', Object.keys(itemsByPartner).length, 'partners');

    const orders = [];
    const paymentPreferences = [];

    // Create orders for each partner
    for (const [partnerId, items] of Object.entries(itemsByPartner)) {
      const partnerItems = items as any[];
      
      // Get partner configuration
      const { data: partnerData, error: partnerError } = await supabaseClient
        .from('partners')
        .select('*, mercadopago_config, commission_percentage, has_shipping, shipping_cost')
        .eq('id', partnerId)
        .single();

      if (partnerError || !partnerData) {
        throw new Error(`Partner ${partnerId} not found`);
      }

      // Check if partner has Mercado Pago configured
      const mpConfig = partnerData.mercadopago_config;
      if (!mpConfig || !mpConfig.access_token || !mpConfig.user_id) {
        throw new Error(`Partner ${partnerData.business_name} no tiene Mercado Pago configurado`);
      }

      // Calculate totals for this partner
      const subtotal = partnerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const shippingCost = partnerData.has_shipping ? (partnerData.shipping_cost || 0) : 0;
      const totalAmount = subtotal + shippingCost;
      const commissionPercentage = partnerData.commission_percentage || 5.0;
      const commissionAmount = totalAmount * (commissionPercentage / 100);
      const partnerAmount = totalAmount - commissionAmount;

      // Create order in database
      const orderData = {
        partner_id: partnerId,
        customer_id: customerInfo.id,
        items: partnerItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        })),
        total_amount: totalAmount,
        commission_amount: commissionAmount,
        partner_amount: partnerAmount,
        shipping_address: shippingAddress,
        status: 'pending',
        payment_method: 'mercadopago',
        partner_breakdown: {
          subtotal,
          shipping_cost: shippingCost,
          commission_percentage: commissionPercentage,
          commission_amount: commissionAmount,
          partner_amount: partnerAmount
        }
      };

      const { data: orderResult, error: orderError } = await supabaseClient
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (orderError) {
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      orders.push(orderResult);

      // Create payment preference for this order
      const preference = await createUnifiedPaymentPreference(
        orderResult.id,
        partnerItems,
        customerInfo,
        mpConfig,
        totalAmount,
        shippingCost,
        shippingAddress
      );

      paymentPreferences.push({
        orderId: orderResult.id,
        partnerId,
        partnerName: partnerData.business_name,
        preference,
        totalAmount,
        commissionAmount,
        partnerAmount
      });

      // Update order with payment preference ID
      await supabaseClient
        .from('orders')
        .update({ 
          payment_preference_id: preference.id,
          payment_status: 'pending'
        })
        .eq('id', orderResult.id);
    }

    console.log('Orders created:', orders.length);
    console.log('Payment preferences created:', paymentPreferences.length);

    // For now, return the first preference (in a real app, you might want to handle multiple preferences differently)
    if (paymentPreferences.length > 0) {
      const firstPreference = paymentPreferences[0];
      return {
        success: true,
        orders,
        paymentPreferences,
        initPoint: firstPreference.preference.sandbox_init_point || firstPreference.preference.init_point,
        preferenceId: firstPreference.preference.id
      };
    }

    throw new Error('No payment preferences created');

  } catch (error) {
    console.error('Error creating multi-partner order:', error);
    throw error;
  }
};

/**
 * Handle OAuth2 callback from Mercado Pago
 */
export const handleOAuth2Callback = async (code: string, state: string) => {
  try {
    const { supabaseClient } = await import('../lib/supabase');
    
    // Get marketplace access token
    const marketplaceAccessToken = await getMarketplaceAccessToken();
    if (!marketplaceAccessToken) {
      throw new Error('Marketplace access token not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`${MP_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${marketplaceAccessToken}`,
      },
      body: JSON.stringify({
        client_id: process.env.EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID,
        client_secret: process.env.EXPO_PUBLIC_MERCADOPAGO_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.EXPO_PUBLIC_APP_URL}/auth/mercadopago/callback`
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`OAuth token exchange failed: ${errorData.message}`);
    }

    const tokenData = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch(`${MP_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const userData = await userResponse.json();

    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      user_id: userData.id,
      account_id: userData.id,
      email: userData.email,
      nickname: userData.nickname,
      is_oauth: true
    };

  } catch (error) {
    console.error('OAuth2 callback error:', error);
    throw error;
  }
};