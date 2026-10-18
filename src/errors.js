// Turns technical errors into short messages a customer can act on. The original error is
// kept in the browser console (F12) for whoever maintains the system.
export function friendly(e) {
  const raw = typeof e === 'string' ? e : e?.message ?? ''
  if (typeof e !== 'string' && e) console.error(e)
  if (!raw) return 'Something went wrong. Please try again.'
  if (/failed to send a request|failed to fetch|networkerror|load failed|network request failed/i.test(raw))
    return navigator.onLine === false
      ? 'You appear to be offline. Check your connection and try again.'
      : 'We could not reach the server. Please try again in a moment.'
  if (/non-2xx|internal server error|edge function|cannot read propert|is not a function|is not defined|unexpected token/i.test(raw))
    return 'Something went wrong. Please try again.'
  if (/jwt|not authenticated|refresh token/i.test(raw)) return 'Your session has ended. Please log in again.'
  if (/row-level security|permission denied|violates row/i.test(raw)) return 'You do not have permission to do that.'
  if (/(function|relation|column|schema) .*does not exist|schema cache|could not find the/i.test(raw))
    return 'Something is not set up correctly yet. Please contact support.'
  return raw
}
