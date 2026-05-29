import { supabaseClient } from '@/lib/supabase';
import { logger } from '@/utils/datadogLogger';
import { Linking, Platform } from 'react-native';
import { envConfig } from './envConfig';
import { logResourceAction, logError } from '../services/auditService';

/**
 * Mercado Pago OAuth2 Marketplace Implementation
 * This implements the complete OAuth2 flow for marketplace with commission splits
 */

// Mercado Pago OAuth2 Configuration
const MP_BASE_URL = envConfig.getOrDefault('EXPO_PUBLIC_MERCADOPAGO_BASE_URL', 'https://api.mercadopago.com');
const MP_REDIRECT_URI = 'https://dogcatify.com/auth/mercadopago/callback';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
};

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
 * Get the public OAuth client_id used to start Mercado Pago authorization.
 * This can come from runtime env config or a public admin setting.
 */
const getMercadoPagoOAuthClientId = async (): Promise<string> => {
  try {
    const { data, error } = await supabaseClient
      .from('admin_settings')
      .select('value')
      .eq('key', 'mercadopago_config')
      .maybeSingle();

    if (error) throw error;

    const clientId = data?.value?.client_id || data?.value?.clientId || data?.value?.oauth_client_id || data?.value?.app_id;

    if (!clientId) {
      const envClientId = envConfig.getOrDefault('EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID', '').trim();

      if (envClientId) {
        return envClientId;
      }

      throw new Error('Mercado Pago Client ID not configured');
    }

    return String(clientId).trim();
  } catch (error) {
    logger.error('Error getting Mercado Pago OAuth client ID', error as Error);
    throw error;
  }
};

/**
 * Get the legacy admin Mercado Pago configuration.
 * Kept only as a fallback for businesses that still haven't migrated to OAuth.
 */
const getLegacyMercadoPagoConfig = async () => {
  try {
    const { data, error } = await supabaseClient
      .from('admin_settings')
      .select('value')
      .eq('key', 'mercadopago_config')
      .maybeSingle();

    if (error) throw error;

    const value = data?.value || {};

    if (!value?.access_token) {
      throw new Error('Admin Mercado Pago configuration not found');
    }

    return {
      access_token: value.access_token,
      public_key: value.public_key || '',
      is_test_mode: value.is_test_mode || false,
      client_id: value.client_id || value.clientId || value.oauth_client_id || value.app_id || '',
      account_id: value.account_id || '',
      connected_at: value.connected_at || new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting legacy admin MP config', error as Error);
    throw error;
  }
};

/**
 * Generate OAuth2 authorization URL for partner
 */
export const generateOAuth2AuthorizationUrl = async (partnerId: string): Promise<string> => {
  const clientId = await getMercadoPagoOAuthClientId();
  const redirectUri = encodeURIComponent(MP_REDIRECT_URI);

  return `https://auth.mercadopago.com/authorization?client_id=${encodeURIComponent(clientId)}&response_type=code&platform_id=mp&scope=offline_access&redirect_uri=${redirectUri}&state=${encodeURIComponent(partnerId)}`;
};

/**
 * Generate OAuth2 authorization URL with the public client_id
 */
export const generateOAuth2AuthorizationUrlWithConfig = async (partnerId: string): Promise<string> => {
  try {
    const clientId = await getMercadoPagoOAuthClientId();

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      platform_id: 'mp',
      scope: 'offline_access',
      redirect_uri: MP_REDIRECT_URI,
      state: partnerId
    });

    return `https://auth.mercadopago.com/authorization?${params.toString()}`;
  } catch (error) {
    logger.error('Error generating OAuth2 URL', error as Error);
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
    const { data, error } = await supabaseClient.functions.invoke('mercadopago-oauth', {
      body: {
        action: 'exchange',
        code,
        partnerId
      }
    });

    if (error) {
      throw new Error(getErrorMessage(error));
    }

    const tokenData = data?.tokenData || data;

    if (!tokenData?.access_token) {
      throw new Error('Mercado Pago no devolvió credenciales válidas');
    }

    return tokenData;
  } catch (error) {
    logger.error('Error exchanging code for tokens', error as Error);
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

    logger.info('Storing MP tokens for all businesses of user', { userId: partnerData.user_id });

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

    logger.info('MP tokens stored successfully for ALL businesses');
  } catch (error) {
    logger.error('Error storing partner tokens', error as Error);
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
    logger.error('Error getting marketplace access token', error as Error);
    throw error;
  }
};

/**
 * Get partner's Mercado Pago configuration
 * Prefer the partner's OAuth credentials and only fall back to the legacy
 * admin marketplace account when the partner has not migrated yet.
 */
export const getPartnerMercadoPagoConfig = async (partnerId: string) => {
  try {
    logger.debug('Getting MP config for partner', { partnerId });

    const { data: partnerData, error: partnerError } = await supabaseClient
      .from('partners')
      .select('business_name, commission_percentage, iva_rate, iva_included_in_price, mercadopago_config, mercadopago_connected, user_id')
      .eq('id', partnerId)
      .single();

    if (partnerError) throw partnerError;

    const partnerConfig = (partnerData?.mercadopago_config || {}) as any;
    const hasPartnerOAuth = partnerConfig?.is_oauth === true || !!partnerConfig?.refresh_token;

    if (hasPartnerOAuth) {
      let resolvedPartnerConfig = { ...partnerConfig };
      const tokenIsValid = resolvedPartnerConfig.access_token
        ? await validatePartnerToken(resolvedPartnerConfig.access_token)
        : false;

      if (!tokenIsValid) {
        if (!resolvedPartnerConfig.refresh_token) {
          throw new Error('La conexión OAuth de Mercado Pago expiró o necesita ser reautorizada');
        }

        logger.info('Refreshing expired partner OAuth token', { partnerId });

        try {
          await refreshPartnerToken(partnerId);

          const { data: refreshedPartnerData, error: refreshReadError } = await supabaseClient
            .from('partners')
            .select('mercadopago_config')
            .eq('id', partnerId)
            .single();

          if (refreshReadError) throw refreshReadError;

          resolvedPartnerConfig = (refreshedPartnerData?.mercadopago_config || {}) as any;
        } catch (refreshError) {
          logger.error('Error refreshing partner OAuth token before payment', refreshError as Error, { partnerId });
          throw new Error('La conexión OAuth de Mercado Pago expiró o necesita ser reautorizada');
        }
      }

      const returnConfig = {
        access_token: resolvedPartnerConfig.access_token,
        public_key: resolvedPartnerConfig.public_key || '',
        refresh_token: resolvedPartnerConfig.refresh_token,
        user_id: resolvedPartnerConfig.user_id || resolvedPartnerConfig.account_id || partnerData.user_id,
        account_id: resolvedPartnerConfig.account_id || resolvedPartnerConfig.user_id || partnerData.user_id,
        connected_at: resolvedPartnerConfig.connected_at || resolvedPartnerConfig.updated_at || new Date().toISOString(),
        is_oauth: resolvedPartnerConfig.is_oauth !== false,
        is_test_mode: resolvedPartnerConfig.is_test_mode || false,
        commission_percentage: partnerData.commission_percentage || 5.0,
        business_name: partnerData.business_name,
        iva_rate: partnerData.iva_rate != null ? parseFloat(partnerData.iva_rate.toString()) : 22.0,
        iva_included_in_price: partnerData.iva_included_in_price !== false,
        source: 'partner_oauth'
      };

      logger.info('MP config returned from partner OAuth', {
        business_name: returnConfig.business_name,
        access_token_prefix: returnConfig.access_token?.substring(0, 12) + '...',
        public_key_prefix: returnConfig.public_key?.substring(0, 12) + '...',
        is_test_mode: returnConfig.is_test_mode,
        commission_percentage: returnConfig.commission_percentage,
        source: returnConfig.source
      });

      return returnConfig;
    }

    const legacyConfig = await getLegacyMercadoPagoConfig();

    const returnConfig = {
      access_token: legacyConfig.access_token,
      public_key: legacyConfig.public_key,
      is_test_mode: legacyConfig.is_test_mode,
      is_oauth: false,
      connected_at: legacyConfig.connected_at,
      commission_percentage: partnerData.commission_percentage || 5.0,
      business_name: partnerData.business_name,
      iva_rate: partnerData.iva_rate != null ? parseFloat(partnerData.iva_rate.toString()) : 22.0,
      iva_included_in_price: partnerData.iva_included_in_price !== false,
      user_id: legacyConfig.account_id || 'admin',
      account_id: legacyConfig.account_id,
      source: 'legacy_admin'
    };

    logger.info('MP config returned from legacy admin fallback', {
      business_name: returnConfig.business_name,
      access_token_prefix: returnConfig.access_token?.substring(0, 12) + '...',
      public_key_prefix: returnConfig.public_key?.substring(0, 12) + '...',
      is_test_mode: returnConfig.is_test_mode,
      commission_percentage: returnConfig.commission_percentage,
      source: returnConfig.source
    });

    return returnConfig;
  } catch (error) {
    logger.error('Error getting partner MP config', error as Error, { partnerId });
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

    const { data: insertedOrder, error } = await supabaseClient
      .from('orders')
      .insert(orderData)
      .select('id')
      .single();

    if (error || !insertedOrder) {
      logger.error('Error inserting order', error as Error);
      throw error || new Error('Failed to create order');
    }

    return { ...orderData, id: insertedOrder.id };
  } catch (error) {
    logger.error('Error creating order', error as Error);
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
    const marketplaceAccessToken = partnerConfig.access_token || await getMarketplaceAccessToken();

    // Calculate totals including shipping
    const itemsSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalAmount = itemsSubtotal + shippingCost;
    
    logger.info('Creating payment preference', {
      partner_user_id: partnerConfig.user_id,
      commission: commissionAmount,
      partner_amount: partnerAmount,
      shipping_cost: shippingCost,
      total_amount: totalAmount,
      is_oauth: partnerConfig.is_oauth
    });

    const preferenceData: any = {
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
      notification_url: `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      marketplace: 'DogCatiFy',
      statement_descriptor: 'DOGCATIFY'
    };

    // Solo agregar marketplace_fee y collector_id si es configuración OAuth
    if (partnerConfig.is_oauth && partnerConfig.user_id && !isNaN(parseInt(partnerConfig.user_id))) {
      preferenceData.marketplace_fee = commissionAmount;
      preferenceData.collector_id = parseInt(partnerConfig.user_id);
      logger.info('Using OAuth marketplace fee', { collectorId: partnerConfig.user_id });
    } else {
      logger.info('Using manual configuration - no marketplace split');
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
      logger.error('Mercado Pago API error', new Error(JSON.stringify(errorData)), { errorData });
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
    logger.error('Error creating payment preference', error as Error);
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

  // IMPORTANTE:
  // En el carrito de la app, `item.price` ya representa el precio final que paga el cliente.
  // Para evitar duplicar IVA al crear la orden (caso 2600 -> 3172),
  // tratamos SIEMPRE los precios de carrito como IVA incluido.
  const ivaIncluded = true;

  console.log('🔍 calculateIVA - Partner IVA Config:', {
    partner_id: partner.id,
    partner_business_name: partner.business_name,
    iva_rate: ivaRate,
    iva_included_in_price_raw: partner.iva_included_in_price,
    ivaIncluded_computed: ivaIncluded
  });

  // Calculate items subtotal (sum of all items)
  const itemsTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  let subtotal: number;
  let ivaAmount: number;
  let totalAmount: number;

  if (ivaIncluded) {
    // If IVA is included, we need to extract it from the price
    // Formula: subtotal = totalAmount / (1 + (ivaRate / 100))
    totalAmount = Math.round(itemsTotal * 100) / 100;
    subtotal = Math.round((totalAmount / (1 + (ivaRate / 100))) * 100) / 100;
    // Calcular IVA como diferencia para asegurar que cuadre exacto
    ivaAmount = totalAmount - subtotal;
  } else {
    // If IVA is not included, we add it to the price
    // Formula: ivaAmount = subtotal * (ivaRate / 100)
    subtotal = Math.round(itemsTotal * 100) / 100;
    ivaAmount = Math.round((subtotal * (ivaRate / 100)) * 100) / 100;
    // Calcular total como suma para asegurar que cuadre exacto
    totalAmount = subtotal + ivaAmount;
  }

  return {
    subtotal,
    ivaAmount,
    totalAmount,
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
    logger.info('Creating multi-partner order with partner OAuth fees');
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

    console.log('🔍 DEBUG IVA Calculation:', {
      cartItems: cartItems.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, total: i.price * i.quantity })),
      ivaIncluded: ivaCalculation.ivaIncluded,
      ivaRate: ivaCalculation.ivaRate,
      calculatedSubtotal: ivaCalculation.subtotal,
      calculatedIvaAmount: ivaCalculation.ivaAmount,
      calculatedTotalAmount: ivaCalculation.totalAmount,
      shippingCost: totalShippingCost,
      FINAL_totalAmount: totalAmount
    });

    // Calculate commission using partner's configured percentage
    const commissionAmount = totalAmount * ((primaryPartnerConfig.commission_percentage || 5.0) / 100);
    const partnerAmount = totalAmount - commissionAmount;

    console.log('Commission calculation:', {
      commission_percentage: primaryPartnerConfig.commission_percentage || 5.0,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount
    });

    // Add IVA info to each item
    const itemsWithIVA = cartItems.map(item => {
      // Use item's IVA rate if available, otherwise use partner's IVA rate
      const itemIvaRate = (item.iva_rate !== undefined && item.iva_rate !== null) ? item.iva_rate : ivaCalculation.ivaRate;
      const itemPrice = item.price * item.quantity;
      let itemSubtotal: number;
      let itemIVA: number;

      if (ivaCalculation.ivaIncluded) {
        // IVA incluido: extraer del precio
        const itemPriceRounded = Math.round(itemPrice * 100) / 100;
        itemSubtotal = itemIvaRate > 0 ? Math.round((itemPriceRounded / (1 + itemIvaRate / 100)) * 100) / 100 : itemPriceRounded;
        // Calcular IVA como diferencia para que cuadre exacto
        itemIVA = itemPriceRounded - itemSubtotal;
      } else {
        // IVA no incluido: sumar al precio
        itemSubtotal = Math.round(itemPrice * 100) / 100;
        itemIVA = itemIvaRate > 0 ? Math.round((itemSubtotal * (itemIvaRate / 100)) * 100) / 100 : 0;
      }

      return {
        ...item,
        subtotal: itemSubtotal,
        iva_rate: itemIvaRate,
        iva_amount: itemIVA,
        discount_percentage: item.discount_percentage ?? 0,
        original_price: item.original_price ?? item.price,
        currency: item.currency || 'UYU',
        currency_code_dgi: item.currency_code_dgi || '858'
      };
    });

    // Prepare order data
    console.log('🔍 DEBUG Order Data BEFORE saving:', {
      subtotal: ivaCalculation.subtotal,
      iva_amount: ivaCalculation.ivaAmount,
      shipping_cost: totalShippingCost,
      total_amount: totalAmount,
      verification: `${ivaCalculation.subtotal} + ${ivaCalculation.ivaAmount} + ${totalShippingCost} = ${ivaCalculation.subtotal + ivaCalculation.ivaAmount + totalShippingCost}`
    });

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
      shipping_cost: totalShippingCost,
      total_amount: totalAmount,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount,
      shipping_address: shippingAddress,
      payment_method: 'mercadopago',
      payment_status: 'pending',
      status: 'pending',
      order_type: 'product_purchase',
      created_at: new Date().toISOString(),
      partner_breakdown: {
        partners: itemsWithIVA.reduce((acc, item) => {
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
            subtotal: item.subtotal,
            iva_amount: item.iva_amount,
            total: item.price * item.quantity
          });
          // Acumular subtotal SIN IVA para el partner
          acc[item.partnerId].subtotal += item.subtotal;
          return acc;
        }, {}),
        total_partners: [...new Set(itemsWithIVA.map(item => item.partnerId))].length,
        commission_split: commissionAmount,
        shipping_cost: totalShippingCost,
        iva_rate: ivaCalculation.ivaRate,
        iva_amount: ivaCalculation.ivaAmount,
        iva_included: ivaCalculation.ivaIncluded
      }
    };

    // Insert the unified order into database (let PostgreSQL generate the UUID)
    const { data: insertedOrder, error: insertError } = await supabaseClient
      .from('orders')
      .insert([orderData])
      .select('id')
      .single();

    if (insertError || !insertedOrder) {
      console.error('Error creating unified order:', insertError);
      throw insertError || new Error('Failed to create order');
    }

    console.log('Unified order created successfully with ID:', insertedOrder.id);

    // Use the real order ID from database
    const orderIdForPayment = insertedOrder.id;

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
    let preference: any;
    try {
      preference = await createUnifiedPaymentPreference(
        orderIdForPayment,
        cartItems,
        customerInfo,
        primaryPartnerConfig,
        totalAmount,
        totalShippingCost,
        shippingAddress
      );
    } catch (preferenceError) {
      console.error('Error creating payment preference for unified order, rolling back order:', preferenceError);

      const { error: rollbackError } = await supabaseClient
        .from('orders')
        .delete()
        .eq('id', orderIdForPayment);

      if (rollbackError) {
        console.error('Error rolling back unified order after preference failure:', rollbackError);
      }

      throw preferenceError;
    }

    const isTestMode = primaryPartnerConfig.access_token?.startsWith('TEST-');
    const paymentUrl = isTestMode
      ? preference.sandbox_init_point
      : preference.init_point;

    if (isTestMode && !preference.sandbox_init_point) {
      throw new Error('Mercado Pago no devolvió sandbox_init_point en modo prueba');
    }

    const { error: updateOrderError } = await supabaseClient
      .from('orders')
      .update({
        payment_preference_id: preference.id,
        payment_status: 'pending',
        last_payment_url: paymentUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderIdForPayment);

    if (updateOrderError) {
      console.error('Error updating order with payment preference data:', updateOrderError);
      throw updateOrderError;
    }

    console.log('Unified payment preference created:', preference.id);

    const orders = [unifiedOrder];
    const paymentPreferences = [preference];

    console.log('Multi-partner order completed:', {
      isTestMode,
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

    // Detect if we're using test credentials (only by token prefix)
    const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

    // Format phone number (remove non-digits and ensure it's 8 digits)
    const rawPhone = customerInfo.phone || '99999999';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneNumber = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : '99999999';

    // Parse shipping address to extract street and number
    let streetName = '';
    let streetNumber: number | null = null;
    let zipCode = '';

    if (shippingAddress) {
      // Format: "Calle Nombre 123, Localidad, Departamento - CP: 12345 - Tel: 099123456"
      const addressParts = shippingAddress.split(',')[0];
      const zipMatch = shippingAddress.match(/CP:\s*(\d+)/);
      zipCode = zipMatch ? zipMatch[1] : '';

      const streetMatch = addressParts.match(/^(.+?)\s+(\d+)$/);
      if (streetMatch) {
        streetName = streetMatch[1].trim();
        streetNumber = parseInt(streetMatch[2], 10);
      } else {
        streetName = addressParts.trim();
      }
    }

    // Build complete payer object with the same shape used by services
    const payerData: any = {
      name: customerInfo.displayName || 'Cliente',
      email: customerInfo.email,
      phone: {
        area_code: '598',
        number: phoneNumber
      }
    };

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

    const shippingItems = shippingCost > 0
      ? [{
          id: 'shipping',
          title: 'Env�o',
          quantity: 1,
          unit_price: shippingCost,
          currency_id: 'UYU'
        }]
      : [];

    const preferenceData: any = {
      items: [
        ...allItems.map(item => ({
          id: item.id,
          title: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          currency_id: 'UYU'
        })),
        ...shippingItems
      ],
      payer: payerData,
      back_urls: {
        success: `dogcatify://payment/success?order_id=${orderId}&type=order`,
        failure: `dogcatify://payment/failure?order_id=${orderId}&type=order`,
        pending: `dogcatify://payment/pending?order_id=${orderId}&type=order`
      },
      auto_return: 'approved',
      external_reference: orderId,
      notification_url: `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      statement_descriptor: 'DOGCATIFY',
      metadata: {
        order_type: 'product_purchase',
        partner_name: partnerConfig.business_name,
        item_count: allItems.length,
        shipping_cost: shippingCost,
        shipping_address: shippingAddress || null,
        total_amount: totalAmount
      }
    };

    if (!isTestMode && partnerConfig.is_oauth && partnerConfig.user_id && !isNaN(parseInt(String(partnerConfig.user_id), 10))) {
      preferenceData.marketplace_fee = commissionAmount;
      console.log('Using OAuth marketplace fee for product checkout (PRODUCTION)');
    } else {
      if (isTestMode) {
        console.log('Test mode: skipping marketplace_fee to avoid mixed credentials');
      } else {
        console.log('Manual configuration: no marketplace split');
      }
    }

    console.log('Final unified preference data:', {
      items_count: preferenceData.items.length,
      total_amount: totalAmount,
      marketplace_fee: preferenceData.marketplace_fee || 'SKIPPED',
      commission_percentage: partnerConfig.commission_percentage || 5.0,
      partner_receives: totalAmount - commissionAmount,
      external_reference: preferenceData.external_reference,
      isTestMode
    });

    // Use partner's token to create preference (partner receives payment minus marketplace fee)
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
      logger.error('Mercado Pago API error', new Error(JSON.stringify(errorData)), { errorData });
      throw new Error(`Failed to create payment preference: ${errorData.message || response.statusText}`);
    }

    const preference = await response.json();

    console.log('Split payment preference created successfully:', {
      id: preference.id,
      marketplace_fee: commissionAmount,
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

    // PASO 1: VALIDAR MERCADO PAGO ANTES DE CREAR NADA
    console.log('⚠️ STEP 1: Validating Mercado Pago configuration...');
    let partnerConfig;
    try {
      partnerConfig = await getPartnerMercadoPagoConfig(bookingData.partnerId);
      console.log('✅ Partner MP config loaded for:', partnerConfig.business_name);
    } catch (mpError) {
      console.error('❌ MP Configuration Error:', mpError);
      throw new Error(`Configuración de pago inválida: ${getErrorMessage(mpError)}`);
    }

    // PASO 2: VALIDAR ACCESS TOKEN
    console.log('⚠️ STEP 2: Validating access token...');
    if (!partnerConfig.access_token || partnerConfig.access_token.length < 20) {
      throw new Error('Token de acceso de Mercado Pago inválido o no configurado');
    }

    // Test del token haciendo una llamada simple a la API
    try {
      const testResponse = await fetch(`${MP_BASE_URL}/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${partnerConfig.access_token}`
        }
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        console.error('❌ Token validation failed:', errorData);
        throw new Error(`Token de Mercado Pago inválido o vencido (${errorData.message || testResponse.status})`);
      }
      console.log('✅ Access token is valid');
    } catch (tokenError) {
      console.error('❌ Token validation error:', tokenError);
      throw new Error('Token de Mercado Pago inválido o vencido. Por favor, reconfigura la conexión con Mercado Pago.');
    }

    // PASO 3: OBTENER DATOS DEL CLIENTE
    console.log('⚠️ STEP 3: Loading customer profile...');
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

    // PASO 4: OBTENER DETALLES DEL SERVICIO (IVA, moneda)
    console.log('⚠️ STEP 4: Loading service details...');
    const { data: serviceData, error: serviceError } = await supabaseClient
      .from('partner_services')
      .select('iva_rate, currency, currency_code_dgi')
      .eq('id', bookingData.serviceId)
      .single();

    // Get IVA rate: service > partner > 0 (default)
    let ivaRate = 0;
    if (serviceData?.iva_rate != null) {
      ivaRate = serviceData.iva_rate;
      console.log(`✅ Using service iva_rate: ${ivaRate}%`);
    } else if (partnerConfig.iva_rate != null) {
      ivaRate = partnerConfig.iva_rate;
      console.log(`✅ Using partner iva_rate: ${ivaRate}%`);
    } else {
      console.log(`⚠️ No IVA rate configured, using default: ${ivaRate}%`);
    }

    console.log('IVA configuration debug:', {
      service_iva_rate: serviceData?.iva_rate,
      partner_iva_rate: partnerConfig.iva_rate,
      final_iva_rate: ivaRate,
      partner_iva_included: partnerConfig.iva_included_in_price
    });

    // Get IVA included flag: partner config (default true)
    const ivaIncluded = partnerConfig.iva_included_in_price !== false;

    // Calculate IVA
    let subtotal: number;
    let ivaAmount: number;

    if (ivaIncluded) {
      // IVA incluido: extraer del precio total
      subtotal = ivaRate > 0 ? bookingData.totalAmount / (1 + ivaRate / 100) : bookingData.totalAmount;
      ivaAmount = bookingData.totalAmount - subtotal;
    } else {
      // IVA no incluido: agregar al precio
      subtotal = bookingData.totalAmount;
      ivaAmount = ivaRate > 0 ? subtotal * (ivaRate / 100) : 0;
    }

    console.log('IVA calculation:', {
      total: bookingData.totalAmount,
      iva_rate: ivaRate,
      iva_included: ivaIncluded,
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

    // PASO 5: CREAR BOOKING EN LA BASE DE DATOS
    // Solo llegamos aquí si MP está configurado correctamente
    console.log('⚠️ STEP 5: Creating booking record...');
    const bookingRecord = {
      service_id: bookingData.serviceId,
      partner_id: bookingData.partnerId,
      customer_id: bookingData.customerId,
      pet_id: bookingData.petId,
      date: bookingData.date.toISOString(),
      time: bookingData.time,
      status: 'pending_payment',
      payment_status: 'pending',
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
    
    // Create appointment_date at midnight UTC for consistent querying
    const appointmentDate = new Date(bookingData.date);
    appointmentDate.setUTCHours(0, 0, 0, 0);

    console.log('📅 Appointment date (UTC midnight):', appointmentDate.toISOString());
    console.log('⏰ Appointment time:', bookingData.time);

    // Create order record for payment tracking
    const orderData = {
      partner_id: bookingData.partnerId,
      customer_id: bookingData.customerId,
      booking_id: insertedBooking.id,
      service_id: bookingData.serviceId,
      pet_id: bookingData.petId,
      appointment_date: appointmentDate.toISOString(), // ✅ Fecha a medianoche UTC
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
        partnerId: bookingData.partnerId,
        partnerName: bookingData.partnerName,
        partner_name: bookingData.partnerName,
        iva_rate: ivaRate,
        subtotal: subtotal,
        iva_amount: ivaAmount,
        discount_percentage: bookingData.discountPercentage ?? 0,
        discount_amount: Math.max(0, (bookingData.originalPrice ?? bookingData.totalAmount) - bookingData.totalAmount),
        original_price: bookingData.originalPrice ?? bookingData.totalAmount,
        currency: serviceData?.currency || 'UYU',
        currency_code_dgi: serviceData?.currency_code_dgi || '858'
      }],
      subtotal: subtotal,
      iva_rate: ivaRate,
      iva_amount: ivaAmount,
      iva_included_in_price: ivaIncluded,
      total_amount: bookingData.totalAmount,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount,
      payment_method: 'mercadopago',
      payment_status: 'pending',
      payment_status_detail: null,
      payment_id: null,
      payment_data: null,
      status: 'pending',
      order_type: 'service_booking',
      created_at: new Date().toISOString()
    };
    
    console.log('Checking if an order already exists for booking:', insertedBooking.id);
    const { data: existingOrder, error: existingOrderError } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('booking_id', insertedBooking.id)
      .maybeSingle();

    if (existingOrderError) {
      console.error('Error checking existing order:', existingOrderError);
      throw new Error('No se pudo validar la orden existente de la reserva');
    }

    let insertedOrder: any = null;

    if (existingOrder?.id) {
      console.log('Existing order found for booking, updating it:', existingOrder.id);
      const { data: updatedOrder, error: updateOrderError } = await supabaseClient
        .from('orders')
        .update({
          ...orderData,
          payment_status: 'pending',
          payment_status_detail: null,
          payment_id: null,
          payment_data: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingOrder.id)
        .select()
        .single();

      if (updateOrderError || !updatedOrder) {
        console.error('Error updating existing order:', updateOrderError);
        throw new Error('No se pudo actualizar la orden existente de la reserva');
      }

      insertedOrder = updatedOrder;
      console.log('Existing order updated successfully:', insertedOrder.id);
    } else {
      console.log('Creating order record...');
      const { data: createdOrder, error: orderError } = await supabaseClient
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (orderError || !createdOrder) {
        console.error('Error creating order:', orderError);
        throw new Error('No se pudo crear la orden de pago');
      }

      insertedOrder = createdOrder;
      console.log('Order created with ID:', insertedOrder.id);
    }

    // Registrar creación del booking en auditoría
    await logResourceAction('BOOKING_CREATE', 'booking', insertedBooking.id, {
      success: true,
      user_email: completeCustomerInfo.email,
      details: {
        service_name: bookingData.serviceName,
        service_id: bookingData.serviceId,
        partner_name: bookingData.partnerName,
        partner_id: bookingData.partnerId,
        pet_name: bookingData.petName,
        pet_id: bookingData.petId,
        customer_name: completeCustomerInfo.name,
        customer_email: completeCustomerInfo.email,
        date: bookingData.date.toISOString(),
        time: bookingData.time,
        amount: bookingData.totalAmount,
        commission: commissionAmount,
        partner_amount: partnerAmount,
        order_id: insertedOrder.id
      }
    }).catch(err => console.error('Error logging booking audit:', err));

    // PASO 7: CREAR PREFERENCIA DE PAGO EN MERCADO PAGO
    console.log('⚠️ STEP 7: Creating payment preference...');
    let preference;
    try {
      preference = await createServicePaymentPreference(
        insertedOrder.id,
        { ...bookingData, customerInfo: completeCustomerInfo },
        partnerConfig,
        commissionAmount
      );
      console.log('✅ Payment preference created:', preference.id);
    } catch (mpError) {
      console.error('❌ Failed to create MP preference:', mpError);

      // ROLLBACK: Eliminar la orden y booking si falló la preferencia
      console.warn('⚠️ Rolling back order and booking...');
      try {
        await supabaseClient.from('orders').delete().eq('id', insertedOrder.id);
        await supabaseClient.from('bookings').delete().eq('id', insertedBooking.id);
        console.log('✅ Rollback completed');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }

      throw new Error(`Error al crear preferencia de pago: ${getErrorMessage(mpError)}`);
    }
    
    // Update order with payment preference ID
    await supabaseClient
      .from('orders')
      .update({
        payment_preference_id: preference.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', insertedOrder.id);
    
    // Determine if we're using test credentials (only by token prefix)
    const isTestMode = partnerConfig.access_token?.startsWith('TEST-');

    // Get payment URL based on environment
    const paymentUrl = isTestMode ? preference.sandbox_init_point : preference.init_point;

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
    
    // Registrar error en auditoría
    await logError(error, {
      action: 'BOOKING_CREATE',
      resource_type: 'booking',
      details: {
        service_id: bookingData.serviceId,
        partner_id: bookingData.partnerId,
        pet_id: bookingData.petId,
        amount: bookingData.totalAmount,
        platform: Platform.OS
      }
    }).catch(err => console.error('Error logging booking error audit:', err));
    
    return {
      success: false,
      error: getErrorMessage(error)
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
    // Detect if we're using test credentials (only by token prefix)
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
      console.warn('⚠️ TEST MODE DETECTED - Marketplace features (fees, splits) will be DISABLED');
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

    const preferenceData: any = {
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
      notification_url: `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
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
    // 2. NOT in test mode (marketplace_fee doesn't work in test mode with mixed credentials)
    if (!isTestMode && partnerConfig.is_oauth && partnerConfig.user_id && !isNaN(parseInt(partnerConfig.user_id))) {
      preferenceData.marketplace_fee = commissionAmount;
      console.log('Using OAuth marketplace fee for service booking (PRODUCTION)');
    } else {
      if (isTestMode) {
        console.log('Test mode: skipping marketplace_fee to avoid mixed credentials');
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
    const { data, error } = await supabaseClient.functions.invoke('mercadopago-oauth', {
      body: {
        action: 'refresh',
        partnerId
      }
    });

    if (error) {
      throw new Error(getErrorMessage(error));
    }

    const tokenData = data?.tokenData || data;

    if (!tokenData?.access_token) {
      throw new Error('Mercado Pago no devolvió un access_token actualizado');
    }

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
    const marketplaceAccessToken = partnerConfig.access_token || await getMarketplaceAccessToken();

    const paymentRequest: any = {
      transaction_amount: paymentData.transaction_amount,
      description: paymentData.description || 'Compra en DogCatiFy',
      payment_method_id: paymentData.payment_method_id,
      payer: paymentData.payer,
      statement_descriptor: 'DOGCATIFY',
      external_reference: orderId,
      binary_mode: true,
      notification_url: `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/mercadopago-webhook`
    };

    const collectorId = Number.parseInt(String(partnerConfig.user_id || ''), 10);
    if (partnerConfig.is_oauth && !Number.isNaN(collectorId)) {
      paymentRequest.application_fee = commissionAmount; // Commission for marketplace
      paymentRequest.collector_id = collectorId; // Partner's MP user ID
    } else {
      console.log('Manual Mercado Pago configuration detected - skipping marketplace split fields');
    }

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
      .select('mercadopago_config, mercadopago_connected')
      .eq('id', partnerId)
      .single();

    if (error) throw error;

    const config = data?.mercadopago_config;
    const authorizationUrl = await generateOAuth2AuthorizationUrlWithConfig(partnerId)
      .catch(() => generateOAuth2AuthorizationUrl(partnerId));
    
    if (!config?.access_token || !config?.user_id) {
      return {
        isConnected: false,
        needsReauthorization: true,
        authorizationUrl
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
          authorizationUrl
        };
      }
    }

    return {
      isConnected: true,
      needsReauthorization: false
    };
  } catch (error) {
    console.error('Error checking partner OAuth status:', error);
    const authorizationUrl = await generateOAuth2AuthorizationUrlWithConfig(partnerId)
      .catch(() => generateOAuth2AuthorizationUrl(partnerId));
    return {
      isConnected: false,
      needsReauthorization: true,
      authorizationUrl
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
      error: getErrorMessage(error)
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
 * IMPORTANTE: En iOS/Android, el sistema operativo intercepta automáticamente
 * las URLs de Mercado Pago si la app está instalada, por lo que esta función
 * intenta detectar la app pero no es 100% precisa. El comportamiento real
 * depende del sistema operativo.
 */
export const isMercadoPagoAppInstalled = async (): Promise<boolean> => {
  try {
    console.log('🔍 Checking for Mercado Pago app...', { platform: Platform.OS });

    // En web siempre retornamos false
    if (Platform.OS === 'web') {
      console.log('❌ Running on web, app detection not available');
      return false;
    }

    // Deep links para abrir la app de Mercado Pago
    // Nota: En Android, mercadopago:// es el más confiable
    // En iOS, com.mercadopago.wallet:// funciona mejor
    const mpAppSchemes = Platform.OS === 'ios'
      ? ['com.mercadopago.wallet://', 'mercadopago://']
      : ['mercadopago://', 'com.mercadopago.wallet://'];

    // Intentar verificar si alguno de los esquemas está disponible
    for (const scheme of mpAppSchemes) {
      try {
        console.log('   Trying scheme:', scheme);
        const canOpen = await Linking.canOpenURL(scheme);
        console.log('   Result:', canOpen);

        if (canOpen) {
          console.log('✅ Mercado Pago app detected with scheme:', scheme);
          return true;
        }
      } catch (error) {
        console.log('   Error with scheme:', getErrorMessage(error));
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
 * Extract preference ID from Mercado Pago URL
 */
const extractPreferenceId = (url: string): string | null => {
  try {
    const match = url.match(/pref_id=([^&]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Error extracting preference ID:', error);
    return null;
  }
};

/**
 * Open Mercado Pago payment URL intelligently
 *
 * ESTRATEGIA:
 * 1. Intenta abrir con deep link directo a la app (mercadopago://)
 * 2. Si falla, abre la URL web normal
 * 3. El OS decide si abre en app o navegador basado en el dominio
 *
 * IMPORTANTE: URLs de sandbox (sandbox.mercadopago.com.uy) no siempre
 * abren la app, solo las URLs de producción (www.mercadopago.com.uy).
 */
export const openMercadoPagoPayment = async (paymentUrl: string, isTestMode: boolean): Promise<{
  success: boolean;
  openedInApp: boolean;
  error?: string;
}> => {
  try {
    const urlDomain = new URL(paymentUrl).hostname;
    const isSandboxUrl = urlDomain.includes('sandbox');

    console.log('═══════════════════════════════════════');
    console.log('🚀 OPENING MERCADO PAGO PAYMENT');
    console.log('═══════════════════════════════════════');
    console.log('URL:', paymentUrl);
    console.log('Domain:', urlDomain);
    console.log('Is Test Mode:', isTestMode);
    console.log('Is Sandbox URL:', isSandboxUrl);
    console.log('Platform:', Platform.OS);

    // Diagnóstico importante
    if (isSandboxUrl) {
      console.log('⚠️  WARNING: Sandbox URLs may NOT open the app');
      console.log('⚠️  Recommendation: Use production credentials with test cards');
      console.log('⚠️  This will ensure the app opens correctly');
    }

    console.log('');

    // ESTRATEGIA DIFERENTE PARA iOS Y ANDROID:
    //
    // iOS: Intentar abrir la app directamente con Universal Link de MP
    //      Si falla, abrir en Safari
    //
    // Android: Abrir URL web directamente (App Links funciona automáticamente)
    //
    try {
      if (Platform.OS === 'ios') {
        console.log('📱 iOS detected - trying to open MP app first');

        // En iOS, intentamos primero con el Universal Link de Mercado Pago
        // Esto debería abrir la app si está instalada
        let appOpened = false;

        try {
          // Intentar abrir directamente con el URL de pago
          // iOS debería reconocer el dominio mercadopago.com y abrir la app
          console.log('   Attempting to open payment URL:', paymentUrl);

          // En iOS, necesitamos usar una promesa con timeout para detectar
          // si la app se abrió o no
          await Promise.race([
            Linking.openURL(paymentUrl),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 500)
            )
          ]);

          appOpened = true;
          console.log('✅ Payment URL opened on iOS');
        } catch (error) {
          console.log('   Direct open attempt completed (app may or may not have opened)');
          // En iOS, openURL no falla aunque la app no se abra
          // El sistema abre Safari si la app no está instalada
          appOpened = true;
        }

        if (appOpened) {
          console.log('✅ SUCCESS: Payment opened on iOS');
          console.log('   iOS will use MP app if installed, Safari otherwise');
          console.log('═══════════════════════════════════════\n');

          return {
            success: true,
            openedInApp: true // En iOS asumimos que se manejó correctamente
          };
        }

        return {
          success: true,
          openedInApp: true
        };
      } else {
        // ANDROID: El sistema de App Links maneja automáticamente
        console.log('🤖 Android detected - opening URL (App Links will handle)');
        console.log('   URL:', paymentUrl);

        const canOpen = await Linking.canOpenURL(paymentUrl);
        if (!canOpen) {
          console.error('❌ Cannot open URL:', paymentUrl);
          console.log('Attempting to open anyway...');
        }

        await Linking.openURL(paymentUrl);
        console.log('✅ SUCCESS: Payment URL opened on Android');
        console.log('   Android App Links will redirect to app if installed');
        console.log('═══════════════════════════════════════\n');

        return {
          success: true,
          openedInApp: false // El OS decide mediante App Links
        };
      }
    } catch (openError: any) {
      console.error('❌ ERROR in Linking.openURL:', openError);
      console.error('   Error message:', openError.message);
      console.error('   Error name:', openError.name);
      // Re-throw para que sea capturado por el catch externo
      throw openError;
    }

  } catch (error) {
    console.error('❌ ERROR opening Mercado Pago payment:', error);
    console.log('═══════════════════════════════════════\n');

    // Fallback: intentar abrir en navegador web
    try {
      console.log('🔄 FALLBACK: Trying to open web URL...');
      await Linking.openURL(paymentUrl);
      console.log('✅ Fallback successful');
      return { success: true, openedInApp: false };
    } catch (fallbackError) {
      console.error('❌ Fallback failed:', fallbackError);
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
        notification_url: `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
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
    const fullConfig = await getPartnerMercadoPagoConfig(partnerId) as any;

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
        notification_url: `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
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
      error: getErrorMessage(error)
    };
  }
};

