/**
 * Environment variables available in Cloudflare Pages Functions
 */
export interface Env {
  ENVIRONMENT?: string
}

/**
 * Cloudflare Pages Functions context
 */
export interface CloudflareContext {
  request: Request
  env: Env
  params: Record<string, string>
  waitUntil: (promise: Promise<unknown>) => void
  passThroughOnException: () => void
  next: () => Promise<Response>
}
