// =============================================================================
// api/newsletter.ts — Newsletter subscription endpoint
// =============================================================================

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (request.method !== "POST") {
    return err("Method not allowed", 405);
  }

  let email: string;
  let topics: string[];
  try {
    const body = (await request.json()) as { email?: unknown; topics?: unknown };
    if (!body.email || typeof body.email !== "string") return err("Invalid email", 400);
    email  = body.email.toLowerCase().trim();
    topics = Array.isArray(body.topics) ? (body.topics as string[]) : [];
  } catch { return err("Invalid request body", 400); }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("Invalid email format", 400);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/subscribers`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "resolution=ignore-duplicates",
        },
        body: JSON.stringify({ email, subscribed_topics: topics, confirmed: false }),
      });
    } catch (e) {
      console.error("[newsletter] Supabase error:", e);
      return err("Failed to subscribe. Please try again.", 500);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status:  201,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

function cors(): Record<string, string> {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
}

function err(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json", ...cors() } });
}