import { FunctionsHttpError } from '@supabase/supabase-js'

export async function readFunctionError(error: unknown) {
  if (!(error instanceof FunctionsHttpError)) return null
  try {
    const response = error.context.clone()
    const payload = await response.json() as { error?: unknown }
    return typeof payload.error === 'string' ? payload.error : null
  } catch {
    return null
  }
}
