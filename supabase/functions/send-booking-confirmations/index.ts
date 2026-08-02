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
    const emailApiUrl = Deno.env.get("EMAIL_API_URL")?.trim();
    const emailApiKey = Deno.env.get("EMAIL_API_KEY")?.trim();

    if (!emailApiUrl || !emailApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Email service is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: ordersToConfirm, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        booking_id,
        customer_id,
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
          continue;
        }

        const confirmationHours = serviceData.confirmation_hours;

        if (!confirmationHours) {
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
            errors++;
            continue;
          }

          const formattedDate = new Date(order.appointment_date).toLocaleDateString('es-UY');
          const confirmationUrl = `https://app-dogcatify.netlify.app/booking/confirm?token=${tokenHash}`;

          const emailResponse = await fetch(\n            emailApiUrl,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": emailApiKey,
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
            errors++;
            continue;
          }

          await supabase
            .from("booking_confirmation_tokens")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("order_id", order.id);

          const confirmationTitle = "¡Confirma tu reserva!";
          const confirmationBody = `Tu reserva de ${order.service_name} para ${formattedDate} a las ${order.appointment_time} requiere confirmación.`;

          const { error: pushNotificationError } = await supabase
            .from("scheduled_notifications")
            .insert({
              user_id: order.customer_id,
              notification_type: "booking_confirmation",
              reference_id: order.id,
              reference_type: "booking",
              title: confirmationTitle,
              body: confirmationBody,
              data: {
                screen: "BookingDetails",
                type: "booking_confirmation",
                order_id: order.id,
                booking_id: order.booking_id || order.id,
                service_name: order.service_name,
                partner_name: order.partner_name,
                pet_name: order.pet_name,
                date: order.appointment_date,
                time: order.appointment_time,
                confirmation_url: confirmationUrl,
              },
              scheduled_for: new Date().toISOString(),
              status: "pending",
            })
            .select("id")
            .single();

          if (pushNotificationError) {
          }

          processed++;
        }
      } catch (error) {
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
