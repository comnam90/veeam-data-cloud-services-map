// Import the compiled Hono worker
import worker from './_worker.js';

// Pages Functions catch-all route that delegates API requests to Hono
// but lets static files from the public/ directory pass through
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Only handle /api/* routes with Hono
  // Let everything else (static files, HTML, etc.) be served by Pages
  if (url.pathname.startsWith('/api/')) {
    return worker.fetch(context.request, context.env, context);
  }

  // For non-API routes, return a pass-through response
  // This allows Cloudflare Pages to serve static files from public/
  return context.next();
}
