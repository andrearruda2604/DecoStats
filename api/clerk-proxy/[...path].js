export const config = { runtime: 'edge' };

const CLERK_FAPI  = 'https://frontend-api.clerk.services';
const CLERK_HOST  = 'clerk.decostats.com';
const NPM_CDN     = 'https://cdn.jsdelivr.net';

export default async function handler(req) {
  const url = new URL(req.url);
  const clerkPath = url.pathname.replace(/^\/api\/clerk-proxy/, '') || '/';

  let targetUrl;
  let fetchInit;

  if (clerkPath.startsWith('/npm/')) {
    // Clerk JS bundle — serve from public npm CDN
    targetUrl = `${NPM_CDN}${clerkPath}`;
    fetchInit  = { method: 'GET' };
  } else {
    // API calls — proxy to Clerk's FAPI with the correct Host header
    targetUrl = `${CLERK_FAPI}${clerkPath}${url.search}`;
    const headers = new Headers();
    for (const [k, v] of req.headers.entries()) {
      if (['host', 'connection', 'keep-alive', 'transfer-encoding'].includes(k.toLowerCase())) continue;
      headers.set(k, v);
    }
    headers.set('host', CLERK_HOST);
    fetchInit = {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    };
  }

  const response = await fetch(targetUrl, fetchInit);

  const responseHeaders = new Headers();
  for (const [k, v] of response.headers.entries()) {
    if (['transfer-encoding', 'connection', 'keep-alive'].includes(k.toLowerCase())) continue;
    responseHeaders.set(k, v);
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
