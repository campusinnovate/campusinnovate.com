export function officeErrorMessage(error: unknown, fallback: string): string {
  // PostgREST RPC errors are plain objects, not Error instances.
  if (typeof error === 'object' && error !== null && 'message' in error &&
      typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
