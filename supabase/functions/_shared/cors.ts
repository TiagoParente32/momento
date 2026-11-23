// CORS for the Momento extension (chrome-extension://<id>) and local dev.
// Optionally set ALLOWED_ORIGINS="chrome-extension://<your-id>,http://localhost:5173" to restrict.
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowList = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const allowed = allowList.length
    ? allowList.includes(origin)
    : origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://') || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });
