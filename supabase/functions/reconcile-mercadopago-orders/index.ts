import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cron-Secret",
};

type OrderCandidate = {
  id: string;
  created_at: string;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_id: string | null;
  payment_data: unknown;
  total_amount: number | null;
};

function isMercadoPagoOrder(order: OrderCandidate): boolean {
  const method = (order.payment_method || "").toLowerCase();
  return method.includes("mercado");
}

function hasMissingPaymentSync(order: OrderCandidate): boolean {
  const paymentStatus = (order.payment_status || "").toLowerCase();
  const isPaid = paymentStatus === "approved" || paymentStatus === "paid";
  const missingPaymentFields = !order.payment_id || !order.payment_data;
  const orderStillPending = (order.status || "").toLowerCase() === "pending";

  return isPaid && (missingPaymentFields || orderStillPending);
}

function isStalePending(order: OrderCandidate, staleMinutes: number): boolean {
  const paymentStatus = (order.payment_status || "").toLowerCase();
  const isPendingLike = paymentStatus === "pending" || paymentStatus === "in_process";
  if (!isPendingLike) {
    return false;
  }

  const createdAt = new Date(order.created_at).getTime();
  const now = Date.now();
  const ageMinutes = (now - createdAt) / (1000 * 60);
  return ageMinutes >= staleMinutes;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Método no permitido" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const cronSecret = req.headers.get("X-Cron-Secret");
    const expectedSecret = Deno.env.get("CRON_SECRET") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const hasValidCronSecret = Boolean(expectedSecret) && cronSecret === expectedSecret;
    const hasValidServiceAuth = Boolean(serviceRoleKey) && authHeader === `Bearer ${serviceRoleKey}`;

    if (!hasValidCronSecret && !hasValidServiceAuth) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized: Invalid cron secret or Authorization header",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const lookbackHours = Number(body.lookback_hours ?? 48);
    const batchLimit = Number(body.limit ?? 100);
    const stalePendingMinutes = Number(body.stale_pending_minutes ?? 5);
    const dryRun = Boolean(body.dry_run ?? false);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const lookbackDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, created_at, status, payment_status, payment_method, payment_id, payment_data, total_amount")
      .gte("created_at", lookbackDate)
      .neq("status", "cancelled")
      .gt("total_amount", 0)
      .in("payment_status", ["pending", "in_process", "approved", "paid"])
      .order("created_at", { ascending: false })
      .limit(batchLimit);

    if (ordersError) {
      throw ordersError;
    }

    const candidates = (orders || [])
      .filter((order: OrderCandidate) => isMercadoPagoOrder(order))
      .filter((order: OrderCandidate) => hasMissingPaymentSync(order) || isStalePending(order, stalePendingMinutes));

    const summary = {
      scanned: (orders || []).length,
      candidates: candidates.length,
      paymentSynced: 0,
      accountingSent: 0,
      skippedAccounting: 0,
      errors: 0,
      dryRun,
      details: [] as Array<Record<string, unknown>>,
    };

    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
    };

    for (const order of candidates) {
      const itemResult: Record<string, unknown> = {
        order_id: order.id,
        initial_status: order.status,
        initial_payment_status: order.payment_status,
      };

      try {
        if (!dryRun) {
          const syncResponse = await fetch(`${supabaseUrl}/functions/v1/mercadopago-webhook`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ order_id: order.id }),
          });

          const syncBody = await syncResponse.text();
          itemResult.sync_status_code = syncResponse.status;
          itemResult.sync_response = syncBody;

          if (syncResponse.ok) {
            summary.paymentSynced += 1;
          }
        } else {
          itemResult.sync_response = "dry_run";
        }

        const { data: refreshedOrder, error: refreshedError } = await supabase
          .from("orders")
          .select("id, status, payment_status, payment_method, payment_id, payment_data, total_amount")
          .eq("id", order.id)
          .maybeSingle();

        if (refreshedError) {
          throw refreshedError;
        }

        const refreshedPaymentStatus = (refreshedOrder?.payment_status || "").toLowerCase();
        const isPaidAfterSync = refreshedPaymentStatus === "approved" || refreshedPaymentStatus === "paid";

        if (!isPaidAfterSync) {
          summary.skippedAccounting += 1;
          itemResult.accounting = "skipped_not_paid";
          summary.details.push(itemResult);
          continue;
        }

        const { count: accountingSuccessCount, error: accountingCountError } = await supabase
          .from("accounting_webhook_logs")
          .select("id", { head: true, count: "exact" })
          .eq("order_id", order.id)
          .eq("success", true);

        if (accountingCountError) {
          throw accountingCountError;
        }

        if ((accountingSuccessCount || 0) > 0) {
          summary.skippedAccounting += 1;
          itemResult.accounting = "already_sent";
          summary.details.push(itemResult);
          continue;
        }

        if (!dryRun) {
          const accountingResponse = await fetch(`${supabaseUrl}/functions/v1/send-order-to-accounting`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ order_id: order.id }),
          });

          const accountingBody = await accountingResponse.text();
          itemResult.accounting_status_code = accountingResponse.status;
          itemResult.accounting_response = accountingBody;

          if (accountingResponse.ok) {
            summary.accountingSent += 1;
          } else {
            summary.errors += 1;
          }
        } else {
          itemResult.accounting = "dry_run_pending_send";
        }

        summary.details.push(itemResult);
      } catch (error) {
        summary.errors += 1;
        itemResult.error = error instanceof Error ? error.message : String(error);
        summary.details.push(itemResult);
      }
    }

    return new Response(JSON.stringify({ success: true, ...summary }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});