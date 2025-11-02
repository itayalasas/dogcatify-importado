import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const tokenFromUrl = url.searchParams.get("token");

    let token = tokenFromUrl;

    if (!token && req.method === "POST") {
      const body = await req.json();
      token = body.token;
    }

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Token is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from("booking_confirmation_tokens")
      .select(`
        id,
        order_id,
        confirmed_at,
        expires_at,
        orders!inner(
          id,
          status,
          customer_name,
          service_name,
          appointment_date,
          appointment_time
        )
      `)
      .eq("token_hash", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Token inválido o no encontrado",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (tokenData.confirmed_at) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Esta reserva ya fue confirmada previamente",
          confirmed_at: tokenData.confirmed_at,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);

    if (now > expiresAt) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "El token ha expirado. La cita ya pasó o fue cancelada.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenData.order_id);

    if (updateOrderError) {
      console.error("Error updating order:", updateOrderError);
      throw new Error(`Error al confirmar la reserva: ${updateOrderError.message}`);
    }

    const { error: updateTokenError } = await supabase
      .from("booking_confirmation_tokens")
      .update({
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", tokenData.id);

    if (updateTokenError) {
      console.error("Error updating token:", updateTokenError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reserva confirmada exitosamente",
        booking: {
          order_id: tokenData.order_id,
          customer_name: tokenData.orders.customer_name,
          service_name: tokenData.orders.service_name,
          appointment_date: tokenData.orders.appointment_date,
          appointment_time: tokenData.orders.appointment_time,
          status: "confirmed",
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in confirm-booking:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});