import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type InvoiceType = 'views' | 'clicks' | 'both';

const getInvoiceTypeLabel = (invoiceType: InvoiceType) => {
  if (invoiceType === 'views') return 'Solo Vistas';
  if (invoiceType === 'clicks') return 'Solo Clics';
  return 'Vistas y Clics';
};

const getOrderNumber = (promotionId: string) => `PROMO-${promotionId.slice(0, 8).toUpperCase()}`;

const getUniqueBillingOrderId = (promotionId: string, invoiceType: InvoiceType) => {
  const timestamp = Date.now();
  const randomSegment = crypto.randomUUID().slice(0, 8);
  return `PROMO-${promotionId}-${invoiceType}-${timestamp}-${randomSegment}`;
};

const parseJsonSafely = (raw: string) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return { raw };
  }
};

const getEmailAttemptDiagnosticText = (attempt: {
  responseText: string;
  parsedResult: any;
}) => {
  const parsed = attempt.parsedResult || {};

  return [
    parsed?.error,
    parsed?.message,
    parsed?.details,
    parsed?.raw,
    attempt.responseText,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value))
    .join(' | ')
    .toLowerCase();
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const emailApiUrl = Deno.env.get('INVOICE_API_URL') || Deno.env.get('EMAIL_API_URL');
    const emailApiKey = Deno.env.get('INVOICE_API_KEY') || Deno.env.get('EMAIL_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
    }

    if (!emailApiUrl || !emailApiKey) {
      throw new Error('EMAIL_API_URL/INVOICE_API_URL y EMAIL_API_KEY/INVOICE_API_KEY son requeridos');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      promotion,
      invoiceType,
      pricePerView,
      pricePerClick,
      viewsTotal,
      clicksTotal,
      total,
      email,
      partnerInfo,
    } = await req.json();

    if (!promotion?.id || !promotion?.title || !email || !invoiceType) {
      throw new Error('Datos incompletos para generar factura de promoción');
    }

    const wantsViews = invoiceType !== 'clicks';
    const wantsClicks = invoiceType !== 'views';

    const { data: currentPromotion, error: promotionFetchError } = await supabase
      .from('promotions')
      .select('id, views_invoiced, clicks_invoiced')
      .eq('id', promotion.id)
      .maybeSingle();

    if (promotionFetchError) {
      throw new Error(`PROMOTION_STATUS_READ_FAILED: ${promotionFetchError.message}`);
    }

    if (!currentPromotion) {
      throw new Error('PROMOTION_NOT_FOUND: Promoción no encontrada');
    }

    if (wantsViews && currentPromotion.views_invoiced) {
      throw new Error('PROMOTION_ALREADY_INVOICED: Las vistas de esta promoción ya fueron facturadas');
    }

    if (wantsClicks && currentPromotion.clicks_invoiced) {
      throw new Error('PROMOTION_ALREADY_INVOICED: Los clics de esta promoción ya fueron facturados');
    }

    console.log('Generating promotion invoice for:', promotion.id);

    const startDate = new Date(promotion.startDate).toLocaleDateString('es-ES');
    const endDate = new Date(promotion.endDate).toLocaleDateString('es-ES');
    const invoiceTypeLabel = getInvoiceTypeLabel(invoiceType as InvoiceType);
    const baseOrderNumber = getOrderNumber(String(promotion.id));
    const billingOrderId = getUniqueBillingOrderId(String(promotion.id), invoiceType as InvoiceType);
    const billingOrderNumber = `${baseOrderNumber}-${Date.now().toString().slice(-6)}`;
    const partnerName = partnerInfo?.businessName || 'Cliente';
    const totalAmount = Number(total || 0).toFixed(2);

    console.log('Sending promotion payload to accounting edge function...');
    const accountingResponse = await fetch(`${supabaseUrl}/functions/v1/send-promotion-to-accounting`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        promotion,
        invoiceType,
        pricePerView,
        pricePerClick,
        viewsTotal,
        clicksTotal,
        total,
        email,
        partnerInfo,
        billingOrderId,
        billingOrderNumber,
      }),
    });

    const accountingResponseText = await accountingResponse.text();

    if (!accountingResponse.ok) {
      throw new Error(`ACCOUNTING_WEBHOOK_FAILED (${accountingResponse.status}): ${accountingResponseText}`);
    }

    console.log('Accounting webhook delivered successfully, sending promotion email...');
    const isSupabaseFunctionEmailEndpoint = emailApiUrl.includes('/functions/v1/');
    const emailHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': emailApiKey,
      'X-Integration-Key': emailApiKey,
    };

    if (isSupabaseFunctionEmailEndpoint) {
      emailHeaders['Authorization'] = `Bearer ${supabaseServiceKey}`;
      emailHeaders['apikey'] = supabaseServiceKey;
    }

    const sendPromotionEmail = async (payload: Record<string, unknown>) => {
      const response = await fetch(emailApiUrl, {
        method: 'POST',
        headers: emailHeaders,
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      const parsedResult = parseJsonSafely(responseText);

      return {
        ok: response.ok,
        status: response.status,
        responseText,
        parsedResult,
      };
    };

    const baseEmailPayload = {
      template_name: 'promotion_send',
      recipient_email: email,
      order_id: billingOrderId,
      wait_for_invoice: true,
      force_wait_for_invoice: true,
      data: {
        client_name: partnerName,
        order_number: billingOrderNumber,
        periodo: `${startDate} - ${endDate}`,
        perido: `${startDate} - ${endDate}`,
        invoiceType: invoiceTypeLabel,
        payment_status: 'Confirmada',
        total: totalAmount,
      },
    };

    let emailAttempt = await sendPromotionEmail(baseEmailPayload);
    let usedFallbackEmailMode = false;

    if (!emailAttempt.ok) {
      const errorMessage = getEmailAttemptDiagnosticText(emailAttempt);

      const shouldRetryWithoutPendingCommunication =
        errorMessage.includes('pending communication') ||
        errorMessage.includes('failed to create pending communication');

      if (shouldRetryWithoutPendingCommunication) {
        console.warn('Promotion email failed in wait_for_invoice mode, retrying without pending communication...');

        const fallbackPayload = {
          ...baseEmailPayload,
          wait_for_invoice: false,
          force_wait_for_invoice: false,
        };

        emailAttempt = await sendPromotionEmail(fallbackPayload);
        usedFallbackEmailMode = emailAttempt.ok;
      }
    }

    if (!emailAttempt.ok) {
      throw new Error(
        `PROMOTION_EMAIL_FAILED (${emailAttempt.status}): ${
          (emailAttempt.parsedResult as any)?.error ||
          (emailAttempt.parsedResult as any)?.message ||
          emailAttempt.responseText ||
          'unknown error'
        }`
      );
    }

    const invoicedAt = new Date().toISOString();
    const promotionInvoiceUpdate: Record<string, unknown> = {
      updated_at: invoicedAt,
    };

    if (wantsViews) {
      promotionInvoiceUpdate.views_invoiced = true;
      promotionInvoiceUpdate.views_invoiced_at = invoicedAt;
    }

    if (wantsClicks) {
      promotionInvoiceUpdate.clicks_invoiced = true;
      promotionInvoiceUpdate.clicks_invoiced_at = invoicedAt;
    }

    const { error: promotionUpdateError } = await supabase
      .from('promotions')
      .update(promotionInvoiceUpdate)
      .eq('id', promotion.id);

    if (promotionUpdateError) {
      throw new Error(`PROMOTION_STATUS_UPDATE_FAILED: ${promotionUpdateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invoice generated, sent to accounting and emailed successfully',
        orderNumber: billingOrderNumber,
        orderId: billingOrderId,
        accountingStatus: accountingResponse.status,
        emailResult: emailAttempt.parsedResult,
        usedFallbackEmailMode,
        invoiced: {
          views: wantsViews,
          clicks: wantsClicks,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate promotion invoice',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
