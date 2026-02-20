import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type InvoiceType = 'views' | 'clicks' | 'both';

const toFixedNumber = (value: number, decimals = 2) => Number((value || 0).toFixed(decimals));
const getOrderNumber = (promotionId: string) => `PROMO-${promotionId.slice(0, 8).toUpperCase()}`;

const getDefaultBillingOrderId = (promotionId: string, invoiceType: InvoiceType) => {
  const timestamp = Date.now();
  const randomSegment = crypto.randomUUID().slice(0, 8);
  return `PROMO-${promotionId}-${invoiceType}-${timestamp}-${randomSegment}`;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const accountingWebhookUrl = Deno.env.get('ACCOUNTING_WEBHOOK_URL');
    const promotionAccountingWebhookUrl = Deno.env.get('ACCOUNTING_PROMOTION_WEBHOOK_URL');
    const accountingApiKey = Deno.env.get('ACCOUNTING_API_KEY');
    const empresaId = Deno.env.get('ACCOUNTING_EMPRESA_ID');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!accountingApiKey || !empresaId) {
      throw new Error('ACCOUNTING_API_KEY y ACCOUNTING_EMPRESA_ID son requeridos');
    }

    const isInternalOrdersFunction = Boolean(
      accountingWebhookUrl?.includes('/functions/v1/send-order-to-accounting')
    );

    let targetAccountingUrl = promotionAccountingWebhookUrl || null;

    if (!targetAccountingUrl && accountingWebhookUrl && !isInternalOrdersFunction) {
      targetAccountingUrl = accountingWebhookUrl;
    }

    if (!targetAccountingUrl) {
      if (isInternalOrdersFunction) {
        throw new Error(
          'CONFIG_ERROR: ACCOUNTING_WEBHOOK_URL apunta a send-order-to-accounting. Para promociones configura ACCOUNTING_PROMOTION_WEBHOOK_URL con el endpoint contable externo.'
        );
      }

      throw new Error(
        'CONFIG_ERROR: Debes configurar ACCOUNTING_PROMOTION_WEBHOOK_URL o ACCOUNTING_WEBHOOK_URL con el endpoint contable externo.'
      );
    }

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
      billingOrderId,
      billingOrderNumber,
    } = await req.json();

    if (!promotion?.id || !promotion?.title || !email || !invoiceType) {
      throw new Error('Datos incompletos para enviar promoción a contabilidad');
    }

    const nowIso = new Date().toISOString();
    const partnerName = partnerInfo?.businessName || 'Cliente';
    const partnerId = promotion.partnerId || 'promotion-partner';
    const resolvedOrderId = billingOrderId || getDefaultBillingOrderId(String(promotion.id), invoiceType as InvoiceType);
    const resolvedOrderNumber = billingOrderNumber || `${getOrderNumber(String(promotion.id))}-${Date.now().toString().slice(-6)}`;

    const accountingItems: any[] = [];

    if ((invoiceType as InvoiceType) !== 'clicks') {
      const qtyViews = Number(promotion.views || 0);
      const unitView = Number(pricePerView || 0);
      const lineViewsTotal = Number(viewsTotal || 0);

      accountingItems.push({
        sku: `PROMO-VIEW-${String(promotion.id).slice(0, 8).toUpperCase()}`,
        name: `Promoción ${promotion.title} - Vistas`,
        quantity: qtyViews,
        unit_price: toFixedNumber(unitView),
        subtotal: toFixedNumber(lineViewsTotal),
        discount: 0,
        discount_percentage: 0,
        total: toFixedNumber(lineViewsTotal),
        tax_rate: 0,
        tax_amount: 0,
        base_amount: toFixedNumber(lineViewsTotal),
        partner: {
          partner_id: partnerId,
          name: partnerName,
          email,
          document_type: 'RUT',
          document_number: '',
          commission_percentage: 0,
        },
      });
    }

    if ((invoiceType as InvoiceType) !== 'views') {
      const qtyClicks = Number(promotion.clicks || 0);
      const unitClick = Number(pricePerClick || 0);
      const lineClicksTotal = Number(clicksTotal || 0);

      accountingItems.push({
        sku: `PROMO-CLICK-${String(promotion.id).slice(0, 8).toUpperCase()}`,
        name: `Promoción ${promotion.title} - Clics`,
        quantity: qtyClicks,
        unit_price: toFixedNumber(unitClick),
        subtotal: toFixedNumber(lineClicksTotal),
        discount: 0,
        discount_percentage: 0,
        total: toFixedNumber(lineClicksTotal),
        tax_rate: 0,
        tax_amount: 0,
        base_amount: toFixedNumber(lineClicksTotal),
        partner: {
          partner_id: partnerId,
          name: partnerName,
          email,
          document_type: 'RUT',
          document_number: '',
          commission_percentage: 0,
        },
      });
    }

    const totalAmount = toFixedNumber(Number(total || 0));

    const accountingPayload = {
      event: 'order.created',
      empresa_id: empresaId,
      timestamp: nowIso,
      source: 'promotion_billing',
      items: accountingItems,
      order: {
        order_id: resolvedOrderId,
        order_number: resolvedOrderNumber,
        created_at: nowIso,
        status: 'completed',
        subtotal: totalAmount,
        discount: 0,
        base_amount: totalAmount,
        tax: 0,
        total: totalAmount,
        currency: 'UYU',
        payment_method: 'promotion',
        payment_status: 'paid',
        prices_include_tax: true,
      },
      customer: {
        customer_id: partnerId,
        name: partnerName,
        email,
        phone: '',
      },
    };

    const isSupabaseFunctionTarget = targetAccountingUrl.includes('/functions/v1/');
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Integration-Key': accountingApiKey,
    };

    if (isSupabaseFunctionTarget && supabaseServiceKey) {
      requestHeaders.Authorization = `Bearer ${supabaseServiceKey}`;
      requestHeaders.apikey = supabaseServiceKey;
    }

    console.log('Sending promotion to accounting URL:', targetAccountingUrl);

    let accountingResponse: Response | null = null;
    let responseText = '';
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        accountingResponse = await fetch(targetAccountingUrl, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(accountingPayload),
        });

        responseText = await accountingResponse.text();

        if (accountingResponse.ok) {
          break;
        }

        lastError = new Error(`ACCOUNTING_WEBHOOK_FAILED (${accountingResponse.status}): ${responseText}`);
      } catch (error: any) {
        lastError = new Error(`ACCOUNTING_WEBHOOK_NETWORK_ERROR: ${error?.message || 'unknown error'}`);
      }

      if (attempt < 3) {
        const delay = Math.pow(2, attempt) * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    if (!accountingResponse?.ok) {
      throw (lastError || new Error('ACCOUNTING_WEBHOOK_FAILED: sin respuesta exitosa'));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Promotion sent to accounting',
        status: accountingResponse.status,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error enviando promoción a contabilidad',
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
