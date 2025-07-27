// Follow Deno's recommended imports
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createTransport } from "npm:nodemailer@6.9.1";

// Configuración de CORS para permitir solicitudes desde cualquier origen
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface EmailRequest {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    let body: EmailRequest;
    try {
      // Get request body
      body = await req.json();
    } catch (e) {
      console.error("Error parsing request body:", e);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
    
    // Validate required fields
    if (!body.to || !body.subject || (!body.text && !body.html)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Configure SMTP transport
    const host = Deno.env.get("SMTP_HOST") || "smtpout.secureserver.net";
    const port = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const user = Deno.env.get("SMTP_USER") || "info@dogcatify.com";
    const pass = Deno.env.get("SMTP_PASSWORD") || "your-password-here"; // Reemplazar con una contraseña temporal para pruebas
    
    const smtpConfig = {
      host,
      port,
      secure: true, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    };

    console.log("SMTP Config (Debug):", {
      host,
      port,
      secure: smtpConfig.secure,
      user,
      pass: pass ? "********" : "not set" // Log masked password for debugging
    });

    // Create transporter
    let transporter;
    try {
      transporter = createTransport(smtpConfig);
    } catch (e) {
      console.error("Error creating SMTP client:", e);
      return new Response(
        JSON.stringify({ error: "Failed to create SMTP client", details: e.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Send email
    let info;
    try {
      const mailOptions: any = {
        from: `"DogCatiFy" <${user}>`,
        to: body.to,
        subject: body.subject,
        text: body.text || "",
        html: body.html || "",
      };

      // Add PDF attachment if provided
      if (body.attachment) {
        mailOptions.attachments = [{
          filename: 'factura.pdf',
          content: body.attachment,
          contentType: 'application/pdf'
        }];
      }

      info = await transporter.sendMail(mailOptions);
    } catch (e) {
      console.error("Error sending email:", e);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: e.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true, 
        messageId: info.messageId,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to send email", 
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