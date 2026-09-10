import { format, isValid } from 'date-fns'

/**
 * Safe date formatter — returns a fallback string when the input is null,
 * undefined, or not a valid date, instead of throwing an exception.
 *
 * Drop-in replacement for `format(new Date(x), fmt)` pattern.
 *
 * @example
 * safeFormat(row.event_date, 'MMM d')       // "Sep 8" or ""
 * safeFormat(null, 'HH:mm', '—')            // "—"
 */
export function safeFormat(
  date: string | Date | number | null | undefined,
  fmt: string,
  fallback = ''
): string {
  if (date === null || date === undefined || date === '') return fallback
  const d = new Date(date as string)
  return isValid(d) ? format(d, fmt) : fallback
}
