export const config = { runtime: 'edge' };

const CLERK_FAPI = 'https://frontend-api.clerk.services';
const CLERK_HOST = 'clerk.decostats.com';

export default async function handler(req) {
  const url = new URL(req.url);

  // Strip the /api/clerk-proxy prefix to get the actual path
  const clerkPath = url.pathname.replace(/^\/api\/clerk-proxy/, '') || '/';
  const clerkUrl = `${CLERK_FAPI}${clerkPath}${url.search}`;

  // Build forwarded headers — replace host with Clerk's custom domain
  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (['host', 'connection', 'keep-alive', 'transfer-encoding'].includes(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  headers.set('host', CLERK_HOST);

  const response = await fetch(clerkUrl, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
  });

  // Forward response, stripping hop-by-hop headers
  const responseHeaders = new Headers();
  for (const [key, value] of response.headers.entries()) {
    if (['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) continue;
    responseHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
