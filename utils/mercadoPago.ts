import { supabaseClient } from '@/lib/supabase';

/**
 * Mercado Pago OAuth2 Marketplace Implementation
 * This implements the complete OAuth2 flow for marketplace with commission splits
 */

// Mercado Pago OAuth2 Configuration
const MP_BASE_URL = process.env.EXPO_PUBLIC_MERCADOPAGO_BASE_URL || 'https://api.mercadopago.com';
const MP_REDIRECT_URI = 'https://dogcatify.com/auth/mercadopago/callback';

// Type Definitions
export interface MercadoPagoConfig {
  publicKey: string;
  accessToken: string;
  isTestMode?: boolean;
  isOAuth?: boolean;
  userId?: string;
  refreshToken?: string;
  connectedAt?: string;
}

export interface PaymentData {
  amount: number;
  description: string;
  payerEmail: string;
  payerName: string;
  externalReference: string;
  payerPhone?: string;
}

export interface PaymentResponse {
  id: string;
  status: string;
  detail: string;
  payment_method_id?: string;
  payment_type_id?: string;
  init_point?: string;
  sandbox_init_point?: string;
}

export interface PartnerMercadoPagoConfig {
  access_token: string;
  public_key: string;
  refresh_token?: string;
  user_id?: string;
  account_id?: string;
  connected_at: string;
  is_oauth?: boolean;
  is_test_mode?: boolean;
  commission_percentage?: number;
  business_name?: string;
  iva_rate?: number;
  iva_included_in_price?: boolean;
}

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
 * Updates ALL businesses belonging to the partner's user
 */
const storePartnerTokens = async (partnerId: string, tokenData: any) => {
  try {
    // First, get the user_id from the partner
    const { data: partnerData, error: partnerError } = await supabaseClient
      .from('partners')
      .select('user_id, business_name')
      .eq('id', partnerId)
      .single();

    if (partnerError) throw partnerError;

    console.log('Storing MP tokens for all businesses of user:', partnerData.user_id);

    // Update ALL partners with the same user_id
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
      .eq('user_id', partnerData.user_id);

    if (error) throw error;

    console.log('MP tokens stored successfully for ALL businesses');
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

    const returnConfig = {
      ...data.mercadopago_config,
      commission_percentage: data.commission_percentage || 5.0,
      business_name: data.business_name,
      iva_rate: data.iva_rate || 0,
      iva_included_in_price: data.iva_included_in_price || false,
      // Para configuraciones manuales, usar el partner_id como user_id si no existe
      user_id: data.mercadopago_config.user_id || data.mercadopago_config.account_id || partnerId
    };

    console.log('✅ MP config returned:', {
      business_name: returnConfig.business_name,
      access_token_prefix: returnConfig.access_token?.substring(0, 12) + '...',
      public_key_prefix: returnConfig.public_key?.substring(0, 12) + '...',
      is_test_mode: returnConfig.is_test_mode,
      is_oauth: returnConfig.is_oauth,
      connected_at: returnConfig.connected_at
    });

    return returnConfig;
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
        success: `dogcatify://payment/success?order_id=${orderId}`,
        failure: `dogcatify://payment/failure?order_id=${orderId}`,
        pending: `dogcatify://payment/pending?order_id=${orderId}`
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
/**
 * Calculate IVA for cart items
 */
interface IVACalculation {
  subtotal: number;
  ivaAmount: number;
  totalAmount: number;
  ivaRate: number;
  ivaIncluded: boolean;
}

const calculateIVA = (cartItems: any[], partner: any): IVACalculation => {
  // Get IVA configuration from partner (default 0% if not set)
  const ivaRate = partner.iva_rate || 0;
  const ivaIncluded = partner.iva_included_in_price || false;

  // Calculate items subtotal (sum of all items)
  const itemsTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  let subtotal: number;
  let ivaAmount: number;
  let totalAmount: number;

  if (ivaIncluded) {
    // If IVA is included, we need to extract it from the price
    // Formula: subtotal = totalAmount / (1 + (ivaRate / 100))
    totalAmount = itemsTotal;
    subtotal = totalAmount / (1 + (ivaRate / 100));
    ivaAmount = totalAmount - subtotal;
  } else {
    // If IVA is not included, we add it to the price
    // Formula: ivaAmount = subtotal * (ivaRate / 100)
    subtotal = itemsTotal;
    ivaAmount = subtotal * (ivaRate / 100);
    totalAmount = subtotal + ivaAmount;
  }

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    ivaAmount: Math.round(ivaAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    ivaRate,
    ivaIncluded
  };
};

export const createMultiPartnerOrder = async (
  cartItems: any[],
  customerInfo: any,
  shippingAddress: string,
  totalShippingCost: number
): Promise<{ orders: any[], paymentPreferences: any[], isTestMode: boolean }> => {
  try {
    console.log('Creating multi-partner order with marketplace split...');
    console.log('Cart items received:', cartItems.map(item => ({
      id: item.id,
      name: item.name,
      partnerId: item.partnerId,
      partnerName: item.partnerName
    })));

    // Use the first partner as the primary partner for the unified order
    const primaryPartnerId = cartItems[0].partnerId;

    // Get primary partner's configuration including commission percentage and IVA
    const primaryPartnerConfig = await getPartnerMercadoPagoConfig(primaryPartnerId);

    // Calculate IVA for the order
    const ivaCalculation = calculateIVA(cartItems, primaryPartnerConfig);

    // Calculate totals for the unified order (including shipping)
    const totalAmount = ivaCalculation.totalAmount + totalShippingCost;

    console.log('Unified order totals:', {
      subtotal: ivaCalculation.subtotal,
      ivaRate: ivaCalculation.ivaRate,
      ivaAmount: ivaCalculation.ivaAmount,
      itemsTotal: ivaCalculation.totalAmount,
      shippingCost: totalShippingCost,
      totalAmount
    });

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

    // Add IVA info to each item
    const itemsWithIVA = cartItems.map(item => {
      // Use item's IVA rate if available, otherwise use partner's IVA rate
      const itemIvaRate = (item.iva_rate !== undefined && item.iva_rate !== null) ? item.iva_rate : ivaCalculation.ivaRate;
      const itemPrice = item.price * item.quantity;
      let itemSubtotal: number;
      let itemIVA: number;

      if (ivaCalculation.ivaIncluded) {
        // IVA incluido: extraer del precio
        itemSubtotal = itemIvaRate > 0 ? itemPrice / (1 + itemIvaRate / 100) : itemPrice;
        itemIVA = itemPrice - itemSubtotal;
      } else {
        // IVA no incluido: sumar al precio
        itemSubtotal = itemPrice;
        itemIVA = itemIvaRate > 0 ? itemSubtotal * (itemIvaRate / 100) : 0;
      }

      return {
        ...item,
        subtotal: Math.round(itemSubtotal * 100) / 100,
        iva_rate: itemIvaRate,
        iva_amount: Math.round(itemIVA * 100) / 100,
        discount_percentage: item.discount_percentage ?? 0,
        original_price: item.original_price ?? item.price,
        currency: item.currency || 'UYU',
        currency_code_dgi: item.currency_code_dgi || '858'
      };
    });

    // Prepare order data
    const orderData = {
      partner_id: primaryPartnerId,
      customer_id: customerInfo.id,
      partner_name: primaryPartnerConfig.business_name,
      customer_name: customerInfo.displayName || 'Usuario',
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone || null,
      items: itemsWithIVA,
      subtotal: ivaCalculation.subtotal,
      iva_rate: ivaCalculation.ivaRate,
      iva_amount: ivaCalculation.ivaAmount,
      iva_included_in_price: ivaCalculation.ivaIncluded,
      total_amount: totalAmount,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount,
      shipping_address: shippingAddress,
      payment_method: 'mercadopago',
      status: 'pending',
      order_type: 'product_purchase',
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
        shipping_cost: totalShippingCost,
        iva_rate: ivaCalculation.ivaRate,
        iva_amount: ivaCalculation.ivaAmount,
        iva_included: ivaCalculation.ivaIncluded
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

    // Detect if we're in test mode
    // Check both the TEST- prefix AND the explicit is_test_mode flag
    const isTestMode = primaryPartnerConfig.access_token?.startsWith('TEST-') ||
                       primaryPartnerConfig.is_test_mode === true ||
                       primaryPartnerConfig.is_test_mode === 'true';

    console.log('Multi-partner order completed:', {
      isTestMode,
      detectedBy: primaryPartnerConfig.access_token?.startsWith('TEST-') ? 'TEST- prefix' :
                  primaryPartnerConfig.is_test_mode ? 'is_test_mode flag' : 'none (production)',
      ordersCount: orders.length,
      preferencesCount: paymentPreferences.length
    });

    return { orders, paymentPreferences, isTestMode };
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

    // Format phone number (remove non-digits and ensure it's 8 digits)
    const rawPhone = customerInfo.phone || '99999999';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneNumber = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : '99999999';

    // Parse shipping address to extract street and number
    let streetName = '';
    let streetNumber = null;
    let zipCode = '';

    if (shippingAddress) {
      // Format: "Calle Nombre 123, Localidad, Departamento - CP: 12345 - Tel: 099123456"
      const addressParts = shippingAddress.split(',')[0]; // Get "Calle Nombre 123"
      const zipMatch = shippingAddress.match(/CP:\s*(\d+)/);
      zipCode = zipMatch ? zipMatch[1] : '';

      // Try to extract street and number
      const streetMatch = addressParts.match(/^(.+?)\s+(\d+)$/);
      if (streetMatch) {
        streetName = streetMatch[1].trim();
        streetNumber = parseInt(streetMatch[2]);
      } else {
        streetName = addressParts.trim();
      }
    }

    // Build complete payer object with all available data
    const payerData: any = {
      name: customerInfo.displayName || 'Cliente',
      email: customerInfo.email,
      phone: {
        area_code: '598',
        number: phoneNumber
      }
    };

    // Add address if available
    if (streetName) {
      payerData.address = {
        street_name: streetName,
        street_number: streetNumber,
        zip_code: zipCode
      };
    }

    console.log('Products payer data prepared:', {
      hasName: !!payerData.name,
      hasEmail: !!payerData.email,
      hasPhone: !!payerData.phone.number,
      hasAddress: !!payerData.address,
      phoneNumber: payerData.phone.number,
      streetName: streetName || 'N/A'
    });

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
      payer: payerData,
      back_urls: {
        success: `dogcatify://payment/success?order_id=${orderId}`,
        failure: `dogcatify://payment/failure?order_id=${orderId}`,
        pending: `dogcatify://payment/pending?order_id=${orderId}`
      },
      auto_return: 'approved',
      external_reference: orderId,
      notification_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      statement_descriptor: 'DOGCATIFY'
    };

    // Detect if we're using test credentials
    // Check both the TEST- prefix AND the explicit is_test_mode flag
    // Note: Test accounts in MP use "production" credentials but are still sandbox
    const isTestMode = partnerConfig.access_token?.startsWith('TEST-') ||
                       partnerConfig.is_test_mode === true ||
                       partnerConfig.is_test_mode === 'true';

    // Add application fee ONLY in production mode
    // In test mode, we skip it to avoid "mixed credentials" error
    if (!isTestMode) {
      preferenceData.application_fee = commissionAmount;
    }

    console.log('Final unified preference data:', {
      items_count: preferenceData.items.length,
      total_amount: totalAmount,
      application_fee: isTestMode ? 'SKIPPED (test mode)' : commissionAmount,
      commission_percentage: partnerConfig.commission_percentage || 5.0,
      partner_receives: totalAmount - commissionAmount,
      external_reference: preferenceData.external_reference,
      isTestMode,
      detectedBy: partnerConfig.access_token?.startsWith('TEST-') ? 'TEST- prefix' :
                  partnerConfig.is_test_mode ? 'is_test_mode flag' : 'none (production)'
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
      commission_percentage: partnerConfig.commission_percentage || 5.0,
      isTestMode,
      hasInitPoint: !!preference.init_point,
      hasSandboxInitPoint: !!preference.sandbox_init_point
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
  discountPercentage?: number;
  originalPrice?: number;
}): Promise<{ success: boolean; paymentUrl?: string; orderId?: string; error?: string }> => {
  try {
    console.log('Creating service booking order...');
    console.log('Booking data:', bookingData);

    // Get complete customer profile data from database
    const { data: customerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('display_name, email, phone, calle, numero, address_locality, barrio, codigo_postal')
      .eq('id', bookingData.customerId)
      .single();

    if (profileError) {
      console.warn('Could not load customer profile, using provided data:', profileError);
    }

    // Merge customer data
    const completeCustomerInfo = {
      ...bookingData.customerInfo,
      displayName: customerProfile?.display_name || bookingData.customerInfo.displayName || 'Cliente',
      email: customerProfile?.email || bookingData.customerInfo.email,
      phone: customerProfile?.phone || bookingData.customerInfo.phone,
      street: customerProfile?.calle,
      number: customerProfile?.numero,
      locality: customerProfile?.address_locality,
      neighborhood: customerProfile?.barrio,
      zipCode: customerProfile?.codigo_postal
    };

    console.log('Complete customer info prepared:', {
      hasName: !!completeCustomerInfo.displayName,
      hasEmail: !!completeCustomerInfo.email,
      hasPhone: !!completeCustomerInfo.phone,
      hasAddress: !!(completeCustomerInfo.street && completeCustomerInfo.number)
    });

    // Get partner's Mercado Pago configuration
    const partnerConfig = await getPartnerMercadoPagoConfig(bookingData.partnerId);
    console.log('Partner MP config loaded for:', partnerConfig.business_name);

    // Get service details to obtain IVA rate and currency
    const { data: serviceData, error: serviceError } = await supabaseClient
      .from('partner_services')
      .select('iva_rate, currency, currency_code_dgi')
      .eq('id', bookingData.serviceId)
      .single();

    // Get IVA rate: service > partner > 0 (default)
    let ivaRate = 0;
    if (serviceData?.iva_rate != null) {
      ivaRate = serviceData.iva_rate;
    } else if (partnerConfig.iva_rate != null) {
      ivaRate = partnerConfig.iva_rate;
    }

    // Calculate IVA (included in price)
    const subtotal = ivaRate > 0 ? bookingData.totalAmount / (1 + ivaRate / 100) : bookingData.totalAmount;
    const ivaAmount = bookingData.totalAmount - subtotal;

    console.log('IVA calculation:', {
      total: bookingData.totalAmount,
      iva_rate: ivaRate,
      subtotal: subtotal.toFixed(2),
      iva_amount: ivaAmount.toFixed(2)
    });
    
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
      service_id: bookingData.serviceId,
      pet_id: bookingData.petId,
      appointment_date: bookingData.date.toISOString(),
      appointment_time: bookingData.time,
      booking_notes: bookingData.notes,
      partner_name: bookingData.partnerName,
      service_name: bookingData.serviceName,
      pet_name: bookingData.petName,
      customer_name: completeCustomerInfo.displayName || 'Usuario',
      customer_email: completeCustomerInfo.email,
      customer_phone: completeCustomerInfo.phone || null,
      items: [{
        id: bookingData.serviceId,
        name: bookingData.serviceName,
        price: bookingData.totalAmount,
        quantity: 1,
        type: 'service',
        partner_name: bookingData.partnerName,
        iva_rate: ivaRate,
        subtotal: subtotal,
        iva_amount: ivaAmount,
        discount_percentage: bookingData.discountPercentage ?? 0,
        original_price: bookingData.originalPrice ?? bookingData.totalAmount,
        currency: serviceData?.currency || 'UYU',
        currency_code_dgi: serviceData?.currency_code_dgi || '858'
      }],
      subtotal: subtotal,
      iva_rate: ivaRate,
      iva_amount: ivaAmount,
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
    
    // Create Mercado Pago payment preference with complete customer info
    const preference = await createServicePaymentPreference(
      insertedOrder.id,
      { ...bookingData, customerInfo: completeCustomerInfo },
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
    
    // Determine if we're using test credentials
    const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

    // Get payment URL based on environment
    const paymentUrl = isTestMode ? preference.sandbox_init_point : preference.init_point;

    if (!paymentUrl) {
      throw new Error('No se pudo obtener la URL de pago');
    }

    console.log('Payment URL selected:', {
      isTestMode,
      urlType: isTestMode ? 'sandbox_init_point' : 'init_point',
      url: paymentUrl
    });
    
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
    // Detect if we're using test credentials
    const isTestMode = partnerConfig.access_token?.startsWith('TEST-');
    const tokenPrefix = partnerConfig.access_token?.substring(0, 20) || 'N/A';

    console.log('Creating service payment preference:', {
      orderId,
      isTestMode,
      tokenPrefix: tokenPrefix + '...',
      commissionAmount,
      willSkipApplicationFee: isTestMode
    });

    // CRITICAL: In TEST mode, Mercado Pago does NOT support marketplace features
    if (isTestMode) {
      console.warn('⚠️ TEST MODE DETECTED - Marketplace features (application_fee, splits) will be DISABLED');
    }

    // Format phone number (remove non-digits and ensure it's 8 digits)
    const rawPhone = bookingData.customerInfo.phone || '99999999';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneNumber = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : '99999999';

    // Build complete payer object with all available data
    const payerData: any = {
      name: bookingData.customerInfo.displayName || 'Cliente',
      email: bookingData.customerInfo.email,
      phone: {
        area_code: '598',
        number: phoneNumber
      }
    };

    // Add address if available
    if (bookingData.customerInfo.street && bookingData.customerInfo.number) {
      payerData.address = {
        street_name: bookingData.customerInfo.street,
        street_number: parseInt(bookingData.customerInfo.number) || null,
        zip_code: bookingData.customerInfo.zipCode || ''
      };
    }

    console.log('Payer data prepared:', {
      hasName: !!payerData.name,
      hasEmail: !!payerData.email,
      hasPhone: !!payerData.phone.number,
      hasAddress: !!payerData.address,
      phoneNumber: payerData.phone.number
    });

    const preferenceData = {
      items: [{
        id: bookingData.serviceId,
        title: bookingData.serviceName,
        quantity: 1,
        unit_price: bookingData.totalAmount,
        currency_id: 'UYU'
      }],
      payer: payerData,
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
    
    // Add marketplace fee ONLY if:
    // 1. Partner has OAuth configuration
    // 2. NOT in test mode (application_fee doesn't work in test mode with mixed credentials)
    if (!isTestMode && partnerConfig.is_oauth && partnerConfig.user_id && !isNaN(parseInt(partnerConfig.user_id))) {
      preferenceData.application_fee = commissionAmount;
      console.log('Using OAuth marketplace split for service booking (PRODUCTION)');
    } else {
      if (isTestMode) {
        console.log('Test mode: skipping application_fee to avoid mixed credentials');
      } else {
        console.log('Manual configuration: no marketplace split');
      }
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

    console.log('Service payment preference created successfully:', {
      preferenceId: preference.id,
      isTestMode,
      hasInitPoint: !!preference.init_point,
      hasSandboxInitPoint: !!preference.sandbox_init_point,
      initPointDomain: preference.init_point ? new URL(preference.init_point).hostname : 'N/A',
      sandboxInitPointDomain: preference.sandbox_init_point ? new URL(preference.sandbox_init_point).hostname : 'N/A',
      shouldUseUrl: isTestMode ? 'sandbox_init_point' : 'init_point'
    });

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
 * Disconnects ALL businesses belonging to the partner's user
 */
export const disconnectPartnerMercadoPago = async (partnerId: string): Promise<void> => {
  try {
    // First, get the user_id from the partner
    const { data: partnerData, error: partnerError } = await supabaseClient
      .from('partners')
      .select('user_id')
      .eq('id', partnerId)
      .single();

    if (partnerError) throw partnerError;

    console.log('Disconnecting MP for all businesses of user:', partnerData.user_id);

    // Disconnect ALL partners with the same user_id
    await supabaseClient
      .from('partners')
      .update({
        mercadopago_connected: false,
        mercadopago_config: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', partnerData.user_id);

    console.log(`All businesses disconnected from Mercado Pago for user ${partnerData.user_id}`);
  } catch (error) {
    console.error('Error disconnecting partner from Mercado Pago:', error);
    throw error;
  }
};

/**
 * Detect if we're in test/sandbox environment
 */
export const isTestEnvironment = (accessToken: string): boolean => {
  return accessToken.startsWith('TEST-') ||
         accessToken.includes('TEST') ||
         accessToken.includes('test');
};

/**
 * Get correct payment URL based on environment
 */
export const getPaymentUrl = (preference: any, accessToken: string): string => {
  const isTest = isTestEnvironment(accessToken);
  return isTest ? preference.sandbox_init_point : preference.init_point;
};

/**
 * Validate Mercado Pago credentials format
 */
export const validateCredentialsFormat = (accessToken: string, publicKey: string): {
  isValid: boolean;
  error?: string;
} => {
  const isValidToken = accessToken.startsWith('APP_USR-') || accessToken.startsWith('TEST-');
  const isValidKey = publicKey.startsWith('APP_USR-') || publicKey.startsWith('TEST-');

  if (!isValidToken) {
    return {
      isValid: false,
      error: 'El Access Token debe comenzar con APP_USR- o TEST-'
    };
  }

  if (!isValidKey) {
    return {
      isValid: false,
      error: 'La Public Key debe comenzar con APP_USR- o TEST-'
    };
  }

  // Check if both are test or both are production
  const tokenIsTest = accessToken.startsWith('TEST-');
  const keyIsTest = publicKey.startsWith('TEST-');

  if (tokenIsTest !== keyIsTest) {
    return {
      isValid: false,
      error: 'Las credenciales deben ser ambas de TEST o ambas de PRODUCCIÓN'
    };
  }

  return { isValid: true };
};

/**
 * Check if Mercado Pago app is installed on the device
 */
export const isMercadoPagoAppInstalled = async (): Promise<boolean> => {
  try {
    const { Linking, Platform } = await import('react-native');

    // Deep links para abrir la app de Mercado Pago
    const mpAppSchemes = [
      'mercadopago://',
      'com.mercadopago.wallet://'
    ];

    // Intentar verificar si alguno de los esquemas está disponible
    for (const scheme of mpAppSchemes) {
      try {
        const canOpen = await Linking.canOpenURL(scheme);
        if (canOpen) {
          console.log('✅ Mercado Pago app detected with scheme:', scheme);
          return true;
        }
      } catch (error) {
        // Continuar con el siguiente esquema
        continue;
      }
    }

    console.log('❌ Mercado Pago app not installed');
    return false;
  } catch (error) {
    console.error('Error checking Mercado Pago app:', error);
    return false;
  }
};

/**
 * Open Mercado Pago payment URL intelligently
 * - Check if Mercado Pago app is installed
 * - If installed, open in app
 * - If not installed, open in web browser
 */
export const openMercadoPagoPayment = async (paymentUrl: string, isTestMode: boolean): Promise<{
  success: boolean;
  openedInApp: boolean;
  error?: string;
}> => {
  try {
    const { Linking, Platform } = await import('react-native');

    console.log('Opening Mercado Pago payment:', {
      isTestMode,
      urlLength: paymentUrl.length,
      urlDomain: new URL(paymentUrl).hostname,
      platform: Platform.OS
    });

    // Verificar si la app de Mercado Pago está instalada
    const hasApp = await isMercadoPagoAppInstalled();

    console.log('Mercado Pago app status:', {
      installed: hasApp,
      willOpenIn: hasApp ? 'app' : 'browser'
    });

    // La app de Mercado Pago intercepta automáticamente las URLs de checkout
    // Si el usuario tiene la app instalada, se abrirá la app
    // Si no, se abrirá en el navegador
    console.log('Opening Mercado Pago URL...');

    const canOpen = await Linking.canOpenURL(paymentUrl);

    if (!canOpen) {
      console.error('Cannot open URL:', paymentUrl);
      throw new Error('No se puede abrir la URL de pago');
    }

    await Linking.openURL(paymentUrl);

    // En Android/iOS, si la app está instalada se abrirá automáticamente
    console.log('✅ Mercado Pago URL opened successfully');
    return {
      success: true,
      openedInApp: hasApp
    };

  } catch (error) {
    console.error('Error opening Mercado Pago payment:', error);

    // Fallback: try to open web URL
    try {
      const { Linking } = await import('react-native');
      console.log('Fallback: opening web URL');
      await Linking.openURL(paymentUrl);
      return { success: true, openedInApp: false };
    } catch (fallbackError) {
      console.error('Failed to open payment URL:', fallbackError);
      return {
        success: false,
        openedInApp: false,
        error: 'No se pudo abrir el enlace de pago'
      };
    }
  }
};

/**
 * Create simple payment preference (simplified version for quick integration)
 */
export const createSimplePaymentPreference = async (
  accessToken: string,
  paymentData: PaymentData
): Promise<PaymentResponse> => {
  try {
    const isTest = isTestEnvironment(accessToken);

    console.log('Creating payment preference:', {
      amount: paymentData.amount,
      description: paymentData.description,
      isTestMode: isTest
    });

    const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        items: [
          {
            title: paymentData.description,
            unit_price: Number(paymentData.amount),
            quantity: 1,
            currency_id: 'UYU'
          }
        ],
        payer: {
          email: paymentData.payerEmail,
          name: paymentData.payerName,
          ...(paymentData.payerPhone && {
            phone: {
              area_code: '598',
              number: paymentData.payerPhone.replace(/\D/g, '').slice(-8)
            }
          })
        },
        external_reference: paymentData.externalReference,
        back_urls: {
          success: `dogcatify://payment/success?external_reference=${paymentData.externalReference}`,
          failure: `dogcatify://payment/failure?external_reference=${paymentData.externalReference}`,
          pending: `dogcatify://payment/pending?external_reference=${paymentData.externalReference}`
        },
        auto_return: 'approved',
        notification_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mercadopago-webhook`,
        statement_descriptor: 'DOGCATIFY',
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12
        },
        binary_mode: false,
        expires: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('MercadoPago API Error:', errorData);
      throw new Error(`Error ${response.status}: ${errorData.message || 'Error al crear preferencia de pago'}`);
    }

    const preference = await response.json();

    console.log('Payment preference created:', {
      id: preference.id,
      hasInitPoint: !!preference.init_point,
      hasSandboxInitPoint: !!preference.sandbox_init_point
    });

    return {
      id: preference.id,
      status: 'pending',
      detail: 'Preference created successfully',
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point
    };
  } catch (error) {
    console.error('Error creating simple payment preference:', error);
    throw error;
  }
};

/**
 * Get partner's Mercado Pago config in simple format
 */
export const getPartnerMercadoPagoSimpleConfig = async (
  partnerId: string
): Promise<MercadoPagoConfig> => {
  try {
    const fullConfig = await getPartnerMercadoPagoConfig(partnerId);

    return {
      publicKey: fullConfig.public_key,
      accessToken: fullConfig.access_token,
      isTestMode: fullConfig.is_test_mode,
      isOAuth: fullConfig.is_oauth,
      userId: fullConfig.user_id,
      refreshToken: fullConfig.refresh_token,
      connectedAt: fullConfig.connected_at
    };
  } catch (error) {
    console.error('Error getting partner MP simple config:', error);
    throw error;
  }
};

/**
 * Regenerar link de pago para una orden existente
 * Útil cuando el link ha expirado o el pago falló
 */
export const regeneratePaymentLink = async (orderId: string): Promise<{
  success: boolean;
  paymentUrl?: string;
  error?: string;
}> => {
  try {
    console.log('Regenerating payment link for order:', orderId);

    // 1. Obtener la orden existente
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return {
        success: false,
        error: 'Orden no encontrada'
      };
    }

    // 2. Verificar que la orden esté en estado pending o payment_failed
    if (!['pending', 'payment_failed'].includes(order.status)) {
      return {
        success: false,
        error: 'Esta orden ya no puede ser pagada'
      };
    }

    // 3. Obtener configuración de Mercado Pago del partner
    const { data: partner, error: partnerError } = await supabaseClient
      .from('partners')
      .select('mercadopago_config')
      .eq('id', order.partner_id)
      .single();

    if (partnerError || !partner?.mercadopago_config) {
      console.error('Partner MP config not found:', partnerError);
      return {
        success: false,
        error: 'Configuración de pago no encontrada'
      };
    }

    const partnerConfig = partner.mercadopago_config;
    const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

    console.log('Creating new payment preference...');

    // 4. Crear nueva preferencia de pago basada en el tipo de orden
    let paymentUrl: string;

    if (order.order_type === 'service_booking') {
      // Para reservas de servicios
      const preferenceData = {
        items: [{
          id: order.service_id || 'service',
          title: order.service_name || 'Servicio',
          quantity: 1,
          unit_price: Number(order.total_amount),
          currency_id: 'UYU'
        }],
        payer: {
          name: order.customer_name || 'Cliente',
          email: order.customer_email,
          phone: {
            area_code: '598',
            number: order.customer_phone?.replace(/\D/g, '').slice(-8) || '99999999'
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
        statement_descriptor: 'DOGCATIFY'
      };

      const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${partnerConfig.access_token}`
        },
        body: JSON.stringify(preferenceData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('MP API error:', errorData);
        throw new Error('Error al crear preferencia de pago');
      }

      const preference = await response.json();
      paymentUrl = isTestMode ? preference.sandbox_init_point : preference.init_point;

      // Actualizar orden con nueva preferencia
      await supabaseClient
        .from('orders')
        .update({
          payment_preference_id: preference.id,
          last_payment_url: paymentUrl,
          payment_link_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
          payment_retry_count: (order.payment_retry_count || 0) + 1,
          status: 'pending', // Volver a pending
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

    } else {
      // Para compras de productos
      return {
        success: false,
        error: 'Regeneración de link para productos no implementada aún'
      };
    }

    console.log('Payment link regenerated successfully:', {
      orderId,
      paymentUrl: paymentUrl.substring(0, 50) + '...'
    });

    return {
      success: true,
      paymentUrl
    };

  } catch (error) {
    console.error('Error regenerating payment link:', error);
    return {
      success: false,
      error: error.message || 'Error al regenerar link de pago'
    };
  }
};
