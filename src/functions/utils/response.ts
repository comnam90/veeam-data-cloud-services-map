import type { Context } from 'hono'
import type { Env } from '../types/env'

/**
 * Helper to return JSON responses with consistent headers
 */
export function jsonResponse<T>(
  c: Context<{ Bindings: Env }>,
  data: T,
  status: number = 200
) {
  return c.json(data, status as any)
}

/**
 * Helper to return standardized error responses
 */
export function errorResponse(
  c: Context<{ Bindings: Env }>,
  error: string,
  code: string,
  status: number = 400,
  additionalInfo: Record<string, unknown> = {}
) {
  return c.json(
    {
      error,
      code,
      message: error,
      ...additionalInfo,
    },
    status as any
  )
}
