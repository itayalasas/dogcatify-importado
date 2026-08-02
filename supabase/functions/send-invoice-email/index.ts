import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key",
};

interface EmailRequest {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachment?: any;
  template_name?: string;
  recipient_email?: string;
  data?: any;
  [key: string]: any; // Permitir campos adicionales dinámicos
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: EmailRequest = await req.json();



    // Get the INVOICE email API configuration (diferentes variables)
    const invoiceApiUrl = Deno.env.get("INVOICE_API_URL") || Deno.env.get("EMAIL_API_URL");
    const invoiceApiKey = Deno.env.get("INVOICE_API_KEY") || Deno.env.get("EMAIL_API_KEY");


    if (!invoiceApiKey || !invoiceApiUrl) {
      return new Response(
        JSON.stringify({
          error: "Invoice API not configured",
          details: "INVOICE_API_KEY/EMAIL_API_KEY or INVOICE_API_URL/EMAIL_API_URL secret is not set"
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // If this is a new-style request with template_name, forward it directly
    if (body.template_name && body.recipient_email) {

      // Construir payload con todos los campos del body (genérico)
      const payload: any = {
        template_name: body.template_name,
        recipient_email: body.recipient_email,
        data: body.data || {},
      };

      // Incluir cualquier otro campo adicional que venga en el body
      Object.keys(body).forEach(key => {
        if (!['template_name', 'recipient_email', 'data'].includes(key)) {
          payload[key] = body[key];
        }
      });

      if (body.template_name === 'promotion_send') {
        payload.wait_for_invoice = true;
        payload.force_wait_for_invoice = true;
      }


      const isSupabaseFunctionTarget = invoiceApiUrl.includes('/functions/v1/');
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': invoiceApiKey,
        // Compatibilidad hacia atrÃ¡s con integraciones existentes
        'X-Integration-Key': invoiceApiKey,
        // Algunos endpoints nuevos validan Authorization en lugar de X-Integration-Key
        'Authorization': `Bearer ${invoiceApiKey}`,
      };

      if (isSupabaseFunctionTarget && supabaseServiceKey) {
        requestHeaders['apikey'] = supabaseServiceKey;
      }

      const response = await fetch(invoiceApiUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
      });


      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({
            error: `Invoice API error: ${response.status}`,
            details: errorText,
            api_url: invoiceApiUrl,
          }),
          {
            status: response.status,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      const result = await response.json();

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // For legacy requests

    return new Response(
      JSON.stringify({
        error: "Legacy email format not supported",
        message: "Please use template-based emails with template_name parameter"
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error) {

    return new Response(
      JSON.stringify({
        error: "Failed to process invoice email request",
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
