import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceEmailRequest {
  invoiceNumber: string;
  partnerName: string;
  partnerEmail: string;
  promotionTitle: string;
  totalAmount: number;
  pdfBase64: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const data: InvoiceEmailRequest = await req.json();

    console.log('Sending invoice email:', {
      invoiceNumber: data.invoiceNumber,
      partnerEmail: data.partnerEmail,
      promotionTitle: data.promotionTitle
    });

    // Obtener credenciales de Resend desde variables de entorno
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no está configurada');
    }

    // Crear contenido HTML del email
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Factura de Promoción - DogCatify</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🐾 DogCatify</h1>
        <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Factura de Promoción</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${data.partnerName}</strong>,</p>
        
        <p>Te enviamos la factura correspondiente a tu promoción en DogCatify:</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
          <h2 style="color: #DC2626; margin-top: 0;">Detalles de la Factura</h2>
          <p><strong>Número de Factura:</strong> ${data.invoiceNumber}</p>
          <p><strong>Promoción:</strong> ${data.promotionTitle}</p>
          <p><strong>Período:</strong> ${new Date(data.billingPeriodStart).toLocaleDateString('es-UY')} - ${new Date(data.billingPeriodEnd).toLocaleDateString('es-UY')}</p>
          <p style="font-size: 24px; color: #DC2626; margin: 15px 0;"><strong>Total: $${data.totalAmount.toFixed(2)}</strong></p>
        </div>
        
        <p>Encontrarás el PDF detallado de la factura adjunto a este correo.</p>
        
        <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #92400E;">💡 <strong>Nota:</strong> Esta factura se generó automáticamente basándose en las vistas y likes de tu promoción durante el período indicado.</p>
        </div>
        
        <p>Si tienes alguna pregunta o necesitas aclaración sobre esta factura, no dudes en contactarnos.</p>
        
        <p style="margin-top: 30px;">Saludos cordiales,<br><strong>El equipo de DogCatify</strong></p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #6B7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} DogCatify. Todos los derechos reservados.</p>
        <p>Este es un correo automático, por favor no responder.</p>
      </div>
    </body>
    </html>
    `;

    // Enviar email usando Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DogCatify <facturacion@dogcatify.com>',
        to: [data.partnerEmail],
        subject: `Factura ${data.invoiceNumber} - DogCatify`,
        html: htmlContent,
        attachments: [
          {
            filename: `Factura_${data.invoiceNumber}.pdf`,
            content: data.pdfBase64,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error from Resend:', error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json();
    console.log('Email sent successfully:', result);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.id,
        message: 'Factura enviada exitosamente'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-invoice-email function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido al enviar email'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});