import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BookingToConfirm {
  order_id: string;
  customer_email: string;
  customer_name: string;
  service_name: string;
  partner_name: string;
  appointment_date: string;
  appointment_time: string;
  pet_name: string;
  confirmation_hours: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Validar Authorization header con SUPABASE_ANON_KEY
    const authHeader = req.headers.get("Authorization");
    const expectedKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized: Missing or invalid Authorization header",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    if (token !== expectedKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized: Invalid API key",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: ordersToConfirm, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        customer_email,
        customer_name,
        service_name,
        partner_name,
        appointment_date,
        appointment_time,
        pet_name,
        service_id
      `)
      .eq("status", "reserved")
      .not("appointment_date", "is", null)
      .not("service_id", "is", null);

    if (ordersError) {
      throw new Error(`Error fetching orders: ${ordersError.message}`);
    }

    if (!ordersToConfirm || ordersToConfirm.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No bookings need confirmation emails",
          processed: 0,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let processed = 0;
    let errors = 0;

    for (const order of ordersToConfirm) {
      try {
        // Obtener datos del servicio
        const { data: serviceData, error: serviceError } = await supabase
          .from("partner_services")
          .select("confirmation_hours")
          .eq("id", order.service_id)
          .single();

        if (serviceError || !serviceData) {
          console.log(`Order ${order.id} - could not fetch service data, skipping`);
          continue;
        }

        const confirmationHours = serviceData.confirmation_hours;

        if (!confirmationHours) {
          console.log(`Order ${order.id} has no confirmation_hours, skipping`);
          continue;
        }

        const appointmentDate = new Date(order.appointment_date);
        const now = new Date();
        const hoursUntilAppointment = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilAppointment > confirmationHours - 1 && hoursUntilAppointment <= confirmationHours + 1) {

          const { data: existingToken } = await supabase
            .from("booking_confirmation_tokens")
            .select("id")
            .eq("order_id", order.id)
            .single();

          if (existingToken) {
            console.log(`Order ${order.id} already has a token, skipping`);
            continue;
          }

          const tokenHash = crypto.randomUUID().replace(/-/g, "");
          const expiresAt = new Date(order.appointment_date);

          const { error: tokenError } = await supabase
            .from("booking_confirmation_tokens")
            .insert({
              order_id: order.id,
              token_hash: tokenHash,
              expires_at: expiresAt.toISOString(),
              email_sent_at: null,
            });

          if (tokenError) {
            console.error(`Error creating token for order ${order.id}:`, tokenError);
            errors++;
            continue;
          }

          const formattedDate = new Date(order.appointment_date).toLocaleDateString('es-UY');
          const confirmationUrl = `https://app-dogcatify.netlify.app/booking/confirm?token=${tokenHash}`;

          const emailResponse = await fetch(
            "https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/pending-communication",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": "sk_bcaca188c1b16345e4d10adf403eb4e9e98d3fa9ff04ba053d7416fe302b7dee",
              },
              body: JSON.stringify({
                template_name: "confirmar_cita",
                recipient_email: order.customer_email,
                order_id: order.id,
                wait_for_invoice: false,
                data: {
                  client_name: order.customer_name,
                  service_name: order.service_name,
                  provider_name: order.partner_name,
                  reservation_date: formattedDate,
                  reservation_time: order.appointment_time,
                  pet_name: order.pet_name,
                  confirmation_url: confirmationUrl,
                },
              }),
            }
          );

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error(`Error sending email for order ${order.id}:`, errorText);
            errors++;
            continue;
          }

          await supabase
            .from("booking_confirmation_tokens")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("order_id", order.id);

          console.log(`Confirmation email sent successfully for order ${order.id}`);
          processed++;
        }
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processed} bookings, ${errors} errors`,
        processed,
        errors,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in send-booking-confirmations:", error);
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