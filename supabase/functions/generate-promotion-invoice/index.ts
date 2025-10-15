import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    console.log('Generating invoice for promotion:', promotion.id);

    // Format dates
    const startDate = new Date(promotion.startDate).toLocaleDateString('es-ES');
    const endDate = new Date(promotion.endDate).toLocaleDateString('es-ES');
    const invoiceDate = new Date().toLocaleDateString('es-ES');
    const invoiceNumber = `PROMO-${Date.now()}`;

    // Build invoice HTML
    let invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #DC2626;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #DC2626;
            margin: 0;
          }
          .invoice-info {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .invoice-info table {
            width: 100%;
          }
          .invoice-info td {
            padding: 8px 0;
          }
          .invoice-info td:first-child {
            font-weight: bold;
            width: 200px;
          }
          .promotion-details {
            margin-bottom: 30px;
          }
          .promotion-details h2 {
            color: #DC2626;
            border-bottom: 2px solid #DC2626;
            padding-bottom: 10px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .items-table th {
            background: #DC2626;
            color: white;
            padding: 12px;
            text-align: left;
          }
          .items-table td {
            padding: 12px;
            border-bottom: 1px solid #ddd;
          }
          .items-table tr:last-child td {
            border-bottom: none;
          }
          .totals {
            float: right;
            width: 300px;
          }
          .totals table {
            width: 100%;
            border-collapse: collapse;
          }
          .totals td {
            padding: 8px;
            text-align: right;
          }
          .totals .total-row {
            background: #DC2626;
            color: white;
            font-size: 18px;
            font-weight: bold;
          }
          .footer {
            clear: both;
            margin-top: 60px;
            text-align: center;
            color: #666;
            font-size: 12px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🐾 DogCatify</h1>
          <p>Factura de Promoción</p>
        </div>

        <div class="invoice-info">
          <table>
            <tr>
              <td>Número de Factura:</td>
              <td>${invoiceNumber}</td>
            </tr>
            <tr>
              <td>Fecha de Emisión:</td>
              <td>${invoiceDate}</td>
            </tr>
            <tr>
              <td>Cliente:</td>
              <td>${partnerInfo?.businessName || 'Cliente'}</td>
            </tr>
            <tr>
              <td>Email:</td>
              <td>${email}</td>
            </tr>
          </table>
        </div>

        <div class="promotion-details">
          <h2>Detalles de la Promoción</h2>
          <table class="invoice-info">
            <tr>
              <td>Título:</td>
              <td>${promotion.title}</td>
            </tr>
            <tr>
              <td>Período:</td>
              <td>${startDate} - ${endDate}</td>
            </tr>
            <tr>
              <td>Tipo de Facturación:</td>
              <td>${invoiceType === 'both' ? 'Vistas y Clics' : invoiceType === 'views' ? 'Solo Vistas' : 'Solo Clics'}</td>
            </tr>
          </table>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th style="text-align: center;">Cantidad</th>
              <th style="text-align: right;">Precio Unitario</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
    `;

    // Add rows based on invoice type
    if (invoiceType !== 'clicks') {
      invoiceHTML += `
            <tr>
              <td>Vistas de promoción</td>
              <td style="text-align: center;">${promotion.views}</td>
              <td style="text-align: right;">$${pricePerView.toFixed(2)}</td>
              <td style="text-align: right;">$${viewsTotal.toFixed(2)}</td>
            </tr>
      `;
    }

    if (invoiceType !== 'views') {
      invoiceHTML += `
            <tr>
              <td>Clics en promoción</td>
              <td style="text-align: center;">${promotion.clicks}</td>
              <td style="text-align: right;">$${pricePerClick.toFixed(2)}</td>
              <td style="text-align: right;">$${clicksTotal.toFixed(2)}</td>
            </tr>
      `;
    }

    invoiceHTML += `
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tr class="total-row">
              <td>Total a Pagar:</td>
              <td>$${total.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          <p>Gracias por confiar en DogCatify para promocionar tu negocio.</p>
          <p>Esta factura ha sido generada automáticamente.</p>
          <p>Para cualquier consulta, por favor contacta a admin@dogcatify.com</p>
        </div>
      </body>
      </html>
    `;

    // Call send-email function
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        subject: `Factura de Promoción - ${promotion.title}`,
        html: invoiceHTML,
      }),
    });

    if (!emailResponse.ok) {
      throw new Error('Failed to send email');
    }

    console.log('Invoice email sent successfully to:', email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invoice generated and sent successfully',
        invoiceNumber,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error generating invoice:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate invoice',
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
