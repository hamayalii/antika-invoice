/**
 * Safe numeric parser for form inputs. An empty or partially typed value must
 * read as 0 (never NaN) so every derived total stays a finite integer while
 * the user is still typing. IQD amounts are whole dinars, so the value is
 * truncated to an integer — no floating point cents, no drift.
 */
export function toWholeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : 0;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}
