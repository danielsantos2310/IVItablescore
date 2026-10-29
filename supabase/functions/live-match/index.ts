import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body: unknown, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function getSecretKey() {
  const configured = Deno.env.get("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!configured) throw new Error("Supabase service key is not configured.");

  if (configured.trim().startsWith("{")) {
    const values = JSON.parse(configured);
    const key = values.default ?? Object.values(values)[0];
    if (typeof key === "string") return key;
  }

  return configured;
}

function token() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function hash(value: unknown) {
  if (typeof value !== "string" || value.length < 32 || value.length > 256) {
    throw new Error("Invalid access token.");
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validState(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const state = value as Record<string, unknown>;
    const teamNamesValid = [state.homeTeam, state.awayTeam]
      .every((name) => typeof name === "string" && name.length <= 100);
    const matchIdValid = state.id === undefined || (typeof state.id === "string" && state.id.length <= 100);
    return teamNamesValid && matchIdValid && JSON.stringify(value).length <= 400_000;
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      getSecretKey(),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    if (request.method === "GET") {
      const url = new URL(request.url);
      const matchId = url.searchParams.get("match_id");
      const refereeToken = url.searchParams.get("token");

      if (!isUuid(matchId)) return json({ error: "Invalid match link." }, corsHeaders, 400);
      const refereeTokenHash = await hash(refereeToken);

      const { data, error } = await admin
        .from("live_matches")
        .select("match_state, status, revision, updated_at")
        .eq("id", matchId)
        .eq("referee_token_hash", refereeTokenHash)
        .maybeSingle();

      if (error) throw error;
      if (!data) return json({ error: "This referee link is not available." }, corsHeaders, 404);

      return json({ state: data.match_state, status: data.status, revision: data.revision, updated_at: data.updated_at }, corsHeaders);
    }

    if (request.method !== "POST") return json({ error: "Method not allowed." }, corsHeaders, 405);

    const body = await request.json();
    const action = body?.action;

    if (action === "create") {
      if (!validState(body.match_state)) return json({ error: "Invalid match state." }, corsHeaders, 400);

      const staffToken = token();
      const refereeToken = token();
      const { data, error } = await admin
        .from("live_matches")
        .insert({
          staff_token_hash: await hash(staffToken),
          referee_token_hash: await hash(refereeToken),
          match_state: body.match_state,
        })
        .select("id, revision")
        .single();

      if (error) throw error;
      return json({ match_id: data.id, staff_token: staffToken, referee_token: refereeToken, revision: data.revision }, corsHeaders, 201);
    }

    if (action === "update" || action === "finish") {
      if (!isUuid(body.match_id) || !validState(body.match_state)) {
        return json({ error: "Invalid live match update." }, corsHeaders, 400);
      }

      const staffTokenHash = await hash(body.staff_token);
      const status = action === "finish" ? "finished" : "live";
      const { data, error } = await admin
        .from("live_matches")
        .update({
          match_state: body.match_state,
          status,
          ended_at: action === "finish" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.match_id)
        .eq("staff_token_hash", staffTokenHash)
        .select("revision")
        .maybeSingle();

      if (error) throw error;
      if (!data) return json({ error: "Live session not found." }, corsHeaders, 404);
      return json({ revision: data.revision, status }, corsHeaders);
    }

    return json({ error: "Unknown action." }, corsHeaders, 400);
  } catch (error) {
    console.error("Live match request failed.");
    return json({ error: "Unable to process the live match request." }, corsHeaders, 500);
  }
});

