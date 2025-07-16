// dateUtils.ts
import { format, isValid, parseISO } from 'date-fns';

export function safeFormat(
  isoDate: string | null | undefined,
  fmt: string,
  fallback = '—'
): string {
  if (!isoDate) return fallback;
  const dt = parseISO(isoDate);
  return isValid(dt) ? format(dt, fmt) : fallback;
}
