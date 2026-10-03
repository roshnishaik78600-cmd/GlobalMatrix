/**
 * The one number and time language.
 *
 * Every figure on the platform is formatted here and nowhere else. The rule this
 * file exists to enforce: the same concept always renders the same way. If two
 * pages show "energy exposure", they show identical digits, identical precision
 * and an identical unit — a reader must never have to work out whether `69`
 * and `0.69` are the same number before they can compare two panels.
 *
 * Three deliberate decisions:
 *
 * 1. Compact currency/magnitude suffixes ($2.4B, 1.28M, 12.4K) exist because a
 *    raw `3776380766122` is unreadable and `3.78T` loses the reader. Precision
 *    drops as magnitude grows so the string never exceeds 6 characters.
 * 2. Signed values always use a true minus sign (−, U+2212), not a hyphen, so a
 *    negative number aligns with a positive one in a tabular-nums column
 *    instead of sitting one pixel left.
 * 3. Times come in exactly two shapes: a *relative* age for "how fresh is
 *    this" ("12 min ago") and an *absolute* stamp for provenance ("2026-10-02",
 *    "Oct 2, 2026"). We never mix `02/10/26` and `Oct 2` in one interface.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* --------------------------------------------------------------- Numbers -- */

/**
 * The default numeric presentation: significant digits as given, no forced
 * trailing zeros. `num(69)` → `69`, `num(69.4)` → `69.4`.
 */
export function num(value: number, digits?: number): string {
  if (!Number.isFinite(value)) return "—";
  return digits === undefined ? String(value) : value.toFixed(digits);
}

/** Index form. The product's default scale is 0..100 unless stated otherwise. */
export function index(value: number, digits = 0): string {
  return num(value * 100, digits);
}

/** A share, always with its sign and unit. `pct(0.694)` → `69.4%`. */
export function pct(value: number, digits = 0): string {
  return `${num(value * 100, digits)}%`;
}

/** A *change*, where the direction is the point. Always signed, never unsigned. */
export function delta(value: number, digits = 1, unit = "%"): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${num(Math.abs(value) * 100, digits)}${unit}`;
}

/**
 * Money, compacted. `compact(3776380766122)` → `$3.78T`.
 *
 * Precision is deliberately tied to magnitude — four significant digits at
 * every scale would make a billion and a trillion the same string length and
 * force the reader to check the suffix.
 */
export function compact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [scale, suffix] of units) {
    if (abs >= scale) {
      const scaled = abs / scale;
      // 3+ digits before the point would overflow the column, so precision is
      // reduced to keep the whole token at 6 characters.
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${sign}$${num(scaled, digits)}${suffix}`;
    }
  }
  return `${sign}$${num(abs, 0)}`;
}

/** A count with a thousands separator. `count(1284000)` → `1,284,000`. */
export function count(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

/** Signed change in index points, for series that are not shares. */
export function points(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${num(Math.abs(value), digits)}`;
}

/* ------------------------------------------------------------------ Time -- */

/** "12 min ago" / "3 hours ago". For freshness, where the reader wants recency. */
export function ago(ms: number, now = Date.now()): string {
  if (!Number.isFinite(ms) || ms <= 0) return "never";
  const diff = now - ms;
  if (diff < 0) return "just now";
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} min ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  const d = Math.floor(diff / DAY);
  if (d < 30) return `${d} ${d === 1 ? "day" : "days"} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} ${mo === 1 ? "month" : "months"} ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/** `2026-10-02`. The canonical machine-readable date, used in dense tables. */
export function isoDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

/** `Oct 2, 2026`. The human date, used in prose and headers. */
export function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Month-first, to match the one date format the product states in prose.
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** `Oct 2`. Compact, for axis ticks and dense rows where the year is implied. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** `14:32 UTC`. Time of day, always UTC, because every stamp here is UTC. */
export function clockTime(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** `2026-10-02 14:32 UTC`. The exact stamp, for provenance and audit views. */
export function stampUTC(ms: number | undefined): string {
  if (!ms) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return `${isoDate(d.toISOString())} ${clockTime(ms)}`;
}

/**
 * The period a reading describes, normalised. Sources publish in three shapes —
 * a year, a month or a full timestamp — and the product shows whichever arrived
 * rather than padding "2025" into a fake full date.
 */
export function period(asOf: string): string {
  if (!asOf) return "—";
  if (/^\d{4}$/.test(asOf)) return asOf;
  if (/^\d{4}-\d{2}$/.test(asOf)) {
    const d = new Date(`${asOf}-01T00:00:00Z`);
    return Number.isNaN(d.getTime())
      ? asOf
      : d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  // Compact ISO basic form (`20261002T080000Z`) arrives from some connectors.
  const basic = /^(\d{4})(\d{2})(\d{2})T/.exec(asOf);
  if (basic) return `${basic[1]}-${basic[2]}-${basic[3]}`;
  return asOf;
}