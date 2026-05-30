import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, email, device_id, success } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanDevice = String(device_id || "").trim();

    if (!cleanEmail || !cleanDevice) {
      return new Response(JSON.stringify({ allowed: false, retry_after_seconds: 60 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    if (action === "precheck") {
      await admin
        .schema("private")
        .from("auth_login_attempts")
        .delete()
        .lt("updated_at", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());

      const { data: row, error } = await admin
        .schema("private")
        .from("auth_login_attempts")
        .select("locked_until")
        .eq("email", cleanEmail)
        .eq("device_id", cleanDevice)
        .maybeSingle();
      if (error) throw error;

      if (!row) {
        await admin.schema("private").from("auth_login_attempts").upsert({
          email: cleanEmail,
          device_id: cleanDevice,
          updated_at: new Date().toISOString(),
        });
        return new Response(JSON.stringify({ allowed: true, retry_after_seconds: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const lockedUntil = row.locked_until ? new Date(row.locked_until).getTime() : 0;
      const now = Date.now();
      if (lockedUntil > now) {
        return new Response(JSON.stringify({
          allowed: false,
          retry_after_seconds: Math.max(1, Math.ceil((lockedUntil - now) / 1000)),
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ allowed: true, retry_after_seconds: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "record") {
      await admin.schema("private").from("auth_login_attempts").upsert({
        email: cleanEmail,
        device_id: cleanDevice,
        updated_at: new Date().toISOString(),
      });

      if (success === true) {
        await admin
          .schema("private")
          .from("auth_login_attempts")
          .update({
            failed_attempts: 0,
            first_failed_at: null,
            last_failed_at: null,
            locked_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq("email", cleanEmail)
          .eq("device_id", cleanDevice);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: row } = await admin
        .schema("private")
        .from("auth_login_attempts")
        .select("failed_attempts, first_failed_at")
        .eq("email", cleanEmail)
        .eq("device_id", cleanDevice)
        .single();

      const now = new Date();
      const first = row?.first_failed_at ? new Date(row.first_failed_at) : null;
      const isWindowExpired = !first || (now.getTime() - first.getTime()) > 15 * 60 * 1000;
      const attempts = isWindowExpired ? 1 : Number(row?.failed_attempts || 0) + 1;
      const firstFailedAt = isWindowExpired ? now.toISOString() : row?.first_failed_at;

      const updateData: Record<string, unknown> = {
        failed_attempts: attempts,
        first_failed_at: firstFailedAt,
        last_failed_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      if (attempts >= 5) {
        const backoffSeconds = Math.min(900, (attempts - 4) * 60);
        updateData.locked_until = new Date(now.getTime() + backoffSeconds * 1000).toISOString();
      }

      await admin
        .schema("private")
        .from("auth_login_attempts")
        .update(updateData)
        .eq("email", cleanEmail)
        .eq("device_id", cleanDevice);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
