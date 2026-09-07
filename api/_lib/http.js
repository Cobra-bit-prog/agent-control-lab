export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type, X-Api-Key, Authorization",
};

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

export function readApiKey(request) {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return (request.headers.get("x-api-key") || "").trim();
}

export function originFrom(request) {
  const url = new URL(request.url);
  return process.env.PUBLIC_ORIGIN?.replace(/\/$/, "") || `${url.protocol}//${url.host}`;
}
