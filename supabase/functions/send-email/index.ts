import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

interface EmailRequest {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachment?: any;
  // New API parameters
  template_name?: string;
  recipient_email?: string;
  data?: any;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: EmailRequest = await req.json();

    // Get the external email API configuration
    const emailApiUrl = Deno.env.get("EMAIL_API_URL") || "https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email";
    const emailApiKey = Deno.env.get("EMAIL_API_KEY");

    if (!emailApiKey) {
      console.error("EMAIL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email API not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // If this is a new-style request with template_name, forward it directly
    if (body.template_name && body.recipient_email) {
      console.log(`Forwarding template email: ${body.template_name} to ${body.recipient_email}`);

      const response = await fetch(emailApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': emailApiKey,
        },
        body: JSON.stringify({
          template_name: body.template_name,
          recipient_email: body.recipient_email,
          data: body.data || {},
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API error:', errorText);
        return new Response(
          JSON.stringify({ error: `Email API error: ${response.status}`, details: errorText }),
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

    // For legacy requests with HTML (booking confirmations, etc),
    // still forward to the email API but we'll need to handle them differently
    console.log(`Legacy email request to: ${body.to}`);
    console.warn("WARNING: This is a legacy email format. Please migrate to template-based emails.");

    // For now, return an error encouraging migration to new API
    return new Response(
      JSON.stringify({
        error: "Legacy email format not supported",
        message: "Please use template-based emails with template_name parameter",
        details: "Direct HTML emails should be migrated to use the template system"
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
    console.error("Error processing email request:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to process email request",
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