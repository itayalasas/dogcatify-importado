import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key",
};

interface OrderData {
  id: string;
  partner_id: string;
  customer_id: string;
  items: any[];
  status: string;
  subtotal?: number;
  iva_rate?: number;
  iva_amount?: number;
  iva_included_in_price?: boolean;
  total_amount: number;
  shipping_address?: string;
  payment_preference_id?: string;
  payment_id?: string;
  payment_method?: string;
  payment_status?: string;
  payment_data?: any;
  commission_amount?: number;
  partner_amount?: number;
  partner_breakdown?: any;
  booking_id?: string;
  order_type?: string;
  service_id?: string;
  appointment_date?: string;
  appointment_time?: string;
  pet_id?: string;
  booking_notes?: string;
  created_at: string;
  updated_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/");
    const orderId = path[path.length - 1];

    const apiKey = req.headers.get("X-API-Key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "API Key requerida",
          message: "Debes incluir tu API Key en el header X-API-Key",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const adminToken = Deno.env.get("ADMIN_API_TOKEN") || "dogcatify_admin_2025_secure";
    let isAdmin = false;
    let partnerId: string | null = null;

    if (apiKey === adminToken) {
      isAdmin = true;
      console.log("🔐 Admin access granted - Full access to all orders");
    } else {
      const { data: partner, error: partnerError } = await supabase
        .from("profiles")
        .select("id, display_name, email, is_partner")
        .eq("id", apiKey)
        .eq("is_partner", true)
        .single();

      if (partnerError || !partner) {
        return new Response(
          JSON.stringify({
            error: "API Key inválida",
            message: "El API Key proporcionado no es válido. Debe ser un Partner ID válido o el token administrativo.",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      partnerId = partner.id;
      console.log(`👤 Partner access granted: ${partner.display_name}`);
    }

    if (req.method === "GET" && orderId && orderId !== "orders-api") {
      let orderQuery = supabase
        .from("orders")
        .select(`
          *,
          customer:profiles!orders_customer_id_fkey(
            id,
            display_name,
            email,
            phone,
            calle,
            numero,
            barrio,
            codigo_postal,
            location
          ),
          partner:partners(
            id,
            business_name,
            email,
            phone,
            calle,
            numero,
            barrio,
            codigo_postal,
            rut
          )
        `)
        .eq("id", orderId);

      if (!isAdmin && partnerId) {
        orderQuery = orderQuery.eq("partner_id", partnerId);
      }

      const { data: order, error: orderError } = await orderQuery.single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({
            error: "Orden no encontrada",
            message: `No se encontró la orden con ID ${orderId} o no tienes permiso para acceder a ella`,
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            order: order,
            retrieved_at: new Date().toISOString(),
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "GET") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const status = url.searchParams.get("status");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const filterPartnerId = url.searchParams.get("partner_id");

      const offset = (page - 1) * limit;

      let query = supabase
        .from("orders")
        .select(`
          *,
          customer:profiles!orders_customer_id_fkey(
            id,
            display_name,
            email,
            phone,
            calle,
            numero,
            barrio,
            codigo_postal,
            location
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (!isAdmin && partnerId) {
        query = query.eq("partner_id", partnerId);
      }

      if (isAdmin && filterPartnerId) {
        query = query.eq("partner_id", filterPartnerId);
      }

      if (status) {
        query = query.eq("status", status);
      }

      if (from) {
        query = query.gte("created_at", from);
      }
      
      if (to) {
        query = query.lte("created_at", to);
      }

      const { data: orders, error: ordersError, count } = await query;

      if (ordersError) {
        throw ordersError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            orders: orders || [],
            pagination: {
              page,
              limit,
              total: count || 0,
              total_pages: Math.ceil((count || 0) / limit),
            },
            retrieved_at: new Date().toISOString(),
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Método no permitido",
        message: "Solo se permiten peticiones GET",
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in orders-api:", error);
    return new Response(
      JSON.stringify({
        error: "Error interno del servidor",
        message: error.message || "Ocurrió un error al procesar la petición",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
