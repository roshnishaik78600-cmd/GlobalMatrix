/** Formatting helpers shared across the analyst surfaces. */

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function relativeDays(iso: string, from = new Date()): string {
  const diff = Math.round(
    (Date.parse(iso) - from.getTime()) / (1000 * 60 * 60 * 24),
  );
  const abs = Math.abs(diff);
  if (abs === 0) return "today";
  if (abs === 1) return diff < 0 ? "yesterday" : "tomorrow";
  return diff < 0 ? `${abs}d ago` : `in ${abs}d`;
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function score(value: number, digits = 1): string {
  return value.toFixed(digits);
}

export function signed(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
}

export function timestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}