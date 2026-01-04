/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean
  error?: {
    parameter: string
    value: string
    allowedValues: string[]
  }
}

/**
 * Validates that a parameter value is in the allowed list
 * Returns validation result with error details if invalid
 */
export function validateParam(
  paramName: string,
  value: string | null | undefined,
  allowedValues: string[]
): ValidationResult {
  if (value && !allowedValues.includes(value)) {
    return {
      isValid: false,
      error: {
        parameter: paramName,
        value,
        allowedValues,
      },
    }
  }
  return { isValid: true }
}
