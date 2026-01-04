// Import the compiled Hono worker
import worker from './_worker.js';

// Pages Functions catch-all route that delegates to Hono
export async function onRequest(context) {
  // Delegate to the Hono app's fetch handler
  return worker.fetch(context.request, context.env, context);
}
