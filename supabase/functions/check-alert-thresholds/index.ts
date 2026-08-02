import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface AlertThreshold {
  type: string;
  count: number;
  timeWindowMinutes: number;
  message: string;
}

// Configuración de umbrales de alerta
const ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    type: "LOGIN_FAILED",
    count: 5,
    timeWindowMinutes: 10,
    message: "Múltiples intentos fallidos de login detectados"
  },
  {
    type: "PAYMENT_FAILED",
    count: 10,
    timeWindowMinutes: 30,
    message: "Alto número de pagos fallidos"
  },
  {
    type: "ERROR",
    count: 20,
    timeWindowMinutes: 10,
    message: "Múltiples errores del sistema"
  },
  {
    type: "API_ERROR",
    count: 15,
    timeWindowMinutes: 15,
    message: "Múltiples errores de API"
  }
];

/**
 * Envía un email de alerta al administrador
 */
async function sendAlertEmail(
  supabase: any,
  alertType: string,
  count: number,
  timeWindow: number,
  logs: any[]
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const emailFunctionUrl = `${supabaseUrl}/functions/v1/send-email`;

  // Obtener email del admin
  const { data: adminProfiles } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "admin")
    .limit(1);

  if (!adminProfiles || adminProfiles.length === 0) {
    return;
  }

  const adminEmail = adminProfiles[0].email;

  // Preparar detalles de los logs
  const logDetails = logs.slice(0, 5).map(log => ({
    action: log.action,
    user: log.user_email || "Anónimo",
    time: new Date(log.created_at).toLocaleString("es-ES"),
    error: log.error_message || "",
    details: log.details
  }));

  const emailPayload = {
    recipient_email: adminEmail,
    subject: `🚨 Alerta de Seguridad: ${alertType}`,
    html: `
      <h2 style="color: #EF4444;">🚨 Alerta de Seguridad</h2>
      <p><strong>Tipo:</strong> ${alertType}</p>
      <p><strong>Eventos detectados:</strong> ${count} en los últimos ${timeWindow} minutos</p>
      <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-ES")}</p>
      
      <h3>Últimos eventos:</h3>
      <ul>
        ${logDetails.map(log => `
          <li>
            <strong>${log.action}</strong> - ${log.user}<br>
            <small style="color: #6B7280;">${log.time}</small><br>
            ${log.error ? `<span style="color: #EF4444;">${log.error}</span><br>` : ""}
            ${Object.keys(log.details || {}).length > 0 ? `<code>${JSON.stringify(log.details)}</code>` : ""}
          </li>
        `).join("")}
      </ul>
      
      <p style="margin-top: 20px;">
        <a href="${supabaseUrl}" style="background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          Ver Panel de Seguridad
        </a>
      </p>
      
      <hr style="margin: 20px 0;">
      <p style="font-size: 12px; color: #6B7280;">
        Este es un email automático del sistema de monitoreo de seguridad de DogCatify.
      </p>
    `
  };

  try {
    const response = await fetch(emailFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify(emailPayload)
    });

    if (!response.ok) {
    } else {
    }
  } catch (error) {
  }
}

/**
 * Verifica si se deben enviar alertas
 */
async function checkAlertThresholds(supabase: any): Promise<{
  alerts: any[];
  message: string;
}> {
  const alerts: any[] = [];

  for (const threshold of ALERT_THRESHOLDS) {
    const { type, count, timeWindowMinutes, message } = threshold;
    
    // Buscar logs que coincidan con el umbral
    const { data: logs, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("action", type)
      .gte("created_at", new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      continue;
    }

    if (logs && logs.length >= count) {
      
      alerts.push({
        type,
        count: logs.length,
        threshold: count,
        timeWindow: timeWindowMinutes,
        message,
        logs: logs.slice(0, 10) // Solo primeros 10
      });

      // Enviar email de alerta
      await sendAlertEmail(supabase, type, logs.length, timeWindowMinutes, logs);
      
      // Registrar la alerta en audit_logs
      await supabase.from("audit_logs").insert({
        user_id: null,
        action: "SECURITY_ALERT",
        resource_type: "system",
        status: "warning",
        details: {
          alert_type: type,
          event_count: logs.length,
          threshold: count,
          time_window: timeWindowMinutes
        }
      });
    }
  }

  if (alerts.length === 0) {
    return {
      alerts: [],
      message: "No alerts triggered. System operating normally."
    };
  }

  return {
    alerts,
    message: `${alerts.length} alert(s) triggered. Admin notified via email.`
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    
    const result = await checkAlertThresholds(supabase);

    return new Response(
      JSON.stringify({
        success: true,
        ...result
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
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
