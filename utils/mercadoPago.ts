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
      .rpc('get_mercadopago_public_client_id');

    if (error) throw error;

    const clientId = data;

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
      throw new Error('Mercado Pago no devolviÃ³ credenciales vÃ¡lidas');
    }

    return tokenData;
  } catch (error) {
    logger.error('Error exchanging code for tokens', error as Error);
    throw error;
  }
};


/**
 * Create a product-purchase order and its Mercado Pago payment preference.
 * All of this (order creation, IVA/commission calculation, the MP
 * preference itself) now happens server-side (create-order-payment edge
 * function) — the seller partner's access_token never reaches the buyer's
 * client, which is what used to happen here.
 */
export const createMultiPartnerOrder = async (
  cartItems: any[],
  customerInfo: any,
  shippingAddress: string,
  totalShippingCost: number
): Promise<{ orders: any[], paymentPreferences: any[], isTestMode: boolean }> => {
  const { data, error } = await supabaseClient.functions.invoke('create-order-payment', {
    body: {
      action: 'product',
      cartItems,
      customerInfo,
      shippingAddress,
      totalShippingCost,
    },
  });

  if (error || !data?.success) {
    throw new Error(data?.error || getErrorMessage(error) || 'CHECKOUT_FAILED');
  }

  // The edge function already resolved the correct URL server-side (test vs
  // production) — expose it identically under both keys so this wrapper's
  // callers (which pick one based on isTestMode) always get the right URL.
  const isTestMode = Boolean(data.paymentUrl && String(data.paymentUrl).includes('sandbox'));

  return {
    orders: [{ id: data.orderId, customerId: customerInfo.id }],
    paymentPreferences: [{ id: data.orderId, init_point: data.paymentUrl, sandbox_init_point: data.paymentUrl }],
    isTestMode,
  };
};

/**
 * Create service booking order with Mercado Pago payment.
 * The order/booking creation, IVA/commission calculation, and the Mercado
 * Pago preference itself are all created server-side (create-order-payment
 * edge function) — the partner's access_token never reaches this client.
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
    const { data, error } = await supabaseClient.functions.invoke('create-order-payment', {
      body: {
        action: 'service_booking',
        bookingData: {
          ...bookingData,
          date: bookingData.date.toISOString(),
        },
      },
    });

    if (error || !data?.success) {
      throw new Error(data?.error || getErrorMessage(error) || 'CHECKOUT_FAILED');
    }

    await logResourceAction('BOOKING_CREATE', 'booking', data.bookingId, {
      success: true,
      user_email: bookingData.customerInfo?.email,
      details: {
        service_name: bookingData.serviceName,
        service_id: bookingData.serviceId,
        partner_name: bookingData.partnerName,
        partner_id: bookingData.partnerId,
        pet_name: bookingData.petName,
        pet_id: bookingData.petId,
        date: bookingData.date.toISOString(),
        time: bookingData.time,
        amount: bookingData.totalAmount,
        order_id: data.orderId,
      },
    }).catch((err) => console.error('Error logging booking audit:', err));

    return { success: true, paymentUrl: data.paymentUrl, orderId: data.orderId };
  } catch (error) {
    console.error('Error creating service booking order:', error);

    await logError(error, {
      action: 'BOOKING_CREATE',
      resource_type: 'booking',
      details: {
        service_id: bookingData.serviceId,
        partner_id: bookingData.partnerId,
        pet_id: bookingData.petId,
        amount: bookingData.totalAmount,
        platform: Platform.OS,
      },
    }).catch((err) => console.error('Error logging booking error audit:', err));

    return { success: false, error: getErrorMessage(error) };
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

    await supabaseClient
      .from('partner_payment_credentials')
      .delete()
      .eq('user_id', partnerData.user_id);

    // Disconnect ALL partners with the same user_id
    await supabaseClient
      .from('partners')
      .update({
        mercadopago_connected: false,
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
      error: 'Las credenciales deben ser ambas de TEST o ambas de PRODUCCIÃ“N'
    };
  }

  return { isValid: true };
};

/**
 * Check if Mercado Pago app is installed on the device
 * IMPORTANTE: En iOS/Android, el sistema operativo intercepta automÃ¡ticamente
 * las URLs de Mercado Pago si la app estÃ¡ instalada, por lo que esta funciÃ³n
 * intenta detectar la app pero no es 100% precisa. El comportamiento real
 * depende del sistema operativo.
 */
export const isMercadoPagoAppInstalled = async (): Promise<boolean> => {
  try {
    console.log('ðŸ” Checking for Mercado Pago app...', { platform: Platform.OS });

    // En web siempre retornamos false
    if (Platform.OS === 'web') {
      console.log('âŒ Running on web, app detection not available');
      return false;
    }

    // Deep links para abrir la app de Mercado Pago
    // Nota: En Android, mercadopago:// es el mÃ¡s confiable
    // En iOS, com.mercadopago.wallet:// funciona mejor
    const mpAppSchemes = Platform.OS === 'ios'
      ? ['com.mercadopago.wallet://', 'mercadopago://']
      : ['mercadopago://', 'com.mercadopago.wallet://'];

    // Intentar verificar si alguno de los esquemas estÃ¡ disponible
    for (const scheme of mpAppSchemes) {
      try {
        console.log('   Trying scheme:', scheme);
        const canOpen = await Linking.canOpenURL(scheme);
        console.log('   Result:', canOpen);

        if (canOpen) {
          console.log('âœ… Mercado Pago app detected with scheme:', scheme);
          return true;
        }
      } catch (error) {
        console.log('   Error with scheme:', getErrorMessage(error));
        // Continuar con el siguiente esquema
        continue;
      }
    }

    console.log('âŒ Mercado Pago app not installed');
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
 * abren la app, solo las URLs de producciÃ³n (www.mercadopago.com.uy).
 */
export const openMercadoPagoPayment = async (paymentUrl: string, isTestMode: boolean): Promise<{
  success: boolean;
  openedInApp: boolean;
  error?: string;
}> => {
  try {
    const urlDomain = new URL(paymentUrl).hostname;
    const isSandboxUrl = urlDomain.includes('sandbox');

    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('ðŸš€ OPENING MERCADO PAGO PAYMENT');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('URL:', paymentUrl);
    console.log('Domain:', urlDomain);
    console.log('Is Test Mode:', isTestMode);
    console.log('Is Sandbox URL:', isSandboxUrl);
    console.log('Platform:', Platform.OS);

    // DiagnÃ³stico importante
    if (isSandboxUrl) {
      console.log('âš ï¸  WARNING: Sandbox URLs may NOT open the app');
      console.log('âš ï¸  Recommendation: Use production credentials with test cards');
      console.log('âš ï¸  This will ensure the app opens correctly');
    }

    console.log('');

    // ESTRATEGIA DIFERENTE PARA iOS Y ANDROID:
    //
    // iOS: Intentar abrir la app directamente con Universal Link de MP
    //      Si falla, abrir en Safari
    //
    // Android: Abrir URL web directamente (App Links funciona automÃ¡ticamente)
    //
    try {
      if (Platform.OS === 'ios') {
        console.log('ðŸ“± iOS detected - trying to open MP app first');

        // En iOS, intentamos primero con el Universal Link de Mercado Pago
        // Esto deberÃ­a abrir la app si estÃ¡ instalada
        let appOpened = false;

        try {
          // Intentar abrir directamente con el URL de pago
          // iOS deberÃ­a reconocer el dominio mercadopago.com y abrir la app
          console.log('   Attempting to open payment URL:', paymentUrl);

          // En iOS, necesitamos usar una promesa con timeout para detectar
          // si la app se abriÃ³ o no
          await Promise.race([
            Linking.openURL(paymentUrl),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 500)
            )
          ]);

          appOpened = true;
          console.log('âœ… Payment URL opened on iOS');
        } catch (error) {
          console.log('   Direct open attempt completed (app may or may not have opened)');
          // En iOS, openURL no falla aunque la app no se abra
          // El sistema abre Safari si la app no estÃ¡ instalada
          appOpened = true;
        }

        if (appOpened) {
          console.log('âœ… SUCCESS: Payment opened on iOS');
          console.log('   iOS will use MP app if installed, Safari otherwise');
          console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

          return {
            success: true,
            openedInApp: true // En iOS asumimos que se manejÃ³ correctamente
          };
        }

        return {
          success: true,
          openedInApp: true
        };
      } else {
        // ANDROID: El sistema de App Links maneja automÃ¡ticamente
        console.log('ðŸ¤– Android detected - opening URL (App Links will handle)');
        console.log('   URL:', paymentUrl);

        const canOpen = await Linking.canOpenURL(paymentUrl);
        if (!canOpen) {
          console.error('âŒ Cannot open URL:', paymentUrl);
          console.log('Attempting to open anyway...');
        }

        await Linking.openURL(paymentUrl);
        console.log('âœ… SUCCESS: Payment URL opened on Android');
        console.log('   Android App Links will redirect to app if installed');
        console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

        return {
          success: true,
          openedInApp: false // El OS decide mediante App Links
        };
      }
    } catch (openError: any) {
      console.error('âŒ ERROR in Linking.openURL:', openError);
      console.error('   Error message:', openError.message);
      console.error('   Error name:', openError.name);
      // Re-throw para que sea capturado por el catch externo
      throw openError;
    }

  } catch (error) {
    console.error('âŒ ERROR opening Mercado Pago payment:', error);
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

    // Fallback: intentar abrir en navegador web
    try {
      console.log('ðŸ”„ FALLBACK: Trying to open web URL...');
      await Linking.openURL(paymentUrl);
      console.log('âœ… Fallback successful');
      return { success: true, openedInApp: false };
    } catch (fallbackError) {
      console.error('âŒ Fallback failed:', fallbackError);
      return {
        success: false,
        openedInApp: false,
        error: 'No se pudo abrir el enlace de pago'
      };
    }
  }
};

/**
 * Regenerar link de pago para una orden existente. Server-side
 * (create-order-payment edge function) — el token del partner ya no se lee
 * en el cliente. Mismo contrato "soft failure" que antes: nunca lanza,
 * siempre devuelve {success, paymentUrl?, error?}.
 */
export const regeneratePaymentLink = async (orderId: string): Promise<{
  success: boolean;
  paymentUrl?: string;
  error?: string;
}> => {
  try {
    const { data, error } = await supabaseClient.functions.invoke('create-order-payment', {
      body: { action: 'regenerate_link', orderId },
    });

    if (error) {
      return { success: false, error: getErrorMessage(error) };
    }

    return data as { success: boolean; paymentUrl?: string; error?: string };
  } catch (error) {
    console.error('Error regenerating payment link:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};



